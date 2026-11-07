// Package mail — отправка писем. Почтовый сервис ещё не выбран, поэтому письма пишутся в журнал.
// Когда сервис появится, реализация Mailer переедет в worker (письма шлёт только он),
// а api будет ставить письма в очередь.
package mail

import (
	"context"
	"log/slog"
)

// Mailer отправляет одно письмо.
type Mailer interface {
	Send(ctx context.Context, to, subject, body string) error
}

// LogMailer пишет письмо в журнал вместо отправки.
type LogMailer struct {
	Log *slog.Logger
}

func (m LogMailer) Send(_ context.Context, to, subject, body string) error {
	m.Log.Info("письмо (в журнал, почта не подключена)", "to", to, "subject", subject, "body", body)
	return nil
}
