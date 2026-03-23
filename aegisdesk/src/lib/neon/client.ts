/**
 * Neon Database Client for AegisDesk
 * Serverless PostgreSQL for the hackathon prize
 * 
 * Use Neon as your backend DB to qualify for the Best Submission Using Neon prize
 */

import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

// Get database URL dynamically - re-reads env each time to pick up changes
function getDatabaseUrl(): string {
  return process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";
}

// Create a cached neon client - lazily initialized
let cachedClient: NeonQueryFunction<false, false> | null = null;
let cachedUrl: string = "";

function getNeonClient(): NeonQueryFunction<false, false> | null {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  // Re-create client if URL changed (useful during development)
  if (!cachedClient || cachedUrl !== databaseUrl) {
    console.log("[Neon] Creating new database client...");
    cachedClient = neon(databaseUrl);
    cachedUrl = databaseUrl;
  }

  return cachedClient;
}

// Check if Neon is configured
export const isNeonConfigured = (): boolean => {
  const databaseUrl = getDatabaseUrl();
  return databaseUrl !== "";
};

// Export the SQL function - gets fresh client on each call
// This ensures we always use the latest DATABASE_URL from environment
// Default to Record<string, any> for easier property access
export function sql<T = Record<string, any>>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]> {
  const client = getNeonClient();
  if (!client) {
    throw new Error("[Neon] Database URL not configured! Set DATABASE_URL in .env");
  }
  return client(strings, ...values) as Promise<T[]>;
}

