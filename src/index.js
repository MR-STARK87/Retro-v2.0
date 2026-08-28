import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./db/dbConnection.js";
import healthCheckRoute from "./routes/healthCheckRoute.js";
import authRoutes from "./routes/authRoutes.js";
import chatRoutes from "./routes/chatRoutes.js";
import noteRoutes from "./routes/noteRoutes.js";
import cardRoutes from "./routes/cardRoutes.js";
import viewRoutes from "./routes/viewRoutes.js";
import cookieParser from "cookie-parser";
import chatSessionRoutes from "./routes/chatSessionRoutes.js";
import musicRoutes from "./routes/musicRoutes.js";
import subscriptionRoutes from "./routes/subscriptionRoutes.js";

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables FIRST
dotenv.config({ debug: false });

const app = express();
app.use(cookieParser());
const PORT = process.env.PORT || 3000;

// Middleware setup
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://localhost:5500",
  process.env.FRONTEND_URL,
].filter(Boolean);

if (process.env.NODE_ENV === "development") {
  // Allow all origins in development
  app.use(
    cors({
      origin: true, // reflect request origin
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
} else {
  // Restrict origins in production
  app.use(
    cors({
      origin: function (origin, callback) {
        if (!origin) return callback(null, true);
        if (allowedOrigins.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error("Not allowed by CORS"));
        }
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
}

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Configure EJS as view engine
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "../public")));

// API Routes
app.use("/api/v1/health", healthCheckRoute);
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/notes", noteRoutes);
app.use("/api/v1", chatRoutes);
app.use("/api/v1/cards", cardRoutes);
app.use("/api/v1/chat-sessions", chatSessionRoutes);
app.use("/api/v1/music", musicRoutes);
app.use("/api/v1/subscription", subscriptionRoutes);

// View routes (must be after API routes to avoid conflicts)
app.use("/", viewRoutes);

// Connect to MongoDB and start server
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);

      // Check Stripe configuration
      if (!process.env.STRIPE_SECRET_KEY) {
        console.log("\n⚠️  WARNING: Stripe is not configured");
        console.log("📝 To enable payment features:");
        console.log("   1. Create a Stripe account at https://stripe.com");
        console.log(
          "   2. Get your API keys from Dashboard → Developers → API keys",
        );
        console.log("   3. Add STRIPE_SECRET_KEY to your .env file");
        console.log("   4. Follow PAYMENT_SETUP_GUIDE.md for complete setup");
        console.log(
          "   Note: Subscription features will work without Stripe (tier management only)\n",
        );
      } else {
        console.log("✅ Stripe configured - Payment features enabled");
      }
    });
  })
  .catch((err) => {
    console.error("Failed to connect to MongoDB:", err);
    process.exit(1);
  });
