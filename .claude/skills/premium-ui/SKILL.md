---
name: premium-ui
description: Design standards for building or reviewing any Cookbook frontend screen — layout, tables, forms, drawers, modals, notifications, charts, empty/loading/error states, responsive behavior, accessibility, and dark mode. Load before writing or editing anything in frontend/src.
---

# Premium UI for Cookbook

Cookbook's current UI is functional but generic: raw Tailwind utilities,
one color (stone), no type scale, no shared components beyond
`RecipeFormFields.jsx`. This skill is how we close that gap — screen by
screen, not in one big rewrite. Every new or touched screen should move
toward this standard; don't leave a screen worse than you found it, but
don't rewrite unrelated screens speculatively either.

The bar: this should look like a tool a chef or ops manager would trust
with real recipes and real cost data — not a CRUD scaffold. Comparable to
Linear, Notion, or Stripe Dashboard in restraint and polish, not to a
free admin-panel template.

## Before building anything

1. Check `frontend/src/RecipeFormFields.jsx` and whatever else exists for
   a component that already does what you need. Reuse or extend it.
2. If you're about to write a third copy of the same pattern (a table,
   a filter bar, a form field), that's the signal to extract it — not
   before the second copy exists, not never.
3. Never add a component library (MUI/Ant/Chakra/shadcn-as-a-dependency).
   Bespoke Tailwind only — see tokens below.

## Design tokens

Nothing custom exists in `tailwind.config.js` yet. Don't invent tokens ad
hoc per screen — when a screen needs a token that doesn't exist, add it to
the config so the next screen inherits it too.

**Color** — the app currently free-hands the `stone` neutral scale, which
is fine as the base. Add one deliberate accent (not blue-by-default; pick
something that reads as "kitchen/food" without being literal — a warm
amber or a deep green both work, confirm with the user before locking
it in) for primary actions, focus rings, and active states only. Do not
sprinkle the accent everywhere — restraint is what reads as premium.
Semantic colors (success/warning/error/info) should be defined once as
tokens, not re-picked per component:

```js
// tailwind.config.js — extend, don't replace
colors: {
  accent: { 50: '#...', 500: '#...', 600: '#...', 700: '#...' }, // pick and confirm
  success: { 50: '#f0fdf4', 600: '#16a34a' },
  warning: { 50: '#fffbeb', 600: '#d97706' },
  danger:  { 50: '#fef2f2', 600: '#dc2626' },
}
```

**Typography** — no type scale exists; every heading is hand-picked
(`text-2xl font-semibold`, `text-sm font-semibold`, etc., inconsistently).
Standardize on:
- Page title: `text-2xl font-semibold text-stone-900 tracking-tight`
- Section heading: `text-sm font-semibold text-stone-700 uppercase tracking-wide`
- Body: `text-sm text-stone-900`
- Muted/secondary: `text-sm text-stone-500`
- Numeric/tabular data (prices, quantities, costs): add `tabular-nums` so
  columns of numbers align — currently missing everywhere costs are shown.

**Spacing** — Tailwind's default scale is fine; the discipline is
*consistency*, not a new scale. Card padding is `p-4` in some places,
implicit elsewhere — standardize: cards `p-4` md screens / `p-6` lg+,
section gaps `space-y-6`, form field gaps `gap-4`.

**Elevation** — currently every card is `border border-stone-200` with no
shadow, which is fine and reads as clean/flat (keep it) — don't start
adding drop shadows to every card, that's the generic-AI-dashboard tell.
Reserve shadow for things that actually float above content: dropdowns,
modals, drawers, toasts (`shadow-lg`).

## Layout & navigation

Current pattern (`RecipesPage.jsx`): a single `max-w-4xl` centered column
with a header bar and text-button tabs. This is fine for now at this
data density. As more sections get added (item supplements, reference
data management, reports), don't keep bolting tabs onto one flat row —
introduce a real left sidebar navigation once there are more than ~4
top-level sections, not before.

## Data tables

Current tables (`DishRecipeList.jsx` etc.) are correct in structure
(`thead` with uppercase `text-xs text-stone-500`, `divide-y`) — keep that
pattern. To reach premium bar as tables grow:
- Row hover state (`hover:bg-stone-50`) — currently missing.
- Sortable column headers get a cursor and a subtle sort-direction icon,
  not a full re-render surprise.
- Numeric columns right-aligned with `tabular-nums` (already right-aligned
  in most places — add `tabular-nums`).
- Row-level actions (Edit/Delete/View) stay text-links as now for a
  handful of actions; switch to a kebab-menu (`⋯`) only once a row needs
  4+ actions, to avoid button-soup.
- Pagination: `@tanstack/react-query` is installed but unused — once any
  list is expected to exceed ~50 rows, use it for cached pagination
  rather than fetching everything client-side (current pattern).

## Filtering & search

The branch/kitchen filter buttons (`DishRecipeList.jsx`,
`ProductionRecipeList.jsx`) are a reasonable pattern for a small, known
set of values (≤6-8 branches). Do not convert this to a dropdown just for
its own sake. If a filterable field's value set grows large (e.g.
filtering ingredients by 2,000+ SKUs), that's a search/autocomplete input,
not a button row — same pattern already used for the ingredient SKU
`<datalist>` in `RecipeFormFields.jsx`.

## Forms

Current form pattern (`DishRecipeForm.jsx`): plain controlled inputs, a
shared `Field` label wrapper, a shared `inputClass`. This is a good
foundation — extend it, don't replace it:
- Every `Field` needs a visible label (already true) and, where the
  input isn't self-explanatory, one line of helper text below it (not a
  tooltip-only hint — hidden help is inaccessible).
