# AegisDesk - AI Ops Incident Command Center

## Project Overview

**Project Name:** AegisDesk  
**Type:** Local-first AI Ops Platform  
**Core Functionality:** Real-time collaborative incident response where human operators and specialized AI agents share a single synchronized workspace. Every action, thought, and decision is instantly visible across all participants.  
**Target Users:** DevOps/SRE engineers, on-call responders, incident commanders

## Project Structure

```
AegisDesk/                          # Root project directory
├── .env                              # Environment configuration
├── .env.example                      # Environment template
├── .gitignore                       # Git ignore rules
├── README.md                         # Project documentation
├── SPEC.md                          # This specification
├── aegisdesk/                       # Next.js application
│   ├── src/
│   │   ├── app/                    # Next.js app router
│   │   │   ├── api/               # API routes
│   │   │   │   ├── auth/          # Authentication endpoints
│   │   │   │   ├── sync/          # Data sync endpoints
│   │   │   │   ├── agents/        # AI agent endpoints
│   │   │   │   ├── team/          # Team management
│   │   │   │   ├── notifications/
│   │   │   │   ├── cleanup/
│   │   │   │   ├── init/
│   │   │   │   └── metrics/
│   │   │   ├── app/               # Main app page
│   │   │   ├── login/             # Login page
│   │   │   ├── register/         # Registration page
│   │   │   ├── demo/             # Demo page
│   │   │   └── invite/           # Team invite page
│   │   ├── components/           # React components
│   │   │   ├── PowerSyncProvider.tsx
│   │   │   └── AgentStatus.tsx
│   │   ├── lib/                  # Libraries
│   │   │   ├── db.ts
│   │   │   ├── hybrid-db.ts       # HybridDB (PowerSync + Neon)
│   │   │   ├── neon-auth.ts      # Neon authentication
│   │   │   ├── provider-cache.ts
│   │   │   ├── neon/             # Neon database
│   │   │   │   ├── client.ts
│   │   │   │   └── schema.ts     # Database schema (auto-creates tables)
│   │   │   └── powersync/        # PowerSync connector
│   │   │       ├── connector.ts
│   │   │       ├── database.ts
│   │   │       └── schema.ts
│   │   └── mastra/               # Mastra AI agents
│   │       ├── index.ts
│   │       ├── mastra.ts
│   │       ├── workflow-state.ts
│   │       ├── agents/            # Agent definitions
│   │       │   ├── comms1.ts
│   │       │   ├── postMort2.ts
│   │       │   ├── remedy3.ts
│   │       │   └── triage7.ts
│   │       └── tools/            # Agent tools
│   │           └── neonTools.ts
│   ├── public/                   # Static assets & PowerSync WASM
│   │   └── images/               # UI images
│   │       ├── UI.JPG
│   │       └── Demo.JPG
│   ├── scripts/                  # Utility scripts
│   │   ├── setup-neon-db.js
│   │   └── check-tables.js
│   ├── test-agents.js           # Test AI agents
│   ├── test-incident.js         # Test incidents
│   ├── check-incidents.js       # Check incidents
│   └── package.json              # Dependencies
```

