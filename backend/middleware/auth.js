const { supabase } = require("../config/supabase");

/**
 * Auth middleware - verifies Supabase JWT token
 * Attaches user object to req.user
 */
async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing or invalid authorization header",
      });
    }

    const token = authHeader.split(" ")[1];

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: "Invalid or expired token",
      });
    }

    // Attach user and token to request
    req.user = user;
    req.token = token;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return res.status(500).json({ error: "Authentication failed" });
  }
}

/**
 * Optional auth - doesn't block request if no token
 * Still attaches user if valid token is present
 */
async function optionalAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      const {
        data: { user },
      } = await supabase.auth.getUser(token);

      if (user) {
        req.user = user;
        req.token = token;
      }
    }

    next();
  } catch {
    next();
  }
}

module.exports = { requireAuth, optionalAuth };
