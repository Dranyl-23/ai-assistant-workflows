"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  ExternalLink, CheckCircle2, Search, Loader2, Plus, Zap,
  Layers, MessageCircle, Briefcase, Code, ShieldCheck,
  MoreVertical, Settings2, Power, XCircle
} from "lucide-react";

// Official Logo Components (SVGs) - Defined before usage to avoid hoisting issues
const SlackLogo = () => (
  <svg width="32" height="32" viewBox="0 0 24 24"><path fill="#e01e5a" d="M3.5 13.5a2.5 2.5 0 1 1 2.5 2.5h-2.5v-2.5zm1.5 2.5a2.5 2.5 0 1 1 2.5 2.5v-2.5h-2.5zm3.5-2.5a2.5 2.5 0 1 1 2.5-2.5v6.5a2.5 2.5 0 1 1-2.5-2.5v-1.5zm-2.5-1.5a2.5 2.5 0 1 1 2.5 2.5h-6.5a2.5 2.5 0 1 1 2.5-2.5v1.5zm6.5-6a2.5 2.5 0 1 1-2.5-2.5h2.5v2.5zm-1.5-2.5a2.5 2.5 0 1 1-2.5-2.5v2.5h2.5zm-3.5 2.5a2.5 2.5 0 1 1-2.5 2.5v-6.5a2.5 2.5 0 1 1 2.5 2.5v1.5zm2.5 1.5a2.5 2.5 0 1 1-2.5-2.5h6.5a2.5 2.5 0 1 1-2.5 2.5v-1.5zm6.5 6a2.5 2.5 0 1 1 2.5 2.5h-2.5v-2.5zm-1.5 2.5a2.5 2.5 0 1 1 2.5 2.5v-2.5h-2.5zm-3.5-2.5a2.5 2.5 0 1 1-2.5 2.5v6.5a2.5 2.5 0 1 1 2.5-2.5v-1.5zm2.5 1.5a2.5 2.5 0 1 1 2.5-2.5h-6.5a2.5 2.5 0 1 1-2.5 2.5v-1.5zm-6.5-6a2.5 2.5 0 1 1 2.5-2.5h-2.5v2.5zm1.5-2.5a2.5 2.5 0 1 1 2.5-2.5v2.5h-2.5zm3.5 2.5a2.5 2.5 0 1 1 2.5-2.5v-6.5a2.5 2.5 0 1 1-2.5 2.5v1.5zm-2.5-1.5a2.5 2.5 0 1 1 2.5 2.5h-6.5a2.5 2.5 0 1 1 2.5-2.5v1.5z" /><path fill="#36c5f0" d="M3.5 13.5a2.5 2.5 0 1 1 2.5 2.5h-2.5v-2.5z" /><path fill="#2eb67d" d="M10.5 20.5a2.5 2.5 0 1 1 2.5 2.5v-2.5h-2.5z" /><path fill="#ecb22e" d="M20.5 10.5a2.5 2.5 0 1 1-2.5-2.5h2.5v2.5z" /><path fill="#e01e5a" d="M13.5 3.5a2.5 2.5 0 1 1-2.5-2.5h2.5v2.5z" /></svg>
);

