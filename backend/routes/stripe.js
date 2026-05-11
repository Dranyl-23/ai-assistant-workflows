const express = require("express");
const stripe = process.env.STRIPE_SECRET_KEY
  ? require("stripe")(process.env.STRIPE_SECRET_KEY)
  : null;

if (!stripe) {
  console.warn("WARNING: STRIPE_SECRET_KEY is missing in .env. Stripe features will be disabled.");
}

const { supabaseAdmin } = require("../config/supabase");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/stripe/create-checkout-session
 * Create a new checkout session for Pro plan
 */
router.post("/create-checkout-session", requireAuth, async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe is not configured on the server." });
  }
  try {
    // In production, define STRIPE_PRO_PRICE_ID in your .env
    const targetPriceId = process.env.STRIPE_PRO_PRICE_ID;

    // We build the line_items based on whether a proper Price ID exists.
    // If not, we fall back to the inline price_data for development purposes.
    const lineItems = targetPriceId 
      ? [
          {
            price: targetPriceId,
            quantity: 1,
          }
        ]
      : [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: "Antigravity AI Pro Plan",
                description: "Unlimited AI messages, documents, and smart actions.",
              },
              unit_amount: 1900, // $19.00
              recurring: { interval: "month" },
            },
            quantity: 1,
          },
        ];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "subscription",
      success_url: `${process.env.FRONTEND_URL}/dashboard/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/dashboard/billing?cancelled=true`,
      customer_email: req.user.email,
      metadata: {
        userId: req.user.id,
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe Checkout Error:", err);
    res.status(500).json({ error: "Failed to create checkout session" });
  }
});

/**
 * POST /api/stripe/create-portal-session
 * Create a Stripe Customer Portal session for downgrades/management
 */
router.post("/create-portal-session", requireAuth, async (req, res) => {
  if (!stripe) return res.status(500).json({ error: "Stripe is not configured." });

  try {
    // Look up the user's Stripe customer ID
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", req.user.id)
      .eq("status", "active")
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!sub || !sub.stripe_customer_id) {
      // If they somehow have Pro without a Stripe subscription (e.g., from old bug), fix their profile
      await supabaseAdmin.from("profiles").update({ plan: "free" }).eq("id", req.user.id);
      return res.json({ fallbackDowngrade: true });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${process.env.FRONTEND_URL}/dashboard/settings`,
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe Portal Error:", err);
    res.status(500).json({ error: "Failed to create portal session" });
  }
});

/**
 * POST /api/stripe/webhook
 * Handle Stripe webhook events
 * IMPORTANT: This endpoint needs raw body parsing
 */
router.post("/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  if (!stripe) {
    return res.status(500).json({ error: "Stripe is not configured on the server." });
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const session = event.data.object;
      const userId = session.metadata.userId;
      const stripeCustomerId = session.customer;
      const stripeSubscriptionId = session.subscription;

      console.log(`[Stripe] Payment success for user: ${userId}`);

      // 1. Update Profile to Pro
      await supabaseAdmin
        .from("profiles")
        .update({ plan: "pro" })
        .eq("id", userId);

      // 2. Log to subscriptions table
      await supabaseAdmin.from("subscriptions").insert({
        user_id: userId,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        plan: "pro",
        status: "active",
      });
      break;

    // BUG 6 FIX: This was a no-op stub — cancelled users kept Pro access forever.
    // Now we look up the user by stripe_subscription_id and downgrade them.
    case "customer.subscription.deleted": {
      const cancelledSub = event.data.object;
      console.log(`[Stripe] Subscription cancelled: ${cancelledSub.id}`);

      try {
        // Find the user linked to this Stripe subscription
        const { data: subRow } = await supabaseAdmin
          .from("subscriptions")
          .select("user_id")
          .eq("stripe_subscription_id", cancelledSub.id)
          .single();

        if (subRow?.user_id) {
          // Downgrade profile to free
          await supabaseAdmin
            .from("profiles")
            .update({ plan: "free" })
            .eq("id", subRow.user_id);

          // Mark the subscription row as cancelled
          await supabaseAdmin
            .from("subscriptions")
            .update({ status: "cancelled" })
            .eq("stripe_subscription_id", cancelledSub.id);

          console.log(`[Stripe] User ${subRow.user_id} downgraded to free plan.`);
        } else {
          console.warn(`[Stripe] No user found for subscription ${cancelledSub.id} — skipping downgrade.`);
        }
      } catch (err) {
        console.error("[Stripe] Failed to process subscription cancellation:", err.message);
      }
      break;
    }

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;
