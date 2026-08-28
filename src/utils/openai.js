import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// Initialize OpenAI client — local provider (OpenAI-compatible)
// See provider/README.md: baseURL http://127.0.0.1:8319/v1, no real key needed (dummy), model claude-opus-5
const openai = new OpenAI({
  apiKey: "dummy",
  baseURL: "http://127.0.0.1:8319/v1",
});

/**
 * Makes a chat completion request using OpenAI SDK
 * @param {Array} messages - Array of message objects with role and content
 * @param {string} model - Model to use (default: claude-opus-5)
 * @returns {Promise<Object>} - API response
 */
export const chatCompletion = async (
  messages,
  model = "claude-opus-5",
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
