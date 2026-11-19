# AUSTWise – Final QA Checklist

Kivabe use korbe: protita item check kore `[ ]` → `[x]` koro. Bug pele niche **Bug log** e likho (page, role, device, theme, steps).
Automated part: `npm run test:e2e` (dekho `docs/qa/AUTOMATION.md`). Manual part: niche shob.

> ⚠️ Local `.env` production DB te point kore. QA korar shomoy **test DB** use koro, real data te write korbe na.

---

## 0. Global (shob page e common)
- [ ] Page load hoy, console e red error nai
- [ ] Loading state dekhay (skeleton/spinner), blank flash nai
- [ ] Empty state ache (data na thakle sundor message)
- [ ] Error state: network off kore try koro → bujhar moto message
- [ ] Sidebar/nav theke page e jawa jay, active item highlight hoy
- [ ] Browser back/forward thik moto kaj kore
- [ ] Refresh dile same page/tab e thake (URL e `?tab=` thakle)
- [ ] Old URL redirect kore (e.g. `/vault` → `/resource-vault`, `/pro` → `/see-plans`)
- [ ] Masthead skill-style onujayi (icon tile, title, stats, ⋮ menu)
- [ ] Profile icon e mini card ashe (click + hover), scroll e bondho hoy
- [ ] Logout → `/` e jay, protected page e back dile login chay

---

## 1. Public pages (logged-out)
| Route | User flow | Check |
|---|---|---|
| `/` Landing | Open → hero → CTA "Login/Get started" → `/login` | [ ] |
| `/cinematic` | Animation smooth, skip/scroll kaj kore | [ ] |
| `/login` | Email+pass → login → `/dashboard/quickstats`. Wrong pass → error msg. Forgot → reset mail | [ ] |
| `/reset-password` | Link theke open → new pass → login hoy; expired link → error | [ ] |
| `/accept-invite` | Invite link → account create/join → dashboard | [ ] |
| `/features`, `/pricing`, `/about-us`, `/docs`, `/blog`, `/changelog` | Content dekhay, link gula kaj kore | [ ] |
| `/feedback` | Form submit → success; empty submit → validation | [ ] |
| `/terms`, `/privacy`, `/cookie-policy` | Text porte jay, footer theke link ache | [ ] |
| `/payment/success`, `/payment/cancel` | Sothik message + back button | [ ] |
| Unknown URL | `/` e redirect | [ ] |
| `/admin-panel/*` logged-out | `/login` e redirect | [ ] |

## 2. App pages (logged-in)
Protita page er jonno: **Open → main action → result → edit → delete → refresh e data thake?**

| Route | Main user flow | Check |
|---|---|---|
| `/dashboard/quickstats` | Stats card load, notice board e notice dekha; swipe left=edit / right=delete (mobile) | [ ] |
| `/dashboard/routine` | Routine dekha, class add/edit, today highlight | [ ] |
| `/routine-templates` | Template choose → apply → routine e ashe | [ ] |
| `/gradelab` (+ `/:section`) | Course/grade add → CGPA calc thik; section tab switch | [ ] |
| `/resource-vault` | File/notes browse, search, upload (size limit), download | [ ] |
| `/notebook` | Note create → save → reopen → edit → delete | [ ] |
| `/cheat-sheets` | List, filter, open, download | [ ] |
| `/insideaust` | Campus map/info, empty classroom, bhara-koto tabs | [ ] |
| `/community` | Post create, comment, react, report | [ ] |
| `/marketplace` | Item post (image), search/filter, contact seller, mark sold, delete | [ ] |
| `/connectbox` | Conversation open, message send/receive realtime (2 browser e test), unread count | [ ] |
| `/members/:id` | Profile dekha, mini card info match kore | [ ] |
| `/workspace` | Project/task create, move, complete | [ ] |
| `/study-time` | Room join/leave, timer, other members dekhay | [ ] |
| `/zen-study-room` | Fullscreen mode, exit kaj kore | [ ] |
| `/code-pulse` | CP profile link, stats load, contest list | [ ] |
| `/takagelokoi` | Income/expense add, category, calendar switch, total thik | [ ] |
| `/question-bank` | Upload/search question, analyzer result | [ ] |
| `/cover-page-generator` | Form fill → preview → PDF download thik | [ ] |
| `/downtime` (+ `?tab=gaming`) | Tabs switch; game hub, room create/join, event, `/gaming/mod` (mod only) | [ ] |
| `/roast-cv` | CV upload → result; wrong file type → error | [ ] |
| `/certificate` | Generate → download | [ ] |
| `/wakemeup` | Alarm set → ring → stop/snooze | [ ] |
| `/austeddit` | Post, upvote, comment | [ ] |
| `/shadow` | Main flow kaj kore | [ ] |
| `/daily-life` | Main flow kaj kore | [ ] |
| `/productivity` | Main flow kaj kore | [ ] |
| `/see-plans` | Plan dekha → checkout (test mode) → success/cancel page | [ ] |
| `/settings` | Profile edit, password change, theme change persist, logout | [ ] |

