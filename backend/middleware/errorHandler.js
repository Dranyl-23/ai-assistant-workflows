/**
 * Global error handling middleware
 */
function errorHandler(err, req, res, next) {
  console.error(`[ERROR] ${req.method} ${req.path}:`, err);

  // Multer file size error
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(413).json({
      error: "File too large",
      message: "Maximum file size is 10MB",
    });
  }

  // Stripe webhook signature error
  if (err.type === "StripeSignatureVerificationError") {
    return res.status(400).json({
      error: "Invalid webhook signature",
    });
  }

  const statusCode = err.statusCode || err.status || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal server error"
      : err.message || "Internal server error";

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
}

/**
 * 404 handler for undefined routes
 */
function notFoundHandler(req, res) {
  res.status(404).json({
    error: "Not found",
    message: `Route ${req.method} ${req.path} does not exist`,
  });
}

module.exports = { errorHandler, notFoundHandler };
