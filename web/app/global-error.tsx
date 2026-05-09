"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Bot, AlertTriangle, RefreshCw, Home } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error]:", error);
  }, [error]);

  return (
    <html>
      <body style={{ margin: 0, fontFamily: "Inter, -apple-system, sans-serif", background: "#09090b", color: "#fafafa", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        {/* BG */}
        <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "radial-gradient(ellipse at 30% 30%, rgba(239,68,68,0.06) 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(139,92,246,0.05) 0%, transparent 50%), #09090b" }} />

        <div style={{ textAlign: "center", maxWidth: "500px", width: "100%", position: "relative", zIndex: 1, animation: "fadeIn 0.5s ease-out" }}>
          {/* Icon */}
          <div style={{ width: "90px", height: "90px", borderRadius: "24px", background: "rgba(239,68,68,0.12)", border: "2px solid rgba(239,68,68,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px" }}>
            <AlertTriangle size={44} color="#ef4444" />
          </div>

          <h1 style={{ fontSize: "32px", fontWeight: "900", marginBottom: "12px", letterSpacing: "-0.02em" }}>
            Something went wrong
          </h1>

          {error?.message && (
            <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "10px", padding: "14px 18px", marginBottom: "24px", fontSize: "12px", color: "#fca5a5", fontFamily: "monospace", wordBreak: "break-all", textAlign: "left" }}>
              {error.message}
            </div>
          )}

          <p style={{ color: "#71717a", fontSize: "15px", lineHeight: "1.7", marginBottom: "40px" }}>
            An unexpected error occurred. Try refreshing — if this keeps happening, please contact support.
          </p>

          <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              onClick={reset}
              style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 28px", borderRadius: "12px", background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "white", fontWeight: "700", fontSize: "15px", border: "none", cursor: "pointer", boxShadow: "0 8px 25px rgba(139,92,246,0.3)" }}
            >
              <RefreshCw size={18} /> Try Again
            </button>
            <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 28px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(63,63,70,0.5)", color: "#a1a1aa", fontWeight: "600", fontSize: "15px", textDecoration: "none" }}>
              <Home size={18} /> Go Home
            </Link>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", justifyContent: "center", marginTop: "48px", color: "#3f3f46", fontSize: "12px" }}>
            <Bot size={14} />
            AI Assistant · Error Reference: {error?.digest || "unknown"}
          </div>
        </div>

        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        `}</style>
      </body>
    </html>
  );
}
