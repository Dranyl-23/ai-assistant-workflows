import Link from "next/link";
import { Bot, Home, ArrowLeft, Search } from "lucide-react";

export default function NotFound() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative", fontFamily: "Inter, sans-serif" }}>
      {/* Background */}
      <div style={{ position: "fixed", inset: 0, zIndex: -1, background: "radial-gradient(ellipse at 30% 30%, rgba(139,92,246,0.08) 0%, transparent 50%), radial-gradient(ellipse at 70% 70%, rgba(99,102,241,0.06) 0%, transparent 50%), #09090b" }} />

      <div style={{ textAlign: "center", maxWidth: "520px", width: "100%", animation: "fadeIn 0.5s ease-out" }}>
        {/* Bot icon */}
        <div style={{ width: "90px", height: "90px", borderRadius: "24px", background: "linear-gradient(135deg, #8b5cf6, #6366f1, #22d3ee)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px", boxShadow: "0 20px 60px rgba(139,92,246,0.35)", animation: "float 3s ease-in-out infinite" }}>
          <Bot size={44} color="white" />
        </div>

        {/* 404 */}
        <div style={{ fontSize: "120px", fontWeight: "900", lineHeight: "1", letterSpacing: "-0.05em", background: "linear-gradient(135deg, #8b5cf6, #6366f1, #22d3ee)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", marginBottom: "8px" }}>
          404
        </div>

        <h1 style={{ fontSize: "28px", fontWeight: "800", marginBottom: "12px", color: "#fafafa" }}>
          Page not found
        </h1>
        <p style={{ color: "#71717a", fontSize: "16px", lineHeight: "1.7", marginBottom: "48px" }}>
          Oops! This page doesn't exist or has been moved. Let's get you back on track.
        </p>

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 28px", borderRadius: "12px", background: "linear-gradient(135deg, #8b5cf6, #6366f1)", color: "white", fontWeight: "700", fontSize: "15px", textDecoration: "none", boxShadow: "0 8px 25px rgba(139,92,246,0.3)" }}>
            <Home size={18} /> Go to Dashboard
          </Link>
          <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "14px 28px", borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(63,63,70,0.5)", color: "#a1a1aa", fontWeight: "600", fontSize: "15px", textDecoration: "none" }}>
            <ArrowLeft size={18} /> Back to Home
          </Link>
        </div>

        {/* Hint */}
        <p style={{ marginTop: "48px", color: "#52525b", fontSize: "13px" }}>
          Lost? Try the{" "}
          <Link href="/dashboard/chat" style={{ color: "#a78bfa", textDecoration: "none", fontWeight: "600" }}>
            AI Chat
          </Link>{" "}
          — it might know the answer.
        </p>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      `}</style>
    </div>
  );
}
