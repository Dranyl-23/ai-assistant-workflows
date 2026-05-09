const Groq = require("groq-sdk");

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const DEFAULT_MODEL = "llama-3.1-8b-instant";
const VISION_MODEL = "llama-3.2-90b-vision-preview";

const SYSTEM_PROMPT = `You are "Antigravity", an elite AI Assistant and Productivity Strategist. You are the brains behind this all-in-one workflow platform.

CRITICAL RULE — ALWAYS RESPOND: You MUST reply to every single message the user sends. NEVER output "[IGNORED]", "[SKIP]", or any similar refusal token. For greetings like "hi", "hello", "hey" — respond warmly and naturally. Silence or placeholder tokens are NEVER acceptable.

Your core mission:
- Don't just answer questions—solve problems and anticipate needs.
- Provide direct, accurate, and insightful answers based on the current user query and available context.
- You have access to Web Search, Document Analysis, and App Integrations. Mention these tools when they add value.
- VISION: If an image is provided, analyze it thoroughly and answer questions related to it.
- LANGUAGE: Always reply in the same language the user uses (e.g., natural Bisaya/Cebuano).
- MEMORY: Save important user facts using [SAVE_MEMORY: fact].
- ACTIONS: CRITICAL OUTPUT FORMAT — When asked to do something on GitHub, Slack, Gmail, etc., YOU MUST DO IT FOR THEM BY OUTPUTTING THE ACTION TAG. Do NOT give them instructions on how to do it themselves!
  You must output this exact tag format:
  [ACTION: provider, action_name, {"key": "value"}]
  
  EXAMPLES (copy these formats exactly):
    GitHub issue → [ACTION: github, create_issue, {"title": "My Bug", "body": "Description here"}]
    Slack message → [ACTION: slack, send_message, {"message": "Hello team", "channel": "#general"}]
    Discord message → [ACTION: discord, send_message, {"content": "Hello from AI!"}]
    
  RULE: Always place the [ACTION:] tag at the very end of your response!`;

/**
 * Format messages for Multi-modal (Vision) or standard text
 */
function formatMessages(messages, imageBase64 = null) {
  if (!imageBase64) return messages;

  // For vision models, the last user message must contain the image
  const formatted = [...messages];
  const lastMsg = formatted[formatted.length - 1];

  if (lastMsg && lastMsg.role === "user") {
    lastMsg.content = [
      { type: "text", text: lastMsg.content || "Analyze this image." },
      {
        type: "image_url",
        image_url: { url: imageBase64 }
      }
    ];
  }

  return formatted;
}

/**
 * Send a message to Groq
 */
async function sendMessage(messages, imageBase64 = null) {
  const model = imageBase64 ? VISION_MODEL : DEFAULT_MODEL;
  const formattedMessages = formatMessages(messages, imageBase64);

  const response = await groq.chat.completions.create({
    model,
    max_tokens: 4096,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      ...formattedMessages,
    ],
  });

  return response.choices[0].message.content;
}

/**
 * Stream a message from Groq
 */
async function streamMessage(messages, onChunk, imageBase64 = null, customModel = null) {
  const model = imageBase64 ? VISION_MODEL : (customModel || DEFAULT_MODEL);
  const formattedMessages = formatMessages(messages, imageBase64);
  let fullText = "";

  try {
    const stream = await groq.chat.completions.create({
      model,
      max_tokens: 4096,
      stream: true,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...formattedMessages,
      ],
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || "";
      if (content) {
        fullText += content;
        if (onChunk) onChunk(content);
      }
    }
  } catch (error) {
    console.error("[Groq] Stream Error:", error.message);

    // Only show the vision notice if it's actually a vision-related error
    if (imageBase64 && (error.message.includes("model_decommissioned") || error.message.includes("vision"))) {
      const visionNotice = "\n\n* System Notice: Groq has temporarily removed Vision (Image Analysis) capabilities from your current API tier. Please ask text-based questions instead while we wait for them to restore access.*";
      fullText += visionNotice;
      if (onChunk) onChunk(visionNotice);
    } else {
      const generalError = `\n\n* [System Error]: ${error.message} *`;
      fullText += generalError;
      if (onChunk) onChunk(generalError);
    }
  }

  return fullText;
}

async function generateTitle(userMessage) {
  const response = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    max_tokens: 50,
    messages: [
      {
        role: "system",
        content: "Generate a very short title (3-6 words) for a conversation. Return ONLY the title.",
      },
      { role: "user", content: userMessage },
    ],
  });

  return (response.choices[0]?.message?.content || "New Chat").replace(/["*#]/g, "").trim();
}

module.exports = { sendMessage, streamMessage, generateTitle };
