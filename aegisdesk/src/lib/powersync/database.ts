/**
 * PowerSync Database for AegisDesk
 * Handles local SQLite operations with PowerSync
 * This is the REAL PowerSync implementation for offline-first functionality
 */

"use client";

import { PowerSyncDatabase } from "@powersync/web";
import { AegisSchema } from "./schema";
import { AegisConnector } from "./connector";

// Export schema for use throughout the app
export { AegisSchema };

// Create the PowerSync database instance
export const db = new PowerSyncDatabase({
  schema: AegisSchema,
  database: {
    dbFilename: "aegisdesk.db",
  },
});

// Create and connect the connector
export const connector = new AegisConnector();

// Initialize and connect to PowerSync Cloud
export async function initializePowerSync() {
  try {
    console.log("[PowerSync] Connecting to PowerSync Cloud...");
    await db.connect(connector);
    console.log("[PowerSync] Successfully connected to PowerSync Cloud");
    return db;
  } catch (error) {
    console.error("[PowerSync] Failed to connect:", error);
    throw error;
  }
}

/**
 * Disconnect from PowerSync
 */
export async function disconnectPowerSync() {
  try {
    await db.disconnect();
    console.log("[PowerSync] Disconnected from PowerSync");
  } catch (error) {
    console.error("[PowerSync] Error disconnecting:", error);
  }
}

/**
 * Execute a SQL query on local SQLite
 */
export async function execute(sql: string, params?: unknown[]) {
  return await db.execute(sql, params);
}

/**
 * Get all records from a table
 */
export async function getAll<T>(sql: string, params?: unknown[]): Promise<T[]> {
  const result = await db.getAll<T>(sql, params);
  return result;
}

/**
 * Get a single record by ID
 */
export async function getById<T>(table: string, id: string): Promise<T | null> {
  const result = await db.getAll<T>(`SELECT * FROM ${table} WHERE id = ?`, [id]);
  return result.length > 0 ? result[0] : null;
}

/**
 * Insert a record
 */
export async function insert(table: string, data: Record<string, unknown>) {
  const columns = Object.keys(data).join(", ");
  const placeholders = Object.keys(data).map(() => "?").join(", ");
  const values = Object.values(data);
  
  await db.execute(
    `INSERT INTO ${table} (${columns}) VALUES (${placeholders})`,
    values
  );
}

/**
 * Update a record
 */
export async function update(
  table: string,
  id: string,
  data: Record<string, unknown>
) {
  const setClause = Object.keys(data)
    .map((key) => `${key} = ?`)
    .join(", ");
  const values = [...Object.values(data), id];

  await db.execute(`UPDATE ${table} SET ${setClause} WHERE id = ?`, values);
}

/**
 * Delete a record
 */
export async function remove(table: string, id: string) {
  await db.execute(`DELETE FROM ${table} WHERE id = ?`, [id]);
}

// Export the database instance for direct access
export { db as powerSyncDb };
