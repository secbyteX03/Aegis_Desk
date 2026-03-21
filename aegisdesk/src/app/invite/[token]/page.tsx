"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";

interface InvitationData {
  valid: boolean;
  error?: string;
  invitation?: {
    email: string;
    role: string;
    organizationName: string;
    expiresAt: string;
  };
}

function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token as string;
  
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if user is logged in
    const storedToken = localStorage.getItem("aegis_token");
    setIsLoggedIn(!!storedToken);

    // Verify invitation token
    const verifyInvitation = async () => {
      try {
        const response = await fetch(`/api/team/accept?token=${token}`);
        const data = await response.json();
        setInvitation(data);
      } catch (err) {
        setInvitation({ valid: false, error: "Failed to verify invitation" });
      } finally {
        setLoading(false);
      }
    };

    if (token) {
      verifyInvitation();
    }
  }, [token]);

  const handleAccept = async () => {
    const storedToken = localStorage.getItem("aegis_token");
    
    if (!storedToken) {
      // Store the token and redirect to login, then back to accept
      localStorage.setItem("pending_invite_token", token);
      router.push("/login?redirect=/invite/" + token);
      return;
    }

    setAccepting(true);
    setError("");

    try {
      const response = await fetch("/api/team/accept", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${storedToken}`,
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to accept invitation");
        return;
      }

      setAccepted(true);
      
      // Redirect to app after short delay
      setTimeout(() => {
        router.push("/app");
      }, 2000);
    } catch (err) {
      setError("An error occurred while accepting the invitation");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="invite-container">
        <div className="invite-card">
          <div className="invite-loading">
            <div className="spinner"></div>
            <p>Verifying invitation...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!invitation?.valid) {
    return (
      <div className="invite-container">
        <div className="invite-card invite-error">
          <div className="invite-icon error">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="15" y1="9" x2="9" y2="15"/>
              <line x1="9" y1="9" x2="15" y2="15"/>
            </svg>
          </div>
          <h2>Invalid Invitation</h2>
          <p>{invitation?.error || "This invitation link is invalid or has expired."}</p>
          <Link href="/" className="invite-btn secondary">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="invite-container">
        <div className="invite-card invite-success">
          <div className="success-animation">
            <div className="success-checkmark">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <div className="success-rings">
              <div className="success-ring"></div>
              <div className="success-ring"></div>
              <div className="success-ring"></div>
            </div>
          </div>
          <h2>Welcome Aboard!</h2>
          <p className="success-org">You've successfully joined <strong>{invitation.invitation?.organizationName}</strong></p>
          <p className="success-message">Your account is now connected to the team.</p>
          <div className="success-progress">
            <div className="progress-bar">
              <div className="progress-fill"></div>
            </div>
            <p className="redirect-text">Redirecting you to dashboard...</p>
          </div>
          <button className="invite-btn primary" onClick={() => router.push('/app')}>
            Go to Dashboard Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="invite-container">
      <div className="invite-card">
        <div className="invite-header">
          <div className="invite-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
              <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
            </svg>
          </div>
          <h2>You're Invited!</h2>
        </div>

        <div className="invite-details">
          <p className="invite-org">{invitation.invitation?.organizationName}</p>
          <p className="invite-email">
            You've been invited to join as <strong>{invitation.invitation?.role}</strong>
          </p>
          <p className="invite-target">Invitation sent to: {invitation.invitation?.email}</p>
          <div className="invite-warning">
            ⚠️ You must be logged in (or register) with this exact email address to accept the invitation.
          </div>
        </div>

        {error && <div className="invite-error-msg">{error}</div>}

        <div className="invite-actions">
          <button 
            className="invite-btn primary" 
            onClick={handleAccept}
            disabled={accepting}
          >
            {accepting ? (
              <>
                <span className="btn-spinner"></span>
                Accepting...
              </>
            ) : isLoggedIn ? (
              "Accept Invitation"
            ) : (
              "Login to Accept"
            )}
          </button>
          
          {!isLoggedIn && (
            <p className="invite-login-hint">
              Already have an account? <Link href={`/login?redirect=/invite/${token}`}>Login</Link>
            </p>
          )}
        </div>

        <p className="invite-expiry">
          This invitation expires on {new Date(invitation.invitation?.expiresAt || "").toLocaleDateString()}
        </p>
      </div>

      <style jsx>{`
        .invite-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--bg, #0d1117);
          padding: 20px;
        }

        .invite-card {
          background: var(--c0, #161b22);
          border: 1px solid var(--c2, #30363d);
          border-radius: 12px;
          padding: 40px;
          max-width: 420px;
          width: 100%;
          text-align: center;
        }

        .invite-header {
          margin-bottom: 24px;
        }

        .invite-icon {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: var(--primary, #238636);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
          color: white;
        }

        .invite-icon.error {
          background: #f85149;
        }

        .invite-icon.success {
          background: #238636;
        }

        .invite-card h2 {
          margin: 0;
          color: var(--t0, #f0f6fc);
          font-size: 24px;
        }

        .invite-details {
          margin: 24px 0;
          padding: 20px;
          background: var(--c1, #21262d);
          border-radius: 8px;
        }

        .invite-org {
          font-size: 18px;
          font-weight: 600;
          color: var(--t0, #f0f6fc);
          margin: 0 0 8px 0;
        }

        .invite-email {
          color: var(--t1, #c9d1d9);
          margin: 0 0 8px 0;
        }

        .invite-target {
          color: var(--t2, #8b949e);
          font-size: 13px;
          margin: 0;
        }

        .invite-warning {
          background: rgba(88, 166, 255, 0.1);
          border: 1px solid var(--primary, #58a6ff);
          color: var(--primary, #58a6ff);
          padding: 12px;
          border-radius: 8px;
          margin-top: 16px;
          font-size: 13px;
        }

        .invite-error-msg {
          background: rgba(248, 81, 73, 0.1);
          border: 1px solid #f85149;
          color: #f85149;
          padding: 12px;
          border-radius: 8px;
          margin-bottom: 16px;
          font-size: 14px;
        }

        .invite-actions {
          margin: 24px 0;
        }

        .invite-btn {
          width: 100%;
          padding: 14px 24px;
          border-radius: 8px;
          font-size: 16px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          border: none;
        }

        .invite-btn.primary {
          background: var(--primary, #238636);
          color: white;
        }

        .invite-btn.primary:hover:not(:disabled) {
          background: #2ea043;
        }

        .invite-btn.primary:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .invite-btn.secondary {
          background: transparent;
          color: var(--t1, #c9d1d9);
          border: 1px solid var(--c2, #30363d);
          text-decoration: none;
          display: inline-block;
        }

        .invite-btn.secondary:hover {
          border-color: var(--t2, #8b949e);
        }

        .invite-login-hint {
          color: var(--t2, #8b949e);
          font-size: 14px;
          margin-top: 16px;
        }

        .invite-login-hint a {
          color: var(--primary, #58a6ff);
          text-decoration: none;
        }

        .invite-login-hint a:hover {
          text-decoration: underline;
        }

        .invite-expiry {
          color: var(--t2, #8b949e);
          font-size: 12px;
          margin: 0;
        }

        .invite-loading {
          padding: 40px;
        }

        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid var(--c2, #30363d);
          border-top-color: var(--primary, #238636);
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 16px;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .btn-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .redirect-text {
          color: var(--primary, #58a6ff);
          font-size: 14px;
          margin-top: 8px;
        }

        .invite-card.invite-success {
          text-align: center;
          padding: 48px 40px;
        }

        .invite-card.invite-success h2 {
          color: #3fb950;
          margin-bottom: 8px;
          text-align: center;
        }

        .invite-card.invite-success p {
          text-align: center;
        }

        /* Success Animation Styles */
        .success-animation {
          position: relative;
          width: 80px;
          height: 80px;
          margin: 0 auto 24px;
        }

        .success-checkmark {
          width: 80px;
          height: 80px;
          position: relative;
          z-index: 2;
          animation: scaleIn 0.5s ease-out forwards;
        }

        .success-checkmark svg {
          color: #3fb950;
          width: 100%;
          height: 100%;
        }

        .success-rings {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
        }

        .success-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          border: 3px solid #3fb950;
          border-radius: 50%;
          opacity: 0;
          animation: ripple 1.5s ease-out infinite;
        }

        .success-ring:nth-child(2) {
          animation-delay: 0.5s;
        }

        .success-ring:nth-child(3) {
          animation-delay: 1s;
        }

        @keyframes scaleIn {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          50% {
            transform: scale(1.2);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes ripple {
          0% {
            transform: translate(-50%, -50%) scale(0.5);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(1.5);
            opacity: 0;
          }
        }

        .success-org {
          font-size: 18px;
          color: var(--t0, #f0f6fc);
          margin: 0 0 12px 0;
        }

        .success-org strong {
          color: var(--primary, #58a6ff);
        }

        .success-message {
          color: var(--t1, #c9d1d9);
          font-size: 14px;
          margin: 0 0 24px 0;
        }

        .success-progress {
          margin-bottom: 20px;
        }

        .success-progress .progress-bar {
          height: 4px;
          background: var(--c2, #30363d);
          border-radius: 2px;
          overflow: hidden;
        }

        .success-progress .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #3fb950, #58a6ff);
          border-radius: 2px;
          animation: progress 2s ease-in-out forwards;
        }

        @keyframes progress {
          0% {
            width: 0%;
          }
          100% {
            width: 100%;
          }
        }

        .invite-btn.primary:hover {
          background: #2ea043;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(35, 134, 54, 0.4);
        }
      `}</style>
    </div>
  );
}

export default function InvitePageWrapper() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <InvitePage />
    </Suspense>
  );
}
