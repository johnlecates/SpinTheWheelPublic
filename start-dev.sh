#!/usr/bin/env bash
# Start SpinTheWheel in development mode (no Docker required)
set -e
cd "$(dirname "$0")"

# Backend
echo "▶ Starting backend on :8001"
cd backend
python3 -m venv .venv 2>/dev/null || true
source .venv/bin/activate
pip install -q -r requirements.txt
python seed_prizes.py
uvicorn main:app --host 0.0.0.0 --port 8001 --reload &
BACKEND_PID=$!
cd ..

# Frontend
echo "▶ Starting frontend on :5174"
cd frontend
npm install --silent
npm run dev &
FRONTEND_PID=$!
cd ..

echo "✓ Backend  → http://localhost:8001"
echo "✓ Frontend → http://localhost:5174"
echo "  Admin    → http://localhost:5174/admin"
echo ""
echo "Press Ctrl+C to stop"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT
wait
