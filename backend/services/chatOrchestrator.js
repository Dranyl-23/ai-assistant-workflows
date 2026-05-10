/**
 * chatOrchestrator.js
 * -------------------
 * Handles the full lifecycle of a single chat_message WebSocket event:
 *   1. Subscription / usage enforcement (server-side, tamper-proof)
 *   2. Conversation creation or resumption
 *   3. Prior history retrieval
 *   4. Long-term memory + integration context loading
 *   5. RAG (pgvector document retrieval)
 *   6. Web search (heuristic-gated)
 *   7. LLM streaming via Groq
 *   8. Memory save, n8n action dispatch, DB persistence
 *
 * Extracted from server.js to keep the main entry point clean and to give
 * each step its own error boundary instead of one giant catch block.
 */

const { v4: uuidv4 } = require("uuid");
const { supabaseAdmin } = require("../config/supabase");
const groqService = require("./groq");
const searchService = require("./search");
const n8nService = require("./n8n");
const { generateEmbedding } = require("./embeddings");

// ─── Constants ────────────────────────────────────────────────────────────────

const FREE_PLAN_LIMIT = 50;

/**
 * Regex that matches ACTION tags the AI can emit.
 * Handles: [ACTION: provider, action, {...}]
 *          [GITHUB: action, {...}]  (legacy shorthand)
 */
const ACTION_REGEX =
  /\[(ACTION|GITHUB|DISCORD|SLACK|NOTION|TASK_EXTRACTOR|EMAIL_ASSISTANT|VOICE)\s*:?\s*([^,\]]+)?\s*,?\s*([^,\]]+),\s*(\{[\s\S]*?\})\s*\]/i;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Safely parse JSON produced by the LLM.
 * Falls back to replacing single-quotes with double-quotes when standard
 * JSON.parse fails (the model sometimes outputs malformed JSON).
 *
 * @param {string} raw - Raw JSON string from the LLM action tag
 * @returns {Object} Parsed object, or {} on failure
 */
function safeParseActionData(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      const fixed = raw
        .replace(/'/g, '"')
        .replace(/(\w+):/g, '"$1":');
      return JSON.parse(fixed);
    } catch (fixErr) {
      console.error("[Orchestrator] Failed to parse action data:", fixErr.message, "Raw:", raw);
      return {};
    }
  }
}

/**
 * Count total user messages for this user via a single safe Postgres RPC call.
 * Uses the get_user_message_count() SQL function (see supabase_pgvector_migration.sql).
 * No application-side string building — zero SQL injection risk.
 *
 * @param {string} userId
 * @returns {number}
 */
async function getUserMessageCount(userId) {
  const { data, error } = await supabaseAdmin.rpc("get_user_message_count", {
    p_user_id: userId,
  });

  if (error) {
    console.error("[Orchestrator] Message count RPC error:", error.message);
    return 0; // Fail-open: don't block the user if counting fails
  }

  return Number(data) || 0;
}

// ─── Step implementations ─────────────────────────────────────────────────────

/**
 * STEP 1 – Enforce usage limits.
 * Returns true if the user is allowed to send a message.
 */
async function enforceUsageLimit(socket, userId) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("plan")
    .eq("id", userId)
    .single();

  const plan = profile?.plan || "free";
  if (plan !== "free") return { allowed: true, plan }; // Pro/enterprise — no limit

  const count = await getUserMessageCount(userId);
  if (count >= FREE_PLAN_LIMIT) {
    socket.emit("chat_error", {
      error: "Usage limit reached",
      message: `You have reached the limit of ${FREE_PLAN_LIMIT} messages for the Free plan. Please upgrade to Pro in Settings for unlimited access.`,
    });
    return { allowed: false, plan };
  }
  return { allowed: true, plan };
}

/**
 * STEP 2 – Create a new conversation if needed; return the conversation ID.
 */
