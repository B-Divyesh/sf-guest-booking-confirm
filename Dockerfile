FROM node:22-alpine AS frontend
WORKDIR /build
COPY package.json package-lock.json tsconfig.json vite.config.ts ./
COPY frontend ./frontend
COPY public ./public
RUN npm ci && npm run build

FROM rust:1-slim AS backend
ARG BUILD_SHA=dev
ENV BUILD_SHA=${BUILD_SHA}
WORKDIR /build
COPY Cargo.toml Cargo.lock ./
COPY src ./src
COPY migrations ./migrations
RUN cargo build --release --locked

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --gid 10001 app \
    && useradd --uid 10001 --gid app --create-home --no-log-init app \
    && mkdir -p /app /data \
    && chown -R app:app /app /data
WORKDIR /app
COPY --from=backend --chown=app:app /build/target/release/guest-booking-confirm /app/server
COPY --from=frontend --chown=app:app /build/dist /app/dist
USER app
ENV PORT=8080
EXPOSE 8080
CMD ["/app/server"]
