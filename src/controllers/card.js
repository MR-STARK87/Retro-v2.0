import Card from "../models/card.js";
import asyncHandler from "../utils/asyncHandler.js";
import Note from "../models/note.js";
import { chatCompletion, extractMessageContent } from "../utils/openai.js";
import { getPrompt, PROMPTS } from "../utils/prompts/index.js";

// Create a new card manually
const createCard = asyncHandler(async (req, res) => {
  const { title, content, tags, color, difficulty, isPinned, isFavorite } =
    req.body;

  // Validate required fields
  if (!title || !content) {
    return res.status(400).json({
      success: false,
      message: "Title and content are required",
    });
  }

  // Create new card
  const card = new Card({
    userId: req.user._id,
    title,
    content,
    tags: tags || [],
    color: color || "#ffffff",
    difficulty: difficulty || "medium",
    isPinned: isPinned || false,
    isFavorite: isFavorite || false,
    isAIGenerated: false,
  });

  await card.save();

  res.status(201).json({
    success: true,
    message: "Card created successfully",
    data: card,
  });
});

// Get all user cards
const getCards = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    difficulty,
    isPinned,
    isFavorite,
    isAIGenerated,
    noteId,
  } = req.validatedQuery || req.query;

  const filters = {};

  if (difficulty) filters.difficulty = difficulty;
  if (isPinned !== undefined) filters.isPinned = isPinned === "true";
  if (isFavorite !== undefined) filters.isFavorite = isFavorite === "true";
  if (isAIGenerated !== undefined)
    filters.isAIGenerated = isAIGenerated === "true";
  if (noteId) filters.noteId = noteId;

  const options = {
    limit: parseInt(limit),
    skip: (parseInt(page) - 1) * parseInt(limit),
    sort: { isPinned: -1, createdAt: -1 },
  };

  const cards = await Card.getUserCards(req.user._id, filters, options);
  const total = await Card.countDocuments({ userId: req.user._id, ...filters });

  res.status(200).json({
    success: true,
    message: "Cards fetched successfully",
    data: {
      cards,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / parseInt(limit)),
        totalCards: total,
        cardsPerPage: parseInt(limit),
      },
    },
  });
});

// Get a single card by ID
const getCardById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const card = await Card.findOne({ _id: id, userId: req.user._id });

  if (!card) {
    return res.status(404).json({
      success: false,
      message: "Card not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Card fetched successfully",
    data: card,
  });
});

// Update a card
const updateCard = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { title, content, tags, color, difficulty, isPinned, isFavorite } =
    req.body;

  const card = await Card.findOne({ _id: id, userId: req.user._id });

  if (!card) {
    return res.status(404).json({
      success: false,
      message: "Card not found",
    });
  }

  // Update fields if provided
  if (title !== undefined) card.title = title;
  if (content !== undefined) card.content = content;
  if (tags !== undefined) card.tags = tags;
  if (color !== undefined) card.color = color;
  if (difficulty !== undefined) card.difficulty = difficulty;
  if (isPinned !== undefined) card.isPinned = isPinned;
  if (isFavorite !== undefined) card.isFavorite = isFavorite;

  await card.save();

  res.status(200).json({
    success: true,
    message: "Card updated successfully",
    data: card,
  });
});

// Delete a card
const deleteCard = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const card = await Card.findOneAndDelete({ _id: id, userId: req.user._id });

  if (!card) {
    return res.status(404).json({
      success: false,
      message: "Card not found",
    });
  }

  res.status(200).json({
    success: true,
    message: "Card deleted successfully",
  });
});

// Search cards
const searchCards = asyncHandler(async (req, res) => {
  const { query } = req.validatedQuery || req.query;

  if (!query || query.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Search query is required",
    });
  }

  const cards = await Card.searchCards(req.user._id, query);

  res.status(200).json({
    success: true,
    message: "Search completed successfully",
    data: {
      cards,
      count: cards.length,
    },
  });
});

// Get cards by note
const getCardsByNote = asyncHandler(async (req, res) => {
  const { noteId } = req.params;

  const cards = await Card.getCardsByNote(req.user._id, noteId);

  res.status(200).json({
    success: true,
    message: `Cards for note fetched successfully`,
    data: {
      cards,
      count: cards.length,
    },
  });
});

// Get cards by difficulty
const getCardsByDifficulty = asyncHandler(async (req, res) => {
  const { difficulty } = req.params;

  const cards = await Card.getCardsByDifficulty(req.user._id, difficulty);

  res.status(200).json({
    success: true,
    message: `Cards with difficulty "${difficulty}" fetched successfully`,
    data: {
      cards,
      count: cards.length,
    },
  });
});

// Toggle pin status
const togglePin = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const card = await Card.findOne({ _id: id, userId: req.user._id });

  if (!card) {
    return res.status(404).json({
      success: false,
      message: "Card not found",
    });
  }

  card.isPinned = !card.isPinned;
  await card.save();

  res.status(200).json({
    success: true,
    message: `Card ${card.isPinned ? "pinned" : "unpinned"} successfully`,
    data: card,
  });
});