## 3. Admin panel
| Route | Flow | Check |
|---|---|---|
| `/admin-panel/overview` | Stats load | [ ] |
| `/admin-panel/access-requests` | Approve / reject → user er role update | [ ] |
| `/admin-panel/:section` (users, canteen, library, academic, attendance, templates, auditorium, cheatsheets, campus-map, applications, cr-sr-directory, bhara-koto, features, question-bank) | Protita section e list, add, edit, delete | [ ] |
| `/admin-panel/role-preview` | Role matrix thik dekhay; **production e admin chara khule na** | [ ] |
| `/admin-panel/flow-canvas` | Canvas load, zoom/pan | [ ] |
| Legacy `/admin/*` | Notun `/admin-panel/...` e redirect | [ ] |

---

## 4. Role management
Protita role er ekta test account banao: **owner, admin, moderator, cr, gs, faculty, function, cohost, regular**.

| Check | owner | admin | mod | cr | gs | faculty | function | cohost | regular |
|---|---|---|---|---|---|---|---|---|---|
| Admin panel e dhukte pare | ✅ | ✅ | ? | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Notice post korte pare | | | | | | | | | |
| Onner post delete | | | | | | | | | |
| `/gaming/mod` | | | | | | | | | |
| Role change korte pare | ✅ | ? | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

(Expected value gula `/admin-panel/role-preview` er matrix theke fill koro.)
- [ ] UI te button lukano **ar** API o block kore (DevTools theke request pathale 401/403 ashe)
- [ ] Nijer role nije promote korte pare na
- [ ] Role change er por page refresh e notun permission apply hoy
- [ ] Onner ID diye URL/API call kore onner data dekha/edit jay na (IDOR)

---

## 5. Responsive (skill-style rules)
Device: **Mobile 375×812, Tablet 768×1024, Desktop 1440×900** (+ 320px choto phone, landscape).
Protita page e:
- [ ] Horizontal scroll nai
- [ ] Text overflow/truncate thik, kono kichu cut hoy na
- [ ] Sidebar mobile e drawer hoy, close hoy
- [ ] Modal/overlay screen e fit kore, scroll kore
- [ ] Button/tap target ≥ 40px, swipe action kaj kore
- [ ] Table gula mobile e card/scroll hoy
- [ ] Keyboard open hole input dhaka pore na (real phone e)

## 6. Themes
Theme gula: arcade, art-deco, bitcoindefi, blueprint, cricket, cyberpunk, dark, fire, forest, industrial, light, lofi, meshtopo, midnight, minimalist-monochrome, newsprint, nexus, obsidian, pastel, poster, prism, sakura, sketchbook, space, swiss, terminal, toon.
Protita theme e (dashboard, ekta form page, ekta list page, modal, admin):
- [ ] Text porte jay (contrast), muted text o
- [ ] Button/link/accent dekha jay
- [ ] Input, dropdown, date picker theme follow kore (white box nai dark theme e)
- [ ] Chart color thik
- [ ] **Kono gradient/glow/tint nai** (CLAUDE.md rule; masthead exception chara)
- [ ] Theme refresh e persist kore (`aust-theme`)

## 7. Security
- [ ] `npm audit` – high/critical nai
- [ ] Protita `/api/*` route e auth check (logged-out call → 401)
- [ ] Role check backend e (Section 4)
- [ ] Login rate limit / brute-force protection
- [ ] Password bcrypt hash, response e kokhono password/hash ashe na
- [ ] JWT secret strong, expiry ache, cookie `HttpOnly; Secure; SameSite`
- [ ] Input e `<script>alert(1)</script>` dile execute hoy na (XSS) – post, comment, message, profile name
- [ ] File upload: type + size limit, filename sanitize
- [ ] CORS shudhu nijer domain
- [ ] Security headers (CSP, X-Frame-Options, HSTS)
- [ ] Client bundle e kono secret/API key nai (`dist/` e search)
- [ ] Reset-password token one-time + expire hoy
- [ ] Payment success page direct open kore pro pawa jay na (server verify kore)
- [ ] WebSocket e auth check

## 8. Others
- [ ] Lighthouse (Performance, Accessibility, SEO, Best practices) – main pages ≥ 80
- [ ] Keyboard diye navigate (Tab, Enter, Esc modal bondho)
- [ ] Chrome, Firefox, Safari/WebKit, Edge
- [ ] Slow 3G te usable
- [ ] Favicon, title, meta/OG tags
- [ ] Bangla/long text e layout bhange na
- [ ] Time zone/date format thik

---

## Bug log
| # | Page | Role | Device | Theme | Steps | Expected | Actual | Status |
|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | |
