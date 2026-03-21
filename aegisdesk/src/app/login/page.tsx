"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("aegis_token", data.token);
        localStorage.setItem("aegis_user", JSON.stringify(data.user));
        router.push("/app");
      } else {
        const data = await res.json();
        setError(data.error || "Invalid email or password");
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: string) => {
    try {
      setLoading(true);
      setError("");

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("aegis_token", data.token);
        localStorage.setItem("aegis_user", JSON.stringify(data.user));
        router.push("/app");
      } else {
        const data = await res.json();
        setError(data.error || `${provider} login failed`);
      }
    } catch (err) {
      setError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    localStorage.setItem("aegis_token", "demo-token");
    localStorage.setItem("aegis_user", JSON.stringify({
      id: "demo-user",
      email: "demo@aegisdesk.io",
      name: "Demo User",
      role: "On-Call Engineer",
      organizationName: "AegisDesk"
    }));
    router.push("/app");
  };

  if (!mounted) {
    return null; // Prevent hydration mismatch
  }

  return (
    <div id="auth-wrap">
      <div className="auth-glow"></div>
      <div className="auth-box">
        <div className="auth-logo">
          <div className="auth-logo-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" />
              <path d="M2 17L12 12L22 17" />
              <path d="M2 7L2 17L12 12L22 7" />
            </svg>
          </div>
          <div className="auth-logo-text">AegisDesk</div>
        </div>

        <div className="auth-card">
          <div className="auth-title">Welcome back</div>
          <div className="auth-sub">Sign in to your AegisDesk workspace</div>

          <div className="auth-error" id="login-error" style={{ display: error ? 'block' : 'none' }}>
            {error || 'Invalid email or password'}
          </div>

          <form onSubmit={handleLogin}>
            <div className="afield">
              <label>Email address</label>
              <input
                type="email"
                id="login-email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="afield">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="login-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleLogin(e); }}
                  style={{ paddingRight: '40px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#8b949e',
                  }}
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '-8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '12px', color: '#58a6ff', cursor: 'pointer' }} onClick={() => alert('Password reset email sent!')}>
                Forgot password?
              </span>
            </div>

            <button className="auth-btn" type="submit" disabled={loading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="auth-divider">or continue with</div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btng btn"
              style={{ flex: 1, height: '38px', fontSize: '12px', justifyContent: 'center' }}
              onClick={() => handleOAuthLogin('google')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Google
            </button>
            <button
              className="btng btn"
              style={{ flex: 1, height: '38px', fontSize: '12px', justifyContent: 'center' }}
              onClick={() => handleOAuthLogin('github')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
              GitHub
            </button>
          </div>

          <div className="auth-link">
            Don't have an account? <span onClick={() => router.push('/register')}>Create one</span>
          </div>

          <div style={{ marginTop: '16px' }}>
            <button
              className="btng btn"
              style={{ width: '100%', height: '38px', fontSize: '12px', justifyContent: 'center', background: 'linear-gradient(135deg, #238636, #2ea043)', border: 'none' }}
              onClick={handleDemoLogin}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Try Demo (No Login Required)
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '11px', color: '#6e7681' }}>
          Secured with PowerSync end-to-end encryption
        </div>
      </div>

      <style>{`
        #auth-wrap {
          position: fixed;
          inset: 0;
          background: linear-gradient(135deg, #0a0a12 0%, #0d1117 50%, #0a0f1a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9000;
        }
        .auth-glow {
          position: absolute;
          width: 600px;
          height: 600px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(88,166,255,.07) 0%, transparent 70%);
          pointer-events: none;
        }
        .auth-box {
          width: 420px;
          position: relative;
          z-index: 1;
        }
        .auth-logo {
          display: flex;
          align-items: center;
          gap: 12px;
          justify-content: center;
          margin-bottom: 32px;
        }
        .auth-logo-icon {
          width: 44px;
          height: 44px;
          background: linear-gradient(135deg, #ff7b72, #bc8cff);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .auth-logo-text {
          font-size: 26px;
          font-weight: 700;
          letter-spacing: -.5px;
          color: #f0f6fc;
        }
        .auth-card {
          background: #161b22;
          border: 1px solid #30363d;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 8px 32px rgba(0,0,0,.6);
        }
        .auth-title {
          font-size: 20px;
          font-weight: 700;
          margin-bottom: 6px;
          color: #f0f6fc;
        }
        .auth-sub {
          font-size: 13px;
          color: #8b949e;
          margin-bottom: 28px;
        }
        .auth-error {
          background: rgba(248,81,73,.12);
          border: 1px solid rgba(248,81,73,.3);
          border-radius: 6px;
          padding: 10px 14px;
          font-size: 12px;
          color: #f85149;
          margin-bottom: 14px;
          display: none;
        }
        .auth-error.show {
          display: block;
        }
        .afield {
          margin-bottom: 16px;
        }
        .afield label {
          display: block;
          font-size: 11px;
          font-weight: 600;
          color: #6e7681;
          text-transform: uppercase;
          letter-spacing: .8px;
          margin-bottom: 6px;
        }
        .afield input {
          width: 100%;
          padding: 10px 14px;
          background: #21262d;
          border: 1px solid #30363d;
          border-radius: 6px;
          color: #f0f6fc;
          font-family: inherit;
          font-size: 13px;
          outline: none;
          transition: border-color .2s;
          box-sizing: border-box;
        }
        .afield input:focus {
          border-color: #58a6ff;
        }
        .afield input::placeholder {
          color: #6e7681;
        }
        .auth-btn {
          width: 100%;
          padding: 12px;
          background: linear-gradient(135deg, #58a6ff, #bc8cff);
          border: none;
          border-radius: 6px;
          color: #fff;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          font-family: inherit;
          transition: all .2s;
          margin-top: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .auth-btn:hover {
          opacity: .9;
          transform: translateY(-1px);
        }
        .auth-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 20px 0;
          font-size: 11px;
          color: #6e7681;
        }
        .auth-divider::before, .auth-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: #30363d;
        }
        .auth-link {
          text-align: center;
          font-size: 12px;
          color: #8b949e;
          margin-top: 16px;
        }
        .auth-link span {
          color: #58a6ff;
          cursor: pointer;
          font-weight: 500;
        }
        .auth-link span:hover {
          text-decoration: underline;
        }
        .btng {
          background: #21262d;
          border: 1px solid #30363d;
          color: #8b949e;
          cursor: pointer;
          transition: all .15s;
          font-family: inherit;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .btng:hover {
          background: #30363d;
          color: #f0f6fc;
        }
        .btn {
          padding: 0 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all .2s;
          border: none;
          height: 40px;
          display: flex;
          align-items: center;
          gap: 5px;
          white-space: nowrap;
          font-family: inherit;
        }
      `}</style>
    </div>
  );
}
