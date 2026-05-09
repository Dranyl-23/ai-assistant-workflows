require("dotenv").config();

const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

// Import routes
const authRoutes = require("./routes/auth");
const chatRoutes = require("./routes/chat");
const documentRoutes = require("./routes/document");
const integrationRoutes = require("./routes/integration");
const memoryRoutes = require("./routes/memory");
const subscriptionRoutes = require("./routes/subscription");
const stripeRoutes = require("./routes/stripe");

// Import services for WebSocket
const groqService = require("./services/groq");
const searchService = require("./services/search");
const { supabase } = require("./config/supabase");
const { supabaseAdmin } = require("./config/supabase");
const { v4: uuidv4 } = require("uuid");
const n8nService = require("./services/n8n");
const { generateEmbedding } = require("./services/embeddings");

const app = express();
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// ============================================
// Middleware
// ============================================
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);
app.use((req, res, next) => {
  if (req.originalUrl === "/api/stripe/webhook") {
    next();
  } else {
    express.json({ limit: "10mb" })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ============================================
// REST API Routes
// ============================================
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      supabase: !!process.env.SUPABASE_URL,
      groq_llm: !!process.env.GROQ_API_KEY,
      groq_stt: !!process.env.GROQ_API_KEY, // Groq Whisper for speech-to-text
      elevenlabs_tts: !!process.env.ELEVENLABS_API_KEY, // Currently disabled
      search: true, // Free DuckDuckGo — no key required
      stripe: !!process.env.STRIPE_SECRET_KEY,
      n8n: !!process.env.N8N_BASE_URL,
    },
  });
});

const { requireAuth } = require("./middleware/auth");

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/documents", requireAuth, documentRoutes);
app.use("/api/integrations", requireAuth, integrationRoutes);
app.use("/api/memories", requireAuth, memoryRoutes);
app.use("/api/subscription", subscriptionRoutes);
app.use("/api/stripe", stripeRoutes);

