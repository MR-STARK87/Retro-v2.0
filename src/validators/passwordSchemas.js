import z from "zod";
import { password, email } from "./validationRules.js";

const resetPasswordSchema = z.object({
  password: z.string().nonempty("Password cannot be empty"),
  newPassword: password,
});

const forgetPasswordSchema = z.object({
  email,
});

export { resetPasswordSchema, forgetPasswordSchema };
