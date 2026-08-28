import asyncHandler from "../utils/asyncHandler.js";
import UserContext from "../models/userContext.js";
import Note from "../models/note.js";
import { chatCompletion, extractMessageContent } from "../utils/openai.js";
import { getPrompt, PROMPTS } from "../utils/prompts/index.js";
import ChatSession from "../models/chatSession.js";

/**
 * Chat endpoint that:
 * 1. Retrieves user's stored context
 * 2. Makes API call to answer the user's query
 * 3. Updates user context with the conversation
 */
export const chat = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { message } = req.body;
  const { chatSessionId } = req.body;

  if (!message || typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Message is required and must be a non-empty string",
    });
  }
  const currentSession = await ChatSession.findOne({
    _id: chatSessionId,
    userId,
  });
  if (!currentSession) {
    return res.status(404).json({
      success: false,
      message: "Chat session not found",
    });
  }
  // Auto-generate title from first message (first 6 words)
  if (
    currentSession.messages.length === 0 &&
    currentSession.title === "New Chat"
  ) {
    const words = message.trim().split(/\s+/);
    const titleWords = words.slice(0, 6).join(" ");
    const generatedTitle = titleWords + (words.length > 6 ? "..." : "");
    currentSession.title = generatedTitle;
  }

  currentSession.messages.push({ sender: "user", content: message });
  currentSession.updatedAt = Date.now();
  await currentSession.save();

  // Step 1: Find or create user context
  let userContext = await UserContext.findOne({ userId });

  if (!userContext) {
    userContext = new UserContext({
      userId,
      context: "",
    });
    await userContext.save();
  }

  // Step 2: Get the answering prompt
  const answeringPrompt = getPrompt(PROMPTS.ANSWERING);
  const contextPrompt = getPrompt(PROMPTS.CONTEXT);

  // Step 3: Prepare messages for answering the user's query
  const answeringMessages = [
    {
      role: "system",
      content: answeringPrompt,
    },
  ];

  // Setup profile is authoritative: if it conflicts with the mutable
  // context below, the profile wins. Injected before the learned context.
  if (userContext.stableContext && userContext.stableContext.trim() !== "") {
    answeringMessages.push({
      role: "system",
      content: `User Profile (authoritative, set by user at setup): ${userContext.stableContext}`,
    });
  }

  // Add user context if it exists
  if (userContext.context && userContext.context.trim() !== "") {
    answeringMessages.push({
      role: "system",
      content: `User Context: ${userContext.context}`,
    });
  }

  // Push the actual conversation history (capped to keep payloads sane)
  const HISTORY_LIMIT = 40;
  const history = currentSession.messages.slice(-HISTORY_LIMIT);
  for (const msg of history) {
    answeringMessages.push({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  // Step 4: Make the API call to get the answer (plain text, no JSON wrapper)
  let answer;
  try {
    const apiResponse = await chatCompletion(answeringMessages);
    answer = extractMessageContent(apiResponse);
  } catch (error) {
    console.error("Error getting answer from OpenAI:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate response",
      error: error.message,
    });
  }

  if (!answer || answer.trim() === "") {
    console.error("Empty answer received from AI");
    return res.status(500).json({
      success: false,
      message: "Empty response from AI",
    });
  }

  currentSession.messages.push({
    sender: "ai",
    content: answer,
  });
  currentSession.updatedAt = Date.now();
  await currentSession.save();

  // Step 5: Send the answer to the user
  res.status(200).json({
    success: true,
    response: answer,
  });

  // Step 6: Make second API call to update context (async, don't wait)
  (async () => {
    try {
      const contextMessages = [
        {
          role: "system",
          content: contextPrompt,
        },
        {
          role: "user",
          content: `previous_context: ${userContext.context || ""}\nlatest_user_message: ${message}`,
        },
      ];

      const contextResponse = await chatCompletion(contextMessages);
      const updatedContextString = extractMessageContent(contextResponse);

      // Parse the context JSON response
      const contextData = JSON.parse(updatedContextString);

      if (contextData.context !== undefined) {
        userContext.context = contextData.context;
        await userContext.save();
      }
    } catch (error) {
      console.error("Error updating user context:", error);
      // Don't throw - this happens in background
    }
  })();
});