async function ensureConversation(socket, userId, convId, firstMessage) {
  if (convId) return convId;

  const newId = uuidv4();
  const title = await groqService.generateTitle(firstMessage);

  await supabaseAdmin.from("conversations").insert({
    id: newId,
    user_id: userId,
    title,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  socket.emit("conversation_created", { id: newId, title });
  return newId;
}

/**
 * STEP 3 – Fetch the last 9 messages for context (before saving the current one).
 */
async function fetchHistory(convId) {
  const { data: history } = await supabaseAdmin
    .from("messages")
    .select("role, content")
    .eq("conversation_id", convId)
    .order("created_at", { ascending: true })
    .limit(9);
  return history || [];
}

/**
 * STEP 4 – Load long-term memories + integration context strings.
 * Returns { memoryContext, integrationContext } strings ready to inject.
 */
async function loadPersonalisationContext(userId) {
  let memoryContext = "";
  let integrationContext = "";

  try {
    const { data: memories } = await supabaseAdmin
      .from("user_memories")
      .select("fact")
      .eq("user_id", userId);

    if (memories && memories.length > 0) {
      memoryContext =
        `[YOUR LONG-TERM MEMORY OF THIS USER]\n` +
        memories.map((m) => `- ${m.fact}`).join("\n") +
        `\n\nINSTRUCTION: Use these facts to personalise your response and avoid asking things you already know.`;
      console.log(`[Orchestrator] Loaded ${memories.length} memories.`);
    }

    const { data: apps } = await supabaseAdmin
      .from("integrations")
      .select("provider")
      .eq("user_id", userId);

    if (apps && apps.length > 0) {
      const actualApps = apps.filter((a) => a.provider !== "n8n");
      if (actualApps.length > 0) {
        const appList = actualApps.map((a) => a.provider).join(", ");
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
        console.log(`[Orchestrator] Found ${actualApps.length} actionable apps.`);
      }
    }
  } catch (err) {
    console.error("[Orchestrator] Personalisation context error:", err.message);
  }

  return { memoryContext, integrationContext };
}

/**
 * STEP 5 – RAG: vector-search document chunks relevant to the user's message.
 * Returns a ready-to-inject documentContext string.
 */
async function buildDocumentContext(userId, message) {
  let documentContext = "";

  try {
    // Lightweight index: only id + name (NOT full content)
    const { data: allDocs } = await supabaseAdmin
      .from("documents")
      .select("id, name")
      .eq("user_id", userId);

    if (!allDocs || allDocs.length === 0) return "";

    const docIndex = allDocs.map((d, i) => `[${i + 1}] ${d.name}`).join("\n");

    // Vector similarity search
    console.log(`[Orchestrator] Generating query embedding for RAG...`);
    const queryEmbedding = await generateEmbedding(message);

    const { data: matchedChunks, error: rpcError } = await supabaseAdmin.rpc(
      "match_document_chunks",
      {
        query_embedding: `[${queryEmbedding.join(",")}]`,
        match_threshold: 0.3,
        match_count: 5,
        p_user_id: userId,
      }
    );

    if (rpcError) throw rpcError;

    if (matchedChunks && matchedChunks.length > 0) {
      const chunksContent = matchedChunks
        .map(
          (chunk, i) =>
            `--- Chunk ${i + 1} (Similarity: ${(chunk.similarity * 100).toFixed(1)}%) ---\n${chunk.chunk_text}`
        )
        .join("\n\n");

      documentContext = `[YOUR KNOWLEDGE BASE — RELEVANT EXCERPTS]\nThe following text chunks are the most relevant parts of the user's uploaded documents. Use them to answer the user's question if applicable:\n\n${chunksContent}`;
      console.log(`[Orchestrator] Injected ${matchedChunks.length} vector chunks.`);
    } else {
      documentContext = `[YOUR KNOWLEDGE BASE — INDEX ONLY]\nThe user has uploaded these files. Mention them if relevant but do not fabricate their content.\n${docIndex}`;
      console.log(`[Orchestrator] No chunks matched threshold. Doc index only.`);
    }
  } catch (err) {
    console.error("[Orchestrator] RAG error:", err.message);
    documentContext = ""; // Non-fatal: proceed without doc context
  }

  return documentContext;
}

/**
 * STEP 6 – Web search (heuristic-gated to avoid wasteful LLM classification calls).
 * Returns a ready-to-inject searchContext string.
 */
async function buildSearchContext(socket, message) {
  // Heuristic keywords that strongly imply real-time information need
  const REALTIME_KEYWORDS = [
    "latest", "recent", "today", "current", "now", "news", "update",
    "price", "weather", "score", "trending", "2024", "2025", "2026",
  ];

  // Greetings that definitely don't need search
  const GREETINGS = ["hi", "hello", "hey", "good morning", "good afternoon", "good evening", "what's up"];

  const lower = message.toLowerCase();

  if (GREETINGS.some((g) => lower.includes(g))) {
    return { searchContext: "", searchResults: null };
  }

  const needsSearch = REALTIME_KEYWORDS.some((kw) => lower.includes(kw));

  if (!needsSearch) {
    console.log(`[Orchestrator] Search skipped (no realtime keywords): "${message}"`);
    return { searchContext: "", searchResults: null };
  }

  socket.emit("status", { message: "Searching the web for real-time info..." });

  let searchQuery = message;

  // If the message contains non-ASCII (e.g. Cebuano/Filipino) translate first
  if (/[^\x00-\x7F]/.test(message)) {
    try {
      const translated = await groqService.sendMessage([
        {
          role: "system",
          content:
            "Translate the following user question into a concise English search query for DuckDuckGo. Return ONLY the search query text.",
        },
        { role: "user", content: message },
      ]);
      searchQuery = translated.replace(/['"]/g, "").trim();
      console.log(`[Orchestrator] Translated search query: "${searchQuery}"`);
    } catch {
      console.warn("[Orchestrator] Query translation failed — using original.");
    }
  }

  const searchResults = await searchService.search(searchQuery);

  if (
    searchResults?.results &&
    Array.isArray(searchResults.results) &&
    searchResults.results.length > 0
  ) {
    console.log(`[Orchestrator] Found ${searchResults.results.length} search results.`);
    socket.emit("status", { message: "Information found! Generating response..." });

    const searchContext =
      `[REAL-TIME WEB SEARCH RESULTS]\nQuery: ${message}\n\n` +
      searchResults.results
        .filter((r) => r && typeof r === "object")
        .map(
          (r) =>
            `SOURCE: ${r.title || "Unknown"}\nURL: ${r.url || "#"}\nCONTENT: ${r.content || "No content"}`
        )
        .join("\n---\n");

    return { searchContext, searchResults };
  }

  console.warn(`[Orchestrator] No search results found for: "${searchQuery}"`);
  socket.emit("status", { message: "No results found. Answering from knowledge base..." });
  return {
    searchContext: `[WEB SEARCH STATUS]\nNo relevant real-time information was found for "${message}".`,
    searchResults: null,
  };
}

/**
 * STEP 7 – Assemble the full context message array for the LLM.
 */
function buildContextMessages(history, message, memoryContext, integrationContext) {
  const systemContent = [
    `You are Antigravity, a Senior Fullstack Engineer and AI Orchestrator.
Your responses are concise, direct, and technically accurate.
- For greetings and casual chat: respond naturally and warmly — do NOT output [IGNORED].
- For technical questions: give expert, well-structured answers.
- For action requests (code generation, email, GitHub, Discord, tasks): delegate using the [ACTION:] tag.`,

    memoryContext || "",
    integrationContext || "",

    `### DELEGATION PROTOCOL:
When the user requests a task that maps to a provider, append this EXACT tag at the end of your response:
[ACTION: provider, action, {"key": "value"}]

### PROVIDERS:
- custom_agent (agentName: 'coder', 'researcher', or 'summarizer')
- task_extractor, email_assistant, document_qa, github, discord.

### CONSTRAINTS:
1. Respond to ALL messages — never output [IGNORED] or skip a reply.
2. ALWAYS use DOUBLE QUOTES for JSON keys and values in action tags.
3. If search/doc context is provided, use it only as background reference.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return [
    { role: "system", content: systemContent },
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];
}

/**
 * STEP 8 – Process memory saves detected in the AI's response.
 */
async function processSaveMemory(fullResponse, userId) {
  if (!fullResponse.includes("[SAVE_MEMORY:")) return;

  const match = fullResponse.match(/\[SAVE_MEMORY:\s*(.*?)\]/);
  if (match && match[1]) {
    const fact = match[1].trim();
    console.log(`[Orchestrator] Saving memory: "${fact}"`);
    try {
      await supabaseAdmin.from("user_memories").insert({
        user_id: userId,
        fact,
        category: "general",
      });
    } catch (err) {
      console.error("[Orchestrator] Memory save failed:", err.message);
    }
  }
}

/**
 * STEP 9 – Detect and dispatch n8n action tags from the AI's response.
 * Streams an inline feedback chunk back to the user.
 * @returns {string} The full response (possibly appended with feedback)
 */
async function processActions(socket, fullResponse, userId) {
  if (!ACTION_REGEX.test(fullResponse)) return fullResponse;

  const actionMatch = fullResponse.match(ACTION_REGEX);
  if (!actionMatch) return fullResponse;

  let provider = (actionMatch[2] || actionMatch[1]).trim().toLowerCase();
  const action = actionMatch[3].trim();
  const data = safeParseActionData(actionMatch[4].trim());

  console.log(`[Orchestrator] Triggering action: ${provider}:${action}`);

  try {
    const result = await n8nService.triggerSmartAction(provider, action, data, userId);
    console.log(`[Orchestrator] n8n success:`, result);

    // Log the success
    await supabaseAdmin.from("action_logs").insert({
      user_id: userId,
      provider,
      action,
      status: "success",
      details: { input: data, output: result },
    }).catch(e => console.error("[Orchestrator] Failed to log action:", e.message));

    let feedback = "";
    if (provider === "task_extractor" && result.tasks) {
      feedback =
        `[SYSTEM: Tasks Extracted]\n` +
        result.tasks.map((t) => `- **${t.title}**: ${t.description}`).join("\n");
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
      const feedbackChunk = `\n\n---\n${feedback}`;
      socket.emit("stream_chunk", { chunk: feedbackChunk });
      return fullResponse + feedbackChunk;
    }
  } catch (actionErr) {
    console.error("[Orchestrator] n8n trigger failed:", actionErr.message);
    
    // Log the error
    await supabaseAdmin.from("action_logs").insert({
      user_id: userId,
      provider,
      action,
      status: "error",
      details: { input: data, error: actionErr.message },
    }).catch(e => console.error("[Orchestrator] Failed to log error action:", e.message));

    const errChunk = `\n\n---\n[SYSTEM ERROR: Action failed: ${actionErr.message}]`;
    socket.emit("stream_chunk", { chunk: errChunk });
    return fullResponse + errChunk;
  }

  return fullResponse;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * handleChatMessage — main entry point called by the Socket.IO event handler.
 *
 * @param {Object} socket  - Authenticated Socket.IO socket (socket.userId must be set)
 * @param {Object} data    - Event payload: { message, conversation_id, web_search, image, model }
 */
async function handleChatMessage(socket, data) {
  let { message, conversation_id, image, model } = data;
  const userId = socket.userId;

  // ── Step 1: Usage enforcement ──────────────────────────────────────────────
  const { allowed, plan } = await enforceUsageLimit(socket, userId);
  if (!allowed) return;

  // ── Step 1.5: Model enforcement ───────────────────────────────────────────
  if (plan === "free" && model && model.includes("70b")) {
    console.log(`[Orchestrator] Forcing 8B model for free user ${userId}`);
    model = "llama-3.1-8b-instant";
  }

  // ── Step 2: Conversation ───────────────────────────────────────────────────
  let convId;
  try {
    convId = await ensureConversation(socket, userId, conversation_id, message);
  } catch (err) {
    console.error("[Orchestrator] Conversation setup failed:", err.message);
    socket.emit("chat_error", { error: "Failed to initialise conversation." });
    return;
  }

  // ── Step 3: Prior history ──────────────────────────────────────────────────
  const history = await fetchHistory(convId);

  // ── Step 4: Save user message ──────────────────────────────────────────────
  try {
    await supabaseAdmin.from("messages").insert({
      id: uuidv4(),
      conversation_id: convId,
      role: "user",
      content: message,
      metadata: image ? { image } : null,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[Orchestrator] Failed to save user message:", err.message);
    // Non-fatal: continue so the user still gets a response
  }

  // ── Step 5: Personalisation (memories + integrations) ─────────────────────
  const { memoryContext, integrationContext } = await loadPersonalisationContext(userId);

  // ── Step 6: Build base context messages ───────────────────────────────────
  let contextMessages = buildContextMessages(history, message, memoryContext, integrationContext);

  // ── Emit stream start ──────────────────────────────────────────────────────
  socket.emit("stream_start", { conversation_id: convId });

  if (image) {
    socket.emit("status", { message: "Analysing image with Vision AI..." });
  }

  // ── Steps 7 & 8: RAG + Search (only for text messages) ────────────────────
  if (!image) {
    try {
      const documentContext = await buildDocumentContext(userId, message);
      const { searchContext, searchResults: _results } = await buildSearchContext(socket, message);

      // Append document + search context to the last user turn
      const lastMsg = contextMessages.pop();
      contextMessages.push({
        role: "user",
        content:
          `${documentContext}\n\n${searchContext}\n\n[USER QUESTION]\n${lastMsg.content}\n\n---\n` +
          `[STRICT ACTION LOOKUP TABLE]\n` +
          `- For CODING: [ACTION: custom_agent, run, {"agentName": "coder", "input": "..."}]\n` +
          `- For RESEARCH: [ACTION: custom_agent, run, {"agentName": "researcher", "input": "..."}]\n` +
          `- For TASKS: [ACTION: task_extractor, extract, {"text": "..."}]\n` +
          `- For EMAIL: [ACTION: email_assistant, draft, {"prompt": "..."}]\n` +
          `- For DISCORD: [ACTION: discord, send_message, {"content": "..."}]\n\n` +
          `### CONSTRAINTS:\n1. ONLY USE THE PROVIDERS LISTED ABOVE.\n2. DO NOT INVENT NEW PROVIDERS.\n3. RESPOND IN ENGLISH. NO FILLER.`,
      });
    } catch (contextErr) {
      console.error("[Orchestrator] Context build error:", contextErr.message);
      socket.emit("status", { message: "Knowledge retrieval failed. Answering directly..." });
    }
  }

  // ── Step 9: LLM Streaming ──────────────────────────────────────────────────
  let fullResponse = "";
  try {
    fullResponse = await groqService.streamMessage(
      contextMessages,
      (chunk) => socket.emit("stream_chunk", { chunk }),
      image,
      model
    );
  } catch (llmErr) {
    console.error("[Orchestrator] LLM stream error:", llmErr.message);
    socket.emit("chat_error", { error: "AI failed to respond. Please try again." });
    return;
  }

  // ── Step 10: Post-response processing ─────────────────────────────────────
  await processSaveMemory(fullResponse, userId);
  fullResponse = await processActions(socket, fullResponse, userId);

  // ── Step 11: Persist AI response ──────────────────────────────────────────
  let aiMsgId;
  try {
    aiMsgId = uuidv4();
    await supabaseAdmin.from("messages").insert({
      id: aiMsgId,
      conversation_id: convId,
      role: "assistant",
      content: fullResponse,
      created_at: new Date().toISOString(),
    });

    await supabaseAdmin
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", convId);
  } catch (dbErr) {
    console.error("[Orchestrator] Failed to persist AI response:", dbErr.message);
    // Non-fatal: user already received the streamed response
  }

  // ── Step 12: Finalise ──────────────────────────────────────────────────────
  socket.emit("stream_end", {
    conversation_id: convId,
    message: { id: aiMsgId, role: "assistant", content: fullResponse },
  });
}

module.exports = { handleChatMessage, getUserMessageCount };
