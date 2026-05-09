"use client";

import { useState, useEffect } from "react";
import { 
  User, 
  Shield, 
  Trash2, 
  Brain, 
  Clock, 
  CheckCircle2,
  Loader2,
  Settings,
  Cpu,
  CreditCard,
  Star,
  Lock,
  Eye,
  EyeOff,
  Download,
  AlertTriangle,
  Key,
  Globe,
  Monitor,
  Pencil,
  X,
  Save
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("profile");
  const [user, setUser] = useState<any>(null);
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [subLoading, setSubLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Profile edit state
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Security state
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [showPws, setShowPws] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // System state
  const [aiModel, setAiModel] = useState("llama-3.3-70b-versatile");
  const [language, setLanguage] = useState("en");
  const [systemSaving, setSystemSaving] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  // Profile Image State
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  
  // Subscription State
  const [subscription, setSubscription] = useState<any>({
    plan: "free",
    usage: { documents: 0, messages: 0 },
    limits: { documents: 2, messages: 50 }
  });
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    fetchUserData();
    fetchMemories();
    fetchSubscriptionStatus();
  }, []);

  const fetchUserData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUser(user);
      setNameValue(user.user_metadata?.full_name || "");
      if (user.user_metadata?.ai_model) setAiModel(user.user_metadata.ai_model);
      if (user.user_metadata?.language) setLanguage(user.user_metadata.language);
    }
  };

  const handleSaveName = async () => {
    if (!nameValue.trim()) return;
    setSavingName(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { full_name: nameValue.trim() },
      });
      if (error) throw error;
      setUser(data.user);
      setEditingName(false);
    } catch (err) {
      console.error("Failed to update name:", err);
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwMsg(null);
    if (newPw !== confirmPw) { setPwMsg({ type: "error", text: "Passwords do not match." }); return; }
    if (newPw.length < 8) { setPwMsg({ type: "error", text: "Password must be at least 8 characters." }); return; }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwMsg({ type: "success", text: "Password updated successfully!" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } catch (err: any) {
      setPwMsg({ type: "error", text: err.message || "Failed to update password." });
    } finally {
      setPwLoading(false);
    }
  };

  const handleSaveSystemSettings = async () => {
    setSystemSaving(true);
    try {
      const { data, error } = await supabase.auth.updateUser({
        data: { 
          ai_model: aiModel,
          language: language
        },
      });
      if (error) throw error;
      setUser(data.user);
      alert("System preferences saved successfully!");
    } catch (err) {
      console.error("Failed to save system settings:", err);
      alert("Failed to save settings.");
    } finally {
      setSystemSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // 1. Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('profiles')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 2. Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profiles')
        .getPublicUrl(filePath);

      // 3. Update User Metadata
      const { data: updateData, error: updateError } = await supabase.auth.updateUser({
        data: { avatar_url: publicUrl }
      });

      if (updateError) throw updateError;
      setUser(updateData.user);
    } catch (err: any) {
      console.error("Avatar upload error:", err);
      alert("Failed to upload avatar. Make sure you have a 'profiles' bucket in Supabase Storage with public access.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleExportData = async () => {
    setExportLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setExportLoading(false); return; }
    try {
      const [convRes, docRes, memRes] = await Promise.all([
        fetch(`${API_URL}/chat/conversations`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then(r => r.json()),
        fetch(`${API_URL}/documents`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then(r => r.json()),
        fetch(`${API_URL}/memories`, { headers: { Authorization: `Bearer ${session.access_token}` } }).then(r => r.json()),
      ]);
      const blob = new Blob([JSON.stringify({ conversations: convRes.conversations, documents: docRes.documents, memories: memRes.memories }, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `ai-assistant-export-${Date.now()}.json`; a.click();
      URL.revokeObjectURL(url);
    } catch { } finally { setExportLoading(false); }
  };

  const fetchMemories = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/memories`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      setMemories(data.memories || []);
    } catch (err) {
      console.error("Failed to fetch memories:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubscriptionStatus = async () => {
    try {
      setSubLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/subscription/status`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      setSubscription(data);
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
    } finally {
      setSubLoading(false);
    }
  };

  const handleSubscriptionAction = async (action: "upgrade" | "manage") => {
    try {
      setIsUpgrading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const endpoint = action === "upgrade" 
        ? `${API_URL}/stripe/create-checkout-session`
        : `${API_URL}/stripe/create-portal-session`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ plan: "pro" }) // Ignored by portal endpoint
      });

      const data = await response.json();
      
      if (data.fallbackDowngrade) {
        // Handled edge case where user had no stripe ID but was marked pro
        await fetchSubscriptionStatus();
        alert("Your account has been reset to the Free plan.");
      } else if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create session");
      }
    } catch (err) {
      console.error("Subscription action failed:", err);
      alert("Payment session failed. Please check that your Stripe API keys are configured correctly in the backend .env file.");
    } finally {
      setIsUpgrading(false);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    try {
      setDeletingId(id);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`${API_URL}/memories/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (response.ok) {
        setMemories(prev => prev.filter(m => m.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete memory:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const tabs = [
    { id: "profile", label: "Profile", icon: <User size={18} /> },
    { id: "memory", label: "AI Memory", icon: <Brain size={18} /> },
    { id: "subscription", label: "Subscription", icon: <CreditCard size={18} /> },
    { id: "security", label: "Security", icon: <Shield size={18} /> },
    { id: "system", label: "System", icon: <Cpu size={18} /> },
  ];

  const ROW = (label: string, value: React.ReactNode) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: "14px", fontWeight: "600" }}>{value}</span>
    </div>
  );

  const plans = [
    {
      name: "free",
      displayName: "Free",
      price: "$0",
      description: "Perfect for getting started",
      features: ["50 AI messages/month", "2 Documents limit", "Basic Integrations", "Standard Memory"],
      buttonText: subscription.plan === "free" ? "Current Plan" : "Downgrade",
      isCurrent: subscription.plan === "free",
      color: "var(--text-muted)"
    },
    {
      name: "pro",
      displayName: "Pro",
      price: "$19",
      description: "For power users & professionals",
      features: ["Unlimited AI messages", "Unlimited Documents", "Priority Integrations", "Advanced Smart Actions", "Personal Knowledge Base"],
      buttonText: subscription.plan === "pro" ? "Current Plan" : "Upgrade to Pro",
      isCurrent: subscription.plan === "pro",
      color: "var(--primary-violet)",
      popular: true
    }
  ];

  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "20px", animation: "fadeIn 0.5s ease-out" }}>
      <header style={{ marginBottom: "32px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "rgba(139, 92, 246, 0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary-violet)" }}>
            <Settings size={24} />
          </div>
          <h1 style={{ fontSize: "28px", fontWeight: "800" }}>Account Settings</h1>
        </div>
        <p style={{ color: "var(--text-muted)", marginLeft: "52px" }}>Configure your personal preferences and AI behavior.</p>
      </header>

      <div style={{ display: "flex", gap: "32px", alignItems: "flex-start" }}>
        
        {/* Sidebar Nav */}
        <div style={{ width: "240px", flexShrink: 0, display: "flex", flexDirection: "column", gap: "8px" }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: "12px", padding: "14px 18px", borderRadius: "14px", border: "none",
                background: activeTab === tab.id ? "rgba(139, 92, 246, 0.1)" : "transparent",
                color: activeTab === tab.id ? "var(--primary-violet)" : "var(--text-muted)",
                fontSize: "14px", fontWeight: activeTab === tab.id ? "600" : "500", cursor: "pointer", transition: "all 0.2s", textAlign: "left", position: "relative",
              }}
            >
              {activeTab === tab.id && (
                <div style={{ position: "absolute", left: "0", top: "20%", height: "60%", width: "3px", background: "var(--primary-violet)", borderRadius: "0 4px 4px 0", boxShadow: "0 0 10px var(--primary-violet)" }} />
              )}
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div style={{ flex: 1 }}>
          <div className="glass-card" style={{ padding: "40px", minHeight: "600px", position: "relative", overflow: "hidden" }}>
            
            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div style={{ animation: "slideUp 0.4s ease-out" }}>
                <div style={{ marginBottom: "32px" }}>
                  <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "4px" }}>Profile Information</h2>
                  <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Manage your account details and profile picture.</p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "40px" }}>
                  <div style={{ position: "relative" }}>
                    <div style={{ 
                      width: "100px", height: "100px", borderRadius: "30px", 
                      background: "var(--gradient-primary)", 
                      display: "flex", alignItems: "center", justifyContent: "center", 
                      boxShadow: "0 15px 30px rgba(139, 92, 246, 0.3)", 
                      position: "relative",
                      overflow: "hidden"
                    }}>
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(45deg, transparent, rgba(255,255,255,0.2), transparent)" }} />
                      {user?.user_metadata?.avatar_url ? (
                        <img src={user.user_metadata.avatar_url} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <User size={40} color="white" />
                      )}
                      {uploadingAvatar && (
                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <Loader2 size={24} className="animate-spin" color="white" />
                        </div>
                      )}
                    </div>
                    <label style={{ 
                      position: "absolute", bottom: "-5px", right: "-5px", 
                      width: "32px", height: "32px", borderRadius: "10px", 
                      background: "var(--bg-secondary)", border: "1px solid var(--border-primary)", 
                      display: "flex", alignItems: "center", justifyContent: "center", 
                      cursor: "pointer", color: "white", boxShadow: "0 4px 12px rgba(0,0,0,0.3)" 
                    }}>
                      <Pencil size={14} />
                      <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
                    </label>
                  </div>
                  <div>
                    <h3 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "4px" }}>{user?.user_metadata?.full_name || "Antigravity User"}</h3>
                    <p style={{ color: "var(--text-muted)", fontSize: "14px", marginBottom: "12px" }}>{user?.email}</p>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <div style={{ 
                        padding: "6px 12px", borderRadius: "8px", 
                        background: subscription.plan === "pro" ? "rgba(139, 92, 246, 0.2)" : "rgba(255,255,255,0.05)", 
                        border: `1px solid ${subscription.plan === "pro" ? "var(--primary-violet)" : "rgba(255,255,255,0.1)"}`,
                        fontSize: "12px", fontWeight: "700", color: subscription.plan === "pro" ? "var(--primary-violet)" : "white",
                        display: "flex", alignItems: "center", gap: "6px"
                      }}>
                        {subscription.plan === "pro" ? <Star size={12} fill="currentColor" /> : <User size={12} />}
                        {subscription.plan.toUpperCase()} MEMBER
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: "grid", gap: "24px", maxWidth: "600px" }}>
                  <div className="input-group">
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Display Name</label>
                    {editingName ? (
                      <div style={{ display: "flex", gap: "10px" }}>
                        <input
                          className="input-field"
                          value={nameValue}
                          onChange={e => setNameValue(e.target.value)}
                          onKeyDown={e => e.key === "Enter" && handleSaveName()}
                          autoFocus
                          style={{ flex: 1, borderRadius: "12px", padding: "14px 16px" }}
                        />
                        <button onClick={handleSaveName} disabled={savingName} className="btn-primary" style={{ padding: "12px 16px", borderRadius: "12px" }}>
                          {savingName ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Save size={16} />}
                        </button>
                        <button onClick={() => setEditingName(false)} className="btn-secondary" style={{ padding: "12px 16px", borderRadius: "12px" }}>
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <div style={{ padding: "16px 20px", borderRadius: "16px", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)", fontSize: "15px", color: "white", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>{user?.user_metadata?.full_name || <span style={{ color: "var(--text-muted)" }}>Not set</span>}</span>
                        <button onClick={() => setEditingName(true)} style={{ background: "none", border: "none", color: "var(--accent-violet)", fontSize: "13px", fontWeight: "600", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
                          <Pencil size={13} /> Edit
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="input-group">
                    <label style={{ display: "block", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Email Address</label>
                    <div style={{
                      padding: "16px 20px",
                      borderRadius: "16px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      fontSize: "15px",
                      color: "rgba(255,255,255,0.6)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}>
                      <span>{user?.email}</span>
                      <Shield size={16} color="#10b981" />
                    </div>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "8px" }}>Primary email used for account notifications and security.</p>
                  </div>

                  <div style={{ 
                    marginTop: "12px",
                    padding: "20px",
                    borderRadius: "16px",
                    background: "rgba(139, 92, 246, 0.05)",
                    border: "1px solid rgba(139, 92, 246, 0.1)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div>
                      <h4 style={{ fontSize: "14px", fontWeight: "600", marginBottom: "4px" }}>Account Verification</h4>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Your account is fully verified and secured.</p>
                    </div>
                    <div style={{ color: "#10b981", display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontWeight: "700" }}>
                      <CheckCircle2 size={18} />
                      VERIFIED
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Memory Tab */}
            {activeTab === "memory" && (
              <div style={{ animation: "slideUp 0.4s ease-out" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "32px" }}>
                  <div>
                    <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "4px" }}>AI Memory Bank</h2>
                    <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Insights and facts Antigravity has learned about you.</p>
                  </div>
                  <div style={{ padding: "8px 16px", borderRadius: "12px", background: "rgba(139, 92, 246, 0.1)", color: "var(--primary-violet)", fontSize: "13px", fontWeight: "700" }}>
                    {memories.length} Stored Facts
                  </div>
                </div>
                <div style={{ display: "grid", gap: "12px" }}>
                  {memories.map((memory) => (
                    <div key={memory.id} className="memory-card" style={{ padding: "20px", borderRadius: "18px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" }}>
                      <div style={{ display: "flex", gap: "16px", alignItems: "center" }}>
                        <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--primary-violet)", boxShadow: "0 0 10px var(--primary-violet)" }} />
                        <p style={{ fontSize: "15px", fontWeight: "500" }}>{memory.fact}</p>
                      </div>
                      <button onClick={() => handleDeleteMemory(memory.id)} style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.05)", border: "1px solid rgba(239, 68, 68, 0.1)", color: "#ef4444", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        {deletingId === memory.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={18} />}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Subscription Tab */}
            {activeTab === "subscription" && (
              <div style={{ animation: "slideUp 0.4s ease-out" }}>
                <div style={{ marginBottom: "32px" }}>
                  <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "4px" }}>Subscription Plans</h2>
                  <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Manage your plan and view usage limits.</p>
                </div>

                {subLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "100px 0" }}><Loader2 size={40} className="animate-spin" color="var(--primary-violet)" /></div>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginBottom: "40px" }}>
                      {plans.map((plan) => (
                        <div key={plan.name} className="plan-card" style={{ padding: "32px", borderRadius: "24px", background: plan.popular ? "rgba(139, 92, 246, 0.05)" : "rgba(255,255,255,0.02)", border: plan.isCurrent ? "2px solid var(--primary-violet)" : "1px solid rgba(255,255,255,0.05)", position: "relative", display: "flex", flexDirection: "column" }}>
                          {plan.popular && <div style={{ position: "absolute", top: "0", right: "24px", transform: "translateY(-50%)", background: "var(--primary-violet)", color: "white", padding: "4px 12px", borderRadius: "10px", fontSize: "12px", fontWeight: "800", display: "flex", alignItems: "center", gap: "6px" }}><Star size={12} fill="white" /> MOST POPULAR</div>}
                          <div style={{ marginBottom: "24px" }}>
                            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>{plan.displayName}</h3>
                            <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>{plan.description}</p>
                          </div>
                          <div style={{ marginBottom: "32px", display: "flex", alignItems: "baseline", gap: "4px" }}>
                            <span style={{ fontSize: "40px", fontWeight: "800" }}>{plan.price}</span>
                            <span style={{ color: "var(--text-muted)", fontSize: "16px" }}>/month</span>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1, marginBottom: "32px" }}>
                            {plan.features.map(feature => (
                              <div key={feature} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px" }}>
                                <CheckCircle2 size={16} color={plan.popular ? "var(--primary-violet)" : "#10b981"} />
                                <span>{feature}</span>
                              </div>
                            ))}
                          </div>
                            <button 
                              onClick={() => {
                                if (plan.name === "pro") {
                                  handleSubscriptionAction(plan.isCurrent ? "manage" : "upgrade");
                                }
                              }}
                              disabled={plan.name === "free" && plan.isCurrent}
                              style={{ 
                                padding: "14px", borderRadius: "16px", 
                                background: (plan.name === "free" && plan.isCurrent) ? "rgba(255,255,255,0.05)" : "var(--primary-violet)", 
                                border: "none", color: "white", fontSize: "15px", fontWeight: "700", 
                                cursor: (plan.name === "free" && plan.isCurrent) ? "default" : "pointer", 
                                transition: "all 0.2s" 
                              }}
                            >
                              {isUpgrading ? (
                                <Loader2 className="animate-spin" size={20} style={{ margin: "0 auto" }} />
                              ) : (
                                plan.isCurrent ? (plan.name === "pro" ? "Manage Billing" : "Current Plan") : plan.buttonText
                              )}
                            </button>
                        </div>
                      ))}
                    </div>

                    <div className="glass-card" style={{ padding: "24px", background: "rgba(255,255,255,0.01)" }}>
                      <h4 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "20px" }}>Current Usage</h4>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                            <span style={{ color: "var(--text-muted)" }}>Documents Indexed</span>
                            <span style={{ fontWeight: "700" }}>{subscription.usage.documents} / {subscription.limits.documents > 1000 ? "Unlimited" : subscription.limits.documents}</span>
                          </div>
                          <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min((subscription.usage.documents / subscription.limits.documents) * 100, 100)}%`, height: "100%", background: "var(--primary-violet)" }} />
                          </div>
                        </div>
                        <div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                            <span style={{ color: "var(--text-muted)" }}>Monthly Messages</span>
                            <span style={{ fontWeight: "700" }}>{subscription.usage.messages} / {subscription.limits.messages > 1000 ? "Unlimited" : subscription.limits.messages}</span>
                          </div>
                          <div style={{ height: "6px", background: "rgba(255,255,255,0.05)", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${Math.min((subscription.usage.messages / subscription.limits.messages) * 100, 100)}%`, height: "100%", background: "#10b981" }} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div style={{ animation: "slideUp 0.4s ease-out", maxWidth: "600px" }}>
                <div style={{ marginBottom: "32px" }}>
                  <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "4px" }}>Security</h2>
                  <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Manage your password and account security settings.</p>
                </div>

                {/* Change Password */}
                <div style={{ padding: "28px", borderRadius: "20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "24px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", display: "flex", alignItems: "center", gap: "10px" }}><Lock size={18} color="var(--accent-violet)" /> Change Password</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "24px" }}>Choose a strong password at least 8 characters long.</p>
                  {pwMsg && (
                    <div style={{ padding: "12px 16px", borderRadius: "10px", marginBottom: "20px", fontSize: "13px", background: pwMsg.type === "success" ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${pwMsg.type === "success" ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`, color: pwMsg.type === "success" ? "#10b981" : "#fca5a5" }}>
                      {pwMsg.text}
                    </div>
                  )}
                  <form onSubmit={handleChangePassword} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ position: "relative" }}>
                      <input type={showPws ? "text" : "password"} className="input-field" placeholder="New password" value={newPw} onChange={e => setNewPw(e.target.value)} required />
                      <button type="button" onClick={() => setShowPws(!showPws)} style={{ position: "absolute", right: "14px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}>
                        {showPws ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    <input type={showPws ? "text" : "password"} className="input-field" placeholder="Confirm new password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} required />
                    <button type="submit" className="btn-primary" disabled={pwLoading} style={{ alignSelf: "flex-start", padding: "10px 24px", borderRadius: "10px" }}>
                      {pwLoading ? <><Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> Updating...</> : <><Key size={16} /> Update Password</>}
                    </button>
                  </form>
                </div>

                {/* Session Info */}
                <div style={{ padding: "28px", borderRadius: "20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "24px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}><Monitor size={18} color="var(--accent-cyan)" /> Active Session</h3>
                  {ROW("Signed in as", user?.email)}
                  {ROW("Auth provider", user?.app_metadata?.provider || "email")}
                  {ROW("Last sign in", user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : "—")}
                  {ROW("Account created", user?.created_at ? new Date(user.created_at).toLocaleDateString() : "—")}
                </div>

                {/* 2FA Info */}
                <div style={{ padding: "20px 24px", borderRadius: "16px", background: "rgba(139,92,246,0.05)", border: "1px solid rgba(139,92,246,0.1)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h4 style={{ fontSize: "14px", fontWeight: "700", marginBottom: "4px", display: "flex", alignItems: "center", gap: "8px" }}><Shield size={14} color="var(--accent-violet)" /> Two-Factor Authentication</h4>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)" }}>Managed via your Supabase auth provider settings.</p>
                  </div>
                  <span style={{ padding: "4px 12px", borderRadius: "20px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", fontSize: "12px", fontWeight: "700", color: "#10b981" }}>Supabase Auth</span>
                </div>
              </div>
            )}

            {/* System Tab */}
            {activeTab === "system" && (
              <div style={{ animation: "slideUp 0.4s ease-out", maxWidth: "600px" }}>
                <div style={{ marginBottom: "32px" }}>
                  <h2 style={{ fontSize: "22px", fontWeight: "700", marginBottom: "4px" }}>System Preferences</h2>
                  <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Configure AI model, language, and data settings.</p>
                </div>

                {/* AI Model */}
                <div style={{ padding: "28px", borderRadius: "20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "24px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px" }}>AI Model</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>Select the Groq model used for chat responses.</p>
                  <div style={{ display: "grid", gap: "10px" }}>
                    {[
                      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", badge: "Recommended", badgeColor: "#10b981" },
                      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", badge: "Fastest", badgeColor: "#f59e0b" },
                      { id: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1 70B", badge: "Reasoning", badgeColor: "#6366f1" },
                    ].map(m => (
                      <button key={m.id} onClick={() => setAiModel(m.id)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderRadius: "14px", background: aiModel === m.id ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.02)", border: `1px solid ${aiModel === m.id ? "var(--accent-violet)" : "rgba(255,255,255,0.06)"}`, cursor: "pointer", transition: "all 0.2s", textAlign: "left" }}>
                        <span style={{ fontWeight: "600", fontSize: "14px", color: aiModel === m.id ? "white" : "var(--text-secondary)" }}>{m.label}</span>
                        <span style={{ padding: "3px 10px", borderRadius: "20px", fontSize: "11px", fontWeight: "700", background: m.badgeColor + "20", color: m.badgeColor }}>{m.badge}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Language */}
                <div style={{ padding: "28px", borderRadius: "20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "24px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px", display: "flex", alignItems: "center", gap: "10px" }}><Globe size={18} color="var(--accent-cyan)" /> Language</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>Speech recognition and UI language preference.</p>
                  <select value={language} onChange={e => setLanguage(e.target.value)} className="input-field" style={{ cursor: "pointer" }}>
                    <option value="en">🇺🇸 English</option>
                    <option value="fil">🇵🇭 Filipino</option>
                    <option value="es">🇪🇸 Spanish</option>
                    <option value="ja">🇯🇵 Japanese</option>
                    <option value="zh">🇨🇳 Chinese</option>
                  </select>
                </div>

                <div style={{ marginBottom: "24px" }}>
                  <button 
                    onClick={handleSaveSystemSettings} 
                    disabled={systemSaving}
                    className="btn-primary" 
                    style={{ width: "100%", padding: "14px", borderRadius: "14px", gap: "10px" }}
                  >
                    {systemSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    {systemSaving ? "Saving Settings..." : "Save System Preferences"}
                  </button>
                </div>

                {/* Data Export */}
                <div style={{ padding: "28px", borderRadius: "20px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: "24px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", marginBottom: "4px" }}>Export Your Data</h3>
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "20px" }}>Download all your conversations, documents, and memories as JSON.</p>
                  <button onClick={handleExportData} disabled={exportLoading} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 20px", borderRadius: "10px" }}>
                    {exportLoading ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={16} />}
                    {exportLoading ? "Preparing export..." : "Export All Data"}
                  </button>
                </div>

                {/* Danger Zone */}
                <div style={{ padding: "24px", borderRadius: "16px", background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
                  <h4 style={{ fontSize: "14px", fontWeight: "700", color: "#ef4444", marginBottom: "8px", display: "flex", alignItems: "center", gap: "8px" }}><AlertTriangle size={16} /> Danger Zone</h4>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "16px" }}>Once you delete your account, there is no going back. Please be certain.</p>
                  <button
                    onClick={async () => { 
                      if (window.confirm("Sigurado ka ba? This will PERMANENTLY delete your account and all your data (conversations, files, memories). This cannot be undone.")) {
                        try {
                          const { data: { session } } = await supabase.auth.getSession();
                          if (!session) return;
                          
                          const response = await fetch(`${API_URL}/auth/delete-account`, {
                            method: "DELETE",
                            headers: { Authorization: `Bearer ${session.access_token}` },
                          });
                          
                          if (response.ok) {
                            alert("Account deleted successfully.");
                            supabase.auth.signOut();
                          } else {
                            const error = await response.json();
                            alert(`Error: ${error.error || "Failed to delete account"}`);
                          }
                        } catch (err) {
                          console.error("Delete account error:", err);
                          alert("Failed to delete account. Please try again.");
                        }
                      } 
                    }}
                    style={{ padding: "10px 20px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                  >
                    Delete Account
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .memory-card:hover, .plan-card:hover { transform: translateY(-2px); transition: all 0.2s; }
      `}</style>
    </div>
  );
}
