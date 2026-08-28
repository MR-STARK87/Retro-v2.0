# AI Provider — Integration Guide

Use this provider as a drop-in OpenAI-compatible endpoint for the project.

---

## Base URL

```
http://127.0.0.1:8319/v1
```

## Authentication

No API key is required for local testing — the local provider at `127.0.0.1:8319` injects the key automatically.

If your SDK requires an `apiKey` field, you may use any dummy value:

```js
new OpenAI({ apiKey: "dummy", baseURL: "http://127.0.0.1:8319/v1" })
```

---

## Available Models

| model id | notes |
|---|---|
| `claude-opus-5` | Default, recommended |
| `claude-opus-4-8` | Alternative |

Both support `temperature`, `max_tokens`, and standard OpenAI chat fields.

---

## Request Format

```js
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: "dummy", // no real key needed — shim injects it
  baseURL: "http://127.0.0.1:8319/v1",
});

const response = await openai.chat.completions.create({
  model: "claude-opus-5",
  messages: [
    { role: "system", content: "<prompt from src/utils/prompts/*.txt>" },
    { role: "user", content: "<user input>" }
  ],
  temperature: 0.7,
});
```

`messages` follows standard OpenAI shape: array of `{ role: "system" | "user" | "assistant", content: string }`.

---

## Response Format

Standard OpenAI chat completion:

```json
{
  "id": "msg_...",
  "model": "claude-opus-5",
  "object": "chat.completion",
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "<model output — JSON string per prompt instructions>"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 1615,
    "completion_tokens": 121,
    "total_tokens": 1736
  }
}
```

Extract content with:
```js
const content = response.choices[0].message.content;
// then JSON.parse(content) per prompt requirements
```

Prompts in `src/utils/prompts/` expect strict JSON:
* `answeringPrompt` → `{"response": "...", "meta": "..."}`
* `contextPrompt` → `{"context": "..."}`
* `flashcardPrompt` → `{"numberOfCards": n, "cards": [{"title": "...", "content": "..."}]}`
* `noteEnhancePrompt` → `{"enhanced": "...", ...}`

---

## Example

```js
import { getPrompt } from "./src/utils/prompts/index.js";

const systemPrompt = getPrompt("ANSWERING");
const res = await openai.chat.completions.create({
  model: "claude-opus-5",
  messages: [
    { role: "system", content: systemPrompt },
    { role: "user", content: "Explain Newton's first law briefly." }
  ],
  temperature: 0.7,
});

const data = JSON.parse(res.choices[0].message.content);
console.log(data.response, data.meta);
```

---

## Notes

* Use `http://127.0.0.1:8319/v1` as `baseURL` — treat it like any OpenAI endpoint.
* No API key or extra headers required — the local provider handles authentication.
* The provider is OpenAI-compatible; keep using the `openai` SDK (`openai@^6.9.0` already in `package.json`).
