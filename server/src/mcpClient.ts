/**
 * =============================================================
 * DevPulse Node backend -- MCP Client
 *
 * This is a REAL MCP client, written in TypeScript using the official
 * @modelcontextprotocol/sdk, connecting to the exact same mcp_server.py
 * used by the Python CLI agent -- over the same stdio/JSON-RPC transport.
 * Node spawns mcp_server.py as a subprocess, identical in spirit to how
 * mcp_bridge.py does it in Python.
 * =============================================================
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Defaults to ../../mcp_server.py (the shared Python MCP server at the repo root),
// overridable via MCP_SERVER_PATH for different deployment layouts.
const MCP_SERVER_PATH = path.resolve(
  __dirname,
  "..",
  process.env.MCP_SERVER_PATH || "../mcp_server.py"
);
const PYTHON_BIN = process.env.PYTHON_BIN || "python3";

export interface OpenAIToolDef {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

let clientSingleton: Client | null = null;
let connecting: Promise<Client> | null = null;

/**
 * Lazily connect once and reuse the same MCP session for the life of the
 * server process. GitHub's tools here are all read-only and stateless, so
 * sharing one subprocess across chat sessions is safe and much cheaper
 * than spawning a new one per request.
 */
export async function getMcpClient(): Promise<Client> {
  if (clientSingleton) return clientSingleton;
  if (connecting) return connecting;

  connecting = (async () => {
    // IMPORTANT: pass process.env through explicitly -- same "environment
    // inheritance" gotcha as the Python side's env=os.environ.copy(). The
    // stdio transport does NOT inherit the parent's environment by default,
    // so without this, GITHUB_TOKEN would never reach the subprocess.
    const transport = new StdioClientTransport({
      command: PYTHON_BIN,
      args: [MCP_SERVER_PATH],
      env: process.env as Record<string, string>,
    });

    const client = new Client(
      { name: "devpulse-node-client", version: "1.0.0" },
      { capabilities: {} }
    );

    await client.connect(transport);
    clientSingleton = client;
    return client;
  })();

  return connecting;
}

/** Real MCP list_tools(), reshaped into OpenAI function-calling schema --
 * the TypeScript equivalent of mcp_bridge.py's discover_openai_tools(). */
export async function discoverOpenAITools(client: Client): Promise<OpenAIToolDef[]> {
  const { tools } = await client.listTools();
  return tools.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description || "",
      parameters: (t.inputSchema as Record<string, unknown>) || {
        type: "object",
        properties: {},
      },
    },
  }));
}

/** Real call_tool() against the live MCP server, flattened to plain text --
 * the TypeScript equivalent of mcp_bridge.py's call_mcp_tool(). */
export async function callMcpTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<string> {
  const result = await client.callTool({ name, arguments: args });
  const content = (result.content as Array<{ type: string; text?: string }>) || [];
  const texts = content.filter((c) => c.type === "text" && c.text).map((c) => c.text as string);
  return texts.length ? texts.join("\n") : "(empty result)";
}
