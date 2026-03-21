const { neon } = require("@neondatabase/serverless");
const fs = require("fs");
const path = require("path");

const DATABASE_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!DATABASE_URL) {
    console.error("Error: DATABASE_URL or NEON_DATABASE_URL environment variable not set");
    process.exit(1);
}

console.log("Connecting to Neon database...");
const sql = neon(DATABASE_URL);

const schemaPath = path.join(__dirname, "../database/neon-auth-schema.sql");
console.log("Reading schema from:", schemaPath);

const schema = fs.readFileSync(schemaPath, "utf-8");

// Split by semicolons to get individual statements
const statements = schema.split(';').filter(s => s.trim().length > 0);

async function runSchema() {
    console.log(`Executing ${statements.length} SQL statements...`);

    let successCount = 0;
    let errorCount = 0;

    for (const statement of statements) {
        const trimmedStmt = statement.trim();
        if (trimmedStmt.length === 0) continue;

        try {
            await sql`${trimmedStmt}`;
            successCount++;
        } catch (error) {
            // Ignore duplicate key errors if tables already exist
            if (error.message && error.message.includes("duplicate key")) {
                console.log("  Table already exists, skipping...");
            } else {
                console.error("  Error:", error.message.substring(0, 100));
                errorCount++;
            }
        }
    }

    console.log(`\nSchema setup complete: ${successCount} succeeded, ${errorCount} errors`);

    // Verify tables were created
    console.log("\nVerifying tables...");
    try {
        const tables = await sql`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;
        console.log("Tables found:", tables.map(t => t.table_name).join(", "));
    } catch (error) {
        console.error("Error verifying tables:", error.message);
    }

    process.exit(errorCount > 0 ? 1 : 0);
}

runSchema().catch(err => {
    console.error("Fatal error:", err);
    process.exit(1);
});
