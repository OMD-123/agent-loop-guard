/**
 * Express middleware that puts the guard in front of every tool call.
 *
 * The example keeps Express out of the dependency tree by declaring the
 * request/response types structurally — swap them for `express.Request` and
 * `express.Response` in a real project.
 *
 * Run with: `npx tsx examples/express-middleware.ts`
 */
import { isMainModule } from './_demo.js';
import {
  Guardrail,
  LoopChecker,
  SecurityChecker,
  type AgentStep,
  type GuardDecision,
} from '../src/index.js';

interface JsonResponse {
  status(code: number): JsonResponse;
  json(body: unknown): JsonResponse;
}

/** One guard per session — in production, key it by session id. */
const guards = new Map<string, Guardrail>();

function getGuard(sessionId: string): Guardrail {
  let guard = guards.get(sessionId);
  if (!guard) {
    guard = new Guardrail(
      [
        new LoopChecker({ maxSteps: 20, maxRepeatedCalls: 3 }),
        new SecurityChecker({ detectInjection: true }),
      ],
      { historyLimit: 50 }
    );
    guard.start();
    guards.set(sessionId, guard);
  }
  return guard;
}

/** Express-compatible middleware. */
export function guardMiddleware(sessionId: string) {
  return async (
    req: { body?: { tool?: string; args?: unknown; content?: string } },
    res: JsonResponse,
    next: (error?: unknown) => void
  ): Promise<void> => {
    const guard = getGuard(sessionId);
    const body = req.body ?? {};

    const step: AgentStep = {
      type: body.tool ? 'tool_call' : 'llm_response',
      content: body.content,
      tool: body.tool,
      args: body.args,
      timestamp: Date.now(),
    };

    const decision: GuardDecision = guard.check(step);

    if (!decision.allowed) {
      res.status(403).json({
        error: 'BLOCKED_BY_GUARDRAIL',
        reason: decision.reason,
        message: decision.message,
      });
      return;
    }

    next();
  };
}

// --- demo ---
if (isMainModule(import.meta.url)) {
  const middleware = guardMiddleware('demo-session');
  const res = {
    status(code: number) {
      console.log(`status ${code}`);
      return this;
    },
    json(body: unknown) {
      console.log('body:', body);
      return this;
    },
  };

  middleware(
    { body: { tool: 'search', args: { q: 'hello' } } },
    res,
    () => console.log('next() — request passed the guard')
  );
}
