# AegisDesk - AI Ops Incident Command Center

A real-time collaborative incident response platform where human operators and specialized AI agents work together in a synchronized workspace. Built for modern DevOps and SRE teams.

![AegisDesk Dashboard](./aegisdesk/public/images/UI.JPG)

## Table of Contents

- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [Features](#features)
  - [Real-Time Collaboration](#real-time-collaboration)
  - [AI-Powered Response](#ai-powered-response)
  - [Modern Incident Management](#modern-incident-management)
  - [Enterprise Ready](#enterprise-ready)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
  - [1. Clone and Install Dependencies](#1-clone-and-install-dependencies)
  - [2. Environment Configuration](#2-environment-configuration)
  - [3. Database Setup](#3-database-setup)
  - [4. Run Development Server](#4-run-development-server)
- [Test Incidents](#test-incidents)
  - [Incident 1 — SEV-1 — Payment API Down](#incident-1--sev-1--payment-api-down)
  - [Incident 2 — SEV-2 — Database Connection Pool Exhausted](#incident-2--sev-2--database-connection-pool-exhausted)
  - [Incident 3 — SEV-2 — Auth Service Latency Spike](#incident-3--sev-2--auth-service-latency-spike)
  - [Incident 4 — SEV-3 — CDN Cache Purge Failing](#incident-4--sev-3--cdn-cache-purge-failing)
  - [Incident 5 — SEV-1 — Complete API Gateway Outage](#incident-5--sev-1--complete-api-gateway-outage)
  - [Testing Checklist Per Incident](#testing-checklist-per-incident)
  - [Offline Test](#offline-test)
- [Quick Start](#quick-start)
  - [Create an Account](#create-an-account)
  - [Create Your First Incident](#create-your-first-incident)
  - [Use AI Agents](#use-ai-agents)
  - [Timeline](#timeline)
- [Usage](#usage)
  - [Keyboard Shortcuts](#keyboard-shortcuts)
  - [Incident Workflow](#incident-workflow)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Feature Flags](#feature-flags)
- [Project Structure](#project-structure)
- [Security](#security)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)

## The Problem

When production goes down, teams face chaos:

1. **Scattered Information** - Team scrambles across Slack, Datadog, runbooks, terminals
2. **Manual Analysis** - Copy-paste logs to AI tools with no context
3. **No Shared State** - Humans have no visibility into what others are doing
4. **Agent Isolation** - AI agents can't see what other agents are doing
5. **Knowledge Loss** - Important learnings are lost after incident resolution

## The Solution

**AegisDesk** provides a **shared incident command center** where:

- **Human operators** see real-time updates from AI agents
- **AI Agents** (Triage, Remedy, Comms, PostMort) work in parallel with full visibility
- **Every action** is logged to a shared timeline
- **Offline-capable** - works in tunnels, planes, basements
- **PowerSync** syncs state instantly across humans, agents, and devices

## Features

### Real-Time Collaboration

- **Shared Workspace** - All participants see updates instantly
- **Live Timeline** - Every action, decision, and observation logged in real-time
- **Offline-First** - Full functionality without internet, syncs when reconnected

### AI-Powered Response

- **Triage-7** - Log analysis, pattern recognition, severity assessment
- **Remedy-3** - Automated remediation, service restarts, scaling operations
- **Comms-1** - Stakeholder notifications, status updates
- **PostMort-2** - Post-mortem document generation
- **Multi-Agent Coordination** - Agents collaborate and share insights

### Modern Incident Management

- **Unified Timeline** - Human and AI actions in chronological order
- **Smart Workspaces** - Tabbed interface for summary, logs, agents
- **Command Interface** - Quick actions via input field
- **Drag & Drop Logs** - Drop log files for instant analysis

### Workspace Tabs

The application provides four workspace tabs for comprehensive incident management:

- **Workflow Tab** - Displays AI agent workflow execution status and history, with data persisted via localStorage to survive page reloads
- **Trace Tab** - Shows detailed execution traces from the Mastra workflow system
- **Runbook Tab** - Presents runbook content extracted from workflow responses
- **Offline Tab** - Displays the sync queue status for offline operations

All tabs feature localStorage persistence, ensuring data remains available even after browser refresh or server restart. The offline tab also includes improved styling to prevent content cut-off.

- **Neon PostgreSQL** - Serverless scalable database (single source of truth)
- **Neon Auth** - Secure user authentication
- **PowerSync Integration** - Real-time sync with offline support
- **Audit Trail** - Complete action history

> 📖 For detailed specifications, UI/UX details, and technical architecture, see [SPEC.md](./SPEC.md)

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Next.js 16 Frontend                         │
│  React 19 + TypeScript + CSS                                 │
└─────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    PowerSync Layer                           │
│  Local SQLite ←→ Neon PostgreSQL Sync Engine                │
└─────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┴───────────────┐
                ▼                               ▼
┌─────────────────────────┐   ┌─────────────────────────┐
│    Neon PostgreSQL     │   │    Mastra AI            │
│    (Serverless)        │   │    (AI Agents)          │
│    + Neon Auth         │   │    Orchestrator         │
└─────────────────────────┘   └─────────────────────────┘
                                 │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│    Groq        │   │  Google Gemini  │   │   Mistral AI   │
│ (Llama 3.1 8B)│   │ (1.5 Pro)      │   │(mistral-small) │
└─────────────────┘   └─────────────────┘   └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    WebLLM       │
                        │   (Local/GPU)   │
                        └─────────────────┘
```

### 🤖 Multi-Provider AI Agents (100% Free - No Credit Card Required)

AegisDesk uses **Mastra** as an AI orchestration layer to coordinate multiple free LLM providers:

| Agent | Provider | Model | Why it fits the "No Money" rule |
|-------|----------|-------|--------------------------------|
| **Triage-7** | Groq | Llama 3.1 8B | Free for experimentation with high rate limits |
| **Remedy-3** | Google Gemini | 1.5 Pro | Free tier with generous RPM/TPM |
| **PostMort-2** | Mistral AI | mistral-small-latest | Free "Experiment" plan - phone verification only, no credit card |
| **Comms-1** | WebLLM | (local GPU) | Runs locally in browser, zero quotas |

**How Mastra orchestrates the agents:**
1. **Unified Model Interface** - Mastra provides a standard way to define agents regardless of the backend
2. **Workflow Orchestration** - Triggers agents in a chain (Triage → Remedy → Comms → PostMort)
3. **Human-in-the-Loop** - Supports suspending workflows for human approval
4. **Tool Integration** - Agents can use tools to write to timeline, synced via PowerSync to Neon

## Prerequisites

- Node.js 18+
- Neon Account (for PostgreSQL database and authentication)
- PowerSync Account (for offline sync)
- Gemini API Key (free) or Anthropic API Key (paid, recommended)

## 🛠️ Installation

### 1. Clone and Install Dependencies

```bash
# Clone the repository
git clone https://github.com/secbyteX03/Aegis_Desk.git

# Navigate to project directory
cd AegisDesk

# Navigate to the Next.js app directory
cd aegisdesk

# Install all dependencies
npm install

# Install additional AI provider packages (for multi-provider setup)
npm install @ai-sdk/groq @ai-sdk/mistral
```

The following npm packages are installed:

**Core Dependencies:**

- `next` (16.1.6) - React framework
- `react` (19.2.3) & `react-dom` (19.2.3) - UI library
- `@powersync/react` & `@powersync/web` - Local database sync
- `@neondatabase/serverless` - Neon PostgreSQL driver
- `@mastra/core` - AI agent framework (orchestration layer)
- `@ai-sdk/google` - Google/Gemini provider
- `@ai-sdk/groq` - Groq provider (for Triage-7 agent)
- `@ai-sdk/mistral` - Mistral AI provider (for PostMort-2 agent)
- `@google/generative-ai` - Gemini AI
- `@tanstack/react-query` - Data fetching
- `ai` - AI SDK
- `jose` - JWT handling
- `zod` - Schema validation
- `resend` - Email service
- `pg` - PostgreSQL driver

**Dev Dependencies:**

- `typescript` - TypeScript compiler
- `@types/node`, `@types/react`, `@types/react-dom` - Type definitions

### 2. Environment Configuration

Create a `.env.local` file in the `aegisdesk/` directory:

```env
# Neon Database (required - PostgreSQL backend)
DATABASE_URL=postgresql://user:pass@ep-xxx.us-east-1.aws.neon.tech/neondb?sslmode=require

# PowerSync (required - for offline sync)
VITE_POWERSYNC_INSTANCE_ID=your-powersync-instance-id
VITE_POWERSYNC_API_KEY=your-powersync-api-key
POWERSYNC_URL=https://sync.powersync.com

# AI Configuration (Multi-Provider Setup - 100% Free)
# Groq API Key - Get free key at https://console.groq.com (for Triage-7 agent)
GROQ_API_KEY=your-groq-api-key

# Google Gemini API Key - Get free key at https://aistudio.google.com/app/apikey (for Remedy-3 agent)
GOOGLE_GENERATIVE_AI_API_KEY=your-gemini-api-key

# Mistral AI API Key - Get free "Experiment" key at https://console.mistral.ai (for PostMort-2 agent)
MISTRAL_API_KEY=your-mistral-api-key

# Application
NODE_ENV=development
PORT=3000
```

> **Note:** All three AI providers offer free tiers that don't require a credit card:
> - **Groq**: Free for experimentation with high rate limits
> - **Google Gemini**: Free tier with generous RPM/TPM
> - **Mistral AI**: Free "Experiment" plan - only requires phone verification

### 3. Database Setup

The application uses Neon PostgreSQL. The database schema is automatically created on first run via the `/api/init` endpoint.

1. Create a Neon project at https://neon.tech
2. Copy the connection string to your `.env.local` file
3. Start the app - tables are auto-created

### 4. Run Development Server

Open a terminal and run:

```bash
# Navigate to the Next.js app directory
cd aegisdesk

# Run the development server
npm run dev
```

The app will start on http://localhost:3000

> **Note:**
>
> - First load can take 30-60s as the cache builds. Subsequent loads are much faster (1-3s).

### Server Management Commands

```bash
# Navigate to the app directory
cd aegisdesk

# Stop the development server
# Windows:
taskkill /F /IM node.exe

# macOS/Linux:
pkill node

# Clean build cache (removes .next folder)
# Windows:
rmdir /s /q .next

# macOS/Linux:
rm -rf .next

# Restart the development server
npm run dev
```

## 🧪 Test Incidents

Use these pre-built incidents to test the application:

### Incident 1 — SEV-1 — Payment API Down

The most critical. Tests everything.

**Title:** Payment API elevated error rate  
**Severity:** SEV-1  
**Service:** payment-gateway  
**Description:** Payment gateway experiencing intermittent TLS handshake failures. Stripe proxy connection issues causing checkout failures across all payment methods. Customers unable to complete purchases.

**Logs to paste:**

```
[14:31:02] ERROR payment-gateway: TLS handshake timeout on connection to stripe-proxy
[14:31:03] ERROR payment-gateway: x509: certificate has expired or is not yet valid
[14:31:04] ERROR stripe-proxy: Connection refused — upstream payment-gateway unreachable
[14:31:05] WARN  order-service: Payment validation failed for req-yw2yduwpu after 3 retries
[14:31:06] ERROR checkout-service: Payment processing failed — customer order abandoned
[14:31:07] ERROR payment-gateway: TLS handshake timeout on connection to stripe-proxy
[14:31:08] ERROR payment-gateway: x509: certificate has expired or is not yet valid
[14:31:09] ERROR api-gateway: Upstream payment-gateway returned 503 Service Unavailable
[14:31:10] WARN  checkout-service: Retry 1/3 failed for order-8821
[14:31:11] ERROR checkout-service: Retry 2/3 failed for order-8821
[14:31:12] ERROR checkout-service: All retries exhausted — order-8821 failed permanently
```

**What to test:** Run RCA → Triage-7 should identify the TLS cert expiry. Then Generate Summary → Comms-1 drafts a stakeholder update. Then Resolve → PostMort-2 generates post-mortem.

---

### Incident 2 — SEV-2 — Database Connection Pool Exhausted

Tests log analysis with a different root cause.

**Title:** User service database connections exhausted  
**Severity:** SEV-2  
**Service:** user-service  
**Description:** User profile lookups timing out. Database connection pool at 100% capacity. Login and account pages affected.

**Logs to paste:**

```
[09:14:01] ERROR user-service: connection pool exhausted (pool_size=50, waiting=23)
[09:14:02] ERROR user-service: getUser() timeout after 30000ms for user-id-4421
[09:14:03] WARN  postgres: idle connection held for 847s by pid 2341 — query: SELECT * FROM users
[09:14:04] ERROR api-gateway: GET /api/user/profile returned 504 Gateway Timeout
[09:14:05] ERROR user-service: connection pool exhausted (pool_size=50, waiting=31)
[09:14:06] WARN  postgres: max_connections=100 reached — new connections being rejected
[09:14:07] ERROR user-service: getUser() timeout after 30000ms for user-id-9982
[09:14:08] ERROR auth-service: Unable to verify session — user lookup failed
[09:14:09] ERROR api-gateway: POST /api/auth/verify returned 500 Internal Server Error
[09:14:10] WARN  user-service: connection pool queue depth: 38 requests waiting
```

---

### Incident 3 — SEV-2 — Auth Service Latency Spike

Tests the trace tab with high latency numbers.

**Title:** Auth service JWT verification latency spike  
**Severity:** SEV-2  
**Service:** auth-service  
**Description:** Login flow degraded for all users. JWT verification p99 latency spiked from 40ms to 2400ms. Redis cache likely involved.

**Logs to paste:**

```
[16:45:01] WARN  auth-service: jwt_verify p99=2340ms (baseline: 40ms)
[16:45:02] WARN  redis: keyspace hit rate dropped to 12% (baseline: 94%)
[16:45:03] WARN  redis: memory usage at 98% — eviction policy: allkeys-lru
[16:45:04] ERROR auth-service: session lookup timeout for token eyJhbGci...
[16:45:05] WARN  auth-service: evicting 4821 keys — session:* keys being removed
[16:45:06] ERROR auth-service: session not found — user forced to re-authenticate
[16:45:07] WARN  auth-service: jwt_verify p99=2890ms — degradation continuing
[16:45:08] ERROR api-gateway: POST /auth/login returned 504 after 3000ms
[16:45:09] WARN  redis: OOM warning — used_memory 1.98gb maxmemory 2gb
[16:45:10] ERROR auth-service: 847 authentication failures in last 60 seconds
```

---

### Incident 4 — SEV-3 — CDN Cache Purge Failing

Tests a lower severity, non-critical incident.

**Title:** CDN cache purge job failing — stale assets being served  
**Severity:** SEV-3  
**Service:** cdn-edge  
**Description:** Automated CDN cache purge failing since last deployment. Users seeing stale JavaScript and CSS from previous release.

**Logs to paste:**

```
[11:02:01] ERROR cdn-purge: CloudFront invalidation API returned 429 Too Many Requests
[11:02:02] WARN  cdn-purge: Rate limit hit — 3000 invalidations/distribution/month exceeded
[11:02:03] WARN  cdn-purge: Retry 1/3 scheduled in 30 seconds
[11:02:33] ERROR cdn-purge: Retry 1/3 failed — still rate limited
[11:02:34] WARN  cdn-purge: 847 stale asset paths queued for invalidation
[11:03:04] ERROR cdn-purge: Retry 2/3 failed
[11:03:05] ERROR cdn-purge: All retries exhausted — purge job failed
[11:03:06] WARN  frontend: users loading app.js v2.1.0 instead of v2.2.0
[11:03:07] WARN  frontend: 3 users reported broken UI from version mismatch
```

---

### Incident 5 — SEV-1 — Complete API Gateway Outage

The nuclear option. Tests a full outage scenario.

**Title:** API Gateway down — all services unreachable  
**Severity:** SEV-1  
**Service:** api-gateway  
**Description:** Complete outage. API gateway not responding. All downstream services unreachable. 100% of user requests failing.

**Logs to paste:**

```
[02:17:01] ERROR api-gateway: process killed — reason: OOMKilled (memory limit 512Mi exceeded)
[02:17:02] ERROR kubernetes: pod api-gateway-7d9f8b-xk2p9 restarting (restart count: 4)
[02:17:03] ERROR kubernetes: CrashLoopBackOff — api-gateway-7d9f8b-xk2p9
[02:17:04] ERROR load-balancer: all api-gateway pods returning 503
[02:17:05] ERROR monitoring: healthcheck /health returning connection refused
[02:17:06] ERROR payment-gateway: upstream api-gateway unreachable
[02:17:07] ERROR user-service: upstream api-gateway unreachable
[02:17:08] ERROR auth-service: upstream api-gateway unreachable
[02:17:09] WARN  kubernetes: pod api-gateway-7d9f8b-xk2p9 back-off 40s (4th restart)
[02:17:10] ERROR alerting: 100% of synthetic checks failing — full outage declared
[02:17:50] ERROR kubernetes: pod api-gateway-7d9f8b-xk2p9 back-off 80s (5th restart)
```

---

### Testing Checklist Per Incident

For each incident, test this sequence:

1. Create incident with the title, severity, service, description
2. Paste Logs → click Ingest
3. Click Logs tab → verify log lines appear
4. Click Run RCA → wait for Triage-7 to respond
5. Click Runbook tab → steps should appear
6. Click Workflow tab → should show progress
7. Click Generate Summary → Comms-1 drafts update
8. Click Audit tab → verify all actions are recorded
9. Click Resolve → PostMort-2 generates post-mortem
10. Check Timeline → all events should be there in order

---

### Offline Test

Use Incident 1 (Payment API) for this:

1. Create the incident normally while online
2. Open Chrome DevTools → Network tab → set to Offline
3. Paste the logs → click Ingest (works offline)
4. Click Run RCA (queues in SQLite)
5. Check Offline Queue tab → should show pending ops
6. Set Network back to Online
7. Watch queue empty and sync pill turn green
8. Check Neon SQL Editor → data should now be in the database

## Quick Start

### Create an Account

1. Click **"Register"** to create an account
2. Login with your credentials

> **Test Credentials** (pre-configured demo account):
> - Email: `testuser@gmail.com`
> - Password: `Test@0001`

> **Note:** The demo account has pre-populated incidents for testing AI agent functionality.

### Create Your First Incident

1. Click **"New Incident"** button or use keyboard shortcut `Ctrl+N`
2. Enter incident details (title, severity, service, description)
3. Click **"Create Incident"**
4. Watch AI agents automatically analyze and suggest actions

### Use AI Agents

1. Select an incident from the list
2. Click the **play button** next to any agent to start them:
   - **Triage-7** - Analyzes logs and identifies root causes
   - **Remedy-3** - Generates remediation plans
   - **Comms-1** - Drafts stakeholder updates
   - **PostMort-2** - Creates post-mortem documents
3. Click the **stop button** to pause a running agent

### Timeline

- All actions (human and AI) appear in the timeline
- Use the command input to add notes
- View chronological history of incident response

## Usage

### Keyboard Shortcuts

| Shortcut     | Action           |
| ------------ | ---------------- |
| `Ctrl+N`     | New incident     |
| `Ctrl+L`     | Open logs modal  |
| `Ctrl+R`     | Trigger RCA      |
| `Ctrl+Enter` | Resolve incident |
| `Escape`     | Close modals     |

### Incident Workflow

1. **Create** - Report a new incident
2. **Triage** - Use Triage-7 to analyze
3. **Remediate** - Apply fixes with Remedy-3
4. **Communicate** - Update stakeholders with Comms-1
5. **Document** - Generate post-mortem with PostMort-2
6. **Resolve** - Close the incident

## Configuration

### Environment Variables

| Variable                  | Description                           | Required |
| ------------------------- | ------------------------------------- | -------- |
| `DATABASE_URL`            | Neon PostgreSQL connection string     | Yes      |
| `VITE_POWERSYNC_INSTANCE_ID` | PowerSync instance ID           | Yes      |
| `VITE_POWERSYNC_API_KEY` | PowerSync API key                   | Yes      |
| `POWERSYNC_URL`          | PowerSync sync endpoint              | Yes      |
| `OPENAI_API_KEY`         | OpenAI API key (required for agents)  | Yes      |
| `GEMINI_API_KEY`         | Gemini API key (optional)            | No       |

\*At least one AI API key required for agents to work

### Feature Flags

- `VITE_ENABLE_AI_AGENTS=true` - Enable AI agents
- `VITE_ENABLE_OFFLINE=true` - Enable offline support
- `VITE_ENABLE_REALTIME=true` - Enable real-time sync

## 📂 Project Structure

```
AegisDesk/
├── .env                        # Environment variables
├── .env.example                # Environment template
├── .gitignore                  # Git ignore rules
├── README.md                   # Project documentation
├── SPEC.md                    # Technical specification
├── aegisdesk/                 # Next.js application
│   ├── src/
│   │   ├── app/              # Next.js App Router
│   │   │   ├── api/          # API routes
│   │   │   │   ├── agents/   # AI agent endpoints
│   │   │   │   ├── auth/     # Authentication
│   │   │   │   ├── sync/     # Data sync
│   │   │   │   └── ...
│   │   │   ├── app/          # Main dashboard
│   │   │   ├── login/        # Login page
│   │   │   ├── register/     # Registration
│   │   │   └── demo/         # Demo page
│   │   ├── components/       # React components
│   │   ├── lib/              # Libraries
│   │   │   ├── db.ts
│   │   │   ├── neon/         # Neon client & schema
│   │   │   └── powersync/    # PowerSync setup
│   │   └── mastra/           # Mastra AI agents
│   │       ├── agents/       # Agent definitions
│   │       └── tools/        # Agent tools
│   ├── public/               # Static assets
│   │   └── images/           # Images (UI.JPG, Demo.JPG)
│   ├── scripts/              # Utility scripts
│   ├── test-agents.js        # Test AI agents
│   ├── test-incident.js     # Test incidents
│   └── check-incidents.js   # Check incidents
```

## Security

- Neon-based JWT authentication
- Environment variables for secrets
- Row-level security in database

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Database**: Neon PostgreSQL (serverless)
- **Authentication**: Neon Auth (custom JWT)
- **Sync**: PowerSync (offline-first)
- **AI**: Mastra AI (agent framework) + OpenAI (GPT-4o) / Gemini

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request
