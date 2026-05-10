require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const documentRoutes = require("./routes/document");
const integrationRoutes = require("./routes/integration");
const memoryRoutes = require("./routes/memory");
const subscriptionRoutes = require("./routes/subscription");
const stripeRoutes = require("./routes/stripe");

// ── Services ──────────────────────────────────────────────────────────────────
const { supabase } = require("./config/supabase");
const { handleChatMessage } = require("./services/chatOrchestrator");

const app = express();
const server = http.createServer(app);

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:3000",
  // Vercel preview URLs follow the pattern *.vercel.app
  /\.vercel\.app$/,
];

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
  },
  // Exponential back-off reconnection is handled client-side;
  // these server-side settings prevent dead sockets from accumulating.
  pingTimeout: 30000,
  pingInterval: 10000,
});

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Raw body for Stripe webhook; JSON for everything else
app.use((req, res, next) => {
  if (req.originalUrl === "/api/stripe/webhook") {
    next();
  } else {
    express.json({ limit: "10mb" })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// Lightweight request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ── REST API Routes ───────────────────────────────────────────────────────────
const { requireAuth } = require("./middleware/auth");

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      supabase: !!process.env.SUPABASE_URL,
      groq_llm: !!process.env.GROQ_API_KEY,
      groq_stt: !!process.env.GROQ_API_KEY,
      elevenlabs_tts: !!process.env.ELEVENLABS_API_KEY,
      search: true,
      stripe: !!process.env.STRIPE_SECRET_KEY,
      n8n: !!process.env.N8N_BASE_URL,
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/documents", requireAuth, documentRoutes);
app.use("/api/integrations", requireAuth, integrationRoutes);
app.use("/api/memories", requireAuth, memoryRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/stripe", stripeRoutes);

// ── WebSocket ─────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // ── Authentication ──────────────────────────────────────────────────────────
  socket.on("authenticate", async (token) => {
    if (!token || typeof token !== "string") {
      socket.emit("auth_error", { error: "Token is required" });
      return;
    }

    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        socket.emit("auth_error", { error: "Invalid token" });
        return;
      }

      socket.userId = user.id;
      socket.emit("authenticated", { userId: user.id });
      console.log(`[WS] User authenticated: ${user.id}`);
    } catch (err) {
      console.error("[WS] Authentication error:", err.message);
      socket.emit("auth_error", { error: "Authentication failed" });
    }
  });

  // ── Chat message ────────────────────────────────────────────────────────────
  socket.on("chat_message", async (data) => {
    if (!socket.userId) {
      socket.emit("auth_error", { error: "Not authenticated. Please reconnect." });
      return;
    }

    // Validate required fields before handing off to the orchestrator
    if (!data?.message && !data?.image) {
      socket.emit("chat_error", { error: "Message or image is required." });
      return;
    }

    try {
      await handleChatMessage(socket, data);
    } catch (err) {
      // Final safety net — the orchestrator has its own per-step error boundaries,
      // so reaching here means something truly unexpected occurred.
      console.error("[WS] Unhandled chat error:", err.message, err.stack);
      socket.emit("chat_error", {
        error: "An unexpected error occurred. Please try again.",
      });
    }
  });

  // ── Disconnect ──────────────────────────────────────────────────────────────
  socket.on("disconnect", (reason) => {
    console.log(`[WS] Client disconnected: ${socket.id} — reason: ${reason}`);
  });
});

// ── Error Handling ────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

// ── Server ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   AI Assistant Workflow API Server       ║
  ║   Running on http://localhost:${PORT}       ║
  ║   Environment: ${process.env.NODE_ENV || "development"}               ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = { app, server, io };
