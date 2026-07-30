import { defineConfig } from '@prisma/config';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL || 'sqlserver://localhost:1433;database=austwise;integratedSecurity=true;encrypt=true;trustServerCertificate=true',
  },
});
