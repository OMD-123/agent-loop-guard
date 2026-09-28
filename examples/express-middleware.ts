import { AgentLoopGuard } from "../src/index.js";
import type { AgentStep } from "../src/types/index.js";

/**
 * Express.js Middleware Example
 * 
 * This example shows how to integrate agent-loop-guard-js as Express middleware
 * to protect AI agent endpoints from runaway loops.
 */

// import express from "express";
// Mock express for type checking
interface Request {
  agentGuard?: AgentLoopGuard;
  ip?: string;
}
interface Response {
  status(code: number): Response;
  json(body: any): Response;
}
type NextFunction = () => void;

const app = {
  use: (_path: string, _handler: (req: Request, res: Response, next: NextFunction) => void) => {},
  post: (_path: string, _handler: (req: Request, res: Response) => void) => {},
  listen: (_port: number, callback: () => void) => callback(),
};
// app.use(express.json());

// Middleware to initialize guard per request/session
function agentGuardMiddleware(options: {
  maxSteps?: number;
  maxDuration?: number;
  maxRepeatedCalls?: number;
  maxSameToolCalls?: number;
  loopPatternWindow?: number;
} = {}) {
  return (req: Request, _res: Response, next: NextFunction) => {
    req.agentGuard = new AgentLoopGuard({
      maxSteps: options.maxSteps ?? 50,
      maxDuration: options.maxDuration ?? 120_000,
      maxRepeatedCalls: options.maxRepeatedCalls ?? 3,
      maxSameToolCalls: options.maxSameToolCalls ?? 10,
      loopPatternWindow: options.loopPatternWindow ?? 8,
      onViolation: (event) => {
        console.warn(`[Agent Guard] Violation for ${req.ip}: ${event.reason}`);
      },
    });
    req.agentGuard.start();
    next();
  };
}

// Apply middleware to agent routes
app.use("/api/agent", agentGuardMiddleware({
  maxSteps: 30,
  maxDuration: 60_000,
}));

// Agent endpoint with loop protection
app.post("/api/agent/run", async (req: Request & { body?: { steps: AgentStep[] } }, res: Response) => {
  const guard = req.agentGuard!;
  const { steps } = req.body ?? { steps: [] }; // Array of agent steps from client
  
  try {
    const results = [];
    
    for (const step of steps) {
      const decision = guard.check(step);
      
      if (!decision.allowed) {
        return res.status(429).json({
          error: "Agent loop detected",
          reason: decision.reason,
          stats: guard.stats(),
        });
      }
      
      // Execute the step (your actual agent logic here)
      const result = await executeStep(step);
      results.push(result);
    }
    
    return res.json({
      success: true,
      results,
      stats: guard.stats(),
    });
  } catch (error) {
    return res.status(500).json({ error: "Agent execution failed" });
  } finally {
    guard.end();
  }
});

// Mock step executor
async function executeStep(step: AgentStep): Promise<any> {
  // Your actual tool execution logic
  console.log(`Executing: ${step.type} - ${step.name}`);
  return { executed: true, step };
}

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`Agent server running on http://localhost:${PORT}`);
  console.log("POST /api/agent/run with { steps: [...] }");
});