import mongoose from "mongoose";

const cardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    noteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Note",
      default: null,
      index: true,
      // Reference to the note from which this card was generated (if applicable)
    },
    title: {
      type: String,
      required: [true, "Card title is required"],
      trim: true,
      maxlength: [500, "Title cannot exceed 500 characters"],
    },
    content: {
      type: String,
      required: [true, "Card content is required"],
      trim: true,
      maxlength: [2000, "Content cannot exceed 2000 characters"],
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    color: {
      type: String,
      default: "#ffffff",
      // For color-coding cards
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },
    reviewCount: {
      type: Number,
      default: 0,
      // Number of times the card has been reviewed
    },
    lastReviewedAt: {
      type: Date,
      default: null,
      // Last time the card was reviewed
    },
    isAIGenerated: {
      type: Boolean,
      default: false,
      // Indicates if the card was AI-generated or manually created
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient querying
cardSchema.index({ userId: 1, createdAt: -1 });
cardSchema.index({ userId: 1, isPinned: -1, createdAt: -1 });
cardSchema.index({ userId: 1, isFavorite: -1 });
cardSchema.index({ userId: 1, noteId: 1 });
cardSchema.index({ userId: 1, difficulty: 1 });
cardSchema.index({ title: "text", content: "text" }); // Text search index

// Static method to get user's cards with filters
cardSchema.statics.getUserCards = async function (
  userId,
  filters = {},
  options = {}
) {
  const query = { userId, ...filters };
  const {
    limit = 20,
    skip = 0,
    sort = { isPinned: -1, createdAt: -1 },
  } = options;

  return this.find(query).sort(sort).limit(limit).skip(skip).select("-__v");
};

// Static method to search cards
cardSchema.statics.searchCards = async function (userId, searchTerm) {
  return this.find({
    userId,
    $or: [
      { title: { $regex: searchTerm, $options: "i" } },
      { content: { $regex: searchTerm, $options: "i" } },
      { tags: { $in: [new RegExp(searchTerm, "i")] } },
    ],
  })
    .sort({ isPinned: -1, createdAt: -1 })
    .select("-__v");
};

// Static method to get cards by note
cardSchema.statics.getCardsByNote = async function (userId, noteId) {
  return this.find({
    userId,
    noteId,
  })
    .sort({ createdAt: -1 })
    .select("-__v");
};

// Static method to get cards by difficulty
cardSchema.statics.getCardsByDifficulty = async function (userId, difficulty) {
  return this.find({
    userId,
    difficulty,
  })
    .sort({ isPinned: -1, createdAt: -1 })
    .select("-__v");
};

// Method to increment review count
cardSchema.methods.markAsReviewed = function () {
  this.reviewCount += 1;
  this.lastReviewedAt = Date.now();
  return this.save();
};

// Virtual for formatted date
cardSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

// Ensure virtuals are included in JSON
cardSchema.set("toJSON", { virtuals: true });
cardSchema.set("toObject", { virtuals: true });

const Card = mongoose.models.Card || mongoose.model("Card", cardSchema);

export default Card;
