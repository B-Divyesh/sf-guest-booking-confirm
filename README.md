# Guest Booking Confirm

Guest Booking Confirm is a self-hosted appointment desk for businesses whose guests should not need accounts. A guest requests a time and the owner approves it. A private link then supports confirmation, rescheduling, cancellation, calendar download, and the owner’s manual reminder checklist.

It is deliberately not a staff rota, payment system, CRM, or automatic email/SMS sender. Owners copy the private booking link into the channel they already use.

Live: <https://guest-booking-confirm.sociobot.in>

## Try the sample desk

Open <https://guest-booking-confirm.sociobot.in/demo> or select **Try it with sample data** on the first screen. It opens Maya Chen’s already-approved sample appointment, ready for the guest confirmation step. The demo is isolated in a `demo:` localStorage key; it never calls the booking API or writes to a real owner desk. Reset it from the persistent demo banner, or choose **Start for real** to discard the sample.

## Who it is for

Sole traders and microbusinesses offering one appointment service from one calendar. The free desk allows 30 active future bookings and deletes closed records after 30 days. The optional $29 one-time Panel Pro license unlocks unlimited active bookings and 365-day closed-record retention through the Sociobot billing API.

## Run locally

Requirements: Node 22+, Rust 1.88+, and SQLite build support.

```sh
npm ci
npm run dev
```

`npm run dev` starts Vite and the Rust service. It creates `data/dev.db`; open `http://localhost:5173`. No environment variables are required in the container. For a direct Rust run, the defaults are `PORT=8080` and `DATABASE_URL=sqlite:/data/guest-booking-confirm.db`; override the database path for local write access:

```sh
npm run build
DATABASE_URL=sqlite:./data/local.db cargo run
```

Owners sign in at `/manage` through Sociobot Microsoft Entra External ID. The first signed-in owner creates the desk settings. Guest action links are bearer links and should be shared privately.

## Test and build

```sh
npm test          # Vitest unit tests + Rust tests
npm run check     # strict TypeScript + clippy
npm run test:e2e # 390px Chromium workflow + axe accessibility scan
npm run build     # reproducible frontend output in dist/
docker build --build-arg BUILD_SHA=$(git rev-parse HEAD) -t guest-booking-confirm .
docker run --rm -p 8080:8080 -v gbc-data:/data guest-booking-confirm
```

Read API calls allow 40 requests per client in any rolling one-second window. Later calls return `429` with `Retry-After: 1`. Write limits are stricter. `/health` is exempt and returns the compiled build SHA.

The container contract sets UID 10001, `PORT=8080`, SQLite under `/data`, and one serving replica. It handles `SIGTERM` for a graceful shutdown. After the standard factory container deployment, run `deploy/enforce-single-replica.sh`; it applies and verifies the checked-in SQLite deployment policy. Mount persistent storage at `/data` outside the factory deployment.

## Privacy and billing

`/privacy` and `/terms` describe retention and use. Panel Pro checkout and verification use `https://api.sociobot.in/api/v1/products/guest-booking-confirm/...`; no payment provider is embedded.

The researched scope is in [.factory/brief.json](.factory/brief.json), the product-specific visual system and generated-asset provenance are in [.factory/design.md](.factory/design.md), and release verification is in [.factory/handoff.md](.factory/handoff.md).
