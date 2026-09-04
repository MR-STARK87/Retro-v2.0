import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// Initialize OpenAI client — env-driven with local fallback.
// On Render set: AI_BASE_URL, AI_API_KEY, AI_MODEL.
// Local default: http://127.0.0.1:8319/v1 + dummy key + claude-opus-5
// See .env.example for details.
const openai = new OpenAI({
  apiKey: process.env.AI_API_KEY || "dummy",
  baseURL: process.env.AI_BASE_URL || "http://127.0.0.1:8319/v1",
});

/**
 * Makes a chat completion request using OpenAI SDK
 * @param {Array} messages - Array of message objects with role and content
 * @param {string} model - Model to use (default: claude-opus-5)
 * @returns {Promise<Object>} - API response
 */
export const chatCompletion = async (
  messages,
  model = process.env.AI_MODEL || "claude-opus-5",
) => {
  try {
    const response = await openai.chat.completions.create({
      model: model,
      messages: messages,
      temperature: 0.7,
    });

    return response;
  } catch (error) {
    console.error("Error calling OpenAI API:", error);
    throw error;
  }
};

/**
 * Extracts the message content from OpenAI API response
 * @param {Object} response - OpenAI API response
 * @returns {string} - Extracted message content
 */
export const extractMessageContent = (response) => {
  if (
    response?.choices &&
    response.choices.length > 0 &&
    response.choices[0].message?.content
  ) {
    return response.choices[0].message.content;
  }
  throw new Error("Invalid response format from OpenAI API");
};
