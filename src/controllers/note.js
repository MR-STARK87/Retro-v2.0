import Note from "../models/note.js";
import asyncHandler from "../utils/asyncHandler.js";
import { chatCompletion, extractMessageContent } from "../utils/openai.js";
import { getPrompt, PROMPTS } from "../utils/prompts/index.js";

// Create a new note
const createNote = asyncHandler(async (req, res) => {
  const { title, content, tags, category, color, isPinned, isFavorite } =
    req.body;

  // Validate required fields
  if (!title || !content) {
    return res.status(400).json({
      success: false,
      message: "Title and content are required",
    });
  }

  // Create new note
  const note = new Note({
    userId: req.user._id,
    title,
    content,
    tags: tags || [],
    category: category || "General",
    color: color || "#ffffff",
    isPinned: isPinned || false,
    isFavorite: isFavorite || false,
  });

  // Extract plain text from Quill Delta for search
  note.plainText = note.extractPlainText();

  await note.save();

  res.status(201).json({
    success: true,
    message: "Note created successfully",
    data: note,
  });
});

// Get all user notes
const getNotes = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    category,
    tag,
    isPinned,
    isFavorite,
    isArchived = false,
  } = req.validatedQuery || req.query;

  const filters = { isArchived: isArchived === "true" };

  if (category) filters.category = category;
  if (tag) filters.tags = tag.toLowerCase();
  if (isPinned !== undefined) filters.isPinned = isPinned === "true";
  if (isFavorite !== undefined) filters.isFavorite = isFavorite === "true";

  const options = {
    limit: parseInt(limit),
    skip: (parseInt(page) - 1) * parseInt(limit),
    sort: { isPinned: -1, lastEditedAt: -1 },
  };

  const notes = await Note.getUserNotes(req.user._id, filters, options);
  const total = await Note.countDocuments({ userId: req.user._id, ...filters });

  res.status(200).json({
    success: true,
    message: "Notes fetched successfully",
    data: {
      notes,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalNotes: total,
        notesPerPage: parseInt(limit),
      },
    },
  });
});

// Get a single note by ID
const getNoteById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const note = await Note.findOne({ _id: id, userId: req.user._id });

  if (!note) {
    return res.status(404).json({
      success: false,
      message: "Note not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Note fetched successfully",
    data: note,
  });
});

// Update a note
const updateNote = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    title,
    content,
    tags,
    category,
    color,
    isPinned,
    isFavorite,
    isArchived,
  } = req.body;

  const note = await Note.findOne({ _id: id, userId: req.user._id });

  if (!note) {
    return res.status(404).json({
      success: false,
      message: "Note not found",
    });
  }

  // Update fields if provided
  if (title !== undefined) note.title = title;
  if (content !== undefined) {
    note.content = content;
    note.plainText = note.extractPlainText();
  }
  if (tags !== undefined) note.tags = tags;
  if (category !== undefined) note.category = category;
  if (color !== undefined) note.color = color;
  if (isPinned !== undefined) note.isPinned = isPinned;
  if (isFavorite !== undefined) note.isFavorite = isFavorite;
  if (isArchived !== undefined) note.isArchived = isArchived;

  await note.save();

  res.status(200).json({
    success: true,
    message: "Note updated successfully",
    data: note,
  });
});

// Delete a note
const deleteNote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const note = await Note.findOneAndDelete({ _id: id, userId: req.user._id });

  if (!note) {
    return res.status(404).json({
      success: false,
      message: "Note not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Note deleted successfully",
  });
});

// Search notes
const searchNotes = asyncHandler(async (req, res) => {
  const { query } = req.validatedQuery || req.query;

  if (!query || query.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Search query is required",
    });
  }

  const notes = await Note.searchNotes(req.user._id, query);

  res.status(200).json({
    success: true,
    message: "Search completed successfully",
    data: {
      notes,
      count: notes.length,
    },
  });
});

// Get notes by tag
const getNotesByTag = asyncHandler(async (req, res) => {
  const { tag } = req.params;

  const notes = await Note.getNotesByTag(req.user._id, tag);

  res.status(200).json({
    success: true,
    message: `Notes with tag "${tag}" fetched successfully`,
    data: {
      notes,
      count: notes.length,
    },
  });
});

// Get notes by category
const getNotesByCategory = asyncHandler(async (req, res) => {
  const { category } = req.params;

  const notes = await Note.getNotesByCategory(req.user._id, category);

  res.status(200).json({
    success: true,
    message: `Notes in category "${category}" fetched successfully`,
    data: {
      notes,
      count: notes.length,
    },
  });
});

// Toggle pin status
const togglePin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const note = await Note.findOne({ _id: id, userId: req.user._id });

  if (!note) {
    return res.status(404).json({
      success: false,
      message: "Note not found",
    });
  }

  note.isPinned = !note.isPinned;
  await note.save();

  res.status(200).json({
    success: true,
    message: `Note ${note.isPinned ? "pinned" : "unpinned"} successfully`,
    data: note,
  });
});

