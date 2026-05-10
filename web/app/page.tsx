"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Bot, Sparkles, Loader2, ArrowRight, MessageSquare,
  FileText, Plug, Brain, Globe, Zap, Shield, Star,
  CheckCircle2, ChevronRight
} from "lucide-react";
import Link from "next/link";

const FEATURES = [
  { icon: <MessageSquare size={24} />, title: "Real-time AI Chat", desc: "WebSocket-powered streaming conversations with full context memory and multi-modal support.", color: "#8b5cf6" },
  { icon: <Globe size={24} />, title: "Live Web Search", desc: "AI answers grounded in real-time results via Tavily — no outdated knowledge.", color: "#22d3ee" },
  { icon: <FileText size={24} />, title: "Document RAG", desc: "Upload PDFs, DOCs, and text files. The AI reads and reasons over your documents.", color: "#34d399" },
  { icon: <Brain size={24} />, title: "Persistent Memory", desc: "The AI learns facts about you across sessions for hyper-personalized responses.", color: "#f59e0b" },
  { icon: <Plug size={24} />, title: "App Integrations", desc: "Connect Slack, Notion, Gmail, GitHub and more. AI triggers actions automatically.", color: "#fb7185" },
  { icon: <Zap size={24} />, title: "n8n Automation", desc: "Build custom AI workflows with your local n8n instance for limitless automation.", color: "#6366f1" },
];

