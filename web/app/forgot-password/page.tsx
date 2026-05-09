"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";
import { Bot, Mail, ArrowLeft, CheckCircle2, Sparkles, Send } from "lucide-react";

type Step = "form" | "sent";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await resetPassword(email);
      setStep("sent");
    } catch (err: any) {
      setError(err.message || "Failed to send reset email.");
    } finally {
      setLoading(false);
    }
  };

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
            {step === "form" ? "Recover Password" : "Check Email"}
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "16px" }}>
            {step === "form" ? "We'll send you instructions to reset your account" : `A reset link has been sent to your inbox`}
          </p>
        </div>

        {/* Main Card */}
        <div style={{
          background: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(20px)",
          borderRadius: "32px",
          padding: "48px",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          position: "relative"
        }}>
          {step === "form" ? (
            <>
              {error && (
                <div style={{ padding: "12px 16px", background: "rgba(239, 68, 68, 0.1)", border: "1px solid rgba(239, 68, 68, 0.2)", borderRadius: "14px", color: "#f87171", fontSize: "14px", marginBottom: "24px" }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "14px", fontWeight: "600", color: "var(--text-secondary)", marginBottom: "8px" }}>Email Address</label>
                  <div style={{ position: "relative" }}>
                    <Mail size={18} color="var(--text-muted)" style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)" }} />
                    <input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="name@domain.com" 
                      required 
                      style={{ width: "100%", padding: "14px 14px 14px 48px", borderRadius: "16px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", color: "white", outline: "none" }} 
                    />
                  </div>
                </div>

                <button type="submit" disabled={loading} className="btn-primary" style={{ width: "100%", padding: "16px", borderRadius: "16px", fontSize: "16px", fontWeight: "700", justifyContent: "center", marginTop: "8px", display: "flex", alignItems: "center" }}>
                  {loading ? <div className="spinner" style={{ width: "18px", height: "18px" }} /> : "Send Reset Instructions"}
                  {!loading && <Send size={18} style={{ marginLeft: "8px" }} />}
                </button>
              </form>
            </>
          ) : (
            <div style={{ textAlign: "center" }}>
              <div style={{ 
                width: "72px", height: "72px", borderRadius: "22px", 
                background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.2)",
                display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px"
              }}>
                <CheckCircle2 size={36} color="#4ade80" />
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "15px", lineHeight: "1.7", marginBottom: "32px" }}>
                We've sent a password reset link to <strong>{email}</strong>. Please check your inbox and follow the instructions.
              </p>
              <button 
                onClick={() => setStep("form")} 
                style={{ background: "none", border: "none", color: "var(--primary-violet)", fontWeight: "700", cursor: "pointer", fontSize: "15px" }}
              >
                Didn't receive the email? Try again
              </button>
            </div>
          )}

          <div style={{ marginTop: "40px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "24px" }}>
            <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: "8px", color: "white", fontWeight: "600", textDecoration: "none", fontSize: "14px" }}>
              <ArrowLeft size={16} /> Back to Sign In
            </Link>
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
