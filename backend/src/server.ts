import "dotenv/config";
import express from "express";
import cors from "cors";
import OpenAI from "openai";

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

const PORT = Number(process.env.PORT) || 3001;
const MODEL = process.env.OPENAI_MODEL;

if (!process.env.OPENAI_API_KEY || !MODEL) {
  console.error("no OPENAI_API_KEY or OPENAI_MODEL in backend/.env");
  process.exit(1);
}

const client = new OpenAI(); // read OPENAI_API_KEY

const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

const SYSTEM_PROMPT = `You are DocBuddy, an assistant that helps people understand documents.`;

app.post("/api/chat", async (req, res) => {
  const { messages } = (req.body ?? {}) as { messages?: IncomingMessage[] };

  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages manquants" });
    return;
  }

  try {
    const response = await client.responses.create({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      input: messages.map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: String(m.content),
      })),
    });

    res.json({ content: response.output_text });
  } catch (error: unknown) {
    console.error(error);

    if (error instanceof OpenAI.APIError) {
      res.status(error.status ?? 500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "Error OpenAI" });
    }
  }
});

app.listen(PORT, () => {
  console.log(`Backend DocBuddy on http://localhost:${PORT}`);
});