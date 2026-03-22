"use client";

import { useState, useEffect, useRef } from "react";

// Agent configuration with color-coded badges and icons
interface AgentConfig {
    id: string;
    name: string;
    color: string;
    badgeColor: string;
    icon: React.ReactNode;
    specialty: string;
}

const AGENT_CONFIGS: AgentConfig[] = [
    {
        id: "triage7",
        name: "Triage-7",
        color: "#f59e0b",
        badgeColor: "rgba(245, 158, 11, 0.2)",
        specialty: "Log Analysis",
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
            </svg>
        ),
    },
    {
        id: "remedy3",
        name: "Remedy-3",
        color: "#3b82f6",
        badgeColor: "rgba(59, 130, 246, 0.2)",
        specialty: "Runbook Exec",
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
            </svg>
        ),
    },
    {
        id: "comms1",
        name: "Comms-1",
        color: "#22c55e",
        badgeColor: "rgba(34, 197, 94, 0.2)",
        specialty: "Status Updates",
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
        ),
    },
    {
        id: "postmort2",
        name: "PostMort-2",
        color: "#a855f7",
        badgeColor: "rgba(168, 85, 247, 0.2)",
        specialty: "Post-Mortem",
        icon: (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
            </svg>
        ),
    },
];

// Timeline event types
interface TimelineEvent {
    id: string;
    agentId: string;
    agentName: string;
    message: string;
    timestamp: string;
    type: "info" | "action" | "warning" | "success" | "error" | "thinking" | "pending";
    details?: string;
    requiresApproval?: boolean;
    approvalStatus?: "pending" | "approved" | "rejected";
    isOffline?: boolean;
}

// Sync queue item
interface SyncQueueItem {
    id: string;
    operation: string;
    tableName: string;
    recordId: string;
    createdAt: string;
    status: "pending" | "syncing" | "synced" | "failed";
}

interface AgentTimelineProps {
    events?: TimelineEvent[];
    onApprove?: (eventId: string) => void;
    onReject?: (eventId: string) => void;
    isOffline?: boolean;
    lastSyncTime?: Date;
    activeAgents?: string[];
}

// Helper to format relative time
function formatRelativeTime(date: Date | string): string {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);

    if (diffSec < 5) return "Just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    return then.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// Loading spinner component
function LoadingSpinner() {
    return (
        <span style={{ display: "inline-block", marginLeft: "4px" }}>
            <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                style={{ animation: "spin 1s linear infinite" }}
            >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
        </span>
    );
}

// Agent badge component
function AgentBadge({ agentId, isThinking = false }: { agentId: string; isThinking?: boolean }) {
    const config = AGENT_CONFIGS.find((a) => a.id === agentId);
    if (!config) return null;

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "2px 6px",
                borderRadius: "4px",
                background: config.badgeColor,
                color: config.color,
                fontSize: "10px",
                fontWeight: "600",
                border: `1px solid ${config.color}40`,
                animation: isThinking ? "pulse 1.5s infinite" : "none",
            }}
        >
            {config.icon}
            {config.name}
            {isThinking && <LoadingSpinner />}
        </span>
    );
}

// Offline indicator
function OfflineIndicator() {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                padding: "1px 5px",
                borderRadius: "3px",
                background: "rgba(148, 163, 184, 0.2)",
                color: "#94a3b8",
                fontSize: "9px",
                fontWeight: "500",
            }}
            title="Operation queued offline"
        >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
            </svg>
            PENDING
        </span>
    );
}

// Sync status indicator
function SyncStatusBadge({ status }: { status: "pending" | "syncing" | "synced" | "failed" }) {
    const config = {
        pending: { color: "#94a3b8", bg: "rgba(148, 163, 184, 0.2)", icon: "⏳" },
        syncing: { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.2)", icon: "↻" },
        synced: { color: "#22c55e", bg: "rgba(34, 197, 94, 0.2)", icon: "✓" },
        failed: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.2)", icon: "✕" },
    };

    const c = config[status];

    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
                padding: "1px 5px",
                borderRadius: "3px",
                background: c.bg,
                color: c.color,
                fontSize: "9px",
                fontWeight: "500",
            }}
        >
            {status === "syncing" && (
                <span style={{ animation: "spin 1s linear infinite" }}>{c.icon}</span>
            )}
            {status !== "syncing" && c.icon}
            {status.toUpperCase()}
        </span>
    );
}

