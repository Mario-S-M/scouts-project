#!/bin/bash
# Quick start for local development (without Docker)

echo "=== Scouts CC - Comunidad de Caminantes ==="
echo ""

# Check if PostgreSQL is running
if ! pg_isready -q 2>/dev/null; then
  echo "WARNING: PostgreSQL may not be running locally."
  echo "Consider using Docker: docker-compose up -d postgres"
  echo ""
fi

echo "Starting backend..."
cd backend
npm install --silent
npm run start:dev &
BACKEND_PID=$!
echo "Backend started (PID: $BACKEND_PID)"

cd ../frontend
echo "Starting frontend..."
npm install --silent
npm start &
FRONTEND_PID=$!
echo "Frontend started (PID: $FRONTEND_PID)"

echo ""
echo "Application running:"
echo "  Frontend: http://localhost:4200"
echo "  Backend API: http://localhost:3000/api"
echo ""
echo "Press Ctrl+C to stop..."

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo 'Stopped.'" EXIT
wait
