const express = require("express");
const rateLimit = require("express-rate-limit");
const { supabase, supabaseAdmin } = require("../config/supabase");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// Rate Limiters
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strict limiter for login/signup — prevents brute-force and credential stuffing.
 * 10 attempts per IP per 15 minutes. After that, returns 429.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,  // Return RateLimit-* headers
  legacyHeaders: false,
  message: {
    error: "Too many authentication attempts. Please wait 15 minutes before trying again.",
  },
  // Skip successful responses — only count failures towards the limit
  skipSuccessfulRequests: true,
});

/**
 * Looser limiter for password reset — prevents email flooding.
 * 3 attempts per IP per hour.
 */
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too many password reset requests. Please wait 1 hour before trying again.",
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /auth/signup
 * Rate-limited: 10 attempts / 15 min / IP
 */
router.post("/signup", authLimiter, async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters" });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: full_name || "" },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Create profile row immediately so the rest of the app can rely on it
    if (data.user) {
      await supabaseAdmin.from("profiles").upsert({
        id: data.user.id,
        email: data.user.email,
        full_name: full_name || "",
        plan: "free",
        created_at: new Date().toISOString(),
      });
    }

    res.status(201).json({
      message: "Account created successfully. Please check your email to confirm.",
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
      session: data.session,
    });
  } catch (err) {
    console.error("[Auth] Signup error:", err.message);
    res.status(500).json({ error: "Failed to create account" });
  }
});

/**
 * POST /auth/login
 * Rate-limited: 10 attempts / 15 min / IP (failures only)
 */
router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Use 401 for auth failures — do NOT reveal whether the email exists
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.json({
      message: "Login successful",
      user: {
        id: data.user.id,
        email: data.user.email,
        full_name: data.user.user_metadata?.full_name || "",
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error("[Auth] Login error:", err.message);
    res.status(500).json({ error: "Failed to login" });
  }
});

/**
 * POST /auth/logout
 */
router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(" ")[1];
      await supabase.auth.signOut(token);
    }
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("[Auth] Logout error:", err.message);
    res.status(500).json({ error: "Failed to logout" });
  }
});

/**
 * GET /auth/me
 */
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const token = authHeader.split(" ")[1];
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: "Invalid session" });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, avatar_url, plan")
      .eq("id", user.id)
      .single();

    res.json({
      user: {
        id: user.id,
        email: user.email,
        full_name: profile?.full_name || user.user_metadata?.full_name || "",
        avatar_url: profile?.avatar_url || "",
        plan: profile?.plan || "free",
        created_at: user.created_at,
      },
    });
  } catch (err) {
    console.error("[Auth] Get user error:", err.message);
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

/**
 * POST /auth/refresh
 */
router.post("/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token });
    if (error) {
      return res.status(401).json({ error: error.message });
    }

    res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at,
      },
    });
  } catch (err) {
    console.error("[Auth] Refresh error:", err.message);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

/**
 * POST /auth/google
 */
router.post("/google", async (req, res) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.FRONTEND_URL}/auth/callback`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });

    if (error) return res.status(400).json({ error: error.message });
    res.json({ url: data.url });
  } catch (err) {
    console.error("[Auth] Google auth error:", err.message);
    res.status(500).json({ error: "Failed to initiate Google sign-in" });
  }
});

/**
 * POST /auth/forgot-password
 * Rate-limited: 3 attempts / hour / IP
 */
router.post("/forgot-password", resetLimiter, async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    // Always return 200 to prevent email enumeration
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.FRONTEND_URL}/reset-password`,
    });

    res.json({ message: "If that email exists, a password reset link has been sent." });
  } catch (err) {
    console.error("[Auth] Forgot password error:", err.message);
    // Still return 200 to prevent enumeration
    res.json({ message: "If that email exists, a password reset link has been sent." });
  }
});

/**
 * DELETE /auth/delete-account
 * Permanently deletes the user's account and all associated data.
 */
router.delete("/delete-account", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // Delete in dependency order (children before parents)
    await supabaseAdmin.from("user_memories").delete().eq("user_id", userId);
    await supabaseAdmin.from("documents").delete().eq("user_id", userId);
    await supabaseAdmin.from("conversations").delete().eq("user_id", userId);
    await supabaseAdmin.from("integrations").delete().eq("user_id", userId);
    await supabaseAdmin.from("subscriptions").delete().eq("user_id", userId);
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    res.json({ message: "Account and all data deleted successfully" });
  } catch (err) {
    console.error("[Auth] Delete account error:", err.message);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

module.exports = router;
