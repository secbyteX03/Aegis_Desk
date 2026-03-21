"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function RegisterPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [org, setOrg] = useState("");
  const [role, setRole] = useState("On-Call Engineer");
  const [customRole, setCustomRole] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  const roles = [
    "On-Call Engineer",
    "SRE",
    "Incident Manager",
    "DevOps Lead",
    "Manager"
  ];

  const getPasswordStrength = (pwd: string) => {
    if (pwd.length === 0) return { width: '0%', color: '#30363d', text: '' };
    if (pwd.length >= 12 && /[A-Z]/.test(pwd) && /[0-9]/.test(pwd) && /[^a-zA-Z0-9]/.test(pwd)) {
      return { width: '100%', color: '#3fb950', text: 'Strong password' };
    }
    if (pwd.length >= 8) {
      return { width: '65%', color: '#ffa657', text: 'Fair — add more variety' };
    }
    return { width: '30%', color: '#f85149', text: 'Weak — add uppercase, numbers & symbols' };
  };

  const pwdStrength = getPasswordStrength(password);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (!firstName || !lastName || !email || !password) {
      setError("Please fill in all required fields.");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName: `${firstName} ${lastName}`,
          organizationName: org,
          role: showCustomInput && customRole.trim() ? customRole.trim() : role
        }),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem("aegis_token", data.token);
        localStorage.setItem("aegis_user", JSON.stringify(data.user));
        router.push("/app");
      } else {
        const data = await res.json();
        setError(data.error || "Registration failed");
      }
    } catch (err) {
      setError("Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
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
          <div className="auth-title">Create your account</div>
          <div className="auth-sub">Join your team on AegisDesk</div>

          <div className="auth-error" id="reg-error" style={{ display: error ? 'block' : 'none' }}>
            {error || 'Please fill in all required fields.'}
          </div>

          <form onSubmit={handleRegister}>
            <div className="auth-row">
              <div className="afield">
                <label>First name</label>
                <input
                  type="text"
                  id="reg-first"
                  placeholder="Alex"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="afield">
                <label>Last name</label>
                <input
                  type="text"
                  id="reg-last"
                  placeholder="Chen"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="afield">
              <label>Work email</label>
              <input
                type="email"
                id="reg-email"
                placeholder="alex@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="afield">
              <label>Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? "text" : "password"}
                  id="reg-pwd"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              <div
                id="pwd-bar"
                className="pwd-strength"
                style={{
                  background: pwdStrength.color,
                  width: pwdStrength.width,
                  height: '3px',
                  borderRadius: '2px',
                  marginTop: '6px',
                  transition: 'all 0.3s'
                }}
              ></div>
              <div
                id="pwd-hint"
                className="pwd-hint"
                style={{
                  fontSize: '10px',
                  color: pwdStrength.color,
                  marginTop: '4px'
                }}
              >
                {pwdStrength.text}
              </div>
            </div>

            <div className="afield">
              <label>Team / Organization</label>
              <input
                type="text"
                id="reg-org"
                placeholder="Acme Corp Engineering"
                value={org}
                onChange={(e) => setOrg(e.target.value)}
              />
            </div>

            <div className="afield">
              <label>Role</label>
              <div className="role-chips" id="role-chips">
                {roles.map((r) => (
                  <div
                    key={r}
                    className={`role-chip ${role === r && !showCustomInput ? 'sel' : ''}`}
                    onClick={() => { setRole(r); setShowCustomInput(false); setCustomRole(""); }}
                  >
                    {r}
                  </div>
                ))}
                <div
                  className={`role-chip ${showCustomInput ? 'sel' : ''}`}
                  onClick={() => setShowCustomInput(true)}
                >
                  + Custom
                </div>
              </div>
              {showCustomInput && (
                <input
                  type="text"
                  id="reg-custom-role"
                  placeholder="Enter your custom role..."
                  value={customRole}
                  onChange={(e) => setCustomRole(e.target.value)}
                  style={{ marginTop: '8px' }}
                />
              )}
            </div>

            <button className="auth-btn" type="submit" disabled={loading}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="auth-link">
            Already have an account? <span onClick={() => router.push('/login')}>Sign in</span>
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
          overflow-y: auto;
          padding: 40px 0;
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
        .auth-row {
          display: flex;
          gap: 10px;
        }
        .auth-row .afield {
          flex: 1;
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
        .pwd-strength {
          height: 3px;
          border-radius: 2px;
          margin-top: 6px;
          transition: all .3s;
        }
        .pwd-hint {
          font-size: 10px;
          color: #6e7681;
          margin-top: 4px;
        }
        .role-chips {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-top: 4px;
        }
        .role-chip {
          padding: 5px 12px;
          border: 1px solid #30363d;
          border-radius: 20px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          transition: all .15s;
          background: #21262d;
          color: #8b949e;
        }
        .role-chip.sel {
          border-color: #58a6ff;
          color: #58a6ff;
          background: rgba(88,166,255,.1);
        }
        .role-chip:hover:not(.sel) {
          border-color: #484f58;
          color: #f0f6fc;
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
      `}</style>
    </div>
  );
}
