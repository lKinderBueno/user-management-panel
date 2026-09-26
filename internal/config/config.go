package config

import (
	"fmt"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config holds all configuration options for the application.
type Config struct {
	// PlaylistLabs Token API configuration
	ApiURL      string
	ApiToken    string
	ApiPassword string

	// MariaDB database connection settings
	DBDSN string

	// Optional Redis configuration (ignored if empty/not configured)
	RedisHost     string
	RedisPort     string
	RedisPassword string
	RedisDB       int
	RedisURL      string

	// Anti-Brute-Force configuration
	AntiBruteForceMaxAttempts int
	AntiBruteForceWindow      time.Duration
	AntiBruteForceBanDuration time.Duration

	// TMDB configuration
	TMDBApiKey string

	// Sync engine parameters
	SyncInterval time.Duration
	EpgDays      int
	BatchSize    int
	HTTPTimeout  time.Duration

	// Orphan reconciliation settings
	DisableOrphanReconciliation bool

	// Logging level (debug, info, warn, error)
	LogLevel string
}

// Load loads configuration from environment variables, automatically reading from .env if present.
func Load() (*Config, error) {
	// Automatically load .env file if present in the current working directory
	loadDotEnv(".env")

	// PlaylistLabs Token API configuration (supports PLAYLISTLABS_API_* and legacy IPTVEDITOR_API_*)
	apiURL := getEnv("PLAYLISTLABS_API_URL", getEnv("IPTVEDITOR_API_URL", "https://api.playlistlabs.io"))
	apiURL = strings.TrimRight(apiURL, "/")

	apiToken := getEnv("PLAYLISTLABS_API_TOKEN", getEnv("IPTVEDITOR_API_TOKEN", ""))
	apiPassword := getEnv("PLAYLISTLABS_API_PASSWORD", getEnv("IPTVEDITOR_API_PASSWORD", ""))

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = os.Getenv("DB_DSN")
	}
	if dsn == "" {
		host := getEnv("MARIADB_HOST", "127.0.0.1")
		port := getEnv("MARIADB_PORT", "3306")
		user := GetSecretOrEnv("MARIADB_USER", "MARIADB_USER_FILE", "/run/secrets/db_user", "playlistlabs")
		pass := GetSecretOrEnv("MARIADB_PASSWORD", "MARIADB_PASSWORD_FILE", "/run/secrets/db_password", "playlistlabspass")
		name := getEnv("MARIADB_DATABASE", "playlistlabs")

		dsn = fmt.Sprintf("%s:%s@tcp(%s:%s)/%s?charset=utf8mb4&parseTime=True&loc=UTC",
			url.QueryEscape(user),
			pass,
			host,
			port,
			name,
		)
	}

	syncIntervalStr := getEnv("SYNC_INTERVAL", "0")
	var syncInterval time.Duration
	if syncIntervalStr != "0" && syncIntervalStr != "" {
		d, err := time.ParseDuration(syncIntervalStr)
		if err == nil {
			syncInterval = d
		}
	}

	epgDays, _ := strconv.Atoi(getEnv("EPG_DAYS", "7"))
	if epgDays <= 0 {
		epgDays = 7
	}

	batchSize, _ := strconv.Atoi(getEnv("BATCH_SIZE", "5000"))
	if batchSize <= 0 {
		batchSize = 5000
	}

	timeoutSec, _ := strconv.Atoi(getEnv("HTTP_TIMEOUT", "60"))
	if timeoutSec <= 0 {
		timeoutSec = 60
	}

	const DefaultTMDBApiKey = "a2764023c82b647eac48485b4deac0bf"
	tmdbApiKey := getEnv("TMDB_API_KEY", DefaultTMDBApiKey)

	// Redis settings (optional)
	redisHost := getEnv("REDIS_HOST", "")
	redisPort := getEnv("REDIS_PORT", "6379")
	redisPass := getEnv("REDIS_PASSWORD", "")
	redisURL := getEnv("REDIS_URL", "")
	redisDB, _ := strconv.Atoi(getEnv("REDIS_DB", "0"))

	// Anti-Brute-Force settings
	maxAttempts, _ := strconv.Atoi(getEnv("ANTIBRUTEFORCE_MAX_ATTEMPTS", "5"))
	if maxAttempts <= 0 {
		maxAttempts = 5
	}
	windowMinutes, _ := strconv.Atoi(getEnv("ANTIBRUTEFORCE_WINDOW_MINUTES", "15"))
	if windowMinutes <= 0 {
		windowMinutes = 15
	}
	banHours, _ := strconv.Atoi(getEnv("ANTIBRUTEFORCE_BAN_HOURS", "24"))
	if banHours <= 0 {
		banHours = 24
	}

	cfg := &Config{
		ApiURL:                    apiURL,
		ApiToken:                  apiToken,
		ApiPassword:               apiPassword,
		DBDSN:                     dsn,
		RedisHost:                 redisHost,
		RedisPort:                 redisPort,
		RedisPassword:             redisPass,
		RedisURL:                  redisURL,
		RedisDB:                   redisDB,
		AntiBruteForceMaxAttempts: maxAttempts,
		AntiBruteForceWindow:      time.Duration(windowMinutes) * time.Minute,
		AntiBruteForceBanDuration: time.Duration(banHours) * time.Hour,
		TMDBApiKey:                tmdbApiKey,
		SyncInterval:              syncInterval,
		EpgDays:                   epgDays,
		BatchSize:                 batchSize,
		HTTPTimeout:               time.Duration(timeoutSec) * time.Second,
		DisableOrphanReconciliation: os.Getenv("DISABLE_ORPHAN_RECONCILIATION") == "true" || os.Getenv("DISABLE_ORPHAN_RECONCILIATION") == "1",
		LogLevel:                    getEnv("LOG_LEVEL", "info"),
	}

	return cfg, nil
}

func getEnv(key, defaultVal string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return defaultVal
}

// GetSecretOrEnv retrieves a configuration value checking in order:
// 1. Path specified in secretFileEnvKey (e.g. MARIADB_PASSWORD_FILE)
// 2. Default secret path in container (e.g. /run/secrets/db_password)
// 3. Environment variable envKey (e.g. MARIADB_PASSWORD)
// 4. Fallback defaultVal
func GetSecretOrEnv(envKey, secretFileEnvKey, defaultSecretPath, defaultVal string) string {
	if secretFileEnvKey != "" {
		if path := os.Getenv(secretFileEnvKey); path != "" {
			if content, err := os.ReadFile(path); err == nil {
				if trimmed := strings.TrimSpace(string(content)); trimmed != "" {
					return trimmed
				}
			}
		}
	}

	if defaultSecretPath != "" {
		if content, err := os.ReadFile(defaultSecretPath); err == nil {
			if trimmed := strings.TrimSpace(string(content)); trimmed != "" {
				return trimmed
			}
		}
	}

	if envKey != "" {
		if val := os.Getenv(envKey); val != "" {
			return val
		}
	}

	return defaultVal
}

// loadDotEnv parses a .env file and sets environment variables if not already set.
func loadDotEnv(filepath string) {
	data, err := os.ReadFile(filepath)
	if err != nil {
		return
	}
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			val = strings.Trim(val, `"'`)
			if _, exists := os.LookupEnv(key); !exists {
				_ = os.Setenv(key, val)
			}
		}
	}
}
