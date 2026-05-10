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

  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  const isChat = pathname?.includes("/chat");

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

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
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", position: "relative" }}>
      {/* Mobile Backdrop Overlay */}
      {isMobile && mobileMenuOpen && (
        <div 
          onClick={() => setMobileMenuOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 40, backdropFilter: "blur(4px)" }} 
        />
      )}

      <Sidebar 
        collapsed={isMobile ? false : sidebarCollapsed} 
        onToggle={setSidebarCollapsed} 
        isMobile={isMobile}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main style={{
        flex: 1,
        // No margin on mobile, dynamic margin on desktop
        marginLeft: isMobile ? "0" : (sidebarCollapsed ? "72px" : "260px"),
        padding: isChat ? "0" : (isMobile ? "16px" : "32px"),
        paddingTop: isMobile && !isChat ? "72px" : (isChat ? "0" : "32px"),
        height: "100vh",
        overflowY: isChat ? "hidden" : "auto",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}>
        {/* Mobile Header Bar */}
        {isMobile && (
          <header style={{
            position: "fixed", top: 0, left: 0, right: 0, height: "60px",
            background: "rgba(2, 6, 23, 0.8)", backdropFilter: "blur(12px)",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            display: "flex", alignItems: "center", padding: "0 16px", zIndex: 30
          }}>
            <button 
              onClick={() => setMobileMenuOpen(true)}
              style={{ background: "none", border: "none", color: "white", padding: "8px", cursor: "pointer" }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <span style={{ marginLeft: "12px", fontWeight: "700", fontSize: "16px" }}>LuminaAI</span>
          </header>
        )}
        {children}
      </main>
    </div>
  );
}
