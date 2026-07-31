import 'dotenv/config';
import { defineConfig } from '@prisma/config';

export default defineConfig({
  schema: 'server/prisma/schema.prisma',
  migrations: {
    seed: 'node dev/seed-data.mjs',
  },
  datasource: {
    // Prisma CLI uses the direct Neon connection for migrations when provided.
    // Runtime Prisma queries use DATABASE_URL in server/prisma.js.
    url: process.env.DIRECT_URL || process.env.DATABASE_URL,
  },
});
