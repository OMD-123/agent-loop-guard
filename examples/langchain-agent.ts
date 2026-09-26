import { AgentLoopGuard } from "../src/index.js";
import type { AgentStep } from "../src/types/index.js";

/**
 * LangChain Integration Example
 * 
 * This example shows how to integrate agent-loop-guard-js with LangChain agents
 * to prevent runaway execution in LLM chains.
 * 
 * Install: npm install @langchain/core @langchain/openai
 */

// Mock LangChain types for demonstration (replace with actual imports)
interface LangChainTool {
  name: string;
  description: string;
  invoke(input: any): Promise<any>;
}

interface AgentAction {
  tool: string;
  toolInput: any;
  log: string;
}

interface AgentFinish {
  returnValues: any;
  log: string;
}

type AgentStepUnion = AgentAction | AgentFinish;

/**
 * Wrapper to protect LangChain agent execution
 */
class ProtectedLangChainAgent {
  private guard: AgentLoopGuard;
  private tools: Map<string, LangChainTool>;
  private maxIterations: number;

  constructor(
    tools: LangChainTool[],
    options: {
      maxSteps?: number;
      maxDuration?: number;
      maxRepeatedCalls?: number;
      maxSameToolCalls?: number;
    } = {}
  ) {
    this.tools = new Map(tools.map(t => [t.name, t]));
    this.maxIterations = options.maxSteps ?? 20;
    
    this.guard = new AgentLoopGuard({
      maxSteps: this.maxIterations,
      maxDuration: options.maxDuration ?? 120_000,
      maxRepeatedCalls: options.maxRepeatedCalls ?? 3,
      maxSameToolCalls: options.maxSameToolCalls ?? 5,
      loopPatternWindow: 6,
      onViolation: (event) => {
        console.error(`[LangChain Guard] ${event.reason} at step ${event.stepNumber}`);
      },
    });
  }

  /**
   * Execute agent with loop protection
   */
  async run(input: string): Promise<string> {
    this.guard.start();
    let iteration = 0;
    let currentInput = input;

    while (iteration < this.maxIterations) {
      iteration++;

      // Get next action from LLM (your LangChain agent logic)
      const action = await this.getNextAction(currentInput);
      
      // Convert to our step format for guard checking
      const step: AgentStep = {
        type: "tool",
        name: action.tool,
        arguments: action.toolInput,
      };

      // Check with guard
      const decision = this.guard.check(step);
      if (!decision.allowed) {
        throw new Error(`Agent loop detected: ${decision.reason}`);
      }

      // Execute the tool
      const tool = this.tools.get(action.tool);
      if (!tool) {
        throw new Error(`Unknown tool: ${action.tool}`);
      }

      const result = await tool.invoke(action.toolInput);
      currentInput = JSON.stringify({ ...JSON.parse(currentInput), lastResult: result });

      // Check if agent is finished
      if (this.isFinished(action)) {
        this.guard.end();
        return this.extractFinalAnswer(action);
      }
    }

    this.guard.end();
    throw new Error("Max iterations reached");
  }

  private async getNextAction(input: string): Promise<AgentAction> {
    // Your LangChain agent logic here
    // This would typically call an LLM to decide the next action
    return {
      tool: "search",
      toolInput: { query: input },
      log: "Searching for information...",
    };
  }

  private isFinished(action: AgentAction): boolean {
    return action.tool === "final_answer";
  }

  private extractFinalAnswer(action: AgentAction): string {
    return action.toolInput?.answer ?? "No answer provided";
  }

  getStats() {
    return this.guard.stats();
  }
}

// Example tools
const searchTool: LangChainTool = {
  name: "search",
  description: "Search the web",
  async invoke(input: { query: string }) {
    console.log(`Searching: ${input.query}`);
    return { results: [`Result for ${input.query}`] };
  },
};

const calculatorTool: LangChainTool = {
  name: "calculator",
  description: "Perform calculations",
  async invoke(input: { expression: string }) {
    console.log(`Calculating: ${input.expression}`);
    return { result: eval(input.expression) };
  },
};

const finalAnswerTool: LangChainTool = {
  name: "final_answer",
  description: "Provide final answer",
  async invoke(input: { answer: string }) {
    return { answer: input.answer };
  },
};

// Usage
async function main() {
  const agent = new ProtectedLangChainAgent(
    [searchTool, calculatorTool, finalAnswerTool],
    {
      maxSteps: 15,
      maxDuration: 60_000,
      maxRepeatedCalls: 2,
      maxSameToolCalls: 4,
    }
  );

  try {
    const answer = await agent.run("What is 2 + 2? Then search for the meaning of life.");
    console.log("Final answer:", answer);
    console.log("Guard stats:", agent.getStats());
  } catch (error) {
    console.error("Agent stopped:", error.message);
  }
}

main();