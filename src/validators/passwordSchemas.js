import z from "zod";
import { password, email } from "./validationRules.js";

const resetPasswordSchema = z
  .object({
    password: z.string().nonempty("Password cannot be empty"),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
  });

const forgetPasswordSchema = z.object({
  email,
});

const changePasswordSchema = z
  .object({
    password: password,
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
  });

export { resetPasswordSchema, forgetPasswordSchema, changePasswordSchema };
