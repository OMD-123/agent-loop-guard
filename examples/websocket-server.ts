
import { Guardrail, LoopChecker } from '../src/index.js';

class WSAgentServer {
  private guard = new Guardrail([new LoopChecker()]);
  
  handleMessage(msg: any) {
    const step = { type: 'tool_call', tool: msg.tool, args: msg.args, timestamp: Date.now() };
    if (!this.guard.check(step as any).allowed) {
      return "Blocked";
    }
    return "Allowed";
  }
}
