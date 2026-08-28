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

// Update a chat session (title) — used for auto-titling from the first message
export const updateChatSession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const { title } = req.body;
  const userId = req.user._id;

  if (typeof title !== "string" || !title.trim()) {
    return res.status(400).json({
      success: false,
      message: "A non-empty title is required",
    });
  }

  const session = await ChatSession.findOneAndUpdate(
    { _id: sessionId, userId },
    { title: title.trim().slice(0, 80) },
    { new: true },
  );

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
  await ChatSession.deleteChatSession(userId, sessionId);
  res.status(204).send();
});
