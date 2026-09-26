import { AgentLoopGuard } from "../src/index.js";
import type { AgentStep } from "../src/types/index.js";

/**
 * WebSocket Real-Time Agent Example
 * 
 * This example shows how to protect a WebSocket-based agent that communicates
 * in real-time with clients (e.g., chat interfaces, live coding assistants).
 * 
 * Install: npm install ws
 * Run: npx tsx examples/websocket-server.ts
 */

import { WebSocketServer, WebSocket } from "ws";

interface WSMessage {
  type: "step" | "result" | "error" | "stats";
  payload: any;
  requestId: string;
}

interface ClientSession {
  ws: WebSocket;
  guard: AgentLoopGuard;
  requestId: number;
}

class WSAgentServer {
  private wss: WebSocketServer;
  private sessions: Map<WebSocket, ClientSession> = new Map();

  constructor(port: number = 8080) {
    this.wss = new WebSocketServer({ port });
    this.setupServer();
    console.log(`🌐 WebSocket Agent Server running on ws://localhost:${port}`);
  }

  private setupServer() {
    this.wss.on("connection", (ws: WebSocket) => {
      console.log("🔌 New client connected");
      
      // Create guard for this session
      const guard = new AgentLoopGuard({
        maxSteps: 100,
        maxDuration: 600_000,  // 10 minutes per session
        maxRepeatedCalls: 5,
        maxSameToolCalls: 15,
        loopPatternWindow: 12,
        onViolation: (event) => {
          this.send(ws, {
            type: "error",
            payload: { reason: event.reason, step: event.stepNumber },
            requestId: "server",
          });
        },
      });

      const session: ClientSession = { ws, guard, requestId: 0 };
      this.sessions.set(ws, session);
      guard.start();

      ws.on("message", (data: Buffer) => {
        try {
          const message: WSMessage = JSON.parse(data.toString());
          this.handleMessage(session, message);
        } catch (e) {
          this.send(ws, { type: "error", payload: { error: "Invalid JSON" }, requestId: "server" });
        }
      });

      ws.on("close", () => {
        console.log("🔌 Client disconnected");
        session.guard.end();
        this.sessions.delete(ws);
      });

      ws.on("error", (err) => {
        console.error("WS Error:", err);
        session.guard.end();
        this.sessions.delete(ws);
      });
    });
  }

  private handleMessage(session: ClientSession, message: WSMessage) {
    const { guard } = session;
    
    switch (message.type) {
      case "step":
        this.handleStep(session, message);
        break;
      case "stats":
        this.send(session.ws, {
          type: "stats",
          payload: guard.stats(),
          requestId: message.requestId,
        });
        break;
    }
  }

  private handleStep(session: ClientSession, message: WSMessage) {
    const { guard } = session;
    const step = message.payload as AgentStep;

    // Validate step structure
    if (!step.type || !step.name) {
      this.send(session.ws, {
        type: "error",
        payload: { error: "Invalid step: missing type or name" },
        requestId: message.requestId,
      });
      return;
    }

    // Check with guard
    const decision = guard.check(step);
    
    if (!decision.allowed) {
      this.send(session.ws, {
        type: "error",
        payload: { 
          error: "Agent loop detected",
          reason: decision.reason,
          stats: guard.stats(),
        },
        requestId: message.requestId,
      });
      return;
    }

    // Execute step (simulated)
    this.executeStep(session, step, message.requestId);
  }

  private async executeStep(session: ClientSession, step: AgentStep, requestId: string) {
    // Simulate tool execution
    await new Promise(r => setTimeout(r, 50 + Math.random() * 100));
    
    const result = {
      tool: step.name,
      args: step.arguments,
      output: `Executed ${step.name} with ${JSON.stringify(step.arguments)}`,
      timestamp: Date.now(),
    };

    this.send(session.ws, {
      type: "result",
      payload: result,
      requestId,
    });
  }

  private send(ws: WebSocket, message: WSMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  getStats() {
    return {
      activeSessions: this.sessions.size,
      sessions: Array.from(this.sessions.values()).map(s => s.guard.stats()),
    };
  }
}

// Client example (run in browser console or separate Node process)
const clientExample = `
// Browser/Node client example:
const ws = new WebSocket("ws://localhost:8080");
let requestId = 0;

ws.onopen = () => {
  console.log("Connected to agent server");
  
  // Send a step
  ws.send(JSON.stringify({
    type: "step",
    payload: {
      type: "tool",
      name: "search",
      arguments: { query: "TypeScript best practices" }
    },
    requestId: \`req-\${++requestId}\`
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  console.log("Received:", msg.type, msg.payload);
};

// Request stats
ws.send(JSON.stringify({ type: "stats", payload: {}, requestId: "stats-1" }));
`;

// Run server
const server = new WSAgentServer(8080);

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down...");
  server.wss.close();
  process.exit(0);
});

console.log("\n📋 Client example (run in browser console):");
console.log(clientExample);