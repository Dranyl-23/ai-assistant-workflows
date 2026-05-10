"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { socket } from "@/lib/socket";
import { supabase } from "@/lib/supabase";
import { 
  Send, 
  Bot, 
  User, 
  Globe, 
  Paperclip, 
  Loader2, 
  Plus, 
  MessageSquare, 
  Trash2, 
  Edit2,
  Check,
  Search,
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Clock,
  Sparkles,
  Mic,
  Brain,
  MicOff,
  Image as ImageIcon,
  X,
  ShieldAlert,
  Cpu,
  Zap,
  FileText,
  CheckSquare,
  Mail,
  Lock
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: any;
  created_at: string;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:5000/api";

export default function ChatPage() {
  const { session } = useAuth();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState("llama-3.1-8b-instant");
  const [selectedLanguage, setSelectedLanguage] = useState("en-US");
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const [isSidebarLoading, setIsSidebarLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [currentStatus, setCurrentStatus] = useState("");
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState("");
  const [showSidebar, setShowSidebar] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [userPlan, setUserPlan] = useState("free");

  // Fetch Profile Plan
  useEffect(() => {
    if (session?.user) {
      import("@/lib/supabase").then(({ supabase }) => {
        supabase.from("profiles").select("plan").eq("id", session.user.id).single()
          .then(({ data }) => {
            if (data) setUserPlan(data.plan);
          });
      });
    }
  }, [session]);

  // Check for mobile screen size
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) setShowSidebar(false); // Hide chat history sidebar on mobile by default
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);
  
  // Modal State
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; convId: string | null; convTitle: string }>({
    isOpen: false,
    convId: null,
    convTitle: ""
  });

  const [convSearchQuery, setConvSearchQuery] = useState("");
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingConvTitle, setEditingConvTitle] = useState("");
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null);

  // Voice Input State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null); // For real-time visual feedback

  // Image Analysis State
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // File Attachment State (documents, PDFs, etc.)
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; size: number; type: string; data: string; rawFile: File }[]>([]);
  const fileDocRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedFiles((prev) => [
        ...prev,
        {
          name: file.name,
          size: file.size,
          type: file.type,
          data: event.target?.result as string,
          rawFile: file,
        }
      ]);
    };
    reader.readAsDataURL(file);
    // Reset so the same file can be re-selected
    e.target.value = "";
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Helper to strip internal tags from display
  const stripInternalTags = (text: string) => {
    return text.replace(/\[SAVE_MEMORY:\s*.*?\]/g, "").replace(/\[ACTION:\s*.*?\]/g, "").trim();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(event.target as Node)) {
        setIsModelMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!session?.access_token) return;

    fetchConversations();
    
    // Fetch user preferences for AI Model and Language
    const fetchUserPrefs = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.ai_model) {
        setSelectedModel(user.user_metadata.ai_model);
      }
      if (user?.user_metadata?.language) {
        const langMap: Record<string, string> = {
          "en": "en-US",
          "fil": "fil-PH",
          "es": "es-ES",
          "ja": "ja-JP",
          "zh": "zh-CN"
        };
        setSelectedLanguage(langMap[user.user_metadata.language] || "en-US");
      }
    };
    fetchUserPrefs();

    socket.connect();
    socket.emit("authenticate", session.access_token);

    // Fired by backend the moment a NEW conversation row is created.
    // Optimistically add it to the sidebar list so the user sees it instantly
    // without waiting for the stream_end network refresh.
    socket.on("conversation_created", ({ id, title }: { id: string; title: string }) => {
      setCurrentConversationId(id);
      setConversations((prev) => {
        const alreadyExists = prev.some((c) => c.id === id);
        if (alreadyExists) return prev;
        return [{ id, title: title || "New Conversation", created_at: new Date().toISOString(), updated_at: new Date().toISOString() }, ...prev];
      });
    });

    socket.on("stream_start", ({ conversation_id }: { conversation_id: string }) => {
      setCurrentConversationId(conversation_id);
      setStreamingContent("");
      setIsLoading(true);
      // Note: fetchConversations() removed from here — conversation_created
      // handles new conversations optimistically. Fetching here was redundant
      // and caused unnecessary network traffic before the AI even replied.
    });

    socket.on("stream_chunk", ({ chunk }: { chunk: string }) => {
      setStreamingContent((prev) => prev + chunk);
    });

    socket.on("stream_end", async ({ message }: { message: any }) => {
      setMessages((prev) => [...prev, message]);
      setStreamingContent("");
      setIsLoading(false);
      setIsSearching(false);
      setCurrentStatus("");
      // Only refresh here — the conversation title may have been generated
      // by the backend after the first message, so we fetch the updated title.
      fetchConversations();
    });

    socket.on("status", ({ message, type }) => {
      setCurrentStatus(message);
      if (type === "searching" || type === "thinking" || message.toLowerCase().includes("analyzing")) {
        setIsSearching(true);
      } else if (type === "done") {
        setIsSearching(false);
      }
    });

    socket.on("chat_error", (err) => {
      console.error("Chat error:", err);
      setIsLoading(false);
      setIsSearching(false);
      if (err.error === "Usage limit reached") {
        setShowUpgradeModal(true);
      } else {
        alert(err.message || "An error occurred while sending the message.");
      }
    });

    // If the socket drops mid-stream (e.g. n8n action takes too long),
    // clear the thinking state immediately so the UI doesn't freeze.
    socket.on("disconnect", (reason) => {
      console.warn("[Socket] Disconnected:", reason);
      setIsLoading(false);
      setIsSearching(false);
      setStreamingContent("");
    });

    // On reconnect, re-fetch messages for the active conversation.
    // The backend saves the AI response to DB before emitting stream_end,
    // so we can recover the full response even if the socket dropped.
    socket.on("connect", () => {
      socket.emit("authenticate", session.access_token);
      setCurrentConversationId((convId) => {
        if (convId) {
          // Re-fetch saved messages to surface the AI reply that was lost
          fetch(`${API_URL}/chat/conversations/${convId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          })
            .then((r) => r.json())
            .then((data) => {
              if (data.messages) setMessages(data.messages);
            })
            .catch(console.error);
        }
        return convId;
      });
    });

    // Initialize Native Speech Recognition for real-time visual feedback
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = selectedLanguage; 

      recognitionRef.current.onresult = (event: any) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            // We'll let Whisper handle the final text, but update UI for now
            setInput((prev) => (prev ? prev + " " + event.results[i][0].transcript : event.results[i][0].transcript));
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }
        // Update input with interim text so user sees live feedback
        if (interimTranscript) {
           // We don't want to overwrite the whole input, just show it's working
           // For simplicity, we just log or append to placeholder
        }
      };
    }

    return () => {
      socket.off("conversation_created");
      socket.off("stream_start");
      socket.off("stream_chunk");
      socket.off("stream_end");
      socket.off("chat_error");
      socket.off("disconnect");
      socket.off("connect");
      socket.disconnect();
    };
  }, [session]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  const toggleRecording = async () => {
    if (isRecording) {
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      if (recognitionRef.current) recognitionRef.current.stop();
      setIsRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // 1. Start High-Quality Recorder (for Whisper)
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setIsLoading(true);

        const formData = new FormData();
        formData.append("audio", audioBlob, "recording.webm");

        try {
          const response = await fetch(`${API_URL}/chat/transcribe`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session?.access_token}` },
            body: formData,
          });

          if (!response.ok) throw new Error("Transcription failed");
          
          const data = await response.json();
          if (data.text) {
            // OVERWRITE or append the final high-quality result from Whisper
            setInput(data.text);
          }
        } catch (error) {
          console.error("Whisper error:", error);
        } finally {
          setIsLoading(false);
          stream.getTracks().forEach((track) => track.stop());
        }
      };

      // 2. Start Native Recognition (for Live UI Feedback)
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Microphone error:", err);
      alert("Please allow microphone access to use voice features.");
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("File too large. Max 5MB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setAttachedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const fetchConversations = async () => {
    if (!session?.access_token) return;
    try {
      setIsSidebarLoading(true);
      const response = await fetch(`${API_URL}/chat/conversations`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (err) {
      console.error("Failed to fetch conversations:", err);
    } finally {
      setIsSidebarLoading(false);
    }
  };

  const loadConversation = async (id: string) => {
    if (!session?.access_token || isLoading) return;
    try {
      setIsLoading(true);
      setCurrentConversationId(id);
      const response = await fetch(`${API_URL}/chat/conversations/${id}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await response.json();
      setMessages(data.conversation.messages || []);
    } catch (err) {
      console.error("Failed to load conversation:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewChat = () => {
    if (isLoading) return;
    setMessages([]);
    setCurrentConversationId(null);
    setStreamingContent("");
    setAttachedImage(null);
  };

  const confirmDelete = (e: React.MouseEvent, id: string, title: string) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, convId: id, convTitle: title });
  };

  const handleRenameConversation = async (e: React.FormEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editingConvTitle.trim() || !session?.access_token) return;
    
    try {
      const response = await fetch(`${API_URL}/chat/conversations/${id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({ title: editingConvTitle }),
      });
      if (response.ok) {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, title: editingConvTitle } : c));
        setEditingConvId(null);
      }
    } catch (err) {
      console.error("Failed to rename conversation:", err);
    }
  };

  const handleDeleteConversation = async () => {
    const { convId } = deleteModal;
    if (!convId || !session?.access_token) return;
    try {
      const response = await fetch(`${API_URL}/chat/conversations/${convId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (response.ok) {
        setConversations(prev => prev.filter(c => c.id !== convId));
        if (currentConversationId === convId) handleNewChat();
        setDeleteModal({ isOpen: false, convId: null, convTitle: "" });
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachedImage && attachedFiles.length === 0) || isLoading) return;

    setIsLoading(true);

    // If there are attached documents, upload them first
    if (attachedFiles.length > 0 && session?.access_token) {
      try {
        for (const fileObj of attachedFiles) {
          const formData = new FormData();
          formData.append("file", fileObj.rawFile);

          const response = await fetch(`${API_URL}/documents/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${session.access_token}` },
            body: formData,
          });

          if (!response.ok) {
            throw new Error(`Failed to upload document: ${fileObj.name}`);
          }
        }
      } catch (err) {
        console.error("Document upload failed:", err);
        setIsLoading(false);
        alert("Failed to upload one or more documents. Please try again.");
        return;
      }
    }

    const messageText = input.trim() || (attachedFiles.length > 0 ? `I have uploaded ${attachedFiles.length} file(s): ${attachedFiles.map(f => f.name).join(", ")}. Please review them.` : "");

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: messageText,
      metadata: attachedImage ? { image: attachedImage } : (attachedFiles.length > 0 ? { files: attachedFiles.map(f => ({ name: f.name, size: f.size })) } : null),
      created_at: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    socket.emit("chat_message", {
      message: messageText,
      conversation_id: currentConversationId,
      web_search: webSearchEnabled,
      image: attachedImage,
      model: selectedModel
    });

    if (webSearchEnabled && !attachedImage && attachedFiles.length === 0) setIsSearching(true);
    setInput("");
    setAttachedImage(null);
    setAttachedFiles([]);
    // Note: isLoading is intentionally NOT set to false here,
    // because we wait for stream_start / stream_end from the socket
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "transparent", overflow: "hidden", flex: 1 }}>
      
      {/* Deletion Confirmation Modal */}
      {deleteModal.isOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, animation: "fadeIn 0.2s ease-out" }}>
          <div className="glass-card" style={{ width: "90%", maxWidth: "400px", padding: "32px", textAlign: "center", border: "1px solid rgba(239, 68, 68, 0.2)", boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "rgba(239, 68, 68, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px", color: "#ef4444" }}>
              <ShieldAlert size={32} />
            </div>
            <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "12px", textAlign: "center" }}>Are you sure?</h3>
            <p style={{ color: "var(--text-muted)", fontSize: "15px", lineHeight: "1.6", marginBottom: "28px", textAlign: "center" }}>
              You are about to delete this conversation: <span style={{ color: "white", fontWeight: "600" }}>"{deleteModal.convTitle || "Untitled Chat"}"</span>.
            </p>
            <div style={{ display: "flex", gap: "12px" }}>
              <button onClick={() => setDeleteModal({ isOpen: false, convId: null, convTitle: "" })} className="btn-secondary" style={{ flex: 1, padding: "12px" }}>Cancel</button>
              <button onClick={handleDeleteConversation} className="btn-primary" style={{ flex: 1, padding: "12px", background: "#ef4444", border: "none", boxShadow: "0 10px 20px rgba(239, 68, 68, 0.2)" }}>Delete Now</button>
            </div>
          </div>
        </div>
      )}

      {/* Sidebar - Chat History */}
      <div style={{
        width: showSidebar ? (isMobile ? "100%" : "280px") : "0",
        position: isMobile ? "fixed" : "relative",
        inset: isMobile ? 0 : "auto",
        background: isMobile ? "rgba(15, 23, 42, 0.98)" : "rgba(15, 23, 42, 0.4)",
        borderRight: "1px solid var(--border-primary)",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        overflow: "hidden",
        zIndex: isMobile ? 100 : 20,
        flexShrink: 0,
        height: "100%"
      }}>
        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "20px", height: "100%" }}>
          <button onClick={handleNewChat} className="btn-primary" style={{ width: "100%", justifyContent: "center", gap: "10px", padding: "12px", borderRadius: "14px", fontSize: "14px", fontWeight: "600" }}>
            <Plus size={18} /> New Conversation
          </button>
          
          {/* Conversation Search */}
          <div style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input 
              type="text" 
              placeholder="Search chats..." 
              value={convSearchQuery}
              onChange={(e) => setConvSearchQuery(e.target.value)}
              style={{ 
                width: "100%", padding: "10px 12px 10px 34px", 
                background: "rgba(30, 41, 59, 0.5)", 
                border: "1px solid rgba(255,255,255,0.05)", 
                borderRadius: "10px", color: "white", fontSize: "12px", outline: "none"
              }}
            />
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }} className="sidebar-scroll">
            <p style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em", margin: "10px 0 10px 5px" }}>Recent Chats</p>
            {isSidebarLoading && conversations.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px" }}><Loader2 size={20} className="animate-spin" color="var(--text-muted)" /></div>
            ) : (
              conversations
                .filter(c => (c.title || "").toLowerCase().includes(convSearchQuery.toLowerCase()))
                .map((conv) => (
                <div 
                  key={conv.id} 
                  onClick={() => loadConversation(conv.id)} 
                  onMouseEnter={() => setHoveredConvId(conv.id)}
                  onMouseLeave={() => setHoveredConvId(null)}
                  className="conv-item" 
                  style={{ 
                    padding: "10px 12px", 
                    borderRadius: "10px", 
                    cursor: "pointer", 
                    background: currentConversationId === conv.id ? "rgba(139, 92, 246, 0.12)" : (hoveredConvId === conv.id ? "rgba(255,255,255,0.03)" : "transparent"), 
                    color: currentConversationId === conv.id ? "white" : "var(--text-muted)", 
                    fontSize: "13px", 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "10px", 
                    transition: "all 0.2s", 
                    position: "relative" 
                  }}
                >
                  <MessageSquare size={14} color={currentConversationId === conv.id ? "var(--primary-violet)" : "inherit"} style={{ flexShrink: 0 }} />
                  
                  {editingConvId === conv.id ? (
                    <form onSubmit={(e) => handleRenameConversation(e, conv.id)} style={{ flex: 1, display: "flex", alignItems: "center" }}>
                      <input 
                        autoFocus
                        value={editingConvTitle}
                        onChange={(e) => setEditingConvTitle(e.target.value)}
                        onBlur={(e) => handleRenameConversation(e as any, conv.id)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: "100%", background: "rgba(0,0,0,0.3)", border: "1px solid var(--primary-violet)", borderRadius: "4px", color: "white", fontSize: "13px", padding: "2px 6px", outline: "none" }}
                      />
                    </form>
                  ) : (
                    <div style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: currentConversationId === conv.id ? "600" : "400", minWidth: 0 }}>{conv.title || "Untitled Chat"}</div>
                  )}

                  <div className="conv-actions" style={{ display: "flex", gap: "4px", opacity: hoveredConvId === conv.id ? 1 : 0, transition: "opacity 0.2s" }}>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setEditingConvId(conv.id); 
                        setEditingConvTitle(conv.title || ""); 
                      }} 
                      style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px", borderRadius: "6px" }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "white"}
                      onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                    >
                      <Edit2 size={12} />
                    </button>
                    <button 
                      onClick={(e) => confirmDelete(e, conv.id, conv.title)} 
                      style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px", borderRadius: "6px" }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "#ef4444"}
                      onMouseLeave={(e) => e.currentTarget.style.color = "var(--text-muted)"}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative", background: "rgba(15, 23, 42, 0.2)", flexShrink: 0 }}>
        {!isMobile && (
          <button 
            onClick={() => setShowSidebar(!showSidebar)} 
            style={{ 
              position: "absolute", 
              left: showSidebar ? "-16px" : "8px", 
              top: "50%", 
              transform: "translateY(-50%)", 
              background: "rgba(30, 41, 59, 0.95)", 
              border: "1px solid var(--border-primary)", 
              borderRadius: "50%", 
              width: "32px", 
              height: "32px", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              color: "white", 
              cursor: "pointer", 
              zIndex: 100, 
              transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", 
              boxShadow: "0 8px 24px rgba(0,0,0,0.5)" 
            }}
          >
            {showSidebar ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
          </button>
        )}

        {/* Header (Desktop Only) */}
        {!isMobile && (
          <div style={{ padding: "20px 28px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "rgba(15, 23, 42, 0.8)", backdropFilter: "blur(12px)", borderBottom: "1px solid rgba(255, 255, 255, 0.03)", flexShrink: 0, zIndex: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ width: "40px", height: "40px", borderRadius: "12px", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 15px rgba(139, 92, 246, 0.4)" }}>
                <Bot size={22} color="white" />
              </div>
              <div>
                <h2 style={{ fontSize: "17px", fontWeight: "800", letterSpacing: "0.02em", color: "white" }}>LuminaAI Engine</h2>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--primary-violet)", fontWeight: "600", marginTop: "2px" }}>
                  <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10B981", boxShadow: "0 0 10px #10B981" }} />
                  {currentConversationId ? "Active Orchestration" : "Ready for Commands"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Custom Model Switcher */}
              <div style={{ position: "relative" }} ref={modelMenuRef}>
                <button 
                  onClick={() => setIsModelMenuOpen(!isModelMenuOpen)}
                  style={{ 
                    display: "flex", 
                    alignItems: "center", 
                    gap: "10px", 
                    background: "rgba(255,255,255,0.03)", 
                    padding: "8px 14px", 
                    borderRadius: "14px", 
                    border: "1px solid rgba(255,255,255,0.08)",
                    cursor: "pointer",
                    transition: "all 0.2s"
                  }}
                  className="hover-icon"
                >
                  <Cpu size={14} color="var(--primary-violet)" />
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "white" }}>
                    {selectedModel === "llama-3.1-8b-instant" ? "Llama 8B (Fast)" : 
                     selectedModel === "deepseek-r1-distill-llama-70b" ? "DeepSeek R1" : "Llama 70B (Smart)"}
                  </span>
                  <ChevronDown size={14} color="var(--text-muted)" style={{ transform: isModelMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                </button>

                {isModelMenuOpen && (
                  <div className="glass-card" style={{ 
                    position: "absolute", 
                    top: "calc(100% + 10px)", 
                    right: 0, 
                    width: "240px", 
                    padding: "8px", 
                    zIndex: 100, 
                    boxShadow: "0 20px 40px rgba(0,0,0,0.4)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    animation: "fadeIn 0.2s ease-out"
                  }}>
                    {[
                      { id: "llama-3.1-8b-instant", label: "Llama 3.1 8B", desc: "Best for speed & daily chat", icon: <Zap size={16} color="#38bdf8" />, proRequired: false },
                      { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", desc: "Complex reasoning & code", icon: <Brain size={16} color="#a78bfa" strokeWidth={2.5} />, proRequired: true },
                      { id: "deepseek-r1-distill-llama-70b", label: "DeepSeek R1", desc: "Advanced reasoning (Preview)", icon: <Sparkles size={16} color="#6366f1" />, proRequired: true }
                    ].map((m) => {
                      const isPro = userPlan === "pro" || userPlan === "enterprise";
                      const disabled = m.proRequired && !isPro;

                      return (
                        <button
                          key={m.id}
                          onClick={() => {
                            if (disabled) {
                              setShowUpgradeModal(true);
                              setIsModelMenuOpen(false);
                            } else {
                              setSelectedModel(m.id);
                              setIsModelMenuOpen(false);
                            }
                          }}
                          style={{ 
                            width: "100%", 
                            padding: "12px", 
                            borderRadius: "10px", 
                            display: "flex", 
                            alignItems: "center", 
                            gap: "12px", 
                            background: selectedModel === m.id ? "rgba(139, 92, 246, 0.1)" : "transparent",
                            border: "none",
                            textAlign: "left",
                            cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? 0.5 : 1,
                            transition: "all 0.2s"
                          }}
                          className="model-option"
                        >
                          <div style={{ padding: "8px", borderRadius: "8px", background: "rgba(255,255,255,0.03)" }}>{m.icon}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "13px", fontWeight: "700", color: selectedModel === m.id ? "var(--primary-violet)" : "white" }}>{m.label}</div>
                            <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{m.desc}</div>
                          </div>
                          {disabled && <Lock size={14} color="rgba(255,255,255,0.3)" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Messages Container */}
        <div style={{ 
          flex: 1, 
          overflowY: "auto", 
          padding: isMobile ? "12px 12px 30px" : "24px 24px 40px", 
          display: "flex", 
          flexDirection: "column", 
          gap: isMobile ? "20px" : "32px" 
        }} className="chat-scroll">
          {messages.length === 0 && !streamingContent && (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "24px", color: "var(--text-muted)", animation: "fadeIn 0.5s ease-out", padding: "20px" }}>
              <div style={{ width: "64px", height: "64px", borderRadius: "20px", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 20px 40px rgba(139, 92, 246, 0.3)", animation: "float 4s ease-in-out infinite" }}><Sparkles size={32} color="white" /></div>
              <div style={{ textAlign: "center" }}>
                <h3 style={{ fontSize: isMobile ? "20px" : "24px", fontWeight: "700", color: "white", marginBottom: "8px" }}>How can I help you?</h3>
                <p style={{ fontSize: "14px", maxWidth: "400px", lineHeight: "1.5" }}>Talk to me, upload documents, or search the web.</p>
              </div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "10px", width: "100%", maxWidth: "500px", marginTop: "8px" }}>
                {[
                  { title: "Summarize Document", icon: <FileText size={16} /> },
                  { title: "Search Web", icon: <Globe size={16} /> }
                ].map((prompt, idx) => (
                  <button 
                    key={idx}
                    onClick={() => { setInput(prompt.title); document.getElementById('chat-input')?.focus(); }}
                    style={{ background: "rgba(15, 23, 42, 0.4)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "14px", padding: "14px", textAlign: "left", cursor: "pointer", transition: "all 0.2s", display: "flex", alignItems: "center", gap: "12px" }}
                  >
                    <div style={{ color: "var(--primary-violet)" }}>{prompt.icon}</div>
                    <div style={{ color: "white", fontSize: "13px", fontWeight: "600" }}>{prompt.title}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} style={{ 
              display: "flex", 
              gap: isMobile ? "8px" : "16px", 
              maxWidth: msg.role === "user" ? (isMobile ? "92%" : "80%") : (isMobile ? "95%" : "88%"), 
              alignSelf: msg.role === "user" ? "flex-end" : "flex-start", 
              flexDirection: msg.role === "user" ? "row-reverse" : "row", 
              animation: "slideIn 0.3s ease-out" 
            }}>
              
              {/* Avatar */}
              {msg.role === "assistant" && (
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 15px rgba(139, 92, 246, 0.3)" }}>
                  <Bot size={18} color="white" />
                </div>
              )}

              {/* Bubble */}
              <div style={{ 
                padding: msg.metadata?.image && !msg.content ? "8px" : "16px 22px", 
                borderRadius: "20px", 
                borderTopRightRadius: msg.role === "user" ? "4px" : "20px", 
                borderTopLeftRadius: msg.role === "user" ? "20px" : "4px", 
                background: msg.role === "user" ? "rgba(255, 255, 255, 0.06)" : "rgba(30, 41, 59, 0.7)", 
                border: msg.role === "user" ? "1px solid rgba(255, 255, 255, 0.04)" : "1px solid rgba(255, 255, 255, 0.08)", 
                fontSize: "15px", 
                lineHeight: "1.7", 
                color: msg.role === "user" ? "#F8FAFC" : "#E2E8F0", 
                boxShadow: msg.role === "user" ? "none" : "0 10px 30px rgba(0,0,0,0.2)",
                backdropFilter: msg.role === "user" ? "blur(10px)" : "blur(12px)",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                overflowX: "hidden"
              }}>
                {msg.metadata?.image && (
                  <img src={msg.metadata.image} style={{ maxWidth: "320px", maxHeight: "320px", objectFit: "cover", borderRadius: "14px", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 4px 15px rgba(0,0,0,0.2)" }} alt="Uploaded context" />
                )}
                {msg.content && (
                  <div className={`markdown-content ${msg.role === "user" ? "user-markdown" : ""}`}>
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({node, inline, className, children, ...props}: any) {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <SyntaxHighlighter
                              {...props}
                              children={String(children).replace(/\n$/, '')}
                              style={vscDarkPlus}
                              language={match[1]}
                              PreTag="div"
                              customStyle={{ borderRadius: "8px", background: "rgba(15, 23, 42, 0.8)", margin: "12px 0" }}
                            />
                          ) : (
                            <code {...props} className={className} style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", fontSize: "14px" }}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {stripInternalTags(msg.content)}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {streamingContent && (
            <div style={{ display: "flex", gap: "16px", maxWidth: "88%", alignSelf: "flex-start" }}>
              <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "var(--gradient-primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 15px rgba(139, 92, 246, 0.3)" }}>
                <Bot size={18} color="white" />
              </div>
              <div style={{ padding: "16px 22px", borderRadius: "20px", borderTopLeftRadius: "4px", background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255, 255, 255, 0.08)", fontSize: "15px", lineHeight: "1.7", color: "#E2E8F0", backdropFilter: "blur(12px)", boxShadow: "0 10px 30px rgba(0,0,0,0.2)" }}>
                <div className="markdown-content">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({node, inline, className, children, ...props}: any) {
                        const match = /language-(\w+)/.exec(className || '')
                        return !inline && match ? (
                          <SyntaxHighlighter
                            {...props}
                            children={String(children).replace(/\n$/, '')}
                            style={vscDarkPlus}
                            language={match[1]}
                            PreTag="div"
                            customStyle={{ borderRadius: "8px", background: "rgba(15, 23, 42, 0.8)", margin: "12px 0" }}
                          />
                        ) : (
                          <code {...props} className={className} style={{ background: "rgba(255,255,255,0.1)", padding: "2px 6px", borderRadius: "4px", fontSize: "14px" }}>
                            {children}
                          </code>
                        )
                      }
                    }}
                  >
                    {stripInternalTags(streamingContent)}
                  </ReactMarkdown>
                </div>
                <span className="cursor-blink" style={{ display: "inline-block", width: "8px", height: "15px", background: "var(--primary-violet)", marginLeft: "4px", verticalAlign: "middle" }} />
              </div>
            </div>
          )}

          {isSearching && (
            <div style={{ display: "flex", alignItems: "center", gap: "12px", color: "var(--text-muted)", fontSize: "13px", marginLeft: "58px", background: "rgba(139, 92, 246, 0.05)", padding: "10px 16px", borderRadius: "12px", width: "fit-content" }}>
              <Loader2 size={16} className="animate-spin" color="var(--primary-violet)" /><span style={{ fontWeight: "500" }}>Analyzing real-time results...</span>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{ 
          padding: isMobile ? "12px" : "24px", 
          background: "rgba(15, 23, 42, 0.4)", 
          borderTop: "1px solid rgba(255, 255, 255, 0.03)", 
          flexShrink: 0 
        }}>
          <div style={{ maxWidth: "800px", margin: "0 auto", position: "relative" }}>
            
            {/* Stop Generation Button */}
            {isLoading && (
              <div style={{ position: "absolute", bottom: "100%", left: "50%", transform: "translateX(-50%)", marginBottom: "16px", animation: "slideUp 0.3s ease-out", zIndex: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoading(false);
                    setIsSearching(false);
                    socket.disconnect();
                    setTimeout(() => socket.connect(), 500);
                  }}
                  style={{
                    display: "flex", alignItems: "center", gap: "8px",
                    padding: "8px 16px", borderRadius: "20px",
                    background: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(255,255,255,0.1)",
                    color: "white", fontSize: "13px", fontWeight: "600", cursor: "pointer",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.3)", backdropFilter: "blur(12px)",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239, 68, 68, 0.15)"; e.currentTarget.style.borderColor = "rgba(239, 68, 68, 0.3)" }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(15, 23, 42, 0.8)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)" }}
                >
                  <div style={{ width: "10px", height: "10px", background: "#ef4444", borderRadius: "2px" }} />
                  Stop generating
                </button>
              </div>
            )}

            {/* Attached Files Preview (Multiple) */}
            {attachedFiles.length > 0 && (
              <div style={{ position: "absolute", bottom: "100%", left: "0", marginBottom: "12px", animation: "slideUp 0.3s ease-out", display: "flex", flexDirection: "column", gap: "8px", width: "100%", maxWidth: "400px" }}>
                {attachedFiles.map((file, idx) => (
                  <div key={idx} style={{
                    display: "inline-flex", alignItems: "center", gap: "10px",
                    padding: "10px 16px", borderRadius: "14px",
                    background: "rgba(139, 92, 246, 0.1)",
                    border: "1px solid rgba(139, 92, 246, 0.3)",
                    backdropFilter: "blur(12px)",
                    boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
                  }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(139, 92, 246, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Paperclip size={18} color="var(--primary-violet)" />
                    </div>
                    <div style={{ overflow: "hidden", flex: 1 }}>
                      <div style={{ fontSize: "13px", fontWeight: "600", color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatFileSize(file.size)}</div>
                    </div>
                    <button onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center", flexShrink: 0, borderRadius: "6px" }}>
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {attachedImage && (
              <div style={{ position: "absolute", bottom: "100%", left: "0", marginBottom: "16px", animation: "slideUp 0.3s ease-out" }}>
                <div style={{ position: "relative", width: "80px", height: "80px" }}>
                  <img src={attachedImage} style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "14px", border: "2px solid var(--primary-violet)", boxShadow: "0 10px 20px rgba(0,0,0,0.4)" }} />
                  <button onClick={() => setAttachedImage(null)} style={{ position: "absolute", top: "-8px", right: "-8px", background: "#ef4444", color: "white", borderRadius: "50%", width: "22px", height: "22px", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
                </div>
              </div>
            )}

            <form onSubmit={handleSendMessage} style={{ display: "flex", alignItems: "center", gap: isMobile ? "6px" : "12px", padding: "8px 10px", borderRadius: "24px", background: "rgba(30, 41, 59, 0.7)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 15px 50px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)", backdropFilter: "blur(24px)", transition: "all 0.3s ease" }}>
              {/* Media Picker Icons */}
              <div style={{ display: "flex", gap: "4px" }}>
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageSelect} style={{ display: "none" }} />
                <button type="button" onClick={() => fileInputRef.current?.click()} style={{ padding: "8px", borderRadius: "12px", border: "none", background: "rgba(255,255,255,0.03)", cursor: "pointer", color: attachedImage ? "var(--primary-violet)" : "#94A3B8" }}>
                  <ImageIcon size={isMobile ? 18 : 22} />
                </button>

                <input type="file" ref={fileDocRef} multiple accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.pptx,application/*,text/*" onChange={handleFileSelect} style={{ display: "none" }} />
                <button type="button" onClick={() => fileDocRef.current?.click()} style={{ padding: "8px", borderRadius: "12px", border: "none", background: "rgba(255,255,255,0.03)", cursor: "pointer", color: attachedFiles.length > 0 ? "var(--primary-violet)" : "#94A3B8" }}>
                  <Paperclip size={isMobile ? 18 : 22} />
                </button>
              </div>

              <textarea 
                id="chat-input"
                value={input} 
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = e.target.scrollHeight + 'px';
                }} 
                placeholder={isRecording ? "Listening..." : (isMobile ? "Message..." : "Message LuminaAI...")} 
                rows={1}
                style={{ 
                  flex: 1, 
                  background: "transparent", 
                  border: "none", 
                  color: "white", 
                  padding: "10px 4px", 
                  outline: "none", 
                  fontSize: "14px",
                  resize: "none",
                  maxHeight: "150px",
                  fontFamily: "inherit",
                  lineHeight: "1.5",
                  overflowY: "auto"
                }} 
              />
              
              <button type="submit" disabled={(!input.trim() && !attachedImage && attachedFiles.length === 0) || isLoading} style={{ width: isMobile ? "40px" : "48px", height: isMobile ? "40px" : "48px", borderRadius: "14px", background: "var(--gradient-primary)", border: "none", color: "white", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-10px); } 100% { transform: translateY(0px); } }
        .cursor-blink { animation: blink 1s step-end infinite; }
        @keyframes blink { 50% { opacity: 0; } }
        .pulse-red { animation: pulse-red-bg 1.5s infinite ease-in-out; }
        @keyframes pulse-red-bg { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); } 70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
        .conv-item:hover { background: rgba(255, 255, 255, 0.05) !important; color: white !important; }
        .conv-item:hover .delete-btn { opacity: 1 !important; }
        .delete-btn:hover { background: rgba(239, 68, 68, 0.2) !important; color: #ef4444 !important; }
        .model-option:hover { background: rgba(255,255,255,0.05) !important; }
        .hover-icon:hover { background: rgba(255,255,255,0.08) !important; color: white !important; }
        .sidebar-scroll::-webkit-scrollbar, .chat-scroll::-webkit-scrollbar { width: 5px; }
        .sidebar-scroll::-webkit-scrollbar-thumb, .chat-scroll::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.1); border-radius: 10px; }
        .markdown-content :global(p) { margin-bottom: 12px; }
        .markdown-content :global(p:last-child) { margin-bottom: 0; }
        .markdown-content :global(pre) { background: rgba(0,0,0,0.3); padding: 14px; border-radius: 12px; overflow-x: auto; margin: 12px 0; border: 1px solid rgba(255,255,255,0.1); box-shadow: inset 0 2px 10px rgba(0,0,0,0.2); }
        .markdown-content :global(code) { font-family: 'JetBrains Mono', monospace; font-size: 13.5px; color: #a78bfa; background: rgba(139, 92, 246, 0.1); padding: 2px 6px; border-radius: 4px; }
        .markdown-content :global(pre code) { background: transparent; padding: 0; color: #E2E8F0; }
        .user-markdown :global(code) { color: white; background: rgba(0,0,0,0.2); }
      `}</style>

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div style={{ 
          position: "fixed", inset: 0, zIndex: 10000, 
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)",
          animation: "fadeIn 0.3s ease-out"
        }}>
          <div className="glass-card" style={{ 
            width: "90%", maxWidth: "420px", padding: "40px", 
            textAlign: "center", border: "1px solid rgba(139, 92, 246, 0.3)",
            background: "rgba(15, 23, 42, 0.8)", boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
            animation: "slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
            position: "relative", overflow: "hidden"
          }}>
            {/* Background Glow */}
            <div style={{ position: "absolute", top: "-50px", right: "-50px", width: "150px", height: "150px", background: "rgba(139, 92, 246, 0.2)", filter: "blur(40px)", borderRadius: "50%" }} />
            
            <div style={{ 
              width: "72px", height: "72px", borderRadius: "22px", 
              background: "var(--gradient-primary)", display: "flex", 
              alignItems: "center", justifyContent: "center", margin: "0 auto 24px",
              boxShadow: "0 15px 30px rgba(139, 92, 246, 0.4)" 
            }}>
              <Zap size={36} color="white" fill="white" />
            </div>

            <h2 style={{ fontSize: "24px", fontWeight: "800", marginBottom: "12px", color: "white" }}>Limit Reached</h2>
            <p style={{ color: "var(--text-muted)", fontSize: "15px", lineHeight: "1.6", marginBottom: "32px" }}>
              You've hit the monthly limit of 50 messages for the Free plan. Upgrade to <strong>Pro</strong> for unlimited AI access and advanced features.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <button 
                onClick={() => router.push("/dashboard/settings")} 
                className="btn-primary" 
                style={{ padding: "16px", borderRadius: "14px", fontSize: "15px", fontWeight: "700", justifyContent: "center" }}
              >
                Upgrade to Pro <Sparkles size={16} style={{ marginLeft: "8px" }} />
              </button>
              <button 
                onClick={() => setShowUpgradeModal(false)} 
                style={{ 
                  background: "none", border: "none", color: "var(--text-muted)", 
                  fontSize: "14px", fontWeight: "600", cursor: "pointer", padding: "8px" 
                }}
              >
                Maybe Later
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
