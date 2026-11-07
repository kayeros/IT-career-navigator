# Один образ с двумя бинарниками: api и worker. Какой запускать — задаёт command в docker-compose.
FROM golang:1.26-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/api ./cmd/api \
 && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /out/worker ./cmd/worker

FROM alpine:3.22
RUN apk add --no-cache ca-certificates tzdata wget && adduser -D -u 10001 app
COPY --from=build /out/ /app/
USER app
EXPOSE 8080
CMD ["/app/api"]
