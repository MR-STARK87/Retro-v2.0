import z from "zod";

// Schema for completing the post-signup setup wizard
const completeSetupSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, "Display name is required")
    .max(50, "Display name cannot exceed 50 characters"),
  role: z
    .string()
    .trim()
    .min(1, "Please select what best describes you")
    .max(60),
  subjects: z
    .array(z.string().trim().min(1).max(40))
    .max(10, "Cannot select more than 10 subjects")
    .default([]),
  goal: z
    .string()
    .trim()
    .max(200, "Goal cannot exceed 200 characters")
    .default(""),
  answerStyle: z.enum(["crisp", "balanced", "detailed"]),
  tone: z.enum(["casual", "formal"]),
  anythingElse: z
    .string()
    .trim()
    .max(500, "Cannot exceed 500 characters")
    .default(""),
});

export { completeSetupSchema };
