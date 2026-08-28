import express from "express";
import viewTokenChecker from "../middlewares/viewTokenChecker.js";
import redirectIfAuthenticated from "../middlewares/redirectIfAuthenticated.js";
import UserContext from "../models/userContext.js";

const router = express.Router();

// Render login/signup page (redirect if already authenticated)
router.get("/login", redirectIfAuthenticated, (req, res) => {
  res.render("loginSignUp", {
    title: "Login | My App",
    defaultView: "login",
  });
});

router.get("/signup", redirectIfAuthenticated, (req, res) => {
  res.render("loginSignUp", {
    title: "Sign Up | My App",
    defaultView: "signup",
  });
});

// Helper: has the user completed the post-signup setup wizard?
const hasCompletedSetup = async (userId) => {
  const userContext = await UserContext.findOne({ userId })
    .select("setupCompleted")
    .lean();
  return Boolean(userContext?.setupCompleted);
};

// Protected setup wizard (post-signup onboarding)
router.get("/setup", viewTokenChecker, async (req, res) => {
  if (await hasCompletedSetup(req.user._id)) {
    return res.redirect("/app");
  }
  res.render("setup", {
    title: "Welcome | Retro",
    user: req.user,
  });
});

// Protected app route (combines chat and notes with horizontal navigation)
router.get("/app", viewTokenChecker, async (req, res) => {
  if (!(await hasCompletedSetup(req.user._id))) {
    return res.redirect("/setup");
  }
  res.render("app", {
    title: "My App - Chat & Notes",
    user: req.user,
  });
});

// Protected upgrade route
router.get("/upgrade", viewTokenChecker, (req, res) => {
  res.render("upgrade", {
    title: "Upgrade | Retro",
    user: req.user,
  });
});

// Protected chat route (redirect to app)
router.get("/chat", viewTokenChecker, (req, res) => {
  res.redirect("/app");
});

// Home route - redirect to app
router.get("/home", (req, res) => {
  res.redirect("/app");
});

// Root route - smart redirect based on authentication
router.get("/", async (req, res) => {
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

  // If no token, redirect to login
  if (!token) {
    return res.redirect("/login");
  }

  try {
    const jwt = (await import("jsonwebtoken")).default;
    const User = (await import("../models/user.js")).default;
    const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
    const user = await User.findById(decoded._id);

    // If authenticated, redirect to app
    if (user) {
      return res.redirect("/app");
    }

    // If token is invalid, redirect to login
    res.redirect("/login");
  } catch (error) {
    // If token verification fails, redirect to login
    res.redirect("/login");
  }
});

export default router;