const NotionLogo = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="#000000"><path d="M4.459 4.208c.181.163.305.213.627.213h3.045c.421 0 .532-.05.654-.188.423-.464.913-.714 1.838-.714h8.34c.895 0 1.258.175 1.536.438.163.15.225.263.225.613v13.633c0 .351-.063.501-.225.651-.278.263-.641.438-1.536.438H5.696c-.84 0-1.22-.175-1.503-.438-.173-.15-.224-.3-.224-.651V5.046c0-.401.076-.564.28-.738.307-.262.7-.425 1.488-.425h4.153c.895 0 1.258.175 1.536.438l.184.175V16.71l6.702-10.428c.15-.225.15-.363 0-.513-.152-.163-.356-.263-.736-.263H14.15c-.84 0-1.22.175-1.503.438-.173.15-.224.263-.224.613v.013c0 .338.051.488.224.638.283.263.663.438 1.503.438h1.41l-6.715 10.453v-11.83c0-.35-.062-.512-.224-.662-.283-.263-.643-.438-1.538-.438h-1.41c-.84 0-1.22.175-1.503.438-.173.15-.224.263-.224.613v13.633c0 .351.051.501.224.651.283.263.663.438 1.503.438h12.637c.895 0 1.258-.175 1.536-.438.162-.15.225-.3.225-.651V5.059c0-.35-.063-.5-.225-.65-.278-.263-.641-.438-1.536-.438h-8.34c-.925 0-1.415.25-1.838.714-.122.138-.233.188-.654.188h-3.045c-.322 0-.446-.05-.627-.213-.306-.263-.7-.425-1.488-.425H3.148C2.253 3.175 1.89 3.35 1.612 3.613c-.163.15-.225.3-.225.651v13.633c0 .351.062.501.225.651.278.263.641.438 1.536.438H4.21c.84 0 1.22-.175 1.503-.438.173-.15.224-.3.224-.651V5.046c0-.401-.076-.564-.28-.738-.307-.262-.7-.425-1.488-.425h-.3c-.84 0-1.22.175-1.503.438-.173.15-.224.263-.224.613v13.633c0 .351.051.501.224.651.283.263.663.438 1.503.438h.301z" /></svg>
);

const GitHubLogo = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="#000000"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
);

const GmailLogo = () => (
  <svg width="32" height="32" viewBox="0 0 24 24"><path fill="#EA4335" d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" /></svg>
);

const DiscordLogo = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="#5865F2"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.125-.094.252-.192.372-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" /></svg>
);

const CalendarLogo = () => (
  <svg width="32" height="32" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" ry="2" fill="#4285F4" /><line x1="16" y1="2" x2="16" y2="6" stroke="#fff" strokeWidth="2" /><line x1="8" y1="2" x2="8" y2="6" stroke="#fff" strokeWidth="2" /><line x1="3" y1="10" x2="21" y2="10" stroke="#fff" strokeWidth="2" /><text x="12" y="18" textAnchor="middle" fill="#fff" fontSize="8" fontWeight="bold" fontFamily="Arial">31</text></svg>
);

interface Integration {
  id: string;
  provider: string;
  status: string;
}

interface AppProvider {
  id: string;
  name: string;
  description: string;
  logo: React.ReactNode;
  category: string;
  color: string;
}

const PROVIDERS: AppProvider[] = [
  { id: "slack", name: "Slack", description: "Seamless AI communication with your team channels.", logo: <SlackLogo />, category: "Communication", color: "#e01e5a" },
  { id: "notion", name: "Notion", description: "Organize docs and databases with AI context.", logo: <NotionLogo />, category: "Productivity", color: "#000000" },
  { id: "gmail", name: "Gmail", description: "Smart email automation and reply drafts.", logo: <GmailLogo />, category: "Communication", color: "#EA4335" },
  { id: "google-calendar", name: "Calendar", description: "AI-powered scheduling and event management.", logo: <CalendarLogo />, category: "Productivity", color: "#4285F4" },
  { id: "github", name: "GitHub", description: "Monitor repositories and code changes.", logo: <GitHubLogo />, category: "Development", color: "#181717" },
  { id: "discord", name: "Discord", description: "Connect with your community servers.", logo: <DiscordLogo />, category: "Communication", color: "#5865F2" },
];

const CATEGORIES = ["All", "Communication", "Productivity", "Development"];