## UI/UX Specification

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│  AegisDesk   [Incident: DB-OUTAGE-042]    [Severity: 🔴 P1]    👥 3 online  ↻ Synced │
├─────────────────────────────────────────────────────────────────────────────────────┤
│         │                                                                      │     │
│  Agent  │   SHARED TIMELINE (scrollable)                                       │     │
│  Panel  │   ┌──────────────────────────────────────────────────────────────┐  │     │
│         │   │ 🕐 10:42:15 - System: Incident created                        │  │     │
│ ┌─────┐ │   │ 🤖 Triage-7: Analyzing incident details...                   │  │     │
│ │ 🤖  │ │   │ 🤖 Remedy-3: Detected pattern: connection pool exhausted   │  │     │
│ │Triage│ │   │ 👤 Sarah: Running diagnostic query                        │  │     │
│ └─────┘ │   │ 🤖 PostMort-2: Generating initial report                    │  │     │
│ ┌─────┐ │   │ 👤 Mike: Executing /scale-up command                         │  │     │
│ │ 🔍  │ │   └──────────────────────────────────────────────────────────────┘  │     │
│ │Remedy│ │                                                                       │     │
│ └─────┘ │   ┌──────────────────────────────────────────────────────────────┐  │     │
│ ┌─────┐ │   │  WORKSPACE (context panel)                                   │  │     │
│ │ 📖  │ │   │  ┌────────────────┬────────────────┬────────────────┐         │  │     │
│ │Post  │ │   │  │ 📋 Summary    │ 📝 Logs        │ 📖 Runbook    │         │  │     │
│ │Mort  │ │   │  ├────────────────┼────────────────┼────────────────┤         │  │     │
│ └─────┘ │   │  │ Incident:...  │ [ERROR] conn..│ 1. Scale up.. │         │  │     │
│ ┌─────┐ │   │  │ Root cause:.. │ [WARN] mem...│ 2. Restart... │         │  │     │
│ │Comms │ │   │  │ Status: 🔴    │ [INFO] heal..│ 3. Verify...  │         │  │     │
│ └─────┘ │   │  └────────────────┴────────────────┴────────────────┘         │  │     │
│         │   └──────────────────────────────────────────────────────────────┘  │     │
│ Actions │   ┌──────────────────────────────────────────────────────────────┐  │     │
│         │   │  COMMAND INPUT                                               │  │     │
│ + Add   │   │  > Describe what you're seeing...                             │  │     │
│   Log   │   │  [Send] [Ask Agent ▾]                                        │  │     │
│         │   └──────────────────────────────────────────────────────────────┘  │     │
└─────────┴───────────────────────────────────────────────────────────────────────┘
```

### Color Palette

- **Background Primary**: `#0a0a0f` (deep space black)
- **Background Secondary**: `#12121a` (panel backgrounds)
- **Background Tertiary**: `#1a1a24` (elevated elements)
- **Border**: `#2a2a3a`
- **Text Primary**: `#f0f0f5`
- **Text Secondary**: `#8888a0`
- **Accent Red (P1)**: `#ff4757`
- **Accent Orange (P2)**: `#ffa502`
- **Accent Yellow (P3)**: `#ffd43b`
- **Accent Green (Resolved)**: `#26de81`
- **Agent Blue**: `#3498db`
- **Agent Purple**: `#9b59b6`
- **Agent Cyan**: `#00d2d3`
- **Agent Orange**: `#e67e22`

### Typography

- **Font Family**: `"JetBrains Mono", monospace` for logs/code
- **Font UI**: `"IBM Plex Sans", -apple-system, sans-serif`
- **Monospace logs**: 12px
- **UI Text**: 13-14px

### Components

#### Header Bar

- Logo "AegisDesk" with shield icon
- Incident ID badge
- Severity indicator (P1-P4 with colors)
- Online participants count with avatars
- Sync status with animated indicator

#### Agent Panel (Left)

- Each agent shows:
  - Agent icon/avatar
  - Agent name (Triage-7, Remedy-3, PostMort-2, Comms-1)
  - Status: idle | working | complete | error
  - Activity indicator when processing
- Click to expand agent details

#### Shared Timeline (Center-Top)

- Chronological feed of all events
- Each entry shows:
  - Timestamp
  - Actor type icon (human / agent / system)
  - Actor name
  - Action/observation
  - Expandable details
- Auto-scrolls to latest
- Visual separators between time gaps

#### Workspace Panel (Center)

- Tabbed interface: Summary | Logs | Runbook
- Summary: AI-generated incident summary
- Logs: Parsed, searchable log entries
- Runbook: Suggested + linked playbooks

#### Command Input (Bottom)

- Multi-line input
- "Ask Agent" dropdown for routing to specific agents
- Quick action buttons: /logs, /scale, /rollback
- Shows AI response streaming

---

## Functionality Specification

### Core Features

#### 1. Authentication & Authorization

