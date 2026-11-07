package auth

import (
	"sync"
	"time"
)

// loginLimiter считает неудачные попытки входа по ключу IP+почта и блокирует ключ на окно.
// Хранится в памяти: после перезапуска api счётчики обнуляются — для MVP этого достаточно.
type loginLimiter struct {
	mu       sync.Mutex
	max      int
	window   time.Duration
	attempts map[string]*attempt
	now      func() time.Time
}

type attempt struct {
	count int
	first time.Time
}

func newLoginLimiter(max int, window time.Duration) *loginLimiter {
	return &loginLimiter{max: max, window: window, attempts: map[string]*attempt{}, now: time.Now}
}

// Blocked сообщает, исчерпаны ли попытки, и через сколько их можно повторить.
func (l *loginLimiter) Blocked(key string) (bool, time.Duration) {
	l.mu.Lock()
	defer l.mu.Unlock()
	a, ok := l.attempts[key]
	if !ok {
		return false, 0
	}
	left := a.first.Add(l.window).Sub(l.now())
	if left <= 0 {
		delete(l.attempts, key)
		return false, 0
	}
	return a.count >= l.max, left
}

// Fail записывает неудачную попытку.
func (l *loginLimiter) Fail(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now()
	a, ok := l.attempts[key]
	if !ok || now.Sub(a.first) >= l.window {
		l.prune(now)
		l.attempts[key] = &attempt{count: 1, first: now}
		return
	}
	a.count++
}

// Reset сбрасывает счётчик после успешного входа.
func (l *loginLimiter) Reset(key string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.attempts, key)
}

// prune убирает устаревшие записи, чтобы карта не росла бесконечно.
func (l *loginLimiter) prune(now time.Time) {
	if len(l.attempts) < 10000 {
		return
	}
	for k, a := range l.attempts {
		if now.Sub(a.first) >= l.window {
			delete(l.attempts, k)
		}
	}
}
