"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { PowerSyncProvider, usePowerSync } from "@/components/PowerSyncProvider";
import AgentStatus from "@/components/AgentStatus";
import "../globals.css";

// Dynamic import for LocalAIStatus to avoid SSR issues with WebLLM
const LocalAIStatus = dynamic(() => import("@/components/LocalAIStatus"), {
  ssr: false,
  loading: () => <div className="text-xs text-gray-400 p-2">Loading Local AI...</div>,
});

interface Incident {
  id: string;
  title: string;
  severity: "SEV-1" | "SEV-2" | "SEV-3" | "SEV-4";
  status: "open" | "investigating" | "mitigating" | "resolved";
  created_at: string;
  assignee?: string;
  description?: string;
  service?: string;
  affected_service?: string;
}

interface TimelineEvent {
  id: string;
  incident_id: string;
  agent: string;
  message: string;
  timestamp: string;
  type: "info" | "action" | "warning" | "success" | "error";
}

interface Agent {
  id: string;
  name: string;
  role: string;
  color: string;
  status: "idle" | "working" | "complete";
  progress: number;
  lastOutput?: string;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  status?: 'active' | 'pending';
}

interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "warning" | "success" | "error";
  // Team invite specific fields
  inviteToken?: string;
  organizationId?: string;
  organizationName?: string;
}

// Default agent configurations (not demo data - these are the available agents)
const defaultAgents: Agent[] = [
  { id: "triage7", name: "Triage-7", role: "Log Analysis", color: "#58a6ff", status: "idle", progress: 0 },
  { id: "remedy3", name: "Remedy-3", role: "Runbook Exec", color: "#bc8cff", status: "idle", progress: 0 },
  { id: "comms1", name: "Comms-1", role: "Status Updates", color: "#d29922", status: "idle", progress: 0 },
  { id: "postmort2", name: "PostMort-2", role: "Post-Mortem", color: "#3fb950", status: "idle", progress: 0 },
];

// Initial empty data - will be loaded from database
let initialIncidents: Incident[] = [];
let initialTimeline: TimelineEvent[] = [];
let initialTeam: TeamMember[] = [];

