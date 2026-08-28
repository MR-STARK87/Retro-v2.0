import z from "zod";
import {
  email,
  password,
  username,
  firstName,
  lastName,
} from "./validationRules.js";

const registerSchema = z
  .object({
    firstName,
    lastName,
    username,
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
  });

export default registerSchema;

export { username, email, password, firstName, lastName };
