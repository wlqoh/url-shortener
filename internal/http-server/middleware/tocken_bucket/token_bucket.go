package tocken_bucket

import (
	"net"
	"net/http"
	"strings"
	"sync"
	"time"
)

type TokenBucket struct {
	mu              sync.Mutex
	tokensPerSecond float64
	maxTokens       float64
	tokens          map[string]*bucketState
	cleanupInterval time.Duration
	stopCh          chan struct{}
	startOnce       sync.Once
	stopOnce        sync.Once
}

type bucketState struct {
	tokens     float64
	lastRefill time.Time
}

func NewTokenBucket(tokensPerSecond float64, maxTokens float64) *TokenBucket {
	tb := &TokenBucket{
		tokensPerSecond: tokensPerSecond,
		maxTokens:       maxTokens,
		tokens:          make(map[string]*bucketState),
		cleanupInterval: 5 * time.Minute,
		stopCh:          make(chan struct{}),
	}
	tb.Start()

	return tb
}

func (tb *TokenBucket) Start() {
	tb.startOnce.Do(func() {
		go tb.cleanup()
	})
}

func (tb *TokenBucket) Allow(clientID string) bool {
	if clientID == "" {
		clientID = "unknown"
	}

	tb.mu.Lock()
	defer tb.mu.Unlock()

	now := time.Now()
	bucket, exists := tb.tokens[clientID]

	if !exists {
		bucket = &bucketState{
			tokens:     tb.maxTokens - 1,
			lastRefill: now,
		}
		tb.tokens[clientID] = bucket
		return true
	}

	elapsed := now.Sub(bucket.lastRefill).Seconds()
	bucket.tokens = min(bucket.tokens+elapsed*tb.tokensPerSecond, tb.maxTokens)
	bucket.lastRefill = now

	if bucket.tokens >= 1.0 {
		bucket.tokens -= 1.0
		return true
	}

	return false
}

// getClientIP извлекает реальный IP клиента.

func (tb *TokenBucket) getClientIP(r *http.Request) string {
	if ip := strings.TrimSpace(r.Header.Get("X-Real-IP")); ip != "" {
		if net.ParseIP(ip) != nil {
			return ip
		}
	}

	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		parts := strings.Split(xff, ",")
		last := strings.TrimSpace(parts[len(parts)-1])
		if net.ParseIP(last) != nil {
			return last
		}
	}

	ip, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return ip
}

func (tb *TokenBucket) ChiRateLimitMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clientIP := tb.getClientIP(r)
		if !tb.Allow(clientIP) {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write([]byte(`{"error":"rate limit exceeded"}`))
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (tb *TokenBucket) cleanup() {
	ticker := time.NewTicker(tb.cleanupInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			tb.mu.Lock()
			now := time.Now()
			for key, state := range tb.tokens {
				if now.Sub(state.lastRefill) > tb.cleanupInterval {
					delete(tb.tokens, key)
				}
			}
			tb.mu.Unlock()
		case <-tb.stopCh:
			return
		}
	}
}
