package usersyncer

import (
	"context"
	"encoding/json"
	"log"
	"math/rand"
	"strings"
	"sync"
	"time"

	"playlistlabs_user_management_os/internal/models"
)

// UserExpiryRepository defines database access needed for expiry sync.
type UserExpiryRepository interface {
	GetUsersForExpirySync(ctx context.Context, all bool, daysRange ...int) ([]models.UserExpirySyncCandidate, error)
	UpdateUserExpiryAndConnections(ctx context.Context, listID uint64, id int, expiry time.Time, maxConnections int) error
	TouchUserUpdatedAt(ctx context.Context, listID uint64, id int) error
}

// XtreamInfoFetcher defines the interface for querying provider Xtream API.
type XtreamInfoFetcher interface {
	FetchUserInfo(ctx context.Context, baseURL, username, password string) (*XtreamCustomerInfo, error)
}

// CustomerExpirySyncer orchestrates expiration synchronization for users.
type CustomerExpirySyncer struct {
	repo         UserExpiryRepository
	xtreamClient XtreamInfoFetcher
	concurrency  int
}

// NewCustomerExpirySyncer creates a new syncer instance.
func NewCustomerExpirySyncer(repo UserExpiryRepository, xtreamClient XtreamInfoFetcher, concurrency int) *CustomerExpirySyncer {
	if concurrency <= 0 {
		concurrency = 1
	}
	return &CustomerExpirySyncer{
		repo:         repo,
		xtreamClient: xtreamClient,
		concurrency:  concurrency,
	}
}

// SyncAll runs a full expiry synchronization pass across candidates.
func (s *CustomerExpirySyncer) SyncAll(ctx context.Context, all bool, daysRange ...int) error {
	windowDays := 5
	if len(daysRange) > 0 && daysRange[0] > 0 {
		windowDays = daysRange[0]
	}
	log.Printf("[SYNC-EXPIRY] Querying customer candidates (all=%v, windowDays=%d)...\n", all, windowDays)
	candidates, err := s.repo.GetUsersForExpirySync(ctx, all, windowDays)
	if err != nil {
		return err
	}

	// Filter customers that have non-empty patterns
	var filtered []models.UserExpirySyncCandidate
	for _, c := range candidates {
		if len(c.Patterns) > 0 && string(c.Patterns) != "[]" && string(c.Patterns) != "null" {
			filtered = append(filtered, c)
		}
	}

	total := len(filtered)
	if total == 0 {
		log.Println("[SYNC-EXPIRY] No customers eligible for expiry sync")
		return nil
	}

	// Shuffle candidates (Fisher-Yates) to balance load across different providers
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	rng.Shuffle(total, func(i, j int) {
		filtered[i], filtered[j] = filtered[j], filtered[i]
	})

	log.Printf("[SYNC-EXPIRY] %d CUSTOMERS TO SYNC (concurrency=%d)\n", total, s.concurrency)

	if s.concurrency <= 1 {
		for i, c := range filtered {
			select {
			case <-ctx.Done():
				log.Println("[SYNC-EXPIRY] Interrupted by context cancellation")
				return ctx.Err()
			default:
			}
			s.processCustomer(ctx, i, total, c)
		}
	} else {
		sem := make(chan struct{}, s.concurrency)
		var wg sync.WaitGroup

		for i, c := range filtered {
			select {
			case <-ctx.Done():
				log.Println("[SYNC-EXPIRY] Interrupted by context cancellation")
				break
			case sem <- struct{}{}:
			}

			wg.Add(1)
			go func(idx int, candidate models.UserExpirySyncCandidate) {
				defer func() {
					<-sem
					wg.Done()
				}()
				s.processCustomer(ctx, idx, total, candidate)
			}(i, c)
		}

		wg.Wait()
	}

	log.Printf("[SYNC-EXPIRY] Finished syncing %d customers\n", total)
	return nil
}

func (s *CustomerExpirySyncer) processCustomer(ctx context.Context, idx, total int, c models.UserExpirySyncCandidate) {
	var patterns []models.PatternItem
	if err := json.Unmarshal(c.Patterns, &patterns); err != nil {
		log.Printf("[SYNC-EXPIRY-WARN] [%d/%d] User %s (ID %d) invalid patterns JSON: %v\n", idx+1, total, c.Name, c.ID, err)
		return
	}

	var xtreamPattern *models.PatternItem
	for i := range patterns {
		if strings.EqualFold(patterns[i].Type, "xtream") {
			xtreamPattern = &patterns[i]
			break
		}
	}

	if xtreamPattern == nil {
		return
	}

	targetURL := xtreamPattern.URL
	if xtreamPattern.UseCURL && strings.TrimSpace(xtreamPattern.CURL) != "" {
		targetURL = xtreamPattern.CURL
	}

	info, err := s.xtreamClient.FetchUserInfo(ctx, targetURL, xtreamPattern.Param1, xtreamPattern.Param2)
	if err != nil {
		log.Printf("[SYNC-EXPIRY-WARN] [%d/%d] User %s (ID %d, List %d) Xtream error: %v\n", idx+1, total, c.Name, c.ID, c.ListID, err)
		return
	}

	if info == nil || !info.Updated {
		return
	}

	// Compare expiry timestamps (ignoring sub-second differences)
	var needsUpdate bool
	if c.Expiry == nil {
		needsUpdate = true
	} else {
		needsUpdate = c.Expiry.UTC().Truncate(time.Second).Unix() != info.Expiry.UTC().Truncate(time.Second).Unix()
	}

	if needsUpdate {
		if err := s.repo.UpdateUserExpiryAndConnections(ctx, c.ListID, c.ID, info.Expiry, info.MaxConnections); err != nil {
			log.Printf("[SYNC-EXPIRY-ERR] [%d/%d] Failed updating DB for User %s (ID %d): %v\n", idx+1, total, c.Name, c.ID, err)
			return
		}
		var oldExpStr string
		if c.Expiry != nil {
			oldExpStr = c.Expiry.Format("2006-01-02 15:04:05")
		} else {
			oldExpStr = "null"
		}
		log.Printf("[SYNC-EXPIRY] [%d/%d] User %s (ID %d, List %d) expiry updated: %s -> %s (max_conn=%d)\n",
			idx+1, total, c.Name, c.ID, c.ListID, oldExpStr, info.Expiry.Format("2006-01-02 15:04:05"), info.MaxConnections)
	} else {
		_ = s.repo.TouchUserUpdatedAt(ctx, c.ListID, c.ID)
		log.Printf("[SYNC-EXPIRY] [%d/%d] User %s (ID %d, List %d) expiry unchanged (%s), touched updatedAt\n",
			idx+1, total, c.Name, c.ID, c.ListID, info.Expiry.Format("2006-01-02 15:04:05"))
	}
}
