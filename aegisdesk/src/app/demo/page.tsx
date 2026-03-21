"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import AgentStatus from "@/components/AgentStatus";
import LocalAIStatus from "@/components/LocalAIStatus";

// Types
interface Incident {
  id: string;
  title: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4";
  status: "open" | "investigating" | "mitigating" | "resolved";
  created_at: string;
  assignee?: string;
}

interface TimelineEvent {
  id: string;
  incident_id: string;
  agent: string;
  message: string;
  timestamp: string;
  type: "info" | "action" | "warning" | "success";
}

interface Agent {
  id: string;
  name: string;
  role: string;
  roleName: string;
  color: string;
  status: "idle" | "working" | "complete";
  progress: number;
  lastOutput?: string;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
}

interface SyncEvent {
  id: string;
  operation: string;
  table: string;
  timestamp: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string;
}

// Demo data
const DEMO_START = "2026-03-15T12:00:00.000Z";

const demoTeamMembers: TeamMember[] = [
  { id: "t1", name: "John Doe", email: "john@aegisdesk.io", role: "SRE", avatar: "JD" },
  { id: "t2", name: "Alice Kim", email: "alice@aegisdesk.io", role: "Lead", avatar: "AK" },
];

const demoIncidents: Incident[] = [
  { id: "INC-001", title: "Payment API Down", severity: "SEV-1", status: "investigating", created_at: DEMO_START, assignee: "Triage-7" },
  { id: "INC-002", title: "Database Connection Pool Exhausted", severity: "SEV-2", status: "open", created_at: "2026-03-15T11:00:00.000Z" },
  { id: "INC-003", title: "CDN Cache Invalidation Failure", severity: "SEV-3", status: "resolved", created_at: "2026-03-15T10:00:00.000Z" },
];

const demoAgents: Agent[] = [
  { id: "triage7", name: "Triage-7", role: "triage", roleName: "Log Analysis", color: "#a371f7", status: "working", progress: 85, lastOutput: "Root cause: TLS cert expiry on payment-gateway-v2 (94% confidence)" },
  { id: "remedy3", name: "Remedy-3", role: "remedy", roleName: "Runbook Exec", color: "#bc8cff", status: "idle", progress: 0 },
  { id: "comms1", name: "Comms-1", role: "comms", roleName: "Status Updates", color: "#d29922", status: "idle", progress: 0 },
  { id: "postmort2", name: "PostMort-2", role: "postmortem", roleName: "Post-Mortem", color: "#3fb950", status: "idle", progress: 0 },
];

const demoTimeline: TimelineEvent[] = [
  { id: "t1", incident_id: "INC-001", agent: "System", message: "Incident INC-001 created: Payment API Down", timestamp: "2026-03-15T11:58:00.000Z", type: "warning" },
  { id: "t2", incident_id: "INC-001", agent: "Triage-7", message: "Analyzing 2,847 log entries from payment-gateway-v2...", timestamp: "2026-03-15T11:59:00.000Z", type: "info" },
  { id: "t3", incident_id: "INC-001", agent: "Triage-7", message: "Detected pattern: TLS cert expired 2 hours ago", timestamp: "2026-03-15T11:59:30.000Z", type: "info" },
  { id: "t4", incident_id: "INC-001", agent: "Triage-7", message: "Root cause identified: TLS cert expiry on payment-gateway-v2 (94% confidence)", timestamp: "2026-03-15T12:00:00.000Z", type: "success" },
];

const demoNotifications: Notification[] = [
  { id: "n1", title: "Triage-7 completed", message: "Root cause analysis finished", time: "12:00", read: false },
  { id: "n2", title: "New SEV-1 incident", message: "Payment API Down", time: "11:58", read: false },
  { id: "n3", title: "Remedy-3 available", message: "Ready to execute runbook", time: "11:55", read: false },
];

const demoSyncEvents: SyncEvent[] = [
  { id: "s1", operation: "INSERT", table: "incidents", timestamp: "12:00:05" },
  { id: "s2", operation: "UPDATE", table: "timeline", timestamp: "12:00:04" },
  { id: "s3", operation: "INSERT", table: "agents", timestamp: "12:00:03" },
];

