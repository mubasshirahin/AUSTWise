# Coding Foding: UI and style reference

Taken from https://codingfoding.com/en on 2026-11-20: computed styles, CSS rules and keyframes read in the browser, with screenshots of every landing section in both themes.
This file is the reference for AUSTWise themes **#24 Notebook** (light) and **#25 Night Owl** (dark). Those themes borrow the *feel* only. No logos, artwork, copy or brand names.

---

## 1. The feel in one paragraph

It looks like a student's desk at night. The page is pure black or plain white paper. The headline word gets a yellow highlighter stroke. Labels look like code comments (`// the difference`). Little notes are scribbled in a handwritten font, slightly tilted. Course cards have tabs like folder dividers, sticky notes are held on with tape, and a macOS-style terminal sits at the bottom. Motion is small and physical: the highlighter swipes across, cards lift 3px, a button's dot stretches into a bar, and the cursor blinks.

## 2. Theme tokens

The site has two themes, set with `data-theme` on `<html>`.

| Token | `midnight` (dark) | `paper` (light) | Used for |
|---|---|---|---|
| `--bg` | `#000` | `#fff` | page |
| `--bg-elev` | `#0e0e0e` | `#fff` | cards, secondary buttons |
| `--bg-elev-2` | `#181818` | `#f4f4f4` | row hover, inset wells |
| `--band-alt` | `#0b0b0b` | `#f6f6f6` | alternating section bands |
| `--fg` | `#f5f5f5` | `#0a0a0a` | text |
| `--muted` | `#a3a3a3` | `#5c5c5c` | body copy, nav links |
| `--border` | `#262626` | `#e6e6e6` | all 1px borders |
| `--accent-1` | `#8fa8ff` periwinkle | `#2747c9` ink blue | links, `//`, handwritten notes |
| `--accent-2` | `#5fd38a` green | `#1d7a3e` green | success, "easy", right-hand notes |
| `--mark` | `#f5d24a` | `#ffe066` | highlighter, "Part 1 free" tag, active-nav underline |
| `--on-mark` | `#141517` | `#1a1a1a` | text on the highlighter |
| `--btn` / `--on-btn` | `#f5d24a` / `#141517` | `#0a0a0a` / `#fff` | primary button (yellow at night, black on paper) |
| `--danger` | `#ff7369` | `#d1342f` | errors, `TODO` keyword |

Fixed extras that don't change with the theme:
- Terminal and todo panels: bg `#1c1d21` / `#16181d`, text `#e6e4de`, dim `#8e8b84`, prompt and cursor `#f5d24a`. They stay dark in light mode too.
- Sticky note: paper `#fff1a6`, ink `#3b3112`.
- Leaderboard gold: `#f6c945`.
- Difficulty: easy `--accent-2`, medium `#c27c0e` (`#f0b54a` at night), hard `--danger`.

## 3. Type

| Role | Font on the site | AUSTWise substitute (already loaded) |
|---|---|---|
| UI and body | Inter, with Hind for Bangla | `Inter`, `Noto Sans Bengali` |
| Headings ("brand") | Geist, weight 600 | `Inter Tight` 600 |
| Labels, numbers, code | a mono face | `JetBrains Mono` |
| Handwritten notes | a "sketch" cursive, weight 600 | `Kalam` 700 |

Scale and tracking:
- H1 `clamp(38px, 5vw, 64px)`, line-height 1.04, letter-spacing `-0.025em`, weight 600.
- H2 `clamp(32px, 4.2vw, 52px)`, line-height 1.08, `-0.025em`.
- Card title 24px, line-height 1.25, `-0.02em`.
- Eyebrow 12.8px mono weight 500 in muted grey, with `::before { content: "// "; color: accent-1 }`.
- Nav links 13.5px weight 500, muted. On hover a mono `/` slides in on the left.
- Section number: a small `§` above a big mono `01`, `02`, `03`.
- Hand notes 32px sketch font in accent-1, rotated -4deg (or accent-2 at -3deg).

## 4. Shape

| Element | Radius | Notes |
|---|---|---|
| Course card | `4px 14px 14px 14px` | Top-left corner is tight where the coloured mono tab (`8px 8px 0 0`) sits, like a folder divider |
| Buttons | `999px` pill | Height 44px, padding `0 20px 0 16px`, with a dot on the left |
| Mark tag ("Part 1 free") | `4px` | Mark background, 12px weight 500 |
| Difficulty pill | `999px 900px 999px 860px` | 1.5px border in the level colour, rotated -2deg so it looks hand-drawn |
| Terminal and todo | `12px` | |
| Sticky note | `2px 2px 18px 2px` | Peeled bottom-right corner, tape strip on top |
| Small inputs, sign-in | `8px` | |

