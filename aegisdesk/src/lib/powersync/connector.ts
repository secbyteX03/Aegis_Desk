/**
 * PowerSync Connector for AegisDesk
 * Implements PowerSyncBackendConnector interface for real offline-first functionality
 * 
 * Architecture:
 * - PowerSync connects to Neon (PostgreSQL) for database sync (PRIMARY)
 * - Mastra provides AI agents with Google Gemini
 * - Supabase deprecated - only for legacy auth fallback
 */

import {
  AbstractPowerSyncDatabase,
  PowerSyncBackendConnector,
  UpdateType,
} from "@powersync/web";

// Get configuration from environment variables
const DATABASE_URL = process.env.DATABASE_URL || process.env.NEON_DATABASE_URL || "";

/**
 * PowerSync Connector Implementation
 * Connects to PowerSync backend and handles data synchronization
 * This bridges local SQLite to Neon (PostgreSQL)
 */
export class AegisConnector implements PowerSyncBackendConnector {
  /**
   * Fetch credentials for PowerSync Cloud
   * This is called by PowerSync to get authentication token
   */
  async fetchCredentials() {
    try {
      // Get current user from localStorage if available
      let userId = "demo-user-001";
      if (typeof window !== "undefined") {
        try {
          const storedUser = localStorage.getItem("aegis_user");
          if (storedUser) {
            const user = JSON.parse(storedUser);
            if (user?.id) {
              userId = user.id;
            }
          }
        } catch (e) {
          console.log("[PowerSync] Could not get user from localStorage");
        }
      }

      const response = await fetch("/api/auth/token", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": userId,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch credentials: ${response.statusText}`);
      }

      const data = await response.json();

      return {
        endpoint: data.powersync_url || "https://your-instance.powersync.journeyapps.com",
        token: data.token,
      };
    } catch (error) {
      console.error("[PowerSync Connector] Error fetching credentials:", error);
      // Return fallback credentials for development
      return {
        endpoint: process.env.NEXT_PUBLIC_POWERSYNC_URL || "https://69b02e9f549ff47bf1e3fbb7.powersync.journeyapps.com",
        token: process.env.POWERSYNC_TOKEN || "dev-token",
      };
    }
  }

  /**
   * Upload local changes to the backend (Neon PostgreSQL)
   * This is called when the device is online and has queued changes
   * CRITICAL: This is what makes offline work - writes go to local SQLite first,
   * then PowerSync calls this to sync them when online
   */
  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const transaction = await database.getNextCrudTransaction();

    if (!transaction) {
      return;
    }

    try {
      // Process each operation in the transaction
      for (const op of transaction.crud) {
        const record = { ...op.opData, id: op.id };

        if (op.op === UpdateType.PUT || op.op === UpdateType.PATCH) {
          // Upsert to Neon via our sync API
          await this.handleUpsert(op.table, record);
        } else if (op.op === UpdateType.DELETE) {
          // Delete from Neon
          await this.handleDelete(op.table, op.id);
        }
      }

      // Mark transaction as complete - PowerSync won't retry these operations
      await transaction.complete();
      console.log("[PowerSync Connector] Successfully uploaded batch to Neon PostgreSQL");
    } catch (error) {
      console.error("[PowerSync Connector] Error uploading data to Neon:", error);
      // If this fails (offline), PowerSync will retry automatically
      // The data is safe in local SQLite
      throw error;
    }
  }

  /**
   * Handle upsert operations (INSERT or UPDATE)
   * Sends to sync API which writes to Neon PostgreSQL
   */
  private async handleUpsert(table: string, record: Record<string, unknown>): Promise<void> {
    // Use our sync API which writes to Neon PostgreSQL (primary database)
    const response = await fetch(`/api/sync/${table}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(record),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[PowerSync Connector] Upsert failed for ${table}:`, error);
      throw new Error(`Upsert failed: ${error}`);
    }
  }

  /**
   * Handle delete operations
   */
  private async handleDelete(table: string, id: string): Promise<void> {
    const response = await fetch(`/api/sync/${table}?id=${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`[PowerSync Connector] Delete failed for ${table}:`, error);
      throw new Error(`Delete failed: ${error}`);
    }
  }
}

// Export singleton instance
export const connector = new AegisConnector();