// Toggle favorite status
const toggleFavorite = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const card = await Card.findOne({ _id: id, userId: req.user._id });

  if (!card) {
    return res.status(404).json({
      success: false,
      message: "Card not found",
    });
  }

  card.isFavorite = !card.isFavorite;
  await card.save();

  res.status(200).json({
    success: true,
    message: `Card ${card.isFavorite ? "added to" : "removed from"} favorites successfully`,
    data: card,
  });
});

// Mark card as reviewed
const markAsReviewed = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const card = await Card.findOne({ _id: id, userId: req.user._id });

  if (!card) {
    return res.status(404).json({
      success: false,
      message: "Card not found",
    });
  }

  await card.markAsReviewed();

  res.status(200).json({
    success: true,
    message: "Card marked as reviewed successfully",
    data: {
      reviewCount: card.reviewCount,
      lastReviewedAt: card.lastReviewedAt,
    },
  });
});

// Get all user tags
const getUserTags = asyncHandler(async (req, res) => {
  const tags = await Card.distinct("tags", {
    userId: req.user._id,
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

// Delete all cards for a specific note
const deleteCardsByNote = asyncHandler(async (req, res) => {
  const { noteId } = req.params;

  const result = await Card.deleteMany({
    userId: req.user._id,
    noteId: noteId,
  });

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} cards deleted successfully`,
    data: {
      deletedCount: result.deletedCount,
    },
  });
});

const generateFlashcards = asyncHandler(async (req, res) => {
  const { noteId } = req.body;

  // Validate noteId
  if (!noteId) {
    return res.status(400).json({
      success: false,
      message: "Note ID is required",
    });
  }

  // Find the note
  const note = await Note.findById(noteId);

  if (!note) {
    return res.status(404).json({
      success: false,
      message: "Note not found",
    });
  }

  // Check if the note belongs to the authenticated user
  if (note.userId.toString() !== req.user._id.toString()) {
    return res.status(403).json({
      success: false,
      message: "Unauthorized: You do not have access to this note",
    });
  }

  // Extract text content from the note
  const textContent = note.plainText || note.extractPlainText();

  if (!textContent || textContent.trim() === "") {
    return res.status(400).json({
      success: false,
      message: "Note has no text content to generate flashcards from",
    });
  }

  try {
    // Get the flashcard generation prompt
    const systemPrompt = getPrompt(PROMPTS.FLASHCARD);

    // Prepare messages for the AI
    const messages = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: `Generate flashcards from the following note content:\n\n${textContent}`,
      },
    ];

    // Make API call to generate flashcards
    const response = await chatCompletion(messages);
    const messageContent = extractMessageContent(response);

    // Parse the JSON response
    let flashcardsData;
    try {
      // Try to parse the response as JSON
      flashcardsData = JSON.parse(messageContent);
    } catch (parseError) {
      // If parsing fails, try to extract JSON from the response
      const jsonMatch = messageContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        flashcardsData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Failed to parse flashcard data from AI response");
      }
    }

    // Validate the structure of the response
    if (
      !flashcardsData ||
      typeof flashcardsData.numberOfCards !== "number" ||
      !Array.isArray(flashcardsData.cards)
    ) {
      return res.status(500).json({
        success: false,
        message: "Invalid flashcard data format received from AI",
      });
    }

    // Validate each card has title and content
    const validCards = flashcardsData.cards.filter(
      (card) =>
        card &&
        typeof card.title === "string" &&
        typeof card.content === "string" &&
        card.title.trim() !== "" &&
        card.content.trim() !== "",
    );

    if (validCards.length === 0) {
      return res.status(500).json({
        success: false,
        message: "No valid flashcards were generated",
      });
    }

    // Return the flashcards to the frontend first for better UX
    res.status(200).json({
      success: true,
      message: "Flashcards generated successfully",
      data: {
        noteId: note._id,
        noteTitle: note.title,
        numberOfCards: validCards.length,
        cards: validCards,
      },
    });

    // Save cards to database asynchronously (after response sent)
    // This improves user experience by not making them wait
    setImmediate(async () => {
      try {
        const cardsToSave = validCards.map((card) => ({
          userId: req.user._id,
          noteId: note._id,
          title: card.title,
          content: card.content,
          isAIGenerated: true,
        }));

        await Card.insertMany(cardsToSave);
        console.log(
          `Successfully saved ${cardsToSave.length} cards for user ${req.user._id}`,
        );
      } catch (saveError) {
        console.error("Error saving cards to database:", saveError);
        // Don't throw error since response is already sent
      }
    });
  } catch (error) {
    console.error("Error generating flashcards:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to generate flashcards",
      error: error.message,
    });
  }
});

export {
  createCard,
  getCards,
  getCardById,
  updateCard,
  deleteCard,
  searchCards,
  getCardsByNote,
  getCardsByDifficulty,
  togglePin,
  toggleFavorite,
  generateFlashcards,
  markAsReviewed,
  getUserTags,
  deleteCardsByNote,
};
