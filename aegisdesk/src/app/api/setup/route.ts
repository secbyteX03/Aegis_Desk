import { NextRequest, NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Not available in production" }, { status: 403 });
    }

    // Check for secret key in query param or header to prevent unauthorized access
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

    // Read the schema file
    const schemaPath = path.join(process.cwd(), "database/neon-auth-schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf-8");

    // Split by semicolons and newlines to get individual statements
    const statements = schema
        .split(/;\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith("--"));

    const results: { success: number; errors: string[] } = { success: 0, errors: [] };

    for (const statement of statements) {
        try {
            // Use raw text execution
            await sql(statement);
            results.success++;
        } catch (error: any) {
            // Ignore duplicate key errors for tables that already exist
            if (error.message && (
                error.message.includes("duplicate key") ||
                error.message.includes("already exists")
            )) {
                console.log("Skipping (already exists):", statement.substring(0, 50));
            } else {
                results.errors.push(`${error.message?.substring(0, 100)}: ${statement.substring(0, 50)}`);
            }
        }
    }

    // Add organization_id columns to existing tables (migration)
    const migrationStatements = [
        `ALTER TABLE incidents ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE`,
        `ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS organization_id TEXT REFERENCES organizations(id) ON DELETE CASCADE`
    ];

    for (const migStatement of migrationStatements) {
        try {
            await sql(migStatement);
            console.log("Migration executed:", migStatement.substring(0, 50));
        } catch (error: any) {
            if (error.message && (
                error.message.includes("duplicate") ||
                error.message.includes("already exists")
            )) {
                console.log("Skipping migration (column exists):", migStatement.substring(0, 50));
            } else {
                results.errors.push(`Migration error: ${error.message?.substring(0, 100)}`);
            }
        }
    }

    // Verify tables
    try {
        const tables = await sql`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;

        return NextResponse.json({
            message: "Schema setup complete",
            statementsExecuted: results.success,
            errors: results.errors,
            tables: tables.map(t => t.table_name)
        });
    } catch (error: any) {
        return NextResponse.json({
            message: "Schema partially complete",
            statementsExecuted: results.success,
            errors: results.errors,
            verificationError: error.message
        }, { status: 500 });
    }
}
