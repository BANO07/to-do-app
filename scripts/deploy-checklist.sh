#!/usr/bin/env bash
# Generate a JWT secret and print deployment env var checklist.
set -euo pipefail

echo "=== Todo App — Deployment Checklist ==="
echo ""
echo "Generate JWT secret (save this):"
openssl rand -base64 48
echo ""
echo "Backend (Render) environment variables:"
cat <<'EOF'
NODE_ENV=production
DATABASE_URL=postgresql://...neon...?sslmode=require
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_CALLBACK_URL=https://YOUR-BACKEND.onrender.com/auth/google/callback
JWT_SECRET=<paste openssl output above>
JWT_EXPIRES_IN=7d
FRONTEND_URL=https://YOUR-APP.vercel.app
BACKEND_URL=https://YOUR-BACKEND.onrender.com
EOF
echo ""
echo "Frontend (Vercel) environment variables:"
echo "API_URL=https://YOUR-BACKEND.onrender.com"
echo ""
echo "Google OAuth — Authorized redirect URIs:"
echo "  http://localhost:3000/auth/google/callback"
echo "  https://YOUR-BACKEND.onrender.com/auth/google/callback"
echo ""
echo "Google OAuth — Authorized JavaScript origins:"
echo "  http://localhost:4200"
echo "  https://YOUR-APP.vercel.app"
echo ""
echo "Full guide: docs/deployment.md"
