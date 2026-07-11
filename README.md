# DevPulse

**A capstone reference implementation combining MCP, a ReAct agent, LangGraph multi-agent orchestration, and an A2A Agent Card — all backed by the real, live GitHub REST API.**

Every tool call in this project genuinely hits `api.github.com`. No mock data — real responses, real rate limits, real error handling.

## What this demonstrates

| Protocol / Framework | Problem it solves | Where it lives |
|---|---|---|
| **MCP** (Model Context Protocol) | Agent → tool access | `mcp_server.py`, `mcp_bridge.py` |
| **ReAct Agent** | Single-agent reasoning loop with human oversight | `agent_core.py` |
| **LangGraph** | Multi-agent routing to scoped specialists | `langgraph_agent.py` |
| **A2A** (Agent2Agent) | Agent → agent discovery | `a2a_card.py` |

The project is built in five phases, each runnable and testable independently.

## Architecture

```
                    ┌─────────────────────┐
                    │   mcp_server.py     │  ← 5 tools, 1 resource, 1 prompt
                    │  (real GitHub API)  │
                    └──────────▲──────────┘
                               │ stdio / JSON-RPC
                    ┌──────────┴──────────┐
                    │    mcp_bridge.py    │  ← MCP schema → OpenAI function-calling
                    └──────────▲──────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                                              │
┌───────▼────────┐                          ┌──────────▼─────────┐
│  agent_core.py  │                          │ langgraph_agent.py  │
│  Single ReAct   │                          │  Router + 3 scoped  │
│  agent + HITL   │                          │  specialist nodes   │
└─────────────────┘                          └──────────┬──────────┘
                                                         │
                                              ┌──────────▼──────────┐
                                              │     a2a_card.py     │
                                              │  External discovery │
                                              └──────────────────────┘
```

**Key architectural principle:** MCP and A2A are independent layers. MCP solves *how DevPulse reaches its tools*; A2A solves *how other agents find DevPulse*. Each is used only where actually needed.

## Setup

```bash
git clone <your-repo-url>
cd devpulse

python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
cp .env.example .env
```

