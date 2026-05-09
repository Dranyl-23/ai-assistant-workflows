const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";

interface FetchOptions extends RequestInit {
  token?: string;
}

async function fetchAPI(endpoint: string, options: FetchOptions = {}) {
  const { token, ...fetchOpts } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, {
    ...fetchOpts,
    headers,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "API request failed");
  }

  return data;
}

// Auth
export const api = {
  auth: {
    signup: (email: string, password: string, full_name: string) =>
      fetchAPI("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ email, password, full_name }),
      }),
    login: (email: string, password: string) =>
      fetchAPI("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      }),
    logout: (token: string) =>
      fetchAPI("/auth/logout", { method: "POST", token }),
    me: (token: string) => fetchAPI("/auth/me", { token }),
    refresh: (refresh_token: string) =>
      fetchAPI("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refresh_token }),
      }),
  },

  // Chat
  chat: {
    getConversations: (token: string) =>
      fetchAPI("/chat/conversations", { token }),
    getConversation: (id: string, token: string) =>
      fetchAPI(`/chat/conversations/${id}`, { token }),
    createConversation: (token: string, title?: string) =>
      fetchAPI("/chat/conversations", {
        method: "POST",
        token,
        body: JSON.stringify({ title }),
      }),
    deleteConversation: (id: string, token: string) =>
      fetchAPI(`/chat/conversations/${id}`, { method: "DELETE", token }),
    /**
     * @deprecated The REST /chat/send endpoint has been removed (returns HTTP 410).
     * All chat is handled over Socket.IO — see lib/socket.ts.
     * Emit: socket.emit("chat_message", { message, conversation_id, web_search, image, model })
     */
    sendMessage: () => {
      throw new Error(
        "[api.ts] sendMessage() is deprecated. Use Socket.IO: socket.emit('chat_message', { message, conversation_id, model })"
      );
    },
  },

  // Documents
  documents: {
    getAll: (token: string) => fetchAPI("/documents", { token }),
    delete: (id: string, token: string) =>
      fetchAPI(`/documents/${id}`, { method: "DELETE", token }),
  },

  // Integrations
  integrations: {
    getAll: (token: string) => fetchAPI("/integrations", { token }),
    connect: (
      provider: string,
      access_token: string,
      token: string
    ) =>
      fetchAPI("/integrations/connect", {
        method: "POST",
        token,
        body: JSON.stringify({ provider, access_token }),
      }),
    disconnect: (id: string, token: string) =>
      fetchAPI(`/integrations/${id}`, { method: "DELETE", token }),
    status: (provider: string, token: string) =>
      fetchAPI(`/integrations/${provider}/status`, { token }),
  },

  // Health
  health: () => fetchAPI("/health"),
};
