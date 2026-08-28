import mongoose from "mongoose";

const contextSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    context: {
      type: String,
      default: "",
    },
    preferences: {
      type: [String],
      default: [],
    },
    // Setup wizard data — never written by the context generator, only by the
    // onboarding flow, so these facts are durable and cannot be "forgotten".
    displayName: {
      type: String,
      default: "",
    },
    stableContext: {
      type: String,
      default: "",
    },
    setupCompleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Method to clear the context field
contextSchema.methods.clearContext = function () {
  this.context = "";
  return this.save();
};

const UserContext = mongoose.model("UserContext", contextSchema);

export default UserContext;