Edit `.env`:
- `GITHUB_TOKEN` — optional. Get one free at [github.com/settings/tokens](https://github.com/settings/tokens) (no scopes needed). Raises the rate limit from 60 to 5,000 requests/hour. Leave blank to skip.
- `LLM_BACKEND` — `ollama` (local, free, default) or `groq` (cloud, needs `GROQ_API_KEY`).

### LLM backend

**Ollama (local, default):**
```bash
ollama serve
ollama pull qwen2.5:3b
```

**Groq (cloud):** set `LLM_BACKEND=groq` and `GROQ_API_KEY=...` in `.env`.

### Load environment variables into your shell

macOS/Linux:
```bash
export $(grep -v '^#' .env | xargs)
```

Windows PowerShell:
```powershell
Get-Content .env | ForEach-Object { if ($_ -match '^([^#=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2]) } }
```

## Run — phase by phase

```bash
# Phase 1a — plain function call, no protocol, no LLM
python3 -c "import mcp_server as s; print(s.get_repo_details('facebook','react'))"

# Phase 1b — real MCP handshake: initialize -> list_tools -> call_tool
python3 mcp_client_test.py

# Phase 2 — backend-agnostic LLM client sanity check
python3 model_client.py

# Phase 3 — single ReAct agent, human-in-the-loop, conversational memory
python3 agent_core.py

# Phase 4 — LangGraph router + 3 specialist agents
python3 langgraph_agent.py

# Phase 5 — A2A Agent Card + discovery registry
python3 a2a_card.py
```

## Two real engineering bugs this project surfaces (and fixes)

1. **Environment inheritance in subprocesses** — `StdioServerParameters` does not inherit the parent process's environment by default. Every place that launches `mcp_server.py` explicitly passes `env=os.environ.copy()`, or `GITHUB_TOKEN` never reaches the server subprocess.

2. **stdout/stdio protocol corruption** — the MCP stdio transport reserves stdout exclusively for JSON-RPC messages. All server-side logging in `mcp_server.py` goes to `stderr` — a stray `print()` to stdout would corrupt the protocol stream.

## Project layout

```
devpulse/
├── mcp_server.py          # Phase 1: FastMCP server — 5 tools, 1 resource, 1 prompt
├── mcp_client_test.py     # Phase 1: raw MCP protocol test, no LLM involved
├── model_client.py        # Phase 2: Ollama/Groq-agnostic LLM client
├── mcp_bridge.py          # Phase 2: MCP schema -> OpenAI function-calling bridge
├── agent_core.py          # Phase 3: single ReAct agent, HITL approval, memory
├── langgraph_agent.py     # Phase 4: router + repo/issue/release specialist nodes
├── a2a_card.py            # Phase 5: Agent Card + discovery registry
├── requirements.txt
├── .env.example
├── .gitignore
├── server/                # Phase 6: Node/Express backend — a REAL MCP client
│   ├── src/
│   │   ├── index.ts           # Express app entry point
│   │   ├── mcpClient.ts       # TypeScript MCP client (spawns mcp_server.py via stdio)
│   │   ├── llmClient.ts       # Ollama/Groq-agnostic client (mirrors model_client.py)
│   │   ├── agentSession.ts    # ReAct loop, redesigned for HTTP-based HITL
│   │   └── routes/chat.ts     # POST /api/chat, POST /api/approve
│   ├── package.json
│   └── .env.example
└── client/                # Phase 6: React (Vite) frontend
    ├── src/
    │   ├── App.tsx, main.tsx
    │   ├── api.ts, types.ts
    │   └── components/        # ChatWindow, MessageBubble, ApprovalCard
    ├── package.json
    └── .env.example
```

## Two ways to run DevPulse

**1. CLI (Python)** — the original agent, terminal-based, human approval via `y/n` prompts:
```bash
python3 agent_core.py
```

**2. Web app (React + Node)** — a browser-based chat UI, human approval via clickable buttons.
The Node backend is a **genuine second MCP client**, written in TypeScript using the official
`@modelcontextprotocol/sdk`, connecting to the *same* `mcp_server.py` the Python CLI uses —
not a rewrite of the server, just a second, independent client speaking the same protocol.
See [Running the web app](#running-the-web-app) below.

## Running the web app

### 1. Backend (Node/Express)

```bash
cd server
npm install
cp .env.example .env
```

Edit `server/.env` — same `GITHUB_TOKEN`, `LLM_BACKEND`, `OLLAMA_MODEL`/`GROQ_API_KEY`
values as the Python `.env`. `MCP_SERVER_PATH` defaults to `../mcp_server.py`, i.e. the
same Python MCP server the CLI agent uses — no need to duplicate it.

Make sure Ollama is running (`ollama serve`) if using the local backend, same as for the
Python CLI. Then:

```bash
npm run dev
```

This starts the Express server on `http://localhost:3001` and spawns `mcp_server.py` as a
subprocess on the first chat request.

### 2. Frontend (React + Vite)

In a second terminal:

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

Opens at `http://localhost:5173`. Ask something like "Tell me about facebook/react" — the
agent will reason about which tool to call, and pause with an **Approve/Deny** card before
actually hitting the GitHub API, mirroring the CLI's `y/n` prompt as clickable buttons.

## Deployment

**Frontend** — deploy `client/` to Vercel or Netlify as a standard Vite/React static build.
Set `VITE_API_URL` to your deployed backend's URL.

**Backend — an important constraint:** `server/` spawns `mcp_server.py` as a long-lived
child process, so it needs a host that runs a **persistent Node process with Python 3
available**, not a serverless/edge function platform (e.g. Vercel Functions can't do this).
[Render](https://render.com) or [Railway](https://railway.app) both work well as a Web
Service: set the build/start commands to `npm install && npm run build` / `npm start`,
add a `python3` buildpack or Docker step that also installs `requirements.txt` so
`mcp_server.py`'s dependencies (`mcp`, `httpx`) are available at runtime, and set the same
environment variables as your local `server/.env`.

## Tech stack

- [MCP](https://modelcontextprotocol.io/) — `mcp` Python SDK + FastMCP server, and the official `@modelcontextprotocol/sdk` TypeScript client
- [Express](https://expressjs.com/) — Node backend serving the React frontend's chat/approval API
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) — web chat UI
- [LangGraph](https://langchain-ai.github.io/langgraph/) — stateful multi-agent graph orchestration
- [httpx](https://www.python-httpx.org/) — live GitHub REST API calls
- [Ollama](https://ollama.com/) / [Groq](https://groq.com/) — interchangeable LLM backends
- [Pydantic](https://docs.pydantic.dev/) — A2A Agent Card schema

## License

MIT — do whatever you want with this.
