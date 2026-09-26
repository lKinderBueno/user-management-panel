package main

import (
	"context"
	"crypto/rand"
	"database/sql"
	"errors"
	"flag"
	"fmt"
	"log"
	"math/big"
	"os"
	"strings"
	"time"

	"playlistlabs_user_management_os/internal/config"
	"playlistlabs_user_management_os/internal/db"

	"golang.org/x/crypto/bcrypt"
)

const (
	charLower   = "abcdefghijklmnopqrstuvwxyz"
	charUpper   = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
	charDigits  = "0123456789"
	charSymbols = "!@#$%^&*-_+="
)

// generateSecurePassword generates a high-entropy random password with mixed character classes.
func generateSecurePassword(length int) (string, error) {
	if length < 8 {
		length = 8
	}
	if length > 64 {
		length = 64
	}

	allChars := charLower + charUpper + charDigits + charSymbols

	// Ensure at least one character from each class
	requiredClasses := []string{charLower, charUpper, charDigits, charSymbols}
	passwordChars := make([]byte, length)

	for i, class := range requiredClasses {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(class))))
		if err != nil {
			return "", err
		}
		passwordChars[i] = class[idx.Int64()]
	}

	// Fill remaining characters
	for i := len(requiredClasses); i < length; i++ {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(allChars))))
		if err != nil {
			return "", err
		}
		passwordChars[i] = allChars[idx.Int64()]
	}

	// Fisher-Yates shuffle using crypto/rand
	for i := length - 1; i > 0; i-- {
		jBig, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return "", err
		}
		j := int(jBig.Int64())
		passwordChars[i], passwordChars[j] = passwordChars[j], passwordChars[i]
	}

	return string(passwordChars), nil
}

func printUsage() {
	fmt.Println(`
===================================================================
 PlaylistLabs - Password Reset & Generator CLI
===================================================================
Usage:
  docker compose exec server reset_password [options] [username]
  ./reset-password.sh [options] [username]
  go run ./cmd/reset_password [options] [username]
  npm run reset-password -- [options] [username]

Options:
  -u, -user <string>      Username of the account to reset (default: "admin")
  -p, -password <string>  Explicit password to set (if omitted, a secure one is generated)
  -l, -length <int>       Length of the auto-generated password (default: 16)
  -unblock                Unblock IP and clear failed attempts in anti-brute-force (default: true)
  -reset-host-restrictions Clear admin hostname and disable host restrictions
  -h, -help               Show this help message

Examples:
  # Generate a new random password for user "admin" (default)
  go run ./cmd/reset_password

  # Generate a new password for a specific user
  go run ./cmd/reset_password -u collaborator1

  # Set an explicit password for admin
  go run ./cmd/reset_password -u admin -p "SecretPassword123!"

  # Generate a 24-character password
  go run ./cmd/reset_password -l 24
===================================================================`)
}

