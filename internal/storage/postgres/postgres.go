package postgres

import (
	"database/sql"
	"errors"
	"fmt"
	"urlshortener/internal/storage"

	"github.com/lib/pq"
)

type Storage struct {
	db *sql.DB
}

func New(storagePath string) (*Storage, error) {
	const op = "storage.postgres.New"

	db, err := sql.Open("postgres", storagePath)
	if err != nil {
		return nil, fmt.Errorf("%s: %w", op, err)
	}

	if _, err = db.Exec(`
		CREATE TABLE IF NOT EXISTS url (
			id    BIGSERIAL PRIMARY KEY,
			alias TEXT NOT NULL UNIQUE,
			url   TEXT NOT NULL
		)
	`); err != nil {
		return nil, fmt.Errorf("%s: %w", op, err)
	}

	if _, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_alias ON url(alias)`); err != nil {
		return nil, fmt.Errorf("%s: %w", op, err)
	}

	return &Storage{db: db}, nil
}

// SaveURL saving url in DB.
func (s *Storage) SaveURL(urlToSave, alias string) (int64, error) {
	const op = "storage.postgres.SaveURL"

	var id int64
	err := s.db.QueryRow(
		"INSERT INTO url (url, alias) VALUES ($1, $2) RETURNING id",
		urlToSave,
		alias,
	).Scan(&id)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return 0, fmt.Errorf("%s: %w", op, storage.ErrURLExists)
		}

		return 0, fmt.Errorf("%s: %w", op, err)
	}

	return id, nil
}

// GetURL gets url using alias.
func (s *Storage) GetURL(alias string) (string, error) {
	const op = "storage.postgres.GetURL"

	var resURL string
	err := s.db.QueryRow("SELECT url FROM url WHERE alias = $1", alias).Scan(&resURL)
	if errors.Is(err, sql.ErrNoRows) {
		return "", storage.ErrURLNotFound
	}
	if err != nil {
		return "", fmt.Errorf("%s: execute statement %w", op, err)
	}

	return resURL, nil
}

// DeleteURL deleting url from DB using alias.
func (s *Storage) DeleteURL(alias string) error {
	const op = "storage.postgres.DeleteURL"

	result, err := s.db.Exec("DELETE FROM url WHERE alias = $1", alias)
	if err != nil {
		return fmt.Errorf("%s: execute statement %w", op, err)
	}

	rows, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("%s: get rows affected %w", op, err)
	}

	if rows == 0 {
		return storage.ErrURLNotFound
	}

	return nil
}
