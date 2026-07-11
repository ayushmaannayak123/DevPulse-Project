# DevPulse server -- Node + Python in one image, since the Express backend
# spawns mcp_server.py as a subprocess and needs both runtimes available.
#
# Build context is the REPO ROOT (not server/), so this Dockerfile can copy
# both the shared Python MCP server and the Node backend. On Render, set:
#   Root Directory: (blank)
#   Dockerfile Path: server/Dockerfile

FROM node:22-slim

# --- Python, for mcp_server.py ---
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 python3-pip && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# --- Python deps for the shared MCP server ---
COPY requirements.txt ./
RUN pip3 install --break-system-packages --no-cache-dir -r requirements.txt

# --- The shared Python MCP server itself ---
COPY mcp_server.py ./

# --- Node backend ---
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build && npm prune --omit=dev

ENV PYTHON_BIN=python3
ENV MCP_SERVER_PATH=../mcp_server.py
ENV PORT=3001

EXPOSE 3001
CMD ["node", "dist/index.js"]
