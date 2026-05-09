"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Bot, Sparkles, ArrowRight, Eye, EyeOff, Lock, Mail, User, CheckCircle2 } from "lucide-react";

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, signInWithOAuth, session, loading: authLoading } = useAuth();
  const router = useRouter();

  // 1. Auto-Redirect if already logged in
  useEffect(() => {
    if (!authLoading && session) {
      router.push("/dashboard");
    }
  }, [session, authLoading, router]);

  // 2. Load "Remember Me" email
  useEffect(() => {
    const savedEmail = localStorage.getItem("remembered_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const validateForm = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return false;
    }
    if (isSignUp && !fullName.trim()) {
      setError("Full name is required for registration.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (!validateForm()) return;
    
    setLoading(true);

    try {
      if (isSignUp) {
        await signUp(email, password, fullName);
        setSuccess("Account created successfully! Please check your email for verification.");
      } else {
        await signIn(email, password);
        if (rememberMe) {
          localStorage.setItem("remembered_email", email);
        } else {
          localStorage.removeItem("remembered_email");
        }
        router.push("/dashboard");
      }
    } catch (err: any) {
      const message = err.message || "An unexpected error occurred.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider: "google" | "github") => {
    try {
      setLoading(true);
      setError("");
      setSuccess(`Redirecting to ${provider}...`);
      await signInWithOAuth(provider);
    } catch (err: any) {
      setError(`Failed to sign in with ${provider}. Please try again.`);
      setSuccess("");
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#020617" }}>
        <div className="spinner" style={{ width: "40px", height: "40px" }} />
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
      position: "relative",
      background: "#020617",
      overflow: "hidden",
      fontFamily: "Inter, sans-serif"
    }}>
      {/* Dynamic Background Elements */}
      <div style={{ position: "absolute", top: "-10%", left: "-10%", width: "40%", height: "40%", background: "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)", filter: "blur(60px)", animation: "float 10s infinite ease-in-out" }} />
      <div style={{ position: "absolute", bottom: "-10%", right: "-10%", width: "40%", height: "40%", background: "radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, transparent 70%)", filter: "blur(60px)", animation: "float 12s infinite ease-in-out reverse" }} />

      <div style={{ width: "100%", maxWidth: "460px", zIndex: 10 }}>
        {/* Header Section */}
        <div style={{ textAlign: "center", marginBottom: "40px" }}>
          <div style={{
            width: "80px", height: "80px", borderRadius: "24px",
            background: "var(--gradient-primary)", display: "flex",
            alignItems: "center", justifyContent: "center", margin: "0 auto 24px",
            boxShadow: "0 20px 40px rgba(139, 92, 246, 0.3)",
            animation: "float 4s ease-in-out infinite",
          }}>
            <Bot size={40} color="white" />
          </div>
          <h1 style={{ fontSize: "36px", fontWeight: "800", color: "white", marginBottom: "12px", letterSpacing: "-1px" }}>
            {isSignUp ? "Create an Account" : "Welcome Back"}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "16px" }}>
            {isSignUp ? "Join the next generation of AI workflow" : "Sign in to continue your journey"}
          </p>
        </div>

        {/* Main Auth Card */}
        <div style={{
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(20px)",
          borderRadius: "32px",
          padding: "48px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          position: "relative"
        }}>
          {/* Social Logins */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "32px" }}>
            <button onClick={() => handleSocialLogin("google")} style={{ 
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              padding: "12px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(255,255,255,0.03)", color: "white", cursor: "pointer",
              fontSize: "14px", fontWeight: "600", transition: "all 0.2s"
            }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"} onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09zM12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23zM5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84zM12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Google
            </button>
            <button onClick={() => handleSocialLogin("github")} style={{ 
              display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              padding: "12px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)",
              background: "rgba(255,255,255,0.03)", color: "white", cursor: "pointer",
              fontSize: "14px", fontWeight: "600", transition: "all 0.2s"
            }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.08)"} onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
              GitHub
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "32px" }}>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }} />
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "1px" }}>Or email</span>
            <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.05)" }} />
          </div>

          {error && (
            <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "14px", color: "#f87171", fontSize: "14px", marginBottom: "24px" }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{ padding: "12px 16px", background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.2)", borderRadius: "14px", color: "#4ade80", fontSize: "14px", marginBottom: "24px", display: "flex", alignItems: "center", gap: "10px" }}>
              <CheckCircle2 size={18} />
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {isSignUp && (
              <div>
                <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "8px" }}>Full Name</label>
                <div style={{ position: "relative" }}>
                  <User size={18} color="var(--text-muted)" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }} />
                  <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alfie Lynard" style={{ width: "100%", padding: "14px 14px 14px 48px", borderRadius: "16px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", color: "white", outline: "none" }} />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "8px" }}>Email Address</label>
              <div style={{ position: "relative" }}>
                <Mail size={18} color="var(--text-muted)" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }} />
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@domain.com" required style={{ width: "100%", padding: "14px 14px 14px 48px", borderRadius: "16px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", color: "white", outline: "none" }} />
              </div>
            </div>

            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <label style={{ fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)" }}>Password</label>
                {!isSignUp && <Link href="/forgot-password" style={{ background: "none", border: "none", fontSize: "13px", color: "var(--primary-violet)", fontWeight: "600", cursor: "pointer", textDecoration: "none" }}>Forgot?</Link>}
              </div>
              <div style={{ position: "relative" }}>
                <Lock size={18} color="var(--text-muted)" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }} />
                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required style={{ width: "100%", padding: "14px 48px 14px 48px", borderRadius: "16px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", color: "white", outline: "none" }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "16px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {!isSignUp && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => setRememberMe(!rememberMe)}>
                <div style={{ width: "20px", height: "20px", borderRadius: "6px", border: "2px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s", background: rememberMe ? "var(--primary-violet)" : "transparent" }}>
                  {rememberMe && <CheckCircle2 size={14} color="white" />}
                </div>
                <span style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: "500" }}>Remember me</span>
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", padding: "16px", borderRadius: "16px", fontSize: "16px", fontWeight: "700", justifyContent: "center", marginTop: "8px", display: "flex", alignItems: "center" }}>
              {loading ? <div className="spinner" style={{ width: "18px", height: "18px" }} /> : (isSignUp ? "Create Free Account" : "Sign In to Dashboard")}
              {!loading && <ArrowRight size={20} style={{ marginLeft: "8px" }} />}
            </button>
          </form>

          <div style={{ marginTop: "40px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "24px" }}>
            <p style={{ color: "var(--text-muted)", fontSize: "14px", fontWeight: "500" }}>
              {isSignUp ? "Already have an account?" : "Don't have an account yet?"}
              <button onClick={() => setIsSignUp(!isSignUp)} style={{ background: "none", border: "none", color: "var(--primary-violet)", fontWeight: "700", cursor: "pointer", marginLeft: "8px" }}>
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-20px) scale(1.05); } }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(139, 92, 246, 0.3); }
        .btn-primary:active { transform: translateY(0); }
        .spinner {
          border: 3px solid rgba(255,255,255,0.3);
          border-top: 3px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
