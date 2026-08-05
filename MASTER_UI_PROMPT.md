# AUSTWise "Aura" UI Master Prompt

> Use this prompt to apply the dashboard's Aura design system to ANY other page in the app.
> Paste it and change the **PAGE NAME** / **feature** — everything else stays the same.

---

## PROMPT START

Apply the **"Aura" dark design system** (already built for the Dashboard at `/`) to the **`<PAGE NAME>`** page, keeping ALL existing functionality — only change visual design, layout, and structure.

### 1. Color tokens — use ONLY these (theme-matched, never hardcode hex in components)

Reuse the dashboard token layer (`src/features/dashboard/dashboard-tokens.css`). If the page is NOT inside `.dashboard-page`, create a scoped token layer for it (e.g. `<page>-tokens.css` scoped to `.x-page`) that redefines these EXACT values:

**Accents:**
- Primary (gold): `--accent-blue`, `--accent-amber`, `--accent-orange` = `#F59E0B`; glows = `rgba(245,158,11,0.14)`
- Secondary (cyber blue / info): `--accent-cyan`, `--accent-info` = `#60A5FA`; glow = `rgba(96,165,250,0.14)`
- Tertiary (soft violet): `--accent-purple` = `#A78BFA`; glow = `rgba(167,139,250,0.14)`
- Semantic ONLY: success `--accent-emerald` = `#34D399`, danger `--accent-rose` = `#F87171`, warning `--warning` = `#FBBF24`, info `--info` = `#60A5FA`

**Surfaces (deep charcoal):**
- `--bg-primary` = `#0A0A0C`, `--bg-secondary` = `#1B1B1F`, `--bg-card` = `#1B1B1F`, `--bg-tertiary` = `#1E1E26`, `--bg-card-hover` = `#232329`, `--bg-input` = `#1B1B1F`
- **Cards/boxes MUST match the sidebar surface** (`--bg-secondary` = `#1B1B1F`)

**Borders:** `--border-primary` = `#2A2A35`, `--border-secondary` = `rgba(42,42,53,0.6)`, `--border-focus` = `rgba(245,158,11,0.5)` — subtle translucent, NO heavy solid lines

**Text:** `--text-primary` = `#FFFFFF` (headlines/values), `--text-secondary` = `#E2E8F0` (body), `--text-tertiary` = `#94A3B8` (meta), `--text-inverse` = `#0A0A0C`

**Shadows (no black):** subtle white-glow lift — `--shadow-lift` = `0 4px 20px rgba(255,255,255,0.03)`, plus `--shadow-sm/md/lg/xl/popper` at `rgba(255,255,255,0.02–0.05)`. Accent glows: `--shadow-glow-amber` (gold), `--shadow-glow-blue` (blue), `--shadow-glow-purple` (violet).

### 2. Widget shell (Semester View pattern) — the page's main card container

```
<div className="glass-card-static schedule-widget x-widget animate-fadeInUp">
  <div className="schedule-masthead">…</div>
  <div className="schedule-dotted-divider" />
  …content…
</div>
```
- `glass-card-static` = card surface (bg-card + 1px border + radius-lg). `schedule-widget` = `position: relative; overflow: hidden; background: transparent`.
- **Masthead**: `grid-template-columns: 1fr auto 1fr`, `align-items: center`. Left = title block, center = stat chips, right = action buttons.
- **Title block**: 48px icon tile (accent glow bg + accent icon, hover `scale(1.08) rotate(-3deg)`), overline (9px bold uppercase 0.12em letter-spacing) → title (fs-lg bold) → subtitle (xs tertiary).
- **Stat chips**: centered column chips — bold value (fs-md) + tiny uppercase label (9px).
- **Dashed divider** under the masthead (`border-top: 1px dashed var(--border-primary)`, ~12px/16px margins).
- **All box header icons use ONE theme-matched color** (gold `--accent-amber`), and the top tab bar icons use the SAME color.

### 3. Navigation / tabs
- If the page has a tab bar (GliderTabs): ALL tab icons use the SAME `--accent-amber` color (no per-category color rotation). `variant="dashboard"`, `compact`.
- If the header has left/right nav buttons + a center pill: square 32px icon buttons (`--bg-card` bg, 1px border), flat pill (`--bg-card`, 1px border, NO gradients).

### 4. Data cells / cards
- Flat single background (`--bg-card`), `border-radius: var(--radius-md)`, consistent min-height (e.g. 108px for schedule rows). NO background tinting of whole cells.
- Use a 2px left border on each item + color the item's primary code/text in the SAME accent color. Semantic density scale: 0 → emerald, 1 → cyan, 2 → amber, 3+ → rose.
- Small round count badge top-right (18px, `--radius-full`), turns red ("hot") when ≥3.
- "Today"/active state: minimal — slightly tinted border + soft glow (`0 0 0 1px` at ~18% accent). NO pulsing rings, NO heavy borders.

### 5. Page hero (greeting-style banners)
- Card shell (bg-card + border + glow-lift shadow), subtle top-right corner gradient (secondary/tertiary accent at 5–10% opacity).
- Date/meta text: all-caps, 0.05em letter-spacing, tertiary color.
- Highlighted name/title in Primary gold (`--accent-amber`).

### 6. Sidebar (if touched)
- Cards/boxes match sidebar bg (`#1B1B1F`).
- Active nav item: solid `--bg-tertiary` pill + gold text + small 3px gold left indicator bar (`::before`).
- Nav split into top + bottom groups with a faint divider; collapse button = subtle gray circle.

### 7. Global rules
- Font: Inter (inherited, `--font-primary`), no condensed.
- Radii: major cards `var(--radius-lg/xl)` (12–20px).
- Transitions: ~0.2s on all hover states.
- **Only theme CSS variables** (`var(--...)`), never hardcoded hex in components. No `!important`. Keep file style consistent with the dashboard.
- Keep ALL existing functionality — only visual/layout changes.

### 8. Verification
- `npm run build` must pass with no errors.
- The page's card backgrounds must match the sidebar background; tab icons + box header icons must be one consistent theme color.

## PROMPT END

---

## Usage checklist
1. Replace `<PAGE NAME>` with the target (e.g. "Community", "Marketplace", "Vault", "Settings"…).
2. Paste to Claude Code in this repo.
3. If the page needs a scoped token file, tell Claude to create one mirroring `dashboard-tokens.css` values above.
