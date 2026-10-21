# WEAVIA

WEAVIA AI Commerce Studio monorepo.

## Structure

```text
server/   Go API / worker / PostgreSQL / admin
client/   Tauri 2 + React desktop client
```

## Server

```bash
cd server
cp .env.example .env
docker compose up --build -d
```

API: `http://localhost:8080`
Admin: `http://localhost:3001`

Provider keys are configured server-side through the admin console or environment variables. Never commit real keys.

## Client

```bash
cd client
pnpm install
pnpm tauri dev
```

For a production desktop build:

```bash
cd client
VITE_API_MODE=live VITE_API_BASE_URL=https://your-api.example.com pnpm tauri build
```

## Security

- Do not commit `.env` files or provider API keys.
- `.env.example` contains placeholders only.
- Rotate any key that has been shared outside the server environment.
