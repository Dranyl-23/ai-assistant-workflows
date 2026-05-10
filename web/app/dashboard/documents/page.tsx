"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  FileText, 
  FileSpreadsheet,
  FileCode,
  FileJson,
  FileImage,
  FileAudio,
  Trash2, 
  Download, 
  Clock, 
  Database,
  Search,
  Loader2,
  AlertCircle
} from "lucide-react";

interface Document {
  id: string;
  name: string;
  type: string;
  size: number;
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export default function DocumentsPage() {
  const { session } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

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
    if (session?.access_token) {
      fetchDocuments();
    }
  }, [session]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/documents`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await response.json();
      if (data.documents) {
        setDocuments(data.documents);
      }
    } catch (error) {
      console.error("Failed to fetch documents:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this document? This will also remove it from the AI's knowledge base.")) return;
    
    setIsDeleting(id);
    try {
      const response = await fetch(`${API_URL}/documents/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      if (response.ok) {
        setDocuments((prev) => prev.filter((doc) => doc.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete document:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/documents/${id}/download`, {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await response.json();
      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      }
    } catch (error) {
      console.error("Failed to get download link:", error);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getFileIcon = (type: string, name: string) => {
    const lowerType = type.toLowerCase();
    const lowerName = name.toLowerCase();

    if (lowerType.includes("pdf") || lowerName.endsWith(".pdf")) return <FileText size={20} color="#F87171" />;
    if (lowerType.includes("csv") || lowerType.includes("spreadsheet") || lowerName.endsWith(".csv") || lowerName.endsWith(".xlsx")) return <FileSpreadsheet size={20} color="#34D399" />;
    if (lowerType.includes("json") || lowerName.endsWith(".json")) return <FileJson size={20} color="#FBBF24" />;
    if (lowerType.includes("image") || lowerName.endsWith(".png") || lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) return <FileImage size={20} color="#60A5FA" />;
    if (lowerType.includes("audio") || lowerName.endsWith(".mp3") || lowerName.endsWith(".wav")) return <FileAudio size={20} color="#A78BFA" />;
    if (lowerType.includes("javascript") || lowerType.includes("typescript") || lowerName.endsWith(".js") || lowerName.endsWith(".ts")) return <FileCode size={20} color="#60A5FA" />;
    
    return <FileText size={20} color="var(--primary-violet)" />;
  };

  const filteredDocs = documents.filter(doc => 
    doc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ padding: isMobile ? "24px" : "40px", maxWidth: "1200px", margin: "0 auto", animation: "fadeIn 0.5s ease-out" }}>
      <div style={{ 
        marginBottom: "40px", 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: isMobile ? "flex-start" : "flex-end",
        flexDirection: isMobile ? "column" : "row",
        gap: "24px"
      }}>
        <div>
          <h1 style={{ fontSize: isMobile ? "26px" : "32px", fontWeight: "700", color: "#F8FAFC", marginBottom: "8px", display: "flex", alignItems: "center", gap: "12px" }}>
            <Database size={isMobile ? 24 : 32} color="var(--primary-violet)" />
            Knowledge Base
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>Manage documents uploaded to your AI's pgvector memory.</p>
        </div>
        <div style={{ position: "relative", width: isMobile ? "100%" : "300px" }}>
          <Search size={18} style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input 
            type="text" 
            placeholder="Search documents..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: "100%", padding: "12px 16px 12px 42px", 
              background: "rgba(15, 23, 42, 0.6)", 
              border: "1px solid rgba(255,255,255,0.08)", 
              borderRadius: "12px", color: "white", outline: "none",
              transition: "border 0.2s"
            }}
            onFocus={(e) => e.target.style.borderColor = "var(--primary-violet)"}
            onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
          />
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "100px 0" }}>
          <Loader2 className="animate-spin" size={32} color="var(--primary-violet)" />
        </div>
      ) : isMobile ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {filteredDocs.map((doc) => (
            <div key={doc.id} className="glass-card" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                <div style={{ 
                  width: "40px", height: "40px", borderRadius: "12px", 
                  background: "rgba(255, 255, 255, 0.03)", 
                  display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0
                }}>
                  {getFileIcon(doc.type, doc.name)}
                </div>
                <div style={{ overflow: "hidden" }}>
                  <div style={{ color: "white", fontWeight: "600", fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{doc.name}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: "12px" }}>{formatSize(doc.size)} • {formatDate(doc.created_at)}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  onClick={() => handleDownload(doc.id)}
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "13px" }}
                >
                  <Download size={16} /> Download
                </button>
                <button 
                  onClick={() => handleDelete(doc.id)}
                  disabled={isDeleting === doc.id}
                  style={{ flex: 1, padding: "10px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.1)", border: "none", color: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "13px" }}
                >
                  {isDeleting === doc.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />} Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: "rgba(15, 23, 42, 0.6)", borderRadius: "24px", border: "1px solid rgba(255,255,255,0.05)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.2)", textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <th style={{ padding: "20px 24px", color: "var(--text-muted)", fontWeight: "500", fontSize: "14px" }}>File Name</th>
                <th style={{ padding: "20px 24px", color: "var(--text-muted)", fontWeight: "500", fontSize: "14px" }}>Size</th>
                <th style={{ padding: "20px 24px", color: "var(--text-muted)", fontWeight: "500", fontSize: "14px" }}>Uploaded</th>
                <th style={{ padding: "20px 24px", color: "var(--text-muted)", fontWeight: "500", fontSize: "14px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr key={doc.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.02)", transition: "background 0.2s" }} onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.02)"} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
                  <td style={{ padding: "20px 24px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      <div style={{ 
                        width: "40px", height: "40px", borderRadius: "12px", 
                        background: "rgba(255, 255, 255, 0.03)", 
                        border: "1px solid rgba(255, 255, 255, 0.05)",
                        display: "flex", alignItems: "center", justifyContent: "center" 
                      }}>
                        {getFileIcon(doc.type, doc.name)}
                      </div>
                      <div>
                        <div style={{ color: "white", fontWeight: "500", fontSize: "15px", marginBottom: "4px" }}>{doc.name}</div>
                        <div style={{ color: "var(--text-muted)", fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{doc.type.split('/')[1] || doc.type}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "20px 24px", color: "#CBD5E1", fontSize: "14px" }}>{formatSize(doc.size)}</td>
                  <td style={{ padding: "20px 24px", color: "#CBD5E1", fontSize: "14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <Clock size={14} color="var(--text-muted)" />
                      {formatDate(doc.created_at)}
                    </div>
                  </td>
                  <td style={{ padding: "20px 24px", textAlign: "right" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "12px" }}>
                      <button 
                        onClick={() => handleDownload(doc.id)}
                        style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: "pointer", transition: "0.2s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.1)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.05)"}
                        title="Download"
                      >
                        <Download size={16} color="#CBD5E1" />
                      </button>
                      <button 
                        onClick={() => handleDelete(doc.id)}
                        disabled={isDeleting === doc.id}
                        style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", border: "none", cursor: isDeleting === doc.id ? "not-allowed" : "pointer", transition: "0.2s" }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.1)"}
                        title="Delete from Knowledge Base"
                      >
                        {isDeleting === doc.id ? <Loader2 size={16} color="#EF4444" className="animate-spin" /> : <Trash2 size={16} color="#EF4444" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
