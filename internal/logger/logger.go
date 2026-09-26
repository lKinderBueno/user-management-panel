package logger

import (
	"context"
	"io"
	"log"
	"log/slog"
	"os"
	"strings"
	"sync"
	"time"
)

const defaultBufferSize = 2000

// LogEntry represents a captured log message with its timestamp and level.
type LogEntry struct {
	Timestamp time.Time `json:"timestamp"`
	Level     string    `json:"level"`
	Message   string    `json:"message"`
	Formatted string    `json:"formatted"`
}

// RingBuffer stores a fixed number of log entries in memory in a thread-safe circular buffer.
type RingBuffer struct {
	mu       sync.RWMutex
	entries  []LogEntry
	capacity int
	start    int
	count    int
}

// NewRingBuffer creates a new ring buffer with the given capacity.
func NewRingBuffer(capacity int) *RingBuffer {
	if capacity <= 0 {
		capacity = defaultBufferSize
	}
	return &RingBuffer{
		entries:  make([]LogEntry, capacity),
		capacity: capacity,
	}
}

// Add appends a new entry to the circular buffer.
func (rb *RingBuffer) Add(entry LogEntry) {
	rb.mu.Lock()
	defer rb.mu.Unlock()

	if rb.count < rb.capacity {
		rb.entries[(rb.start+rb.count)%rb.capacity] = entry
		rb.count++
	} else {
		rb.entries[rb.start] = entry
		rb.start = (rb.start + 1) % rb.capacity
	}
}

// GetRecent returns the last `limit` log entries in chronological order.
func (rb *RingBuffer) GetRecent(limit int) []LogEntry {
	rb.mu.RLock()
	defer rb.mu.RUnlock()

	if limit <= 0 || limit > rb.count {
		limit = rb.count
	}

	result := make([]LogEntry, limit)
	skip := rb.count - limit
	for i := 0; i < limit; i++ {
		idx := (rb.start + skip + i) % rb.capacity
		result[i] = rb.entries[idx]
	}
	return result
}

// GetRecentLines returns the formatted lines of the last `limit` log entries.
func (rb *RingBuffer) GetRecentLines(limit int) []string {
	entries := rb.GetRecent(limit)
	lines := make([]string, len(entries))
	for i, e := range entries {
		lines[i] = e.Formatted
	}
	return lines
}

// Clear flushes all entries from the ring buffer.
func (rb *RingBuffer) Clear() {
	rb.mu.Lock()
	defer rb.mu.Unlock()
	rb.entries = make([]LogEntry, rb.capacity)
	rb.start = 0
	rb.count = 0
}

var (
	globalRingBuffer = NewRingBuffer(defaultBufferSize)
	globalLevelVar   = new(slog.LevelVar)
	initOnce         sync.Once
)

// bufferWriter is an io.Writer that writes to stdout and feeds into the ring buffer.
type bufferWriter struct {
	out io.Writer
	rb  *RingBuffer
}

func (w *bufferWriter) Write(p []byte) (n int, err error) {
	n, err = w.out.Write(p)

	line := strings.TrimRight(string(p), "\r\n")
	if len(line) > 0 {
		level := "INFO"
		upper := strings.ToUpper(line)
		if strings.Contains(upper, "[DEBUG]") || strings.Contains(upper, "LEVEL=DEBUG") {
			level = "DEBUG"
		} else if strings.Contains(upper, "[WARN]") || strings.Contains(upper, "LEVEL=WARN") {
			level = "WARN"
		} else if strings.Contains(upper, "[ERROR]") || strings.Contains(upper, "[FATAL]") || strings.Contains(upper, "LEVEL=ERROR") {
			level = "ERROR"
		}

		w.rb.Add(LogEntry{
			Timestamp: time.Now().UTC(),
			Level:     level,
			Message:   line,
			Formatted: line,
		})
	}

	return n, err
}

// ParseLevel converts a string into a slog.Level. Defaults to slog.LevelInfo.
func ParseLevel(levelStr string) slog.Level {
	switch strings.ToLower(strings.TrimSpace(levelStr)) {
	case "debug":
		return slog.LevelDebug
	case "warn", "warning":
		return slog.LevelWarn
	case "error", "err":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}

// FormatLevel converts a slog.Level back to a friendly string.
func FormatLevel(lvl slog.Level) string {
	switch {
	case lvl <= slog.LevelDebug:
		return "debug"
	case lvl <= slog.LevelInfo:
		return "info"
	case lvl <= slog.LevelWarn:
		return "warn"
	default:
		return "error"
	}
}

// Init configures the global logger and sets the default level from the given string.
// If levelStr is empty, it will inspect the LOG_LEVEL environment variable or default to "info".
func Init(levelStr string) *slog.Logger {
	if levelStr == "" {
		levelStr = os.Getenv("LOG_LEVEL")
	}
	level := ParseLevel(levelStr)
	globalLevelVar.Set(level)

	w := &bufferWriter{
		out: os.Stdout,
		rb:  globalRingBuffer,
	}

	opts := &slog.HandlerOptions{
		Level: globalLevelVar,
		ReplaceAttr: func(groups []string, a slog.Attr) slog.Attr {
			if a.Key == slog.TimeKey {
				// Format time consistently
				if t, ok := a.Value.Any().(time.Time); ok {
					return slog.String(slog.TimeKey, t.UTC().Format("2006-01-02 15:04:05.000"))
				}
			}
			return a
		},
	}

	handler := slog.NewTextHandler(w, opts)
	l := slog.New(handler)
	slog.SetDefault(l)

	// Redirect standard log package output into the same writer with no duplicate timestamps
	log.SetOutput(w)
	log.SetFlags(log.Ldate | log.Ltime | log.Lmicroseconds)

	return l
}

// SetLevel updates the logging level at runtime.
func SetLevel(levelStr string) {
	globalLevelVar.Set(ParseLevel(levelStr))
}

// GetLevel returns the current active log level name ("debug", "info", "warn", "error").
func GetLevel() string {
	return FormatLevel(globalLevelVar.Level())
}

// GetRecentLogs retrieves up to `limit` raw formatted log lines from the in-memory ring buffer.
func GetRecentLogs(limit int) []string {
	return globalRingBuffer.GetRecentLines(limit)
}

// GetRecentEntries retrieves up to `limit` structured LogEntry records.
func GetRecentEntries(limit int) []LogEntry {
	return globalRingBuffer.GetRecent(limit)
}

// Helper wrapper functions
func Debug(msg string, args ...any) {
	slog.Debug(msg, args...)
}

func Info(msg string, args ...any) {
	slog.Info(msg, args...)
}

func Warn(msg string, args ...any) {
	slog.Warn(msg, args...)
}

func Error(msg string, args ...any) {
	slog.Error(msg, args...)
}

func Log(ctx context.Context, level slog.Level, msg string, args ...any) {
	slog.Log(ctx, level, msg, args...)
}

// Default returns the default global slog.Logger.
func Default() *slog.Logger {
	return slog.Default()
}

// GetRingBuffer returns the global ring buffer instance.
func GetRingBuffer() *RingBuffer {
	return globalRingBuffer
}
