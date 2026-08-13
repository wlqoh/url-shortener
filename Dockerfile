FROM golang:1.26-alpine AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -o /app/bin/urlshortener ./cmd/notes_app/main.go

FROM alpine:3.21

RUN apk add --no-cache ca-certificates

WORKDIR /app

COPY --from=builder /app/bin/urlshortener .
COPY config/ ./config/

EXPOSE 8082

CMD ["./urlshortener"]
