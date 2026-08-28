import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reads a prompt file and returns its content
 * @param {string} promptName - Name of the prompt file without extension
 * @returns {string} - Content of the prompt file
 */
export const getPrompt = (promptName) => {
  try {
    const promptPath = path.join(__dirname, `${promptName}.txt`);
    const content = fs.readFileSync(promptPath, "utf-8");
    return content.trim();
  } catch (error) {
    throw new Error(`Failed to read prompt file: ${promptName}`);
  }
};

export const PROMPTS = {
  ANSWERING: "answeringPrompt",
  CONTEXT: "contextPrompt",
  FLASHCARD: "flashcardPrompt",
  NOTE_REFERENCE: "noteReferencePrompt",
  NOTE_ENHANCE: "noteEnhancePrompt",
};
