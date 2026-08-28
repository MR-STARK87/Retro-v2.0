import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Note title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    content: {
      type: mongoose.Schema.Types.Mixed,
      required: [true, "Note content is required"],
      // Stores Quill Delta format (rich text JSON)
    },
    plainText: {
      type: String,
      // Stores plain text version for search and preview
      maxlength: [50000, "Content cannot exceed 50000 characters"],
    },
    tags: [
      {
        type: String,
        trim: true,
        lowercase: true,
      },
    ],
    category: {
      type: String,
      trim: true,
      default: "General",
    },
    isPinned: {
      type: Boolean,
      default: false,
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    color: {
      type: String,
      default: "#ffffff",
      // For color-coding notes
    },
    lastEditedAt: {
      type: Date,
      default: Date.now,
    },
    sharedWith: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        permission: {
          type: String,
          enum: ["view", "edit"],
          default: "view",
        },
      },
    ],
    reminder: {
      type: Date,
      default: null,
    },
    attachments: [
      {
        fileName: String,
        fileUrl: String,
        fileType: String,
        fileSize: Number,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// Index for efficient searching
noteSchema.index({ userId: 1, createdAt: -1 });
noteSchema.index({ userId: 1, isPinned: -1, createdAt: -1 });
noteSchema.index({ userId: 1, tags: 1 });
noteSchema.index({ userId: 1, category: 1 });
noteSchema.index({ plainText: "text", title: "text" }); // Text search index

// Pre-save middleware to update lastEditedAt
noteSchema.pre("save", function (next) {
  if (this.isModified("content") || this.isModified("title")) {
    this.lastEditedAt = Date.now();
  }
  next();
});

// Method to extract plain text from Quill Delta
noteSchema.methods.extractPlainText = function () {
  if (!this.content || !this.content.ops) {
    return "";
  }

  return this.content.ops
    .map((op) => {
      if (typeof op.insert === "string") {
        return op.insert;
      }
      return "";
    })
    .join("");
};

// Static method to get user's notes with filters
noteSchema.statics.getUserNotes = async function (
  userId,
  filters = {},
  options = {},
) {
  const query = { userId, isArchived: false, ...filters };
  const {
    limit = 20,
    skip = 0,
    sort = { isPinned: -1, lastEditedAt: -1 },
  } = options;

  return this.find(query)
    .sort(sort)
    .limit(limit)
    .skip(skip)
    .select("-__v");
};

// Static method to search notes
noteSchema.statics.searchNotes = async function (userId, searchTerm) {
  return this.find({
    userId,
    isArchived: false,
    $or: [
      { title: { $regex: searchTerm, $options: "i" } },
      { plainText: { $regex: searchTerm, $options: "i" } },
      { tags: { $in: [new RegExp(searchTerm, "i")] } },
    ],
  })
    .sort({ isPinned: -1, lastEditedAt: -1 })
    .select("-__v");
};

// Static method to get notes by tag
noteSchema.statics.getNotesByTag = async function (userId, tag) {
  return this.find({
    userId,
    tags: tag.toLowerCase(),
    isArchived: false,
  })
    .sort({ isPinned: -1, lastEditedAt: -1 })
    .select("-__v");
};

// Static method to get notes by category
noteSchema.statics.getNotesByCategory = async function (userId, category) {
  return this.find({
    userId,
    category,
    isArchived: false,
  })
    .sort({ isPinned: -1, lastEditedAt: -1 })
    .select("-__v");
};

// Virtual for formatted date
noteSchema.virtual("formattedDate").get(function () {
  return this.createdAt.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
});

// Ensure virtuals are included in JSON
noteSchema.set("toJSON", { virtuals: true });
noteSchema.set("toObject", { virtuals: true });

const Note = mongoose.models.Note || mongoose.model("Note", noteSchema);

export default Note;
