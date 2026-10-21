FROM golang:1.26-alpine AS build
WORKDIR /src/services/backend
ENV GOPROXY=https://goproxy.cn,direct
COPY services/backend/go.mod services/backend/go.sum ./
RUN go mod download
COPY services/backend ./
RUN CGO_ENABLED=0 go build -o /out/api ./cmd/api \
 && CGO_ENABLED=0 go build -o /out/worker ./cmd/worker \
 && CGO_ENABLED=0 go build -o /out/migrate ./cmd/migrate \
 && CGO_ENABLED=0 go build -o /out/seed ./cmd/seed

FROM build AS integration-test
CMD ["go", "test", "-tags", "integration", "./internal/jobs", "-run", "^TestCommercialPostgresRiverE2E$", "-count=1", "-v"]

FROM alpine:3.23
RUN apk add --no-cache ca-certificates
RUN addgroup -S weavia && adduser -S weavia -G weavia
WORKDIR /app
COPY --from=build /out/api /out/worker /out/migrate /out/seed /usr/local/bin/
RUN mkdir -p /app/var/assets && chown -R weavia:weavia /app
USER weavia
EXPOSE 8080
CMD ["api"]
