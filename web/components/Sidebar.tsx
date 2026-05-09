"use client";

import { useAuth } from "@/context/AuthContext";
import { usePathname, useRouter } from "next/navigation";
import {
  Bot, MessageSquare, FileText, Plug, Settings,
  LogOut, LayoutDashboard, Plus, ChevronLeft, ChevronRight,
  ShieldAlert
} from "lucide-react";
import { useState } from "react";

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", href: "/dashboard" },
  { icon: MessageSquare, label: "Chat", href: "/dashboard/chat" },
  { icon: FileText, label: "Documents", href: "/dashboard/documents" },
  { icon: Plug, label: "Integrations", href: "/dashboard/integrations" },
  { icon: Settings, label: "Settings", href: "/dashboard/settings" },
];

interface SidebarProps {
  /** Controlled collapsed state — owned by the parent layout */
  collapsed?: boolean;
  /** Called when the user toggles the sidebar */
  onToggle?: (collapsed: boolean) => void;
}

export default function Sidebar({ collapsed: controlledCollapsed, onToggle }: SidebarProps = {}) {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  // Support both controlled (layout owns state) and uncontrolled (internal state)
  const [internalCollapsed, setInternalCollapsed] = useState(false);
  const collapsed = controlledCollapsed !== undefined ? controlledCollapsed : internalCollapsed;
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const handleToggle = () => {
    const next = !collapsed;
    setInternalCollapsed(next);
    onToggle?.(next);
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
    setShowLogoutModal(false);
  };

  return (
    <>
      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, animation: "fadeIn 0.2s ease-out" }}>
          <div className="glass-card" style={{ width: "90%", maxWidth: "380px", padding: "32px", textAlign: "center", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(139, 92, 246, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "var(--primary-violet)" }}>
              <LogOut size={32} />
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", textAlign: "center" }}>Sign Out?</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "15px", lineHeight: "1.6", marginBottom: "28px", textAlign: "center" }}>
              Are you sure you want to sign out of your account?
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setShowLogoutModal(false)} className="btn-secondary" style={{ flex: 1, padding: "12px" }}>Cancel</button>
              <button onClick={handleSignOut} className="btn-primary" style={{ flex: 1, padding: "12px" }}>Sign Out</button>
            </div>
          </div>
        </div>
      )}

      <aside style={{
        width: collapsed ? "72px" : "260px",
        height: "100vh",
        position: "fixed",
        left: 0,
        top: 0,
        display: "flex",
        flexDirection: "column",
        background: "rgba(9, 9, 11, 0.95)",
        borderRight: "1px solid var(--border-primary)",
        transition: "width 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        zIndex: 50,
        overflow: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          padding: collapsed ? "20px 16px" : "20px 20px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
          borderBottom: "1px solid var(--border-primary)",
          minHeight: "72px",
        }}>
          <div style={{
            width: "36px",
            height: "36px",
            minWidth: "36px",
            borderRadius: "10px",
            background: "var(--gradient-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Bot size={20} color="white" />
          </div>
          {!collapsed && (
            <span style={{ fontSize: "16px", fontWeight: "700", whiteSpace: "nowrap" }}>
              <span className="gradient-text">AI Assistant</span>
            </span>
          )}
        </div>

        {/* Nav Items */}
        <nav style={{ flex: 1, padding: collapsed ? "24px 12px" : "24px 16px" }}>
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(item.href));
            const Icon = item.icon;

            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: collapsed ? "10px 12px" : "10px 14px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  marginBottom: "4px",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "14px",
                  fontWeight: isActive ? "600" : "400",
                  transition: "all 0.15s ease",
                  background: isActive ? "rgba(139, 92, 246, 0.12)" : "transparent",
                  color: isActive ? "var(--accent-violet-light)" : "var(--text-secondary)",
                  justifyContent: collapsed ? "center" : "flex-start",
                }}
              >
                <Icon size={18} />
                {!collapsed && item.label}
              </button>
            );
          })}
        </nav>

        {/* User section */}
        <div style={{
          padding: collapsed ? "16px 12px" : "16px",
          borderTop: "1px solid var(--border-primary)",
        }}>
          {!collapsed && user && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "12px",
              padding: "8px",
              borderRadius: "8px",
              background: "var(--bg-secondary)",
            }}>
              <div style={{
                width: "32px",
                height: "32px",
                minWidth: "32px",
                borderRadius: "8px",
                background: "var(--gradient-primary)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "13px",
                fontWeight: "700",
                color: "white",
              }}>
                {(user.user_metadata?.full_name || user.email || "U")[0].toUpperCase()}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {user.user_metadata?.full_name || "User"}
                </div>
                <div style={{
                  fontSize: "11px",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}>
                  {user.email}
                </div>
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => setShowLogoutModal(true)}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "8px",
                borderRadius: "8px",
                border: "1px solid var(--border-primary)",
                background: "transparent",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "13px",
                fontFamily: "Inter, sans-serif",
                transition: "all 0.15s",
              }}
            >
              <LogOut size={15} />
              {!collapsed && "Sign Out"}
            </button>
            <button
              onClick={handleToggle}
              style={{
                padding: "8px",
                borderRadius: "8px",
                border: "1px solid var(--border-primary)",
                background: "transparent",
                color: "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s",
              }}
            >
              {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>
        </div>
      </aside>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .conv-item:hover { background: rgba(255, 255, 255, 0.05) !important; color: white !important; }
        .gradient-text { background: var(--gradient-primary); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
      `}</style>
    </>
  );
}
