"use client";

import { useState, useEffect } from "react";

// Types
type AgentStatus = "online" | "offline" | "working" | "error" | "idle";
type ModelProvider = "openai" | "gemini" | "unknown";

interface AgentInfo {
    id: string;
    name: string;
    status: AgentStatus;
    progress: number;
    provider: ModelProvider;
    currentTask?: string;
    isOnline?: boolean;
}

interface AgentSummary {
    total: number;
    online: number;
    working: number;
    error: number;
    offline: number;
    provider: ModelProvider;
}

interface AgentStatusAPIResponse {
    agents: AgentInfo[];
    summary: AgentSummary;
    timestamp: string;
    fallback?: boolean;
}

// Default agents (fallback)
const defaultAgents: AgentInfo[] = [
    { id: "triage", name: "Triage-7", status: "idle", progress: 0, provider: "openai", isOnline: true },
    { id: "remedy", name: "Remedy-3", status: "idle", progress: 0, provider: "openai", isOnline: true },
    { id: "comms", name: "Comms-1", status: "idle", progress: 0, provider: "openai", isOnline: true },
    { id: "postmort", name: "PostMort-2", status: "idle", progress: 0, provider: "openai", isOnline: true },
];

interface AgentStatusProps {
    variant?: "floating" | "embedded";
    demoAgents?: AgentInfo[];
}

