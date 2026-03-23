/**
 * Neon Database Client for AegisDesk
 * Uses @neondatabase/serverless for serverless PostgreSQL
 */

import { neon } from '@neondatabase/serverless';

// Use NEON_DATABASE_URL if available, fallback to DATABASE_URL
const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";

if (!databaseUrl) {
  console.warn('DATABASE_URL environment variable is not set. Database features will be unavailable.');
}

export const sql = databaseUrl ? neon(databaseUrl) : null;
