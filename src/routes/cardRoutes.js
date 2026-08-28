import express from "express";
import tokenChecker from "../middlewares/tokenChecker.js";
import rateLimiter from "../middlewares/rateLimiter.js";
import { checkUsageLimit, trackUsage } from "../middlewares/usageTracker.js";
import validate from "../middlewares/validate.js";
import {
  createCardSchema,
  updateCardSchema,
  searchCardsSchema,
  getCardsSchema,
  generateFlashcardsSchema,
} from "../validators/flashcardSchemas.js";
import {
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
  markAsReviewed,
  getUserTags,
  deleteCardsByNote,
  generateFlashcards,
} from "../controllers/card.js";

const router = express.Router();

// All routes are protected by tokenChecker middleware
router.use(tokenChecker);

// Generate flashcards from a note
router.post(
  "/ai",
  rateLimiter("ai"),
  checkUsageLimit("flashcardGenerations"),
  validate({ body: generateFlashcardsSchema }),
  trackUsage("flashcardGenerations"),
  generateFlashcards,
);

// Create a new card manually
router.post(
  "/",
  rateLimiter("flashcards"),
  validate({ body: createCardSchema }),
  createCard,
);

// Get all cards with optional filters
router.get(
  "/",
  rateLimiter("flashcards"),
  validate({ query: getCardsSchema }),
  getCards,
);

// Search cards
router.get("/search", validate({ query: searchCardsSchema }), searchCards);

// Get all user tags
router.get("/tags", getUserTags);

// Get cards by difficulty
router.get("/difficulty/:difficulty", getCardsByDifficulty);

// Get cards by note
router.get("/note/:noteId", getCardsByNote);

// Delete all cards for a specific note
router.delete("/note/:noteId", deleteCardsByNote);

// Get a single card by ID
router.get("/:id", getCardById);

// Update a card
router.put("/:id", validate({ body: updateCardSchema }), updateCard);

// Delete a card
router.delete("/:id", deleteCard);

// Toggle pin status
router.patch("/:id/pin", togglePin);

// Toggle favorite status
router.patch("/:id/favorite", toggleFavorite);

// Mark card as reviewed
router.patch("/:id/review", markAsReviewed);

export default router;
