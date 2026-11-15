import pg from 'pg';
import fs from 'fs';
const env = fs.readFileSync('.env','utf8');
for (const line of env.split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
}
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
const r = await c.query(`SELECT email, (data::jsonb)->>'name' AS name, (data::jsonb)->>'role' AS role, (data::jsonb)->>'roles' AS roles, (data::jsonb)->>'semester' AS semester, (data::jsonb)->>'yearSemester' AS year_semester FROM "AuthUsers" WHERE (data::jsonb)->>'name' ILIKE '%Rafi CSE AA2%' LIMIT 10`);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