export default function DemoPage() {
  const [mounted, setMounted] = useState(false);
  const [demoTime, setDemoTime] = useState(0);
  // Online/offline
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueue, setOfflineQueue] = useState<number[]>([]);
  const [offlineStartTime, setOfflineStartTime] = useState<number | null>(null);
  const [queueCount, setQueueCount] = useState(0);

  // State
  const [incidents, setIncidents] = useState<Incident[]>(demoIncidents);
  const [agents, setAgents] = useState<Agent[]>(demoAgents);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(demoTimeline);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(demoIncidents[0]);
  const [command, setCommand] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>(demoNotifications);
  const [syncEvents, setSyncEvents] = useState<SyncEvent[]>(demoSyncEvents);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(demoTeamMembers);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("Engineer");
  const [customRole, setCustomRole] = useState("");
  const [activeTab, setActiveTab] = useState("summary");
  const [showNotifDD, setShowNotifDD] = useState(false);
  const [showProfileDD, setShowProfileDD] = useState(false);
  const [showAgentDD, setShowAgentDD] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showNIModal, setShowNIModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  // Preferences state
  const [prefDarkMode, setPrefDarkMode] = useState(true);
  const [prefEmailIncidents, setPrefEmailIncidents] = useState(true);
  const [prefBrowserNotifs, setPrefBrowserNotifs] = useState(false);
  const [prefAgentFeed, setPrefAgentFeed] = useState(true);
  const [prefOffline, setPrefOffline] = useState(true);
  // Profile editing
  const [editingOrg, setEditingOrg] = useState(false);
  const [orgName, setOrgName] = useState("Demo Organization");
  const [toast, setToast] = useState<string | null>(null);
  const [logInput, setLogInput] = useState("");
  const [pausedAgents, setPausedAgents] = useState<string[]>([]);
  const [carouselPaused, setCarouselPaused] = useState(false);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'gemini' | 'local'>('openai');
  const [showAgentsDropdown, setShowAgentsDropdown] = useState(false);
  const [showAgentActivity, setShowAgentActivity] = useState(false);

  const cmdInputRef = useRef<HTMLTextAreaElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-scroll carousel (visual only, no selection)
  useEffect(() => {
    if (!mounted) return;

    const carouselTrack = document.getElementById('carTrack');
    if (!carouselTrack) return;

    const activeIncidents = incidents.filter(i => i.status !== "resolved");
    if (activeIncidents.length <= 1) return;

    let scrollPos = 0;
    const scrollSpeed = 0.5;
    let isHovering = false;

    const handleMouseEnter = () => { isHovering = true; };
    const handleMouseLeave = () => { isHovering = false; };

    carouselTrack.addEventListener('mouseenter', handleMouseEnter);
    carouselTrack.addEventListener('mouseleave', handleMouseLeave);

    const carouselScroll = setInterval(() => {
      if (isHovering) return;
      scrollPos += scrollSpeed;
      const maxScroll = carouselTrack.scrollWidth - carouselTrack.clientWidth;
      if (scrollPos >= maxScroll) {
        scrollPos = 0;
      }
      carouselTrack.scrollLeft = scrollPos;
    }, 30);

    return () => {
      clearInterval(carouselScroll);
      carouselTrack.removeEventListener('mouseenter', handleMouseEnter);
      carouselTrack.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [mounted, incidents]);

  useEffect(() => {
    if (!mounted) return;

    // Demo timer
    const timer = setInterval(() => {
      setDemoTime(prev => prev + 1);
    }, 1000);

    // Offline simulation - go offline at 30s, come back at 45s
    const offlineSim = setInterval(() => {
      setDemoTime(time => {
        // Go offline at 30 seconds
        if (time === 30 && isOnline) {
          setIsOnline(false);
          setOfflineStartTime(Date.now());
          showToast("Connection lost - working offline");
        }
        // Come back online at 45 seconds
        if (time === 45 && !isOnline) {
          setIsOnline(true);
          // Replay queue
          const queue = offlineQueue.length;
          setOfflineQueue([]);
          setOfflineStartTime(null);
          showToast(`Reconnected! Synced ${queue} operations`);
        }
        return time;
      });
    }, 1000);

    // Live PowerSync updates - add new sync events every few seconds
    const syncUpdater = setInterval(() => {
      if (isOnline) {
        const ops = ["INSERT", "UPDATE", "DELETE"];
        const tables = ["incidents", "timeline", "agents", "notifications"];
        const newEvent: SyncEvent = {
          id: `s${Date.now()}`,
          operation: ops[Math.floor(Math.random() * ops.length)],
          table: tables[Math.floor(Math.random() * tables.length)],
          timestamp: new Date().toLocaleTimeString("en-US", { hour12: false })
        };
        setSyncEvents(prev => [newEvent, ...prev].slice(0, 10));
      } else {
        // Queue operations while offline
        setOfflineQueue(prev => [...prev, Date.now()]);
      }
    }, 3000);

    // Live timeline updates - simulate agent activity
    const timelineUpdater = setInterval(() => {
      const agentsWorking = agents.filter(a => a.status === "working");
      if (agentsWorking.length > 0 && Math.random() > 0.5) {
        const agent = agentsWorking[0];
        const messages = [
          "Analyzing patterns in logs...",
          "Processing data...",
          "Running diagnostics...",
          "Checking dependencies...",
          "Querying database...",
        ];
        const newEvent: TimelineEvent = {
          id: `live${Date.now()}`,
          incident_id: selectedIncident?.id || "",
          agent: agent.name,
          message: messages[Math.floor(Math.random() * messages.length)],
          timestamp: new Date().toISOString(),
          type: "info"
        };
        setTimeline(prev => [...prev, newEvent]);
      }
    }, 5000);

    // Online/offline
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      clearInterval(timer);
      clearInterval(offlineSim);
      clearInterval(syncUpdater);
      clearInterval(timelineUpdater);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [mounted, isOnline, selectedIncident, agents]);

  // Show toast notification
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Save preferences
  const savePreferences = () => {
    const prefs = {
      darkMode: prefDarkMode,
      emailIncidents: prefEmailIncidents,
      browserNotifs: prefBrowserNotifs,
      agentFeed: prefAgentFeed,
      offline: prefOffline
    };
    localStorage.setItem('aegis_prefs', JSON.stringify(prefs));

    // Apply dark/light mode
    if (prefDarkMode) {
      document.documentElement.classList.remove('light-mode');
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.add('light-mode');
      document.documentElement.classList.remove('dark');
    }

    // Request browser notifications permission if enabled
    if (prefBrowserNotifs && 'Notification' in window) {
      Notification.requestPermission();
    }

    setShowPrefsModal(false);
    showToast("Preferences saved");
  };

  // Format time
  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("en-US", { hour12: false });
  };

  const formatDemoTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  // Severity colors
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "SEV-1": return "#ff7b72";
      case "SEV-2": return "#ffa657";
      case "SEV-3": return "#d29922";
      case "SEV-4": return "#3fb950";
      default: return "#8b949e";
    }
  };

  // Agent status colors
  const getAgentTypeColor = (role: string) => {
    switch (role) {
      case "triage": return "#a371f7";
      case "remedy": return "#bc8cff";
      case "comms": return "#d29922";
      case "postmortem": return "#3fb950";
      default: return "#8b949e";
    }
  };

  // Run agent
  const runAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || agent.status === "working") return;

    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, status: "working" as const, progress: 0 } : a
    ));

    const startEvent: TimelineEvent = {
      id: `start-${Date.now()}`,
      incident_id: selectedIncident?.id || "",
      agent: agent.name,
      message: `Starting ${agent.roleName.toLowerCase()}...`,
      timestamp: new Date().toISOString(),
      type: "info"
    };
    setTimeline(prev => [...prev, startEvent]);

    const progressInterval = setInterval(() => {
      setAgents(prev => prev.map(a => {
        if (a.id === agentId && a.progress < 100) {
          return { ...a, progress: Math.min(a.progress + Math.random() * 20, 100) };
        }
        return a;
      }));
    }, 1000);

    setTimeout(() => {
      clearInterval(progressInterval);

      let output = "";
      switch (agentId) {
        case "triage7": output = "Root cause identified: TLS cert expiry on payment-gateway-v2 (94% confidence)"; break;
        case "remedy3": output = "Remediation plan generated. Ready to execute 7 steps."; break;
        case "comms1": output = "Stakeholder update drafted and ready for review."; break;
        case "postmort2": output = "Post-mortem document generated with 5 contributing factors."; break;
      }

      setAgents(prev => prev.map(a =>
        a.id === agentId ? { ...a, status: "complete" as const, progress: 100, lastOutput: output } : a
      ));

      const completeEvent: TimelineEvent = {
        id: `end-${Date.now()}`,
        incident_id: selectedIncident?.id || "",
        agent: agent.name,
        message: output,
        timestamp: new Date().toISOString(),
        type: "success"
      };
      setTimeline(prev => [...prev, completeEvent]);
    }, 3000);
  };

  // Handle command
  const handleCommand = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!command.trim()) return;

    const newEvent: TimelineEvent = {
      id: `cmd-${Date.now()}`,
      incident_id: selectedIncident?.id || "",
      agent: "You",
      message: command,
      timestamp: new Date().toISOString(),
      type: "action"
    };

    setTimeline(prev => [...prev, newEvent]);
    setCommand("");

    setTimeout(() => {
      const response: TimelineEvent = {
        id: `resp-${Date.now()}`,
        incident_id: selectedIncident?.id || "",
        agent: "System",
        message: "Command received. Processing...",
        timestamp: new Date().toISOString(),
        type: "info"
      };
      setTimeline(prev => [...prev, response]);
    }, 500);
  }, [command, selectedIncident]);

  // Quick commands
  const setCmd = (cmd: string) => {
    setCommand(cmd);
    cmdInputRef.current?.focus();
  };

  // Ask agent
  const askAgent = (agentRole: string) => {
    setShowAgentDD(false);
    const agent = agents.find(a => a.role === agentRole);
    if (agent) {
      runAgent(agent.id);
    }
  };

  // Toggle pause/resume agent
  const togglePause = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent) return;

    if (pausedAgents.includes(agentId)) {
      // Resume
      setPausedAgents(prev => prev.filter(id => id !== agentId));
      const resumeEvent: TimelineEvent = {
        id: `resume-${Date.now()}`,
        incident_id: selectedIncident?.id || "",
        agent: agent.name,
        message: `Resuming ${agent.roleName.toLowerCase()}...`,
        timestamp: new Date().toISOString(),
        type: "info"
      };
      setTimeline(prev => [...prev, resumeEvent]);
    } else if (agent.status === "working") {
      // Pause
      setPausedAgents(prev => [...prev, agentId]);
      const pauseEvent: TimelineEvent = {
        id: `pause-${Date.now()}`,
        incident_id: selectedIncident?.id || "",
        agent: agent.name,
        message: `Paused at ${Math.round(agent.progress)}%`,
        timestamp: new Date().toISOString(),
        type: "warning"
      };
      setTimeline(prev => [...prev, pauseEvent]);
    }
  };

  // Create incident
  const createIncident = () => {
    showToast("New incident created");
    setShowNIModal(false);
  };

  // Ingest logs
  const ingestLogs = () => {
    const newEvent: TimelineEvent = {
      id: `logs-${Date.now()}`,
      incident_id: selectedIncident?.id || "",
      agent: "Triage-7",
      message: `Analyzing ${logInput.split('\n').length} log lines...`,
      timestamp: new Date().toISOString(),
      type: "info"
    };
    setTimeline(prev => [...prev, newEvent]);
    setShowLogsModal(false);
    setLogInput("");
    showToast("Logs ingested successfully");
  };

  // Add team member
  const addTeamMember = () => {
    if (!newMemberName.trim() || !newMemberEmail.trim()) {
      showToast("Please enter name and email");
      return;
    }
    const role = newMemberRole === "custom" ? customRole : newMemberRole;
    const initials = newMemberName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const newMember: TeamMember = {
      id: `t${Date.now()}`,
      name: newMemberName,
      email: newMemberEmail,
      role: role,
      avatar: initials
    };
    setTeamMembers(prev => [...prev, newMember]);
    setNewMemberName("");
    setNewMemberEmail("");
    setNewMemberRole("Engineer");
    setCustomRole("");
    showToast("Team member added");
  };

  // Remove team member
  const removeTeamMember = (id: string) => {
    setTeamMembers(prev => prev.filter(m => m.id !== id));
    showToast("Team member removed");
  };

  // Go to app
  const goToApp = () => {
    window.location.href = "/login";
  };

  // Stop demo
  const stopDemo = () => {
    window.location.href = "/";
  };

  // Clear notifications
  const clearNotifs = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    showToast("All notifications marked as read");
  };

  // Open modal
  const openModal = (modalId: string) => {
    if (modalId === "niModal") setShowNIModal(true);
    if (modalId === "logsModal") setShowLogsModal(true);
    if (modalId === "docModal") setShowDocModal(true);
    if (modalId === "teamModal") setShowTeamModal(true);
  };

  // Close modal
  const closeModal = (modalId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (modalId === "niModal") setShowNIModal(false);
    if (modalId === "logsModal") setShowLogsModal(false);
    if (modalId === "docModal") setShowDocModal(false);
    if (modalId === "teamModal") setShowTeamModal(false);
    if (modalId === "agentModal") setShowAgentModal(false);
  };

  // View agent detail
  const viewAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowAgentModal(true);
  };

  // Unread count
  const unreadCount = notifications.filter(n => !n.read).length;

  if (!mounted) return null;

  return (
    <div id="app">
      {/* Demo Banner */}
      <div className="demo-banner" id="demoBanner">
        <span className="demo-badge">Demo</span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        <span id="demoTimer">Demo running — {formatDemoTime(demoTime)}</span>
        <button className="stop-demo-btn" onClick={stopDemo}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
          Stop Demo
        </button>
      </div>

      {/* Offline Banner */}
      <div className={`offline-banner ${!isOnline ? "" : "hidden"}`} id="offBanner">
        <span className="off-pulse"></span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
        <strong>Offline Mode Active</strong> — All writes are queued locally via PowerSync SQLite. They will replay automatically when reconnected.
        <span id="queueCount" style={{ marginLeft: "auto", fontFamily: "var(--fm)", fontSize: "11px", color: "var(--t2)" }}>
          {offlineQueue.length} ops queued
        </span>
      </div>

      {/* Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" /><path d="M2 17L12 12L22 17" /><path d="M2 7L2 17L12 12L22 7" />
            </svg>
          </div>
          AegisDesk
        </div>

        <div className="inc-badge">
          <span className="idot"></span>
          <span id="hIncId">{selectedIncident?.id}</span>
          <span className="isep">|</span>
          <span id="incidentTitle">{selectedIncident?.title}</span>
        </div>

        <div className="team-pill" onClick={() => setShowTeamModal(true)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--t2)" }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div className="avstack">
            <span style={{ background: "#58a6ff", width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600 }}>JD</span>
            <span style={{ background: "#3fb950", width: 20, height: 20, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 600, marginLeft: -6 }}>AK</span>
          </div>
        </div>

        <div className={`sync-pill ${isOnline ? "online" : "offline"}`} id="syncPill">
          <span className="sdot"></span>
          <span id="syncTxt">{isOnline ? "Synced" : "Offline"}</span>
        </div>

        <button className="demo-go-btn" onClick={goToApp}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
          Go to App
        </button>

        <div className="hsep" style={{ marginRight: 16 }}></div>

        <div className="hmetrics">
          <div className="hm">
            <span className="hmv s1" id="hv1">{selectedIncident?.severity}</span>
            <span className="hml">SEV</span>
          </div>
          <div className="hm">
            <span className="hmv ag" id="hvag">{agents.filter(a => a.status === "working").length}</span>
            <span className="hml">agents/min</span>
          </div>
          <div className="hm">
            <span className="hmv op" id="hvop">{timeline.length}</span>
            <span className="hml">ops</span>
          </div>
          <div className="hm">
            <span className="hmv up">99.9%</span>
            <span className="hml">uptime</span>
          </div>
          <div className="hm" style={{ marginLeft: 8, paddingLeft: 8, borderLeft: "1px solid var(--bd)" }}>
            <span className="hmv" id="runTime" style={{ color: "var(--t0)" }}>{formatDemoTime(demoTime)}</span>
            <span className="hml">running</span>
          </div>
        </div>

        <div className="hright">
          {/* Notifications */}
          <button className="icon-btn" id="notifBtn" onClick={() => setShowNotifDD(!showNotifDD)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="nbadge" id="nbadge">{unreadCount}</span>
          </button>

          {/* Notif dropdown */}
          <div className={`dd notif-dd ${showNotifDD ? "" : "hidden"}`} style={{ top: "calc(100% + 6px)", right: 0, minWidth: 340 }}>
            <div className="dd-head">
              <div className="dd-head-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                </svg>
                Notifications
                <span style={{ background: "rgba(248,81,73,.18)", color: "var(--er)", fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 600 }}>
                  {unreadCount} new
                </span>
              </div>
              <button className="dd-clear" onClick={clearNotifs}>Mark all read</button>
            </div>
            <div>
              {notifications.map(n => (
                <div key={n.id} className="dd-item" style={{ opacity: n.read ? 0.6 : 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: "var(--t0)" }}>{n.title}</div>
                  <div style={{ fontSize: 11, color: "var(--t2)" }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: "var(--t3)", marginTop: 4 }}>{n.time}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Help */}
          <button className="icon-btn" onClick={() => setShowDocModal(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>

          {/* Profile */}
          <div style={{ position: "relative" }}>
            <div className="profile-btn" onClick={() => setShowProfileDD(!showProfileDD)}>
              <div className="pav" id="pav">DU</div>
              <span className="pname" id="pname">Demo User</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <div className={`dd profile-dd ${showProfileDD ? "" : "hidden"}`} style={{ top: "calc(100% + 6px)", right: 0 }}>
              <div className="pd-head">
                <div className="pd-avlg" id="pdAvLg">DU</div>
                <div>
                  <div className="pd-name" id="pdName">Demo User</div>
                  <div className="pd-email" id="pdEmail">demo@aegisdesk.io</div>
                  <div className="pd-role" id="pdRole">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    SRE
                  </div>
                </div>
              </div>
              <div className="pd-stats">
                <div className="pd-stat">
                  <div className="pd-statv" id="pdInc">{incidents.length}</div>
                  <div className="pd-statl">Incidents</div>
                </div>
                <div className="pd-stat">
                  <div className="pd-statv" id="pdRca">{incidents.filter(i => i.status === "resolved").length}</div>
                  <div className="pd-statl">RCAs</div>
                </div>
              </div>
              <button className="dd-item" onClick={() => setShowProfileModal(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                </svg>
                View Profile
              </button>
              <button className="dd-item" onClick={() => setShowPrefsModal(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Preferences
              </button>
              <div className="dd-sep"></div>
              <button className="dd-item danger" onClick={stopDemo}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Stop Demo
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="body">
        {/* Sidebar */}
        <aside className="sidebar">
          {/* AI Agents - Always visible */}
          <div className="sb-hdr">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
            </svg>
            AI Agents
          </div>

          <div className="agent-scroll">
            {agents.map(agent => (
              <div
                key={agent.id}
                className={`agent-card ${agent.status} ${pausedAgents.includes(agent.id) ? 'paused' : ''}`}
                onClick={() => viewAgent(agent)}
                style={{ cursor: "pointer" }}
              >
                <div className="agent-header">
                  <div className="agent-icon" style={{ background: agent.color }}>
                    {agent.name.charAt(0)}
                  </div>
                  <div className="agent-info">
                    <div className="agent-name">{agent.name}</div>
                    <div className="agent-role">{agent.roleName}</div>
                  </div>
                  <div className={`agent-status ${agent.status}`}>
                    {agent.status === "working" ? `${Math.round(agent.progress)}%` : agent.status}
                  </div>
                  <button
                    className="agent-play-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (agent.status === "idle") {
                        runAgent(agent.id);
                      } else {
                        togglePause(agent.id);
                      }
                    }}
                    title={agent.status === "idle" ? "Start" : pausedAgents.includes(agent.id) ? "Resume" : "Pause"}
                  >
                    {agent.status === "idle" ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    ) : pausedAgents.includes(agent.id) ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    )}
                  </button>
                </div>
                {agent.status === "working" && (
                  <div className="agent-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${agent.progress}%`, background: agent.color }} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Provider Selector */}
          <div className="sb-hdr" style={{ marginTop: 8 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
            Provider
          </div>
          <div style={{ padding: '8px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              onClick={() => setSelectedProvider('openai')}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid var(--b3)',
                background: selectedProvider === 'openai' ? 'var(--p)' : 'transparent',
                color: 'var(--t1)',
                cursor: 'pointer',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span style={{ color: 'var(--ok)', fontSize: 8 }}>●</span> OpenAI
            </button>
            <button
              onClick={() => setSelectedProvider('gemini')}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid var(--b3)',
                background: selectedProvider === 'gemini' ? 'var(--p)' : 'transparent',
                color: 'var(--t1)',
                cursor: 'pointer',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span style={{ color: 'var(--b)' }}>●</span> Gemini
            </button>
            <button
              onClick={() => setSelectedProvider('local')}
              style={{
                flex: 1,
                padding: '6px 8px',
                borderRadius: 6,
                border: '1px solid var(--b3)',
                background: selectedProvider === 'local' ? 'var(--p)' : 'transparent',
                color: 'var(--t1)',
                cursor: 'pointer',
                fontSize: 11,
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              <span style={{ color: 'var(--ok)', fontSize: 8 }}>●</span> Local
            </button>
          </div>

          <div className="sb-actions">
            <div className="sb-hdr">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Actions
            </div>
            <button className="abtn" onClick={() => setShowNIModal(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              New Incident
            </button>
            <button className="abtn" onClick={() => setShowLogsModal(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              </svg>
              Paste Logs
            </button>
            <button className="abtn" onClick={() => runAgent("triage7")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Run RCA
            </button>
            <button className="abtn" onClick={() => showToast("Summary generated")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <line x1="16" y1="13" x2="8" y2="13" />
              </svg>
              Generate Summary
            </button>
            <button className="abtn danger" onClick={() => showToast("Incident resolved!")}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Resolve
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="main">
          {/* Carousel */}
          <div className="carousel-wrap">
            <div className="car-label">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
              Active
            </div>
            <div className="car-track-wrap">
              <div className="car-track" id="carTrack">
                {incidents.filter(i => i.status !== "resolved").map(inc => (
                  <div
                    key={inc.id}
                    className={`car-card ${selectedIncident?.id === inc.id ? "active" : ""}`}
                    onClick={() => setSelectedIncident(inc)}
                  >
                    <span className="car-sev" style={{ background: getSeverityColor(inc.severity) }}>{inc.severity}</span>
                    <span className="car-id">{inc.id}</span>
                    <span className="car-title">{inc.title}</span>
                    <span className="car-status">{inc.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="tl-section">
            <div className="sec-hdr">
              <div className="sec-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                Shared Timeline
                <span className="evcnt" id="evCount">{timeline.length} events</span>
              </div>
            </div>
            <div className="tl-body">
              {timeline.map(event => (
                <div key={event.id} className={`tl-event ${event.type}`}>
                  <div className="tl-dot" style={{
                    background: event.agent === "Triage-7" ? "#a371f7" :
                      event.agent === "Remedy-3" ? "#bc8cff" :
                        event.agent === "Comms-1" ? "#d29922" :
                          event.agent === "PostMort-2" ? "#3fb950" :
                            event.agent === "You" ? "#f0f6fc" : "#8b949e"
                  }} />
                  <div className="tl-content">
                    <div className="tl-meta">
                      <span className="tl-agent">{event.agent}</span>
                      <span className="tl-time">{formatTime(event.timestamp)}</span>
                    </div>
                    <div className="tl-msg">{event.message}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Workspace */}
          <div className="ws">
            <div className="tbar">
              <button className={`tab ${activeTab === "summary" ? "active" : ""}`} data-tab="summary" onClick={() => setActiveTab("summary")}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
                </svg>
                Summary
              </button>
              <button className={`tab ${activeTab === "logs" ? "active" : ""}`} data-tab="logs" onClick={() => setActiveTab("logs")}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                </svg>
                Logs
              </button>
              <button className={`tab ${activeTab === "runbook" ? "active" : ""}`} data-tab="runbook" onClick={() => setActiveTab("runbook")}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                Runbook
              </button>
              <button className={`tab ${activeTab === "trace" ? "active" : ""}`} data-tab="trace" onClick={() => setActiveTab("trace")}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                </svg>
                Trace
              </button>
              <button className={`tab ${activeTab === "workflow" ? "active" : ""}`} data-tab="workflow" onClick={() => setActiveTab("workflow")}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                </svg>
                Workflow
              </button>
              <button className={`tab ${activeTab === "audit" ? "active" : ""}`} data-tab="audit" onClick={() => setActiveTab("audit")}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Audit
              </button>
              <button className={`tab ${activeTab === "offline" ? "active" : ""}`} data-tab="offline" onClick={() => setActiveTab("offline")}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                  <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                </svg>
                Offline Queue
              </button>
            </div>
            <div className="wsbody">
              {activeTab === "summary" && (
                <div className="ws-summary">
                  <h3>Incident Summary</h3>
                  <div className="sum-grid">
                    <div className="sum-card">
                      <div className="sum-label">Incident ID</div>
                      <div className="sum-value">{selectedIncident?.id}</div>
                    </div>
                    <div className="sum-card">
                      <div className="sum-label">Severity</div>
                      <div className="sum-value" style={{ color: getSeverityColor(selectedIncident?.severity || "") }}>{selectedIncident?.severity}</div>
                    </div>
                    <div className="sum-card">
                      <div className="sum-label">Status</div>
                      <div className="sum-value">{selectedIncident?.status}</div>
                    </div>
                    <div className="sum-card">
                      <div className="sum-label">Created</div>
                      <div className="sum-value">{selectedIncident?.created_at ? formatTime(selectedIncident.created_at) : ""}</div>
                    </div>
                  </div>
                  <div className="sum-desc">
                    <div className="sum-label">Description</div>
                    <p>{selectedIncident?.title}</p>
                  </div>
                </div>
              )}
              {activeTab === "logs" && (
                <div className="ws-logs">
                  <div className="log-line">[12:00:05] INFO payment-gateway: TLS certificate validation failed</div>
                  <div className="log-line">[12:00:04] ERROR payment-gateway: Connection timeout after 30s</div>
                  <div className="log-line">[12:00:03] WARN payment-gateway: Certificate expires in 2 hours</div>
                  <div className="log-line">[12:00:02] INFO payment-gateway: Retrying connection (attempt 3/5)</div>
                  <div className="log-line">[12:00:01] ERROR payment-gateway: SSL handshake failed</div>
                </div>
              )}
              {activeTab === "runbook" && (
                <div className="ws-runbook">
                  <div className="rb-step complete">
                    <div className="rb-num">1</div>
                    <div className="rb-content">
                      <div className="rb-title">Identify affected service</div>
                      <div className="rb-status">Completed - payment-gateway-v2</div>
                    </div>
                  </div>
                  <div className="rb-step complete">
                    <div className="rb-num">2</div>
                    <div className="rb-content">
                      <div className="rb-title">Check certificate expiry</div>
                      <div className="rb-status">Completed - Expired 2 hours ago</div>
                    </div>
                  </div>
                  <div className="rb-step active">
                    <div className="rb-num">3</div>
                    <div className="rb-content">
                      <div className="rb-title">Renew certificate</div>
                      <div className="rb-status">In Progress</div>
                    </div>
                  </div>
                  <div className="rb-step">
                    <div className="rb-num">4</div>
                    <div className="rb-content">
                      <div className="rb-title">Deploy new certificate</div>
                      <div className="rb-status">Pending</div>
                    </div>
                  </div>
                  <div className="rb-step">
                    <div className="rb-num">5</div>
                    <div className="rb-content">
                      <div className="rb-title">Verify service recovery</div>
                      <div className="rb-status">Pending</div>
                    </div>
                  </div>
                </div>
              )}
              {activeTab === "trace" && (
                <div className="ws-trace">
                  <div className="trace-span">
                    <span className="trace-method">POST</span>
                    <span className="trace-path">/api/v1/payments/process</span>
                    <span className="trace-status" style={{ color: "var(--er)" }}>500</span>
                    <span className="trace-duration">2.3s</span>
                  </div>
                  <div className="trace-span">
                    <span className="trace-method">GET</span>
                    <span className="trace-path">/api/v1/auth/validate</span>
                    <span className="trace-status" style={{ color: "var(--ok)" }}>200</span>
                    <span className="trace-duration">45ms</span>
                  </div>
                  <div className="trace-span">
                    <span className="trace-method">POST</span>
                    <span className="trace-path">/api/v1/billing/charge</span>
                    <span className="trace-status" style={{ color: "var(--er)" }}>503</span>
                    <span className="trace-duration">5.1s</span>
                  </div>
                </div>
              )}
              {activeTab === "workflow" && (
                <div className="ws-workflow">
                  <div className="wf-node start">Incident Created</div>
                  <div className="wf-arrow">↓</div>
                  <div className="wf-node active">Triage Analysis</div>
                  <div className="wf-arrow">↓</div>
                  <div className="wf-node">Root Cause Identified</div>
                  <div className="wf-arrow">↓</div>
                  <div className="wf-node">Remediation</div>
                  <div className="wf-arrow">↓</div>
                  <div className="wf-node">Resolution</div>
                </div>
              )}
              {activeTab === "audit" && (
                <div className="ws-audit">
                  <div className="audit-entry">
                    <span className="audit-time">12:00:05</span>
                    <span className="audit-user">Triage-7</span>
                    <span className="audit-action">Updated incident status to "investigating"</span>
                  </div>
                  <div className="audit-entry">
                    <span className="audit-time">11:59:30</span>
                    <span className="audit-user">Triage-7</span>
                    <span className="audit-action">Added analysis result: TLS cert expired</span>
                  </div>
                  <div className="audit-entry">
                    <span className="audit-time">11:58:00</span>
                    <span className="audit-user">System</span>
                    <span className="audit-action">Created incident INC-001</span>
                  </div>
                </div>
              )}
              {activeTab === "offline" && (
                <div className="ws-offline">
                  <div className="off-info">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--ok)" strokeWidth="2">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <h4>Connected</h4>
                    <p>All operations are syncing in real-time via PowerSync</p>
                  </div>
                  <div className="off-queue">
                    <div className="queue-header">Sync Queue</div>
                    <div className="queue-empty">No pending operations</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Command Bar */}
          <div className="cmd-bar">
            <div className="cmd-inner">
              <div className="cmd-left">
                <textarea
                  className="cmd-input"
                  id="cmdInput"
                  ref={cmdInputRef}
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleCommand();
                    }
                  }}
                  placeholder="Describe what you're seeing, or use /command..."
                  rows={1}
                />
                <div className="qcs">
                  <span className="qc" onClick={() => setCmd("/logs ")}>/logs</span>
                  <span className="qc" onClick={() => setCmd("/scale ")}>/scale</span>
                  <span className="qc" onClick={() => setCmd("/rollback ")}>/rollback</span>
                  <span className="qc" onClick={() => setCmd("/rca ")}>/rca</span>
                </div>
              </div>
              <div className="cmd-right">
                <div className="ag-dd-wrap">
                  <button className="ag-dd-btn" onClick={() => setShowAgentDD(!showAgentDD)}>
                    Ask Agent <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <div className={`ag-dd-menu ${showAgentDD ? "" : "hidden"}`} id="agDD">
                    <div className="ag-ddi" onClick={() => askAgent("triage")}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--al)" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                      </svg>
                      Triage — Analyze logs
                    </div>
                    <div className="ag-ddi" onClick={() => askAgent("remedy")}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ar)" strokeWidth="2">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      Remedy — Root cause
                    </div>
                    <div className="ag-ddi" onClick={() => askAgent("postmortem")}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ag)" strokeWidth="2">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      </svg>
                      Runbook — Playbook
                    </div>
                    <div className="ag-ddi" onClick={() => askAgent("comms")}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Comms — Draft update
                    </div>
                  </div>
                </div>
                <button className="send-btn" onClick={() => handleCommand()}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Send
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Right Panel */}
        <aside className="right-panel">
          <div className="rps">
            <div className="rph">
              <span className="ldot"></span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Error Rate (5m)
            </div>
            <div className="chart" id="errChart">
              <svg viewBox="0 0 200 60" style={{ width: "100%", height: "100%" }}>
                <polyline
                  fill="none"
                  stroke="#ff7b72"
                  strokeWidth="2"
                  points="0,45 20,40 40,50 60,35 80,45 100,30 120,40 140,25 160,35 180,20 200,30"
                />
                <polyline
                  fill="none"
                  stroke="#58a6ff"
                  strokeWidth="1.5"
                  points="0,50 20,48 40,52 60,46 80,50 100,44 120,48 140,42 160,46 180,40 200,44"
                  strokeDasharray="4,2"
                />
              </svg>
            </div>
            <div className="clabels">
              <span id="ct0" style={{ color: "var(--er)" }}>45.2/s</span>
              <span id="ct1" style={{ color: "var(--b)" }}>230ms</span>
              <span id="ct2" style={{ color: "var(--ok)" }}>1.3k/s</span>
            </div>
            <div className="cleg">
              <div className="lg"><span className="lgd e"></span>errors/sec</div>
              <div className="lg"><span className="lgd l"></span>p99 latency</div>
              <div className="lg"><span className="lgd t"></span>throughput</div>
            </div>
          </div>

          {/* Agent Activity - Demo Mode - Collapsible */}
          <div style={{ padding: '12px 16px', marginBottom: '8px' }}>
            <div
              onClick={() => setShowAgentActivity(!showAgentActivity)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                marginBottom: showAgentActivity ? '8px' : '0',
              }}
            >
              {/* Line 1: AGENT ACTIVITY - Centered */}
              <div style={{ marginBottom: 2, textAlign: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: 13, color: '#e2e8f0' }}>AGENT ACTIVITY</span>
              </div>

              {/* Line 2: Agents · X online - Left/Right aligned with color coding */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#a0aec0' }}>Agents</span>
                <span style={{
                  fontSize: 10,
                  color: agents.filter((a: Agent) => a.status === 'working').length > 0 ? '#22c55e' : '#ef4444',
                  fontWeight: 500
                }}>
                  ● {agents.filter((a: Agent) => a.status === 'working').length} online
                </span>
              </div>

              {/* Line 3: Dropdown arrow - Centered */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{ transition: 'transform 0.2s', transform: showAgentActivity ? 'rotate(90deg)' : 'rotate(0deg)' }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </div>
              {showAgentActivity && (
                <AgentStatus
                  variant="embedded"
                  demoAgents={[
                    { id: "triage", name: "Triage-7", status: "working", progress: 85, provider: "openai" as const, isOnline: true, currentTask: "Root cause: TLS cert expiry on payment-gateway-v2" },
                    { id: "remedy", name: "Remedy-3", status: "idle", progress: 0, provider: "openai" as const, isOnline: true },
                    { id: "comms", name: "Comms-1", status: "idle", progress: 0, provider: "openai" as const, isOnline: true },
                    { id: "postmort", name: "PostMort-2", status: "idle", progress: 0, provider: "openai" as const, isOnline: true },
                  ]}
                />
              )}
            </div>
          </div>

          <div className="fhdr">
            <span className="ldot"></span>PowerSync Live
          </div>
          <div className="flist" id="flist">
            {syncEvents.map(evt => (
              <div className="fitem" key={evt.id}>
                <span className="fop">{evt.operation}</span>
                <span className="ftbl">{evt.table}</span>
                <span className="ftm">{evt.timestamp}</span>
              </div>
            ))}
          </div>

          {/* Local AI Status - Below PowerSync Live */}
          <div style={{ marginTop: 16 }}>
            <LocalAIStatus />
          </div>
        </aside>
      </div>

      {/* Documentation Modal */}
      <div className={`mov ${showDocModal ? "" : "hidden"}`} onClick={(e) => closeModal("docModal", e)}>
        <div className="mod" style={{ width: 560, maxHeight: "85vh" }}>
          <div className="mhdr">
            <span className="mtit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              AegisDesk Help (Demo)
            </span>
            <button className="mcl" onClick={() => setShowDocModal(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="mbdy" style={{ padding: 16, overflowY: "auto", maxHeight: "calc(85vh - 120px)" }}>
            <div style={{ marginBottom: 20, background: "rgba(63,185,80,.1)", border: "1px solid var(--ok)", borderRadius: 8, padding: 12 }}>
              <h4 style={{ color: "var(--ok)", margin: "0 0 8px 0", fontSize: 14 }}>🎮 Demo Mode Active</h4>
              <p style={{ color: "var(--t2)", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                You are currently viewing a simulated incident response scenario. This demo runs with mock data and resets periodically. Click "Go to App" in the header to access the full application.
              </p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ color: "var(--t0)", margin: "0 0 8px 0", fontSize: 14 }}>🚀 What is AegisDesk?</h4>
              <p style={{ color: "var(--t2)", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                AegisDesk is an AI-powered incident management platform. When an incident occurs, autonomous AI agents automatically analyze logs, execute remediation runbooks, draft communications, and generate post-incident reports.
              </p>
            </div>
            <div style={{ marginBottom: 20 }}>
              <h4 style={{ color: "var(--t0)", margin: "0 0 8px 0", fontSize: 14 }}>🤖 AI Agents in Action</h4>
              <ul style={{ color: "var(--t2)", fontSize: 12, margin: 0, paddingLeft: 18, lineHeight: 1.8 }}>
                <li><strong style={{ color: "var(--p)" }}>Triage-7</strong> - Analyzes incoming logs and traces to identify what's wrong</li>
                <li><strong style={{ color: "var(--p)" }}>Remedy-3</strong> - Executes your runbooks step-by-step, tracking progress</li>
                <li><strong style={{ color: "var(--p)" }}>Comms-1</strong> - Automatically updates stakeholders via Slack/email</li>
                <li><strong style={{ color: "var(--p)" }}>PostMort-2</strong> - Generates RCA reports after resolution</li>
              </ul>
            </div>
            <div style={{ marginBottom: 0 }}>
              <h4 style={{ color: "var(--t0)", margin: "0 0 8px 0", fontSize: 14 }}>🔄 PowerSync Offline Mode</h4>
              <p style={{ color: "var(--t2)", fontSize: 12, margin: 0, lineHeight: 1.5 }}>
                AegisDesk works offline! All changes are stored locally in SQLite and automatically synced when you're back online. The sync status indicator shows your connection state.
              </p>
            </div>
          </div>
          <div className="mftr">
            <button className="btn-ghost" onClick={goToApp} style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--b)" }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
              Go to Full App
            </button>
            <button className="btn-pri" onClick={() => setShowDocModal(false)}>Explore Demo</button>
          </div>
        </div>
      </div>

      {/* New Incident Modal */}
      <div className={`mov ${showNIModal ? "" : "hidden"}`} onClick={(e) => closeModal("niModal", e)}>
        <div className="mod ni-mod">
          <div className="mhdr">
            <span className="mtit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
              New Incident
            </span>
            <button className="mcl" onClick={() => setShowNIModal(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="mbdy">
            <div className="fg">
              <div className="fl">Title</div>
              <input className="fi" id="niTitle" placeholder="e.g. Payment API elevated errors" />
            </div>
            <div className="fg">
              <div className="fl">Severity</div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="sev-btn active" style={{ padding: "5px 12px", borderRadius: 5, border: "1px solid var(--s1)", background: "rgba(255,123,114,.1)", color: "var(--s1)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>SEV-1</button>
                <button className="sev-btn" style={{ padding: "5px 12px", borderRadius: 5, border: "1px solid var(--bd)", background: "var(--bg2)", color: "var(--t2)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>SEV-2</button>
                <button className="sev-btn" style={{ padding: "5px 12px", borderRadius: 5, border: "1px solid var(--bd)", background: "var(--bg2)", color: "var(--t2)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>SEV-3</button>
                <button className="sev-btn" style={{ padding: "5px 12px", borderRadius: 5, border: "1px solid var(--bd)", background: "var(--bg2)", color: "var(--t2)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>SEV-4</button>
              </div>
            </div>
            <div className="fg">
              <div className="fl">Description</div>
              <textarea className="fta" id="niDesc" placeholder="What is happening..."></textarea>
            </div>
            <div className="fg">
              <div className="fl">Affected Service</div>
              <input className="fi" id="niSvc" placeholder="e.g. payment-gateway" />
            </div>
          </div>
          <div className="mftr">
            <button className="btn-ghost" onClick={() => setShowNIModal(false)}>Cancel</button>
            <button className="btn-pri" onClick={createIncident}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create
            </button>
          </div>
        </div>
      </div>

      {/* Logs Modal */}
      <div className={`mov ${showLogsModal ? "" : "hidden"}`} onClick={(e) => closeModal("logsModal", e)}>
        <div className="mod" style={{ width: 500 }}>
          <div className="mhdr">
            <span className="mtit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Paste Logs
            </span>
            <button className="mcl" onClick={() => setShowLogsModal(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="mbdy">
            <textarea
              className="fta"
              id="logInput"
              value={logInput}
              onChange={(e) => setLogInput(e.target.value)}
              style={{ minHeight: 160, color: "var(--ok)", fontFamily: "var(--fm)" }}
              placeholder="[14:31:02] ERROR payment-gateway: TLS handshake timeout..."
            ></textarea>
          </div>
          <div className="mftr">
            <button className="btn-ghost" onClick={() => setShowLogsModal(false)}>Cancel</button>
            <button className="btn-pri" onClick={ingestLogs}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Ingest
            </button>
          </div>
        </div>
      </div>

      {/* Agent Detail Modal */}
      <div className={`mov ${showAgentModal ? "" : "hidden"}`} onClick={(e) => closeModal("agentModal", e)}>
        <div className="mod amod">
          <div className="mhdr">
            <span className="mtit" id="agModalTitle">{selectedAgent?.name} - {selectedAgent?.roleName}</span>
            <button className="mcl" onClick={() => setShowAgentModal(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="mbdy">
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 4 }}>Status</div>
              <div style={{ textTransform: "capitalize", color: selectedAgent?.status === "working" ? "var(--ok)" : "var(--t2)" }}>
                {selectedAgent?.status}
                {selectedAgent?.status === "working" && ` - ${Math.round(selectedAgent.progress || 0)}%`}
              </div>
            </div>
            {selectedAgent?.lastOutput && (
              <div>
                <div style={{ fontSize: 12, color: "var(--t3)", marginBottom: 4 }}>Last Output</div>
                <div style={{ fontSize: 13, color: "var(--t0)", fontFamily: "var(--fm)" }}>{selectedAgent.lastOutput}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Team Modal */}
      <div className={`mov ${showTeamModal ? "" : "hidden"}`} onClick={(e) => closeModal("teamModal", e)}>
        <div className="mod">
          <div className="mhdr">
            <span className="mtit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Team Members
            </span>
            <button className="mcl" onClick={() => setShowTeamModal(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="mbdy">
            {teamMembers.map(member => (
              <div className="mem-item" key={member.id}>
                <div className="mem-av" style={{ background: member.id === "t1" ? "#58a6ff" : member.id === "t2" ? "#3fb950" : "#bc8cff" }}>
                  {member.avatar}
                </div>
                <div className="mem-info">
                  <div className="mem-name">{member.name}</div>
                  <div className="mem-email">{member.email}</div>
                </div>
                <div className="mem-role">{member.role}</div>
                <button
                  className="mem-del"
                  onClick={() => removeTeamMember(member.id)}
                  title="Remove member"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            {/* Add new member form */}
            <div className="madd">
              <input
                className="minput"
                id="newMName"
                placeholder="Name"
                value={newMemberName}
                onChange={(e) => setNewMemberName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTeamMember()}
              />
              <input
                className="minput"
                id="newMEmail"
                placeholder="Email"
                style={{ flex: 1.2 }}
                value={newMemberEmail}
                onChange={(e) => setNewMemberEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTeamMember()}
              />
              <select
                className="msel"
                id="newMRole"
                value={newMemberRole}
                onChange={(e) => setNewMemberRole(e.target.value)}
              >
                <option>Engineer</option>
                <option>On-Call</option>
                <option>Lead</option>
                <option>SRE</option>
                <option>Manager</option>
                <option value="custom">+ Custom Role</option>
              </select>
              <input
                className={`minput ${newMemberRole === "custom" ? "" : "hidden"}`}
                id="newMRoleCustom"
                placeholder="Enter custom role"
                style={{ flex: 1 }}
                value={customRole}
                onChange={(e) => setCustomRole(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTeamMember()}
              />
              <button className="mbtn" onClick={addTeamMember}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Modal */}
      <div className={`mov ${showProfileModal ? '' : 'hidden'}`} onClick={(e) => { if (e.target === e.currentTarget) setShowProfileModal(false); }}>
        <div className="mod">
          <div className="mhdr">
            <span className="mtit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
              Your Profile
            </span>
            <button className="mcl" onClick={() => setShowProfileModal(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="mbdy">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--al), var(--ar))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 600, color: 'white' }}>
                D
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--t0)', marginBottom: '4px' }}>Demo User</div>
                <div style={{ fontSize: '12px', color: 'var(--al)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Admin
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Account Details</div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--t2)', marginBottom: '4px' }}>Email</div>
                <div style={{ fontSize: '13px', color: 'var(--t0)' }}>demo@aegisdesk.com</div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--t2)', marginBottom: '4px' }}>Organization</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ fontSize: '13px', color: 'var(--t0)' }}>{orgName}</div>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--t2)', marginBottom: '4px' }}>Member Since</div>
                <div style={{ fontSize: '13px', color: 'var(--t0)' }}>January 2024</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--al)' }}>{incidents.length}</div>
                <div style={{ fontSize: '11px', color: 'var(--t2)' }}>Incidents Handled</div>
              </div>
              <div style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ar)' }}>{timeline.filter(t => t.agent === 'Triage-7').length}</div>
                <div style={{ fontSize: '11px', color: 'var(--t2)' }}>RCAs Completed</div>
              </div>
            </div>
          </div>
          <div className="mftr">
            <button className="btn-ghost" onClick={() => setShowProfileModal(false)}>Close</button>
          </div>
        </div>
      </div>

      {/* Preferences Modal */}
      <div className={`mov ${showPrefsModal ? '' : 'hidden'}`} onClick={(e) => { if (e.target === e.currentTarget) setShowPrefsModal(false); }}>
        <div className="mod">
          <div className="mhdr">
            <span className="mtit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Preferences
            </span>
            <button className="mcl" onClick={() => setShowPrefsModal(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="mbdy">
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--t0)', marginBottom: '8px', fontWeight: 500 }}>Notifications</div>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--bg2)', borderRadius: '6px', cursor: 'pointer' }}>
                <span style={{ fontSize: '13px', color: 'var(--t1)' }}>Email notifications for new incidents</span>
                <input type="checkbox" checked={prefEmailIncidents} onChange={(e) => setPrefEmailIncidents(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--al)' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--bg2)', borderRadius: '6px', cursor: 'pointer', marginTop: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--t1)' }}>Browser notifications</span>
                <input type="checkbox" checked={prefBrowserNotifs} onChange={(e) => setPrefBrowserNotifs(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--al)' }} />
              </label>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '12px', color: 'var(--t0)', marginBottom: '8px', fontWeight: 500 }}>Display</div>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--bg2)', borderRadius: '6px', cursor: 'pointer' }}>
                <span style={{ fontSize: '13px', color: 'var(--t1)' }}>Dark mode</span>
                <input type="checkbox" checked={prefDarkMode} onChange={(e) => setPrefDarkMode(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--al)' }} />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--bg2)', borderRadius: '6px', cursor: 'pointer', marginTop: '8px' }}>
                <span style={{ fontSize: '13px', color: 'var(--t1)' }}>Show agent activity feed</span>
                <input type="checkbox" checked={prefAgentFeed} onChange={(e) => setPrefAgentFeed(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--al)' }} />
              </label>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--t0)', marginBottom: '8px', fontWeight: 500 }}>Data & Privacy</div>
              <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px', background: 'var(--bg2)', borderRadius: '6px', cursor: 'pointer' }}>
                <span style={{ fontSize: '13px', color: 'var(--t1)' }}>Enable offline mode (PowerSync)</span>
                <input type="checkbox" checked={prefOffline} onChange={(e) => setPrefOffline(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: 'var(--al)' }} />
              </label>
            </div>
          </div>
          <div className="mftr">
            <button className="btn-ghost" onClick={() => setShowPrefsModal(false)}>Cancel</button>
            <button className="btn-pri" onClick={savePreferences}>Save Preferences</button>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast" style={{
          position: "fixed",
          bottom: 20,
          left: "50%",
          transform: "translateX(-50%)",
          background: "var(--bg1)",
          border: "1px solid var(--bd)",
          borderRadius: 8,
          padding: "10px 20px",
          color: "var(--t0)",
          fontSize: 13,
          zIndex: 10000,
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)"
        }}>
          {toast}
        </div>
      )}

      <style>{`
        .demo-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: linear-gradient(90deg, rgba(163,113,247,0.15), rgba(188,140,255,0.15));
          border-bottom: 1px solid rgba(163,113,247,0.3);
          font-size: 12px;
          color: #f0f6fc;
          flex-shrink: 0;
        }
        
        .demo-badge {
          background: linear-gradient(135deg, #a371f7, #bc8cff);
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 600;
          font-size: 10px;
        }
        
        .stop-demo-btn {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: rgba(248,81,73,0.15);
          border: 1px solid rgba(248,81,73,0.3);
          border-radius: 4px;
          color: #ff7b72;
          font-size: 11px;
          cursor: pointer;
        }
        
        .offline-banner {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: rgba(248,81,73,0.15);
          border-bottom: 1px solid rgba(248,81,73,0.3);
          font-size: 12px;
          color: #ff7b72;
          flex-shrink: 0;
        }
        
        .offline-banner.hidden {
          display: none;
        }
        
        .off-pulse {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: #ff7b72;
          animation: pulse 1s infinite;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .toast {
          animation: slideUp 0.3s ease;
        }
        
        @keyframes slideUp {
          from { transform: translateX(-50%) translateY(20px); opacity: 0; }
          to { transform: translateX(-50%) translateY(0); opacity: 1; }
        }
        
        .right-panel {
          width: 340px;
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