/**
 * Chat with Note endpoint that:
 * 1. Retrieves the specified note (ensuring it belongs to the authenticated user)
 * 2. Uses the note content as reference material
 * 3. Makes API call with user prompt, note content, and detailed system prompt
 * 4. Returns AI response treating the note as reference context
 */
export const chatWithNote = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const { message, noteId, chatSessionId } = req.body;

  // Validate message
  if (!message || typeof message !== "string" || message.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Message is required and must be a non-empty string",
    });
  }

  // Validate noteId
  if (!noteId || typeof noteId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Note ID is required",
    });
  }

  // Validate chatSessionId and load the session (scoped to this user)
  if (!chatSessionId || typeof chatSessionId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Chat session ID is required",
    });
  }
  const currentSession = await ChatSession.findOne({
    _id: chatSessionId,
    userId,
  });
  if (!currentSession) {
    return res.status(404).json({
      success: false,
      message: "Chat session not found",
    });
  }

  // Auto-generate title from first message (first 6 words)
  if (
    currentSession.messages.length === 0 &&
    currentSession.title === "New Chat"
  ) {
    const words = message.trim().split(/\s+/);
    const titleWords = words.slice(0, 6).join(" ");
    currentSession.title = titleWords + (words.length > 6 ? "..." : "");
  }

  // Step 1: Retrieve the note from database
  let note;
  try {
    note = await Note.findById(noteId);

    // Check if note exists
    if (!note) {
      return res.status(404).json({
        success: false,
        message: "Note not found",
      });
    }

    // Verify note belongs to authenticated user
    if (note.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: "You do not have permission to access this note",
      });
    }
  } catch (error) {
    console.error("Error retrieving note:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve note",
      error: error.message,
    });
  }

  // Persist the user's message before calling the AI
  currentSession.messages.push({ sender: "user", content: message });
  currentSession.updatedAt = Date.now();
  await currentSession.save();

  // Step 2: Extract plain text from note content
  let noteContent = note.plainText || note.extractPlainText();

  if (!noteContent || noteContent.trim() === "") {
    noteContent = "No content available in this note.";
  }

  // Step 3: Get the note reference prompt and prepare note context
  const noteReferencePrompt = getPrompt(PROMPTS.NOTE_REFERENCE);

  // Inject the user's setup profile so note chat is personalized too
  const setupContext = await UserContext.findOne({ userId }).lean();
  const stableProfile =
    setupContext?.stableContext?.trim() !== ""
      ? `\n\nUser Profile (authoritative, set by user at setup): ${setupContext.stableContext}`
      : "";

  // Build note context section
  const noteContext = `
**ATTACHED NOTE CONTENT:**
---
Title: ${note.title}
${note.category ? `Category: ${note.category}` : ""}
${note.tags && note.tags.length > 0 ? `Tags: ${note.tags.join(", ")}` : ""}

Content:
${noteContent}
---
`;

  // Combine the base prompt with note-specific context
  const systemPrompt = `${noteReferencePrompt}${stableProfile}

${noteContext}`;

  // Step 4: Prepare messages for the AI — note context first, then conversation history
  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
  ];

  const HISTORY_LIMIT = 40;
  const history = currentSession.messages.slice(-HISTORY_LIMIT);
  for (const msg of history) {
    messages.push({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.content,
    });
  }

  // Step 5: Make API call to get the answer (plain text, no JSON wrapper)
  let answer;
  try {
    const apiResponse = await chatCompletion(messages);
    answer = extractMessageContent(apiResponse);
  } catch (error) {
    console.error("Error getting answer from OpenAI:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate response",
      error: error.message,
    });
  }

  if (!answer || answer.trim() === "") {
    console.error("Empty answer received from AI");
    return res.status(500).json({
      success: false,
      message: "Empty response from AI",
    });
  }

  // Persist the AI's reply
  currentSession.messages.push({
    sender: "ai",
    content: answer,
  });
  currentSession.updatedAt = Date.now();
  await currentSession.save();

  // Step 6: Send the answer to the user
  res.status(200).json({
    success: true,
    response: answer,
    noteReference: {
      noteId: note._id,
      noteTitle: note.title,
    },
  });
});
