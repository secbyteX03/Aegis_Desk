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
        },
        {
            name: "Add name to team_members",
            sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS name TEXT`
        },
        {
            name: "Add user_id to team_members",
            sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS user_id TEXT`
        },
        {
            name: "Add organization_id to team_members",
            sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS organization_id TEXT`
        },
        {
            name: "Add status to team_members",
            sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending'`
        },
        {
            name: "Add joined_at to team_members",
            sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS joined_at TIMESTAMP WITH TIME ZONE`
        },
        {
            name: "Add full_name to team_members",
            sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS full_name TEXT`
        },
        {
            name: "Add role to team_members",
            sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'member'`
        },
        {
            name: "Add invited_by to team_members",
            sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invited_by TEXT`
        },
        {
            name: "Add invited_at to team_members",
            sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS invited_at TIMESTAMP WITH TIME ZONE`
        },
        {
            name: "Add confirmed_at to team_members",
            sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE`
        },
        {
            name: "Add created_at to team_members",
            sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
        },
        {
            name: "Add updated_at to team_members",
            sql: `ALTER TABLE team_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()`
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