// Toggle favorite status
const toggleFavorite = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const note = await Note.findOne({ _id: id, userId: req.user._id });

  if (!note) {
    return res.status(404).json({
      success: false,
      message: "Note not found",
    });
  }

  note.isFavorite = !note.isFavorite;
  await note.save();

  res.status(200).json({
    success: true,
    message: `Note ${note.isFavorite ? "added to" : "removed from"} favorites successfully`,
    data: note,
  });
});

// Archive a note
const archiveNote = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const note = await Note.findOne({ _id: id, userId: req.user._id });

  if (!note) {
    return res.status(404).json({
      success: false,
      message: "Note not found",
    });
  }

  note.isArchived = !note.isArchived;
  await note.save();

  res.status(200).json({
    success: true,
    message: `Note ${note.isArchived ? "archived" : "unarchived"} successfully`,
    data: note,
  });
});

// Get all tags used by user
const getUserTags = asyncHandler(async (req, res) => {
  const tags = await Note.distinct("tags", {
    userId: req.user._id,
    isArchived: false,
  });

  res.status(200).json({
    success: true,
    message: "Tags fetched successfully",
    data: {
      tags,
      count: tags.length,
    },
  });
});

// Get all categories used by user
const getUserCategories = asyncHandler(async (req, res) => {
  const categories = await Note.distinct("category", {
    userId: req.user._id,
    isArchived: false,
  });

  res.status(200).json({
    success: true,
    message: "Categories fetched successfully",
    data: {
      categories,
      count: categories.length,
    },
  });
});

// Enhance note with AI
const enhanceNote = asyncHandler(async (req, res) => {
  console.log("Route hit");
  const { noteId } = req.body;
  const userId = req.user._id;

  // Validate noteId
  if (!noteId || typeof noteId !== "string") {
    return res.status(400).json({
      success: false,
      message: "Note ID is required",
    });
  }

  // Retrieve the note from database
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

  // Extract plain text from note content
  let noteContent = note.plainText || note.extractPlainText();

  if (!noteContent || noteContent.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Note content is empty. Cannot enhance an empty note.",
    });
  }

  // Get the note enhancement prompt
  const enhancePrompt = getPrompt(PROMPTS.NOTE_ENHANCE);

  // Build the context for AI
  const noteContext = `
**NOTE TO ENHANCE:**
---
Title: ${note.title || "Untitled"}
${note.category ? `Category: ${note.category}` : ""}
${note.tags && note.tags.length > 0 ? `Tags: ${note.tags.join(", ")}` : ""}

Content:
${noteContent}
---

Please enhance this note following the guidelines provided.
`;

  // Prepare messages for the AI
  const messages = [
    {
      role: "system",
      content: enhancePrompt,
    },
    {
      role: "user",
      content: noteContext,
    },
  ];

  // Make API call to get the enhanced note
  let aiResponse;
  try {
    const apiResponse = await chatCompletion(messages);
    aiResponse = extractMessageContent(apiResponse);
  } catch (error) {
    console.error("Error getting enhancement from AI:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to enhance note with AI",
      error: error.message,
    });
  }

  // Parse the JSON response
  let enhancedData;
  try {
    enhancedData = JSON.parse(aiResponse);

    if (!enhancedData.enhanced) {
      throw new Error("Invalid response format: missing 'enhanced' field");
    }
  } catch (error) {
    console.error("Error parsing AI response:", error);
    return res.status(500).json({
      success: false,
      message: "Invalid response format from AI",
      error: error.message,
    });
  }

  // Convert Markdown to Quill Delta format (simple conversion)
  // For now, we'll store the markdown as plain text in Delta format
  const enhancedMarkdown = enhancedData.enhanced;

  // Update the note with enhanced content
  // We'll update the plainText and create a simple Delta structure
  note.plainText = enhancedMarkdown;

  // Create a simple Delta structure with the enhanced content
  note.content = {
    ops: [
      {
        insert: enhancedMarkdown + "\n",
      },
    ],
  };

  note.lastEditedAt = Date.now();

  try {
    await note.save();
  } catch (error) {
    console.error("Error saving enhanced note:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to save enhanced note",
      error: error.message,
    });
  }

  // Send the response to the user
  res.status(200).json({
    success: true,
    message: "Note enhanced successfully",
    enhancedMarkdown: enhancedMarkdown,
    improvements: enhancedData.improvements || [],
    preserved: enhancedData.preserved || "",
    data: note,
  });
});

export {
  createNote,
  getNotes,
  getNoteById,
  updateNote,
  deleteNote,
  searchNotes,
  getNotesByTag,
  getNotesByCategory,
  togglePin,
  toggleFavorite,
  archiveNote,
  getUserTags,
  getUserCategories,
  enhanceNote,
};
