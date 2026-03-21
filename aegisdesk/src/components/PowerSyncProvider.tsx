"use client";

import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { db as powerSyncDb, initializePowerSync, disconnectPowerSync, AegisSchema } from "@/lib/powersync/database";
import { connector } from "@/lib/powersync/connector";

// Types for context
interface PowerSyncContextType {
  db: typeof powerSyncDb | null;
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
  status: PowerSyncStatus | null;
}

// PowerSync status type
interface PowerSyncStatus {
  connected: boolean;
  connecting: boolean;
  uploading: boolean;
  downloading: boolean;
  uploadProgress: number;
  downloadProgress: number;
}

// Create context
const PowerSyncContext = createContext<PowerSyncContextType>({
  db: null,
  isConnected: false,
  isLoading: true,
  error: null,
  status: null,
});

// Hook to use PowerSync context
export function usePowerSync() {
  return useContext(PowerSyncContext);
}

// Hook to get real sync status from PowerSync
export function useSyncStatus() {
  const { status, isConnected } = usePowerSync();
  
  return {
    connected: status?.connected || isConnected || false,
    connecting: status?.connecting || false,
    uploading: status?.uploading || false,
    downloading: status?.downloading || false,
    uploadProgress: status?.uploadProgress || 0,
    downloadProgress: status?.downloadProgress || 0,
    hasSynced: status?.connected || isConnected,
  };
}

// Provider props
interface PowerSyncProviderProps {
  children: ReactNode;
}

/**
 * PowerSync Provider Component
 * Initializes PowerSync and provides database context to children
 * This enables REAL offline-first functionality
 */
export function PowerSyncProvider({ children }: PowerSyncProviderProps) {
  const [db, setDb] = useState<typeof powerSyncDb | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [status, setStatus] = useState<PowerSyncStatus | null>(null);

  useEffect(() => {
    // Initialize PowerSync on mount with timeout
    const init = async () => {
      try {
        console.log("[PowerSyncProvider] Initializing PowerSync...");
        
        // Use the global database instance
        setDb(powerSyncDb);
        
        // Initialize connection to PowerSync Cloud with timeout
        const connectPromise = initializePowerSync();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("PowerSync connection timeout")), 3000)
        );
        
        try {
          await Promise.race([connectPromise, timeoutPromise]);
          setIsConnected(true);
          console.log("[PowerSyncProvider] PowerSync initialized successfully");
        } catch (connError) {
          // Continue without PowerSync - use Neon directly
          console.warn("[PowerSyncProvider] PowerSync connection failed, continuing without it:", connError);
          setIsConnected(false);
        }
      } catch (err) {
        console.error("[PowerSyncProvider] Failed to initialize PowerSync:", err);
        setError(err instanceof Error ? err : new Error("PowerSync initialization failed"));
        setIsConnected(false);
      } finally {
        setIsLoading(false);
      }
    };

    init();

    // Poll for status updates
    const statusInterval = setInterval(async () => {
      if (powerSyncDb) {
        try {
          // Use connector's credentials to check connection status
          const creds = await connector.fetchCredentials();
          setStatus({
            connected: isConnected,
            connecting: !isConnected && !error,
            uploading: false,
            downloading: false,
            uploadProgress: 0,
            downloadProgress: 0,
          });
        } catch (e) {
          // Status might not be available yet
        }
      }
    }, 2000);

    // Cleanup on unmount
    return () => {
      clearInterval(statusInterval);
      disconnectPowerSync().catch(console.error);
    };
  }, [isConnected, error]);

  const value: PowerSyncContextType = {
    db,
    isConnected,
    isLoading,
    error,
    status,
  };

  return (
    <PowerSyncContext.Provider value={value}>
      {children}
    </PowerSyncContext.Provider>
  );
}

// Types for data operations
export interface Incident {
  id: string;
  title: string;
  severity: number;
  status: string;
  description?: string;
  affected_services?: string;
  root_cause?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface TimelineEvent {
  id: string;
  incident_id: string;
  actor: string;
  actor_type: string;
  event_type: string;
  message: string;
  details?: string;
  timestamp: string;
}

export interface Agent {
  id: string;
  name: string;
  specialty: string;
  status: string;
  current_task?: string;
  progress?: number;
  last_heartbeat?: string;
  capabilities?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  message: string;
  read: number;
  created_at: string;
}

/**
 * Custom hook for incident operations with real PowerSync
 */
export function useIncidents() {
  const { db, isConnected } = usePowerSync();
  
  const createIncident = async (incident: Omit<Incident, "id" | "created_at" | "updated_at">) => {
    const id = `INC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    
    const newIncident: Incident = {
      ...incident,
      id,
      status: incident.status || "Active",
      created_at: now,
      updated_at: now,
    };
    
    if (db) {
      // Write to local SQLite - this is instant and works offline
      await db.execute(
        `INSERT INTO incidents (id, title, severity, status, description, affected_services, root_cause, created_at, updated_at, created_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newIncident.id,
          newIncident.title,
          newIncident.severity,
          newIncident.status,
          newIncident.description || "",
          newIncident.affected_services || "",
          newIncident.root_cause || "",
          newIncident.created_at,
          newIncident.updated_at,
          newIncident.created_by || "",
        ]
      );
      console.log("[useIncidents] Created incident locally:", id);
    }
    