// ============================================
// WebSocket - Real-time chat streaming
// ============================================
io.on("connection", (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  // Authenticate socket connection
  socket.on("authenticate", async (token) => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        socket.emit("auth_error", { error: "Invalid token" });
        return;
      }
      socket.userId = user.id;
      socket.emit("authenticated", { userId: user.id });
      console.log(`[WS] User authenticated: ${user.id}`);
    } catch (err) {
      socket.emit("auth_error", { error: "Authentication failed" });
    }
  });

  // Stream chat message
  socket.on("chat_message", async (data) => {
    if (!socket.userId) {
      socket.emit("auth_error", { error: "Not authenticated" });
      return;
    }

    const { message, conversation_id, web_search, image, model } = data;
    let convId = conversation_id;

    try {
      // 1. Subscription & Usage Enforcement
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("plan")
        .eq("id", socket.userId)
        .single();
      
      const plan = profile?.plan || "free";
      
      if (plan === "free") {
        // Count total user messages across all conversations
        const { count: userMsgCount } = await supabaseAdmin
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("role", "user")
          .filter("conversation_id", "in", `(${
            (await supabaseAdmin.from("conversations").select("id").eq("user_id", socket.userId))
              .data?.map(c => c.id).join(",") || "''"
          })`);

        if (userMsgCount && userMsgCount >= 50) {
          socket.emit("chat_error", { 
            error: "Usage limit reached", 
            message: "You have reached the limit of 50 messages for the Free plan. Please upgrade to Pro in Settings for unlimited access." 
          });
          return;
        }
      }

      // Create conversation if needed
      if (!convId) {
        convId = uuidv4();
        const title = await groqService.generateTitle(message);
        await supabaseAdmin.from("conversations").insert({
          id: convId, user_id: socket.userId, title,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        socket.emit("conversation_created", { id: convId, title });
      }

      // Get prior conversation history FIRST (before saving current message)
      // This guarantees the current message is never in the DB yet,
      // so we can safely push it at the end without any dedup logic.
      const { data: history } = await supabaseAdmin
        .from("messages").select("role, content")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true }).limit(9); // 9 prior + 1 current = 10

      // Now save the user message to the DB
      await supabaseAdmin.from("messages").insert({
        id: uuidv4(), conversation_id: convId, role: "user",
        content: message,
        metadata: image ? { image } : null,
        created_at: new Date().toISOString(),
      });

      // Build context: prior history + current message appended cleanly
      let contextMessages = [
        ...(history || []).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ];

      // LONG-TERM MEMORY RETRIEVAL
      let memoryContext = "";
      let integrationContext = "";
      try {
        const { data: memories } = await supabaseAdmin
          .from("user_memories")
          .select("fact")
          .eq("user_id", socket.userId);

        if (memories && memories.length > 0) {
          memoryContext = `[YOUR LONG-TERM MEMORY OF THIS USER]\n${memories.map(m => `- ${m.fact}`).join("\n")}\n\nINSTRUCTION: Use these facts to personalize your response and avoid asking things you already know.`;
          console.log(`[WS-Memory] Loaded ${memories.length} memories.`);
        }

        const { data: apps } = await supabaseAdmin
          .from("integrations")
          .select("provider")
          .eq("user_id", socket.userId);

        if (apps && apps.length > 0) {
          const actualApps = apps.filter(a => a.provider !== "n8n");
          if (actualApps.length > 0) {
            const appList = actualApps.map(a => a.provider).join(", ");
            integrationContext = `### AGENTIC OPERATING SYSTEM MODE
You are Antigravity, a proactive AI executor.
CONNECTED APPS: ${appList}

### HOW TO TRIGGER ACTIONS:
To perform tasks, you MUST output the following tag at the end of your response:
[ACTION: provider, action, {"key": "value"}]

### UTILITY SCHEMAS:
- Task Extraction: [ACTION: task_extractor, extract, {"text": "..."}]
- Email Draft: [ACTION: email_assistant, draft, {"context": "...", "tone": "..."}]
- Document QA: [ACTION: document_qa, ask, {"documentText": "...", "question": "..."}]
- Voice: [ACTION: voice, speak, {"text": "..."}] (Use for reading aloud)

### EXTERNAL APPS:
- GitHub: [ACTION: github, create_issue, {"owner": "YOUR_USERNAME", "repo": "...", "title": "...", "body": "..."}]
- Discord: [ACTION: discord, send_message, {"content": "..."}]

### STRICT RULES:
1. ALWAYS use DOUBLE QUOTES for JSON.
2. ALWAYS output the tag if the user asks for an action.
3. Keep the chat conversational but the tags precise.`;
            console.log(`[WS-Integrations] Found ${actualApps.length} actionable apps and utility workflows.`);
          }
        }
      } catch (err) {
        console.error("[WS-Context-Error]:", err);
      }

      // Build the system message — inject memory + integration context so they are
      // actually used by the model (previously they were loaded but silently discarded).
      contextMessages.unshift({
        role: "system",
        content: [
          // Core persona
          `You are Antigravity, a Senior Fullstack Engineer and AI Orchestrator.
Your responses are concise, direct, and technically accurate.
- For greetings and casual chat: respond naturally and warmly — do NOT output [IGNORED].
- For technical questions: give expert, well-structured answers.
- For action requests (code generation, email, GitHub, Discord, tasks): delegate using the [ACTION:] tag.`,

          // Inject long-term memory if available
          memoryContext || "",

          // Inject connected-app capabilities if available
          integrationContext || "",

          // Delegation protocol (always present)
          `### DELEGATION PROTOCOL:
When the user requests a task that maps to a provider, append this EXACT tag at the end of your response:
[ACTION: provider, action, {"key": "value"}]

### PROVIDERS:
- custom_agent (agentName: 'coder', 'researcher', or 'summarizer')
- task_extractor, email_assistant, document_qa, voice, github, discord.

### CONSTRAINTS:
1. Respond to ALL messages — never output [IGNORED] or skip a reply.
2. ALWAYS use DOUBLE QUOTES for JSON keys and values in action tags.
3. If search/doc context is provided, use it only as background reference.`
        ].filter(Boolean).join("\n\n")
      });

      // Start streaming immediately for better UX
      socket.emit("stream_start", { conversation_id: convId });

      if (image) {
        socket.emit("status", { message: "Analyzing image with Vision AI..." });
      }

      // Skip web search if we have an image to keep focus on vision analysis
      let searchResults = null;
      const lowerMsg = message.toLowerCase();
      const greetings = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "what's up", "wassup"];
      const isGreeting = greetings.some(g => lowerMsg.includes(g));
      const actionKeywords = ["agent", "generate", "create", "scrap", "send", "extract", "voice", "speak"];
      if (!image) {
        try {
          // HARDCODED BYPASS: Bypass search for clear action commands
          const isAction = actionKeywords.some(k => lowerMsg.includes(k));

          let needsSearch = false;
          if (!isGreeting && !isAction) {
            socket.emit("status", { message: "Understanding intent..." });
            const searchDecision = await groqService.sendMessage([
              { role: "system", content: "Reply 'YES' ONLY if the user is asking for RECENT news or real-time facts. Reply 'NO' for commands or general questions." },
              { role: "user", content: message }
            ]);
            needsSearch = searchDecision.trim().toUpperCase().includes("YES");
          }

          if (needsSearch) {
            socket.emit("status", { message: "Searching the web for real-time info..." });
            // OPTIMIZATION: Generate an English search query for better global results
            let searchQuery = message;
            if (/[^\x00-\x7F]/.test(message) || message.toLowerCase().includes("kinsa") || message.toLowerCase().includes("unsay")) {
              try {
                const englishQuery = await groqService.sendMessage([
                  { role: "system", content: "Translate the following user question into a concise English search query for DuckDuckGo. Return ONLY the search query text." },
                  { role: "user", content: message }
                ]);
                searchQuery = englishQuery.replace(/["']/g, "").trim();
                console.log(`[WS-Search] Translated query: "${searchQuery}"`);
              } catch (tErr) {
                console.warn("[WS-Search] Translation failed, using original query.");
              }
            }

            console.log(`[WS-Search] Querying: "${searchQuery}"...`);
            searchResults = await searchService.search(searchQuery);
          } else {
            console.log(`[WS-Search] Skipped search for conversational query: "${message}"`);
          }

          // ADVANCED DOCUMENT KNOWLEDGE INTEGRATION (RAG)
          let documentContext = "";
          try {
            // PHASE 1: Always fetch the user's document index (lightweight — names + previews only).
            // This gives the AI awareness of ALL uploaded files on every message.
            const { data: allDocs } = await supabaseAdmin
              .from("documents")
              .select("id, name, content")
              .eq("user_id", socket.userId);

            if (allDocs && allDocs.length > 0) {
              // Build a lightweight index so the AI always knows what files exist
              const docIndex = allDocs
                .map((d, i) => `[${i + 1}] ${d.name} — "${(d.content || "").substring(0, 200).replace(/\n/g, " ")}..."`)
                .join("\n");
              
              // PHASE 2: Use pgvector to find the most relevant chunks instead of dumping full files
              console.log(`[WS-RAG] Generating query embedding for: "${message}"`);
              try {
                // Generate embedding for the user's message
                const queryEmbedding = await generateEmbedding(message);
                
                // Call the Supabase Postgres function to perform vector similarity search
                const { data: matchedChunks, error: rpcError } = await supabaseAdmin.rpc('match_document_chunks', {
                  query_embedding: `[${queryEmbedding.join(",")}]`,
                  match_threshold: 0.3, // Return anything reasonably similar
                  match_count: 5,       // Top 5 chunks
                  p_user_id: socket.userId
                });

                if (rpcError) {
                  console.error("[WS-RAG] RPC Error:", rpcError);
                  throw rpcError;
                }

                if (matchedChunks && matchedChunks.length > 0) {
                  const chunksContent = matchedChunks
                    .map((chunk, i) => `--- Chunk ${i + 1} (Similarity: ${(chunk.similarity * 100).toFixed(1)}%) ---\n${chunk.chunk_text}`)
                    .join("\n\n");

                  documentContext = `[YOUR KNOWLEDGE BASE — RELEVANT EXCERPTS]\nThe following text chunks are the most relevant parts of the user's uploaded documents. Use them to answer the user's question if applicable:\n\n${chunksContent}`;
                  console.log(`[WS-RAG] Injected ${matchedChunks.length} vector chunks into context.`);
                } else {
                  documentContext = `[YOUR KNOWLEDGE BASE — INDEX ONLY]\nThe user has uploaded these files. Mention them if relevant but do not fabricate their content.\n${docIndex}`;
                  console.log(`[WS-RAG] No chunks matched above threshold. Doc index only injected.`);
                }
              } catch (err) {
                console.error("[WS-RAG] Vector search failed, falling back to index only.", err);
                documentContext = `[YOUR KNOWLEDGE BASE — INDEX ONLY]\nThe user has uploaded these files.\n${docIndex}`;
              }
            }
          } catch (docErr) {
            console.error("[WS-RAG-Error]:", docErr);
          }

          let searchContext = "";
          if (searchResults && searchResults.results && Array.isArray(searchResults.results) && searchResults.results.length > 0) {
            console.log(`[WS-Search] Found ${searchResults.results.length} results.`);
            searchContext = `[REAL-TIME WEB SEARCH RESULTS]\nQuery: ${message}\n\n${searchResults.results
              .filter(r => r && typeof r === 'object')
              .map((r) => `SOURCE: ${r.title || "Unknown"}\nURL: ${r.url || "#"}\nCONTENT: ${r.content || "No content"}`)
              .join("\n---\n")}`;
            socket.emit("status", { message: "Information found! Generating response..." });
          } else {
            console.warn(`[WS-Search] No results found.`);
            searchContext = `[WEB SEARCH STATUS]\nNo relevant real-time information was found for "${message}".`;
            socket.emit("status", { message: "No results found. Answering from knowledge base..." });
          }

          // Inject combined context into the last user message
          const lastMsg = contextMessages.pop();
          contextMessages.push({
            role: "user",
            content: `${documentContext}\n\n${searchContext}\n\n[USER QUESTION]\n${lastMsg.content}\n\n---
[STRICT ACTION LOOKUP TABLE]
- For CODING: [ACTION: custom_agent, run, {"agentName": "coder", "input": "..."}]
- For RESEARCH: [ACTION: custom_agent, run, {"agentName": "researcher", "input": "..."}]
- For TASKS: [ACTION: task_extractor, extract, {"text": "..."}]
- For EMAIL: [ACTION: email_assistant, draft, {"prompt": "..."}]
- For VOICE: [ACTION: voice, speak, {"text": "..."}]
- For DISCORD: [ACTION: discord, send_message, {"content": "..."}]

### CONSTRAINTS:
1. ONLY USE THE PROVIDERS LISTED ABOVE.
2. DO NOT INVENT NEW PROVIDERS (e.g., 'none', 'python', 'ai' are invalid).
3. RESPOND IN ENGLISH. NO FILLER.`
          });
        } catch (searchErr) {
          console.error("[WS-Search-Error]:", searchErr);
          socket.emit("status", { message: "Knowledge retrieval failed. Answering directly..." });
        }
      }

      let fullResponse = await groqService.streamMessage(
        contextMessages,
        (chunk) => socket.emit("stream_chunk", { chunk }),
        image,
        model
      );

      // POST-RESPONSE PROCESSING: Save memories if detected
      if (fullResponse.includes("[SAVE_MEMORY:")) {
        const memoryMatch = fullResponse.match(/\[SAVE_MEMORY:\s*(.*?)\]/);
        if (memoryMatch && memoryMatch[1]) {
          const fact = memoryMatch[1].trim();
          console.log(`[WS-Memory] New fact to remember: "${fact}"`);
          try {
            await supabaseAdmin.from("user_memories").insert({
              user_id: socket.userId,
              fact: fact,
              category: "general"
            });
            console.log(`[WS-Memory] Saved to database.`);
          } catch (memSaveErr) {
            console.error("[WS-Memory] Failed to save memory:", memSaveErr);
          }
        }
      }

      // POST-RESPONSE PROCESSING: Trigger n8n actions if detected
      // Flexible regex: handles [ACTION: provider, action, {data}] or [GITHUB: action, {data}]
      const ACTION_REGEX = /\[(ACTION|GITHUB|DISCORD|SLACK|NOTION|TASK_EXTRACTOR|EMAIL_ASSISTANT|VOICE)\s*:?\s*([^,\]]+)?\s*,?\s*([^,\]]+),\s*(\{[\s\S]*?\})\s*\]/i;

      if (ACTION_REGEX.test(fullResponse)) {
        const actionMatch = fullResponse.match(ACTION_REGEX);
        if (actionMatch) {
          let provider = (actionMatch[2] || actionMatch[1]).trim().toLowerCase();
          const action = actionMatch[3].trim();
          let rawData = actionMatch[4].trim();

          console.log(`[WS-Action] Found action: Provider=${provider}, Action=${action}`);
          let data = {};

          try {
            // 1. Try standard JSON parse first
            data = JSON.parse(rawData);
          } catch (e) {
            // 2. If fails, try to fix common AI mistakes (single quotes instead of double)
            try {
              console.log("[WS-Action] Standard JSON parse failed, attempting auto-fix for single quotes...");
              const fixedJson = rawData
                .replace(/'/g, '"') // Replace single quotes with double
                .replace(/(\w+):/g, '"$1":'); // Ensure keys are quoted
              data = JSON.parse(fixedJson);
            } catch (fixErr) {
              console.error("[WS-Action] Failed to parse action data even with auto-fix:", fixErr, "Raw data:", rawData);
            }
          }

          console.log(`[WS-Action] Detected tag type: [${actionMatch[1]}]. Triggering ${provider}:${action} via n8n...`);
          try {
            const result = await n8nService.triggerSmartAction(provider, action, data, socket.userId);
            console.log(`[WS-Action] n8n trigger successful. Result:`, result);

            // WIRE BACK: Send the result to the user in the chat
            let feedback = "";
            if (provider === "task_extractor" && result.tasks) {
              feedback = `[SYSTEM: Tasks Extracted]\n${result.tasks.map(t => `- **${t.title}**: ${t.description}`).join("\n")}`;
            } else if (provider === "email_assistant" && result.draft) {
              feedback = `[SYSTEM: Email Draft Generated]\n\n${result.draft}`;
            } else if (provider === "document_qa" && result.answer) {
              feedback = `[SYSTEM: Document QA Result]\n\n${result.answer}`;
            } else if (provider === "custom_agent" && result.agentResponse) {
              feedback = `[SYSTEM: Custom Agent Response]\n\n${result.agentResponse}`;
            } else if (provider === "voice") {
              feedback = `[SYSTEM: Voice generation triggered successfully. Audio is being processed.]`;
            } else if (result.success || result.status === "success") {
              feedback = `[SYSTEM: ${provider.toUpperCase()} Action Successful]`;
            }

            if (feedback) {
              socket.emit("stream_chunk", { chunk: `\n\n---\n${feedback}` });
              // Save the combined response to DB (this happens later in the code)
              fullResponse += `\n\n---\n${feedback}`;
            }
          } catch (actionErr) {
            console.error("[WS-Action] n8n trigger failed:", actionErr);
            socket.emit("stream_chunk", { chunk: `\n\n---\n[SYSTEM ERROR: Action failed: ${actionErr.message}]` });
          }
        }
      }

      // Save AI response
      const aiMsgId = uuidv4();
      await supabaseAdmin.from("messages").insert({
        id: aiMsgId, conversation_id: convId, role: "assistant",
        content: fullResponse,
        metadata: searchResults ? { web_search: true, sources: searchResults.results } : null,
        created_at: new Date().toISOString(),
      });

      await supabaseAdmin.from("conversations")
        .update({ updated_at: new Date().toISOString() }).eq("id", convId);

      socket.emit("stream_end", {
        conversation_id: convId,
        message: { id: aiMsgId, role: "assistant", content: fullResponse },
      });
    } catch (err) {
      console.error("[WS] Chat error:", err);
      socket.emit("chat_error", { error: "Failed to process message" });
    }
  });

  socket.on("disconnect", () => {
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ============================================
// Error handling
// ============================================
app.use(notFoundHandler);
app.use(errorHandler);

// ============================================
// Start server
// ============================================
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
