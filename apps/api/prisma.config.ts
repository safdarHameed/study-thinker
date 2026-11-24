import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    // Read lazily so `prisma generate` works without a database (e.g. in Docker builds).
    url: process.env.DATABASE_URL ?? '',
    // Only needed for `prisma migrate diff --from-migrations` (the CI drift check).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL || undefined,
  },
});
