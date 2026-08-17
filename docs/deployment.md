# Deploy Todo App for Free

This guide takes the app live using **$0/month** tiers:

| Service | Role | Free tier |
|---------|------|-----------|
| [Neon](https://neon.tech) | PostgreSQL | 0.5 GB storage |
| [Render](https://render.com) | NestJS API | 750 hrs/mo (spins down when idle) |
| [Vercel](https://vercel.com) | Angular SPA | Hobby plan |
| Google Cloud | OAuth | Free |

**Expected URLs after deploy:**
- Frontend: `https://todo-app-xxxx.vercel.app`
- Backend: `https://todo-app-api.onrender.com`

---

## Prerequisites

1. Push `todo-app/` to **GitHub** (public or private).
2. Have a **Google account** for OAuth setup.

Generate a strong JWT secret locally:

```bash
openssl rand -base64 48
```

---

## Step 1 — PostgreSQL (Neon)

1. Sign up at [neon.tech](https://neon.tech).
2. **New Project** → name `todo-app` → region closest to your users.
3. Copy the **connection string** (use the **pooled** connection string if offered).
4. Ensure it includes SSL, e.g.:
   ```
   postgresql://user:pass@ep-xxx.region.aws.neon.tech/todo_app?sslmode=require
   ```

Keep this as `DATABASE_URL` for the backend.

---

## Step 2 — Backend (Render)

### Option A: Blueprint (recommended)

1. Go to [render.com](https://render.com) → **New** → **Blueprint**.
2. Connect your GitHub repo.
3. Render detects `render.yaml` at repo root.
4. Set these **secret** environment variables when prompted:

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Neon connection string |
| `GOOGLE_CLIENT_ID` | (Step 4) |
| `GOOGLE_CLIENT_SECRET` | (Step 4) |
| `GOOGLE_CALLBACK_URL` | `https://todo-app-api.onrender.com/auth/google/callback` |
| `JWT_SECRET` | output of `openssl rand -base64 48` |
| `FRONTEND_URL` | `https://YOUR-APP.vercel.app` (update after Step 3) |
| `BACKEND_URL` | `https://todo-app-api.onrender.com` |

5. Deploy. Render runs migrations automatically via `releaseCommand`.

### Option B: Manual Web Service

1. **New** → **Web Service** → connect repo.
2. **Root Directory:** `apps/backend`
3. **Build Command:** `npm ci && npm run build`
4. **Start Command:** `npm run start:prod`
5. **Release Command:** `npm run migrate:run`
6. Add env vars from the table above.
7. **Health Check Path:** `/health`

### Verify backend

```bash
curl https://YOUR-BACKEND.onrender.com/health
# → {"status":"ok"}
```

> **Note:** Render free tier sleeps after ~15 min idle. First request may take 30–60 seconds.

---

## Step 3 — Frontend (Vercel)

1. Sign up at [vercel.com](https://vercel.com) → **Add New Project**.
2. Import your GitHub repo.
3. Configure:

| Setting | Value |
|---------|-------|
| **Root Directory** | `apps/frontend` |
| **Framework Preset** | Angular |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist/frontend/browser` |

4. **Environment Variables** (Production):

| Name | Value |
|------|-------|
| `API_URL` | `https://YOUR-BACKEND.onrender.com` |

5. Deploy.

6. Copy your Vercel URL (e.g. `https://todo-app-abc.vercel.app`).

7. **Go back to Render** → update `FRONTEND_URL` to your Vercel URL → redeploy backend.

---

## Step 4 — Google OAuth (Production)

1. [Google Cloud Console](https://console.cloud.google.com/) → your project.
2. **APIs & Services** → **OAuth consent screen** → publish if still in Testing (or add test users).
3. **Credentials** → your OAuth 2.0 Client ID → edit:

**Authorized JavaScript origins**
```
http://localhost:4200
https://YOUR-APP.vercel.app
```

**Authorized redirect URIs**
```
http://localhost:3000/auth/google/callback
https://YOUR-BACKEND.onrender.com/auth/google/callback
```

4. Save. Ensure Render has matching `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, and `GOOGLE_CALLBACK_URL`.

---

## Step 5 — Smoke test

1. Open `https://YOUR-APP.vercel.app`
2. Click **Continue with Google**
3. Complete login → land on dashboard
4. Create a task → refresh → task persists
5. Logout → login again

---

## Architecture (production)

```
User browser
    ↓
Vercel (Angular SPA)
    ↓ GraphQL + cookies (credentials: include)
Render (NestJS API)
    ↓
Neon (PostgreSQL)
```

Auth flow:
1. Frontend redirects to `BACKEND/auth/google`
2. Google → `BACKEND/auth/google/callback`
3. Backend sets httpOnly JWT cookie (`SameSite=None; Secure`)
4. Redirect to `FRONTEND/dashboard`
5. GraphQL calls include cookie cross-origin

---

## Environment variable reference

### Backend (Render)

```
NODE_ENV=production
DATABASE_URL=postgresql://...neon...?sslmode=require
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://YOUR-BACKEND.onrender.com/auth/google/callback
JWT_SECRET=<48+ char random string>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://YOUR-APP.vercel.app
BACKEND_URL=https://YOUR-BACKEND.onrender.com
```

Render sets `PORT` automatically — do not hardcode.

### Frontend (Vercel)

```
API_URL=https://YOUR-BACKEND.onrender.com
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Google login redirects to localhost | Update `GOOGLE_CALLBACK_URL` and Google Console redirect URI |
| CORS error after login | `FRONTEND_URL` on Render must exactly match Vercel URL (no trailing slash) |
| Session lost / `me` returns null | Cookie needs HTTPS + `SameSite=None` (automatic in production). Ensure frontend uses `withCredentials: true` |
| 502 on first request | Render free tier waking up — wait 30–60s |
| DB connection failed | Use Neon pooled URL with `?sslmode=require` |
| Build fails on Vercel | Set `API_URL` env var before deploy |

---

## Optional upgrades (still low cost)

- **Render paid ($7/mo):** no cold starts
- **Custom domain:** Vercel + Render both support free SSL custom domains
- **Neon scale:** more storage/compute as users grow

---

## Files in this repo for deployment

| File | Purpose |
|------|---------|
| `render.yaml` | Render Blueprint for backend |
| `apps/frontend/vercel.json` | SPA routing on Vercel |
| `apps/frontend/scripts/set-env.js` | Injects `API_URL` at build time |

Local production build test:

```bash
cd apps/frontend
API_URL=https://your-backend.onrender.com npm run build
```
