/**
 * Reusable auth middleware — reads JWT from HttpOnly cookie and checks roles.
 *
 * Usage inside an endpoint handler:
 *   import { requireRole } from './middleware.mjs';
 *   // ...
 *   const user = requireRole('admin', 'moderator')(req, res);
 *   if (!user) return; // 401 or 403 already sent
 *   // user object has { id, role, email } — use it in the handler
 *
 * ── curl test (non-admin user) ──
 * # 1. Login as a regular student first to get the cookie:
 * #    curl -c cookies.txt -X POST http://localhost:5174/api/auth/login \
 * #      -H "Content-Type: application/json" \
 * #      -d '{"email":"student@aust.edu","password":"mypassword"}'
 * #
 * # 2. Hit an admin-only endpoint using the stored cookie:
 * #    curl -b cookies.txt http://localhost:5174/api/telegram/users
 * #
 * # → HTTP 403 {"success":false,"error":"Forbidden: admin or moderator role required."}
 *
 * # 3. Admin succeeds:
 * #    curl -c admin-cookies.txt -X POST http://localhost:5174/api/auth/login \
 * #      -H "Content-Type: application/json" \
 * #      -d '{"email":"austwise59@gmail.com","password":"<admin password>"}'
 * #    curl -b admin-cookies.txt http://localhost:5174/api/telegram/users
 * #
 * # → HTTP 200 {"success":true,"stats":{...},"users":[...]}
 */

import { readTokenCookie } from './auth.mjs';

/**
 * Factory returning a middleware function that:
 *  1. Extracts the user from the JWT cookie
 *  2. Returns 401 if no valid token
 *  3. Returns 403 if the user's role is not in `...allowedRoles`
 *  4. Returns the decoded payload on success
 *
 * @param  {...string} allowedRoles  e.g. 'admin', 'moderator'
 * @returns {(req, res) => object|null}
 */
export function requireRole(...allowedRoles) {
  return (req, res) => {
    const payload = readTokenCookie(req);
    if (!payload) {
      res.writeHead(401, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(JSON.stringify({ success: false, error: 'Authentication required.' }));
      return null;
    }
    if (!allowedRoles.includes(payload.role)) {
      res.writeHead(403, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      const roles = allowedRoles.join(' or ');
      res.end(JSON.stringify({ success: false, error: `Forbidden: ${roles} role required.` }));
      return null;
    }
    return payload;
  };
}
