# Guest Booking Confirm

This repository contains an appointment desk for businesses whose guests should not need accounts. A guest requests a time and the owner approves it. A private link then supports confirmation, rescheduling, cancellation, calendar download, and the owner’s manual reminder checklist.

It is not a staff rota, payment system, CRM, or automatic email/SMS sender. Owners can copy the exact private booking link to share with each guest.

Live: <https://guest-booking-confirm.sociobot.in>

## Try the sample desk

Open <https://guest-booking-confirm.sociobot.in/?demo=1> or select **Try it with sample data** on the first screen. It opens Maya Chen’s already-approved sample appointment, ready for the guest confirmation step. The demo is isolated in a `demo:` localStorage key; it never calls the booking API or writes to a real owner desk. Reset it from the persistent demo banner, or choose **Start for real** to discard the sample.

## Who it is for

Sole traders and microbusinesses offering one appointment service from one calendar. The free desk allows 30 active future bookings and deletes closed records after 30 days. The optional $29 one-time Panel Pro license unlocks unlimited active bookings and 365-day closed-record retention through the Sociobot billing API.

## Run locally

Requirements: Node 22+, Rust 1.88+, and SQLite build support.

```sh
npm ci
npm run dev
```

`npm run dev` starts Vite and the Rust service. It creates `data/dev.db`; open `http://localhost:5173`. The container defaults to `PORT=8080` and `DATABASE_URL=sqlite:/data/guest-booking-confirm.db`. Override the database path for local write access:

```sh
npm run build
DATABASE_URL=sqlite:./data/local.db cargo run
```

Owners sign in at `/manage` through Sociobot Microsoft Entra External ID. The first signed-in owner creates the desk settings. Another identity cannot take over that desk. Anyone with a private booking link can use it, so share it only with the guest.

## Test and build

```sh
npm test          # Vitest unit tests + Rust tests
npm run check     # strict TypeScript + clippy
npm run test:claims # registry integrity and exact claim-to-test mapping
npm run test:e2e # desktop and 390px Chromium workflows + axe accessibility scans
npm run test:billing # live catalog and hosted checkout smoke test; no purchase
npm run build     # reproducible frontend output in dist/
npm run deploy    # ACR build plus persistent single-replica live gate
docker build --build-arg BUILD_SHA=$(git rev-parse HEAD) -t guest-booking-confirm .
docker run --rm -p 8080:8080 -v gbc-data:/data guest-booking-confirm
```

Read API calls allow 40 requests and write API calls allow 12 requests per client in any rolling one-second window. Later calls return `429` with `Retry-After: 1`. The exempt `/health` endpoint stays available and returns the compiled build SHA.

The container contract sets UID 10001, `PORT=8080`, SQLite on a persistent Azure Files volume at `/data`, and one serving replica. It handles `SIGTERM` for a graceful shutdown. Factory releases must use `npm run deploy`. The deploy command builds the exact source in Azure Container Registry. It publishes one replica with `/data` mounted. It proves the live build identity and each documented rate limit three times. Before finishing, it confirms that one replica is running and `/data` is mounted. A release fails if any check does not pass.

## Privacy and billing

`/privacy` and `/terms` describe retention and use. Panel Pro checkout and verification use `https://api.sociobot.in/api/v1/products/guest-booking-confirm/...`; no payment provider is embedded.

The opportunity brief is in [.factory/brief.json](.factory/brief.json). See [.factory/design.md](.factory/design.md) for the visual system. Release verification is in [.factory/handoff.md](.factory/handoff.md).
