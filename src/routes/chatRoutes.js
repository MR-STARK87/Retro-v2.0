import express from "express";
import tokenChecker from "../middlewares/tokenChecker.js";
import rateLimiter from "../middlewares/rateLimiter.js";
import { checkUsageLimit, trackUsage } from "../middlewares/usageTracker.js";
import { chat, chatWithNote } from "../controllers/chat.js";

const router = express.Router();

router.post(
  "/chat",
  tokenChecker,
  rateLimiter("ai"),
  checkUsageLimit("aiChatMessages"),
  trackUsage("aiChatMessages"),
  chat,
);

router.post(
  "/chat-with-note",
  tokenChecker,
  rateLimiter("ai"),
  checkUsageLimit("chatWithNote"),
  trackUsage("chatWithNote"),
  chatWithNote,
);

export default router;
