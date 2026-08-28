import express from "express";
import tokenChecker from "../middlewares/tokenChecker.js";
import {
  createChatSession,
  getChatSessions,
  getChatSession,
  updateChatSession,
  deleteChatSession,
} from "../controllers/chatSession.js";

const router = express.Router();

// Create a new chat session
router.post("/", tokenChecker, createChatSession);

// Get all chat sessions for the authenticated user
router.get("/", tokenChecker, getChatSessions);

// Get a single chat session by ID
router.get("/:sessionId", tokenChecker, getChatSession);

// Update a chat session (e.g. retitle)
router.patch("/:sessionId", tokenChecker, updateChatSession);

// Delete a specific chat session by ID
router.delete("/:sessionId", tokenChecker, deleteChatSession);

export default router;
