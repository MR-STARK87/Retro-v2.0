// middlewares/validate.js
import { ZodError } from "zod";

/**
 * Universal Zod validation middleware
 * @param {Object} schema - { body, query, params } (all optional)
 * @returns Express middleware
 */
export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      const validated = {};

      // Validate body
      if (schema.body) {
        validated.body = await schema.body.parseAsync(req.body);
        req.body = validated.body;
      }

      // Validate query (store in separate property to avoid readonly error)
      if (schema.query) {
        validated.query = await schema.query.parseAsync(req.query);
        // Don't reassign req.query directly, store in validatedData
        req.validatedQuery = validated.query;
      }

      // Validate params (store in separate property to avoid readonly error)
      if (schema.params) {
        validated.params = await schema.params.parseAsync(req.params);
        req.validatedParams = validated.params;
      }

      // All validations passed
      return next();
    } catch (error) {
      // Handle Zod validation errors safely
      if (error instanceof ZodError) {
        const errors =
          error.issues?.map((err) => ({
            field: err.path.join("."),
            message: err.message,
          })) || [];

        return res.status(400).json({
          success: false,
          message: "Validation failed",
          errors,
        });
      }

      // Unexpected errors
      console.error("Validation Middleware Error:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error",
      });
    }
  };
};
export default validate;
