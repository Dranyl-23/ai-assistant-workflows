const N8N_BASE_URL = process.env.N8N_BASE_URL || "http://localhost:5678";

async function triggerWorkflow(webhookPath, payload, n8nConfig = null) {
  // Use user's personal n8n config if provided, else fallback to system
  let baseUrl = n8nConfig?.baseUrl || process.env.N8N_BASE_URL || "http://localhost:5678";
  
  // Clean trailing slashes to prevent double-slash in URL (e.g., //webhook)
  if (baseUrl.endsWith('/')) {
    baseUrl = baseUrl.slice(0, -1);
  }

  const apiKey = n8nConfig?.apiKey || process.env.N8N_API_KEY;

  const url = `${baseUrl}/webhook/${webhookPath}`;

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    // Some versions of n8n use X-N8N-API-KEY instead
    headers["X-N8N-API-KEY"] = apiKey;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`n8n workflow error: ${error}`);
  }

  const textResponse = await response.text();
  try {
    return textResponse ? JSON.parse(textResponse) : { success: true };
  } catch (e) {
    return { success: true, message: textResponse };
  }
}

/**
 * Trigger the AI chat workflow in n8n
 * @param {string} message - User message
 * @param {string} userId - User ID
 * @param {string} conversationId - Conversation ID
 * @returns {Object} AI response from n8n workflow
 */
async function triggerAIChat(message, userId, conversationId) {
  return triggerWorkflow("ai-chat", {
    message,
    userId,
    conversationId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Trigger the document Q&A workflow in n8n
 * @param {string} question - User question
 * @param {string} documentId - Document ID
 * @param {string} userId - User ID
 * @returns {Object} Answer from n8n workflow
 */
async function triggerDocumentQA(question, documentId, userId) {
  return triggerWorkflow("document-qa", {
    question,
    documentId,
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Trigger the email assistant workflow in n8n
 * @param {Object} emailData - Email composition data
 * @param {string} userId - User ID
 * @returns {Object} Drafted email from n8n workflow
 */
async function triggerEmailAssistant(emailData, userId) {
  return triggerWorkflow("email-assistant", {
    ...emailData,
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Trigger the task extractor workflow in n8n
 * @param {string} text - Text to extract tasks from
 * @param {string} userId - User ID
 * @returns {Object} Extracted tasks from n8n workflow
 */
async function triggerTaskExtractor(text, userId) {
  return triggerWorkflow("task-extractor", {
    text,
    userId,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Trigger a smart action in n8n, routing to the correct webhook per provider.
 * Each provider maps to its own dedicated n8n workflow webhook path.
 * This enables clean per-provider workflows instead of one monolithic handler.
 *
 * @param {string} provider - The app to target (slack, notion, gmail, calendar, etc.)
 * @param {string} action   - The action to perform (send_message, create_page, etc.)
 * @param {Object} data     - The data for the action
 * @param {string} userId   - User ID
 * @returns {Object} n8n response
 */
async function triggerSmartAction(provider, action, data, userId) {
  // Map each provider to its dedicated n8n webhook path.
  // Add new providers here as new n8n workflows are created.
  const PROVIDER_WEBHOOK_MAP = {
    slack:    "slack-action",
    notion:   "notion-action",
    gmail:    "gmail-action",
    calendar: "calendar-action",
    github:   "github-action",
    trello:   "trello-action",
    asana:    "asana-action",
    discord:  "discord-action",
    task_extractor: "task-extractor",
    email_assistant: "email-assistant",
    document_qa: "document-qa",
    voice: "voice",
    ai_chat: "ai-chat",
    custom_agent: "custom-agent",
  };

  const webhookPath = PROVIDER_WEBHOOK_MAP[provider.toLowerCase()] || "smart-action";

  if (!PROVIDER_WEBHOOK_MAP[provider.toLowerCase()]) {
    console.warn(`[n8n] Unknown provider "${provider}". Falling back to generic "smart-action" webhook.`);
  }

  // 1. Fetch the user's specific credentials for both the target app AND their personal n8n instance
  const { supabaseAdmin } = require("../config/supabase");
  
  const [appIntegration, n8nIntegration] = await Promise.all([
    supabaseAdmin.from("integrations").select("config").eq("user_id", userId).eq("provider", provider.toLowerCase()).single(),
    supabaseAdmin.from("integrations").select("config").eq("user_id", userId).eq("provider", "n8n").single()
  ]);

  const userConfig = appIntegration.data?.config || {};
  const n8nConfig = n8nIntegration.data?.config || null;

  // 2. Pass those credentials to n8n in the payload
  return triggerWorkflow(webhookPath, {
    provider,
    action,
    ...data, // Spread data fields (like 'text') to root for easier access in n8n
    data,    // Keep 'data' key for backward compatibility
    userId,
    credentials: userConfig, // REAL CREDENTIALS PASSED TO N8N
    timestamp: new Date().toISOString(),
  }, n8nConfig);
}

module.exports = {
  triggerWorkflow,
  triggerAIChat,
  triggerDocumentQA,
  triggerEmailAssistant,
  triggerTaskExtractor,
  triggerSmartAction,
};
