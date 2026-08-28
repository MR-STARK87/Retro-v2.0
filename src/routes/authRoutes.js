import { registerUser } from "../controllers/auth.js";
import validate from "../middlewares/validate.js";
import registerSchema from "../validators/registerSchema.js";
import loginSchema from "../validators/loginSchema.js";
import express from "express";
import { loginUser } from "../controllers/auth.js";
import { logoutUser } from "../controllers/auth.js";
import { getCurrentUser } from "../controllers/auth.js";
import { verifyEmail } from "../controllers/auth.js";
import tokenChecker from "../middlewares/tokenChecker.js";
import { forgotPassword } from "../controllers/auth.js";
import { resetPassword } from "../controllers/auth.js";
import { resendVerificationEmail } from "../controllers/auth.js";
import { refreshAccessToken } from "../controllers/auth.js";
import {
  resetPasswordSchema,
  forgetPasswordSchema,
} from "../validators/passwordSchemas.js";

const router = express.Router();

router.post("/register", validate({ body: registerSchema }), registerUser);
router.post("/login", validate({ body: loginSchema }), loginUser);
router.post("/logout", tokenChecker, logoutUser);
router.get("/verify-email", verifyEmail);
router.get("/me", tokenChecker, getCurrentUser);
router.post(
  "/forgot-password",
  validate({ body: forgetPasswordSchema }),
  forgotPassword,
);
router.post(
  "/reset-password",
  validate({ body: resetPasswordSchema }),
  resetPassword,
);
router.post(
  "/resend-verification-email",
  tokenChecker,
  resendVerificationEmail,
);
router.post("/refresh-token", refreshAccessToken);
export default router;