    return newIncident;
  };

  const getIncidents = async (): Promise<Incident[]> => {
    if (db) {
      // Read from local SQLite - this is instant (0ms) and works offline
      const result = await db.getAll<Incident>(
        "SELECT * FROM incidents ORDER BY created_at DESC"
      );
      return result;
    }
    return [];
  };

  const getIncident = async (id: string): Promise<Incident | null> => {
    if (db) {
      const result = await db.getAll<Incident>(
        "SELECT * FROM incidents WHERE id = ?",
        [id]
      );
      return result.length > 0 ? result[0] : null;
    }
    return null;
  };

  const updateIncident = async (id: string, data: Partial<Incident>) => {
    if (db) {
      const updates: string[] = [];
      const values: unknown[] = [];
      
      if (data.title !== undefined) {
        updates.push("title = ?");
        values.push(data.title);
      }
      if (data.severity !== undefined) {
        updates.push("severity = ?");
        values.push(data.severity);
      }
      if (data.status !== undefined) {
        updates.push("status = ?");
        values.push(data.status);
      }
      if (data.description !== undefined) {
        updates.push("description = ?");
        values.push(data.description);
      }
      if (data.affected_services !== undefined) {
        updates.push("affected_services = ?");
        values.push(data.affected_services);
      }
      if (data.root_cause !== undefined) {
        updates.push("root_cause = ?");
        values.push(data.root_cause);
      }
      
      updates.push("updated_at = ?");
      values.push(new Date().toISOString());
      values.push(id);
      
      await db.execute(
        `UPDATE incidents SET ${updates.join(", ")} WHERE id = ?`,
        values
      );
    }
  };

  return {
    createIncident,
    getIncidents,
    getIncident,
    updateIncident,
    isConnected,
  };
}

/**
 * Custom hook for timeline operations
 */
export function useTimeline() {
  const { db } = usePowerSync();

  const addEvent = async (event: Omit<TimelineEvent, "id" | "timestamp">) => {
    const id = `tl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();
    
    const newEvent: TimelineEvent = {
      ...event,
      id,
      timestamp,
    };

    if (db) {
      await db.execute(
        `INSERT INTO timelineEvents (id, incident_id, actor, actor_type, event_type, message, details, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newEvent.id,
          newEvent.incident_id,
          newEvent.actor,
          newEvent.actor_type,
          newEvent.event_type,
          newEvent.message,
          newEvent.details || "",
          newEvent.timestamp,
        ]
      );
    }

    return newEvent;
  };

  const getEvents = async (incidentId?: string): Promise<TimelineEvent[]> => {
    if (db) {
      let query = "SELECT * FROM timelineEvents";
      const params: string[] = [];
      
      if (incidentId) {
        query += " WHERE incident_id = ?";
        params.push(incidentId);
      }
      
      query += " ORDER BY timestamp DESC";
      
      const result = await db.getAll<TimelineEvent>(query, params);
      return result;
    }
    return [];
  };

  return {
    addEvent,
    getEvents,
  };
}

/**
 * Custom hook for agent operations
 */
export function useAgents() {
  const { db } = usePowerSync();

  const getAgents = async (): Promise<Agent[]> => {
    if (db) {
      const result = await db.getAll<Agent>(
        "SELECT * FROM agents ORDER BY last_heartbeat DESC"
      );
      return result;
    }
    return [];
  };

  const updateAgent = async (id: string, data: Partial<Agent>) => {
    if (db) {
      const updates: string[] = [];
      const values: unknown[] = [];
      
      if (data.name !== undefined) {
        updates.push("name = ?");
        values.push(data.name);
      }
      if (data.status !== undefined) {
        updates.push("status = ?");
        values.push(data.status);
      }
      if (data.current_task !== undefined) {
        updates.push("current_task = ?");
        values.push(data.current_task);
      }
      if (data.progress !== undefined) {
        updates.push("progress = ?");
        values.push(data.progress);
      }
      if (data.last_heartbeat !== undefined) {
        updates.push("last_heartbeat = ?");
        values.push(data.last_heartbeat);
      }
      
      values.push(id);
      
      await db.execute(
        `UPDATE agents SET ${updates.join(", ")} WHERE id = ?`,
        values
      );
    }
  };

  return {
    getAgents,
    updateAgent,
  };
}

/**
 * Custom hook for notifications
 */
export function useNotifications() {
  const { db } = usePowerSync();

  const getNotifications = async (): Promise<Notification[]> => {
    if (db) {
      const result = await db.getAll<Notification>(
        "SELECT * FROM notifications ORDER BY created_at DESC"
      );
      return result;
    }
    return [];
  };

  const markRead = async (id: string) => {
    if (db) {
      await db.execute(
        "UPDATE notifications SET read = 1 WHERE id = ?",
        [id]
      );
    }
  };

  return {
    getNotifications,
    markRead,
  };
}

/**
 * Sync status indicator component
 * Shows real PowerSync sync status
 */
export function SyncStatusIndicator() {
  const { isConnected } = usePowerSync();
  const status = useSyncStatus();
  
  let label = "Synced";
  let className = "sync-pill online";
  
  if (!status.connected) {
    label = "Offline";
    className = "sync-pill offline";
  } else if (status.uploading || status.downloading) {
    label = "Syncing...";
    className = "sync-pill syncing";
  }
  
  return (
    <div className={className} id="syncPill">
      <span className="sdot"></span>
      <span>{label}</span>
    </div>
  );
}
