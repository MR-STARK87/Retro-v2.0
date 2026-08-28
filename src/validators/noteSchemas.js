import z from "zod";

// Schema for creating a new note
const createNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title is required")
    .max(200, "Title cannot exceed 200 characters"),
  content: z
    .any()
    .refine(
      (data) =>
        data &&
        typeof data === "object" &&
        data.ops &&
        Array.isArray(data.ops) &&
        data.ops.length > 0,
      {
        message:
          "Content must be a valid Quill Delta format with at least one operation",
      },
    ),
  tags: z.array(z.string()).max(10, "Cannot have more than 10 tags").optional(),
  category: z
    .string()
    .trim()
    .max(50, "Category name cannot exceed 50 characters")
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format. Use hex color code")
    .optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
});

// Schema for updating a note
const updateNoteSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Title cannot be empty")
    .max(200, "Title cannot exceed 200 characters")
    .optional(),
  content: z
    .any()
    .refine(
      (data) =>
        !data ||
        (typeof data === "object" && data.ops && Array.isArray(data.ops)),
      {
        message: "Content must be a valid Quill Delta format",
      },
    )
    .optional(),
  tags: z.array(z.string()).max(10, "Cannot have more than 10 tags").optional(),
  category: z
    .string()
    .trim()
    .max(50, "Category name cannot exceed 50 characters")
    .optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format. Use hex color code")
    .optional(),
  isPinned: z.boolean().optional(),
  isFavorite: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

// Schema for search query
const searchNotesSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1, "Search query is required")
    .max(100, "Search query cannot exceed 100 characters"),
});

// Schema for get notes with filters
const getNotesSchema = z.object({
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
  category: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  isPinned: z.enum(["true", "false"]).optional(),
  isFavorite: z.enum(["true", "false"]).optional(),
  isArchived: z.enum(["true", "false"]).optional(),
});

export {
  createNoteSchema,
  updateNoteSchema,
  searchNotesSchema,
  getNotesSchema,
};