export default function IntegrationsPage() {
  const { session } = useAuth();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");

  // Config Modal State
  const [configModal, setConfigModal] = useState<{
    isOpen: boolean;
    provider: AppProvider | null;
    configData: Record<string, string>;
  }>({ isOpen: false, provider: null, configData: {} });

  const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

  const fetchIntegrations = async () => {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/integrations`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      setIntegrations(data.integrations || []);
    } catch (err) {
      console.error("Failed to fetch integrations:", err);
    } finally {
      setLoading(false);
    }
  };

  const openConfigModal = (providerId: string) => {
    if (providerId === "n8n") {
      setConfigModal({
        isOpen: true,
        provider: { id: "n8n", name: "n8n Engine", description: "Custom n8n instance", logo: <Zap color="#FF6D5A" size={24} />, category: "System", color: "#FF6D5A" },
        configData: {}
      });
      return;
    }

    const provider = PROVIDERS.find(p => p.id === providerId);
    if (provider) {
      setConfigModal({ isOpen: true, provider, configData: {} });
    }
  };

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session?.access_token || !configModal.provider) return;

    try {
      const response = await fetch(`${BACKEND_URL}/integrations/${configModal.provider.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          config: {
            ...configModal.configData,
            connected_at: new Date().toISOString()
          }
        }),
      });

      if (response.ok) {
        setConfigModal({ isOpen: false, provider: null, configData: {} });
        await fetchIntegrations();
      }
    } catch (err) {
      console.error("Connection error:", err);
    }
  };

  const handleDisconnect = async (providerId: string) => {
    if (!session?.access_token) return;
    const integration = integrations.find(i => i.provider === providerId);
    if (!integration) return;

    try {
      const response = await fetch(`${BACKEND_URL}/integrations/${integration.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) await fetchIntegrations();
    } catch (err) {
      console.error("Disconnect error:", err);
    }
  };

  useEffect(() => {
    fetchIntegrations();
  }, [session]);

  const filteredProviders = PROVIDERS.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "All" || p.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="animate-fade-in" style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "60px" }}>

      {/* Config Modal */}
      {configModal.isOpen && configModal.provider && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, animation: "fadeIn 0.2s ease-out" }}>
          <div className="glass-card" style={{ width: "90%", maxWidth: "450px", padding: "32px", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "24px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {configModal.provider.logo}
              </div>
              <div>
                <h3 style={{ fontSize: "20px", fontWeight: "800" }}>Connect {configModal.provider.name}</h3>
                <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>Enter your credentials to link this app.</p>
              </div>
            </div>

            <form onSubmit={handleConnect} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Dynamic Inputs Based on Provider */}
              {configModal.provider.id === "n8n" ? (
                <>
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>n8n Base URL</label>
                    <input
                      type="url"
                      required
                      placeholder="http://localhost:5678"
                      className="input-field"
                      value={configModal.configData.baseUrl || ""}
                      onChange={(e) => setConfigModal({ ...configModal, configData: { ...configModal.configData, baseUrl: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>n8n API Key (Optional)</label>
                    <input
                      type="password"
                      placeholder="Enter API Key"
                      className="input-field"
                      value={configModal.configData.apiKey || ""}
                      onChange={(e) => setConfigModal({ ...configModal, configData: { ...configModal.configData, apiKey: e.target.value } })}
                    />
                  </div>
                </>
              ) : configModal.provider.id === "slack" ? (
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>Webhook URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://hooks.slack.com/services/..."
                    className="input-field"
                    value={configModal.configData.webhookUrl || ""}
                    onChange={(e) => setConfigModal({ ...configModal, configData: { ...configModal.configData, webhookUrl: e.target.value } })}
                  />
                </div>
              ) : configModal.provider.id === "github" ? (
                <>
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>GitHub Personal Access Token</label>
                    <input
                      type="password"
                      required
                      placeholder="github_pat_..."
                      className="input-field"
                      value={configModal.configData.token || ""}
                      onChange={(e) => setConfigModal({ ...configModal, configData: { ...configModal.configData, token: e.target.value } })}
                    />
                    <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>Needs <strong>repo</strong> scope. Generate at github.com/settings/tokens</p>
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>GitHub Username (Owner)</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Dranyl-23"
                      className="input-field"
                      value={configModal.configData.owner || ""}
                      onChange={(e) => setConfigModal({ ...configModal, configData: { ...configModal.configData, owner: e.target.value } })}
                    />
                  </div>
                  <div>
                    <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>Repository Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. ai-assistant-workflow"
                      className="input-field"
                      value={configModal.configData.repo || ""}
                      onChange={(e) => setConfigModal({ ...configModal, configData: { ...configModal.configData, repo: e.target.value } })}
                    />
                  </div>
                </>
              ) : configModal.provider.id === "discord" ? (
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>Discord Webhook URL</label>
                  <input
                    type="url"
                    required
                    placeholder="https://discord.com/api/webhooks/..."
                    className="input-field"
                    value={configModal.configData.webhookUrl || ""}
                    onChange={(e) => setConfigModal({ ...configModal, configData: { ...configModal.configData, webhookUrl: e.target.value } })}
                  />
                  <p style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "6px" }}>Create this in your Discord Server Settings {">"} Integrations {">"} Webhooks</p>
                </div>
              ) : (
                <div>
                  <label style={{ display: "block", marginBottom: "8px", fontSize: "12px", fontWeight: "600", color: "var(--text-secondary)", textTransform: "uppercase" }}>API Key / Access Token</label>
                  <input
                    type="password"
                    required
                    placeholder="Enter your API Key"
                    className="input-field"
                    value={configModal.configData.apiKey || ""}
                    onChange={(e) => setConfigModal({ ...configModal, configData: { ...configModal.configData, apiKey: e.target.value } })}
                  />
                </div>
              )}

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button type="button" onClick={() => setConfigModal({ isOpen: false, provider: null, configData: {} })} className="btn-secondary" style={{ flex: 1, padding: "12px" }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ flex: 1, padding: "12px", justifyContent: "center" }}>Connect App</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Header Section */}
      <header style={{ marginBottom: "40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "32px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
              <div style={{
                width: "40px",
                height: "40px",
                borderRadius: "12px",
                background: "rgba(139, 92, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary-violet)"
              }}>
                <Plus size={24} />
              </div>
              <h1 style={{ fontSize: "32px", fontWeight: "800", letterSpacing: "-0.02em" }}>App Integrations</h1>
            </div>
            <p style={{ color: "var(--text-muted)", marginLeft: "52px", fontSize: "15px" }}>
              Bridge your favorite tools with LuminaAI for seamless automation.
            </p>
          </div>

          <div style={{ display: "flex", gap: "24px", background: "rgba(255,255,255,0.03)", padding: "12px 24px", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em" }}>Connected</p>
              <p style={{ fontSize: "20px", fontWeight: "800", color: "#10b981" }}>{integrations.length}</p>
            </div>
            <div style={{ width: "1px", background: "rgba(255,255,255,0.1)" }} />
            <div style={{ textAlign: "right" }}>
              <p style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "800", textTransform: "uppercase", letterSpacing: "0.05em" }}>Available</p>
              <p style={{ fontSize: "20px", fontWeight: "800" }}>{PROVIDERS.length}</p>
            </div>
          </div>
        </div>

        {/* Filters & Search */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "20px" }}>
          <div style={{ display: "flex", gap: "8px", background: "rgba(15, 23, 42, 0.3)", padding: "6px", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.05)" }}>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "10px",
                  fontSize: "13px",
                  fontWeight: "600",
                  transition: "all 0.2s",
                  border: "none",
                  cursor: "pointer",
                  background: activeCategory === cat ? "var(--primary-violet)" : "transparent",
                  color: activeCategory === cat ? "white" : "var(--text-muted)",
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={{ position: "relative", flex: 1, maxWidth: "350px" }}>
            <Search size={18} color="var(--text-muted)" style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)" }} />
            <input
              className="glass-input"
              placeholder="Search connectors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                paddingLeft: "42px",
                width: "100%",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "14px",
                height: "44px",
                outline: "none",
                color: "white"
              }}
            />
          </div>
        </div>
      </header>

      {/* Grid Section */}
      {loading && integrations.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "100px 0" }}>
          <Loader2 size={40} className="animate-spin" color="var(--primary-violet)" />
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "24px" }}>
          {filteredProviders.map((app) => {
            const connected = integrations.some(i => i.provider === app.id);
            return (
              <div key={app.id} className="app-card glass-card" style={{
                padding: "28px",
                display: "flex",
                flexDirection: "column",
                gap: "24px",
                transition: "all 0.3s ease",
                position: "relative",
                overflow: "hidden",
                border: connected ? "1px solid rgba(16, 185, 129, 0.2)" : "1px solid rgba(255,255,255,0.05)"
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div style={{
                    width: "60px",
                    height: "60px",
                    borderRadius: "16px",
                    background: "white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
                  }}>
                    {app.logo}
                  </div>
                  {connected ? (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "20px", background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.2)" }}>
                      <div className="pulse-dot" style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "#10b981", textTransform: "uppercase" }}>Active</span>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 12px", borderRadius: "20px", background: "rgba(255, 255, 255, 0.03)", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>Available</span>
                    </div>
                  )}
                </div>

                <div>
                  <h3 style={{ fontSize: "20px", fontWeight: "800", marginBottom: "4px" }}>{app.name}</h3>
                  <p style={{ fontSize: "14px", color: "var(--text-muted)", lineHeight: "1.6" }}>{app.description}</p>
                </div>

                <div style={{ marginTop: "auto", display: "flex", gap: "12px" }}>
                  {connected ? (
                    <>
                      <button onClick={() => openConfigModal(app.id)} className="btn-secondary" style={{ flex: 1, padding: "12px", fontSize: "13px", fontWeight: "700" }}>
                        Manage
                      </button>
                      <button onClick={() => handleDisconnect(app.id)} className="btn-icon-red" title="Disconnect">
                        <Power size={18} />
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => openConfigModal(app.id)}
                      className="btn-primary"
                      style={{ width: "100%", padding: "12px", fontSize: "13px", fontWeight: "700", justifyContent: "center" }}
                    >
                      Connect {app.name} <Plus size={16} style={{ marginLeft: "4px" }} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* n8n Automation Hero */}
      <div className="glass-card" style={{
        marginTop: "60px",
        padding: "48px",
        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.1) 0%, rgba(99, 102, 241, 0.05) 100%)",
        border: "1px solid rgba(139, 92, 246, 0.2)",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        position: "relative",
        overflow: "hidden"
      }}>
        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: "32px", alignItems: "center" }}>
          <div style={{
            width: "64px",
            height: "64px",
            borderRadius: "20px",
            background: "var(--gradient-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 10px 25px rgba(139, 92, 246, 0.3)"
          }}>
            <Zap size={32} color="white" />
          </div>
          <div>
            <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "8px" }}>Build custom AI workflows with n8n</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "15px", maxWidth: "500px", lineHeight: "1.6" }}>
              Connect your local n8n instance for limitless cross-platform automations and advanced AI agents.
            </p>
          </div>
        </div>
        <button
          onClick={() => openConfigModal("n8n")}
          className="btn-primary"
          style={{ whiteSpace: "nowrap", padding: "14px 28px", borderRadius: "14px" }}
        >
          {integrations.some(i => i.provider === "n8n") ? "Manage n8n Config" : "Setup n8n Instance"}
        </button>

        {/* Glow Decor */}
        <div style={{ position: "absolute", top: "-50px", right: "-50px", width: "150px", height: "150px", background: "rgba(139, 92, 246, 0.1)", filter: "blur(40px)", borderRadius: "50%" }} />
      </div>

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        
        .pulse-dot {
          animation: pulse-green 2s infinite ease-in-out;
        }
        @keyframes pulse-green {
          0% { transform: scale(0.9); opacity: 0.8; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0.8; }
        }

        .app-card:hover {
          transform: translateY(-8px);
          background: rgba(255,255,255,0.04);
          border-color: rgba(139, 92, 246, 0.3);
          box-shadow: 0 20px 40px rgba(0,0,0,0.4);
        }

        .btn-icon-red {
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          padding: 10px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-icon-red:hover {
          background: rgba(239, 68, 68, 0.2);
          color: #ef4444;
          border-color: rgba(239, 68, 68, 0.3);
        }
      `}</style>
    </div>
  );
}
