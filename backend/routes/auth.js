const express = require("express");
const { supabase, supabaseAdmin } = require("../config/supabase");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /auth/signup
 * Register a new user with email and password
 */
router.post("/signup", async (req, res) => {
  try {
    const { email, password, full_name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: full_name || "",
        },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Create user profile in our profiles table
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
      message: "Account created successfully",
      user: {
        id: data.user?.id,
        email: data.user?.email,
      },
      session: data.session,
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Failed to create account" });
  }
});

/**
 * POST /auth/login
 * Sign in with email and password
 */
router.post("/login", async (req, res) => {
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
      return res.status(401).json({ error: error.message });
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
    console.error("Login error:", err);
    res.status(500).json({ error: "Failed to login" });
  }
});

/**
 * POST /auth/logout
 * Sign out the current user
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
    console.error("Logout error:", err);
    res.status(500).json({ error: "Failed to logout" });
  }
});

/**
 * GET /auth/me
 * Get the current authenticated user's profile
 */
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
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

    // Fetch full profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
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
    console.error("Get user error:", err);
    res.status(500).json({ error: "Failed to get user profile" });
  }
});

/**
 * POST /auth/refresh
 * Refresh the access token
 */
router.post("/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: "Refresh token is required" });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

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
    console.error("Refresh error:", err);
    res.status(500).json({ error: "Failed to refresh token" });
  }
});

/**
 * POST /auth/google
 * Get Google OAuth URL for sign-in
 */
router.post("/google", async (req, res) => {
  try {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${process.env.FRONTEND_URL}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "consent",
        },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({ url: data.url });
  } catch (err) {
    console.error("Google auth error:", err);
    res.status(500).json({ error: "Failed to initiate Google sign-in" });
  }
});

/**
 * DELETE /auth/delete-account
 * Permanently delete the user's account and all associated data
 */
router.delete("/delete-account", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Delete Memories
    await supabaseAdmin.from("memories").delete().eq("user_id", userId);

    // 2. Delete Documents (will cascade to document_chunks)
    await supabaseAdmin.from("documents").delete().eq("user_id", userId);

    // 3. Delete Conversations (will cascade to messages)
    await supabaseAdmin.from("conversations").delete().eq("user_id", userId);

    // 4. Delete Profile
    await supabaseAdmin.from("profiles").delete().eq("id", userId);

    // 5. Delete Auth User (Supabase Admin)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (error) throw error;

    res.json({ message: "Account and all data deleted successfully" });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Failed to delete account and associated data" });
  }
});

module.exports = router;