Borders are always 1px `--border`. There are almost no shadows at rest. A shadow only shows up on hover (`0 22px 40px -26px rgba(0,0,0,.45)`).

## 5. Components

- **Highlighter mark.** Yellow band behind a word, slightly slanted (176deg), with `box-decoration-break: clone`. At night the text turns dark ink once the highlighter has passed.
- **Dot-morph button.** Pill with an 8px dot. On hover the dot stretches to 7×18px with a springy `cubic-bezier(.3,1.4,.5,1)`. Loading turns it into a spinner ring; success draws a ✓.
- **Course card.** Elevated surface with a folder tab, mono `01`, mark tag top-right, title, two-line clamp, segmented progress (free parts filled with mark), then a list of parts with dotted leaders and mono hours. Hover: lift 3px, border turns `--fg`, tab rises 3px.
- **Wishlist (`wishlist.todo`).** Dark code-editor panel. A tab bar with a yellow underline, rows numbered in mono, a red `TODO` keyword, the title (with a highlight on #1), a blue `#tag` and a mono `// comment`. Dashed dividers between rows. On hover the row number and vote button turn yellow.
- **Reviews.** Solid coloured cards (yellow, royal blue, white) with a corner blob and 5 stars, like stickers.
- **Terminal CTA.** macOS window with traffic lights, centred title `you — zsh — 80×24`, yellow prompt and a blinking block cursor.
- **Nav rail.** `cd ~/` prompt, links, and a 3px mark bar under the active link.

## 5b. Inner pages

Checked with screenshots: `/learn`, a course page, a lesson, `/problems/dsa`, `/leaderboard`, `/roadmap`, `/interview`, `/interview/recall`, `/build-to-hire`, `/pricing`, `/blogs`, `/changelog`, `/auth/login`, plus the lesson and leaderboard in paper mode.

**One page header everywhere.** Each page opens the same way: a `// eyebrow` (mono, e.g. `// Practice`, `// interview · daily recall`), then an H1 (`clamp(32px,4.5vw,56px)`, weight 600–800, about `-0.025em`) where **one word** often gets the highlighter ("What's ~~new~~", "Ten a day, ~~nothing~~ forgotten", "Take learning ~~seriously~~"). Under that comes a muted subtitle (max ~60ch) and a mono stat line (`182 cards · 9 decks`, `60 problems 11 topics 17 easy 39 medium 4 hard`, with each count in its difficulty colour). Content sits left-aligned at ~1100px. Only "coming soon" pages (Interview) and auth are centred.

| Page | Distinct pieces |
|---|---|
| Learn index | Big two-column course rows. Left: mono `AI · 01`, mark tag, title, blurb, mono meta, yellow pill CTA. Right: numbered parts list with green `FREE` mini-tags and mono `9 chapters · 14–23 h` on dotted leaders |
| Course page | Two-tone title (highlighter on part of it). A **"Route ticket"** card (mono labels `FROM`/`TO`, dashed segment track, `STATIONS 153 · PARTS 10 · READING TIME`). Accordion with huge mono numerals `01 02 03`, a `Free` mark tag or a lock + `Pro` |
| Lesson | 3-column reading layout. Breadcrumb in accent-1 (12px). Topic chips (mono 12px, 6px radius, accent-1 at 14%). Body 17px/1.6. H2 ~30px weight 800. Tables have `#181818` header cells and 1px `#262626` grid. Inline code is mono on `bg-elev-2` with a 1px border and 6px radius. `<details class="callout">` uses 12px radius. Right rail: a `0% read · 01/14` progress card and an "On this page" TOC (mono numbers, active row = accent-1 at 12% fill, accent-1 text, 10px radius) |
| DSA problems | Left sidebar card (`0% · 0/68 solved`, search, topic list with green mono index badges and `0/8` counts). Main area: "Which pattern?" cards with pill filter chips and a step-through array visualiser (`← Pause → Step 1/7`) |
| Leaderboard | Pill filter chips. Idle: 1px border, muted text. Active: solid `--fg` with `--bg` text. Select and search are 40px tall with 12px radius on `--bg`. Table headers are 12px uppercase muted, weight 500. Rows are 14px with a hover fill. Medals for the top 3, then `#4…` |
| Roadmap | Hand-drawn metro line (solid green when shipped, dotted after) with ring stations: Shipped / Next / Horizon / Plan |
| Interview (soon) | Centred: dashed ring icon, `// Interview · Coming soon`, numbered steps in small circles inside a card, yellow + secondary pill buttons, a green text link with `→` |
| Daily recall | "today" card with **segmented control**: track `bg-elev-2` as a pill with 3px padding, active option `bg-elev` with a 1px border ring, mono 13px/600. Deck checklist with mono `01` numbers and `0/15` counts |
| Build to hire | Filter sidebar. Project cards have a folder-tab icon centred on top, a mono `Brief #06 · Backend`, a red `Hard` pill and bold tool lists |
| Pricing | Highlighted H1 word. Monthly/Yearly segmented pill with a mark `extra 20% off` tag. Free card vs Pro card: Pro has a `Most popular` mark tag sitting on its top border, strike-through price and a full-width yellow CTA |
| Blog | Stacked post cards: mono tag chips, a 24px title, muted excerpt, mono uppercase date line and `READ →` in green |
| Changelog | Version column (`v1.4.0` mono, date, `current` mark tag) next to entries. Mono `IMPROVED` / `FIXED` labels in accent colours, with `→` and `!` bullets |
| Login | Centred: logo, H1 with one accent word, terms checkbox, Google pill button (disabled until terms are accepted), tiny muted footnote |

Footer: five link columns (Learn / Practice / Interview / Community / More), small muted headings, a yellow `Start free` pill.

## 6. Motion

| Name | What it does | Timing |
|---|---|---|
| `hero-mark` | Highlighter `background-size` grows 0 → 100% | 0.75s `cubic-bezier(.55,.1,.25,1)`, 0.35s delay |
| `hero-mark-ink` | Text colour fades fg → on-mark after the swipe | 0.3s, 0.95s delay |
| `hud-in` | Panels enter with opacity 0, y+14px, scale .98 | ~0.5s ease-out |
| `nav-pop` | Menus drop in with y-6px, scale .985 | short |
| `sticky-in` | Note drops from y-36px with a rotate overshoot | 0.55s `cubic-bezier(.2,.9,.3,1.2)` |
| `term-blink` | Cursor on/off | 1.05s `step-end` infinite |
| `sticker-float` / `art-float` | Doodles bob ±6px and rotate ±6deg | slow, alternate |
| `petal-fall`, `yvy-*` | Small mascot doodles: shake, sway, buzz, dig, flag wave, star twinkle | idle loops |
| `dg-*` | Teaching diagrams: packets travel, steps appear in sequence, strokes draw in | 6–14s loops |
| Card hover | `transform .3s cubic-bezier(.2,.8,.2,1)` | lift 3px |

Everything uses short, springy easing. Nothing pulses for attention.

## 7. Where the "student flavour" comes from

1. Highlighter on the one word that matters.
2. Code-comment labels (`//`, `§ 01`, `cd ~/`, `wishlist.todo`, `new Human()`).
3. Handwritten side notes, tilted a few degrees.
4. Stationery objects: sticky notes, tape, folder tabs, hand-drawn pills.
5. Line-art doodles beside section heads (lightbulb, ballot box, docker whale, heart bubble).
6. Real-tool chrome: a terminal, an editor tab, `$ go run .`.
7. Bangla and English side by side.

## 8. How AUSTWise uses this

| Coding Foding | AUSTWise Notebook / Night Owl |
|---|---|
| Highlighter on hero word | `text-decoration` highlighter stroke under `.page-title` and `.dl-head-name` that draws in on page load |
| `// eyebrow` | `// ` prefix on `.dl-head-overline` and `.schedule-overline`, mono, accent-1 |
| Dot-morph pill button | `.btn` pill. `.btn-primary` is mark yellow at night and ink black on paper |
| Folder-tab course card | `.glass-card` radius `4px 14px 14px 14px`, flat, lifts 3px on hover and the border darkens to text colour |
| Mark tag | `.badge` gets a 4px radius with mark-tinted fill |
| Hand-drawn pill | `.tag` gets the irregular `999px 900px 999px 860px` radius |
| Rail-link `/` + mark bar | Sidebar `.nav-item.active` shows a mark-coloured `/` in place of the glow bar |
| Highlighter `::selection` | Selected text looks highlighted (mark bg, on-mark ink) |
| Terminal cursor | Caret colour is mark |
| Hand notes | `.empty-state` text in Kalam, tilted -1.5deg |
| Segmented control | `.glider-tabs` track is a pill on `bg-tertiary`. The glider is `bg-card` with a 1px border ring |
| Filter chips, active = solid | Active `.glider-tab` text is `--text-primary`; chips keep their pill shape |
| Uppercase table header | `th` is 11.5px uppercase, muted, weight 500 |
| 12px inputs | `.input` and `.search-box input` use a 12px radius |
| Checkboxes | `accent-color` follows the theme accent |
| `hud-in` | Page content uses AUSTWise's existing `fadeInUp`. Turned off under `prefers-reduced-motion` |

House rules from `CLAUDE.md` still apply: flat surfaces, so no gradients, glows or tinted overlays. The highlighter is drawn with `text-decoration`, not a gradient.
