
import { Guardrail, LoopChecker } from '../src/index.js';

const guard = new Guardrail([
  new LoopChecker({ maxSteps: 15 })
]);

async function langchainWrapper(step: any) {
  if (!guard.check(step as any).allowed) {
    throw new Error("Guardrail blocked execution");
  }
  // call langchain tool...
}
