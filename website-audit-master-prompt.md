# Master Prompt: Website Production-Readiness & Security Audit

> ব্যবহার: এই পুরো prompt টা কপি করে Claude Code / Cursor / অন্য কোনো AI tool-এ পেস্ট করুন, যেখানে আপনার প্রজেক্টের ফোল্ডার/কোডবেস অ্যাক্সেস আছে। কাজ শেষে এটা `production-readiness-report.md` নামে একটা রিপোর্ট ফাইল বানাবে।

---

## PROMPT (নিচের পুরোটা কপি করুন)

তুমি একজন সিনিয়র Security Engineer এবং Production-Readiness Auditor হিসেবে কাজ করবে। আমার পুরো website/codebase টা ভালোভাবে পড়ে, বিশ্লেষণ করে একটা বিস্তারিত মার্কডাউন (`.md`) রিপোর্ট তৈরি করে দাও।

### তোমার কাজের ধাপ (Step-by-step):

1. **প্রজেক্ট স্ট্রাকচার বোঝা**
   - পুরো ফোল্ডার স্ট্রাকচার দেখো (frontend, backend, config, scripts, ইত্যাদি)।
   - কী স্ট্যাক ব্যবহার হয়েছে (framework, database, hosting) সেটা চিহ্নিত করো।

2. **Secrets / Credentials Leak চেক করো**
   - `.env`, `.env.local`, config ফাইল, বা সোর্স কোডের ভেতরে হার্ডকোডেড API key, database password, JWT secret, third-party token (Stripe, AWS, Firebase, ইত্যাদি) আছে কিনা খুঁজে বের করো।
   - `.gitignore`-এ `.env`, `node_modules`, build ফোল্ডার ঠিকভাবে বাদ দেওয়া আছে কিনা দেখো।
   - Git history-তে আগে কোনো secret commit হয়ে গেছে কিনা (যদি অ্যাক্সেস থাকে) চেক করো।
   - Public repo হলে কোনো sensitive ফাইল/ফোল্ডার (`.git/`, `backup/`, `admin/`) publicly accessible কিনা।

3. **Authentication & Authorization**
   - Password hashing ঠিকভাবে হচ্ছে কিনা (bcrypt/argon2, প্লেইনটেক্সট না তো)।
   - Session/JWT handling নিরাপদ কিনা (expiry, secure/httpOnly cookie flags)।
   - Admin/protected routes-এ যথাযথ authorization check আছে কিনা (broken access control)।
   - Rate limiting আছে কিনা login/signup/OTP endpoint-এ।

4. **Common Web Vulnerabilities (OWASP Top 10 ভিত্তিক)**
   - SQL Injection / NoSQL Injection সম্ভাবনা
   - XSS (Cross-Site Scripting) — user input sanitize হচ্ছে কিনা
   - CSRF protection আছে কিনা
   - CORS misconfiguration (`*` দিয়ে সব origin allow করা আছে কিনা)
   - Insecure direct object reference (IDOR)
   - File upload endpoint নিরাপদ কিনা (file type/size validation)
   - SSRF সম্ভাবনা

5. **Data Exposure & Privacy**
   - API response-এ দরকারের চেয়ে বেশি data (password hash, internal ID, ইত্যাদি) return হচ্ছে কিনা।
   - Error message/stack trace production-এ user-কে দেখানো হচ্ছে কিনা (debug mode off আছে কিনা)।
   - PII (user email, phone, address) কীভাবে store/handle হচ্ছে — encryption দরকার কিনা।
   - Logging-এ sensitive data (password, token) লগ হচ্ছে কিনা।

6. **Infrastructure & Config**
   - HTTPS enforced কিনা, HTTP→HTTPS redirect আছে কিনা।
   - Security headers আছে কিনা (Content-Security-Policy, X-Frame-Options, Strict-Transport-Security, X-Content-Type-Options)।
   - Database publicly exposed কিনা (default port open, weak/no password)।
   - Third-party dependency-তে known vulnerability আছে কিনা (`npm audit` / `pip-audit` ধরনের চেক)।
   - Environment variable production/staging/dev আলাদা কিনা।

