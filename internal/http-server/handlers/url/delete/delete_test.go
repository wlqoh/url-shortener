package delete

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"urlshortener/internal/http-server/handlers/url/save"
	"urlshortener/internal/lib/logger/handlers/slogdiscard"
	"urlshortener/internal/storage"

	"github.com/go-chi/chi/v5"
	"github.com/stretchr/testify/require"
)

func TestDeleteHandler(t *testing.T) {
	cases := []struct {
		name      string
		alias     string
		url       string
		respError string
		mockError error
	}{
		{
			name:  "Success",
			alias: "test",
			url:   "https://google.com",
		},
		{
			name:      "Empty alias",
			alias:     "",
			url:       "https://google.com",
			respError: "invalid request",
			mockError: errors.New("invalid request"),
		},
		{
			name:      "Invalid alias",
			alias:     "some invalid alias",
			url:       "https://google.com",
			respError: "url not found",
			mockError: storage.ErrURLNotFound,
		},
		{
			name:      "DeleteURL Error",
			url:       "https://google.com",
			alias:     "test_alias",
			respError: "failed to delete url",
			mockError: errors.New("unexpected error"),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			urlDeleterMock := NewMockURLDeleter(t)
			if tc.alias == "" {
				require.Error(t, tc.mockError)
			}
			if tc.alias != "" {
				urlDeleterMock.On("DeleteURL", tc.alias).
					Return(tc.mockError).Once()
			}

			handler := New(slogdiscard.NewDiscardLogger(), urlDeleterMock)

			req, err := http.NewRequest(http.MethodDelete, "delete", bytes.NewReader(nil))
			require.NoError(t, err)

			if tc.alias != "" {
				routeCtx := chi.NewRouteContext()
				routeCtx.URLParams.Add("alias", tc.alias)
				req = req.WithContext(context.WithValue(req.Context(), chi.RouteCtxKey, routeCtx))
			}

			rr := httptest.NewRecorder()
			handler.ServeHTTP(rr, req)

			var resp save.Response
			require.NoError(t, json.Unmarshal(rr.Body.Bytes(), &resp))
			require.Equal(t, tc.respError, resp.Error)
		})
	}
}