func main() {
	var (
		userShort             string
		userLong              string
		passShort             string
		passLong              string
		lengthShort           int
		lengthLong            int
		unblock               bool
		resetHostRestrictions bool
		showHelp              bool
	)

	flag.StringVar(&userShort, "u", "", "Account username (alias for -user)")
	flag.StringVar(&userLong, "user", "", "Account username (default: admin)")
	flag.StringVar(&passShort, "p", "", "New password to set (alias for -password)")
	flag.StringVar(&passLong, "password", "", "New password to set (optional)")
	flag.IntVar(&lengthShort, "l", 16, "Generated password length (alias for -length)")
	flag.IntVar(&lengthLong, "length", 16, "Generated password length (default: 16)")
	flag.BoolVar(&unblock, "unblock", true, "Clear failed attempts and unblock IP in anti-brute-force")
	flag.BoolVar(&resetHostRestrictions, "reset-host-restrictions", false, "Clear admin hostname and disable host restrictions")
	flag.BoolVar(&showHelp, "help", false, "Show usage help")
	flag.BoolVar(&showHelp, "h", false, "Show usage help")

	flag.Usage = printUsage
	flag.Parse()

	if showHelp {
		printUsage()
		os.Exit(0)
	}

	// Determine username: flag > positional argument > default "admin"
	username := "admin"
	if userLong != "" {
		username = strings.TrimSpace(userLong)
	} else if userShort != "" {
		username = strings.TrimSpace(userShort)
	} else if len(flag.Args()) > 0 && strings.TrimSpace(flag.Arg(0)) != "" {
		username = strings.TrimSpace(flag.Arg(0))
	}

	// Determine password: flag > generate random
	var (
		newPassword string
		isGenerated bool
	)
	if passLong != "" {
		newPassword = passLong
	} else if passShort != "" {
		newPassword = passShort
	}

	length := lengthLong
	if lengthShort != 16 {
		length = lengthShort
	}

	if newPassword == "" {
		generated, err := generateSecurePassword(length)
		if err != nil {
			log.Fatalf("[ERROR] Random password generation failed: %v", err)
		}
		newPassword = generated
		isGenerated = true
	}

	// Load environment and DB configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("[ERROR] Failed to load configuration (.env): %v", err)
	}

	database, err := db.NewDB(cfg.DBDSN)
	if err != nil {
		log.Fatalf("[ERROR] Failed to connect to MariaDB: %v", err)
	}
	defer database.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if resetHostRestrictions {
		_, err := database.ExecContext(ctx, `
			UPDATE system_settings 
			SET admin_hostname = NULL,
			    block_streaming_on_admin_host = 1,
			    restrict_admin_to_admin_host = 0,
			    block_direct_ip_streaming = 0
			WHERE id = 1
		`)
		if err != nil {
			log.Printf("[WARN] Failed to reset host restrictions in system_settings: %v", err)
		} else {
			fmt.Println("[INFO] Host restrictions successfully reset to defaults in system_settings.")
		}
	}

	// 1. Look up user in `admins` table
	var (
		adminID int
		role    string
	)
	err = database.QueryRowContext(ctx, "SELECT id, COALESCE(role, 'admin') FROM admins WHERE username = ?", username).Scan(&adminID, &role)

	if err == nil {
		// Found in admins -> Update password with bcrypt
		hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("[ERROR] Failed to hash password with bcrypt: %v", err)
		}

		_, err = database.ExecContext(ctx, "UPDATE admins SET password_hash = ?, updated_at = NOW() WHERE id = ?", string(hash), adminID)
		if err != nil {
			log.Fatalf("[ERROR] Failed to update password in database: %v", err)
		}

		unblockedCount := 0
		if unblock {
			unblockedCount = unblockUserIPs(ctx, database, username)
		}

		printSuccessBanner("ADMIN / COLLABORATOR", username, role, newPassword, isGenerated, unblockedCount)
		return
	}

	// If not found in admins
	if !errors.Is(err, sql.ErrNoRows) {
		log.Fatalf("[ERROR] Query failed while checking user: %v", err)
	}

	// Case: Username is 'admin' but record does not exist in admins table -> Create root admin
	if username == "admin" {
		hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
		if err != nil {
			log.Fatalf("[ERROR] Failed to hash password with bcrypt: %v", err)
		}

		_, err = database.ExecContext(ctx, `
			INSERT INTO admins (username, password_hash, role, manage_all_playlists, can_see_all_users, can_create_collaborators, can_create_admins)
			VALUES ('admin', ?, 'admin', 1, 1, 1, 1)
		`, string(hash))
		if err != nil {
			log.Fatalf("[ERROR] Failed to create default admin account: %v", err)
		}

		unblockedCount := 0
		if unblock {
			unblockedCount = unblockUserIPs(ctx, database, username)
		}

		printSuccessBanner("ADMIN (CREATED FRESH)", username, "admin", newPassword, isGenerated, unblockedCount)
		return
	}

	// Case: Check if user exists in `managed_users` (client lines)
	var managedCount int
	_ = database.QueryRowContext(ctx, "SELECT COUNT(*) FROM managed_users WHERE username = ?", username).Scan(&managedCount)
	if managedCount > 0 {
		// Update password in managed_users (plaintext as required by Xtream / M3U specs)
		_, err = database.ExecContext(ctx, "UPDATE managed_users SET password = ?, updatedAt = NOW() WHERE username = ?", newPassword, username)
		if err != nil {
			log.Fatalf("[ERROR] Failed to update password in managed_users: %v", err)
		}

		unblockedCount := 0
		if unblock {
			unblockedCount = unblockUserIPs(ctx, database, username)
		}

		printSuccessBanner("CLIENT LINE (managed_users)", username, "client", newPassword, isGenerated, unblockedCount)
		return
	}

	// User not found anywhere
	fmt.Printf("\n[ERROR] No user found with username '%s' in either 'admins' or 'managed_users' table.\n", username)
	fmt.Println("Hint: To create a new administrator with this name, use the dashboard or reset user 'admin'.")
	os.Exit(1)
}

// unblockUserIPs unbans any blocked IPs related to the given username in security tables.
func unblockUserIPs(ctx context.Context, db *sql.DB, username string) int {
	rows, err := db.QueryContext(ctx, "SELECT DISTINCT ip FROM security_access_logs WHERE username = ?", username)
	if err != nil {
		return 0
	}
	defer rows.Close()

	unblocked := 0
	for rows.Next() {
		var ip string
		if err := rows.Scan(&ip); err == nil && ip != "" {
			res, err := db.ExecContext(ctx, `
				UPDATE security_ip_bans 
				SET is_blocked = 0, failed_attempts = 0, unblocked_at = NOW() 
				WHERE ip = ? AND is_blocked = 1
			`, ip)
			if err == nil {
				if n, _ := res.RowsAffected(); n > 0 {
					unblocked += int(n)
				}
			}
		}
	}

	// Clear failed access logs for this username
	_, _ = db.ExecContext(ctx, "DELETE FROM security_access_logs WHERE username = ? AND success = 0", username)

	return unblocked
}

func printSuccessBanner(accountType, username, role, password string, isGenerated bool, unblockedIPs int) {
	fmt.Println("\n" + strings.Repeat("=", 68))
	fmt.Println("       PLAYLISTLABS - PASSWORD RESET COMPLETED")
	fmt.Println(strings.Repeat("=", 68))
	fmt.Printf(" Account Type:    %s\n", accountType)
	fmt.Printf(" Username:        %s\n", username)
	fmt.Printf(" Role:            %s\n", role)
	if isGenerated {
		fmt.Printf(" New Password:    \033[1;32m%s\033[0m  (Randomly generated)\n", password)
	} else {
		fmt.Printf(" New Password:    \033[1;32m%s\033[0m  (Manually provided)\n", password)
	}
	if unblockedIPs > 0 {
		fmt.Printf(" Anti-Brute-Force: Unblocked %d IP(s) and cleared failed attempts\n", unblockedIPs)
	} else {
		fmt.Printf(" Anti-Brute-Force: Cleared failed attempts\n")
	}
	fmt.Println(strings.Repeat("-", 68))
	fmt.Println(" Access:          You can now log in immediately with these credentials.")
	fmt.Println(strings.Repeat("=", 68) + "\n")
}