// Action Card for human-in-the-loop
function ActionCard({
    event,
    onApprove,
    onReject,
}: {
    event: TimelineEvent;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
}) {
    const [isProcessing, setIsProcessing] = useState(false);

    const handleApprove = async () => {
        setIsProcessing(true);
        await onApprove(event.id);
        setIsProcessing(false);
    };

    const handleReject = async () => {
        setIsProcessing(true);
        await onReject(event.id);
        setIsProcessing(false);
    };

    if (event.approvalStatus === "approved") {
        return (
            <div
                style={{
                    background: "rgba(34, 197, 94, 0.1)",
                    border: "1px solid rgba(34, 197, 94, 0.3)",
                    borderRadius: "6px",
                    padding: "8px",
                    marginTop: "4px",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#22c55e", fontSize: "12px" }}>✓</span>
                    <span style={{ color: "#22c55e", fontSize: "11px", fontWeight: "500" }}>
                        Approved
                    </span>
                </div>
            </div>
        );
    }

    if (event.approvalStatus === "rejected") {
        return (
            <div
                style={{
                    background: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "6px",
                    padding: "8px",
                    marginTop: "4px",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ color: "#ef4444", fontSize: "12px" }}>✕</span>
                    <span style={{ color: "#ef4444", fontSize: "11px", fontWeight: "500" }}>
                        Rejected
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div
            style={{
                background: "rgba(59, 130, 246, 0.1)",
                border: "1px solid rgba(59, 130, 246, 0.3)",
                borderRadius: "6px",
                padding: "8px",
                marginTop: "4px",
            }}
        >
            <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "6px" }}>
                Requires approval to proceed
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
                <button
                    onClick={handleApprove}
                    disabled={isProcessing}
                    style={{
                        flex: 1,
                        padding: "4px 8px",
                        background: "#22c55e",
                        border: "none",
                        borderRadius: "4px",
                        color: "white",
                        fontSize: "10px",
                        fontWeight: "600",
                        cursor: isProcessing ? "not-allowed" : "pointer",
                        opacity: isProcessing ? 0.7 : 1,
                    }}
                >
                    {isProcessing ? "Processing..." : "APPROVE"}
                </button>
                <button
                    onClick={handleReject}
                    disabled={isProcessing}
                    style={{
                        flex: 1,
                        padding: "4px 8px",
                        background: "transparent",
                        border: "1px solid #ef4444",
                        borderRadius: "4px",
                        color: "#ef4444",
                        fontSize: "10px",
                        fontWeight: "600",
                        cursor: isProcessing ? "not-allowed" : "pointer",
                        opacity: isProcessing ? 0.7 : 1,
                    }}
                >
                    REJECT
                </button>
            </div>
        </div>
    );
}

// Timeline item component
function TimelineItem({
    event,
    onApprove,
    onReject,
}: {
    event: TimelineEvent;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
}) {
    const isThinking = event.type === "thinking";
    const hasActionCard = event.requiresApproval && event.approvalStatus !== "approved" && event.approvalStatus !== "rejected";

    return (
        <div
            style={{
                padding: "6px 0",
                borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                animation: isThinking ? "fadeIn 0.3s ease" : "none",
            }}
        >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                {/* Status dot */}
                <span
                    style={{
                        width: "6px",
                        height: "6px",
                        borderRadius: "50%",
                        marginTop: "4px",
                        background:
                            event.type === "thinking"
                                ? "#f59e0b"
                                : event.type === "success"
                                    ? "#22c55e"
                                    : event.type === "error"
                                        ? "#ef4444"
                                        : event.type === "warning"
                                            ? "#f59e0b"
                                            : event.type === "action"
                                                ? "#3b82f6"
                                                : "#94a3b8",
                        animation: isThinking ? "pulse 1s infinite" : "none",
                    }}
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Agent badge and message */}
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap" }}>
                        <AgentBadge agentId={event.agentId} isThinking={isThinking} />
                        <span
                            style={{
                                color: "#e2e8f0",
                                fontSize: "11px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            {event.message}
                        </span>
                    </div>

                    {/* Timestamp and offline indicator */}
                    <div
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            marginTop: "2px",
                        }}
                    >
                        <span style={{ color: "#64748b", fontSize: "9px" }}>
                            {formatRelativeTime(event.timestamp)}
                        </span>
                        {event.isOffline && <OfflineIndicator />}
                        {event.isOffline && event.details && (
                            <span style={{ color: "#64748b", fontSize: "9px" }}>{event.details}</span>
                        )}
                    </div>

                    {/* Action Card for approvals */}
                    {hasActionCard && (
                        <ActionCard event={event} onApprove={onApprove} onReject={onReject} />
                    )}
                </div>
            </div>
        </div>
    );
}

