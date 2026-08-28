import express from "express";
import tokenChecker from "../middlewares/tokenChecker.js";
import validate from "../middlewares/validate.js";
import {
  completeSetup,
  getSetupStatus,
} from "../controllers/onboarding.js";
import { completeSetupSchema } from "../validators/onboardingSchema.js";

const router = express.Router();

router.post(
  "/",
  tokenChecker,
  validate({ body: completeSetupSchema }),
  completeSetup,
);
router.get("/status", tokenChecker, getSetupStatus);

export default router;
