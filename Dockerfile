FROM golang:1.23 AS builder

WORKDIR /app

COPY go.mod go.sum ./

RUN go mod download

COPY *.go .
COPY cmd/ cmd/
COPY internal/ internal/
RUN CGO_ENABLED=0 GOOS=linux go build -o shorten .
RUN CGO_ENABLED=0 GOOS=linux go build -o worker cmd/background/main.go

FROM alpine:latest

WORKDIR /root/ 

COPY --from=builder /app/shorten .
COPY --from=builder /app/worker .

EXPOSE 8080

CMD ["./shorten"]