export default function AgentStatus({ variant = "floating", demoAgents }: AgentStatusProps) {
    const [agents, setAgents] = useState<AgentInfo[]>(defaultAgents);
    const [summary, setSummary] = useState<AgentSummary>({
        total: 4,
        online: 4,
        working: 0,
        error: 0,
        offline: 0,
        provider: "openai"
    });
    const [isExpanded, setIsExpanded] = useState(variant === "embedded" || variant === "floating" || demoAgents !== undefined);
    const [lastUpdate, setLastUpdate] = useState<Date>(new Date());
    const [isLoading, setIsLoading] = useState(true);

    // Provider switching state (only used in embedded variant)
    const [selectedProvider, setSelectedProvider] = useState<"openai" | "gemini">("gemini");
    const [isSwitching, setIsSwitching] = useState(false);

    // Calculate summary from agents
    const calculateSummary = (agentList: AgentInfo[]): AgentSummary => {
        const working = agentList.filter(a => a.status === "working").length;
        const error = agentList.filter(a => a.status === "error").length;
        const online = agentList.filter(a => a.isOnline !== false).length;
        const offline = agentList.filter(a => a.isOnline === false).length;
        // Get most common provider
        const providers = agentList.map(a => a.provider);
        const provider: ModelProvider = providers.includes("openai") ? "openai" :
            providers.includes("gemini") ? "gemini" : "unknown";

        return {
            total: agentList.length,
            online,
            working,
            error,
            offline,
            provider
        };
    };

    // Fetch current provider setting on mount
    useEffect(() => {
        const fetchProvider = async () => {
            try {
                const response = await fetch("/api/agents/provider");
                if (response.ok) {
                    const data = await response.json();
                    setSelectedProvider(data.provider);
                }
            } catch (error) {
                console.log("[AgentStatus] Could not fetch provider setting");
            }
        };
        fetchProvider();
    }, []);

    // Use demo data if provided, otherwise fetch from API
    useEffect(() => {
        if (demoAgents) {
            setAgents(demoAgents);
            setSummary(calculateSummary(demoAgents));
            setLastUpdate(new Date());
            setIsLoading(false);
            return; // Skip API fetch for demo mode
        }

        const fetchAgentStatus = async () => {
            try {
                const response = await fetch("/api/agents/status");
                if (response.ok) {
                    const data: AgentStatusAPIResponse = await response.json();
                    setAgents(data.agents);
                    setSummary(data.summary);
                    setLastUpdate(new Date(data.timestamp));
                }
            } catch (error) {
                console.log("[AgentStatus] Using fallback data");
            } finally {
                setIsLoading(false);
            }
        };

        fetchAgentStatus();

        const interval = setInterval(fetchAgentStatus, 5000);
        return () => clearInterval(interval);
    }, [demoAgents]);

    const getStatusColor = (agent: AgentInfo) => {
        // Use colors that work in both light and dark modes
        if (agent.status === "working") return "#2563eb"; // Blue - more visible in light mode
        if (agent.status === "error") return "#dc2626"; // Red - more visible in light mode
        if (agent.isOnline === false) return "#9ca3af"; // Gray - more visible in light mode
        return "#16a34a"; // Green - more visible in light mode
    };

    const getProviderIcon = (provider: ModelProvider) => {
        switch (provider) {
            case "openai": return "🟢";
            case "gemini": return "🔵";
            default: return "⚪";
        }
    };

    const workingCount = summary.working;
    const errorCount = summary.error;
    const onlineCount = summary.online;

    // Embedded variant - inline agent list (between graph and PowerSync Live)
    if (variant === "embedded") {
        const handleProviderSwitch = async (provider: "openai" | "gemini") => {
            if (isSwitching || provider === selectedProvider) return;

            setIsSwitching(true);
            try {
                const response = await fetch("/api/agents/provider", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ provider })
                });

                if (response.ok) {
                    setSelectedProvider(provider);
                }
            } catch (error) {
                console.error("Failed to switch provider:", error);
            } finally {
                setIsSwitching(false);
            }
        };

        // Use theme variables for both light and dark modes
        const containerBg = "var(--bg0, rgba(22, 22, 28, 0.95))";
        const borderColor = "var(--bd, rgba(255,255,255,0.1))";
        const textColor = "var(--t0, #ffffff)";  // Theme-aware text color
        const subTextColor = "var(--t2, #a0aec0)";  // Theme-aware secondary text
        const mutedTextColor = "var(--t3, #718096)";  // Theme-aware muted text
        const dividerColor = "var(--bd, rgba(255,255,255,0.15))";
        const buttonBg = "var(--bg1, rgba(0,0,0,0.3))";
        const progressBg = "var(--bg2, rgba(255,255,255,0.15))"

        return (
            <div style={{
                padding: "8px",
                background: containerBg,
                borderRadius: "6px",
                border: borderColor,
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
            }}>
                {/* Header */}
                <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                    paddingBottom: "6px",
                    borderBottom: `1px solid ${dividerColor}`,
                }}>
                    <span style={{ color: textColor, fontWeight: 600, fontSize: "12px" }}>
                        AI Agents
                    </span>
                    <span style={{ color: subTextColor, fontSize: "10px" }}>
                        {workingCount > 0 ? `${workingCount} active` : errorCount > 0 ? `${errorCount} error` : `${onlineCount} online`}
                    </span>
                </div>

                {/* Agent List */}
                {agents.map((agent) => (
                    <div
                        key={agent.id}
                        style={{
                            marginBottom: "6px",
                            padding: "4px 0",
                        }}
                    >
                        <div style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            marginBottom: "2px",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                <div
                                    style={{
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "50%",
                                        background: getStatusColor(agent),
                                    }}
                                />
                                <span style={{ color: textColor, fontSize: "11px", fontWeight: 500 }}>
                                    {agent.name}
                                </span>
                            </div>
                            <span style={{
                                color: agent.status === "working" ? "#2563eb" :
                                    agent.status === "error" ? "#dc2626" :
                                        agent.status === "offline" || agent.isOnline === false ? "#6b7280" :
                                            agent.isOnline ? "#16a34a" : "#6b7280",
                                fontSize: "9px",
                                fontWeight: 500
                            }}>
                                {agent.status === "working" ? "◐ working" :
                                    agent.status === "error" ? "⚠ error" :
                                        agent.status === "offline" || agent.isOnline === false ? "○ offline" :
                                            agent.isOnline ? "● online" : "○ idle"}
                            </span>
                        </div>

                        {/* Progress bar for working agents */}
                        {agent.status === "working" && (
                            <div
                                style={{
                                    height: "2px",
                                    background: progressBg,
                                    borderRadius: "1px",
                                    overflow: "hidden",
                                }}
                            >
                                <div
                                    style={{
                                        height: "100%",
                                        width: `${agent.progress}%`,
                                        background: "linear-gradient(90deg, #58a6ff, #3fb950)",
                                        transition: "width 0.3s ease",
                                    }}
                                />
                            </div>
                        )}

                        {/* Current task */}
                        {agent.currentTask && (
                            <div style={{
                                fontSize: "9px",
                                color: mutedTextColor,
                                marginTop: "2px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}>
                                {agent.currentTask}
                            </div>
                        )}
                    </div>
                ))}

                {/* Provider Switcher */}
                <div style={{
                    marginTop: "8px",
                    paddingTop: "6px",
                    borderTop: `1px solid ${dividerColor}`,
                }}>
                    <div style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "4px"
                    }}>
                        <span style={{ color: "var(--t3, #6e7681)", fontSize: "9px" }}>
                            Provider:
                        </span>
                        <span style={{ color: "var(--t2, #8b949e)", fontSize: "9px" }}>
                            Fixed
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // Floating variant (original compact design)
    return (
        <div
            style={{
                position: "fixed",
                top: "80px",
                right: "16px",
                zIndex: 1000,
                fontFamily: "var(--fm, monospace)",
                fontSize: "11px",
            }}
        >
            {/* Compact Header - Always Visible */}
            <div
                onClick={() => setIsExpanded(!isExpanded)}
                style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 10px",
                    background: "rgba(22, 22, 28, 0.95)",
                    borderRadius: "6px",
                    border: "1px solid rgba(255,255,255,0.1)",
                    cursor: "pointer",
                    backdropFilter: "blur(8px)",
                    minWidth: "140px",
                }}
            >
                {/* Status Dots */}
                <div style={{ display: "flex", gap: "3px" }}>
                    {agents.map((agent) => (
                        <div
                            key={agent.id}
                            title={`${agent.name}: ${agent.status}`}
                            style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "50%",
                                background: getStatusColor(agent),
                                boxShadow: agent.status === "working"
                                    ? `0 0 4px ${getStatusColor(agent)}`
                                    : "none",
                            }}
                        />
                    ))}
                </div>

                {/* Status Text */}
                <span style={{ color: "var(--t2, #8b949e)", flex: 1 }}>
                    {workingCount > 0
                        ? `${workingCount} active`
                        : errorCount > 0
                            ? `${errorCount} errors`
                            : onlineCount > 0
                                ? `${onlineCount} online`
                                : "Offline"}
                </span>

                {/* Provider indicator */}
                <span style={{ fontSize: "9px" }}>
                    {getProviderIcon(summary.provider)}
                </span>

                {/* Expand indicator */}
                <span style={{ color: "var(--t3, #6e7681)", fontSize: "8px" }}>
                    {isExpanded ? "▲" : "▼"}
                </span>
            </div>

            {/* Expanded Panel */}
            {isExpanded && (
                <div
                    style={{
                        marginTop: "4px",
                        padding: "8px",
                        background: "rgba(22, 22, 28, 0.98)",
                        borderRadius: "6px",
                        border: "1px solid rgba(255,255,255,0.1)",
                        minWidth: "180px",
                    }}
                >
                    {/* Header */}
                    <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "8px",
                        paddingBottom: "6px",
                        borderBottom: "1px solid rgba(255,255,255,0.1)",
                    }}>
                        <span style={{ color: "var(--t1, #c9d1d9)", fontWeight: 600 }}>
                            AI Agents
                        </span>
                        <span style={{ color: "var(--t3, #6e7681)", fontSize: "9px" }}>
                            {lastUpdate.toLocaleTimeString()}
                        </span>
                    </div>

                    {/* Agent List */}
                    {agents.map((agent) => (
                        <div
                            key={agent.id}
                            style={{
                                marginBottom: "6px",
                                padding: "4px 0",
                            }}
                        >
                            <div style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                marginBottom: "2px",
                            }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                                    <div
                                        style={{
                                            width: "5px",
                                            height: "5px",
                                            borderRadius: "50%",
                                            background: getStatusColor(agent),
                                        }}
                                    />
                                    <span style={{ color: "var(--t1, #c9d1d9)" }}>
                                        {agent.name}
                                    </span>
                                </div>
                                <span style={{ color: "var(--t3, #6e7681)", fontSize: "9px" }}>
                                    {agent.status === "working" ? "◐ working" :
                                        agent.status === "error" ? "⚠ error" :
                                            agent.status === "offline" || agent.isOnline === false ? "○ offline" :
                                                agent.isOnline ? "● online" : "○ idle"}
                                </span>
                            </div>

                            {/* Progress bar for working agents */}
                            {agent.status === "working" && (
                                <div
                                    style={{
                                        height: "2px",
                                        background: "rgba(255,255,255,0.1)",
                                        borderRadius: "1px",
                                        overflow: "hidden",
                                    }}
                                >
                                    <div
                                        style={{
                                            height: "100%",
                                            width: `${agent.progress}%`,
                                            background: "linear-gradient(90deg, #58a6ff, #3fb950)",
                                            transition: "width 0.3s ease",
                                        }}
                                    />
                                </div>
                            )}

                            {/* Current task */}
                            {agent.currentTask && (
                                <div style={{
                                    fontSize: "8px",
                                    color: "var(--t3, #6e7681)",
                                    marginTop: "2px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                    maxWidth: "140px",
                                }}>
                                    {agent.currentTask}
                                </div>
                            )}
                        </div>
                    ))}

                    {/* Provider Info */}
                    <div style={{
                        marginTop: "8px",
                        paddingTop: "6px",
                        borderTop: "1px solid rgba(255,255,255,0.1)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                    }}>
                        <span style={{ color: "var(--t3, #6e7681)", fontSize: "9px" }}>
                            Provider:
                        </span>
                        <span style={{ color: "var(--t2, #8b949e)", fontSize: "9px" }}>
                            {summary.provider === "openai" ? "🟢 OpenAI" :
                                summary.provider === "gemini" ? "🔵 Gemini" :
                                    "⚪ Unknown"}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
