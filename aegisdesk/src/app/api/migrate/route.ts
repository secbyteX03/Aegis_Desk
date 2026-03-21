import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

// Create a controller for timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
        )
    ]);
}

/**
 * Simple migration endpoint to add organization_id columns
 * Run this once to add the columns to existing tables
 */
export async function GET(request: NextRequest) {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not available in production" }, { status: 403 });
    }

    // Check for secret key in query param or header
    const authParam = request.nextUrl.searchParams.get("auth");
    const authHeader = request.headers.get("authorization");
    if (authParam !== "setup-secret" && authHeader !== "Bearer setup-secret") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

    if (!DATABASE_URL) {
        return NextResponse.json({ error: "DATABASE_URL not configured" }, { status: 500 });
    }

    const sql = neon(DATABASE_URL);
    const TIMEOUT_MS = 10000; // 10 second timeout
    const results: { success: string[]; errors: string[] } = { success: [], errors: [] };

    // Migration statements
    const migrations = [
        {
            name: "Add organization_id to incidents",
            sql: `ALTER TABLE incidents ADD COLUMN IF NOT EXISTS organization_id TEXT`
        },
        {
            name: "Add organization_id to timeline_events",
            sql: `ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS organization_id TEXT`
        }
    ];

    for (const migration of migrations) {
        try {
            console.log(`[Migration] Running: ${migration.name}`);
            // Use timeout to prevent hanging
            await withTimeout(sql(migration.sql), TIMEOUT_MS);
            results.success.push(migration.name);
            console.log(`[Migration] Success: ${migration.name}`);
        } catch (error: any) {
            const errorMsg = error.message || String(error);
            if (errorMsg.includes("duplicate") || errorMsg.includes("already exists")) {
                results.success.push(`${migration.name} (already exists)`);
            } else {
                results.errors.push(`${migration.name}: ${errorMsg.substring(0, 200)}`);
            }
        }
    }

    return NextResponse.json({
        message: "Migration complete",
        results
    });
}
