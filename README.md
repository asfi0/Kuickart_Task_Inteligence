# Kuickart Operations Engine Frontend

Backend-connected frontend built with Vite + React JSX.

## What this version does
- keeps the original visual layout and styling
- connects login to the NestJS backend
- loads users, tasks, roles, sub-units, task templates, KPI data, alerts, reports, and activity logs from backend APIs
- uses the task entry flow: Role -> SubUnit -> TaskTemplate -> Custom Instructions -> Initial Notes
- stores JWT access and refresh tokens in localStorage

## Environment
Create a `.env` file from `.env.example`:

```bash
VITE_API_URL=http://localhost:3000
```

## Commands
```bash
npm install
npm run dev
npm run build
```

## Backend endpoints used
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/logout`
- `POST /auth/refresh`
- `GET /users`
- `GET /roles`
- `GET /subunits`
- `GET /task-templates`
- `GET /tasks`
- `POST /tasks`
- `PATCH /tasks/:id/start`
- `POST /tasks/:id/submit`
- `POST /tasks/:id/approve`
- `POST /tasks/:id/reject`
- `GET /kpi`
- `GET /alerts`
- `GET /reports`
- `GET /activity-logs`
