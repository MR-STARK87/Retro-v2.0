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
