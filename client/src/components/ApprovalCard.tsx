import { useState } from "react";
import type { ToolCall } from "../types";

interface Props {
  toolCalls: ToolCall[];
  onDecide: (decisions: Record<string, boolean>) => void;
  disabled: boolean;
}

/** The web equivalent of agent_core.py's terminal HITL prompt:
 *
 *   ============================================================
 *    HUMAN-IN-THE-LOOP APPROVAL
 *   ============================================================
 *   Tool Selected : get_repo_details
 *   Arguments     : {'owner': 'facebook', 'repo': 'react'}
 *   Approve tool execution? (y/n):
 *
 * ...but as clickable buttons instead of a blocking stdin prompt. */
export function ApprovalCard({ toolCalls, onDecide, disabled }: Props) {
  const [decisions, setDecisions] = useState<Record<string, boolean | undefined>>({});

  const setDecision = (id: string, approved: boolean) => {
    setDecisions((prev) => ({ ...prev, [id]: approved }));
  };

  const allDecided = toolCalls.every((tc) => decisions[tc.id] !== undefined);

  return (
    <div
      style={{
        border: "1px solid #f59e0b",
        background: "#fffbeb",
        borderRadius: 10,
        padding: 14,
        margin: "12px 0",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "#92400e" }}>
        HUMAN-IN-THE-LOOP APPROVAL
      </div>

      {toolCalls.map((tc) => (
        <div key={tc.id} style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 13 }}>
            <strong>Tool:</strong> {tc.name}
          </div>
          <div style={{ fontSize: 12, color: "#475569", fontFamily: "ui-monospace, monospace" }}>
            {JSON.stringify(tc.arguments)}
          </div>
          <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
            <button
              disabled={disabled}
              onClick={() => setDecision(tc.id, true)}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: "1px solid #16a34a",
                background: decisions[tc.id] === true ? "#16a34a" : "#fff",
                color: decisions[tc.id] === true ? "#fff" : "#16a34a",
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: 13,
              }}
            >
              Approve
            </button>
            <button
              disabled={disabled}
              onClick={() => setDecision(tc.id, false)}
              style={{
                padding: "4px 12px",
                borderRadius: 6,
                border: "1px solid #dc2626",
                background: decisions[tc.id] === false ? "#dc2626" : "#fff",
                color: decisions[tc.id] === false ? "#fff" : "#dc2626",
                cursor: disabled ? "not-allowed" : "pointer",
                fontSize: 13,
              }}
            >
              Deny
            </button>
          </div>
        </div>
      ))}

      <button
        disabled={!allDecided || disabled}
        onClick={() => onDecide(decisions as Record<string, boolean>)}
        style={{
          marginTop: 4,
          padding: "8px 16px",
          borderRadius: 6,
          border: "none",
          background: allDecided ? "#2563eb" : "#cbd5e1",
          color: "#fff",
          cursor: allDecided && !disabled ? "pointer" : "not-allowed",
          fontSize: 13,
          fontWeight: 600,
        }}
      >
        Confirm & Continue
      </button>
    </div>
  );
}
