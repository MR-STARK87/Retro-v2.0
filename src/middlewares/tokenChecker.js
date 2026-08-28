import User from "../models/user.js";
import jwt from "jsonwebtoken";
import asyncHandler from "../utils/asyncHandler.js";

const tokenChecker = asyncHandler(async (req, res, next) => {
  let token =
    req.headers["authorization"]?.split(" ") || req.cookies["accessToken"];

  if (
    Array.isArray(token) &&
    token.length === 2 &&
    token[0].toLowerCase() === "bearer"
  ) {
    token = token[1];
  } else if (typeof token !== "string") {
    token = null;
  }

  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded._id);
    if (!user) {
      return res
        .status(404)
        .json({ message: "Invalid or expired access token" });
    }
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
});

export default tokenChecker;
