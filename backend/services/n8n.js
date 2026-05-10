/**
 * n8n.js — n8n Workflow Trigger Service
 *
 * Security model
 * ──────────────
 * User credentials (GitHub tokens, Discord webhooks, etc.) are stored
 * encrypted in Supabase and are NEVER sent in the n8n webhook payload.
 *
 * Instead, the payload contains a short-lived "credential lookup token"
 * that the n8n workflow can use to fetch its own credentials from the
 * backend's /api/integrations/credentials endpoint (which validates the
 * token server-side before returning any secrets).
 *
 * This means:
 *   • n8n webhook logs never contain real API keys.
 *   • Compromising the n8n instance doesn't expose user secrets.
 *   • Each lookup token is single-use and expires after 5 minutes.
 */

const crypto = require("crypto");

const N8N_BASE_URL = process.env.N8N_BASE_URL || "http://localhost:5678";

// In-memory token store: { token -> { userId, provider, expiresAt } }
// For production at scale, replace with Redis or a DB-backed table.
const _credentialTokens = new Map();

/**
 * Issue a short-lived, single-use credential lookup token.
 * n8n uses this token to fetch the actual credentials from the backend.
 *
 * @param {string} userId
 * @param {string} provider
 * @returns {string} opaque token (32 random hex bytes)
 */
function issueCredentialToken(userId, provider) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

  _credentialTokens.set(token, { userId, provider, expiresAt });

  // Auto-cleanup after expiry to prevent memory leak
  setTimeout(() => _credentialTokens.delete(token), 5 * 60 * 1000 + 1000);

  return token;
}

/**
 * Validate and consume a credential token.
 * Returns the associated { userId, provider } or null if invalid/expired.
 *
 * @param {string} token
 * @returns {{ userId: string, provider: string } | null}
 */
function consumeCredentialToken(token) {
  const entry = _credentialTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _credentialTokens.delete(token);
    return null;
  }

  // Single-use: delete immediately after first successful consumption
  _credentialTokens.delete(token);
  return { userId: entry.userId, provider: entry.provider };
}

// ─── Core HTTP trigger ────────────────────────────────────────────────────────

/**
 * Fire a POST request at an n8n webhook URL.
 *
 * @param {string} webhookPath  - Path relative to N8N_BASE_URL/webhook/
 * @param {Object} payload      - Request body (must NOT contain raw credentials)
 * @param {Object|null} n8nConfig - User's personal n8n instance config { baseUrl, apiKey }
 * @returns {Object} Parsed n8n response
 */
async function triggerWorkflow(webhookPath, payload, n8nConfig = null) {
  let baseUrl = n8nConfig?.baseUrl || N8N_BASE_URL;

  // Normalise: strip trailing slash
  if (baseUrl.endsWith("/")) baseUrl = baseUrl.slice(0, -1);

  const apiKey = n8nConfig?.apiKey || process.env.N8N_API_KEY;
  const url = `${baseUrl}/webhook/${webhookPath}`;

  const headers = { "Content-Type": "application/json" };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
    headers["X-N8N-API-KEY"] = apiKey;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    // Prevent hanging forever if n8n is slow
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`n8n webhook error (${response.status}): ${errText}`);
  }

  const text = await response.text();
  try {
    return text ? JSON.parse(text) : { success: true };
  } catch {
    return { success: true, message: text };
  }
}

// ─── Named workflow triggers ──────────────────────────────────────────────────

async function triggerAIChat(message, userId, conversationId) {
  return triggerWorkflow("ai-chat-with-search", {
    message,
    userId,
    conversationId,
    timestamp: new Date().toISOString(),
  });
}

async function triggerDocumentQA(question, documentId, userId) {
  return triggerWorkflow("document-qa", {
    question,
    documentId,
    userId,
    timestamp: new Date().toISOString(),
  });
}

async function triggerEmailAssistant(emailData, userId) {
  return triggerWorkflow("email-assistant", {
    ...emailData,
    userId,
    timestamp: new Date().toISOString(),
  });
}

async function triggerTaskExtractor(text, userId) {
  return triggerWorkflow("task-extractor", {
    text,
    userId,
    timestamp: new Date().toISOString(),
  });
}

// ─── Smart action router ──────────────────────────────────────────────────────

const PROVIDER_WEBHOOK_MAP = {
  slack: "slack-action",
  notion: "notion-action",
  gmail: "gmail-action",
  calendar: "calendar-action",
  github: "github-action",
  trello: "trello-action",
  asana: "asana-action",
  discord: "discord-action",
  task_extractor: "task-extractor",
  email_assistant: "email-assistant",
  document_qa: "document-qa",
  voice: "voice-synthesizer-free",
  ai_chat: "ai-chat-with-search",
  // AI often uses singular custom_agent, but your n8n workflow is named plural 'custom-agents'.
  // Mapping both to 'custom-agents' for perfect compatibility.
  custom_agent: "custom-agents",
  custom_agents: "custom-agents",
};

/**
 * Route an AI-emitted [ACTION:] tag to the correct n8n webhook.
 *
 * Credential Security Model:
 *   1. We issue a short-lived, single-use credential token.
 *   2. The payload sent to n8n contains ONLY: provider, action, data, userId,
 *      and the credential token — NOT the raw secrets.
 *   3. The n8n workflow should call GET /api/integrations/credentials?token=<token>
 *      to retrieve the actual API key / webhook URL for the provider.
 *      That endpoint validates the token and returns the credential once.
 *
 * @param {string} provider - App to target (github, discord, etc.)
 * @param {string} action   - Action to perform (send_message, create_issue, etc.)
 * @param {Object} data     - Action parameters from the AI tag
 * @param {string} userId   - Authenticated user ID
 */
async function triggerSmartAction(provider, action, data, userId) {
  const providerKey = provider.toLowerCase();
  const webhookPath = PROVIDER_WEBHOOK_MAP[providerKey];

  if (!webhookPath) {
    console.warn(`[n8n] Unknown provider "${provider}". Falling back to "smart-action".`);
  }

  // Fetch only the user's n8n instance config (base URL + API key).
  // This is NOT a user-facing credential — it's the orchestration layer config.
  const { supabaseAdmin } = require("../config/supabase");

  const { data: n8nIntegration } = await supabaseAdmin
    .from("integrations")
    .select("config")
    .eq("user_id", userId)
    .eq("provider", "n8n")
    .single();

  const n8nConfig = n8nIntegration?.config || null;

  // Issue a short-lived credential token so n8n can fetch the actual secrets
  // without us embedding them in the request body.
  const credentialToken = issueCredentialToken(userId, providerKey);

  return triggerWorkflow(
    webhookPath || "smart-action",
    {
      provider: providerKey,
      action,
      ...data,       // Spread action params to root for easy access in n8n expressions
      data,          // Also keep nested for backward compatibility
      userId,
      // n8n workflow must call /api/integrations/credentials?token=<credentialToken>
      // to get the real API key. Raw credentials are NEVER in this payload.
      credentialToken,
      timestamp: new Date().toISOString(),
    },
    n8nConfig
  );
}

// ─── Token management (exported for use in integrations route) ────────────────

module.exports = {
  triggerWorkflow,
  triggerAIChat,
  triggerDocumentQA,
  triggerEmailAssistant,
  triggerTaskExtractor,
  triggerSmartAction,
  // Exported so the /api/integrations/credentials endpoint can validate tokens
  consumeCredentialToken,
};
