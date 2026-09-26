package captcha

import (
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"sync"
	"time"
)

type item struct {
	answer    string
	expiresAt time.Time
}

type Store struct {
	mu    sync.RWMutex
	items map[string]item
}

var defaultStore = &Store{
	items: make(map[string]item),
}

func init() {
	go func() {
		ticker := time.NewTicker(2 * time.Minute)
		for range ticker.C {
			defaultStore.cleanup()
		}
	}()
}

func (s *Store) cleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for id, it := range s.items {
		if now.After(it.expiresAt) {
			delete(s.items, id)
		}
	}
}

// Generate creates a new captcha, saves it in the store for 5 minutes, and returns the ID and SVG string.
func Generate() (string, string, error) {
	chars := "23456789ABCDEFGHJKMNPQRSTUVWXYZ"
	length := 4
	var answer strings.Builder
	for i := 0; i < length; i++ {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			return "", "", err
		}
		answer.WriteByte(chars[n.Int64()])
	}

	idBytes := make([]byte, 16)
	if _, err := rand.Read(idBytes); err != nil {
		return "", "", err
	}
	id := fmt.Sprintf("%x", idBytes)

	defaultStore.mu.Lock()
	defaultStore.items[id] = item{
		answer:    answer.String(),
		expiresAt: time.Now().Add(5 * time.Minute),
	}
	defaultStore.mu.Unlock()

	svg := generateSVG(answer.String())
	return id, svg, nil
}

// SetForTest allows setting a predetermined captcha answer for automated tests.
func SetForTest(id, answer string) {
	defaultStore.mu.Lock()
	defer defaultStore.mu.Unlock()
	defaultStore.items[id] = item{
		answer:    answer,
		expiresAt: time.Now().Add(5 * time.Minute),
	}
}

// Verify checks the captcha answer for the given id. Once checked, the captcha is invalidated.
func Verify(id, userInput string) bool {
	defaultStore.mu.Lock()
	defer defaultStore.mu.Unlock()

	it, exists := defaultStore.items[id]
	if !exists {
		return false
	}
	delete(defaultStore.items, id)

	if time.Now().After(it.expiresAt) {
		return false
	}

	return strings.EqualFold(strings.TrimSpace(it.answer), strings.TrimSpace(userInput))
}

func generateSVG(text string) string {
	width := 140
	height := 44

	colors := []string{"#38bdf8", "#34d399", "#fbbf24", "#f472b6", "#a78bfa", "#60a5fa"}

	var lines strings.Builder
	for i := 0; i < 4; i++ {
		x1, _ := rand.Int(rand.Reader, big.NewInt(int64(width)))
		y1, _ := rand.Int(rand.Reader, big.NewInt(int64(height)))
		x2, _ := rand.Int(rand.Reader, big.NewInt(int64(width)))
		y2, _ := rand.Int(rand.Reader, big.NewInt(int64(height)))
		cIdx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(colors))))
		lines.WriteString(fmt.Sprintf(`<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.5" stroke-opacity="0.4" />`,
			x1.Int64(), y1.Int64(), x2.Int64(), y2.Int64(), colors[cIdx.Int64()]))
	}

	var chars strings.Builder
	charWidth := width / (len(text) + 1)
	for i, c := range text {
		rot, _ := rand.Int(rand.Reader, big.NewInt(30))
		deg := rot.Int64() - 15 // -15 to +15 deg
		cIdx, _ := rand.Int(rand.Reader, big.NewInt(int64(len(colors))))
		x := (i+1)*charWidth - 5
		y := height/2 + 7

		chars.WriteString(fmt.Sprintf(
			`<text x="%d" y="%d" fill="%s" font-size="24" font-weight="bold" font-family="monospace, sans-serif" transform="rotate(%d %d %d)">%c</text>`,
			x, y, colors[cIdx.Int64()], deg, x, y, c,
		))
	}

	return fmt.Sprintf(
		`<svg xmlns="http://www.w3.org/2000/svg" width="%d" height="%d" viewBox="0 0 %d %d" style="background:#0f172a; border-radius:6px; user-select:none; border: 1px solid #334155;">%s%s</svg>`,
		width, height, width, height, lines.String(), chars.String(),
	)
}
