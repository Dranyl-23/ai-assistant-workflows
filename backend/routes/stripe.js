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
    const { priceId } = req.body; // In production, you'd define this in Stripe dashboard

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
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
      ],
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

    case "customer.subscription.deleted":
      const subscription = event.data.object;
      // Handle cancellation...
      // (Optionally find user by stripe_subscription_id and downgrade to free)
      break;

    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;
