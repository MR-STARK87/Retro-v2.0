import z from "zod";

// Schema for generating flashcards from a note
const generateFlashcardsSchema = z.object({
  noteId: z
    .string()
    .trim()
    .min(1, "Note ID is required")
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid note ID format"),
});

// Schema for creating a new card manually
const createCardSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(500, "Title cannot exceed 500 characters"),
  content: z
    .string()
    .trim()
    .min(1, "Content is required")
    .max(2000, "Content cannot exceed 2000 characters"),
  tags: z.array(z.string()).max(10, "Cannot have more than 10 tags").optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format. Use hex color code")
    .optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

// Schema for updating a card
const updateCardSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(500, "Title cannot exceed 500 characters")
    .optional(),
  content: z
    .string()
    .trim()
    .min(1, "Content cannot be empty")
    .max(2000, "Content cannot exceed 2000 characters")
    .optional(),
  tags: z.array(z.string()).max(10, "Cannot have more than 10 tags").optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format. Use hex color code")
    .optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

// Schema for search query
const searchCardsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Search query is required")
    .max(100, "Search query cannot exceed 100 characters"),
});

// Schema for get cards with filters
const getCardsSchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, "Page must be a number")
    .optional()
    .default("1")
    .transform((val) => parseInt(val)),
  limit: z
    .string()
    .regex(/^\d+$/, "Limit must be a number")
    .optional()
    .default("20")
    .transform((val) => parseInt(val))
    .refine((val) => val <= 100, "Limit cannot exceed 100"),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  isPinned: z.enum(["true", "false"]).optional(),
  isFavorite: z.enum(["true", "false"]).optional(),
  isAIGenerated: z.enum(["true", "false"]).optional(),
  noteId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid note ID format")
    .optional(),
});

export {
  generateFlashcardsSchema,
  createCardSchema,
  updateCardSchema,
  searchCardsSchema,
  getCardsSchema,
};
