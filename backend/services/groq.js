/**
 * groq.js — Groq LLM Service
 *
 * Design contract (IMPORTANT):
 * ─────────────────────────────
 * sendMessage() and streamMessage() are PURE message-passing functions.
 * They do NOT inject any system prompt of their own.
 *
 * The CALLER is responsible for providing the complete messages array,
 * including any system message as messages[0].
 *
 * This eliminates the "duplicate system prompt" bug where the orchestrator's
 * carefully built system message was overridden by a second SYSTEM_PROMPT
 * injected inside these functions, causing the model to receive two conflicting
 * system messages.
 *
 * Utility functions (generateTitle, helper queries) build their own minimal
 * system messages inline — they do not use a shared constant.
 */

const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const DEFAULT_MODEL = "llama-3.1-8b-instant";
const VISION_MODEL  = "llama-3.2-90b-vision-preview";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format messages for vision (multimodal) or standard text.
 * When an image is provided, rewrites the last user message to include
 * the base64 image in the format required by Groq's vision API.
 *
 * @param {Array}       messages     - Full conversation messages array
 * @param {string|null} imageBase64  - Base64-encoded image (data URL)
 * @returns {Array} Formatted messages
 */
function formatMessages(messages, imageBase64 = null) {
  if (!imageBase64) return messages;

  const formatted = messages.map((m) => ({ ...m })); // shallow clone
  const lastMsg = formatted[formatted.length - 1];

  if (lastMsg && lastMsg.role === "user") {
    lastMsg.content = [
      { type: "text", text: lastMsg.content || "Analyze this image." },
      { type: "image_url", image_url: { url: imageBase64 } },
    ];
  }

  return formatted;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send a single (non-streaming) request to Groq.
 *
 * The caller MUST include a system message as the first element of `messages`
 * if one is needed. This function passes messages as-is to the API.
 *
 * @param {Array}       messages    - Full messages array (caller owns system prompt)
 * @param {string|null} imageBase64 - Optional image for vision requests
 * @returns {string} Model response text
 */
async function sendMessage(messages, imageBase64 = null) {
  const model = imageBase64 ? VISION_MODEL : DEFAULT_MODEL;
  const formattedMessages = formatMessages(messages, imageBase64);

  const response = await groq.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: formattedMessages, // caller provides system message — no duplication
  });

  return response.choices[0].message.content;
}

/**
 * Stream a response from Groq, calling onChunk for each token.
 *
 * The caller MUST include a system message as the first element of `messages`.
 * The chatOrchestrator builds the full, context-rich system message and passes
 * it here — this function does not add anything on top.
 *
 * @param {Array}       messages    - Full messages array (caller owns system prompt)
 * @param {Function}    onChunk     - Called with each streamed text chunk
 * @param {string|null} imageBase64 - Optional image for vision requests
 * @param {string|null} customModel - Override the default model
 * @returns {string} Complete response text (concatenation of all chunks)
 */
async function streamMessage(messages, onChunk, imageBase64 = null, customModel = null, signal = null) {
  const model = imageBase64 ? VISION_MODEL : (customModel || DEFAULT_MODEL);
  const formattedMessages = formatMessages(messages, imageBase64);
  let fullText = "";

  try {
    const stream = await groq.chat.completions.create(
      {
        model,
        max_tokens: 4096,
        stream: true,
        messages: formattedMessages, // caller provides system message — no duplication
      },
      // BUG 1 FIX: Forward the AbortSignal so the 35-second orchestrator timeout
      // actually cancels the in-flight Groq request.
      signal ? { signal } : undefined
    );

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullText += content;
        if (onChunk) onChunk(content);
      }
    }
  } catch (error) {
    console.error("[Groq] Stream error:", error.message);

    // BUG 2 FIX: Non-fatal vision fallback — give the user a graceful notice
    // and return the partial text collected so far.
    if (imageBase64 && (error.message.includes("model_decommissioned") || error.message.includes("vision"))) {
      const notice =
        "\n\n*System Notice: Groq's Vision model is temporarily unavailable on your API tier. " +
        "Please ask text-based questions while access is restored.*";
      fullText += notice;
      if (onChunk) onChunk(notice);
      return fullText;
    }

    // BUG 2 FIX: Fatal error — re-throw so the orchestrator's catch block fires
    // and emits `chat_error`. This prevents error text from being persisted to
    // the DB as if it were a valid AI message.
    throw error;
  }

  return fullText;
}

/**
 * Generate a short conversation title from the user's first message.
 * Uses its own inline system prompt — does NOT share the chat system prompt.
 *
 * @param {string} userMessage
 * @returns {string} 3-6 word title
 */
async function generateTitle(userMessage) {
  const response = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    max_tokens: 50,
    messages: [
      {
        role: "system",
        content: "Generate a very short title (3-6 words) for a conversation. Return ONLY the title, no quotes or punctuation.",
      },
      { role: "user", content: userMessage },
    ],
  });

  return (response.choices[0]?.message?.content || "New Chat")
    .replace(/[\"*#\n]/g, "")
    .trim();
}

module.exports = { sendMessage, streamMessage, generateTitle };
