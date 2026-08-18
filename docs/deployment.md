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
| `GOOGLE_CALLBACK_URL` | `https://YOUR-APP.vercel.app/api/auth/google/callback` |
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

4. **Environment Variables** (Production): none required — the frontend uses same-origin `/api/*` paths (see `vercel.json` rewrites).

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
https://YOUR-APP.vercel.app/api/auth/google/callback
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
    ↓ same-origin (/api/*)
Vercel (Angular SPA + API rewrite proxy)
    ↓ server-side rewrite
Render (NestJS API)
    ↓
Neon (PostgreSQL)
```

Auth flow:
1. Frontend redirects to `/api/auth/google` (proxied to Render)
2. Google → `FRONTEND/api/auth/google/callback` (proxied to Render)
3. Backend sets host-only httpOnly JWT cookie (`SameSite=Lax; Secure`)
4. Redirect to `FRONTEND/dashboard`
5. GraphQL calls to `/api/graphql` include cookie (same origin)

---

## Environment variable reference

### Backend (Render)

```
NODE_ENV=production
DATABASE_URL=postgresql://...neon...?sslmode=require
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=https://YOUR-APP.vercel.app/api/auth/google/callback
JWT_SECRET=<48+ char random string>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://YOUR-APP.vercel.app
BACKEND_URL=https://YOUR-BACKEND.onrender.com
EMAIL_PROVIDER=noop|resend
EMAIL_FROM=notifications@your-domain.example
EMAIL_API_KEY=
PUSH_VAPID_PUBLIC_KEY=
PUSH_VAPID_PRIVATE_KEY=
PUSH_VAPID_SUBJECT=mailto:you@example.com
```

Render sets `PORT` automatically — do not hardcode.

### Frontend (Vercel)

No build-time env vars required. `apps/frontend/vercel.json` rewrites `/api/:path*` to your Render backend.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Google login redirects to localhost | Update `GOOGLE_CALLBACK_URL` and Google Console redirect URI |
| CORS error after login | `FRONTEND_URL` on Render must exactly match Vercel URL (no trailing slash) |
| Session lost / `me` returns 401 after Google login | Confirm the browser calls `/api/graphql` (same origin), not Render directly. Cookie must be host-only on the Vercel domain (`SameSite=Lax; Secure`). Set `GOOGLE_CALLBACK_URL` to `https://YOUR-APP.vercel.app/api/auth/google/callback` and add the same URI in Google Cloud Console. Confirm `FRONTEND_URL` has **no trailing slash**. |
| 502 on first request | Render free tier waking up — wait 30–60s |
| Reminder arrived late or not at all after idle time | Render free instances sleep, so the in-process scheduler cannot fire while the service is suspended |
| Push cannot be enabled | Confirm `PUSH_VAPID_*` env vars are set on Render and the browser granted notification permission |
| Email reminders stay failed | Confirm `EMAIL_PROVIDER=resend`, `EMAIL_FROM`, and `EMAIL_API_KEY` are configured |
| DB connection failed | Use Neon pooled URL with `?sslmode=require` |
| Build fails on Vercel | Check `vercel.json` rewrite destination matches your Render URL |

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
| `apps/frontend/vercel.json` | SPA routing + `/api/*` proxy to Render |
| `apps/frontend/scripts/set-env.js` | Writes same-origin `/api` production environment |
| `apps/frontend/public/push-sw.js` | Minimal service worker for web push notification clicks |

---

## Phase C Notification Delivery

- Reminder scheduler runs inside the NestJS backend process and scans due reminders in UTC.
- `Reminder.channel` is the single selected delivery channel.
- Notification preferences are enablement gates only; they do not fan one reminder out to additional channels.
- `Reminder.sent_at` is set only after the selected channel succeeds.
- Email and push failures remain retryable because `sent_at` stays null until success.
- In-app notifications are persisted in the `notifications` table and shown from the topbar notification panel.

Local production build test:

```bash
cd apps/frontend
npm run build
```