7. **Performance & Reliability (production readiness)**
   - Unused/console.log/debug কোড production build-এ থেকে গেছে কিনা।
   - Image/asset optimization হয়েছে কিনা।
   - Error handling/try-catch যথাযথ জায়গায় আছে কিনা (crash prevent)।
   - Database query-তে N+1 বা obvious performance issue আছে কিনা।

8. **SEO ও Basic Hygiene** (যদি website public-facing হয়)
   - `robots.txt`, `sitemap.xml`, meta tags ঠিক আছে কিনা।
   - Broken link/404 handling।

### আউটপুট ফরম্যাট (`.md` ফাইল হিসেবে দিতে হবে):

```markdown
# Production Readiness & Security Audit Report

**Date:** [তারিখ]
**Project:** [প্রজেক্ট নাম]

## Executive Summary
[সংক্ষেপে সবচেয়ে গুরুত্বপূর্ণ ৩-৫টা ইস্যু, overall risk level: Critical/High/Medium/Low]

## Findings

### 🔴 Critical (Production-এ যাওয়ার আগে অবশ্যই ফিক্স করতে হবে)
| # | Issue | Location (file/line) | Risk | Fix Recommendation |
|---|-------|----------------------|------|---------------------|

### 🟠 High Priority
| # | Issue | Location | Risk | Fix Recommendation |
|---|-------|----------|------|---------------------|

### 🟡 Medium Priority
| # | Issue | Location | Risk | Fix Recommendation |
|---|-------|----------|------|---------------------|

### 🟢 Low Priority / Nice to Have
| # | Issue | Location | Risk | Fix Recommendation |
|---|-------|----------|------|---------------------|

## Secrets & Leak Scan Result
[কোনো exposed key/credential পাওয়া গেলে সেটার নাম না দিয়ে শুধু কোন ফাইলে আছে ও কী ধরনের সেটা উল্লেখ করো, এবং immediate rotation-এর পরামর্শ দাও]

## Dependency Vulnerability Summary
[কোনো known-vulnerable package থাকলে লিস্ট করো এবং update ভার্সন সাজেস্ট করো]

## Pre-Production Checklist
- [ ] সব `.env` secret rotate করা হয়েছে
- [ ] Debug mode off
- [ ] HTTPS enforced
- [ ] Security headers যোগ করা হয়েছে
- [ ] Rate limiting চালু
- [ ] Error message sanitized
- [ ] Dependency vulnerabilities ফিক্স করা হয়েছে
- [ ] Backup/rollback প্ল্যান আছে
- [ ] Monitoring/logging setup আছে

## Recommendations Priority Order
[কোনটা আগে ফিক্স করলে সবচেয়ে বেশি রিস্ক কমবে, সেই অনুযায়ী action plan]
```

### নিয়ম:
- **কোনো actual secret value/key নিজে রিপোর্টে copy-paste করবে না** — শুধু বলবে কোথায় পাওয়া গেছে ও কী ধরনের।
- প্রতিটা finding-এর সাথে ঠিক ফাইলের path ও (সম্ভব হলে) লাইন নাম্বার দিতে হবে।
- Guess করবে না — যেটা কোডে সরাসরি দেখতে পাওনি সেটা "assumption" হিসেবে আলাদাভাবে উল্লেখ করবে।
- শেষে রিপোর্টটা `production-readiness-report.md` নামে সেভ করে দেবে।

---

## ব্যবহার করার টিপস

1. **Claude Code দিয়ে করলে সবচেয়ে ভালো** — কারণ এটা সরাসরি আপনার লোকাল codebase/repo পড়তে ও ফাইল সিস্টেমে রিপোর্ট সেভ করতে পারবে।
2. যদি claude.ai চ্যাটে করেন, তাহলে পুরো প্রজেক্ট ফোল্ডার zip করে আপলোড করুন (অথবা গুরুত্বপূর্ণ ফাইলগুলো — config, routes, auth, .env.example — আলাদা করে আপলোড করুন)।
3. একবারে পুরো বড় codebase দিলে context miss হতে পারে — বড় প্রজেক্ট হলে module-wise (auth module, payment module, API layer) ভাগ করে চালানো ভালো।
4. **`.env` ফাইলের আসল ভ্যালু কখনো কোনো external AI tool-এ আপলোড করবেন না** — শুধু `.env.example` বা key-name গুলো (value ছাড়া) দিন।