const PRICING = [
  {
    name: "Free", price: "$0", period: "/month",
    desc: "Perfect for getting started",
    features: ["50 AI messages / month", "2 Documents max", "Basic integrations", "Standard memory"],
    cta: "Get Started Free", highlight: false,
  },
  {
    name: "Pro", price: "$19", period: "/month",
    desc: "For power users & professionals",
    features: ["Unlimited AI messages", "Unlimited documents", "All integrations", "Advanced smart actions", "Priority support"],
    cta: "Start Pro Trial", highlight: true,
  },
];

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard");
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div className="bg-mesh" />
        <Loader2 size={32} style={{ animation: "spin 1s linear infinite", color: "var(--accent-violet)" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", overflowX: "hidden" }}>
      <div className="bg-mesh" />

      {/* ── Nav ── */}
      <nav style={{ 
        position: "fixed", 
        top: 0, 
        left: 0, 
        right: 0, 
        zIndex: 100, 
        padding: isMobile ? "12px 20px" : "16px 40px", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        background: "rgba(9,9,11,0.8)", 
        backdropFilter: "blur(20px)", 
        borderBottom: "1px solid var(--border-primary)" 
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bot size={18} color="white" />
          </div>
          {!isMobile && <span style={{ fontWeight: "800", fontSize: "17px" }}><span className="gradient-text">AI Assistant</span></span>}
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <Link href="/login" style={{ padding: "6px 16px", borderRadius: "8px", border: "1px solid var(--border-primary)", color: "var(--text-secondary)", fontSize: "13px", fontWeight: "500", textDecoration: "none" }}>
            Sign In
          </Link>
          <Link href="/login" style={{ padding: "8px 20px", borderRadius: "8px", background: "var(--gradient-primary)", color: "white", fontSize: "13px", fontWeight: "600", textDecoration: "none", boxShadow: "0 4px 15px rgba(139,92,246,0.3)" }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      {/* ── Hero ── */}
      <section style={{ 
        paddingTop: isMobile ? "120px" : "160px", 
        paddingBottom: isMobile ? "80px" : "120px", 
        textAlign: "center", 
        maxWidth: "900px", 
        margin: "0 auto", 
        paddingLeft: "20px",
        paddingRight: "20px"
      }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 16px", borderRadius: "50px", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", marginBottom: "24px", fontSize: "12px", fontWeight: "600", color: "var(--accent-violet-light)" }}>
          <Sparkles size={12} />
          Powered by Groq · Supabase · n8n
        </div>

        <h1 style={{ fontSize: "clamp(32px, 8vw, 72px)", fontWeight: "900", lineHeight: "1.1", letterSpacing: "-0.03em", marginBottom: "20px" }}>
          Your Personal<br />
          <span className="gradient-text">AI Workflow Assistant</span>
        </h1>

        <p style={{ fontSize: isMobile ? "15px" : "20px", color: "var(--text-secondary)", maxWidth: "640px", margin: "0 auto 40px", lineHeight: "1.7" }}>
          Chat, search the web, analyze documents, automate tasks, and connect your favorite apps.
        </p>

        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexDirection: isMobile ? "column" : "row", padding: "0 20px" }}>
          <Link href="/login" style={{ 
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "10px", 
            padding: isMobile ? "14px 24px" : "16px 32px", 
            borderRadius: "12px", background: "var(--gradient-primary)", color: "white", 
            fontSize: isMobile ? "14px" : "15px", fontWeight: "700", textDecoration: "none", 
            boxShadow: "0 10px 40px rgba(139,92,246,0.35)",
            transition: "transform 0.2s"
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = "translateY(-2px)"}
          onMouseLeave={(e) => e.currentTarget.style.transform = "translateY(0)"}>
            Start for Free <ArrowRight size={18} />
          </Link>
          <Link href="#features" style={{ 
            display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "8px", 
            padding: isMobile ? "14px 24px" : "16px 32px", 
            borderRadius: "12px", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border-primary)", 
            color: "var(--text-primary)", fontSize: isMobile ? "14px" : "15px", fontWeight: "600", textDecoration: "none" 
          }}>
            See Features <ChevronRight size={18} />
          </Link>
        </div>

        {/* Hero Visual */}
        <div style={{ marginTop: isMobile ? "40px" : "80px", position: "relative", maxWidth: "700px", margin: (isMobile ? "40px" : "80px") + " auto 0" }}>
          <div className="glass-card-glow" style={{ padding: isMobile ? "16px" : "24px", borderRadius: "20px", background: "rgba(15,23,42,0.7)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", paddingBottom: "16px", borderBottom: "1px solid var(--border-primary)" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "10px", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Bot size={16} color="white" /></div>
              <div style={{ textAlign: "left" }}>
                <div style={{ fontWeight: "700", fontSize: "13px" }}>AI Assistant</div>
                <div style={{ fontSize: "10px", color: "#10b981", display: "flex", alignItems: "center", gap: "4px" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", display: "inline-block" }} /> Online
                </div>
              </div>
            </div>
            {[
              { role: "user", msg: "Summarize my report and sync with Notion." },
              { role: "ai", msg: "Analyzed! Revenue is up **23%**. Creating the Notion page now... ✅ Done!" },
            ].map((m, i) => (
              <div key={i} style={{ display: "flex", gap: "10px", marginBottom: "12px", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "8px", background: m.role === "user" ? "rgba(139,92,246,0.15)" : "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: "12px" }}>{m.role === "user" ? "👤" : <Bot size={14} color="white" />}</span>
                </div>
                <div style={{ background: m.role === "user" ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.04)", border: "1px solid " + (m.role === "user" ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.06)"), borderRadius: "12px", padding: "10px 14px", fontSize: "12px", lineHeight: "1.6", maxWidth: "85%", textAlign: "left" }}>
                  {m.msg}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" style={{ padding: isMobile ? "60px 20px" : "100px 24px", maxWidth: "1200px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: isMobile ? "40px" : "64px" }}>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 48px)", fontWeight: "900", letterSpacing: "-0.02em", marginBottom: "16px" }}>
            Everything you need, <span className="gradient-text">in one place</span>
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "16px", maxWidth: "500px", margin: "0 auto" }}>
            A complete AI-powered workspace designed for maximum productivity.
          </p>
        </div>
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(340px, 1fr))", 
          gap: "20px" 
        }}>
          {FEATURES.map((f) => (
            <div key={f.title} className="glass-card" style={{ padding: isMobile ? "24px" : "32px", borderRadius: "20px", transition: "all 0.3s", cursor: "default" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: f.color + "20", border: "1px solid " + f.color + "30", display: "flex", alignItems: "center", justifyContent: "center", color: f.color, marginBottom: "16px" }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: "17px", fontWeight: "700", marginBottom: "10px" }}>{f.title}</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "13.5px", lineHeight: "1.7" }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section style={{ padding: isMobile ? "60px 20px" : "100px 24px", maxWidth: "900px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: isMobile ? "40px" : "64px" }}>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 48px)", fontWeight: "900", letterSpacing: "-0.02em", marginBottom: "16px" }}>
            Simple <span className="gradient-text">pricing</span>
          </h2>
        </div>
        <div style={{ 
          display: "flex", 
          flexDirection: isMobile ? "column" : "row", 
          gap: "24px" 
        }}>
          {PRICING.map(plan => (
            <div key={plan.name} className={plan.highlight ? "glass-card-glow" : "glass-card"} style={{ padding: isMobile ? "32px 24px" : "40px", borderRadius: "24px", position: "relative", display: "flex", flexDirection: "column", flex: 1 }}>
              {plan.highlight && (
                <div style={{ position: "absolute", top: 0, right: "24px", transform: "translateY(-50%)", background: "var(--gradient-primary)", color: "white", padding: "4px 14px", borderRadius: "50px", fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center", gap: "5px" }}>
                  <Star size={10} fill="white" /> MOST POPULAR
                </div>
              )}
              <h3 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "4px" }}>{plan.name}</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>{plan.desc}</p>
              <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginBottom: "24px" }}>
                <span style={{ fontSize: "40px", fontWeight: "900" }}>{plan.price}</span>
                <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>{plan.period}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, marginBottom: "32px" }}>
                {plan.features.map(f => (
                  <div key={f} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "13px" }}>
                    <CheckCircle2 size={15} color={plan.highlight ? "var(--accent-violet)" : "#10b981"} />
                    {f}
                  </div>
                ))}
              </div>
              <Link href="/login" style={{ display: "block", textAlign: "center", padding: "14px", borderRadius: "12px", background: plan.highlight ? "var(--gradient-primary)" : "rgba(255,255,255,0.05)", border: plan.highlight ? "none" : "1px solid var(--border-primary)", color: "white", fontWeight: "700", fontSize: "14px", textDecoration: "none" }}>
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section style={{ padding: isMobile ? "40px 20px 80px" : "80px 24px 120px", textAlign: "center" }}>
        <div style={{ maxWidth: "600px", margin: "0 auto" }}>
          <div className="glass-card-glow" style={{ padding: isMobile ? "48px 24px" : "64px 40px", borderRadius: "28px", background: "linear-gradient(135deg, rgba(139,92,246,0.1) 0%, rgba(34,211,238,0.05) 100%)" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "18px", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", boxShadow: "0 15px 40px rgba(139,92,246,0.4)" }}>
              <Sparkles size={32} color="white" />
            </div>
            <h2 style={{ fontSize: isMobile ? "28px" : "36px", fontWeight: "900", marginBottom: "16px" }}>Ready to get started?</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "15px", marginBottom: "32px" }}>
              Join thousands of users automating their workflows with AI.
            </p>
            <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: "10px", padding: "16px 32px", borderRadius: "14px", background: "var(--gradient-primary)", color: "white", fontSize: "15px", fontWeight: "700", textDecoration: "none" }}>
              Create free account <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ 
        borderTop: "1px solid var(--border-primary)", 
        padding: isMobile ? "32px 20px" : "32px 40px", 
        display: "flex", 
        flexDirection: isMobile ? "column" : "row",
        justifyContent: "space-between", 
        alignItems: "center", 
        gap: isMobile ? "20px" : "0",
        color: "var(--text-muted)", 
        fontSize: "12px" 
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "24px", height: "24px", borderRadius: "6px", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><Bot size={14} color="white" /></div>
          <span>AI Assistant © 2026</span>
        </div>
        <div style={{ display: "flex", gap: isMobile ? "16px" : "24px", flexWrap: "wrap", justifyContent: "center" }}>
          <span>Privacy Policy</span>
          <span>Terms of Service</span>
        </div>
      </footer>

      <style>{`
        @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 640px) {
          nav { padding: 12px 16px !important; }
          section { padding-left: 16px !important; padding-right: 16px !important; }
          div[style*="gridTemplateColumns: 1fr 1fr"] { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
