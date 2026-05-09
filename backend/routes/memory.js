const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../config/supabase");
const { requireAuth } = require("../middleware/auth");

// All memory routes require authentication
router.use(requireAuth);

/**
 * GET /api/memories
 * Get all stored facts for the current user
 */
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("user_memories")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;
    res.json({ memories: data || [] });
  } catch (err) {
    console.error("[Memory-Fetch-Error]:", err);
    res.status(500).json({ error: "Failed to fetch memories" });
  }
});

/**
 * DELETE /api/memories/:id
 * Delete a specific memory fact
 */
router.delete("/:id", async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("user_memories")
      .delete()
      .eq("id", req.params.id)
      .eq("user_id", req.user.id);

    if (error) throw error;
    res.json({ message: "Memory deleted successfully" });
  } catch (err) {
    console.error("[Memory-Delete-Error]:", err);
    res.status(500).json({ error: "Failed to delete memory" });
  }
});

module.exports = router;
