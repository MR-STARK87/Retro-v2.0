import User from "../models/user.js";

// Monthly usage limits by tier
const USAGE_LIMITS = {
  free: {
    aiChatMessages: 20,
    flashcardGenerations: 2,
    noteEnhancements: 2,
    chatWithNote: 5,
    maxNotes: 25,
    maxFlashcards: 100,
    storageLimit: 5 * 1024 * 1024, // 5MB
  },
  pro: {
    aiChatMessages: 300,
    flashcardGenerations: 30,
    noteEnhancements: 30,
    chatWithNote: 100,
    maxNotes: 500,
    maxFlashcards: 2000,
    storageLimit: 100 * 1024 * 1024, // 100MB
  },
  premium: {
    aiChatMessages: Infinity,
    flashcardGenerations: Infinity,
    noteEnhancements: Infinity,
    chatWithNote: Infinity,
    maxNotes: Infinity,
    maxFlashcards: Infinity,
    storageLimit: 1024 * 1024 * 1024, // 1GB
  },
};

/**
 * Check if usage limit has been exceeded
 * @param {string} usageType - Type of usage: 'aiChatMessages', 'flashcardGenerations', etc.
 */
const checkUsageLimit = (usageType) => {
  return async (req, res, next) => {
    try {
      const userId = req.user?._id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Authentication required",
        });
      }

      // Fetch user with usage data
      const user = await User.findById(userId).select("subscription usage");
      const tier = user?.subscription?.tier || "free";
      const limit = USAGE_LIMITS[tier][usageType];

      // Check if limit exists for this usage type
      if (limit === undefined) {
        return next();
      }

      // Premium tier has unlimited access
      if (limit === Infinity) {
        return next();
      }

      // Get current usage
      const usageData = user.usage?.[usageType];
      const now = new Date();

      // Reset counter if the month has changed
      if (usageData?.resetDate && now > new Date(usageData.resetDate)) {
        await User.findByIdAndUpdate(userId, {
          [`usage.${usageType}.count`]: 0,
          [`usage.${usageType}.resetDate`]: getNextMonthDate(),
        });
        user.usage[usageType].count = 0;
      }

      const currentCount = usageData?.count || 0;

      // Check if limit exceeded
      if (currentCount >= limit) {
        const resetDate = usageData?.resetDate || getNextMonthDate();
        const daysUntilReset = Math.ceil(
          (new Date(resetDate) - now) / (1000 * 60 * 60 * 24)
        );

        return res.status(403).json({
          success: false,
          message: `Monthly ${formatUsageType(usageType)} limit reached`,
          error: "USAGE_LIMIT_EXCEEDED",
          details: {
            tier,
            limit,
            current: currentCount,
            resetDate,
            daysUntilReset,
            upgradeAvailable: tier !== "premium",
            upgradeUrl: tier !== "premium" ? "/upgrade" : null,
          },
        });
      }

      // Add usage info to request for tracking
      req.usageInfo = {
        type: usageType,
        tier,
        limit,
        current: currentCount,
        remaining: limit - currentCount,
      };

      next();
    } catch (error) {
      console.error("Usage tracker error:", error);
      // On error, allow the request to proceed
      next();
    }
  };
};

/**
 * Increment usage counter after successful operation
 */
const incrementUsage = async (userId, usageType) => {
  try {
    const user = await User.findById(userId).select("usage");
    const usageData = user.usage?.[usageType];
    const now = new Date();

    // Reset if needed
    if (usageData?.resetDate && now > new Date(usageData.resetDate)) {
      await User.findByIdAndUpdate(userId, {
        [`usage.${usageType}.count`]: 1,
        [`usage.${usageType}.resetDate`]: getNextMonthDate(),
      });
    } else {
      // Increment counter
      await User.findByIdAndUpdate(userId, {
        $inc: { [`usage.${usageType}.count`]: 1 },
      });
    }
  } catch (error) {
    console.error("Error incrementing usage:", error);
  }
};

/**
 * Get usage statistics for a user
 */
const getUsageStats = async (userId) => {
  try {
    const user = await User.findById(userId).select("subscription usage");
    const tier = user?.subscription?.tier || "free";
    const limits = USAGE_LIMITS[tier];

    const stats = {};
    const now = new Date();

    for (const [key, limit] of Object.entries(limits)) {
      const usageData = user.usage?.[key];
      let current = usageData?.count || 0;

      // Reset if needed
      if (usageData?.resetDate && now > new Date(usageData.resetDate)) {
        current = 0;
      }

      stats[key] = {
        limit: limit === Infinity ? "unlimited" : limit,
        current,
        remaining: limit === Infinity ? "unlimited" : Math.max(0, limit - current),
        resetDate: usageData?.resetDate || getNextMonthDate(),
        percentage: limit === Infinity ? 0 : Math.round((current / limit) * 100),
      };
    }

    return {
      tier,
      stats,
    };
  } catch (error) {
    console.error("Error getting usage stats:", error);
    throw error;
  }
};

/**
 * Reset all usage counters for a user (typically called on subscription renewal)
 */
const resetUsageCounters = async (userId) => {
  try {
    const nextReset = getNextMonthDate();
    await User.findByIdAndUpdate(userId, {
      "usage.aiChatMessages.count": 0,
      "usage.aiChatMessages.resetDate": nextReset,
      "usage.flashcardGenerations.count": 0,
      "usage.flashcardGenerations.resetDate": nextReset,
      "usage.noteEnhancements.count": 0,
      "usage.noteEnhancements.resetDate": nextReset,
      "usage.chatWithNote.count": 0,
      "usage.chatWithNote.resetDate": nextReset,
    });
  } catch (error) {
    console.error("Error resetting usage counters:", error);
    throw error;
  }
};

/**
 * Helper: Get date for next month (usage reset date)
 */
function getNextMonthDate() {
  const date = new Date();
  date.setMonth(date.getMonth() + 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Helper: Format usage type for user-friendly message
 */
function formatUsageType(type) {
  const formats = {
    aiChatMessages: "AI chat messages",
    flashcardGenerations: "flashcard generations",
    noteEnhancements: "note enhancements",
    chatWithNote: "chat with note queries",
  };
  return formats[type] || type;
}

/**
 * Middleware to track usage after successful operation
 */
const trackUsage = (usageType) => {
  return async (req, res, next) => {
    // Store the original json function
    const originalJson = res.json.bind(res);

    // Override res.json to track usage on success
    res.json = function (data) {
      // Only increment if response was successful
      if (res.statusCode >= 200 && res.statusCode < 300 && data?.success !== false) {
        const userId = req.user?._id;
        if (userId) {
          incrementUsage(userId, usageType).catch((err) =>
            console.error("Failed to track usage:", err)
          );
        }
      }
      return originalJson(data);
    };

    next();
  };
};

export {
  checkUsageLimit,
  incrementUsage,
  getUsageStats,
  resetUsageCounters,
  trackUsage,
  USAGE_LIMITS,
};

export default checkUsageLimit;
