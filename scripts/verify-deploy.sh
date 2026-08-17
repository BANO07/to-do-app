#!/usr/bin/env bash
# Verify todo-app is ready for production deployment.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Checking deployment files..."
for f in render.yaml apps/backend/package.json apps/frontend/package.json apps/frontend/vercel.json apps/frontend/scripts/set-env.js docs/deployment.md; do
  test -f "$f" || { echo "Missing: $f"; exit 1; }
  echo "  OK $f"
done

echo ""
echo "==> Building backend..."
cd apps/backend
npm run build
echo "  Backend build OK"

echo ""
echo "==> Building frontend (local)..."
cd ../frontend
npm run build:local
echo "  Frontend build OK"

echo ""
echo "==> Production frontend build (requires API_URL)..."
DEPLOY_API_URL="${API_URL:-https://todo-app-api.onrender.com}"
API_URL="$DEPLOY_API_URL" node scripts/set-env.js
npx ng build --configuration production
echo "  Production frontend build OK with API_URL=$DEPLOY_API_URL"

echo ""
echo "All checks passed. Next steps:"
echo "  1. Push repo to GitHub"
echo "  2. Create Neon database → copy DATABASE_URL"
echo "  3. Deploy backend on Render (Blueprint or manual) — see docs/deployment.md"
echo "  4. Deploy frontend on Vercel with API_URL env var"
echo "  5. Update Google OAuth redirect URIs"
echo "  6. Set FRONTEND_URL on Render to your Vercel URL and redeploy"
