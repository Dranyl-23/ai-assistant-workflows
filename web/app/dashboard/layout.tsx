"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Sidebar collapsed state lives here so the layout can react to it
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Chat page is full-height with no inner padding — layout gives it the full viewport
  const isChat = pathname === "/dashboard/chat";

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", background: "var(--bg-primary)" }}>
        <div style={{ width: "56px", height: "56px", borderRadius: "16px", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 40px rgba(139,92,246,0.3)", animation: "pulse-glow 2s ease-in-out infinite" }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/><line x1="9" y1="21" x2="15" y2="21"/><line x1="10" y1="17" x2="10" y2="21"/><line x1="14" y1="17" x2="14" y2="21"/>
          </svg>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "var(--text-muted)", fontSize: "14px" }}>
          <div style={{ width: "18px", height: "18px", border: "2px solid rgba(139,92,246,0.3)", borderTopColor: "var(--accent-violet)", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
          Loading your workspace...
        </div>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @keyframes pulse-glow { 0%,100% { box-shadow: 0 0 30px rgba(139,92,246,0.2); } 50% { box-shadow: 0 0 60px rgba(139,92,246,0.45); } }
        `}</style>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar collapsed={sidebarCollapsed} onToggle={setSidebarCollapsed} />
      <main style={{
        flex: 1,
        // Dynamically tracks sidebar width (260px expanded, 72px collapsed)
        marginLeft: sidebarCollapsed ? "72px" : "260px",
        // Chat page owns its own full-height layout — no outer padding needed
        padding: isChat ? "0" : "32px",
        height: "100vh",
        overflowY: isChat ? "hidden" : "auto",
        transition: "margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        {children}
      </main>
    </div>
  );
}
