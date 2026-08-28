import jwt from "jsonwebtoken";
import User from "../models/user.js";

const redirectIfAuthenticated = async (req, res, next) => {
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

  // If no token, proceed to login/signup page
  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded._id);

    // If user is authenticated, redirect to app
    if (user) {
      return res.redirect("/app");
    }

    // If token is invalid, proceed to login/signup page
    next();
  } catch (error) {
    // If token verification fails, proceed to login/signup page
    next();
  }
};

export default redirectIfAuthenticated;
