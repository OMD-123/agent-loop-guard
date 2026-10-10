
import { Guardrail, LoopChecker } from '../src/index.js';

const guard = new Guardrail([
  new LoopChecker({ maxSteps: 20 })
]);

// Mock express middleware
function guardMiddleware(req: any, res: any, next: any) {
  const step = { 
    type: 'tool_call', 
    tool: req.body.tool, 
    args: req.body.args, 
    timestamp: Date.now() 
  };
  
  if (!guard.check(step as any).allowed) {
    return res.status(403).send('Safety violation');
  }
  next();
}
