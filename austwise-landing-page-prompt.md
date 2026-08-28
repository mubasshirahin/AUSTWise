# Prompt: AUSTWise — Cinematic Scroll-to-Explore Landing Page (Three.js + GSAP)

Copy everything below into your agentic AI (Claude Code, Cursor, etc.) inside your AUSTWise repo.

---

## Context

You are working inside my existing Next.js/React project for **AUSTWise** ("Your All-in-One Campus Companion"), a campus super-app for AUST students. I want you to rebuild the **public landing page only** (the marketing/scroll page before login, not the app dashboard) into a cinematic, 3D, scroll-driven experience similar to premium agency sites (Awwwards-style) that use **Three.js + GSAP ScrollTrigger** for "scroll to explore" storytelling.

**Before writing any code:**
1. Inspect the existing codebase — package.json, tailwind config / CSS variables, existing component library, fonts, and current landing page files.
2. Identify and reuse the current theme: base dark background `#171717`, plus whatever accent colors, gradients, border-radius scale, and typography are already defined in the project. Do NOT invent a new color palette — extract and extend the existing one.
3. Check whether `three`, `@react-three/fiber`, `@react-three/drei`, and `gsap` (with `ScrollTrigger`) are already installed; install if missing, and confirm compatible versions for the existing React/Next version.
4. Preserve existing routing, SEO meta tags, and the current login/CTA button destinations — only replace the visual/animation layer of the landing page.

## Goal

A single-page, scroll-driven landing experience where:
- A persistent (or section-scoped) **3D Three.js scene** reacts to scroll position — camera moves/dollies, objects rotate/assemble/disperse, particles react — synced via **GSAP ScrollTrigger** (pin + scrub), not just fade-ins.
- Each major section of the page reveals a themed 3D "moment" tied to what that section is about, instead of a static screenshot or icon grid.
- It feels premium, fast, and native to a campus/student-productivity product — not gimmicky sci-fi, not generic "particle sphere" templates.

## Content structure (based on AUSTWise's actual feature set — use this, don't invent generic SaaS copy)

Build the page as these scroll sections, each with its own 3D beat:

1. **Hero — "Your All-in-One Campus Companion"**
   - Full-viewport 3D hero. A central abstract object (e.g., a floating geometric "hub" made of connected nodes/shards) that represents the app as the single point tying together scattered student life.
   - Subtle idle animation (slow rotation/float) before scroll begins; on first scroll, it starts reacting.
   - Primary CTA button + a small "scroll to explore" indicator with a subtle animated arrow/mouse icon.

2. **"Problems? We solve them."**
   - Transition the 3D hub into a **fragmented/scattered state** — pieces representing chaos: scattered papers, disconnected chat bubbles, a broken clock/calendar icon, a stressed CGPA-like number — abstracted as low-poly/wireframe shapes, not literal illustrations.
   - Short copy beats (scroll-pinned, text crossfades as camera moves): things like routines lost in screenshots, deadlines buried in group chats, no clarity on attendance/CGPA, scattered Drive links, no single source of truth.

3. **"Everything you need" — the reassembly**
   - The scattered shapes **reassemble** into an organized structure (e.g., a grid/orbit of connected modules) as the user scrolls — this is the emotional payoff beat: chaos → order.

4. **Feature showcase — module-by-module scroll-through**
   Use my real modules/features (do not use placeholder SaaS features). Represent each module as one scroll "chapter" with a distinct 3D motif and 2–3 real features pulled from the list below, camera dollying from one to the next along a path (or orbiting a central structure and each scroll step rotates focus to a new "planet"/node):

   - **Dashboard** — Quick Stats, Daily Flow, Notice Board, Deadlines, Routine Grid, Semester View, Zero Hour, Attendance Tracker
   - **Daily Life** — Cover Page Generator, Bhara Koto (commute cost calculator), TakaGeloKoi (expense tracker), Mass Meal Manager
   - **Grade Lab** — CGPA Calculator, Semester-wise tracking, Dept. Heatmap, Best & Worst courses, Prerequisites tree
   - **InsideAUST** — Floor Map, Faculty Live Status, Library Crowd Pulse, Canteen Menu, Bus Tracker, Free Rooms Finder
   - **Resource Vault** — Batch Vault, Atlas Vault, Carbon Vault (curated notes)
   - **Community** — Alumni Directory, Student Directory, Mentor Request
   - **Marketplace** — AW Market, To-Let Mama, Lost & Found
   - **Productivity & Shadow** — Study Zone, Cheat Sheets, Workspace, Course Reviews, Shadow Chat, Buzz

   For each chapter: pin the section, scrub camera/object transform tied to scroll progress, swap in a short headline + 1-line description + a lightweight UI mockup card (real component, not an image) floating in 3D space.

5. **Roles/trust beat (optional, lightweight)**
   - A quick visual showing the platform adapts to who you are (Student / CR / SR / Faculty / Admin) — small animated badge/orbit switch, not the full permission matrix.

6. **Final CTA**
   - Camera settles back to a hero-like centered shot of the reassembled hub. Strong CTA: "See Plans" / "Get Started" / sign-up button. Subtle particle ambiance continues idle.

## Technical requirements

- **Stack**: React Three Fiber + drei for the 3D scene, GSAP + ScrollTrigger for scroll choreography (use `scrub`, `pin`, and `onUpdate` to drive Three.js camera/object props from scroll progress — avoid relying on Framer Motion for the 3D sync since GSAP ScrollTrigger's scrub is more precise for this).
- **Performance**:
  - Lazy-load the Three.js canvas (dynamic import, `ssr: false` in Next.js).
  - Cap DPR (`Math.min(window.devicePixelRatio, 2)`), use `<Suspense>` with a lightweight loader.
  - Use instancing for repeated geometry (nodes/particles) instead of many separate meshes.
  - Respect `prefers-reduced-motion`: fall back to a static/gently-animated version with normal scroll-fade sections, no forced scroll-jacking.
  - Provide a graceful non-WebGL fallback (feature-detect; show a static gradient/illustrated version).
- **Mobile**: On small viewports, simplify — reduce particle counts, shrink or disable camera dolly complexity, keep pinning short, prioritize load speed and battery. Test that scroll doesn't feel hijacked/janky on touch devices.
- **Theming**: All colors, gradients, and glow effects must pull from the existing CSS variables / Tailwind theme tokens already in the repo (dark base `#171717` + existing accent colors) — no hardcoded new hex values unless extending an existing token.
- **Code quality**: Componentize each 3D "scene chapter" separately (e.g., `<HeroScene />`, `<ChaosScene />`, `<ModuleShowcaseScene />`) so sections can be tuned independently. Keep GSAP ScrollTrigger instances properly cleaned up on unmount (React strict-mode safe).
- **Accessibility**: Ensure all real text content (headlines, feature names) is actual DOM text (readable by screen readers/SEO), not baked into canvas/textures.

## Deliverables

1. Updated landing page route/component using the section structure above.
2. Modular 3D scene components + GSAP ScrollTrigger timeline setup.
3. Reduced-motion and no-WebGL fallback path.
4. Brief comment block at the top of the main landing file explaining the scroll-progress-to-3D-state mapping, so it's maintainable later.

Now inspect the repository, confirm the current theme tokens and stack versions, then implement this.
