const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");
const { consumeCredentialToken } = require("../services/n8n");

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/integrations
// Returns all connected integrations for the authenticated user.
// The `config` column (which contains API keys) is EXCLUDED from the response.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("integrations")
      .select("id, user_id, provider, status, created_at") // deliberately omit `config`
      .eq("user_id", req.user.id);

    if (error) throw error;
    res.json({ integrations: data });
  } catch (err) {
    console.error("[Integrations] GET /:", err.message);
    res.status(500).json({ error: "Failed to fetch integrations" });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/integrations/credentials?token=<credentialToken>
//
// SECURE CREDENTIAL HANDOFF ENDPOINT
// ────────────────────────────────────
// This endpoint is called by n8n workflows (not by the frontend) to retrieve
// the actual API credentials for a provider action.
//
// Flow:
//   1. Backend issues a short-lived, single-use `credentialToken` in the n8n
//      webhook payload (see services/n8n.js → issueCredentialToken).
//   2. The n8n workflow calls this endpoint with that token.
//   3. We validate + consume the token (single-use, expires in 5 min).
//   4. We return ONLY the config for the specific provider tied to the token.
//
// This ensures raw API keys are NEVER transmitted in the n8n webhook body.
// ─────────────────────────────────────────────────────────────────────────────
router.get("/credentials", async (req, res) => {
  const { token } = req.query;

  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Credential token is required." });
  }

  // consumeCredentialToken validates + deletes the token atomically (single-use)
  const entry = consumeCredentialToken(token);

  if (!entry) {
    return res.status(401).json({
      error: "Invalid or expired credential token. Tokens are single-use and expire after 5 minutes.",
    });
  }

  const { userId, provider } = entry;

  try {
    const { data, error } = await supabaseAdmin
      .from("integrations")
      .select("config")
      .eq("user_id", userId)
      .eq("provider", provider)
      .eq("status", "active")
      .single();

    if (error || !data) {
      return res.status(404).json({ error: `No active integration found for provider: ${provider}` });
    }

    // Return the config (API key, webhook URL, etc.) directly to n8n
    res.json({ provider, credentials: data.config || {} });
  } catch (err) {
    console.error("[Integrations] credentials lookup error:", err.message);
    res.status(500).json({ error: "Failed to retrieve credentials." });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/integrations/:provider
// Connect / update a provider integration.
// ─────────────────────────────────────────────────────────────────────────────
router.post("/:provider", async (req, res) => {
  try {
    const { provider } = req.params;
    const { config } = req.body;

    if (!config || typeof config !== "object") {
      return res.status(400).json({ error: "A config object is required." });
    }

    const { data, error } = await supabaseAdmin
      .from("integrations")
      .upsert(
        {
          user_id: req.user.id,
          provider,
          status: "active",
          config,
          created_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      )
      .select("id, user_id, provider, status, created_at") // return safe fields only
      .single();

    if (error) throw error;

    res.json({
      message: `${provider} connected successfully`,
      integration: data,
    });
  } catch (err) {
    console.error("[Integrations] POST /:provider:", err.message);
    res.status(500).json({ error: `Failed to connect ${req.params.provider}` });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/integrations/:id
// Disconnect (delete) an integration by its row ID.
// ─────────────────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("integrations")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id); // RLS double-check: user can only delete their own

    if (error) throw error;

    res.json({ message: "Integration disconnected" });
  } catch (err) {
    console.error("[Integrations] DELETE /:id:", err.message);
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

module.exports = router;