- Validation errors render inline under the specific field once the
  backend returns field-level errors, not just the raw JSON dump
  currently shown in `DishRecipeForm`'s error box (`JSON.stringify` of
  the error response). That's acceptable as a stopgap during
  development; before this ships to a real user, parse
  `err.response.data` (a dict of `{field: [messages]}` from DRF) and
  show each message under its `Field`.
- Required fields get a visual marker (`*` after the label, `text-danger-600`),
  not just a browser-native `required` attribute nobody sees until submit.
- Multi-select-as-pills (the allergens picker in `DishRecipeForm`) is a
  good pattern — reuse it for other many-to-many pickers rather than
  inventing a `<select multiple>`.

## Drawers, modals, dialogs

None exist yet (delete uses `window.confirm`, which is the right call for
a single low-stakes confirmation — don't build a modal system just to
replace `confirm()`). Once a real modal is needed (e.g., a multi-step
recipe-approval flow), the pattern:
- Overlay: `bg-stone-900/40 backdrop-blur-sm`
- Panel: `bg-white rounded-lg shadow-lg`, centered for modals, slide-in
  from the right (`translate-x-full` → `translate-x-0` transition) for
  drawers
- Always trap focus, close on `Escape`, close on overlay click, return
  focus to the trigger element on close.
- Use a drawer (not a modal) for "view/edit one record without leaving
  list context" — that's what `DishRecipeCard`/`DishRecipeForm` currently
  do as full-page navigation, which is a reasonable simpler alternative;
  don't convert to a drawer just for novelty, only if staying in list
  context becomes genuinely valuable (e.g. quick-editing many rows in
  sequence).

## Notifications / toasts

None exist yet — mutations currently succeed silently (navigate back to
the list) or fail into an inline `JSON.stringify` error box. Add a
minimal toast system before adding more mutating screens: a single
`<Toast>` component + a tiny context/hook (`useToast()`), bottom-right,
`success`/`error` variants using the semantic color tokens above,
auto-dismiss ~4s, manually dismissible. Don't pull in a toast library for
this — it's ~40 lines.

## Charts

None exist yet. When a report/analytics view is built (e.g. cost trends
from `DishPriceHistory`), do not reach for a heavy charting library by
default — check what's actually needed first. Simple line/bar trends can
be inline SVG. If genuine interactivity (tooltips, zoom, legends) is
needed, `recharts` is the lightest reasonable option, but confirm before
adding a new dependency.

## Empty / loading / error states

Every list/detail view needs all three — audit shows most currently only
have a bare-text version of each (`<p className="text-stone-500">Loading…</p>`),
which is an acceptable stopgap but not the bar:
- **Loading**: a spinner is fine while the DB is nearly empty (current
  reality). Once list views regularly show real rows, switch to a
  skeleton (gray `animate-pulse` blocks shaped like the real content) so
  layout doesn't jump.
- **Empty**: current empty states ("No recipes yet.") are good — they
  already tell the user why and where. Keep this bar: every empty state
  names the reason and gives the one obvious next action (a button, not
  just text).
- **Error**: current pattern is a bare red sentence. Upgrade to: what
  failed, and one retry action where retrying is possible (e.g. "Could
  not load recipes. [Retry]" that re-runs the fetch).

## Animation & micro-interactions

Use sparingly and only where it clarifies state change, never
decoratively:
- Transitions on hover/focus states: `transition-colors duration-150` —
  already implicit via Tailwind's hover utilities in most buttons, keep
  it consistent everywhere clickable.
- List item add/remove (ingredients, steps in the recipe forms): a
  simple height/opacity transition on add is enough; don't animate
  reordering unless drag-to-reorder is actually built.
- No page-transition animations, no gratuitous fade-ins on load — this
  is the single biggest "generic AI dashboard" tell along with unearned
  gradients.

## Accessibility

- Every interactive element needs a visible focus ring
  (`focus:outline-none focus:ring-2 focus:ring-accent-500` or similar) —
  currently only inputs have this (`focus:ring-2 focus:ring-stone-400`
  in `inputClass`); buttons and links rely on browser default or nothing.
  Fix as you touch each component.
- Icon-only buttons (the "✕" remove buttons in ingredient/step rows)
  need an `aria-label` — currently missing.
- Color is never the only signal — the red delete text already pairs
  color with the word "Delete," keep that discipline for anything new
  (don't add a bare red dot/icon with no text equivalent).
- Modals/drawers (once built): focus trap + `Escape` to close, per above.

## Dark mode

`darkMode: 'class'` is configured but nothing uses it — there's no theme
toggle and no dark variants written anywhere. Don't add dark-mode classes
to every element speculatively. If/when dark mode is actually requested,
do it as its own pass across the app rather than piecemeal per screen
(inconsistent dark-mode coverage is worse than none).

## Anti-patterns — do not do these

- Gradient backgrounds on cards/buttons "for visual interest"
- Every card wrapped in a heavy shadow
- Overusing rounded-full / pill shapes on things that aren't tags or
  avatars
- Icon libraries added just to put an icon next to every label — an icon
  earns its place when it replaces a word or clarifies an ambiguous
  action, not as decoration
- Loading spinners that block the whole screen for a partial data
  refresh — only block what's actually waiting on data
- A toast/alert for every single successful save if the UI navigation
  itself already makes success obvious (e.g. returning to the list with
  the new row visible is enough signal; don't also toast "Saved!")
