/**
 * =============================================================
 * DevPulse Node backend -- Chat routes
 * REST endpoints the React frontend calls: start/continue a chat,
 * and approve or deny pending tool calls.
 * =============================================================
 */

import { Router, type Request, type Response } from "express";
import {
  createSession,
  getSession,
  sendMessage,
  resolveApproval,
} from "../agentSession.js";

export const chatRouter = Router();

/** POST /api/chat  { sessionId?: string, message: string }
 * Starts a new session if sessionId is omitted, otherwise continues
 * an existing conversation. */
chatRouter.post("/chat", async (req: Request, res: Response) => {
  try {
    const { sessionId, message } = req.body as { sessionId?: string; message?: string };

    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "`message` is required." });
    }

    const session = sessionId ? getSession(sessionId) : undefined;
    const activeSession = session ?? createSession();

    const result = await sendMessage(activeSession, message);
    res.json(result);
  } catch (err) {
    console.error("[POST /api/chat]", err);
    res.status(500).json({ error: (err as Error).message });
  }
});

/** POST /api/approve  { sessionId: string, decisions: { [toolCallId]: boolean } }
 * Resolves a pending human-in-the-loop approval and continues the loop. */
chatRouter.post("/approve", async (req: Request, res: Response) => {
  try {
    const { sessionId, decisions } = req.body as {
      sessionId?: string;
      decisions?: Record<string, boolean>;
    };

    if (!sessionId || !decisions) {
      return res.status(400).json({ error: "`sessionId` and `decisions` are required." });
    }

    const session = getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found or expired." });
    }

    const result = await resolveApproval(session, decisions);
    res.json(result);
  } catch (err) {
    console.error("[POST /api/approve]", err);
    res.status(500).json({ error: (err as Error).message });
  }
});
