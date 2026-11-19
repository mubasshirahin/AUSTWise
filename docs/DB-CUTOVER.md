# DB cutover runbook — wrong database on Render (2026-11-19)

## What happened

The deployed Render service's `DATABASE_URL` pointed at Render's own free
`austwise-db` Postgres, not the Supabase database that holds the real accounts.
`SELECT version()` succeeded, so `/healthz/db` reported "connected" while the
app could only see 2 accounts: the boot-seeded admin (`ADM-MSOP6VG6BVL4`) and
one signup made into the empty DB. No data was deleted — Supabase still has
2,854 accounts in `AuthUsers`.

Evidence gathered (all read-only):

| Probe | Result |
|---|---|
| `GET /healthz` / `/healthz/db` | `200` — DB reachable |
| `GET /api/stats/count` (SQL `COUNT(*)`, no JSON fallback) | `2` |
| `GET /api/presence/members` | admin + one student only |
| Supabase `AuthUsers` | 2,854 rows intact |
| `render.yaml` history | `DATABASE_URL` never pointed at Supabase |

The local `server/users.json` is a stale gitignored mirror (~2,845 rows).
**Do not use it as a restore source** — Supabase is authoritative.

## Before you change anything

1. Take a Supabase backup (Dashboard → Database → Backups, or `pg_dump`), and
   re-confirm `SELECT COUNT(*) FROM "AuthUsers"` returns ~2,854.
2. Decide what to do with the two accounts that exist only in the wrong DB:
   - `ADM-MSOP6VG6BVL4` (`austwise59@gmail.com`) — already in Supabase; ignore.
   - `STU-MWNCWYC5DDTH` ("Mubasshir mehedi", `20230204026@aust.edu`) — check
     Supabase. If absent, copy its `data` JSON into `AuthUsers`, or ask the user
     to re-register (its password hash lives only in the old DB).

## Cutover

1. In the **Render dashboard**, set `DATABASE_URL` to the Supabase pooler
   connection string:
   `postgresql://postgres.<ref>:<pwd>@<region>.pooler.supabase.com:6543/postgres`
   Dashboard values override the blueprint, so editing `render.yaml` alone is
   not enough. Keep `PG_POOL_MAX=5` (default) to respect Supabase limits.
2. Set `EXPECTED_MIN_USERS=2000` in the Render dashboard. This makes
   `/healthz/db` + `/healthz/data` return `503` and blocks default-admin
   seeding if `AuthUsers` is below the baseline.
3. Set `SKIP_AWID_BACKFILL=1` for the **first boot** after repointing, so the
   AWID backfill does not rewrite all 2,854 rows. Unset it once a sample of
   rows has the expected `STU-CSE-AW...` / `FAC-...-AW...` AWIDs.
4. Redeploy/restart the Render service.

## Verify after restart

```bash
curl -s https://austwise.onrender.com/healthz        # {"ok":true,...}
curl -s https://austwise.onrender.com/healthz/db     # host = Supabase, users ≈ 2854, 200
curl -s https://austwise.onrender.com/healthz/data   # same, no credentials exposed
curl -s https://austwise.onrender.com/api/stats/count     # count ≈ 2854
curl -s https://austwise.onrender.com/api/presence/members # real members visible
```

Then log in with a known real account and check one profile edit persists.

## Rollback

If anything looks wrong, restore the previous `DATABASE_URL` in the Render
dashboard and restart. Supabase was never modified by this cutover, so
restoring the env var returns the service to its prior state.
