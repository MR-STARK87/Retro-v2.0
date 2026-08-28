import z from "zod";

const username = z
  .string()
  .min(3, "Username must be at least 3 characters long")
  .max(30, "Username must be at most 30 characters long")
  .regex(
    /^[a-zA-Z0-9_]+$/,
    "Username can only contain letters, numbers, and underscores",
  );

const email = z.string().email("Invalid email address");

const password = z
  .string()
  .nonempty("Password cannot be empty")
  .min(8, "Password must be at least 8 characters long")
  .max(100, "Password must be at most 100 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[\W_]/, "Password must contain at least one special character");

const firstName = z
  .string()
  .min(1, "First name is required")
  .max(50, "First name must be at most 50 characters long")
  .regex(
    /^[a-zA-Z\s'-]+$/,
    "First name can only contain letters, spaces, hyphens, and apostrophes",
  )
  .trim();

const lastName = z
  .string()
  .min(1, "Last name is required")
  .max(50, "Last name must be at most 50 characters long")
  .regex(
    /^[a-zA-Z\s'-]+$/,
    "Last name can only contain letters, spaces, hyphens, and apostrophes",
  )
  .trim();

export { username, email, password, firstName, lastName };
