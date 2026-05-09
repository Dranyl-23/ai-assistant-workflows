const express = require("express");
const { supabaseAdmin } = require("../config/supabase");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/subscription/status
 * Get current subscription status
 */
router.get("/status", requireAuth, async (req, res) => {
  try {
    // Attempt to get profile, if missing, create it (Self-healing)
    let { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("plan, created_at")
      .eq("id", req.user.id)
      .single();

    if (error && error.code === 'PGRST116') {
      console.log(`[Subscription] Profile missing for user ${req.user.id}. Creating default...`);
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from("profiles")
        .insert({
          id: req.user.id,
          email: req.user.email,
          plan: "free"
        })
        .select("plan, created_at")
        .single();
      
      if (createError) throw createError;
      profile = newProfile;
    } else if (error) {
      throw error;
    }

    // Fetch limits/usage
    const { count: docCount } = await supabaseAdmin
      .from("documents")
      .select("*", { count: "exact", head: true })
      .eq("user_id", req.user.id);

    const { count: msgCount } = await supabaseAdmin
      .from("messages")
      .select("*", { count: "exact", head: true })
      .eq("role", "user")
      .filter("conversation_id", "in", 
        supabaseAdmin.from("conversations").select("id").eq("user_id", req.user.id)
      );

    res.json({
      plan: profile.plan || "free",
      usage: {
        documents: docCount || 0,
        messages: msgCount || 0,
      },
      limits: {
        documents: profile.plan === "pro" ? 999999 : 2,
        messages: profile.plan === "pro" ? 999999 : 50,
      }
    });
  } catch (err) {
    console.error("Subscription status error:", err);
    res.status(500).json({ error: "Failed to fetch subscription status" });
  }
});

/**
 * POST /api/subscription/upgrade
 * DISABLED: Self-upgrade is not allowed. Plan changes are managed
 * exclusively by the Stripe webhook (stripe.js -> checkout.session.completed).
 * Directing users here is a security hole — any authenticated user could
 * upgrade for free. Use /api/stripe/create-checkout-session instead.
 */
router.post("/upgrade", requireAuth, (req, res) => {
  return res.status(403).json({
    error: "Direct upgrade is disabled. Please use Stripe Checkout to upgrade your plan.",
    checkoutUrl: "/api/stripe/create-checkout-session",
  });
});

/**
 * POST /api/subscription/cancel
 * INTERNAL: Downgrades user to Free plan.
 * This should only be called by the Stripe webhook handler when
 * a subscription is cancelled (customer.subscription.deleted).
 * It is NOT intended to be called directly from client UI.
 */
router.post("/cancel", requireAuth, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .update({ plan: "free" })
      .eq("id", req.user.id);

    if (error) throw error;

    res.json({ message: "Subscription cancelled", plan: "free" });
  } catch (err) {
    console.error("Cancel error:", err);
    res.status(500).json({ error: "Failed to cancel subscription" });
  }
});

module.exports = router;