function DashboardContent() {
  const router = useRouter();
  const { db, isConnected } = usePowerSync();

  // Force client-only rendering to avoid hydration mismatch
  const [mounted, setMounted] = useState(false);

  // State - ALL hooks must be defined BEFORE any early return
  // State
  const [incidents, setIncidents] = useState<Incident[]>(initialIncidents);
  const [agents, setAgents] = useState<Agent[]>(defaultAgents);
  const [timeline, setTimeline] = useState<TimelineEvent[]>(initialTimeline);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [team, setTeam] = useState<TeamMember[]>(initialTeam);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successToastMessage, setSuccessToastMessage] = useState('');
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [errorToastMessage, setErrorToastMessage] = useState('');
  const [lastInviteLink, setLastInviteLink] = useState('');
  const [command, setCommand] = useState("");
  const [queueCount, setQueueCount] = useState(0);
  const [isOnline, setIsOnline] = useState(true);
  const [user, setUser] = useState<{ id?: string; name: string; email: string; organizationName?: string; organizationId?: string; role?: string } | null>(null);
  const [activeTab, setActiveTab] = useState("summary");
  const [runTime, setRunTime] = useState(0);
  const [editingOrg, setEditingOrg] = useState(false);
  const [orgName, setOrgName] = useState("");

  // Real-time data states
  const [metrics, setMetrics] = useState<{ errorsPerSec: number; p99Latency: number; throughput: number; history: { time: string; errors: number; latency: number; throughput: number }[] }>({
    errorsPerSec: 0,
    p99Latency: 0,
    throughput: 0,
    history: []
  });
  const [activities, setActivities] = useState<{ id: string; type: string; agent: string | null; action: string; message: string; timestamp: string; status: string }[]>([]);
  const [syncStatus, setSyncStatus] = useState<{ connected: boolean; tables: { name: string; displayName: string; status: string; count: number; lastSync: string }[]; status: string }>({
    connected: false,
    tables: [],
    status: 'synced'
  });

  // Modal states
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showAgentModal, setShowAgentModal] = useState(false);
  const [showNiModal, setShowNiModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showDocModal, setShowDocModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPrefsModal, setShowPrefsModal] = useState(false);
  const [showNotifDD, setShowNotifDD] = useState(false);
  const [showProfileDD, setShowProfileDD] = useState(false);
  const [showAgDD, setShowAgDD] = useState(false);
  const [showAgentActivity, setShowAgentActivity] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  // Ref to track agent progress intervals
  const agentIntervals = useRef<Record<string, NodeJS.Timeout>>({});

  // Form states
  const [newIncTitle, setNewIncTitle] = useState("");
  const [newIncSev, setNewIncSev] = useState(1);
  const [newIncDesc, setNewIncDesc] = useState("");
  const [newIncSvc, setNewIncSvc] = useState("");
  const [logInput, setLogInput] = useState("");
  const [ingestedLogs, setIngestedLogs] = useState<string[]>([]);
  const [newMName, setNewMName] = useState("");
  const [newMEmail, setNewMEmail] = useState("");
  const [newMRole, setNewMRole] = useState("Engineer");
  const [showCustomRole, setShowCustomRole] = useState(false);
  const [newMCustomRole, setNewMCustomRole] = useState("");

  // Preferences state
  const [prefDarkMode, setPrefDarkMode] = useState(true);
  const [prefEmailIncidents, setPrefEmailIncidents] = useState(true);
  const [prefBrowserNotifs, setPrefBrowserNotifs] = useState(false);
  const [prefAgentFeed, setPrefAgentFeed] = useState(true);
  const [prefOffline, setPrefOffline] = useState(true);
  const [prefDefaultSev, setPrefDefaultSev] = useState(3);

  // Refs
  const notifBtnRef = useRef<HTMLButtonElement>(null);
  const profileBtnRef = useRef<HTMLDivElement>(null);
  const agDDRef = useRef<HTMLDivElement>(null);

  // ALL useEffect hooks MUST be before any conditional return
  // Set mounted effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Load preferences from localStorage
  useEffect(() => {
    const savedPrefs = localStorage.getItem('aegis_prefs');
    if (savedPrefs) {
      try {
        const prefs = JSON.parse(savedPrefs);
        setPrefDarkMode(prefs.darkMode ?? true);
        setPrefEmailIncidents(prefs.emailIncidents ?? true);
        setPrefBrowserNotifs(prefs.browserNotifs ?? false);
        setPrefAgentFeed(prefs.agentFeed ?? true);
        setPrefOffline(prefs.offline ?? true);
        setPrefDefaultSev(prefs.defaultSev ?? 3);

        // Apply dark/light mode
        if (prefs.darkMode === false) {
          document.documentElement.classList.add('light-mode');
          document.documentElement.classList.remove('dark');
        } else {
          document.documentElement.classList.remove('light-mode');
          document.documentElement.classList.add('dark');
        }
      } catch (e) {
        console.error('Failed to parse preferences:', e);
      }
    } else {
      // Default to dark mode
      document.documentElement.classList.add('dark');
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("aegis_token");
    const userData = localStorage.getItem("aegis_user");
    if (!token || !userData) {
      router.push("/login");
      return;
    }
    const parsedUser = JSON.parse(userData);
    setUser(parsedUser);

    // Load team members from API
    loadTeamMembers(token);

    // Load notifications
    loadNotifications(token);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [router]);

  // Load team members from API
  const loadTeamMembers = async (token: string) => {
    try {
      const response = await fetch('/api/team/members', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const currentUserId = data.currentUserId;

        // Transform active members to UI format
        const activeMembers = (data.members || []).map((m: any) => ({
          id: m.id,
          name: m.full_name || m.name || m.email?.split('@')[0],
          email: m.email,
          role: m.role,
          status: m.status,
          avatar: (m.full_name || m.email || '?').charAt(0).toUpperCase(),
          isCurrentUser: m.user_id === currentUserId
        }));

        // Transform pending invitations to UI format
        const pendingMembers = (data.pendingInvitations || []).map((inv: any) => ({
          id: inv.id,
          name: inv.email.split('@')[0],
          email: inv.email,
          role: inv.role || 'member',
          status: 'pending',
          avatar: inv.email.charAt(0).toUpperCase(),
          isCurrentUser: false
        }));

        // Combine active members and pending invitations
        setTeam([...activeMembers, ...pendingMembers]);
      }
    } catch (err) {
      console.error('Failed to load team members:', err);
    }
  };

  // Load notifications from API
  const loadNotifications = async (token: string) => {
    try {
      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[Notifications] Loaded:', data.notifications?.length, 'notifications');
        setNotifications(data.notifications || []);
      } else {
        console.error('[Notifications] Failed to load, status:', response.status);
      }
    } catch (err) {
      console.error('[Notifications] Failed to load notifications:', err);
    }
  };

  // Remove a team member
  const removeTeamMember = async (memberId: string, memberEmail: string) => {
    if (!confirm(`Are you sure you want to remove ${memberEmail} from the team?`)) {
      return;
    }

    const token = localStorage.getItem('aegis_token');
    if (!token) return;

    try {
      const response = await fetch('/api/team/members', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ memberId })
      });

      const data = await response.json();

      if (response.ok) {
        // Remove from local state
        setTeam(prev => prev.filter(m => m.id !== memberId));
        // Show success message
        alert('Member successfully removed');
      } else {
        alert(data.error || 'Failed to remove team member');
      }
    } catch (err) {
      console.error('Failed to remove team member:', err);
      alert('Failed to remove team member');
    }
  };

  // Cancel a pending invitation
  const cancelInvitation = async (invitationId: string, email: string) => {
    if (!confirm(`Are you sure you want to cancel the invitation for ${email}?`)) {
      return;
    }

    const token = localStorage.getItem('aegis_token');
    if (!token) return;

    try {
      const response = await fetch('/api/team/invite', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ invitationId })
      });

      const data = await response.json();

      if (response.ok) {
        // Remove from local state
        setTeam(prev => prev.filter(m => m.id !== invitationId));
      } else {
        alert(data.error || 'Failed to cancel invitation');
      }
    } catch (err) {
      console.error('Failed to cancel invitation:', err);
      alert('Failed to cancel invitation');
    }
  };

  // Runtime counter
  useEffect(() => {
    const interval = setInterval(() => {
      setRunTime(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Poll for notifications every 5 seconds to get real-time updates
  useEffect(() => {
    const token = localStorage.getItem('aegis_token');
    if (!token) return;

    const pollInterval = setInterval(() => {
      loadNotifications(token);
    }, 5000);

    return () => clearInterval(pollInterval);
  }, []);

  // Poll for real-time metrics every 3 seconds
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const res = await fetch('/api/metrics');
        if (res.ok) {
          const data = await res.json();
          setMetrics(data);
        }
      } catch (error) {
        console.error('[Metrics] Fetch error:', error);
      }
    };

    fetchMetrics();
    const metricsInterval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(metricsInterval);
  }, []);

  // Poll for activity every 5 seconds
  useEffect(() => {
    const fetchActivity = async () => {
      try {
        const res = await fetch('/api/activity');
        if (res.ok) {
          const data = await res.json();
          setActivities(data.activities || []);
        }
      } catch (error) {
        console.error('[Activity] Fetch error:', error);
      }
    };

    fetchActivity();
    const activityInterval = setInterval(fetchActivity, 5000);
    return () => clearInterval(activityInterval);
  }, []);

  // Poll for sync status every 5 seconds
  useEffect(() => {
    const fetchSyncStatus = async () => {
      try {
        const res = await fetch('/api/sync/status');
        if (res.ok) {
          const data = await res.json();
          setSyncStatus(data);
        }
      } catch (error) {
        console.error('[Sync Status] Fetch error:', error);
      }
    };

    fetchSyncStatus();
    const syncInterval = setInterval(fetchSyncStatus, 5000);
    return () => clearInterval(syncInterval);
  }, []);

  // Click outside handlers
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifBtnRef.current && !notifBtnRef.current.contains(e.target as Node)) {
        const dd = document.getElementById('notifDD');
        if (dd && !dd.contains(e.target as Node)) setShowNotifDD(false);
      }
      if (profileBtnRef.current && !profileBtnRef.current.contains(e.target as Node)) {
        const dd = document.getElementById('profileDD');
        if (dd && !dd.contains(e.target as Node)) setShowProfileDD(false);
      }
      if (agDDRef.current && !agDDRef.current.contains(e.target as Node)) {
        setShowAgDD(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'n') { e.preventDefault(); setShowNiModal(true); }
        if (e.key === 'l') { e.preventDefault(); setShowLogsModal(true); }
        if (e.key === 'r') { e.preventDefault(); triggerRCA(); }
        if (e.key === 'Enter') { e.preventDefault(); resolveInc(); }
      }
      if (e.key === 'Escape') {
        setShowTeamModal(false);
        setShowAgentModal(false);
        setShowNiModal(false);
        setShowLogsModal(false);
        setShowDocModal(false);
        setShowProfileModal(false);
        setShowPrefsModal(false);
        setShowNotifDD(false);
        setShowProfileDD(false);
        setShowAgDD(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Load incidents and timeline from API on mount (fast, reliable)
  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('[AegisDesk] Loading data from API...');

        const [incidentsRes, timelineRes] = await Promise.all([
          fetch(`/api/sync/incidents?organization_id=${user?.organizationId || ''}`),
          fetch(`/api/sync/timeline_events?organization_id=${user?.organizationId || ''}`)
        ]);

        console.log('[AegisDesk] Incidents response status:', incidentsRes.status);
        console.log('[AegisDesk] Timeline response status:', timelineRes.status);

        if (!incidentsRes.ok) {
          console.error('[AegisDesk] Failed to fetch incidents:', incidentsRes.status, incidentsRes.statusText);
          return;
        }

        const incidentsData = await incidentsRes.json();
        const timelineData = await timelineRes.json();

        console.log('[AegisDesk] Incidents data:', incidentsData);
        console.log('[AegisDesk] Timeline data:', timelineData);

        if (incidentsData.data && Array.isArray(incidentsData.data)) {
          const apiIncidents: Incident[] = incidentsData.data.map((inc: Record<string, unknown>) => ({
            id: inc.id as string,
            title: inc.title as string,
            severity: (`SEV-${inc.severity}`) as Incident['severity'],
            status: (inc.status || 'open') as Incident['status'],
            description: (inc.description as string) || undefined,
            service: (inc.affected_services as string) || undefined,
            created_at: (inc.created_at as string) || new Date().toISOString(),
          }));
          console.log('[AegisDesk] Parsed incidents:', apiIncidents);
          setIncidents(apiIncidents);
        }

        if (timelineData.data && Array.isArray(timelineData.data)) {
          const apiTimeline: TimelineEvent[] = timelineData.data.map((evt: Record<string, unknown>) => ({
            id: evt.id as string,
            incident_id: (evt.incident_id || evt.incident_id) as string,
            agent: (evt.actor || evt.actor || 'System') as string,
            message: evt.message as string,
            timestamp: (evt.timestamp as string) || new Date().toISOString(),
            type: (evt.event_type || 'info') as TimelineEvent['type'],
          }));
          setTimeline(apiTimeline);
        }

        console.log('[AegisDesk] Loaded data from API - incidents:', incidents.length, 'timeline:', timeline.length);
      } catch (apiErr) {
        console.error('[AegisDesk] Failed to load from API:', apiErr);
      }
    };

    loadData();
  }, []); // Only run once on mount

  // Helpers
  const formatRuntime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString("en-US", { hour12: false });
  };

  const formatTimeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  };

  const savePreferences = () => {
    const prefs = {
      darkMode: prefDarkMode,
      emailIncidents: prefEmailIncidents,
      browserNotifs: prefBrowserNotifs,
      agentFeed: prefAgentFeed,
      offline: prefOffline,
      defaultSev: prefDefaultSev
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
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "SEV-1": return "#ff7b72";
      case "SEV-2": return "#ffa657";
      case "SEV-3": return "#58a6ff";
      case "SEV-4": return "#3fb950";
      default: return "#8b949e";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open": return "#ff7b72";
      case "investigating": return "#ffa657";
      case "mitigating": return "#58a6ff";
      case "resolved": return "#3fb950";
      default: return "#8b949e";
    }
  };

  const getNotificationCount = () => notifications.filter(n => !n.read).length;

  // Actions
  const handleCommand = useCallback(async (e?: React.FormEvent) => {
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

  const runAgent = async (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || agent.status === "working") return;

    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, status: "working" as const, progress: 0 } : a
    ));

    const startEvent: TimelineEvent = {
      id: `start-${Date.now()}`,
      incident_id: selectedIncident?.id || "",
      agent: agent.name,
      message: `Starting ${agent.role.toLowerCase()}...`,
      timestamp: new Date().toISOString(),
      type: "info"
    };
    setTimeline(prev => [...prev, startEvent]);

    // Store interval in ref so we can clear it later
    agentIntervals.current[agentId] = setInterval(() => {
      setAgents(prev => prev.map(a => {
        if (a.id === agentId && a.progress < 100) {
          return { ...a, progress: Math.min(a.progress + Math.random() * 20, 100) };
        }
        return a;
      }));
    }, 1000);

    try {
      // Map agent IDs to Mastra agent types
      const agentTypeMap: Record<string, string> = {
        triage7: "triage",
        remedy3: "remedy",
        comms1: "comms",
        postmort2: "postmortem"
      };

      const agentType = agentTypeMap[agentId];

      // Build input with incident data
      const input = {
        incident: selectedIncident ? {
          title: selectedIncident.title,
          description: selectedIncident.description,
          severity: selectedIncident.severity,
          affectedService: selectedIncident.affected_service,
          status: selectedIncident.status
        } : null,
        task: agent.role
      };

      console.log(`[Agent] Running ${agentType} agent with input:`, input);

      // Call the real Mastra agents API
      const response = await fetch("/api/mastra/agents", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agent: agentType,
          input: input,
          useTools: true
        })
      });

      const result = await response.json();
      console.log(`[Agent] ${agentType} result:`, result);

      clearInterval(agentIntervals.current[agentId]);
      delete agentIntervals.current[agentId];

      let output = "";
      if (result.success && result.output) {
        output = result.output;
      } else if (result.error) {
        output = `Error: ${result.error}`;
      } else {
        // Fallback outputs if API doesn't return properly
        switch (agentId) {
          case "triage7":
            output = "Root cause analysis completed. See details in agent output.";
            break;
          case "remedy3":
            output = "Remediation steps generated and ready for review.";
            break;
          case "comms1":
            output = "Stakeholder communication drafted.";
            break;
          case "postmort2":
            output = "Post-mortem report generated.";
            break;
        }
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
        type: result.success ? "success" as const : "warning" as const
      };
      setTimeline(prev => [...prev, completeEvent]);
    } catch (error) {
      console.error(`[Agent] Error running ${agentId}:`, error);

      clearInterval(agentIntervals.current[agentId]);
      delete agentIntervals.current[agentId];

      const errorOutput = `Agent failed: ${error instanceof Error ? error.message : "Unknown error"}`;

      setAgents(prev => prev.map(a =>
        a.id === agentId ? { ...a, status: "idle" as const, progress: 0, lastOutput: errorOutput } : a
      ));

      const errorEvent: TimelineEvent = {
        id: `error-${Date.now()}`,
        incident_id: selectedIncident?.id || "",
        agent: agent.name,
        message: errorOutput,
        timestamp: new Date().toISOString(),
        type: "error"
      };
      setTimeline(prev => [...prev, errorEvent]);
    }
  };

  // Stop an agent that's currently running
  const stopAgent = (agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    if (!agent || agent.status !== "working") return;

    // Clear the interval if it exists
    if (agentIntervals.current[agentId]) {
      clearInterval(agentIntervals.current[agentId]);
      delete agentIntervals.current[agentId];
    }

    // Set agent back to idle
    setAgents(prev => prev.map(a =>
      a.id === agentId ? { ...a, status: "idle" as const, progress: 0 } : a
    ));

    // Add timeline event
    const stopEvent: TimelineEvent = {
      id: `stop-${Date.now()}`,
      incident_id: selectedIncident?.id || "",
      agent: agent.name,
      message: `Agent stopped by user`,
      timestamp: new Date().toISOString(),
      type: "warning"
    };
    setTimeline(prev => [...prev, stopEvent]);
  };

  const openAgentModal = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowAgentModal(true);
  };

  const [createError, setCreateError] = useState<string | null>(null);

  const [isCreating, setIsCreating] = useState(false);

  const createIncident = async () => {
    if (!newIncTitle.trim()) {
      setCreateError('Please enter an incident title');
      return;
    }
    setCreateError(null);
    setIsCreating(true);

    try {
      const newId = `INC-${String(incidents.length + 1).padStart(3, '0')}`;
      const severityMap = { 1: "SEV-1", 2: "SEV-2", 3: "SEV-3", 4: "SEV-4" };
      const severityNum = newIncSev as 1 | 2 | 3 | 4;
      const now = new Date().toISOString();

      const newIncident: Incident = {
        id: newId,
        title: newIncTitle,
        severity: severityMap[severityNum] as Incident["severity"],
        status: "open",
        created_at: now,
        description: newIncDesc,
        service: newIncSvc
      };

      // Update local state FIRST (immediate UI update)
      setIncidents(prev => [newIncident, ...prev]);
      setSelectedIncident(newIncident);

      // Try to save to PowerSync (best effort - won't block UI)
      if (db) {
        db.execute(
          `INSERT INTO incidents (id, title, severity, status, description, affected_services, organization_id, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [newId, newIncTitle, severityNum, "open", newIncDesc || null, newIncSvc || null, user?.organizationId || null, user?.id || null, now, now]
        ).then(() => {
          console.log('[AegisDesk] Incident saved to PowerSync:', newId);
        }).catch(err => {
          console.error('[AegisDesk] Failed to save incident to PowerSync:', err);
        });
      }

      // Try to save to API in background (won't block UI)
      fetch('/api/sync/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newId,
          title: newIncTitle,
          severity: severityNum,
          status: 'open',
          description: newIncDesc || null,
          affected_services: newIncSvc || null,
          organization_id: user?.organizationId || null,
          created_at: now,
          updated_at: now
        })
      }).then(response => {
        if (response.ok) {
          console.log('[AegisDesk] Incident synced to API:', newId);
        }
      }).catch(err => {
        console.log('[AegisDesk] API sync in background failed, will retry later:', err);
      });

      // Close the modal immediately (most important!)
      setShowNiModal(false);
      setNewIncTitle("");
      setNewIncSev(1);
      setNewIncDesc("");
      setNewIncSvc("");
      setIsCreating(false);
      console.log('[AegisDesk] Incident created successfully:', newId);

      // Show success toast notification
      setSuccessToastMessage(`Incident "${newIncTitle}" created successfully!`);
      setShowSuccessToast(true);
      setTimeout(() => setShowSuccessToast(false), 4000);
    } catch (error) {
      console.error('[AegisDesk] Error creating incident:', error);

      // ALWAYS close modal and reset state on error
      setShowNiModal(false);
      setIsCreating(false);
      setCreateError('Failed to create incident. Please try again.');

      // Show error toast notification
      setErrorToastMessage('Failed to create incident. Please try again.');
      setShowErrorToast(true);
      setTimeout(() => setShowErrorToast(false), 5000);
    }
  };

  const ingestLogs = () => {
    if (!logInput.trim()) return;

    // Store the full log content
    setIngestedLogs(prev => [...prev, logInput]);

    const logEvent: TimelineEvent = {
      id: `log-${Date.now()}`,
      incident_id: selectedIncident?.id || "",
      agent: "You",
      message: `Logs ingested (${logInput.split('\n').length} lines)`,
      timestamp: new Date().toISOString(),
      type: "info"
    };
    setTimeline(prev => [...prev, logEvent]);

    setLogInput("");
    setShowLogsModal(false);
  };

  const triggerRCA = () => {
    runAgent("triage7");
  };

  const resolveInc = () => {
    if (!selectedIncident) return;

    setIncidents(prev => prev.map(inc =>
      inc.id === selectedIncident.id ? { ...inc, status: "resolved" as const } : inc
    ));

    const resolveEvent: TimelineEvent = {
      id: `resolve-${Date.now()}`,
      incident_id: selectedIncident.id,
      agent: "System",
      message: `Incident ${selectedIncident.id} marked as resolved`,
      timestamp: new Date().toISOString(),
      type: "success"
    };
    setTimeline(prev => [...prev, resolveEvent]);
  };

  const genSummary = () => {
    runAgent("postmort2");
  };

  const addTeamMember = async () => {
    if (!newMName.trim() || !newMEmail.trim()) return;

    const role = showCustomRole && newMCustomRole.trim() ? newMCustomRole.trim() : newMRole;

    // Get the auth token
    const token = typeof window !== 'undefined' ? localStorage.getItem('aegis_token') : null;

    // Try to invite via API (real app)
    if (token) {
      try {
        const response = await fetch('/api/team/invite', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            email: newMEmail,
            role: role
          })
        });

        const data = await response.json();

        if (response.ok) {
          // Store the invite link for display
          if (data.invitationLink) {
            setLastInviteLink(data.invitationLink);
          }

          // Show success toast notification with invite link
          setSuccessToastMessage(`Invitation sent to ${newMEmail}!`);
          setShowSuccessToast(true);
          setTimeout(() => setShowSuccessToast(false), 6000);

          // Add to local list as pending
          const newMember: TeamMember = {
            id: `pending-${Date.now()}`,
            name: newMName,
            email: newMEmail,
            role: role,
            avatar: newMName.split(' ').map(n => n[0]).join('').toUpperCase(),
            status: 'pending'
          };
          setTeam(prev => [...prev, newMember]);

          // Show success message and close the team modal
          alert('Member successfully added');
          setShowTeamModal(false);
        } else {
          console.error('Invite error:', data.error);
          alert(data.error || 'Failed to send invitation');
          return;
        }
      } catch (err) {
        console.error('Failed to invite:', err);
      }
    } else {
      // Demo mode - just add locally
      const newMember: TeamMember = {
        id: `m-${Date.now()}`,
        name: newMName,
        email: newMEmail,
        role: role,
        avatar: newMName.split(' ').map(n => n[0]).join('').toUpperCase()
      };
      setTeam(prev => [...prev, newMember]);
      // Show success message and close modal
      alert('Member successfully added');
      setShowTeamModal(false);
    }

    setNewMName("");
    setNewMEmail("");
    setNewMRole("Engineer");
    setShowCustomRole(false);
    setNewMCustomRole("");
  };

  const clearNotifs = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  // Handle notification click - auto-accept team invites
  const handleNotificationClick = async (notification: Notification) => {
    // Mark as read
    setNotifications(prev => prev.map(n =>
      n.id === notification.id ? { ...n, read: true } : n
    ));

    // If it's a team invite, auto-accept
    if (notification.inviteToken) {
      try {
        const token = localStorage.getItem('aegis_token');
        const response = await fetch('/api/team/accept', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ token: notification.inviteToken })
        });

        if (response.ok) {
          const data = await response.json();
          // Refresh team members
          const teamRes = await fetch('/api/team/members', {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (teamRes.ok) {
            const teamData = await teamRes.json();

            // Transform active members to UI format
            const activeMembers = (teamData.members || []).map((m: any) => ({
              id: m.id,
              name: m.full_name || m.name || m.email?.split('@')[0],
              email: m.email,
              role: m.role,
              status: m.status,
              avatar: (m.full_name || m.email || '?').charAt(0).toUpperCase()
            }));

            // Transform pending invitations to UI format
            const pendingMembers = (teamData.pendingInvitations || []).map((inv: any) => ({
              id: inv.id,
              name: inv.email.split('@')[0],
              email: inv.email,
              role: inv.role || 'member',
              status: 'pending',
              avatar: inv.email.charAt(0).toUpperCase()
            }));

            // Combine active members and pending invitations
            setTeam([...activeMembers, ...pendingMembers]);
          }
          // Show success
          setNotifications(prev => [{
            id: `notif_${Date.now()}`,
            title: 'Team Invite Accepted',
            message: `You have joined ${notification.organizationName || 'the organization'}!`,
            time: 'Just now',
            read: false,
            type: 'success'
          }, ...prev]);
        }
      } catch (err) {
        console.error('Failed to accept invite:', err);
      }
    }
  };

  const saveOrgName = () => {
    if (!orgName.trim()) {
      alert('Organization name cannot be empty');
      return;
    }
    // Update user object with new organization name
    if (user) {
      const updatedUser = { ...user, organizationName: orgName };
      setUser(updatedUser);
      localStorage.setItem('aegis_user', JSON.stringify(updatedUser));
    }
    setEditingOrg(false);
  };

  const doLogout = () => {
    localStorage.removeItem("aegis_token");
    localStorage.removeItem("aegis_user");
    router.push("/");
  };

  const setCmd = (cmd: string) => {
    setCommand(cmd);
  };

  const agCmd = (type: string) => {
    setShowAgDD(false);
    switch (type) {
      case 'triage': runAgent('triage7'); break;
      case 'remedy': runAgent('remedy3'); break;
      case 'runbook': setActiveTab('runbook'); break;
      case 'comms': runAgent('comms1'); break;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCommand();
    }
  };

  const unreadCount = getNotificationCount();
  const activeIncidents = incidents.filter(i => i.status !== "resolved");

  return (
    <div id="app" suppressHydrationWarning={true}>
      {/* Offline Banner */}
      <div className={`offline-banner ${!isOnline ? 'show' : ''}`} id="offBanner" style={isOnline ? { display: 'none' } : { display: 'flex' }}>
        <span className="off-pulse"></span>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="1" y1="1" x2="23" y2="23" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
        <strong>Offline Mode Active</strong> — All writes are queued locally via PowerSync SQLite. They will replay automatically when reconnected.
        <span id="queueCount" style={{ marginLeft: 'auto', fontFamily: 'var(--fm)', fontSize: '11px', color: 'var(--t2)' }}>{queueCount} ops queued</span>
      </div>

      {/* Error Toast */}
      <div className={`error-toast ${showErrorToast ? 'show' : ''}`} style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        backgroundColor: '#dc2626',
        color: 'white',
        padding: '16px 24px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        fontWeight: 500,
        transform: showErrorToast ? 'translateX(0)' : 'translateX(400px)',
        transition: 'transform 0.3s ease'
      }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 6V10" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="10" cy="14" r="1" fill="white" />
        </svg>
        {errorToastMessage}
      </div>

      {/* Success Toast */}
      <div className={`success-toast ${showSuccessToast ? 'show' : ''}`} style={{
        position: 'fixed',
        top: '70px',
        right: '20px',
        background: 'var(--ok)',
        color: '#fff',
        padding: '12px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '14px',
        fontWeight: 500,
        transform: showSuccessToast ? 'translateX(0)' : 'translateX(400px)',
        transition: 'transform 0.3s ease'
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {successToastMessage}
      </div>

      {/* Invite Link Display */}
      {lastInviteLink && (
        <div style={{
          position: 'fixed',
          top: '130px',
          right: '20px',
          background: 'var(--bg2)',
          border: '1px solid var(--bdr)',
          borderRadius: '8px',
          padding: '16px',
          zIndex: 9998,
          maxWidth: '400px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '10px',
            color: 'var(--txt)',
            fontWeight: 600,
            fontSize: '13px'
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pr)" strokeWidth="2">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
            </svg>
            Share this invite link:
            <button
              onClick={() => setLastInviteLink('')}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                color: 'var(--t2)',
                cursor: 'pointer',
                padding: '2px'
              }}
              title="Close"
            >
              ✕
            </button>
          </div>
          <div style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'center'
          }}>
            <input
              type="text"
              readOnly
              value={lastInviteLink}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '4px',
                border: '1px solid var(--bdr)',
                background: 'var(--bg)',
                color: 'var(--txt)',
                fontSize: '12px',
                fontFamily: 'monospace'
              }}
            />
            <button
              onClick={() => {
                navigator.clipboard.writeText(lastInviteLink);
                alert('Link copied to clipboard!');
              }}
              style={{
                padding: '8px 12px',
                background: 'var(--pr)',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 500,
                whiteSpace: 'nowrap'
              }}
            >
              Copy
            </button>
          </div>
          <div style={{
            marginTop: '8px',
            fontSize: '11px',
            color: 'var(--t2)'
          }}>
            Send this link to the person you want to invite. They can open it to join your organization.
          </div>
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="logo">
          <div className="logo-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" />
              <path d="M2 17L12 12L22 17" />
              <path d="M2 7L2 17L12 12L22 7" />
            </svg>
          </div>
          AegisDesk
        </div>

        {/* Incident Badge */}
        <div className="inc-badge" id="incidentBadge" style={selectedIncident && selectedIncident.status !== 'resolved' ? { display: 'flex' } : { display: 'none' }}>
          <span className="idot"></span>
          <span id="hIncId">{selectedIncident?.id}</span>
          <span className="isep">|</span>
          <span id="incidentTitle">{selectedIncident?.title}</span>
        </div>

        {/* Team Pill */}
        <div className="team-pill" onClick={() => setShowTeamModal(true)}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--t2)' }}>
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <div className="avstack">
            {team.slice(0, 3).map((m, i) => (
              <div key={m.id} className={`av c${i}`}>{m.avatar}</div>
            ))}
          </div>
          <span id="mcount" style={{ fontSize: '12px' }}>{team.length}</span>
        </div>

        {/* Sync Pill */}
        <div className={`sync-pill ${isOnline ? 'online' : 'offline'}`} id="syncPill">
          <span className="sdot"></span>
          <span id="syncTxt">{isOnline ? 'Synced' : 'Offline'}</span>
        </div>

        <div className="hsep" style={{ marginRight: '16px' }}></div>

        {/* Header Metrics */}
        <div className="hmetrics">
          <div className="hm">
            <span className="hmv s1" id="hv1" style={{ color: activeIncidents.filter(i => i.severity === 'SEV-1').length > 0 ? 'var(--s1)' : 'var(--t1)' }}>
              {activeIncidents.filter(i => i.severity === 'SEV-1').length}
            </span>
            <span className="hml">SEV-1</span>
          </div>
          <div className="hm">
            <span className="hmv ag" id="hvag">{agents.filter(a => a.status === 'working').length}</span>
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
          <div className="hm" style={{ marginLeft: '8px', paddingLeft: '8px', borderLeft: '1px solid var(--bd)' }}>
            <span className="hmv" id="runTime" style={{ color: 'var(--t0)' }}>{formatRuntime(runTime)}</span>
            <span className="hml">running</span>
          </div>
        </div>

        {/* Header Right */}
        <div className="hright">
          {/* Notifications */}
          <button className="icon-btn" id="notifBtn" ref={notifBtnRef} onClick={() => setShowNotifDD(!showNotifDD)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span className="nbadge" id="nbadge" style={{ display: unreadCount > 0 ? 'flex' : 'none' }}>{unreadCount}</span>
          </button>

          {/* Notif Dropdown */}
          <div className={`dd notif-dd ${showNotifDD ? '' : 'hidden'}`} id="notifDD" style={{ top: 'calc(100% + 6px)', right: '0', minWidth: '340px' }}>
            <div className="dd-head">
              <div className="dd-head-title">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                </svg>
                Notifications
                <span id="nbadge2" style={{ background: 'rgba(63,185,80,.18)', color: 'var(--ok)', fontSize: '10px', padding: '1px 7px', borderRadius: '10px', fontWeight: 600, marginLeft: '8px' }}>
                  {unreadCount === 0 ? 'All read' : `${unreadCount} new`}
                </span>
              </div>
              <button className="dd-clear" onClick={clearNotifs}>Mark all read</button>
            </div>
            <div id="notifList">
              {notifications.map(n => (
                <div key={n.id} className={`dd-notif ${n.read ? 'read' : ''}`} style={{ padding: '10px 14px', borderBottom: '1px solid var(--bd)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span className={`ndot ${n.type}`} style={{ width: '6px', height: '6px', borderRadius: '50%', background: n.type === 'warning' ? 'var(--wn)' : n.type === 'success' ? 'var(--ok)' : 'var(--al)' }}></span>
                    <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--t0)', cursor: 'pointer' }} onClick={() => handleNotificationClick(n)}>{n.title}</span>
                    {n.inviteToken && <span style={{ marginLeft: 'auto', fontSize: '10px', background: 'var(--al)', color: '#fff', padding: '2px 6px', borderRadius: '4px' }}>INVITE</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--t2)', marginLeft: '14px' }}>{n.message}</div>
                  {n.inviteToken && (
                    <div style={{ marginLeft: '14px', marginTop: '8px' }}>
                      <button
                        style={{
                          background: 'var(--ok)',
                          color: '#fff',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Accept Invite
                      </button>
                    </div>
                  )}
                  <div style={{ fontSize: '10px', color: 'var(--t2)', marginLeft: '14px', marginTop: '4px' }}>{n.time}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Help */}
          <button className="icon-btn" onClick={() => setShowDocModal(true)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </button>

          {/* Profile */}
          <div style={{ position: 'relative' }}>
            <div className="profile-btn" ref={profileBtnRef} onClick={() => setShowProfileDD(!showProfileDD)}>
              <div className="pav" id="pav">{user?.name?.charAt(0) || '?'}</div>
              <span className="pname" id="pname">{user?.name || 'User'}</span>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            <div className={`dd profile-dd ${showProfileDD ? '' : 'hidden'}`} id="profileDD" style={{ top: 'calc(100% + 6px)', right: '0' }}>
              <div className="pd-head">
                <div className="pd-avlg" id="pdAvLg">{user?.name?.charAt(0) || '?'}</div>
                <div>
                  <div className="pd-name" id="pdName">{user?.name || 'User'}</div>
                  <div className="pd-email" id="pdEmail">{user?.email || 'user@email.com'}</div>
                  <div className="pd-role" id="pdRole">
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    {user?.role || 'User'}
                  </div>
                </div>
              </div>
              <div className="pd-stats">
                <div className="pd-stat">
                  <div className="pd-statv" id="pdInc">{incidents.length}</div>
                  <div className="pd-statl">Incidents</div>
                </div>
                <div className="pd-stat">
                  <div className="pd-statv" id="pdRca">{timeline.filter(t => t.agent === 'Triage-7').length}</div>
                  <div className="pd-statl">RCAs</div>
                </div>
              </div>
              <button className="dd-item" onClick={() => { setShowProfileDD(false); setShowProfileModal(true); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                  <circle cx="12" cy="7" r="4" />
                </svg>
                View Profile
              </button>
              <button className="dd-item" onClick={() => { setShowProfileDD(false); setShowPrefsModal(true); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Preferences
              </button>
              <div className="dd-sep"></div>
              <button className="dd-item danger" onClick={doLogout}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="body">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sb-hdr">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="3" width="20" height="14" rx="2" />
            </svg>
            AI Agents
          </div>
          <div className="agent-scroll" id="agentList">
            {agents.map(agent => (
              <div key={agent.id} className={`sb-agent ${agent.status}`}>
                {/* Top row: icon + info + button + status */}
                <div className="sb-agent-row">
                  <div className="sb-agent-icon" style={{ background: agent.color }}>
                    {agent.name.charAt(0)}
                  </div>
                  <div className="sb-agent-info" onClick={() => openAgentModal(agent)}>
                    <div className="sb-agent-name">{agent.name}</div>
                    <div className="sb-agent-role">{agent.role}</div>
                  </div>
                  {/* Play/Pause button for each agent */}
                  <button
                    className={`sb-agent-btn ${agent.status}`}
                    onClick={() => agent.status === 'working' ? stopAgent(agent.id) : runAgent(agent.id)}
                    title={agent.status === 'working' ? 'Stop agent' : 'Run agent'}
                  >
                    {agent.status === 'working' ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16" />
                        <rect x="14" y="4" width="4" height="16" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    )}
                  </button>
                  <div className={`sb-agent-status ${agent.status}`}>
                    {agent.status === 'working' ? `${Math.round(agent.progress)}%` : agent.status}
                  </div>
                </div>
                {/* Progress bar below - only shows when working */}
                {agent.status === 'working' && (
                  <div className="sb-agent-progress">
                    <div className="sb-progress-fill" style={{ width: `${agent.progress}%`, background: agent.color }}></div>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="sb-actions">
            <div className="sb-hdr">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Actions
            </div>
            <button className="abtn" onClick={() => setShowNiModal(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="16" />
                <line x1="8" y1="12" x2="16" y2="12" />
              </svg>
              New Incident
            </button>
            <button className="abtn" onClick={() => setShowLogsModal(true)}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              </svg>
              Paste Logs
            </button>
            <button className="abtn" onClick={triggerRCA}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              Run RCA
            </button>
            <button className="abtn" onClick={genSummary}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <line x1="16" y1="13" x2="8" y2="13" />
              </svg>
              Generate Summary
            </button>
            <button className="abtn danger" onClick={resolveInc}>
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
                {activeIncidents.length === 0 ? (
                  <div className="car-empty">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                      <line x1="12" y1="9" x2="12" y2="13" />
                      <line x1="12" y1="17" x2="12.01" y2="17" />
                    </svg>
                    No active incidents
                  </div>
                ) : (
                  <>
                    {/* Show all incidents without duplication - width will accommodate full content */}
                    {activeIncidents.map((inc, idx) => (
                      <div
                        key={`${inc.id}-${idx}`}
                        className={`car-card ${selectedIncident?.id === inc.id ? 'active' : ''}`}
                        onClick={() => setSelectedIncident(inc)}
                      >
                        <span className="car-sev" style={{ background: getSeverityColor(inc.severity) }}>{inc.severity}</span>
                        <span className="car-id">{inc.id}</span>
                        <span className="car-title">{inc.title}</span>
                        <span className="car-status">{inc.status}</span>
                      </div>
                    ))}
                  </>
                )}
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
            <div className="tl-body" id="tlBody">
              {timeline.filter(t => !selectedIncident || t.incident_id === selectedIncident.id).map(event => (
                <div key={event.id} className={`tl-ev ${event.type}`}>
                  <div className="tl-dot" style={{
                    background: event.agent === 'Triage-7' ? '#58a6ff' :
                      event.agent === 'Remedy-3' ? '#bc8cff' :
                        event.agent === 'Comms-1' ? '#d29922' :
                          event.agent === 'PostMort-2' ? '#3fb950' :
                            event.agent === 'You' ? '#f0f6fc' : '#8b949e'
                  }}></div>
                  <div className="tl-meta">
                    <span className="tl-agent">{event.agent}</span>
                    <span className="tl-time">{formatTime(event.timestamp)}</span>
                  </div>
                  <div className="tl-msg">{event.message}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Workspace */}
          <div className="ws">
            <div className="tbar">
              <button className={`tab ${activeTab === 'summary' ? 'active' : ''}`} data-tab="summary" onClick={() => setActiveTab('summary')}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
                Summary
              </button>
              <button className={`tab ${activeTab === 'logs' ? 'active' : ''}`} data-tab="logs" onClick={() => setActiveTab('logs')}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                </svg>
                Logs
              </button>
              <button className={`tab ${activeTab === 'runbook' ? 'active' : ''}`} data-tab="runbook" onClick={() => setActiveTab('runbook')}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                  <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                </svg>
                Runbook
              </button>
              <button className={`tab ${activeTab === 'trace' ? 'active' : ''}`} data-tab="trace" onClick={() => setActiveTab('trace')}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                </svg>
                Trace
              </button>
              <button className={`tab ${activeTab === 'workflow' ? 'active' : ''}`} data-tab="workflow" onClick={() => setActiveTab('workflow')}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="17 1 21 5 17 9" />
                  <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                </svg>
                Workflow
              </button>
              <button className={`tab ${activeTab === 'audit' ? 'active' : ''}`} data-tab="audit" onClick={() => setActiveTab('audit')}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
                Audit
              </button>
              <button className={`tab ${activeTab === 'offline' ? 'active' : ''}`} data-tab="offline" onClick={() => setActiveTab('offline')}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="1" y1="1" x2="23" y2="23" />
                  <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
                  <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
                </svg>
                Offline Queue
              </button>
            </div>
            <div className="wsbody" id="wsbody">
              {activeTab === 'summary' && (
                <div className="ws-summary">
                  {selectedIncident ? (
                    <>
                      <h3>Incident Summary</h3>
                      <div className="sum-grid">
                        <div className="sum-card">
                          <div className="sum-label">Incident ID</div>
                          <div className="sum-value">{selectedIncident.id}</div>
                        </div>
                        <div className="sum-card">
                          <div className="sum-label">Severity</div>
                          <div className="sum-value" style={{ color: getSeverityColor(selectedIncident.severity) }}>{selectedIncident.severity}</div>
                        </div>
                        <div className="sum-card">
                          <div className="sum-label">Status</div>
                          <div className="sum-value" style={{ color: getStatusColor(selectedIncident.status) }}>{selectedIncident.status}</div>
                        </div>
                        <div className="sum-card">
                          <div className="sum-label">Created</div>
                          <div className="sum-value">{selectedIncident.created_at ? formatTime(selectedIncident.created_at) : ""}</div>
                        </div>
                      </div>
                      <div className="sum-desc">
                        <div className="sum-label">Description</div>
                        <p>{selectedIncident.description || selectedIncident.title}</p>
                      </div>
                    </>
                  ) : (
                    <div className="ws-empty">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <h3>No Incident Selected</h3>
                      <p>Select an incident from the carousel above or create a new incident to get started.</p>
                      <button className="btn-pri" onClick={() => setShowNiModal(true)}>
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Create Incident
                      </button>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'logs' && (
                <div className="ws-logs">
                  {ingestedLogs.length === 0 ? (
                    <div className="ws-empty">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                      </svg>
                      <p>No logs ingested yet</p>
                      <span>Paste logs or create an incident to see log entries here</span>
                      <button className="btn-pri" onClick={() => setShowLogsModal(true)}>Paste Logs</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4>Log Entries ({ingestedLogs.length})</h4>
                        <button className="btn-ghost" onClick={() => setShowLogsModal(true)}>Paste More</button>
                      </div>
                      {ingestedLogs.map((log, idx) => (
                        <div key={idx} className="log-line" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                          {log}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
              {activeTab === 'runbook' && (
                <div className="ws-runbook">
                  <div className="ws-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
                    </svg>
                    <p>No runbook available</p>
                    <span>Runbook steps will appear when an incident is active</span>
                  </div>
                </div>
              )}
              {activeTab === 'trace' && (
                <div className="ws-trace">
                  <div className="ws-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <circle cx="11" cy="11" r="8" />
                      <line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <p>No trace data available</p>
                    <span>Distributed tracing will appear when analyzing an incident</span>
                  </div>
                </div>
              )}
              {activeTab === 'workflow' && (
                <div className="ws-workflow">
                  <div className="ws-empty">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <polyline points="17 1 21 5 17 9" />
                      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                      <path d="M7 23l-4-4 4-4" />
                      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                    </svg>
                    <p>No active workflow</p>
                    <span>Workflow status will appear when an incident is being resolved</span>
                  </div>
                </div>
              )}
              {activeTab === 'audit' && (
                <div className="ws-audit">
                  {timeline.length === 0 ? (
                    <div className="ws-empty">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <p>No audit entries yet</p>
                      <span>All actions will be logged here for audit purposes</span>
                    </div>
                  ) : (
                    timeline.map(event => (
                      <div key={event.id} className="audit-entry">
                        <span className="audit-time">{formatTime(event.timestamp)}</span>
                        <span className="audit-user">{event.agent}</span>
                        <span className="audit-action">{event.message}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
              {activeTab === 'offline' && (
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
                  placeholder="Describe what you're seeing, or use /command..."
                  rows={1}
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <div className="qcs">
                  <span className="qc" onClick={() => setCmd('/logs ')}>/logs</span>
                  <span className="qc" onClick={() => setCmd('/scale ')}>/scale</span>
                  <span className="qc" onClick={() => setCmd('/rollback ')}>/rollback</span>
                  <span className="qc" onClick={() => setCmd('/rca ')}>/rca</span>
                </div>
              </div>
              <div className="cmd-right">
                <div className="ag-dd-wrap" ref={agDDRef}>
                  <button className="ag-dd-btn" onClick={() => setShowAgDD(!showAgDD)}>
                    Ask Agent
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <div className={`ag-dd-menu ${showAgDD ? '' : 'hidden'}`} id="agDD">
                    <div className="ag-ddi" onClick={() => agCmd('triage')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--al)" strokeWidth="2">
                        <circle cx="11" cy="11" r="8" />
                      </svg>
                      Triage — Analyze logs
                    </div>
                    <div className="ag-ddi" onClick={() => agCmd('remedy')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ar)" strokeWidth="2">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                      </svg>
                      Remedy — Root cause
                    </div>
                    <div className="ag-ddi" onClick={() => agCmd('runbook')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ag)" strokeWidth="2">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                      </svg>
                      Runbook — Playbook
                    </div>
                    <div className="ag-ddi" onClick={() => agCmd('comms')}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--ac)" strokeWidth="2">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                      Comms — Draft update
                    </div>
                  </div>
                </div>
                <button className="send-btn" onClick={() => handleCommand()}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
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
              <span className="ldot" style={{ background: 'var(--s1)' }}></span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
              Error Rate (5m)
            </div>
            <div className="chart" id="errChart">
              <svg viewBox="0 0 200 60" style={{ width: '100%', height: '60px' }}>
                <polyline
                  fill="none"
                  stroke="var(--s1)"
                  strokeWidth="1.5"
                  points={metrics.history.length > 0
                    ? metrics.history.map((h, i) => `${i * (200 / (metrics.history.length - 1))},${60 - (h.errors / Math.max(...metrics.history.map(mh => mh.errors)) * 50)}`).join(' ')
                    : "0,45 20,42 40,48 60,35 80,40 100,30 120,38 140,25 160,32 180,20 200,28"
                  }
                />
                <polyline
                  fill="none"
                  stroke="var(--al)"
                  strokeWidth="1"
                  strokeDasharray="3,2"
                  points={metrics.history.length > 0
                    ? metrics.history.map((h, i) => `${i * (200 / (metrics.history.length - 1))},${60 - (h.latency / Math.max(...metrics.history.map(mh => mh.latency)) * 50)}`).join(' ')
                    : "0,30 20,28 40,32 60,25 80,28 100,20 120,25 140,15 160,20 180,12 200,18"
                  }
                />
              </svg>
            </div>
            <div className="clabels">
              <span id="ct0" style={{ color: 'var(--s1)' }}>{metrics.errorsPerSec.toFixed(1)}/s</span>
              <span id="ct1" style={{ color: 'var(--al)' }}>{metrics.p99Latency}ms</span>
              <span id="ct2" style={{ color: 'var(--ok)' }}>{(metrics.throughput / 1000).toFixed(1)}k/s</span>
            </div>
            <div className="cleg">
              <div className="lg">
                <span className="lgd e" style={{ background: 'var(--s1)' }}></span>
                errors/sec
              </div>
              <div className="lg">
                <span className="lgd l" style={{ background: 'var(--al)' }}></span>
                p99 latency
              </div>
              <div className="lg">
                <span className="lgd t" style={{ background: 'var(--ok)' }}></span>
                throughput
              </div>
            </div>
          </div>

          <div className="rps">
            <div
              className="rph"
              onClick={() => setShowAgentActivity(!showAgentActivity)}
              style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0' }}
            >
              {/* Line 1: AGENT ACTIVITY - Centered */}
              <div style={{ textAlign: 'center', width: '100%' }}>
                <span style={{ fontWeight: 600, fontSize: 11 }}>AGENT ACTIVITY</span>
              </div>

              {/* Line 2: Agents (left) and dots + online count (right) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                <span style={{ fontSize: 11, color: '#94a3b8' }}>Agents</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {/* Colored dots representing online agents */}
                  {agents.filter((a: Agent) => a.status === 'working').map((a: Agent) => (
                    <span key={a.id} style={{ width: 6, height: 6, borderRadius: '50%', background: a.color, display: 'inline-block' }}></span>
                  ))}
                  <span style={{
                    fontSize: 10,
                    color: agents.filter((a: Agent) => a.status === 'working').length > 0 ? '#22c55e' : '#ef4444',
                    fontWeight: 500,
                    marginLeft: 2
                  }}>
                    ● {agents.filter((a: Agent) => a.status === 'working').length} online
                  </span>
                </div>
              </div>

              {/* Line 3: Dropdown arrow - centered and unfilled */}
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 2 }}>
                {showAgentActivity ? (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                ) : (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2">
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </div>
            </div>
            {/* Agent Status - Real-time from API - Collapsible */}
            {showAgentActivity && (
              <div className="agent-activity-compact">
                <AgentStatus variant="embedded" />
              </div>
            )}
            <div className="fhdr">
              <span className="ldot" style={{ background: syncStatus.connected ? 'var(--ok)' : 'var(--er)' }}></span>
              PowerSync Live {syncStatus.status === 'syncing' ? '(syncing...)' : ''}

            </div>
            <div className="flist" id="flist">
              {syncStatus.tables && syncStatus.tables.length > 0 ? (
                syncStatus.tables.map((table, idx) => (
                  <div key={table.name || idx} className="fl-item">
                    <span className="fl-dot" style={{ background: table.status === 'synced' ? 'var(--ok)' : 'var(--al)' }}></span>
                    <span className="fl-msg">Synced {table.displayName} ({table.count} records)</span>
                  </div>
                ))
              ) : (
                <>
                  <div className="fl-item">
                    <span className="fl-dot" style={{ background: 'var(--ok)' }}></span>
                    <span className="fl-msg">Synced incidents table</span>
                  </div>
                  <div className="fl-item">
                    <span className="fl-dot" style={{ background: 'var(--ok)' }}></span>
                    <span className="fl-msg">Synced timeline table</span>
                  </div>
                  <div className="fl-item">
                    <span className="fl-dot" style={{ background: 'var(--ok)' }}></span>
                    <span className="fl-msg">Synced agents table</span>
                  </div>
                </>
              )}
            </div>

            {/* Local AI Status - Below PowerSync Live */}
            <div style={{ marginTop: 16 }}>
              <LocalAIStatus />
            </div>
          </div>
        </aside>
      </div>

      {/* Team Modal */}
      <div className={`mov ${showTeamModal ? '' : 'hidden'}`} onClick={(e) => { if (e.target === e.currentTarget) setShowTeamModal(false); }}>
        <div className="mod">
          <div className="mhdr">
            <span className="mtit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Team Members
            </span>
            <button className="mcl" onClick={() => setShowTeamModal(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="mbdy">
            <div id="memList">
              {team.map(m => (
                <div key={m.id} className="mem-item">
                  <div className="mem-av" style={{ background: `hsl(${m.name.charCodeAt(0) * 10}, 60%, 50%)` }}>{m.avatar}</div>
                  <div className="mem-info">
                    <div className="mem-name">
                      {m.name}
                      {m.isCurrentUser && <span className="mem-you-badge">(you)</span>}
                      {m.status === 'pending' && <span className="mem-pending-badge">Pending</span>}
                    </div>
                    <div className="mem-email">{m.email}</div>
                  </div>
                  <div className="mem-role">{m.role}</div>
                  {m.status === 'pending' ? (
                    <button
                      className="mem-delete"
                      onClick={() => cancelInvitation(m.id, m.email)}
                      title="Cancel invitation"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  ) : (
                    <button
                      className="mem-delete"
                      onClick={() => removeTeamMember(m.id, m.email)}
                      title="Remove from team"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="madd">
              <input className="minput" id="newMName" placeholder="Name" value={newMName} onChange={(e) => setNewMName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTeamMember()} />
              <input className="minput" id="newMEmail" placeholder="Email" style={{ flex: 1.2 }} value={newMEmail} onChange={(e) => setNewMEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTeamMember()} />
              <select className="msel" id="newMRole" value={newMRole} onChange={(e) => { setNewMRole(e.target.value); setShowCustomRole(e.target.value === 'custom'); }}>
                <option>Engineer</option>
                <option>On-Call</option>
                <option>Lead</option>
                <option>SRE</option>
                <option>Manager</option>
                <option value="custom">+ Custom Role</option>
              </select>
              {showCustomRole && (
                <input
                  className="minput"
                  placeholder="Enter custom role"
                  style={{ flex: 1 }}
                  value={newMCustomRole}
                  onChange={(e) => setNewMCustomRole(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addTeamMember()}
                />
              )}
              <button className="mbtn" onClick={addTeamMember}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Detail Modal */}
      <div className={`mov ${showAgentModal ? '' : 'hidden'}`} onClick={(e) => { if (e.target === e.currentTarget) setShowAgentModal(false); }}>
        <div className="mod amod">
          <div className="mhdr">
            <span className="mtit" id="agModalTitle">Agent Detail</span>
            <button className="mcl" onClick={() => setShowAgentModal(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="mbdy" id="agModalBody">
            {selectedAgent && (
              <div className="ag-detail">
                <div className="ag-detail-header">
                  <div className="ag-detail-icon" style={{ background: selectedAgent.color }}>{selectedAgent.name.charAt(0)}</div>
                  <div>
                    <div className="ag-detail-name">{selectedAgent.name}</div>
                    <div className="ag-detail-role">{selectedAgent.role}</div>
                  </div>
                </div>
                <div className="ag-detail-status">
                  <span className={`ag-status-badge ${selectedAgent.status}`}>{selectedAgent.status}</span>
                </div>
                {selectedAgent.status === 'working' && (
                  <div className="ag-detail-progress">
                    <div className="ag-progress-label">Progress</div>
                    <div className="ag-progress-bar">
                      <div className="ag-progress-fill" style={{ width: `${selectedAgent.progress}%`, background: selectedAgent.color }}></div>
                    </div>
                    <div className="ag-progress-pct">{Math.round(selectedAgent.progress)}%</div>
                  </div>
                )}
                {selectedAgent.lastOutput && (
                  <div className="ag-detail-output">
                    <div className="ag-output-label">Last Output</div>
                    <div className="ag-output-text">{selectedAgent.lastOutput}</div>
                  </div>
                )}
                <button className="ag-run-btn" onClick={() => { runAgent(selectedAgent.id); setShowAgentModal(false); }} disabled={selectedAgent.status === 'working'}>
                  {selectedAgent.status === 'working' ? 'Running...' : 'Run Agent'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* New Incident Modal */}
      <div className={`mov ${showNiModal ? '' : 'hidden'}`} onClick={(e) => { if (e.target === e.currentTarget) setShowNiModal(false); }}>
        <div className="mod ni-mod">
          <div className="mhdr">
            <span className="mtit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
              New Incident
            </span>
            <button className="mcl" onClick={() => setShowNiModal(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="mbdy">
            <div className="fg">
              <div className="fl">Title</div>
              <input className="fi" id="niTitle" placeholder="e.g. Payment API elevated errors" value={newIncTitle} onChange={(e) => setNewIncTitle(e.target.value)} />
            </div>
            <div className="fg">
              <div className="fl">Severity</div>
              <div style={{ display: 'flex', gap: '6px' }} id="sevBtns">
                {[1, 2, 3, 4].map(sev => (
                  <button
                    key={sev}
                    onClick={() => setNewIncSev(sev)}
                    className="sev-btn"
                    data-s={sev}
                    style={{
                      padding: '5px 12px',
                      borderRadius: '5px',
                      border: `1px solid ${newIncSev === sev ? getSeverityColor(`SEV-${sev}`) : 'var(--bd)'}`,
                      background: newIncSev === sev ? `${getSeverityColor(`SEV-${sev}`)}18` : 'var(--bg2)',
                      color: newIncSev === sev ? getSeverityColor(`SEV-${sev}`) : 'var(--t2)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 600,
                      fontFamily: 'var(--fu)'
                    }}
                  >
                    SEV-{sev}
                  </button>
                ))}
              </div>
            </div>
            <div className="fg">
              <div className="fl">Description</div>
              <textarea className="fta" id="niDesc" placeholder="What is happening..." value={newIncDesc} onChange={(e) => setNewIncDesc(e.target.value)}></textarea>
            </div>
            <div className="fg">
              <div className="fl">Affected Service</div>
              <input className="fi" id="niSvc" placeholder="e.g. payment-gateway" value={newIncSvc} onChange={(e) => setNewIncSvc(e.target.value)} />
            </div>
          </div>
          <div className="mftr">
            {createError && <div className="error-msg" style={{ color: 'var(--er)', fontSize: '12px', marginBottom: '8px', width: '100%' }}>{createError}</div>}
            <button className="btn-ghost" onClick={() => { setShowNiModal(false); setCreateError(null); }}>Cancel</button>
            <button className="btn-pri" onClick={createIncident} disabled={isCreating}>
              {isCreating ? (
                'Creating...'
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Create
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Paste Logs Modal */}
      <div className={`mov ${showLogsModal ? '' : 'hidden'}`} onClick={(e) => { if (e.target === e.currentTarget) setShowLogsModal(false); }}>
        <div className="mod" style={{ width: '500px' }}>
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
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="mbdy">
            <textarea
              className="fta"
              id="logInput"
              style={{ minHeight: '160px', color: 'var(--ok)', fontFamily: 'var(--fm)' }}
              placeholder="[14:31:02] ERROR payment-gateway: TLS handshake timeout..."
              value={logInput}
              onChange={(e) => setLogInput(e.target.value)}
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

      {/* Documentation Modal */}
      <div className={`mov ${showDocModal ? '' : 'hidden'}`} onClick={(e) => { if (e.target === e.currentTarget) setShowDocModal(false); }}>
        <div className="mod" style={{ width: '560px', maxHeight: '85vh' }}>
          <div className="mhdr">
            <span className="mtit">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              AegisDesk Help
            </span>
            <button className="mcl" onClick={() => setShowDocModal(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="mbdy" style={{ padding: '16px', overflowY: 'auto', maxHeight: 'calc(85vh - 120px)' }}>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: 'var(--t0)', margin: '0 0 8px 0', fontSize: '14px' }}>🚀 Quick Start</h4>
              <p style={{ color: 'var(--t2)', fontSize: '12px', margin: 0, lineHeight: 1.5 }}>AegisDesk is an AI-powered incident management system. When an incident occurs, autonomous agents automatically triage, analyze, and help resolve issues.</p>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: 'var(--t0)', margin: '0 0 8px 0', fontSize: '14px' }}>👥 Team Collaboration</h4>
              <p style={{ color: 'var(--t2)', fontSize: '12px', margin: '0 0 8px 0', lineHeight: 1.5 }}>Click the team pill in the header to add team members.</p>
              <ul style={{ color: 'var(--t2)', fontSize: '12px', margin: 0, paddingLeft: '18px', lineHeight: 1.8 }}>
                <li><strong style={{ color: 'var(--t0)' }}>Engineer</strong> - Technical responder</li>
                <li><strong style={{ color: 'var(--t0)' }}>On-Call</strong> - Primary responder</li>
                <li><strong style={{ color: 'var(--t0)' }}>Lead</strong> - Incident commander</li>
                <li><strong style={{ color: 'var(--t0)' }}>SRE</strong> - Site reliability</li>
              </ul>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: 'var(--t0)', margin: '0 0 8px 0', fontSize: '14px' }}>🤖 AI Agents</h4>
              <ul style={{ color: 'var(--t2)', fontSize: '12px', margin: 0, paddingLeft: '18px', lineHeight: 1.8 }}>
                <li><strong style={{ color: 'var(--al)' }}>Triage-7</strong> - Analyzes logs and identifies root cause</li>
                <li><strong style={{ color: 'var(--ar)' }}>Remedy-3</strong> - Executes runbook steps automatically</li>
                <li><strong style={{ color: 'var(--ac)' }}>Comms-1</strong> - Drafts stakeholder updates</li>
                <li><strong style={{ color: 'var(--ag)' }}>PostMort-2</strong> - Generates post-incident reports</li>
              </ul>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: 'var(--t0)', margin: '0 0 8px 0', fontSize: '14px' }}>⚡ Commands</h4>
              <ul style={{ color: 'var(--t2)', fontSize: '12px', margin: 0, paddingLeft: '18px', lineHeight: 1.8 }}>
                <li><code style={{ background: 'var(--bg2)', padding: '2px 6px', borderRadius: '3px' }}>/new &lt;title&gt;</code> - Create new incident</li>
                <li><code style={{ background: 'var(--bg2)', padding: '2px 6px', borderRadius: '3px' }}>/rca</code> - Run root cause analysis</li>
                <li><code style={{ background: 'var(--bg2)', padding: '2px 6px', borderRadius: '3px' }}>/resolve</code> - Mark incident resolved</li>
                <li><code style={{ background: 'var(--bg2)', padding: '2px 6px', borderRadius: '3px' }}>/logs &lt;text&gt;</code> - Paste logs for analysis</li>
              </ul>
            </div>
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ color: 'var(--t0)', margin: '0 0 8px 0', fontSize: '14px' }}>⌨️ Keyboard Shortcuts</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg2)', padding: '6px 10px', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--t2)', fontSize: '11px' }}>New Incident</span>
                  <kbd style={{ background: 'var(--bg1)', color: 'var(--t0)', padding: '2px 6px', borderRadius: '3px', fontSize: '10px' }}>Ctrl+N</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg2)', padding: '6px 10px', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--t2)', fontSize: '11px' }}>Paste Logs</span>
                  <kbd style={{ background: 'var(--bg1)', color: 'var(--t0)', padding: '2px 6px', borderRadius: '3px', fontSize: '10px' }}>Ctrl+L</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg2)', padding: '6px 10px', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--t2)', fontSize: '11px' }}>Run RCA</span>
                  <kbd style={{ background: 'var(--bg1)', color: 'var(--t0)', padding: '2px 6px', borderRadius: '3px', fontSize: '10px' }}>Ctrl+R</kbd>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg2)', padding: '6px 10px', borderRadius: '4px' }}>
                  <span style={{ color: 'var(--t2)', fontSize: '11px' }}>Resolve</span>
                  <kbd style={{ background: 'var(--bg1)', color: 'var(--t0)', padding: '2px 6px', borderRadius: '3px', fontSize: '10px' }}>Ctrl+Enter</kbd>
                </div>
              </div>
            </div>
          </div>
          <div className="mftr">
            <button className="btn-pri" onClick={() => setShowDocModal(false)}>Got it</button>
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
              <div id="profileAvatar" style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--al), var(--ar))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 600, color: 'white' }}>
                {user?.name?.charAt(0) || '?'}
              </div>
              <div>
                <div id="profileName" style={{ fontSize: '18px', fontWeight: 600, color: 'var(--t0)', marginBottom: '4px' }}>{user?.name || 'User'}</div>
                <div id="profileRole" style={{ fontSize: '12px', color: 'var(--al)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  {user?.role || 'User'}
                </div>
              </div>
            </div>
            <div style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', color: 'var(--t2)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Account Details</div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--t2)', marginBottom: '4px' }}>Email</div>
                <div id="profileEmail" style={{ fontSize: '13px', color: 'var(--t0)' }}>{user?.email || 'user@email.com'}</div>
              </div>
              <div style={{ marginBottom: '12px' }}>
                <div style={{ fontSize: '11px', color: 'var(--t2)', marginBottom: '4px' }}>Organization</div>
                {editingOrg ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--bdl)', background: 'var(--bg)', color: 'var(--t0)', fontSize: '13px' }}
                      autoFocus
                    />
                    <button
                      onClick={saveOrgName}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: 'none', background: 'var(--primary)', color: 'white', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => { setEditingOrg(false); setOrgName(user?.organizationName || ''); }}
                      style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--bdl)', background: 'transparent', color: 'var(--t1)', fontSize: '12px', cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div id="profileOrg" style={{ fontSize: '13px', color: 'var(--t0)' }}>{user?.organizationName || 'My Organization'}</div>
                    <button
                      onClick={() => setEditingOrg(true)}
                      style={{ padding: '2px 8px', borderRadius: '4px', border: 'none', background: 'var(--bg2)', color: 'var(--t2)', fontSize: '11px', cursor: 'pointer' }}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--t2)', marginBottom: '4px' }}>Member Since</div>
                <div id="profileJoined" style={{ fontSize: '13px', color: 'var(--t0)' }}>January 2024</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                <div id="profileIncidents" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--al)' }}>{incidents.length}</div>
                <div style={{ fontSize: '11px', color: 'var(--t2)' }}>Incidents Handled</div>
              </div>
              <div style={{ background: 'var(--bg2)', borderRadius: '8px', padding: '16px', textAlign: 'center' }}>
                <div id="profileRCAs" style={{ fontSize: '24px', fontWeight: 700, color: 'var(--ar)' }}>{timeline.filter(t => t.agent === 'Triage-7').length}</div>
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

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        
        .hidden { display: none !important; }
        
        /* Additional modal and layout styles */
        .mov {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          backdrop-filter: blur(4px);
        }
        
        .mod {
          background: var(--bg1);
          border: 1px solid var(--bd);
          border-radius: var(--r3);
          width: 400px;
          max-height: 80vh;
          display: flex;
          flex-direction: column;
          box-shadow: var(--sh);
        }
        
        .mod.amod { width: 420px; }
        .mod.ni-mod { width: 480px; }
        
        .mhdr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid var(--bd);
          flex-shrink: 0;
        }
        
        .mtit {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: var(--t0);
        }
        
        .mcl {
          background: none;
          border: none;
          color: var(--t2);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .mcl:hover {
          background: var(--bg2);
          color: var(--t0);
        }
        
        .mbdy {
          padding: 16px;
          overflow-y: auto;
          flex: 1;
        }
        
        .mftr {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding: 14px 16px;
          border-top: 1px solid var(--bd);
          flex-shrink: 0;
        }
        
        .btn-ghost {
          background: none;
          border: 1px solid var(--bd);
          color: var(--t1);
          padding: 8px 14px;
          border-radius: var(--r1);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all .2s;
        }
        
        .btn-ghost:hover {
          background: var(--bg2);
          color: var(--t0);
        }
        
        .btn-pri {
          background: var(--al);
          border: none;
          color: white;
          padding: 8px 14px;
          border-radius: var(--r1);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all .2s;
        }
        
        .btn-pri:hover {
          background: #4a90e2;
        }
        
        /* Form elements */
        .fg { margin-bottom: 14px; }
        .fl { font-size: 11px; color: var(--t2); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .fi {
          width: 100%;
          padding: 10px 12px;
          background: var(--bg2);
          border: 1px solid var(--bd);
          border-radius: var(--r1);
          color: var(--t0);
          font-size: 13px;
          font-family: var(--fu);
        }
        
        .fi:focus {
          outline: none;
          border-color: var(--al);
        }
        
        .fta {
          width: 100%;
          min-height: 80px;
          padding: 10px 12px;
          background: var(--bg2);
          border: 1px solid var(--bd);
          border-radius: var(--r1);
          color: var(--t0);
          font-size: 13px;
          font-family: var(--fu);
          resize: vertical;
        }
        
        .fta:focus {
          outline: none;
          border-color: var(--al);
        }
        
        /* Team modal */
        .mem-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid var(--bd);
        }
        
        .mem-item:last-child { border-bottom: none; }
        
        .mem-av {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
        }
        
        .mem-info { flex: 1; min-width: 0; }
        .mem-name { font-size: 13px; font-weight: 500; color: var(--t0); display: flex; align-items: center; gap: 8px; }
        .mem-email { font-size: 11px; color: var(--t2); }
        .mem-role { font-size: 11px; color: var(--al); background: rgba(88,166,255,.1); padding: 3px 8px; border-radius: 10px; }
        
        .mem-pending-badge {
          font-size: 9px;
          color: #d29922;
          background: rgba(210, 153, 34, 0.15);
          padding: 2px 6px;
          border-radius: 8px;
          font-weight: 500;
        }
        
        .mem-you-badge {
          font-size: 9px;
          color: #10b981;
          background: rgba(16, 185, 129, 0.15);
          padding: 2px 6px;
          border-radius: 8px;
          font-weight: 500;
        }
        
        .mem-delete {
          background: transparent;
          border: none;
          color: var(--t2);
          cursor: pointer;
          padding: 6px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
          opacity: 0.6;
        }
        
        .mem-delete:hover {
          background: rgba(248, 81, 73, 0.15);
          color: #f85149;
          opacity: 1;
        }
        
        .madd {
          display: flex;
          gap: 8px;
          margin-top: 16px;
          padding-top: 16px;
          border-top: 1px solid var(--bd);
          align-items: center;
        }
        
        .minput {
          padding: 8px 10px;
          background: var(--bg2);
          border: 1px solid var(--bd);
          border-radius: var(--r1);
          color: var(--t0);
          font-size: 12px;
          width: 100px;
        }
        
        .msel {
          padding: 8px 10px;
          background: var(--bg2);
          border: 1px solid var(--bd);
          border-radius: var(--r1);
          color: var(--t0);
          font-size: 12px;
        }
        
        .mbtn {
          background: var(--al);
          border: none;
          color: white;
          padding: 8px 12px;
          border-radius: var(--r1);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 4px;
          white-space: nowrap;
        }
        
        /* Dropdowns */
        .dd {
          position: absolute;
          background: var(--bg1);
          border: 1px solid var(--bd);
          border-radius: var(--r2);
          box-shadow: var(--sh);
          z-index: 200;
          overflow: hidden;
        }
        
        .dd-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 14px;
          border-bottom: 1px solid var(--bd);
        }
        
        .dd-head-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--t0);
        }
        
        .dd-clear {
          background: none;
          border: none;
          color: var(--al);
          font-size: 11px;
          cursor: pointer;
        }
        
        .dd-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          background: none;
          border: none;
          color: var(--t1);
          font-size: 13px;
          cursor: pointer;
          text-align: left;
          transition: all .2s;
        }
        
        .dd-item:hover {
          background: var(--bg2);
          color: var(--t0);
        }
        
        .dd-item.danger { color: var(--s1); }
        .dd-item.danger:hover { background: rgba(255,123,114,.1); }
        
        .dd-sep {
          height: 1px;
          background: var(--bd);
          margin: 4px 0;
        }
        
        /* Profile dropdown */
        .pd-head {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-bottom: 1px solid var(--bd);
        }
        
        .pd-avlg {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--al), var(--ar));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          font-weight: 600;
          color: white;
        }
        
        .pd-name { font-size: 14px; font-weight: 600; color: var(--t0); }
        .pd-email { font-size: 11px; color: var(--t2); }
        .pd-role { 
          font-size: 11px; 
          color: var(--al); 
          display: flex; 
          align-items: center; 
          gap: 4px; 
          margin-top: 2px;
        }
        
        .pd-stats {
          display: flex;
          border-bottom: 1px solid var(--bd);
        }
        
        .pd-stat {
          flex: 1;
          padding: 12px;
          text-align: center;
          border-right: 1px solid var(--bd);
        }
        
        .pd-stat:last-child { border-right: none; }
        
        .pd-statv { font-size: 18px; font-weight: 700; color: var(--t0); }
        .pd-statl { font-size: 10px; color: var(--t2); text-transform: uppercase; letter-spacing: 0.5px; }
        
        /* Agent dropdown menu */
        .ag-dd-wrap { position: relative; }
        
        .ag-dd-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          background: var(--bg2);
          border: 1px solid var(--bd);
          border-radius: var(--r1);
          color: var(--t1);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all .2s;
        }
        
        .ag-dd-btn:hover {
          background: var(--bg3);
          color: var(--t0);
        }
        
        .ag-dd-menu {
          position: absolute;
          bottom: calc(100% + 6px);
          right: 0;
          background: var(--bg1);
          border: 1px solid var(--bd);
          border-radius: var(--r2);
          box-shadow: var(--sh);
          min-width: 200px;
          overflow: hidden;
          z-index: 200;
        }
        
        .ag-ddi {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 14px;
          font-size: 12px;
          color: var(--t1);
          cursor: pointer;
          transition: all .2s;
        }
        
        .ag-ddi:hover {
          background: var(--bg2);
          color: var(--t0);
        }
        
        /* Body layout */
        .body {
          display: flex;
          flex: 1;
          overflow: hidden;
        }
        
        /* Sidebar */
        .sidebar {
          width: 220px;
          background: var(--bg1);
          border-right: 1px solid var(--bd);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          height: 100%;
        }
        
        .sb-hdr {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          font-size: 11px;
          font-weight: 600;
          color: var(--t2);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--bd);
          flex-shrink: 0;
        }
        
        .agent-scroll {
          max-height: 40%;
          overflow-y: auto;
          padding: 8px;
          border-bottom: 1px solid var(--bd);
        }
        
        .sb-agent {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border-radius: var(--r2);
          cursor: pointer;
          transition: all .2s;
          margin-bottom: 4px;
          position: relative;
        }
        
        .sb-agent:hover { background: var(--bg2); }
        .sb-agent.active { background: var(--bg2); }
        
        .sb-agent-icon {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          color: white;
          flex-shrink: 0;
        }
        
        .sb-agent-info { flex: 1; min-width: 0; }
        .sb-agent-name { font-size: 12px; font-weight: 500; color: var(--t0); }
        .sb-agent-role { font-size: 10px; color: var(--t2); }
        
        .sb-agent-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: var(--bg3);
          border-radius: 0 0 var(--r2) var(--r2);
          overflow: hidden;
        }
        
        .sb-progress-fill {
          height: 100%;
          transition: width .3s;
        }
        
        .sb-agent-status {
          font-size: 10px;
          font-weight: 500;
          padding: 2px 6px;
          border-radius: 8px;
          text-transform: capitalize;
        }
        
        .sb-agent-status.idle { color: var(--t2); background: var(--bg3); }
        .sb-agent-status.working { color: var(--al); background: rgba(88,166,255,.15); }
        .sb-agent-status.complete { color: var(--ok); background: rgba(63,185,80,.15); }
        
        .sb-actions {
          padding: 8px;
          border-top: 1px solid var(--bd);
        }
        
        .abtn {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 10px;
          background: none;
          border: 1px solid var(--bd);
          border-radius: var(--r1);
          color: var(--t1);
          font-size: 12px;
          cursor: pointer;
          transition: all .2s;
          margin-bottom: 6px;
        }
        
        .abtn:hover {
          background: var(--bg2);
          color: var(--t0);
          border-color: var(--bdl);
        }
        
        .abtn.danger {
          color: var(--s1);
          border-color: rgba(255,123,114,.3);
        }
        
        .abtn.danger:hover {
          background: rgba(255,123,114,.1);
          border-color: var(--s1);
        }
        
        /* Main area */
        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }
        
        /* Carousel */
        .carousel-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          background: var(--bg1);
          border-bottom: 1px solid var(--bd);
          flex-shrink: 0;
        }
        
        .car-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: var(--wn);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          flex-shrink: 0;
        }
        
        .car-track-wrap {
          flex: 1;
          overflow-x: auto;
          scrollbar-width: none;
        }
        
        .car-track::-webkit-scrollbar { display: none; }
        
        .car-track {
          display: flex;
          gap: 10px;
          animation: scroll 30s linear infinite;
        }
        
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        
        .car-empty {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 12px 20px;
          background: var(--bg2);
          border: 1px dashed var(--bd);
          border-radius: var(--r2);
          color: var(--t2);
          font-size: 12px;
        }
        
        .car-card {
          flex-shrink: 0;
          width: 280px;
          min-height: 90px;
          padding: 12px 14px;
          background: var(--bg2);
          border: 1px solid var(--bd);
          border-radius: var(--r2);
          cursor: pointer;
          transition: all .2s;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }
        
        .car-card:hover { border-color: var(--bdl); }
        .car-card.active { border-width: 2px; padding: 11px 13px; }
        
        .car-card-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 8px;
        }
        
        .car-sev { font-size: 10px; font-weight: 700; }
        .car-id { font-size: 10px; color: var(--t2); font-family: var(--fm); }
        .car-card-title { 
          font-size: 13px; 
          color: var(--t0); 
          font-weight: 500; 
          white-space: normal; 
          overflow: visible; 
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          line-height: 1.3;
          margin-bottom: 8px;
        }
        
        .car-card-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          font-size: 10px;
          margin-top: auto;
        }
        
        .car-status { text-transform: capitalize; font-weight: 500; }
        .car-time { color: var(--t2); font-family: var(--fm); }
        
        /* Timeline section */
        .tl-section {
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
          border-bottom: 1px solid var(--bd);
        }
        
        .sec-hdr {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 16px;
          background: var(--bg1);
          border-bottom: 1px solid var(--bd);
          flex-shrink: 0;
        }
        
        .sec-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          font-weight: 600;
          color: var(--t0);
        }
        
        .evcnt {
          font-size: 10px;
          color: var(--t2);
          font-weight: 400;
          margin-left: 8px;
        }
        
        .tl-body {
          flex: 1;
          overflow-y: auto;
          padding: 12px 16px;
        }
        
        .tl-ev {
          display: flex;
          gap: 12px;
          padding: 8px 0;
          position: relative;
        }
        
        .tl-ev::before {
          content: '';
          position: absolute;
          left: 5px;
          top: 24px;
          bottom: -8px;
          width: 1px;
          background: var(--bd);
        }
        
        .tl-ev:last-child::before { display: none; }
        
        .tl-dot {
          width: 11px;
          height: 11px;
          border-radius: 50%;
          flex-shrink: 0;
          margin-top: 4px;
          position: relative;
          z-index: 1;
        }
        
        .tl-meta {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 4px;
        }
        
        .tl-agent { font-size: 11px; font-weight: 600; color: var(--t0); }
        .tl-time { font-size: 10px; color: var(--t2); font-family: var(--fm); }
        .tl-msg { font-size: 12px; color: var(--t1); line-height: 1.4; }
        
        /* Workspace */
        .ws {
          display: flex;
          flex-direction: column;
          height: 280px;
          border-top: 1px solid var(--bd);
          background: var(--bg1);
        }
        
        .tbar {
          display: flex;
          gap: 2px;
          padding: 8px 12px;
          background: var(--bg1);
          border-bottom: 1px solid var(--bd);
          flex-shrink: 0;
          overflow-x: auto;
        }
        
        .tab {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          background: none;
          border: none;
          border-radius: var(--r1);
          color: var(--t2);
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          white-space: nowrap;
          transition: all .2s;
        }
        
        .tab:hover { color: var(--t0); background: var(--bg2); }
        .tab.active { color: var(--t0); background: var(--bg2); }
        
        .wsbody {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
        }
        
        .ws-tab-content { animation: fadeIn .2s; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        
        /* Workspace tab content */
        .ws-incident-header { margin-bottom: 20px; }
        .ws-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 60px 20px;
          text-align: center;
        }
        
        .ws-empty-state svg {
          margin-bottom: 20px;
          opacity: 0.4;
          color: var(--t2);
        }
        
        .ws-empty-state h3 {
          font-size: 18px;
          font-weight: 600;
          color: var(--t0);
          margin-bottom: 8px;
        }
        
        .ws-empty-state p {
          font-size: 14px;
          color: var(--t2);
          margin-bottom: 20px;
          max-width: 300px;
        }
        
        .ws-empty-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 16px;
          background: var(--al);
          border: none;
          border-radius: var(--r1);
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all .2s;
        }
        
        .ws-empty-btn:hover {
          background: #4a90e2;
        }
        
        .ws-incident-id { 
          font-size: 11px; 
          font-family: var(--fm); 
          color: var(--t2); 
          margin-bottom: 4px; 
        }
        .ws-incident-title { 
          font-size: 18px; 
          font-weight: 600; 
          color: var(--t0); 
          margin-bottom: 12px; 
        }
        .ws-incident-meta { display: flex; align-items: center; gap: 12px; }
        .ws-sev {
          font-size: 10px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid;
        }
        .ws-status { font-size: 12px; font-weight: 500; text-transform: capitalize; }
        .ws-service { font-size: 11px; color: var(--t2); font-family: var(--fm); }
        
        .ws-description { margin-bottom: 20px; }
        .ws-description h4, .ws-agents h4, .ws-logs h4, .ws-runbook h4, .ws-trace h4, .ws-workflow h4, .ws-audit h4, .ws-offline h4 {
          font-size: 11px;
          color: var(--t2);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 10px;
        }
        .ws-description p { font-size: 13px; color: var(--t1); line-height: 1.5; }
        
        .ws-agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .ws-agent-card {
          background: var(--bg2);
          border: 1px solid var(--bd);
          border-radius: var(--r2);
          padding: 12px;
        }
        .ws-agent-name { font-size: 13px; font-weight: 600; margin-bottom: 8px; }
        .ws-agent-progress { height: 4px; background: var(--bg3); border-radius: 2px; margin-bottom: 8px; overflow: hidden; }
        .ws-progress-bar { height: 100%; transition: width .3s; }
        .ws-agent-output { font-size: 11px; color: var(--t2); line-height: 1.4; }
        .ws-no-agents { font-size: 12px; color: var(--t2); font-style: italic; }
        
        /* Logs tab */
        .ws-logs-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .ws-logs-btn {
          background: var(--bg2);
          border: 1px solid var(--bd);
          color: var(--t1);
          padding: 6px 10px;
          border-radius: var(--r1);
          font-size: 11px;
          cursor: pointer;
        }
        .ws-logs-btn:hover { color: var(--t0); border-color: var(--bdl); }
        .ws-logs-body { background: var(--bg0); border-radius: var(--r2); padding: 12px; max-height: 150px; overflow-y: auto; }
        .ws-logs-body.ws-empty, .ws-runbook-empty, .ws-trace-empty, .ws-workflow-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background: var(--bg2);
          color: var(--t2);
        }
        
        .ws-logs-body.ws-empty svg, .ws-runbook-empty svg, .ws-trace-empty svg, .ws-workflow-empty svg {
          margin-bottom: 16px;
          opacity: 0.5;
        }
        
        .ws-logs-body.ws-empty p, .ws-runbook-empty p, .ws-trace-empty p, .ws-workflow-empty p {
          font-size: 14px;
          color: var(--t1);
          margin-bottom: 4px;
        }
        
        .ws-logs-body.ws-empty span, .ws-runbook-empty span, .ws-trace-empty span, .ws-workflow-empty span {
          font-size: 12px;
          color: var(--t2);
        }
        
        /* Runbook tab */
        .ws-runbook-list { display: flex; flex-direction: column; gap: 8px; }
        .ws-runbook-item {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 12px;
          background: var(--bg2);
          border-radius: var(--r2);
        }
        .ws-runbook-check {
          width: 20px;
          height: 20px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          flex-shrink: 0;
        }
        .ws-runbook-item.completed .ws-runbook-check { background: var(--ok); color: white; }
        .ws-runbook-item.pending .ws-runbook-check { background: var(--bg3); color: var(--t2); }
        .ws-runbook-title { font-size: 13px; font-weight: 500; color: var(--t0); margin-bottom: 4px; }
        .ws-runbook-desc { font-size: 11px; color: var(--t2); }
        
        /* Trace tab */
        .ws-trace-diagram { display: flex; align-items: center; gap: 8px; }
        .ws-trace-node {
          padding: 16px 20px;
          background: var(--bg2);
          border: 1px solid var(--bd);
          border-radius: var(--r2);
          text-align: center;
        }
        .ws-trace-node.error { border-color: var(--s1); }
        .ws-trace-name { font-size: 12px; font-weight: 500; color: var(--t0); margin-bottom: 4px; }
        .ws-trace-status { font-size: 10px; color: var(--t2); }
        .ws-trace-status.error { color: var(--s1); }
        .ws-trace-arrow { color: var(--t2); font-size: 14px; }
        
        /* Workflow tab */
        .ws-workflow-stages { display: flex; align-items: center; gap: 8px; }
        .ws-stage {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }
        .ws-stage-icon {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          background: var(--bg2);
          border: 2px solid var(--bd);
          color: var(--t2);
        }
        .ws-stage.completed .ws-stage-icon { background: var(--ok); border-color: var(--ok); color: white; }
        .ws-stage.active .ws-stage-icon { background: var(--al); border-color: var(--al); color: white; }
        .ws-stage-name { font-size: 10px; color: var(--t2); text-transform: uppercase; }
        .ws-stage-line {
          flex: 1;
          height: 2px;
          background: var(--bd);
          min-width: 30px;
        }
        .ws-stage-line.completed { background: var(--ok); }
        
        /* Audit tab */
        .ws-audit-list { display: flex; flex-direction: column; gap: 4px; }
        .ws-audit-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 40px 20px;
          background: var(--bg2);
          color: var(--t2);
          border-radius: var(--r2);
        }
        
        .ws-audit-empty svg {
          margin-bottom: 16px;
          opacity: 0.5;
        }
        
        .ws-audit-empty p {
          font-size: 14px;
          color: var(--t1);
          margin-bottom: 4px;
        }
        
        .ws-audit-empty span {
          font-size: 12px;
          color: var(--t2);
        }
        
        .ws-audit-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 8px 10px;
          background: var(--bg2);
          border-radius: var(--r1);
          font-size: 11px;
        }
        .ws-audit-time { color: var(--t2); font-family: var(--fm); width: 60px; }
        .ws-audit-agent { color: var(--al); font-weight: 500; width: 80px; }
        .ws-audit-action { color: var(--t1); flex: 1; }
        
        /* Offline tab */
        .ws-offline-info {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: var(--bg2);
          border-radius: var(--r2);
          margin-bottom: 16px;
        }
        .ws-offline-info p { font-size: 12px; color: var(--t1); margin: 0; }
        .ws-offline-stats { display: flex; gap: 16px; }
        .ws-offline-stat {
          flex: 1;
          padding: 16px;
          background: var(--bg2);
          border-radius: var(--r2);
          text-align: center;
        }
        .ws-offline-statv { font-size: 24px; font-weight: 700; color: var(--t0); }
        .ws-offline-statl { font-size: 10px; color: var(--t2); text-transform: uppercase; }
        
        /* Command bar */
        .cmd-bar {
          padding: 12px 16px;
          background: var(--bg1);
          border-top: 1px solid var(--bd);
          flex-shrink: 0;
        }
        
        .cmd-inner {
          display: flex;
          align-items: center;
          gap: 12px;
          background: var(--bg2);
          border: 1px solid var(--bd);
          border-radius: var(--r2);
          padding: 8px 12px;
        }
        
        .cmd-left { flex: 1; display: flex; flex-direction: column; gap: 6px; }
        
        .cmd-input {
          width: 100%;
          background: none;
          border: none;
          color: var(--t0);
          font-size: 13px;
          font-family: var(--fu);
          resize: none;
          outline: none;
        }
        
        .cmd-input::placeholder { color: var(--t2); }
        
        .qcs { display: flex; gap: 8px; }
        
        .qc {
          font-size: 10px;
          font-family: var(--fm);
          color: var(--al);
          cursor: pointer;
          padding: 2px 6px;
          background: rgba(88,166,255,.1);
          border-radius: 4px;
          transition: all .2s;
        }
        
        .qc:hover { background: rgba(88,166,255,.2); }
        
        .cmd-right { display: flex; align-items: center; gap: 8px; }
        
        .send-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--al);
          border: none;
          color: white;
          padding: 8px 14px;
          border-radius: var(--r1);
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all .2s;
        }
        
        .send-btn:hover { background: #4a90e2; }
        
        /* Right panel */
        .right-panel {
          width: 320px;
          background: var(--bg1);
          border-left: 1px solid var(--bd);
          display: flex;
          flex-direction: column;
          flex-shrink: 0;
          overflow-y: auto;
        }
        
        .rps {
          padding: 14px;
          border-bottom: 1px solid var(--bd);
        }
        
        .rph {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 11px;
          font-weight: 600;
          color: var(--t0);
          margin-bottom: 12px;
        }
        
        .ldot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        
        .chart { margin-bottom: 10px; }
        
        .clabels {
          display: flex;
          justify-content: space-between;
          font-size: 10px;
          font-family: var(--fm);
          margin-bottom: 8px;
        }
        
        .cleg { display: flex; gap: 12px; }
        
        .lg {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: var(--t2);
        }
        
        .lgd {
          width: 8px;
          height: 8px;
          border-radius: 2px;
        }
        
        .actr {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }
        
        .actd {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        
        .actn { 
          font-size: 11px; 
          color: var(--t0); 
          width: 70px; 
          flex-shrink: 0;
        }
        
        .actbg {
          flex: 1;
          height: 4px;
          background: var(--bg3);
          border-radius: 2px;
          overflow: hidden;
        }
        
        .actb {
          height: 100%;
          transition: width .3s;
        }
        
        .actv {
          font-size: 9px;
          font-weight: 500;
          text-transform: capitalize;
          width: 40px;
          text-align: right;
        }
        
        .actv.idle { color: var(--t2); }
        .actv.working { color: var(--al); }
        .actv.complete { color: var(--ok); }
        
        .fhdr {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 14px;
          font-size: 11px;
          font-weight: 600;
          color: var(--t0);
          border-bottom: 1px solid var(--bd);
        }
        
        .flist { padding: 8px 14px; }
        
        .fl-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 0;
          font-size: 11px;
          color: var(--t2);
        }
        
        .fl-dot { width: 5px; height: 5px; border-radius: 50%; }
        
        /* Agent detail modal */
        .ag-detail { display: flex; flex-direction: column; gap: 16px; }
        .ag-detail-header { display: flex; align-items: center; gap: 12px; }
        .ag-detail-icon {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 600;
          color: white;
        }
        .ag-detail-name { font-size: 16px; font-weight: 600; color: var(--t0); }
        .ag-detail-role { font-size: 12px; color: var(--t2); }
        
        .ag-status-badge {
          display: inline-flex;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          text-transform: capitalize;
        }
        
        .ag-status-badge.idle { background: var(--bg3); color: var(--t2); }
        .ag-status-badge.working { background: rgba(88,166,255,.15); color: var(--al); }
        .ag-status-badge.complete { background: rgba(63,185,80,.15); color: var(--ok); }
        
        .ag-detail-progress { display: flex; align-items: center; gap: 12px; }
        .ag-progress-label { font-size: 11px; color: var(--t2); width: 50px; }
        .ag-progress-bar { flex: 1; height: 6px; background: var(--bg3); border-radius: 3px; overflow: hidden; }
        .ag-progress-fill { height: 100%; transition: width .3s; }
        .ag-progress-pct { font-size: 11px; font-family: var(--fm); color: var(--t0); width: 35px; text-align: right; }
        
        .ag-detail-output { background: var(--bg2); border-radius: var(--r2); padding: 12px; }
        .ag-output-label { font-size: 10px; color: var(--t2); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
        .ag-output-text { font-size: 12px; color: var(--t1); line-height: 1.4; }
        
        .ag-run-btn {
          width: 100%;
          padding: 10px;
          background: var(--al);
          border: none;
          border-radius: var(--r1);
          color: white;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all .2s;
        }
        
        .ag-run-btn:hover:not(:disabled) { background: #4a90e2; }
        .ag-run-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        
        /* Sync pill */
        .sync-pill {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 500;
          flex-shrink: 0;
        }
        
        .sync-pill.online { background: rgba(63,185,80,.15); color: var(--ok); }
        .sync-pill.offline { background: rgba(210,153,34,.15); color: var(--wn); }
        
        .sdot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
        }
        
        .sync-pill.online .sdot { background: var(--ok); }
        .sync-pill.offline .sdot { background: var(--wn); }
        
        /* Header right */
        .hright {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-left: auto;
        }
        
        .icon-btn {
          position: relative;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: none;
          border: none;
          border-radius: var(--r1);
          color: var(--t2);
          cursor: pointer;
          transition: all .2s;
        }
        
        .icon-btn:hover { background: var(--bg2); color: var(--t0); }
        
        .nbadge {
          position: absolute;
          top: 2px;
          right: 2px;
          min-width: 14px;
          height: 14px;
          padding: 0 4px;
          background: var(--s1);
          border-radius: 7px;
          font-size: 9px;
          font-weight: 600;
          color: white;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .profile-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px 4px 4px;
          background: var(--bg2);
          border: 1px solid var(--bd);
          border-radius: 20px;
          cursor: pointer;
          transition: all .2s;
        }
        
        .profile-btn:hover { border-color: var(--bdl); }
        
        .pav {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--al), var(--ar));
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 600;
          color: white;
        }
        
        .pname { font-size: 12px; color: var(--t0); font-weight: 500; }
        
        /* Header metrics */
        .hmetrics {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        
        .hm {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .hmv {
          font-size: 14px;
          font-weight: 700;
          font-family: var(--fm);
        }
        
        .hmv.s1 { color: var(--s1); }
        .hmv.ag { color: var(--al); }
        .hmv.op { color: var(--ar); }
        .hmv.up { color: var(--ok); }
        
        .hml {
          font-size: 9px;
          color: var(--t2);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
    </div>
  );
}

/**
 * App Dashboard Page - Protected route requiring authentication
 */
export default function AppPage() {
  return (
    <PowerSyncProvider>
      <DashboardContent />
    </PowerSyncProvider>
  );
}