// Main AgentTimeline component
export default function AgentTimeline({
    events = [],
    onApprove = () => { },
    onReject = () => { },
    isOffline = false,
    lastSyncTime,
    activeAgents = [],
}: AgentTimelineProps) {
    const [internalEvents, setInternalEvents] = useState<TimelineEvent[]>(events);
    const [lastSync, setLastSync] = useState<Date>(lastSyncTime || new Date());
    const [isConnected, setIsConnected] = useState(!isOffline);
    const containerRef = useRef<HTMLDivElement>(null);

    // Update internal events when prop changes
    useEffect(() => {
        setInternalEvents(events);
    }, [events]);

    // Update last sync time
    useEffect(() => {
        if (lastSyncTime) {
            setLastSync(lastSyncTime);
        }
    }, [lastSyncTime]);

    // Simulate real-time updates for demo
    useEffect(() => {
        const demoEvents: TimelineEvent[] = [
            {
                id: "1",
                agentId: "triage7",
                agentName: "Triage-7",
                message: "Analyzed 847 error traces from log stream",
                timestamp: new Date(Date.now() - 1000 * 30).toISOString(),
                type: "info",
            },
            {
                id: "2",
                agentId: "remedy3",
                agentName: "Remedy-3",
                message: "Proposed server restart for database pods",
                timestamp: new Date(Date.now() - 1000 * 60).toISOString(),
                type: "action",
                requiresApproval: true,
                approvalStatus: "pending",
            },
            {
                id: "3",
                agentId: "comms1",
                agentName: "Comms-1",
                message: "Preparing stakeholder update for INC-001",
                timestamp: new Date(Date.now() - 1000 * 120).toISOString(),
                type: "info",
            },
            {
                id: "4",
                agentId: "postmort2",
                agentName: "PostMort-2",
                message: "Auto-generating post-mortem report",
                timestamp: new Date(Date.now() - 1000 * 180).toISOString(),
                type: "info",
            },
            {
                id: "5",
                agentId: "triage7",
                agentName: "Triage-7",
                message: "Identified root cause: TLS certificate expiry (94% confidence)",
                timestamp: new Date(Date.now() - 1000 * 240).toISOString(),
                type: "success",
            },
        ];

        if (events.length === 0) {
            setInternalEvents(demoEvents);
        }
    }, []);

    // Simulate "thinking" state for active agents
    useEffect(() => {
        if (activeAgents.includes("remedy3")) {
            const thinkingEvent: TimelineEvent = {
                id: "thinking-" + Date.now(),
                agentId: "remedy3",
                agentName: "Remedy-3",
                message: "Analyzing remediation options...",
                timestamp: new Date().toISOString(),
                type: "thinking",
            };
            setInternalEvents((prev) => [thinkingEvent, ...prev.filter((e) => e.type !== "thinking")]);
        }
    }, [activeAgents]);

    // Format last sync time
    const formatLastSync = () => {
        const diff = Date.now() - lastSync.getTime();
        if (diff < 5000) return "Just now";
        if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
        return lastSync.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    return (
        <div
            ref={containerRef}
            style={{
                background: "rgba(15, 15, 20, 0.95)",
                borderRadius: "8px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
                overflow: "hidden",
            }}
        >
            {/* Header with sync status */}
            <div
                style={{
                    padding: "10px 12px",
                    background: "linear-gradient(135deg, rgba(88, 166, 255, 0.15) 0%, rgba(88, 166, 255, 0.05) 100%)",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span
                        style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: isConnected ? "#22c55e" : "#ef4444",
                            animation: isConnected ? "pulse 2s infinite" : "none",
                        }}
                    />
                    <span style={{ color: "#e2e8f0", fontWeight: "600", fontSize: "12px" }}>
                        ⚡ PowerSync
                    </span>
                    <span style={{ color: "#64748b", fontSize: "10px" }}>
                        {isConnected ? "All systems operational" : "Reconnecting..."}
                    </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {isOffline && (
                        <span
                            style={{
                                padding: "2px 6px",
                                borderRadius: "4px",
                                background: "rgba(148, 163, 184, 0.2)",
                                color: "#94a3b8",
                                fontSize: "9px",
                                fontWeight: "500",
                            }}
                        >
                            OFFLINE MODE
                        </span>
                    )}
                    <span style={{ color: "#64748b", fontSize: "10px" }}>
                        Last Sync: {formatLastSync()}
                    </span>
                </div>
            </div>

            {/* Agent status row */}
            <div
                style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    gap: "8px",
                    flexWrap: "wrap",
                }}
            >
                {AGENT_CONFIGS.map((agent) => {
                    const isActive = activeAgents.includes(agent.id);
                    return (
                        <div
                            key={agent.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "3px 8px",
                                borderRadius: "4px",
                                background: isActive ? agent.badgeColor : "rgba(100, 116, 139, 0.2)",
                                border: `1px solid ${isActive ? agent.color + "40" : "transparent"}`,
                            }}
                        >
                            <span
                                style={{
                                    color: isActive ? agent.color : "#64748b",
                                    animation: isActive ? "pulse 1.5s infinite" : "none",
                                }}
                            >
                                {agent.icon}
                            </span>
                            <span
                                style={{
                                    fontSize: "10px",
                                    fontWeight: "500",
                                    color: isActive ? agent.color : "#64748b",
                                }}
                            >
                                {agent.name}
                            </span>
                            {isActive && (
                                <span style={{ color: agent.color, fontSize: "9px", marginLeft: "2px" }}>
                                    is thinking...
                                </span>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Timeline feed */}
            <div
                style={{
                    maxHeight: "240px",
                    overflowY: "auto",
                    padding: "8px 12px",
                }}
            >
                {internalEvents.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: "11px" }}>
                        No recent activity
                    </div>
                ) : (
                    internalEvents.slice(0, 8).map((event) => (
                        <TimelineItem
                            key={event.id}
                            event={event}
                            onApprove={onApprove}
                            onReject={onReject}
                        />
                    ))
                )}
            </div>

            {/* Stats footer */}
            <div
                style={{
                    padding: "8px 12px",
                    borderTop: "1px solid rgba(255, 255, 255, 0.05)",
                    display: "flex",
                    gap: "16px",
                    fontSize: "10px",
                    color: "#64748b",
                }}
            >
                <span>
                    <span style={{ color: "#22c55e" }}>●</span> {internalEvents.filter((e) => e.type === "success").length} completed
                </span>
                <span>
                    <span style={{ color: "#f59e0b" }}>●</span> {internalEvents.filter((e) => e.type === "thinking" || e.type === "action").length} in progress
                </span>
                <span>
                    <span style={{ color: "#3b82f6" }}>●</span> {internalEvents.filter((e) => e.requiresApproval && e.approvalStatus === "pending").length} pending approval
                </span>
            </div>

            <style jsx>{`
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
        </div>
    );
}

// Export individual components for testing
export { AgentBadge, AgentTimeline, TimelineItem, ActionCard, OfflineIndicator, SyncStatusBadge };
