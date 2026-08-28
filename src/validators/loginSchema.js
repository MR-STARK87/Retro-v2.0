import z from "zod";
import { email, password } from "./validationRules.js";

const loginSchema = z.object({
  email,
  password,
});

export default loginSchema;
