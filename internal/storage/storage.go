package storage

import (
	"errors"
)

type Storage interface {
	SaveURL(urlToSave, alias string) (int64, error)
	GetURL(alias string) (string, error)
	DeleteURL(alias string) error
}

var (
	ErrURLNotFound = errors.New("url not found")
	ErrURLExists   = errors.New("URL does exist")
)
