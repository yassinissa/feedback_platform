#!/usr/bin/env bash
# Render build: install Python + Node deps, build the React app, prepare Django.
set -o errexit

pip install --upgrade pip
pip install -r backend/requirements.txt

npm ci --prefix frontend
npm run build --prefix frontend

cd backend
python manage.py collectstatic --no-input
python manage.py migrate --no-input
python manage.py ensure_admin
if [ "${SEED_DEMO:-}" = "1" ]; then
  python manage.py seed_demo
fi
