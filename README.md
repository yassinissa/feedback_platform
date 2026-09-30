# Aftertaste — restaurant guest feedback

A feedback platform for restaurant branches. Each branch gets its own guest link
(and printable QR code) that runs on the branch iPad; guests rate their visit in
English or Arabic. Admins and branch managers read every day's feedback, branch
by branch, in a dashboard built for iPad, desktop and phone.

**Stack:** Django 5 + Django REST Framework · React 19 + Vite · Postgres on Render.

## What guests fill in

Two pages, under a minute:

1. **Rate the visit** — Food, Service and Ambiance, each with five faces
   (Poor → Excellent); the screen's light shifts with their answers. On the
   same page: optional "What could be better?" tags and "In your own words".
2. **About you** — name and server's name (both optional), and "I'd like a
   manager to contact me" with phone or email. Only when a guest picked
   **Poor** does this page (and the thank-you) apologise and invite contact.

The overall rating stored for each entry is the rounded average of the three.

Each branch can have its **own logo** (Branches → Edit → Upload logo), shown on
its guest form and thank-you screen. Logos are resized in the browser and stored
in the database, so they survive Render redeploys. Pick the dark tile for white
logos.

Kiosk behaviour: the form clears itself 10 s after the thank-you screen, warns
and resets an abandoned form after 60 s, and **queues submissions offline** if
the iPad loses Wi-Fi (retried automatically, never duplicated).

Add `?table=12` to a guest link (or generate a per-table QR) to pre-fill the table.

## Admin

| Page | What it's for |
| --- | --- |
| Overview | Responses, average rating, NPS, "needs attention" count, daily trend, rating mix, scores by area, branch comparison, most-mentioned tags, latest comments |
| History | One row per day (end-of-day view). Open a day to read every entry, mark New → Reviewed → Resolved, add team notes, "mark day as reviewed", export CSV (Excel-safe Arabic) |
| Branches | Create/edit/pause branches, copy guest link, QR code (download or print, optional table number) |
| Team (admins) | Add admins and branch managers; managers only see their branches |

## Run locally

```bash
# backend (port 8010)
cd backend
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # macOS/Linux: .venv/bin/pip
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py seed_demo           # demo branches + 45 days of feedback
.venv/Scripts/python manage.py runserver 127.0.0.1:8010

# frontend (port 5190, proxies /api to the backend)
cd frontend
npm install
npm run dev
```

Demo logins created by `seed_demo` (local only) are listed at the top of
`backend/feedback/management/commands/seed_demo.py`.

Tests: `cd backend && .venv/Scripts/python manage.py test feedback`

## Deploy on Render

1. Render dashboard → **New → Blueprint** → pick this repository. `render.yaml`
   creates the web service and a Postgres database.
2. When asked, set `DJANGO_ADMIN_USERNAME` and `DJANGO_ADMIN_PASSWORD` — the
   first admin is created from these on deploy.
3. After the deploy finishes, sign in at `https://<your-app>.onrender.com/login`,
   add your branches, and open each branch's guest link on its iPad
   (Safari → Share → **Add to Home Screen** for a full-screen kiosk).

Optional env: `SEED_DEMO=1` loads demo data; `APP_TIME_ZONE` (default
`Asia/Kuwait`) decides where "a day" starts and ends in History.

> Render's free Postgres expires after 30 days and free web services sleep
> when idle (first load takes ~30 s). Use a paid plan for real branches — the
> iPad offline queue covers the wake-up delay either way.

## Browser support

All branch iPads run **iOS 15**, so the build targets Safari 15: no
`color-mix()`, no `:has()`, `dvh` only behind `@supports`, translucent colours
precomputed as `rgba()` tokens, and a UUID fallback for `crypto.randomUUID`.