- Email/password registration and login
- JWT token-based sessions
- Team/organization management
- Invitation system for team members

#### 2. Incident Management

- Create incidents with severity levels (P1-P4)
- Incident timeline tracking
- Real-time status updates
- Incident metrics and analytics

#### 3. Multi-Agent AI System (Mastra)

Four specialized AI agents powered by OpenAI/Gemini:

**Triage-7**

- Analyzes incoming incidents
- Assesses severity and priority
- Categorizes incident type
- Initial diagnostic analysis

**Remedy-3**

- Suggests remediation steps
- Recommends playbooks
- Provides automated fixes
- Tracks resolution progress

**Comms-1**

- Generates status updates
- Drafts stakeholder communications
- Creates incident summaries
- Manages public-facing messages

**PostMort-2**

- Generates post-incident reports
- Documents root cause analysis
- Captures lessons learned
- Creates improvement recommendations

#### 4. Hybrid Database (Offline-First)

- **PowerSync** - Local SQLite for offline operation
- **Neon** - Cloud PostgreSQL for persistence
- Automatic sync when online
- Visual sync status indicator
- Offline queue for pending operations

#### 5. Real-Time Features

- Live activity feed
- Notification system
- Agent status monitoring
- Sync health monitoring

---

## Technology Stack

### Frontend (aegisdesk/src)

- **Next.js 16** - React framework
- **React 19** - UI library
- **TanStack Query** - State management & caching
- **PowerSync** - Local-first SQLite with sync

### Backend (aegisdesk)

- **Next.js 16** - API routes
- **Neon Auth** - Custom JWT authentication
- **Neon** - PostgreSQL database
- **Mastra** - AI agent orchestration
- **OpenAI (GPT-4o)** - Primary AI/LLM
- **Google Gemini** - Secondary AI/LLM

### Database Schema

The database schema is defined in code and auto-created on first run:

- **aegisdesk/src/lib/neon/schema.ts** - Runtime schema that auto-creates all tables
- Tables: incidents, timeline_events, logs, agents, workflows, audit_log, runbooks, agent_memory, knowledge_base, team_members, organizations, team_invitations, presence, notifications, sync_queue, users, profiles, user_sessions, oauth_accounts

---

## Acceptance Criteria

### Must Have

- [x] Create new incident with severity
- [x] See shared timeline with events
- [x] Submit logs for analysis
- [x] Get AI suggestions from agents
- [x] Add human observations to timeline
- [x] Offline indicator and queue
- [x] Real-time sync simulation

### Should Have

- [x] Multiple agent specialties working
- [x] Runbook suggestions
- [x] Search/filter logs
- [x] Incident summary generation

### Visual Checkpoints

- [x] Dark, command-center aesthetic loads
- [x] Timeline auto-scrolls on new events
- [x] Agent status indicators animate
- [x] Offline badge shows when disconnected
- [x] Severity colors are prominent

---


## Architecture Summary

```
Browser
├── PowerSync local SQLite ← all reads (instant, works offline)
├── useIncidents() ← live reactive, auto-updates
├── useTimeline() ← live reactive, auto-updates
└── db.execute() ← writes (queued offline, sync online)
↕ WebSocket
PowerSync Cloud
↕ Logical replication
Neon (Postgres)
├── incidents
├── timeline_events
├── logs
├── agents
├── workflows
├── audit_log
├── runbooks
├── agent_memory
├── knowledge_base
├── team_members
├── organizations
├── team_invitations
├── presence
├── notifications
├── sync_queue
├── users
├── profiles
├── user_sessions
└── oauth_accounts
↑ written by
Mastra agents (server-side Next.js API routes)
├── Triage-7 → reads Neon logs → AI analysis → writes timeline
├── Remedy-3 → reads incident → AI runbook → writes timeline
├── Comms-1 → reads incident → AI update → writes timeline
└── PostMort-2 → reads incident → AI report → writes timeline
↑ auth via
Neon Auth (custom JWT)
└── login / register / JWT tokens for PowerSync
```
