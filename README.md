# CTRL_SHE

Foxly is a passkey-based authentication platform implemented as an npm workspace.

## Workspaces

- `apps/foxly-frontend`: Next.js 14 App Router frontend
- `apps/foxly-backend`: Express + TypeScript API
- `packages/shared-types`: shared TypeScript contract for Foxly and future Tally integrations
- `apps/tally-frontend` and `apps/tally-backend`: placeholders, intentionally out of scope

The Stitch export used as the visual source is preserved in `stitch_export/`.

## Run Foxly

Install dependencies from the repo root:

```bash
npm install
```

Start the backend:

```bash
npm run dev:foxly:backend
```

Start the frontend in another terminal:

```bash
npm run dev:foxly:frontend
```

Defaults:

- Frontend: http://localhost:3000
- Backend: http://localhost:4000

The backend includes a Postgres migration in `apps/foxly-backend/migrations/001_init.sql`. For hackathon/demo use it falls back to in-memory stores when Postgres or Redis are unavailable.

## QR passkey testing on a phone

Do not open the desktop app at `localhost` when you want to scan the QR from a phone. The phone will receive exactly the URL the desktop browser is using, and `localhost` means the phone itself.

### Fast demo path: public HTTPS tunnels

Use two HTTPS tunnels, one for the frontend and one for the backend. This avoids local network and certificate setup on the phone.

Start tunnels first so you can copy their public URLs:

```powershell
ngrok http 3000
ngrok http 4000
```

Use the frontend tunnel host as the WebAuthn RP ID. For example, if your frontend URL is `https://foxly-demo.ngrok-free.app` and your backend URL is `https://foxly-api.ngrok-free.app`:

```powershell
$env:RP_ID="foxly-demo.ngrok-free.app"
$env:FRONTEND_ORIGIN="https://foxly-demo.ngrok-free.app,http://localhost:3000"
$env:PUBLIC_FRONTEND_ORIGIN="https://foxly-demo.ngrok-free.app"
npm run dev:foxly:backend
```

In a second terminal:

```powershell
$env:NEXT_PUBLIC_API_BASE="https://foxly-api.ngrok-free.app"
npm run dev:foxly:frontend
```

Open the frontend tunnel URL on your laptop, not `localhost`, then generate the QR. The QR card shows the exact URL encoded in the QR; for the phone demo it must start with the frontend tunnel URL, not `localhost`.

If you use another tunnel provider, the rule is the same: `RP_ID` is the frontend tunnel hostname only, `FRONTEND_ORIGIN` and `PUBLIC_FRONTEND_ORIGIN` are the full frontend tunnel origin, and `NEXT_PUBLIC_API_BASE` is the full backend tunnel origin.

### Local Wi-Fi path: LAN HTTPS

For WebAuthn on a phone, use HTTPS with a locally trusted certificate:

```powershell
mkcert -install
mkcert 192.168.1.42 localhost 127.0.0.1
```

Replace `192.168.1.42` with your laptop's Wi-Fi IP. Trust the mkcert root CA on your phone as well.

Start the backend with the same LAN origin and RP ID:

```powershell
$env:RP_ID="192.168.1.42"
$env:FRONTEND_ORIGIN="https://192.168.1.42:3000,https://localhost:3000,http://localhost:3000"
$env:PUBLIC_FRONTEND_ORIGIN="https://192.168.1.42:3000"
$env:HTTPS_CERT_FILE=".\192.168.1.42+2.pem"
$env:HTTPS_KEY_FILE=".\192.168.1.42+2-key.pem"
npm run dev:foxly:backend
```

Start the frontend on all interfaces:

```powershell
npm run dev:foxly:frontend:https -- --experimental-https-key .\192.168.1.42+2-key.pem --experimental-https-cert .\192.168.1.42+2.pem
```

Then open `https://192.168.1.42:3000` on your laptop before generating the QR. The QR will point to the LAN HTTPS URL, and the phone will call the backend at `https://192.168.1.42:4000`.
