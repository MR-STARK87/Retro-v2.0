import Stripe from "stripe";
import User from "../models/user.js";
import Subscription from "../models/subscription.js";
import { getUsageStats } from "../middlewares/usageTracker.js";

// Initialize Stripe only if API key is available
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

// Price IDs (these should be set in .env file)
const PRICE_IDS = {
  pro_monthly: process.env.STRIPE_PRICE_PRO_MONTHLY,
  pro_yearly: process.env.STRIPE_PRICE_PRO_YEARLY,
  premium_monthly: process.env.STRIPE_PRICE_PREMIUM_MONTHLY,
  premium_yearly: process.env.STRIPE_PRICE_PREMIUM_YEARLY,
};

/**
 * Create a checkout session for subscription
 */
export const createCheckoutSession = async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message:
          "Payment system is not configured. Please add STRIPE_SECRET_KEY to your environment variables.",
      });
    }

    const { priceId, tier, billingCycle } = req.body;
    const userId = req.user._id;

    // Validate inputs
    if (!priceId || !tier || !billingCycle) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Validate tier
    if (!["pro", "premium"].includes(tier)) {
      return res.status(400).json({
        success: false,
        message: "Invalid subscription tier",
      });
    }

    // Get user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user already has an active subscription
    if (user.subscription?.tier !== "free") {
      return res.status(400).json({
        success: false,
        message:
          "You already have an active subscription. Please manage it from your account settings.",
      });
    }

    // Create or get Stripe customer
    let customerId = user.subscription?.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId: userId.toString(),
          username: user.username,
        },
      });
      customerId = customer.id;

      // Save customer ID
      await User.findByIdAndUpdate(userId, {
        "subscription.stripeCustomerId": customerId,
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/upgrade?canceled=true`,
      metadata: {
        userId: userId.toString(),
        tier,
        billingCycle,
      },
    });

    res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("Error creating checkout session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create checkout session",
      error: error.message,
    });
  }
};

/**
 * Handle Stripe webhooks
 */
export const handleWebhook = async (req, res) => {
  // Check if Stripe is configured
  if (!stripe) {
    return res.status(503).json({
      success: false,
      message: "Payment system is not configured",
    });
  }

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.paid":
        await handleInvoicePaid(event.data.object);
        break;

      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("Error handling webhook:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
};

/**
 * Get current subscription status
 */
export const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select("subscription usage");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get usage statistics
    const usageStats = await getUsageStats(userId);

    // Get subscription details from Stripe if available
    let stripeSubscription = null;
    if (stripe && user.subscription?.stripeSubscriptionId) {
      try {
        stripeSubscription = await stripe.subscriptions.retrieve(
          user.subscription.stripeSubscriptionId,
        );
      } catch (error) {
        console.error("Error fetching Stripe subscription:", error);
      }
    }

    res.status(200).json({
      success: true,
      subscription: {
        tier: user.subscription?.tier || "free",
        status: user.subscription?.status || "active",
        startDate: user.subscription?.startDate,
        endDate: user.subscription?.endDate,
        cancelAtPeriodEnd: stripeSubscription?.cancel_at_period_end || false,
        currentPeriodEnd: stripeSubscription?.current_period_end
          ? new Date(stripeSubscription.current_period_end * 1000)
          : null,
      },
      usage: usageStats,
    });
  } catch (error) {
    console.error("Error getting subscription status:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get subscription status",
      error: error.message,
    });
  }
};

/**
 * Cancel subscription
 */
export const cancelSubscription = async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: "Payment system is not configured",
      });
    }

    const userId = req.user._id;

    const user = await User.findById(userId).select("subscription");

    if (!user || !user.subscription?.stripeSubscriptionId) {
      return res.status(404).json({
        success: false,
        message: "No active subscription found",
      });
    }

    // Cancel at period end (don't immediately cancel)
    const subscription = await stripe.subscriptions.update(
      user.subscription.stripeSubscriptionId,
      {
        cancel_at_period_end: true,
      },
    );

    res.status(200).json({
      success: true,
      message:
        "Subscription will be cancelled at the end of the billing period",
      cancelAt: new Date(subscription.current_period_end * 1000),
    });
  } catch (error) {
    console.error("Error cancelling subscription:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel subscription",
      error: error.message,
    });
  }
};

/**
 * Resume cancelled subscription
 */
export const resumeSubscription = async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: "Payment system is not configured",
      });
    }

    const userId = req.user._id;

    const user = await User.findById(userId).select("subscription");

    if (!user || !user.subscription?.stripeSubscriptionId) {
      return res.status(404).json({
        success: false,
        message: "No subscription found",
      });
    }

    // Remove cancel_at_period_end flag
    await stripe.subscriptions.update(user.subscription.stripeSubscriptionId, {
      cancel_at_period_end: false,
    });

    res.status(200).json({
      success: true,
      message: "Subscription resumed successfully",
    });
  } catch (error) {
    console.error("Error resuming subscription:", error);
    res.status(500).json({
      success: false,
      message: "Failed to resume subscription",
      error: error.message,
    });
  }
};

/**
 * Create portal session for managing subscription
 */
export const createPortalSession = async (req, res) => {
  try {
    // Check if Stripe is configured
    if (!stripe) {
      return res.status(503).json({
        success: false,
        message: "Payment system is not configured",
      });
    }

    const userId = req.user._id;

    const user = await User.findById(userId).select("subscription");

    if (!user?.subscription?.stripeCustomerId) {
      return res.status(404).json({
        success: false,
        message: "No customer found",
      });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.subscription.stripeCustomerId,
      return_url: `${process.env.CLIENT_URL || "http://localhost:3000"}/app`,
    });

    res.status(200).json({
      success: true,
      url: session.url,
    });
  } catch (error) {
    console.error("Error creating portal session:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create portal session",
      error: error.message,
    });
  }
};

/**
 * Get available pricing plans
 */
export const getPricingPlans = async (req, res) => {
  try {
    const plans = [
      {
        tier: "free",
        name: "Free",
        price: 0,
        features: [
          "Up to 25 notes",
          "Up to 100 flashcards",
          "20 AI chat messages/month",
          "5 chat with note queries/month",
          "2 flashcard generations/month",
          "Basic ambient mode (default sky only)",
          "Basic music library",
        ],
      },
      {
        tier: "pro",
        name: "Pro",
        monthlyPrice: 7.99,
        yearlyPrice: 59.99,
        priceIds: {
          monthly: PRICE_IDS.pro_monthly,
          yearly: PRICE_IDS.pro_yearly,
        },
        features: [
          "Up to 500 notes",
          "Up to 2,000 flashcards",
          "300 AI chat messages/month",
          "100 chat with note queries/month",
          "30 flashcard generations/month",
          "All ambient mode colors",
          "Full music library",
          "Smarter AI model",
          "Note export (PDF, Markdown)",
          "Priority support",
        ],
        savings: "Save 37% with yearly",
      },
      {
        tier: "premium",
        name: "Premium",
        monthlyPrice: 14.99,
        yearlyPrice: 119.99,
        priceIds: {
          monthly: PRICE_IDS.premium_monthly,
          yearly: PRICE_IDS.premium_yearly,
        },
        features: [
          "Unlimited notes",
          "Unlimited flashcards",
          "Unlimited AI chat messages",
          "Unlimited chat with note queries",
          "Unlimited flashcard generations",
          "All ambient mode colors",
          "Full music library + custom uploads",
          "Smartest AI model",
          "Advanced note export (all formats)",
          "Priority support",
          "Memory storage in Retro chat",
          "Analytics dashboard",
          "API access",
        ],
        savings: "Save 33% with yearly",
        popular: true,
      },
    ];

    res.status(200).json({
      success: true,
      plans,
    });
  } catch (error) {
    console.error("Error getting pricing plans:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get pricing plans",
      error: error.message,
    });
  }
};

// Webhook helper functions

async function handleCheckoutCompleted(session) {
  const userId = session.metadata.userId;
  const tier = session.metadata.tier;
  const billingCycle = session.metadata.billingCycle;

  // Get subscription details
  const stripeSubscription = await stripe.subscriptions.retrieve(
    session.subscription,
  );

  // Update user
  await User.findByIdAndUpdate(userId, {
    "subscription.tier": tier,
    "subscription.status": "active",
    "subscription.stripeSubscriptionId": session.subscription,
    "subscription.startDate": new Date(
      stripeSubscription.current_period_start * 1000,
    ),
    "subscription.endDate": new Date(
      stripeSubscription.current_period_end * 1000,
    ),
  });

  // Create subscription record
  await Subscription.create({
    userId,
    tier,
    status: "active",
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
    stripePriceId: stripeSubscription.items.data[0].price.id,
    currentPeriodStart: new Date(
      stripeSubscription.current_period_start * 1000,
    ),
    currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
    billingCycle,
    amount: stripeSubscription.items.data[0].price.unit_amount / 100,
    currency: stripeSubscription.currency,
  });

  console.log(`✅ Subscription activated for user ${userId} - Tier: ${tier}`);
}

async function handleSubscriptionUpdated(subscription) {
  const customerId = subscription.customer;

  // Find user by customer ID
  const user = await User.findOne({
    "subscription.stripeCustomerId": customerId,
  });

  if (!user) {
    console.error("User not found for customer:", customerId);
    return;
  }

  // Update subscription status
  await User.findByIdAndUpdate(user._id, {
    "subscription.status": subscription.status,
    "subscription.endDate": new Date(subscription.current_period_end * 1000),
  });

  // Update subscription record
  await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: subscription.id },
    {
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  );

  console.log(`✅ Subscription updated for user ${user._id}`);
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;

  // Find user by customer ID
  const user = await User.findOne({
    "subscription.stripeCustomerId": customerId,
  });

  if (!user) {
    console.error("User not found for customer:", customerId);
    return;
  }

  // Downgrade to free tier
  await User.findByIdAndUpdate(user._id, {
    "subscription.tier": "free",
    "subscription.status": "cancelled",
    "subscription.endDate": new Date(),
  });

  // Update subscription record
  await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: subscription.id },
    {
      status: "cancelled",
      canceledAt: new Date(),
    },
  );

  console.log(`✅ Subscription cancelled for user ${user._id}`);
}

async function handleInvoicePaid(invoice) {
  const customerId = invoice.customer;
  const subscriptionId = invoice.subscription;

  // Find user
  const user = await User.findOne({
    "subscription.stripeCustomerId": customerId,
  });

  if (!user) return;

  // Add to payment history
  await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: subscriptionId },
    {
      $push: {
        paymentHistory: {
          invoiceId: invoice.id,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency,
          status: "paid",
          paidAt: new Date(invoice.status_transitions.paid_at * 1000),
          invoiceUrl: invoice.hosted_invoice_url,
        },
      },
    },
  );

  console.log(`✅ Invoice paid for user ${user._id}`);
}

async function handlePaymentFailed(invoice) {
  const customerId = invoice.customer;

  // Find user
  const user = await User.findOne({
    "subscription.stripeCustomerId": customerId,
  });

  if (!user) return;

  // Update status to past_due
  await User.findByIdAndUpdate(user._id, {
    "subscription.status": "past_due",
  });

  console.log(`⚠️ Payment failed for user ${user._id}`);
}
