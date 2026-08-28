import UserContext from "../models/userContext.js";
import asyncHandler from "../utils/asyncHandler.js";

/**
 * Compiles setup wizard answers into a deterministic, human-readable profile
 * string. Built server-side (no AI call) so nothing can be paraphrased away.
 */
const buildStableContext = ({
  displayName,
  role,
  subjects,
  goal,
  answerStyle,
  tone,
  anythingElse,
}) => {
  const sentences = [];

  sentences.push(
    `User's preferred name is "${displayName}" — always address the user by this name.`,
  );
  sentences.push(`User is a ${role.toLowerCase()}.`);

  if (subjects && subjects.length > 0) {
    sentences.push(`User is studying: ${subjects.join(", ")}.`);
  }

  if (goal) {
    sentences.push(`User's current main goal: ${goal}.`);
  }

  sentences.push(
    `User prefers ${answerStyle}-length answers in a ${tone} tone.`,
  );

  if (anythingElse) {
    sentences.push(`Additional instructions from the user: "${anythingElse}".`);
  }

  return sentences.join(" ");
};

/**
 * POST /api/v1/onboarding
 * Saves setup wizard answers into UserContext. The compiled profile is stored
 * in stableContext, which the chat context generator never reads or writes,
 * making these facts permanent.
 */
const completeSetup = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const answers = req.body;

  const stableContext = buildStableContext(answers);

  const userContext = await UserContext.findOneAndUpdate(
    { userId },
    {
      $set: {
        displayName: answers.displayName,
        stableContext,
        setupCompleted: true,
        preferences: answers.subjects,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );

  return res.status(200).json({
    success: true,
    message: "Setup completed successfully",
    data: {
      displayName: userContext.displayName,
      setupCompleted: userContext.setupCompleted,
    },
  });
});

/**
 * GET /api/v1/onboarding/status
 * Lightweight check used by the app to decide whether to redirect to /setup.
 */
const getSetupStatus = asyncHandler(async (req, res) => {
  const userContext = await UserContext.findOne({ userId: req.user._id })
    .select("setupCompleted")
    .lean();

  return res.status(200).json({
    success: true,
    message: "Setup status fetched successfully",
    data: { setupCompleted: Boolean(userContext?.setupCompleted) },
  });
});

export { completeSetup, getSetupStatus };
