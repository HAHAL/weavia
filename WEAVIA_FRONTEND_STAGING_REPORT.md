# WEAVIA Frontend Staging Deployment Report

日期：2026-10-12（Asia/Shanghai）  
服务器：`47.113.148.107`

## 发布版本

- Backend/API/Worker 基线保持：`01e49e9e6c4f322aa08a7edbd0210771af65dffd`
- Frontend release：`71c6f0a3ee8924670d8c9d758a45a7c501de79e1`
- Frontend startup fix：`0b5cbaef634f918716f361d0b1ac1f3a1ca7a6ca`
- Final frontend proxy fix/deployed version：`3b4bdcf688804c052b3e3e651d951c71c7a575bd`
- Server marker: `WEAVIA_FRONTEND_DEPLOY_VERSION=3b4bdcf688804c052b3e3e651d951c71c7a575bd`
- Deployment method: `git archive`

## Scope protection

The frontend release contains `apps/web`, `apps/admin`, shared UI changes, frontend Docker build configuration, and Compose web/admin services. No backend, Worker, Provider, Credits, or database schema files were included in the frontend commits. No database migration was run during the frontend rollout.

Existing backend, Worker, PostgreSQL, and Docker data volumes were preserved. The current code directory backup is:

`/opt/weavia-backups/frontend-proxy-20261012035153`

## Docker services

```text
weavia-admin-1     Up   0.0.0.0:3001->3001/tcp
weavia-backend-1   Up   healthy, 0.0.0.0:8080->8080/tcp
weavia-postgres-1  Up   healthy, 0.0.0.0:5432->5432/tcp
weavia-web-1       Up   0.0.0.0:3000->3000/tcp
weavia-worker-1    Up   8080/tcp
```

## Configuration

Both frontend containers received:

```text
NEXT_PUBLIC_API_URL=http://47.113.148.107:8080
WEAVIA_BACKEND_URL=http://backend:8080
```

The backend proxy URL is also baked into the Next build so server-side rewrites do not fall back to `localhost:8080`.

## Verification

Web routes:

| Route | Result |
| --- | --- |
| `/` | HTTP 200 |
| `/product` | HTTP 200 |
| `/pricing` | HTTP 200 |
| `/login` | HTTP 200 |
| `/signup` | HTTP 200 |

Admin routes:

| Route | Result |
| --- | --- |
| `/login` | HTTP 200 |
| `/` | HTTP 307 to login, expected protected route |
| `/users` | HTTP 307 to login, expected protected route |
| `/providers` | HTTP 307 to login, expected protected route |

API:

- Web proxy `/api/health`: HTTP 200
- Direct backend `/api/health`: HTTP 200
- Backend `/api/readiness`: database, queue, and storage all `ok`

## Build validation

Local `apps/web` and `apps/admin` typechecks and production builds passed. Staging Docker builds for both images passed. The host does not have local Docker, so Compose build/start validation was performed on staging.

## Notes

The first frontend container attempt exposed two deployment issues and was corrected in frontend-only commits: pnpm workspace selector startup incompatibility and build-time Next proxy configuration. The final deployed containers are stable and the API proxy check passes.
