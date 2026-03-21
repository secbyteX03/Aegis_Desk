"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import "./globals.css";

export default function LandingPage() {
  const [mounted, setMounted] = useState(false);
  const [tickerIndex, setTickerIndex] = useState(0);
  const [showDemo, setShowDemo] = useState(false);
  const [liveEventIndex, setLiveEventIndex] = useState(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const tickerMessages = [
    '← Triage-7 identified root cause in INC-001: TLS cert expiry (94% confidence)',
    '← Remedy-3 executing rollback step 4/7 — pods restarted (3/3)',
    '← Comms-1 sent stakeholder update to 12 recipients via Slack',
    '← PowerSync: queued 3 ops offline, replayed on reconnect — 0 data loss',
    '← PostMort-2 auto-generated post-mortem for INC-089 on resolution',
  ];

  const liveEvents = [
    { color: '#3fb950', text: '<strong>PowerSync</strong> — Syncing 3 ops to upstream...' },
    { color: '#58a6ff', text: '<strong>Triage-7</strong> — Analyzing 847 error traces...' },
    { color: '#bc8cff', text: '<strong>Remedy-3</strong> — Step 5/7: verifying connectivity' },
    { color: '#d29922', text: '<strong>Comms-1</strong> — Next update scheduled in 12 minutes' },
    { color: '#3fb950', text: '<strong>PowerSync</strong> — All changes synced upstream ✓' },
  ];

  useEffect(() => {
    const tickerInterval = setInterval(() => {
      setTickerIndex((prev) => (prev + 1) % tickerMessages.length);
    }, 3800);

    const liveInterval = setInterval(() => {
      setLiveEventIndex((prev) => (prev + 1) % liveEvents.length);
    }, 2800);

    return () => {
      clearInterval(tickerInterval);
      clearInterval(liveInterval);
    };
  }, []);

  const scrollTo = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (!mounted) return null;

  return (
    <div id="land">
      {/* Background Effects */}
      <div className="land-bg">
        <div className="land-orb land-orb1"></div>
        <div className="land-orb land-orb2"></div>
        <div className="land-orb land-orb3"></div>
        <div className="land-grid"></div>
        <div className="land-noise"></div>
      </div>

      {/* Navigation */}
      <nav className="land-nav">
        <div className="land-logo">
          <div className="land-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" />
              <path d="M2 17L12 12L22 17" />
              <path d="M2 7L2 17L12 12L22 7" />
            </svg>
          </div>
          <span className="land-logo-name">AegisDesk</span>
        </div>
        <div className="land-nav-links">
          <button className="land-nav-link" onClick={() => scrollTo('land-features')}>Features</button>
          <button className="land-nav-link" onClick={() => scrollTo('land-how')}>How it works</button>
          <button className="land-nav-link" onClick={() => scrollTo('land-ps')}>PowerSync</button>
        </div>
        <div className="land-nav-right">
          <Link href="/login" className="land-nav-signin">Sign In</Link>
          <Link href="/register" className="land-nav-cta">Get Started Free</Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="land-hero">
        <div className="land-eyebrow">
          <span className="land-eyebrow-dot"></span>
          AI-Powered Incident Command
        </div>
        <h1 className="land-h1">
          Resolve incidents<br />
          <span className="grad">10× faster</span> with AI agents
        </h1>
        <p className="land-sub">
          AegisDesk deploys autonomous AI agents the moment an incident fires — triaging logs,
          running root cause analysis, and drafting stakeholder updates, all in real-time.
        </p>
        <div className="land-hero-btns">
          <Link href="/register" className="land-btn-primary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            Start for free
          </Link>
          <Link href="/demo" className="land-btn-secondary">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
            Watch live demo
          </Link>
        </div>
        <div className="land-ticker">
          <span className="land-ticker-dot"></span>
          <span id="land-ticker-msg">{tickerMessages[tickerIndex]}</span>
        </div>
        <div className="land-trust" style={{ marginTop: '32px' }}>
          <div className="land-trust-item">
            <svg className="land-trust-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            No credit card required
          </div>
          <div className="land-trust-item">
            <svg className="land-trust-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Works offline — powered by PowerSync
          </div>
          <div className="land-trust-item">
            <svg className="land-trust-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Deploys in under 5 minutes
          </div>
        </div>
      </section>

      {/* Dashboard Mockup */}
      <section className="land-mockup-wrap">
        <div className="land-mockup-glow"></div>
        <div className="land-mockup">
          <div className="land-mockup-bar">
            <div className="lmb-dot lmb-dot1"></div>
            <div className="lmb-dot lmb-dot2"></div>
            <div className="lmb-dot lmb-dot3"></div>
            <div className="lmb-addr">app.aegisdesk.io/workspace/INC-001</div>
          </div>
          <div className="land-mockup-inner">
            <div className="lm-sidebar">
              <div className="lm-sb-head">AI Agents</div>
              <div className="lm-agent lm-agent1">
                <div className="lm-agent-dot" style={{ background: '#58a6ff' }}></div>
                <div>
                  <div className="lm-agent-name">Triage-7</div>
                  <div className="lm-agent-role">Log Analysis</div>
                  <div className="lm-bar-wrap">
                    <div className="lm-bar lm-agent-bar-anim" id="lm-bar-t" style={{ background: 'linear-gradient(90deg,#58a6ff,#5dade2)', width: '88%' }}></div>
                  </div>
                </div>
              </div>
              <div className="lm-agent">
                <div className="lm-agent-dot" style={{ background: '#bc8cff' }}></div>
                <div>
                  <div className="lm-agent-name">Remedy-3</div>
                  <div className="lm-agent-role">Runbook Exec</div>
                  <div className="lm-bar-wrap">
                    <div className="lm-bar" id="lm-bar-r" style={{ width: '72%', background: 'linear-gradient(90deg,#bc8cff,#bb8fce)' }}></div>
                  </div>
                </div>
              </div>
              <div className="lm-agent">
                <div className="lm-agent-dot" style={{ background: '#d29922' }}></div>
                <div>
                  <div className="lm-agent-name">Comms-1</div>
                  <div className="lm-agent-role">Status Updates</div>
                  <div className="lm-bar-wrap">
                    <div className="lm-bar" id="lm-bar-c" style={{ width: '40%', background: 'linear-gradient(90deg,#d29922,#f39c12)' }}></div>
                  </div>
                </div>
              </div>
              <div className="lm-agent">
                <div className="lm-agent-dot" style={{ background: '#3fb950' }}></div>
                <div>
                  <div className="lm-agent-name">PostMort-2</div>
                  <div className="lm-agent-role">Post-Mortem</div>
                  <div className="lm-bar-wrap">
                    <div className="lm-bar" style={{ width: '5%', background: '#3fb950' }}></div>
                  </div>
                </div>
              </div>
              <div className="lm-actions">
                <div className="lm-sb-head">Actions</div>
                <div className="lm-action active">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  Run RCA
                </div>
                <div className="lm-action">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                  Paste Logs
                </div>
                <div className="lm-action">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Resolve
                </div>
              </div>
            </div>
            <div className="lm-main">
              <div className="lm-top">
                <div className="lm-stat">
                  <div className="lm-stat-v red">SEV-1</div>
                  <div className="lm-stat-l">Severity</div>
                </div>
                <div className="lm-stat">
                  <div className="lm-stat-v blue" id="lm-agents-count">4</div>
                  <div className="lm-stat-l">Agents Active</div>
                </div>
                <div className="lm-stat">
                  <div className="lm-stat-v purple">94%</div>
                  <div className="lm-stat-l">RCA Confidence</div>
                </div>
                <div className="lm-stat">
                  <div className="lm-stat-v green" id="lm-mttr">12m</div>
                  <div className="lm-stat-l">MTTR</div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '12px', flex: '1' }}>
                <div className="lm-timeline">
                  <div className="lm-tl-head">Live Timeline</div>
                  <div className="lm-ev">
                    <div className="lm-ev-dot" style={{ background: '#58a6ff' }}></div>
                    <div className="lm-ev-text">
                      <strong>Triage-7</strong> — Root cause: TLS cert expiry on payment-gateway-v2 <span style={{ color: '#6e7681', fontSize: '10px' }}>14:32:04</span>
                    </div>
                  </div>
                  <div className="lm-ev">
                    <div className="lm-ev-dot" style={{ background: '#bc8cff' }}></div>
                    <div className="lm-ev-text">
                      <strong>Remedy-3</strong> — Running rollback step 4/7 — pod restart (3/3) <span style={{ color: '#6e7681', fontSize: '10px' }}>14:32:45</span>
                    </div>
                  </div>
                  <div className="lm-ev">
                    <div className="lm-ev-dot" style={{ background: '#d29922' }}></div>
                    <div className="lm-ev-text">
                      <strong>Comms-1</strong> — Stakeholder update sent to 12 recipients <span style={{ color: '#6e7681', fontSize: '10px' }}>14:32:30</span>
                    </div>
                  </div>
                  <div className="lm-ev" id="lm-live-ev">
                    <div className="lm-ev-dot" style={{ background: liveEvents[liveEventIndex].color, animation: 'pulse 1.5s infinite' }}></div>
                    <div className="lm-ev-text" id="lm-live-text" style={{ color: liveEvents[liveEventIndex].color }}>
                      <span dangerouslySetInnerHTML={{ __html: liveEvents[liveEventIndex].text }}></span>
                    </div>
                  </div>
                </div>
                <div className="lm-chart">
                  <div className="lm-chart-head">Error Rate</div>
                  <div className="lm-chart-bars" id="lm-chart-bars">
                    {[10, 18, 28, 55, 82, 91, 88, 78, 65, 52, 40, 30, 22, 16, 12, 10, 8, 12, 22, 35, 48, 62, 75, 88].map((v, i) => (
                      <div
                        key={i}
                        className="lm-cb"
                        style={{
                          height: `${v * 0.65}px`,
                          background: i < 5 ? '#ff7b72' : i < 9 ? '#ffa657' : '#3fb950'
                        }}
                      ></div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <section className="land-stats" id="land-stats">
        <div className="land-stats-inner">
          <div className="land-stat-item">
            <div className="land-stat-v">&lt; 30s</div>
            <div className="land-stat-l">Avg. agent response time</div>
          </div>
          <div className="land-stat-item">
            <div className="land-stat-v">4</div>
            <div className="land-stat-l">AI agents per incident</div>
          </div>
          <div className="land-stat-item">
            <div className="land-stat-v">100%</div>
            <div className="land-stat-l">Offline capable</div>
          </div>
          <div className="land-stat-item">
            <div className="land-stat-v">0ms</div>
            <div className="land-stat-l">SQLite read latency</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="land-features" id="land-features">
        <div className="land-section-label">Capabilities</div>
        <h2 className="land-section-title">Everything your team needs<br />when things go wrong</h2>
        <p className="land-section-sub">From first alert to post-mortem, AegisDesk handles the heavy lifting so your engineers can focus on the fix.</p>
        <div className="land-feat-grid">
          <div className="land-feat">
            <div className="land-feat-icon" style={{ background: 'rgba(88,166,255,.12)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </div>
            <div className="land-feat-title">Automated Log Triage</div>
            <div className="land-feat-desc">
              Triage-7 ingests thousands of log lines in seconds, surfaces anomaly patterns,
              and pinpoints root cause before your team even opens a terminal.
            </div>
          </div>
          <div className="land-feat">
            <div className="land-feat-icon" style={{ background: 'rgba(188,140,255,.12)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#bc8cff" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </div>
            <div className="land-feat-title">Runbook Execution</div>
            <div className="land-feat-desc">
              Remedy-3 maps root cause to your playbooks and walks step-by-step through remediation —
              tracking progress and flagging blockers in real-time.
            </div>
          </div>
          <div className="land-feat">
            <div className="land-feat-icon" style={{ background: 'rgba(210,153,34,.12)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#d29922" strokeWidth="2">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </div>
            <div className="land-feat-title">Stakeholder Comms</div>
            <div className="land-feat-desc">
              Comms-1 drafts clear, jargon-free status updates for Slack, email, and status pages —
              keeping stakeholders informed without interrupting engineers.
            </div>
          </div>
          <div className="land-feat">
            <div className="land-feat-icon" style={{ background: 'rgba(63,185,80,.12)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth="2">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            </div>
            <div className="land-feat-title">Shared Timeline</div>
            <div className="land-feat-desc">
              Every agent action, human command, and system event lands on one shared timeline —
              giving your whole team a single source of truth throughout the incident.
            </div>
          </div>
          <div className="land-feat">
            <div className="land-feat-icon" style={{ background: 'rgba(248,81,73,.12)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f85149" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              </svg>
            </div>
            <div className="land-feat-title">Real-Time Tracing</div>
            <div className="land-feat-desc">
              Visualise distributed request traces with latency breakdowns per service.
              Instantly see which service is the bottleneck — no manual digging required.
            </div>
          </div>
          <div className="land-feat">
            <div className="land-feat-icon" style={{ background: 'rgba(88,166,255,.12)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#58a6ff" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="land-feat-title">Auto Post-Mortem</div>
            <div className="land-feat-desc">
              PostMort-2 watches the entire incident and auto-generates a structured post-mortem —
              timeline, root cause, corrective actions — ready to publish on resolution.
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="land-how" id="land-how">
        <div className="land-section-label">Workflow</div>
        <h2 className="land-section-title">Incident resolved in 4 steps</h2>
        <p className="land-section-sub" style={{ marginBottom: '52px' }}>Your agents activate instantly — no manual setup, no context switching.</p>
        <div className="land-steps">
          <div className="land-step">
            <div className="land-step-num">01</div>
            <div className="land-step-title">Alert fires</div>
            <div className="land-step-desc">
              An incident is detected via your monitoring stack or created manually —
              agents deploy in under 5 seconds.
            </div>
          </div>
          <div className="land-step">
            <div className="land-step-num">02</div>
            <div className="land-step-title">Agents triage</div>
            <div className="land-step-desc">
              Triage-7 ingests logs and traces, identifies the root cause,
              and populates a step-by-step runbook.
            </div>
          </div>
          <div className="land-step">
            <div className="land-step-num">03</div>
            <div className="land-step-title">Team remediates</div>
            <div className="land-step-desc">
              Remedy-3 walks through the runbook. Comms-1 keeps stakeholders updated.
              Your engineers stay focused.
            </div>
          </div>
          <div className="land-step">
            <div className="land-step-num">04</div>
            <div className="land-step-title">Resolved & learned</div>
            <div className="land-step-desc">
              PostMort-2 delivers a complete post-mortem. Patterns are stored in memory
              for faster resolution next time.
            </div>
          </div>
        </div>
      </section>

      {/* PowerSync Callout */}
      <section className="land-ps" id="land-ps">
        <div className="land-ps-inner">
          <div className="land-ps-left">
            <div className="land-ps-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
              Powered by PowerSync
            </div>
            <div className="land-ps-title">Works even when<br />your network doesn't</div>
            <div className="land-ps-desc">
              AegisDesk is built on PowerSync's local-first SQLite sync engine. Every agent read
              is instant (0ms). Every write queues locally when offline and replays automatically
              on reconnect — zero data loss, always.
            </div>
            <div style={{ display: 'flex', gap: '20px', marginTop: '20px' }}>
              <div style={{ fontSize: '13px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Zero-latency local reads
              </div>
              <div style={{ fontSize: '13px', color: '#8b949e', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#3fb950" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Offline queue replay
              </div>
            </div>
          </div>
          <div className="land-ps-right">
            <div className="land-ps-code">
              <div><span className="c">// agents read from local SQLite</span></div>
              <div><span className="k">const</span> <span className="v">rca</span> = <span className="k">await</span> db.<span className="s">query</span>(</div>
              <div>&nbsp;&nbsp;<span className="s">'SELECT * FROM logs'</span></div>
              <div>);&nbsp;<span className="c">// 0ms latency</span></div>
              <div style={{ marginTop: '8px' }}><span className="c">// writes queue when offline</span></div>
              <div><span className="k">await</span> db.<span className="s">execute</span>(</div>
              <div>&nbsp;&nbsp;<span className="s">'UPDATE incidents SET'</span></div>
              <div>&nbsp;&nbsp;<span className="s">'status = ?'</span>, [<span className="v">'resolved'</span>]</div>
              <div>);&nbsp;<span className="c">// auto-syncs ↑</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="land-social" id="land-social">
        <div className="land-section-label">Trusted by SRE teams</div>
        <h2 className="land-section-title" style={{ marginBottom: '40px' }}>What teams are saying</h2>
        <div className="land-quote-grid">
          <div className="land-quote">
            <div className="land-quote-text">
              "We used to spend the first 20 minutes of every incident just figuring out where to look.
              AegisDesk's Triage agent does that in seconds — it's genuinely changed how we respond."
            </div>
            <div className="land-quote-author">
              <div className="land-quote-av" style={{ background: 'linear-gradient(135deg,#58a6ff,#bc8cff)' }}>MK</div>
              <div>
                <div className="land-quote-name">Maya K.</div>
                <div className="land-quote-role">Lead SRE, FinTech Scale-up</div>
              </div>
            </div>
          </div>
          <div className="land-quote">
            <div className="land-quote-text">
              "The offline mode is a killer feature. Our agents keep running even when we lose connectivity —
              which is exactly when you don't want things to stop working."
            </div>
            <div className="land-quote-author">
              <div className="land-quote-av" style={{ background: 'linear-gradient(135deg,#3fb950,#58a6ff)' }}>TR</div>
              <div>
                <div className="land-quote-name">Tom R.</div>
                <div className="land-quote-role">Platform Engineer, E-commerce</div>
              </div>
            </div>
          </div>
          <div className="land-quote">
            <div className="land-quote-text">
              "PostMort-2 writes better post-mortems than most of my engineers. The entire timeline is
              captured automatically — nothing falls through the cracks at 3am."
            </div>
            <div className="land-quote-author">
              <div className="land-quote-av" style={{ background: 'linear-gradient(135deg,#d29922,#ff7b72)' }}>SP</div>
              <div>
                <div className="land-quote-name">Sarah P.</div>
                <div className="land-quote-role">Head of Ops, SaaS Platform</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="land-cta" id="land-cta">
        <div className="land-cta-box">
          <h2 className="land-cta-title">Your next incident<br />deserves a better response</h2>
          <p className="land-cta-sub">Get your team set up in minutes. Free to start, no credit card required.</p>
          <div className="land-cta-btns">
            <Link href="/login" className="land-btn-primary" style={{ fontSize: '14px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Create free account
            </Link>
            <Link href="/app" className="land-btn-secondary" style={{ fontSize: '14px' }}>Sign in to workspace</Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="land-footer">
        <div className="land-footer-left">
          <div className="land-footer-logo">
            <div className="land-footer-logo-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" />
                <path d="M2 17L12 12L22 17" />
                <path d="M2 7L2 17L12 12L22 7" />
              </svg>
            </div>
            <span className="land-footer-name">AegisDesk</span>
          </div>
          <div className="land-footer-sep"></div>
          <div className="land-footer-copy">© 2026 AegisDesk. All rights reserved.</div>
        </div>
        <div className="land-footer-links">
          <Link href="#" className="land-footer-link">Privacy</Link>
          <Link href="#" className="land-footer-link">Terms</Link>
          <Link href="#" className="land-footer-link">Security</Link>
          <Link href="/login" className="land-footer-link">Sign In</Link>
        </div>
      </footer>
    </div>
  );
}
