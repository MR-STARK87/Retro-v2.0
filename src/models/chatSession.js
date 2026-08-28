import mongoose from "mongoose";

const chatSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
    default: "New Chat",
  },
  messages: [
    {
      sender: {
        type: String,
        enum: ["user", "ai"],
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Static methods - MUST be defined BEFORE creating the model
chatSessionSchema.statics.createChatSession = async function (
  userId,
  title = "New Chat",
) {
  const chatSession = new this({
    userId,
    title,
    messages: [],
  });
  return await chatSession.save();
};

chatSessionSchema.statics.getChatSessionsByUserId = async function (userId) {
  return await this.find({ userId }).sort({ updatedAt: -1 });
};

chatSessionSchema.statics.deleteChatSession = async function (
  userId,
  sessionId,
) {
  const session = await this.findOne({
    _id: sessionId,
    userId,
  });

  if (!session) {
    throw new Error("Chat session not found");
  }

  await this.deleteOne({ _id: sessionId, userId });
  return session;
};

// Create the model AFTER defining static methods
const ChatSession = mongoose.model("ChatSession", chatSessionSchema);

export default ChatSession;
