import { config } from 'dotenv';

// Neon writes .env.local when .env does not already exist. Explicit process
// environment takes precedence, including test and deployment overrides.
config({ path: ['.env.local', '.env'], quiet: true });

// Keep Neon TLS hostname/certificate verification explicit across pg versions.
export function connectionString(value: string) {
  const url = new URL(value);
  if (url.hostname.endsWith('.neon.tech')) {
    url.searchParams.set('sslmode', 'verify-full');
  }
  return url.toString();
}

export function databaseUrl() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error('DATABASE_URL env var required');
  return connectionString(value);
}

export function migrationDatabaseUrl() {
  const value = process.env.DATABASE_URL_UNPOOLED ?? databaseUrl();
  if (new URL(value).hostname.includes('-pooler')) {
    throw new Error('Migrations require a direct connection: set DATABASE_URL_UNPOOLED');
  }
  return connectionString(value);
}
