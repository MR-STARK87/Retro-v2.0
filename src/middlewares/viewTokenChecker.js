import User from "../models/user.js";
import jwt from "jsonwebtoken";

const viewTokenChecker = async (req, res, next) => {
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
    return res.redirect("/login");
  }

  try {
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded._id);
    if (!user) {
      return res.redirect("/login");
    }
    req.user = user;
    next();
  } catch (error) {
    return res.redirect("/login");
  }
};

export default viewTokenChecker;
