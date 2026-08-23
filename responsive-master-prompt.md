# Master Prompt: Make React 19 + Vite Website Fully Responsive (Tablet + Mobile)

Tailored for stack: React 19, Vite 8, react-router-dom 7, framer-motion, GSAP, Three.js, Chart.js, D3, Leaflet, Mermaid, Markmap, html2canvas-pro + jsPDF + pdfjs-dist, lucide-react, vite-plugin-pwa, plain JS (no TS), Node ≥20 custom server, ws, Prisma + PostgreSQL, JWT auth, Vercel.

Copy and paste the prompt below into your AI coding tool (Claude Code, Cursor, etc.) with your project open, then run it.

---

## PROMPT START

I need you to make my existing React 19 + Vite SPA fully responsive across desktop, tablet, and mobile — without changing visual design intent, content, functionality, or breaking any existing feature (routing, auth, WebSocket liveStore, PDF export, visualizations). Follow this process:

### 0. Project Context
- Stack: React 19 + Vite 8, react-router-dom 7, framer-motion + GSAP, Three.js, Chart.js, D3, Leaflet (+heatmap), Mermaid, Markmap, html2canvas-pro + jsPDF + pdfjs-dist, lucide-react, vite-plugin-pwa. Plain JS, no TypeScript.
- Backend is a hand-rolled Node HTTP server (no Express/Nest) with ws for WebSocket and Prisma/PostgreSQL — do not touch backend files unless a responsive fix genuinely requires an API/query shape change (it shouldn't).
- Deployed on Vercel as an SPA with a rewrite fallback — don't break routing config.

### 1. Audit First
- Walk every route (react-router-dom `Routes`/`Route`) and every component/page under `src/`.
- List components with hardcoded pixel widths/heights, fixed-width containers, non-fluid canvases (Three.js/Chart.js/D3/Leaflet), or layouts that break below 1024px.
- Separately list every component that mounts a **canvas, WebGL context, SVG viz, or map** — these need special handling (see Section 3.5).
- Give me this audit list before touching any code.

### 2. Breakpoints to Support
Mobile-first, using CSS custom media / a shared `breakpoints.js` (or Tailwind-style tokens if already in use) so values aren't duplicated across files:
- **Mobile (small):** 320px – 480px
- **Mobile (large):** 481px – 767px
- **Tablet (portrait):** 768px – 1024px
- **Tablet (landscape) / small laptop:** 1025px – 1280px
- **Desktop:** 1281px and above

### 3. Core Layout Rules
- Convert fixed `px` widths to fluid units (`%`, `rem`, `vw`, `clamp()`).
- Use Flexbox/Grid, not floats or fixed absolute positioning, for page layout.
- Nav/header must collapse into a hamburger/drawer menu below 768px — use `lucide-react`'s `Menu`/`X` icons for the toggle, consistent with existing icon usage.
- Font sizes via `clamp()` or relative units, not fixed `px`, for headings.
- Touch targets ≥ 44x44px on mobile (buttons, nav items, form fields).
- No horizontal overflow anywhere — audit for elements that force page width beyond viewport.
- Tables: horizontal scroll wrapper or stacked-card reflow on mobile.
- Modals/dropdowns/popovers: centered, scrollable, never cut off on small screens.
- Spacing/padding/margins scale down on smaller breakpoints, not fixed desktop values.

### 3.5 Stack-Specific Responsive Handling (critical — don't skip)
- **Three.js:** ensure the renderer/canvas listens for container resize (use `ResizeObserver`, not just `window.resize`) and updates camera aspect ratio + `renderer.setSize()` accordingly. On mobile, consider reducing `pixelRatio` (`renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))`) and disabling expensive effects (heavy postprocessing, shadow maps) below the tablet breakpoint for performance.
- **Chart.js:** use `responsive: true` and `maintainAspectRatio: false` inside a container with controlled height via CSS, not inline fixed height, so charts resize with their parent.
- **D3:** bind SVG dimensions to container width via `ResizeObserver` or `getBoundingClientRect()` on resize, not hardcoded `width`/`height` attributes.
- **Leaflet (+heatmap):** call `map.invalidateSize()` whenever the container is resized (e.g. after a sidebar/drawer toggles or on orientation change); ensure map container has a responsive height (`clamp()` or `vh`-based), not a fixed px height that overflows on small screens.
- **Mermaid / Markmap:** wrap diagrams in a horizontally scrollable container on mobile since diagram content itself shouldn't be force-reflowed; ensure text stays legible (don't just shrink to fit — allow pan/zoom or scroll instead).
- **html2canvas-pro + jsPDF + pdfjs-dist (PDF export/read):** verify export/preview UI (buttons, viewer controls) is usable on mobile touch; PDF viewer canvas should scale to container width, not overflow.
- **framer-motion + GSAP:** check that animations/transitions triggered on scroll or viewport size don't break or double-fire when breakpoint changes (e.g. layout animations recalculating on resize); consider reducing motion complexity on mobile if it affects scroll performance.
- **vite-plugin-pwa:** confirm manifest icons/viewport meta (`<meta name="viewport" content="width=device-width, initial-scale=1">`) are correctly set in `index.html` so PWA install and mobile rendering behave correctly.

### 4. Testing Requirement
After changes, verify at these exact widths with no overlapping, cut-off, or overflowing elements, and no console errors from resize handlers:
`320px, 375px, 414px, 768px, 1024px, 1280px`

Also test:
- Orientation change (portrait ↔ landscape) on tablet, especially for Leaflet/Three.js/Chart.js views.
- That react-router-dom navigation and any mobile drawer/menu don't conflict (drawer closes on route change).

### 5. Do Not
- Do not change color scheme, branding, or content.
- Do not remove or alter existing functionality (auth flow, WebSocket liveStore, PDF export, chart/map data logic).
- Do not introduce TypeScript, Tailwind, or new major dependencies unless I explicitly approve — stay in plain JS/CSS consistent with the current codebase.
- Do not touch backend (`server/dev.mjs`, Prisma schema, routes) unless a fix truly requires it.
- Do not rewrite from scratch — apply fixes incrementally, file by file.

### 6. Output
- List which files/components were changed and a one-line summary of the fix per file.
- Flag any component with no clean mobile equivalent (e.g., a dense dashboard sidebar or 3D scene) and propose 2 options for me to choose from instead of deciding unilaterally.

Start by giving me the audit list from Step 1 before making any changes.

## PROMPT END

---

### কীভাবে ব্যবহার করবেন
1. এই পুরো প্রম্পটটা কপি করুন।
2. আপনার প্রজেক্ট ফোল্ডার Claude Code / Cursor / যেকোনো AI কোডিং এজেন্টে ওপেন করুন।
3. প্রম্পটটা পেস্ট করে রান করুন — এটা প্রথমে অডিট করবে, তারপর ধাপে ধাপে ফিক্স করবে।
4. প্রতিটা পেজ 320px, 375px, 414px, 768px, 1024px, 1280px width-এ চেক করে নিশ্চিত হয়ে নিন।
