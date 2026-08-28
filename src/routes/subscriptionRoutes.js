import express from "express";
import tokenChecker from "../middlewares/tokenChecker.js";
import {
  createCheckoutSession,
  handleWebhook,
  getSubscriptionStatus,
  cancelSubscription,
  resumeSubscription,
  createPortalSession,
  getPricingPlans,
} from "../controllers/subscription.js";

const router = express.Router();

// Public routes
router.get("/pricing", getPricingPlans);

// Stripe webhook (must be before express.json() middleware)
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook
);

// Protected routes
router.use(tokenChecker);

router.post("/checkout", createCheckoutSession);
router.get("/status", getSubscriptionStatus);
router.post("/cancel", cancelSubscription);
router.post("/resume", resumeSubscription);
router.post("/portal", createPortalSession);

export default router;
