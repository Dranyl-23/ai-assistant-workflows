const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");

// GET /api/integrations - Get all connected integrations for user
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("integrations")
      .select("*")
      .eq("user_id", req.user.id);

    if (error) throw error;
    res.json({ integrations: data });
  } catch (err) {
    console.error("[Integrations-Error]:", err);
    res.status(500).json({ error: "Failed to fetch integrations" });
  }
});

// POST /api/integrations/:provider - Connect a new provider
router.post("/:provider", async (req, res) => {
  try {
    const { provider } = req.params;
    const { config } = req.body;

    // Simulate OAuth / Connection logic
    const { data, error } = await supabaseAdmin
      .from("integrations")
      .upsert({
        user_id: req.user.id,
        provider: provider,
        status: "active",
        config: config || {},
        created_at: new Date().toISOString()
      }, { onConflict: 'user_id,provider' })
      .select()
      .single();

    if (error) throw error;
    res.json({ message: `${provider} connected successfully`, integration: data });
  } catch (err) {
    console.error("[Connect-Error]:", err);
    res.status(500).json({ error: `Failed to connect ${req.params.provider}` });
  }
});

// DELETE /api/integrations/:id - Disconnect an integration
router.delete("/:id", async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("integrations")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);

    if (error) throw error;
    res.json({ message: "Integration disconnected" });
  } catch (err) {
    console.error("[Disconnect-Error]:", err);
    res.status(500).json({ error: "Failed to disconnect" });
  }
});

module.exports = router;
