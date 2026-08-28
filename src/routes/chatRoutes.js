import express from "express";
import tokenChecker from "../middlewares/tokenChecker.js";
import rateLimiter from "../middlewares/rateLimiter.js";
import { checkUsageLimit, trackUsage } from "../middlewares/usageTracker.js";
import { chat, chatWithNote } from "../controllers/chat.js";

const router = express.Router();

// Note: when the client sends { stream: true }, the controllers respond with
// paced plain-text chunks, so trackUsage's res.json hook never fires — the
// controllers call incrementUsage directly in that mode.

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
