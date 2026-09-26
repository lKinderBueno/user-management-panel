package db

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"time"

	_ "github.com/go-sql-driver/mysql"
)

// NewDB establishes a connection pool to MariaDB.
func NewDB(dsn string) (*sql.DB, error) {
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database handle: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(10)
	db.SetConnMaxLifetime(5 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to mariadb: %w", err)
	}

	return db, nil
}

// SplitSQLStatements splits an SQL script into executable statements, handling DELIMITER commands and comments.
func SplitSQLStatements(content string) []string {
	var statements []string
	lines := strings.Split(content, "\n")
	delimiter := ";"
	var currentStmt strings.Builder

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "--") || strings.HasPrefix(trimmed, "/*") {
			continue
		}
		if strings.HasPrefix(strings.ToUpper(trimmed), "DELIMITER ") {
			parts := strings.Fields(trimmed)
			if len(parts) >= 2 {
				delimiter = parts[1]
			}
			continue
		}
		if trimmed == "" {
			continue
		}

		if currentStmt.Len() > 0 {
			currentStmt.WriteString("\n")
		}
		currentStmt.WriteString(line)

		currentStr := strings.TrimRight(currentStmt.String(), " \t\r\n")
		if strings.HasSuffix(currentStr, delimiter) {
			stmt := strings.TrimSuffix(currentStr, delimiter)
			stmt = strings.TrimSpace(stmt)
			if stmt != "" {
				statements = append(statements, stmt)
			}
			currentStmt.Reset()
		}
	}

	remaining := strings.TrimSpace(currentStmt.String())
	if remaining != "" {
		statements = append(statements, remaining)
	}

	return statements
}

// RunMigrationFile executes an SQL migration script (e.g. 001_init_schema.sql).
func RunMigrationFile(ctx context.Context, db *sql.DB, filePath string) error {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("could not read schema file %s: %w", filePath, err)
	}

	queries := SplitSQLStatements(string(content))
	for _, q := range queries {
		if _, err := db.ExecContext(ctx, q); err != nil {
			return fmt.Errorf("failed executing query [%s]: %w", q, err)
		}
	}

	return nil
}
