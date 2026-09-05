import User from "../models/user.js";
import UserContext from "../models/userContext.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendEmail } from "../utils/mail.js";
import dotenv from "dotenv";
import { generateTokens } from "../models/user.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Shared auth cookie options (httpOnly, secure in production)
const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "Strict",
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

const registerUser = asyncHandler(async (req, res) => {
  const { firstName, lastName, username, email, password, role } = req.body;

  // Changed userName to username to match what you're destructuring
  const existingUser = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existingUser) {
    return res
      .status(400)
      .json({ message: "Username or email already in use" });
  }

  // Changed userName to username
  const user = new User({
    firstName,
    lastName,
    username,
    email,
    password,
    isEmailVerified: false,
  });

  const { unHashedToken, hashedToken, expiry } =
    await user.generateTemporaryToken();

  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpiry = expiry;
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      to: email,
      subject: "Verify Your Email - The Sloth Project",
      url: `${req.protocol}://${req.get(
        "host",
      )}/api/v1/auth/verify-email?token=${unHashedToken}`,
      template: "verification",
      firstName: firstName,
    });
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError.message);
    // Continue with registration even if email fails
  }

  const createdUser = await User.findById(user._id).select(
    "-password -__v -role",
  );

  if (!createdUser) {
    return res.status(500).json({ message: "Error creating user" });
  }

  return res
    .status(201)
    .json({ user: createdUser, message: "User registered successfully" });
});

const loginUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email) {
    return res.status(400).json({ error: "Email is required to login" });
  }
  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    return res.status(400).json({ message: "Invalid email or password" });
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(400).json({ message: "Invalid email or password" });
  }

  const tokens = await generateTokens(user._id);
  return res
    .status(200)
    .cookie("refreshToken", tokens.refreshToken, cookieOptions)
    .cookie("accessToken", tokens.accessToken, cookieOptions) // Set accessToken as a cookie
    .json({ message: "Login successful" });
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: "",
      },
    },
    {
      new: true,
    },
  );

  const option = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    path: "/",
  };
  res
    .clearCookie("accessToken", option)
    .clearCookie("refreshToken", option)
    .status(200)
    .json({ message: "Logged out successfully" });
});

const getCurrentUser = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const memory = await UserContext.findOne({ userId });
  if (memory) {
    req.user.context = memory.context;
    req.user.preferences = memory.preferences;
  }
  return res.status(200).json({
    user: req.user,
    memory: memory ? memory.context : null,
    // Preferred name from the setup wizard (UserContext) — the chat
    // greeting uses this, falling back to firstName when never set
    displayName: memory?.displayName || null,
    message: "User fetched successfully",
  });
});

const verifyEmail = asyncHandler(async (req, res) => {
  const verificationToken = req.query.token;
  console.log("Verification token:", verificationToken);
  if (!verificationToken) {
    return res
      .status(400)
      .sendFile(
        path.join(__dirname, "../../public/email-verification-error.html"),
      );
  }
  const hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  console.log("Hashed token:", hashedToken);
  const user = await User.findOne({
    emailVerificationToken: `${hashedToken}`,
    emailVerificationExpiry: { $gt: Date.now() },
  });

  if (!user) {
    return res
      .status(400)
      .sendFile(
        path.join(__dirname, "../../public/email-verification-error.html"),
      );
  }

  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;
  user.isEmailVerified = true;

  await user.save({ validateBeforeSave: false });

  res
    .status(200)
    .sendFile(path.join(__dirname, "../../public/email-verified.html"));
});

const resendVerificationEmail = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }

  if (user.isEmailVerified) {
    return res.status(400).json({ message: "Email is already verified" });
  }

  // Generate a fresh token (the stored one is already hashed and cannot be
  // recovered into a usable URL token)
  const { unHashedToken, hashedToken, expiry } =
    await user.generateTemporaryToken();

  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpiry = expiry;
  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      to: user.email,
      subject: "Verify Your Email - The Sloth Project",
      url: `${req.protocol}://${req.get(
        "host",
      )}/api/v1/auth/verify-email?token=${unHashedToken}`,
      template: "verification",
      firstName: user.firstName,
    });
  } catch (emailError) {
    console.error("Failed to send verification email:", emailError.message);
    return res.status(500).json({ message: "Failed to send verification email" });
  }

  res.status(200).json({ message: "Verification email resent successfully" });
});
const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;
  if (!incomingRefreshToken) {
    return res.status(400).json({
      message: "Refresh token is required",
    });
  }
  try {
    const decoded = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );
    // refreshToken is select:false in the schema — must be explicitly selected
    const user = await User.findById(decoded._id).select("+refreshToken");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.refreshToken !== incomingRefreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
    const tokens = await generateTokens(user._id);
    user.refreshToken = tokens.refreshToken;
    await user.save({ validateBeforeSave: false });
    return res
      .status(200)
      .cookie("refreshToken", tokens.refreshToken, cookieOptions)
      .cookie("accessToken", tokens.accessToken, cookieOptions)
      .json({ message: "Tokens refreshed successfully" });
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(404).json({ message: "User does not exist" });
  }
  const { unHashedToken, hashedToken, expiry } = user.generateTemporaryToken();

  user.forgotPasswordToken = hashedToken;
  user.forgotPasswordExpiry = expiry;

  await user.save({ validateBeforeSave: false });

  try {
    await sendEmail({
      to: user.email,
      subject: "Forgot Password Request Received - The Sloth Project",
      url: `${req.protocol}://${req.get(
        "host",
      )}/api/v1/auth/forgot-password?token=${unHashedToken}`,
      template: "resetPassword",
      firstName: user.firstName,
    });
  } catch (emailError) {
    console.error("Failed to send password reset email:", emailError.message);
    // Continue with response even if email fails
  }

  return res
    .status(200)
    .json({ message: "Password Reset Mail Sent On Your Email" });
});

const resetPassword = asyncHandler(async (req, res) => {
  const resetToken = req.query.token;
  const { password, newPassword, confirmPassword } = req.body;
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }
  if (!resetToken) {
    return res.status(400).json({ message: "Reset Password Token Missing" });
  }
  try {
    const decodedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const user = await User.findOne({
      forgotPasswordToken: decodedToken,
      forgotPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "User does not exist",
      });
    }
    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;
    user.password = newPassword;

    await user.save({ validateBeforeSave: false });

    return res.status(200).json({ message: "Password Reset Successfully " });
  } catch (error) {
    return res.status(400).json({ message: "Something Went Wrong !" });
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { password, newPassword, confirmPassword } = req.body;
  const user = await User.findById(req.user?._id).select("+password");
  if (!user) {
    return res.status(404).json({ message: "User not found" });
  }
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return res.status(400).json({ message: "Incorrect Old Password" });
  }
  if (newPassword !== confirmPassword) {
    return res.status(400).json({ message: "Passwords do not match" });
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res.status(200).json({ message: "Password Changed Successfully" });
});

export {
  registerUser,
  resetPassword,
  loginUser,
  logoutUser,
  getCurrentUser,
  verifyEmail,
  resendVerificationEmail,
  refreshAccessToken,
  forgotPassword,
  changeCurrentPassword,
};
