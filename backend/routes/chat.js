const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { supabaseAdmin } = require("../config/supabase");
const { v4: uuidv4 } = require("uuid");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { transcribeAudio } = require("../services/whisper");
const { textToSpeech } = require("../services/elevenlabs");

const upload = multer({ dest: path.join(__dirname, "../uploads/") });
const router = express.Router();

// All chat routes require authentication
router.use(requireAuth);

/**
 * GET /chat/usage
 * Returns the total number of user messages sent by the authenticated user.
 * Used by clients (especially mobile) to sync the real server-side usage count
 * on app startup, so local counters can't be bypassed by restarting the app.
 */
router.get("/usage", async (req, res) => {
  try {
    // Fetch all conversation IDs that belong to this user
    const { data: convs, error: convErr } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("user_id", req.user.id);

    if (convErr) throw convErr;

    if (!convs || convs.length === 0) {
      return res.json({ messageCount: 0, limit: 50, plan: "free" });
    }

    const convIds = convs.map((c) => c.id);

    // Count total user-role messages across all those conversations
    const { count, error: countErr } = await supabaseAdmin
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("role", "user")
      .in("conversation_id", convIds);

    if (countErr) throw countErr;

    // Fetch plan for the response
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("plan")
      .eq("id", req.user.id)
      .single();

    const plan = profile?.plan || "free";
    const limit = plan === "free" ? 50 : null; // null = unlimited

    res.json({ messageCount: count ?? 0, limit, plan });
  } catch (err) {
    console.error("[Chat] GET /usage error:", err.message);
    res.status(500).json({ error: "Failed to fetch usage count" });
  }
});

/**
 * GET /chat/conversations
 * Get all conversations for the current user
 */
router.get("/conversations", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("conversations")
      .select("id, title, created_at, updated_at")
      .eq("user_id", req.user.id)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    res.json({ conversations: data || [] });
  } catch (err) {
    console.error("Get conversations error:", err);
    res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

/**
 * POST /chat/conversations
 * Create a new conversation
 */
router.post("/conversations", async (req, res) => {
  try {
    const { title } = req.body;
    const id = uuidv4();

    const { data, error } = await supabaseAdmin
      .from("conversations")
      .insert({
        id,
        user_id: req.user.id,
        title: title || "New Conversation",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ conversation: data });
  } catch (err) {
    console.error("Create conversation error:", err);
    res.status(500).json({ error: "Failed to create conversation" });
  }
});

/**
 * GET /chat/conversations/:id
 * Get a single conversation with its messages
 */
router.get("/conversations/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Get conversation
    const { data: conversation, error: convError } = await supabaseAdmin
      .from("conversations")
      .select("*")
      .eq("id", id)
      .eq("user_id", req.user.id)
      .single();

    if (convError || !conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    // Get messages
    const { data: messages, error: msgError } = await supabaseAdmin
      .from("messages")
      .select("id, role, content, metadata, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: true });

    if (msgError) throw msgError;

    res.json({
      conversation: {
        ...conversation,
        messages: messages || [],
      },
    });
  } catch (err) {
    console.error("Get conversation error:", err);
    res.status(500).json({ error: "Failed to fetch conversation" });
  }
});

/**
 * DELETE /chat/conversations/:id
 * Delete a conversation and all its messages
 */
router.delete("/conversations/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Delete messages first
    await supabaseAdmin
      .from("messages")
      .delete()
      .eq("conversation_id", id);

    // Delete conversation
    const { error } = await supabaseAdmin
      .from("conversations")
      .delete()
      .eq("id", id)
      .eq("user_id", req.user.id);

    if (error) throw error;

    res.json({ message: "Conversation deleted" });
  } catch (err) {
    console.error("Delete conversation error:", err);
    res.status(500).json({ error: "Failed to delete conversation" });
  }
});

/**
 * PATCH /chat/conversations/:id
 * Rename a conversation
 */
router.patch("/conversations/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { title } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    const { data, error } = await supabaseAdmin
      .from("conversations")
      .update({ title, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", req.user.id)
      .select()
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "Conversation not found or update failed" });
    }

    res.json({ conversation: data });
  } catch (err) {
    console.error("Rename conversation error:", err);
    res.status(500).json({ error: "Failed to rename conversation" });
  }
});

/**
 * POST /chat/send — DEPRECATED
 *
 * This endpoint has been retired in favour of the WebSocket (Socket.IO) chat
 * pipeline, which provides:
 *   - Real-time streaming (chunk-by-chunk)
 *   - Long-term memory retrieval
 *   - RAG from uploaded documents
 *   - Vision (image) analysis
 *   - n8n smart-action triggers
 *
 * Clients must connect via Socket.IO and emit the `chat_message` event.
 * See server.js for the full WebSocket implementation.
 */
router.post("/send", (req, res) => {
  return res.status(410).json({
    error: "This endpoint is deprecated. Please use the Socket.IO WebSocket connection for real-time chat.",
    instructions: "Connect via socket.io-client, emit 'authenticate' with your JWT, then emit 'chat_message'.",
  });
});

/**
 * POST /chat/transcribe
 * Upload an audio file and transcribe it using Groq Whisper
 */
router.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided." });
    }
    
    const newPath = req.file.path + ".webm";
    fs.renameSync(req.file.path, newPath);
    
    // Call Whisper service
    const result = await transcribeAudio(newPath, "en");
    
    // Clean up temporary audio file
    fs.unlinkSync(newPath);
    
    res.json({ text: result.text });
  } catch (err) {
    console.error("Transcribe error:", err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: "Failed to transcribe audio." });
  }
});

/**
 * POST /chat/tts
 * Text-to-Speech — NOTE: ElevenLabs integration is currently disabled.
 * The frontend uses the native Web Speech API (window.speechSynthesis) instead.
 * To re-enable, update the ELEVENLABS_API_KEY with 'text_to_speech' permissions.
 */
router.post("/tts", async (req, res) => {
  return res.status(503).json({
    error: "ElevenLabs TTS is currently disabled. The application uses native browser speech synthesis.",
    fallback: "Use window.speechSynthesis in the frontend for text-to-speech."
  });
});

module.exports = router;
