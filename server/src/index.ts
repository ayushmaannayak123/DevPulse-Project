/**
 * =============================================================
 * DevPulse Node backend -- Express app entry point
 * =============================================================
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import { chatRouter } from "./routes/chat.js";
import { getLlmClient, checkConnection } from "./llmClient.js";

const app = express();
const PORT = Number(process.env.PORT) || 3001;

app.use(cors({ origin: process.env.CORS_ORIGIN || "http://localhost:5173" }));
app.use(express.json());

app.get("/api/health", async (_req, res) => {
  const llm = getLlmClient();
  const ok = await checkConnection(llm);
  res.json({ status: ok ? "ok" : "llm_unreachable", backend: llm.backend, model: llm.model });
});

app.use("/api", chatRouter);

app.listen(PORT, () => {
  console.log(`DevPulse Node backend listening on http://localhost:${PORT}`);
  console.log(`CORS allowed origin: ${process.env.CORS_ORIGIN || "http://localhost:5173"}`);
});
