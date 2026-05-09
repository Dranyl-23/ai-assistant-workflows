"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { CheckCircle2, Bot, Star, ArrowRight, Loader2 } from "lucide-react";

export default function BillingSuccessPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "cancelled">("loading");
  const [plan, setPlan] = useState("pro");

  useEffect(() => {
    const cancelled = searchParams.get("cancelled");
    if (cancelled === "true") {
      setStatus("cancelled");
      return;
    }

    // On success, verify the session so the subscription status refreshes
    const verifySession = async () => {
      await supabase.auth.getSession(); // Refresh session to pick up updated plan from webhook
      setStatus("success");
    };
    verifySession();
  }, [searchParams]);

  if (status === "loading") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="bg-mesh" />
        <div style={{ textAlign: "center" }}>
          <Loader2 size={40} style={{ animation: "spin 1s linear infinite", color: "var(--accent-violet)", margin: "0 auto 16px" }} />
          <p style={{ color: "var(--text-secondary)" }}>Confirming your payment...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (status === "cancelled") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative" }}>
        <div className="bg-mesh" />
        <div style={{ maxWidth: "480px", width: "100%", textAlign: "center", zIndex: 1 }} className="animate-fade-in">
          <div className="glass-card" style={{ padding: "56px 40px", borderRadius: "28px" }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "rgba(251,113,133,0.1)", border: "1px solid rgba(251,113,133,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px" }}>
              <span style={{ fontSize: "36px" }}>😔</span>
            </div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", marginBottom: "12px" }}>Payment Cancelled</h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px", lineHeight: "1.7", marginBottom: "40px" }}>
              No charges were made. You can upgrade to Pro anytime from your Settings.
            </p>
            <div style={{ display: "flex", gap: "12px", flexDirection: "column" }}>
              <Link href="/dashboard/settings" style={{ display: "block", padding: "14px", borderRadius: "12px", background: "var(--gradient-primary)", color: "white", fontWeight: "700", fontSize: "15px", textDecoration: "none", textAlign: "center" }}>
                Try Again
              </Link>
              <Link href="/dashboard" style={{ display: "block", padding: "14px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-primary)", color: "var(--text-secondary)", fontWeight: "600", fontSize: "15px", textDecoration: "none", textAlign: "center" }}>
                Back to Dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative" }}>
      <div className="bg-mesh" />
      <div style={{ maxWidth: "520px", width: "100%", textAlign: "center", zIndex: 1 }} className="animate-fade-in">
        <div className="glass-card-glow" style={{ padding: "56px 40px", borderRadius: "28px", background: "linear-gradient(135deg, rgba(139,92,246,0.08) 0%, rgba(34,211,238,0.04) 100%)" }}>
          {/* Success icon with animation */}
          <div style={{ position: "relative", width: "100px", height: "100px", margin: "0 auto 32px" }}>
            <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: "rgba(16,185,129,0.15)", border: "2px solid rgba(16,185,129,0.3)", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse-success 2s ease-in-out infinite" }}>
              <CheckCircle2 size={52} color="#10b981" />
            </div>
          </div>

          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 14px", borderRadius: "50px", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.2)", marginBottom: "20px", fontSize: "12px", fontWeight: "700", color: "var(--accent-violet-light)" }}>
            <Star size={12} fill="currentColor" /> PRO MEMBER
          </div>

          <h1 style={{ fontSize: "36px", fontWeight: "900", marginBottom: "16px", letterSpacing: "-0.02em" }}>
            Welcome to <span className="gradient-text">Pro!</span>
          </h1>

          <p style={{ color: "var(--text-secondary)", fontSize: "16px", lineHeight: "1.7", marginBottom: "40px" }}>
            Your account has been upgraded. You now have unlimited messages, unlimited documents, and access to all integrations.
          </p>

          {/* Pro perks list */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "40px", textAlign: "left" }}>
            {["Unlimited AI messages", "Unlimited documents", "All integrations", "Priority support"].map(perk => (
              <div key={perk} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", padding: "10px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <CheckCircle2 size={14} color="var(--accent-violet)" />
                {perk}
              </div>
            ))}
          </div>

          <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "16px 40px", borderRadius: "14px", background: "var(--gradient-primary)", color: "white", fontSize: "16px", fontWeight: "700", textDecoration: "none", boxShadow: "0 10px 40px rgba(139,92,246,0.35)" }}>
            Go to Dashboard <ArrowRight size={18} />
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes pulse-success {
          0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.3); }
          50% { box-shadow: 0 0 0 16px rgba(16,185,129,0); }
        }
      `}</style>
    </div>
  );
}
