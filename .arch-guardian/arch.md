# Architecture — Aftertaste feedback platform

Single source of truth for arch-guardian reviews.

```
┌──────────────────────────── Browser ─────────────────────────────┐
│  main.tsx ── lazy ──┬─► guest/  (iPad kiosk + QR, EN/AR, RTL)     │
│                     │     FormContext (state) → Steps (views)     │
│                     │     queue.ts (offline, idempotent retries)  │
│                     └─► admin/  (Overview, History, Branches,     │
│                           Team) · SWR data · URL-held filters     │
│  ui/ (Button, Field, Modal, Toast, States)   lib/ (api, copy, fmt)│
└──────────────────────────────┬───────────────────────────────────┘
                               │ JSON /api  (Token auth for admin,
                               │ anonymous + throttled for guests)
┌──────────────────────────────▼───────────────────────────────────┐
│ Django  config/urls.py → /api → feedback/urls.py                  │
│   views.py  ── access.py (visible_locations, scoped_feedback)     │
│   serializers.py        models.py (Location, Profile, Feedback)   │
│ WhiteNoise serves frontend/dist at /; SPA fallback view           │
└──────────────────────────────┬───────────────────────────────────┘
                               ▼
                     SQLite (dev) / Postgres (Render)
```

## Rules

1. **Every admin query goes through `access.scoped_feedback` / `visible_locations`.**
   Managers must never see another branch. New endpoints reuse these helpers
   rather than filtering by hand.
2. **Guest and admin bundles stay separate.** Nothing in `guest/` imports from
   `admin/` (and vice versa); shared code lives in `lib/` and `ui/`.
3. **Highlight/category keys are defined twice on purpose**: validated in
   `models.py`, labelled (EN/AR) in `lib/copy.ts`. Change both together.
4. **iOS 15 floor**: no `color-mix()`, `:has()`, container queries, or
   unguarded `dvh`; add translucent colours as `rgba()` tokens in `base.css`.
5. **Public endpoints stay idempotent and throttled** (`client_id`, honeypot,
   `feedback_submit` rate).
6. Components use explicit variants (`variant="primary"`) and context providers
   for shared state, not boolean-prop flags (composition-patterns skill).

## Stack

Django 5.2, DRF 3.15+, WhiteNoise, gunicorn, dj-database-url · React 19,
react-router 7, SWR 2, qrcode (lazy), Vite 7, TypeScript 5.

## Reference docs

- `README.md` — features, local dev, Render deploy
- `.claude/skills/*` — design/React/a11y standards used to build the UI
