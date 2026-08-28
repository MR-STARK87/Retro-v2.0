import ChatSession from "../models/chatSession.js";
import asyncHandler from "../utils/asyncHandler.js";

// Create a new chat session
export const createChatSession = asyncHandler(async (req, res) => {
  const { title } = req.body;
  const userId = req.user._id;

  const newSession = await ChatSession.createChatSession(userId, title);
  res.status(201).json(newSession);
});

// Get all chat sessions for the authenticated user
export const getChatSessions = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const sessions = await ChatSession.getChatSessionsByUserId(userId);
  res.status(200).json(sessions);
});

// Get a single chat session by ID
export const getChatSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user._id;

  const session = await ChatSession.findOne({
    _id: sessionId,
    userId,
  });

  if (!session) {
    return res.status(404).json({
      success: false,
      message: "Chat session not found",
    });
  }

  res.status(200).json(session);
});

// Delete a specific chat session by ID
export const deleteChatSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const userId = req.user._id;
  console.log("Deleting chat session:", sessionId, "for user:", userId);
  await ChatSession.deleteChatSession(userId, sessionId);
  res.status(204).send();
});
