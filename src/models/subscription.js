import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tier: {
      type: String,
      enum: ["free", "pro", "premium"],
      required: true,
      default: "free",
    },
    status: {
      type: String,
      enum: ["active", "cancelled", "past_due", "trialing", "incomplete"],
      required: true,
      default: "active",
    },
    stripeCustomerId: {
      type: String,
      index: true,
    },
    stripeSubscriptionId: {
      type: String,
      unique: true,
      sparse: true,
    },
    stripePriceId: {
      type: String,
    },
    currentPeriodStart: {
      type: Date,
    },
    currentPeriodEnd: {
      type: Date,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: {
      type: Date,
    },
    billingCycle: {
      type: String,
      enum: ["monthly", "yearly"],
    },
    amount: {
      type: Number,
    },
    currency: {
      type: String,
      default: "usd",
    },
    paymentHistory: [
      {
        invoiceId: String,
        amount: Number,
        currency: String,
        status: {
          type: String,
          enum: ["paid", "failed", "pending"],
        },
        paidAt: Date,
        invoiceUrl: String,
      },
    ],
    metadata: {
      type: Map,
      of: String,
    },
  },
  { timestamps: true }
);

// Index for efficient queries
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ stripeCustomerId: 1 });
subscriptionSchema.index({ currentPeriodEnd: 1 });

// Methods
subscriptionSchema.methods.isActive = function () {
  return (
    this.status === "active" ||
    this.status === "trialing" ||
    (this.status === "cancelled" &&
     this.currentPeriodEnd &&
     new Date() < this.currentPeriodEnd)
  );
};

subscriptionSchema.methods.hasFeatureAccess = function (feature) {
  if (!this.isActive()) return false;

  const tierFeatures = {
    free: ["basic_notes", "basic_chat", "basic_flashcards"],
    pro: [
      "basic_notes",
      "basic_chat",
      "basic_flashcards",
      "advanced_notes",
      "extended_chat",
      "advanced_flashcards",
      "note_export",
      "full_music_library",
      "ambient_colors",
    ],
    premium: [
      "basic_notes",
      "basic_chat",
      "basic_flashcards",
      "advanced_notes",
      "extended_chat",
      "advanced_flashcards",
      "note_export",
      "full_music_library",
      "ambient_colors",
      "unlimited_ai",
      "api_access",
      "priority_support",
      "analytics",
    ],
  };

  return tierFeatures[this.tier]?.includes(feature) || false;
};

const Subscription =
  mongoose.models.Subscription ||
  mongoose.model("Subscription", subscriptionSchema);

export default Subscription;
