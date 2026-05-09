"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  MessageSquare, 
  FileText, 
  Plug, 
  Zap, 
  ArrowRight, 
  Sparkles, 
  Clock, 
  Brain,
  Plus,
  ShieldCheck,
  TrendingUp,
  Cpu,
  CheckCircle2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function DashboardPage() {
  const { user, session } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState({
    conversations: 0,
    documents: 0,
    memories: 0
  });
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

  useEffect(() => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    fetchStats();
  }, [session]);

  const fetchStats = async () => {
    if (!session?.access_token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const headers = { Authorization: `Bearer ${session.access_token}` };

    try {
      // Fetch each stat independently so one failure doesn't block the others
      const [convCount, docCount, memCount] = await Promise.all([
        fetch(`${API_URL}/chat/conversations`, { headers })
          .then(r => r.ok ? r.json() : { conversations: [] })
          .then(d => d.conversations?.length ?? 0)
          .catch(() => 0),
        fetch(`${API_URL}/documents`, { headers })
          .then(r => r.ok ? r.json() : { documents: [] })
          .then(d => d.documents?.length ?? 0)
          .catch(() => 0),
        fetch(`${API_URL}/memories`, { headers })
          .then(r => r.ok ? r.json() : { memories: [] })
          .then(d => d.memories?.length ?? 0)
          .catch(() => 0),
      ]);

      setStats({ conversations: convCount, documents: docCount, memories: memCount });
    } catch (err) {
      console.warn("[Dashboard] Backend unreachable — is the backend server running on port 5000?", err);
    } finally {
      setLoading(false);
    }
  };


  const cards = [
    { label: "Conversations", value: stats.conversations, icon: <MessageSquare size={20} />, color: "var(--primary-violet)", gradient: "rgba(139, 92, 246, 0.1)" },
    { label: "Knowledge Assets", value: stats.documents, icon: <FileText size={20} />, color: "#38bdf8", gradient: "rgba(56, 189, 248, 0.1)" },
    { label: "Learned Memories", value: stats.memories, icon: <Brain size={20} />, color: "#10b981", gradient: "rgba(16, 185, 129, 0.1)" },
  ];

  const quickActions = [
    { 
      title: "New Chat Session", 
      desc: "Start a conversation with LuminaAI.", 
      icon: <Plus size={20} />, 
      href: "/dashboard/chat", 
      color: "var(--primary-violet)" 
    },
    { 
      title: "Upload Knowledge", 
      desc: "Add new documents to your database.", 
      icon: <UploadIcon size={20} />, 
      href: "/dashboard/documents", 
      color: "#38bdf8" 
    },
    { 
      title: "Integration Hub", 
      desc: "Connect your workspace apps.", 
      icon: <Plug size={20} />, 
      href: "/dashboard/integrations", 
      color: "#f472b6" 
    },
  ];

  return (
    <div className="animate-fade-in" style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "60px" }}>
      
      {/* Welcome Banner */}
      <div className="glass-card" style={{ 
        padding: "48px", 
        marginBottom: "40px", 
        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(15, 23, 42, 0.4) 100%)",
        border: "1px solid rgba(139, 92, 246, 0.2)",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ 
            display: "inline-flex", 
            alignItems: "center", 
            gap: "8px", 
            padding: "6px 12px", 
            borderRadius: "20px", 
            background: "rgba(16, 185, 129, 0.1)", 
            color: "#10b981",
            fontSize: "12px",
            fontWeight: "700",
            marginBottom: "16px",
            border: "1px solid rgba(16, 185, 129, 0.2)"
          }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", animation: "pulse-green 2s infinite" }} />
            SYSTEM OPERATIONAL
          </div>
          <h1 style={{ fontSize: "42px", fontWeight: "800", marginBottom: "12px", letterSpacing: "-0.02em" }}>
            Welcome back, <span className="gradient-text">{user?.user_metadata?.full_name?.split(" ")[0] || "User"}</span>! 
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "18px", maxWidth: "600px", lineHeight: "1.6" }}>
            Your personal AI Assistant is ready to help with your workflows today.
          </p>
        </div>

        {/* Decorative elements */}
        <div style={{
          position: "absolute",
          top: "-20px",
          right: "-20px",
          width: "200px",
          height: "200px",
          background: "radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)",
          filter: "blur(40px)",
          pointerEvents: "none"
        }} />
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginBottom: "48px" }}>
        {cards.map((card, i) => (
          <div key={i} className="glass-card stat-card" style={{ padding: "32px", transition: "all 0.3s ease" }}>
            <div style={{ 
              width: "48px", 
              height: "48px", 
              borderRadius: "14px", 
              background: card.gradient, 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              color: card.color,
              marginBottom: "20px"
            }}>
              {card.icon}
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-muted)", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em" }}>{card.label}</p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
              <h3 style={{ fontSize: "36px", fontWeight: "800" }}>{loading ? "..." : card.value}</h3>
              <span style={{ fontSize: "12px", color: "#10b981", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                <TrendingUp size={12} /> Live
              </span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "32px" }}>
        
        {/* Quick Actions Column */}
        <div>
          <h2 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
             <Zap size={20} color="var(--primary-violet)" /> Command Center
          </h2>
          <div style={{ display: "grid", gap: "16px" }}>
            {quickActions.map((action, i) => (
              <button
                key={i}
                onClick={() => router.push(action.href)}
                className="glass-card"
                style={{
                  padding: "24px",
                  display: "flex",
                  alignItems: "center",
                  gap: "20px",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  border: "1px solid rgba(255,255,255,0.05)",
                  width: "100%",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  e.currentTarget.style.borderColor = action.color + "40";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)";
                }}
              >
                <div style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "12px",
                  background: action.color + "15",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: action.color,
                  flexShrink: 0
                }}>
                  {action.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h4 style={{ fontSize: "16px", fontWeight: "700", color: "white" }}>{action.title}</h4>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>{action.desc}</p>
                </div>
                <ArrowRight size={18} color="var(--text-muted)" />
              </button>
            ))}
          </div>
        </div>

        {/* AI Insight Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
             <Sparkles size={20} color="#38bdf8" /> Smart Insights
          </h2>
          
          <div className="glass-card" style={{ padding: "28px", background: "rgba(56, 189, 248, 0.03)", border: "1px solid rgba(56, 189, 248, 0.1)" }}>
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              <div style={{ color: "#38bdf8" }}><Brain size={24} /></div>
              <h4 style={{ fontWeight: "700", fontSize: "15px" }}>Memory Snapshot</h4>
            </div>
            <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: "1.6", fontStyle: "italic" }}>
              {stats.memories > 0 
                ? "The AI remembers your personal preferences for faster, more relevant responses." 
                : "Start chatting with the AI so it can begin learning your workflow preferences."}
            </p>
          </div>

          <div className="glass-card" style={{ padding: "28px", background: "rgba(139, 92, 246, 0.03)", border: "1px solid rgba(139, 92, 246, 0.1)" }}>
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              <div style={{ color: "var(--primary-violet)" }}><ShieldCheck size={24} /></div>
              <h4 style={{ fontWeight: "700", fontSize: "15px" }}>Security Health</h4>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#10b981", fontWeight: "600" }}>
              <CheckCircle2 size={16} /> All systems protected
            </div>
          </div>
        </div>

      </div>

      <style jsx>{`
        .gradient-text {
          background: var(--gradient-primary);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        @keyframes pulse-green {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .stat-card:hover {
          transform: translateY(-5px);
          background: rgba(255,255,255,0.04);
          border-color: rgba(139, 92, 246, 0.2);
          box-shadow: 0 20px 40px rgba(0,0,0,0.3);
        }
      `}</style>
    </div>
  );
}

function UploadIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
