import mongoose from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import crypto from "crypto";

dotenv.config();

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters long"],
      select: false,
    },
    isEmailVerified: { type: Boolean, default: false },
    refreshToken: { type: String, select: false },
    forgotPasswordToken: { type: String, select: false },
    forgotPasswordExpiry: { type: Date, select: false },
    emailVerificationToken: { type: String, select: false },
    emailVerificationExpiry: { type: Date, select: false },
    subscription: {
      tier: {
        type: String,
        enum: ["free", "pro", "premium"],
        default: "free",
      },
      startDate: { type: Date },
      endDate: { type: Date },
      stripeCustomerId: { type: String },
      stripeSubscriptionId: { type: String },
      autoRenew: { type: Boolean, default: true },
      status: {
        type: String,
        enum: ["active", "cancelled", "past_due", "trialing"],
        default: "active",
      },
    },
    usage: {
      aiChatMessages: {
        count: { type: Number, default: 0 },
        resetDate: { type: Date, default: () => new Date() },
      },
      flashcardGenerations: {
        count: { type: Number, default: 0 },
        resetDate: { type: Date, default: () => new Date() },
      },
      noteEnhancements: {
        count: { type: Number, default: 0 },
        resetDate: { type: Date, default: () => new Date() },
      },
      chatWithNote: {
        count: { type: Number, default: 0 },
        resetDate: { type: Date, default: () => new Date() },
      },
      storageUsed: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

const generateTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
  } catch {
    throw new Error("Error generating tokens");
  }
};

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    { _id: this._id, email: this.email, username: this.username },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: parseInt(process.env.ACCESS_TOKEN_EXPIRY) },
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { _id: this._id, email: this.email, username: this.username },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: parseInt(process.env.REFRESH_TOKEN_EXPIRY) },
  );
};

userSchema.methods.generateTemporaryToken = function () {
  const unHashedToken = crypto.randomBytes(20).toString("hex");
  const hashedToken = crypto
    .createHash("sha256")
    .update(unHashedToken)
    .digest("hex");

  const expiry = Date.now() + 10 * 60 * 1000; // 10 minutes from now
  return { unHashedToken, hashedToken, expiry };
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
export { generateTokens };
