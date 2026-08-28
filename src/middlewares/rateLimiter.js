import User from "../models/user.js";

// In-memory store for rate limiting (use Redis in production)
const rateLimitStore = new Map();

// Rate limit configurations by tier
const RATE_LIMITS = {
  free: {
    general: { windowMs: 60 * 1000, max: 60 }, // 60 requests per minute
    ai: { windowMs: 60 * 60 * 1000, max: 10 }, // 10 AI requests per hour
    notes: { windowMs: 60 * 1000, max: 30 }, // 30 note operations per minute
    flashcards: { windowMs: 60 * 1000, max: 20 }, // 20 flashcard operations per minute
  },
  pro: {
    general: { windowMs: 60 * 1000, max: 200 }, // 200 requests per minute
    ai: { windowMs: 60 * 60 * 1000, max: 100 }, // 100 AI requests per hour
    notes: { windowMs: 60 * 1000, max: 100 }, // 100 note operations per minute
    flashcards: { windowMs: 60 * 1000, max: 80 }, // 80 flashcard operations per minute
  },
  premium: {
    general: { windowMs: 60 * 1000, max: 500 }, // 500 requests per minute
    ai: { windowMs: 60 * 60 * 1000, max: 300 }, // 300 AI requests per hour
    notes: { windowMs: 60 * 1000, max: 300 }, // 300 note operations per minute
    flashcards: { windowMs: 60 * 1000, max: 200 }, // 200 flashcard operations per minute
  },
};

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes

/**
 * Rate limiter middleware factory
 * @param {string} limitType - Type of limit: 'general', 'ai', 'notes', 'flashcards'
 */
const rateLimiter = (limitType = "general") => {
  return async (req, res, next) => {
    try {
      // Get user from request (set by tokenChecker middleware)
      const userId = req.user?._id?.toString();

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Fetch fresh user data to get current subscription tier
      const user = await User.findById(userId).select("subscription");
      const tier = user?.subscription?.tier || "free";

      // Get rate limit config for this tier and type
      const limitConfig = RATE_LIMITS[tier][limitType];

      if (!limitConfig) {
        // If no specific limit, allow request
        return next();
      }

      // Create unique key for this user and limit type
      const key = `${userId}:${limitType}`;
      const now = Date.now();

      // Get or initialize rate limit data
      let limitData = rateLimitStore.get(key);

      if (!limitData || now > limitData.resetTime) {
        // Initialize or reset the limit
        limitData = {
          count: 0,
          resetTime: now + limitConfig.windowMs,
        };
        rateLimitStore.set(key, limitData);
      }

      // Increment request count
      limitData.count++;

      // Check if limit exceeded
      if (limitData.count > limitConfig.max) {
        const retryAfter = Math.ceil((limitData.resetTime - now) / 1000);

        return res.status(429).json({
          success: false,
          message: `Rate limit exceeded. Please try again later.`,
          error: "RATE_LIMIT_EXCEEDED",
          tier,
          limit: limitConfig.max,
          windowMs: limitConfig.windowMs,
          retryAfter,
          upgradeAvailable: tier === "free",
          upgradeUrl: tier === "free" ? "/upgrade" : null,
        });
      }

      // Add rate limit info to response headers
      res.setHeader("X-RateLimit-Limit", limitConfig.max);
      res.setHeader("X-RateLimit-Remaining", limitConfig.max - limitData.count);
      res.setHeader("X-RateLimit-Reset", new Date(limitData.resetTime).toISOString());
      res.setHeader("X-RateLimit-Tier", tier);

      next();
    } catch (error) {
      console.error("Rate limiter error:", error);
      // On error, allow the request to proceed
      next();
    }
  };
};

/**
 * Get current rate limit status for a user
 */
export const getRateLimitStatus = async (userId, limitType = "general") => {
  const user = await User.findById(userId).select("subscription");
  const tier = user?.subscription?.tier || "free";
  const limitConfig = RATE_LIMITS[tier][limitType];

  const key = `${userId}:${limitType}`;
  const limitData = rateLimitStore.get(key);
  const now = Date.now();

  if (!limitData || now > limitData.resetTime) {
    return {
      limit: limitConfig.max,
      remaining: limitConfig.max,
      resetTime: now + limitConfig.windowMs,
      tier,
    };
  }

  return {
    limit: limitConfig.max,
    remaining: Math.max(0, limitConfig.max - limitData.count),
    resetTime: limitData.resetTime,
    tier,
  };
};

export default rateLimiter;
