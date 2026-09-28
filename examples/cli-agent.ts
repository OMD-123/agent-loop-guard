import { AgentLoopGuard } from "../src/index.js";
import type { AgentStep } from "../src/types/index.js";

/**
 * CLI Agent Example
 * 
 * This example shows how to protect a CLI-based autonomous agent
 * that runs in a terminal and makes tool calls.
 * 
 * Run: npx tsx examples/cli-agent.ts
 */

import readline from "readline/promises";
import { stdin as input, stdout as output } from "process";

interface CLITool {
  name: string;
  description: string;
  execute(args: Record<string, any>): Promise<string>;
}

class CLIAgent {
  private guard: AgentLoopGuard;
  private tools: Map<string, CLITool>;
  private rl: readline.Interface;

  constructor(tools: CLITool[]) {
    this.tools = new Map(tools.map(t => [t.name, t]));
    
    this.guard = new AgentLoopGuard({
      maxSteps: 50,
      maxDuration: 300_000,  // 5 minutes
      maxRepeatedCalls: 3,
      maxSameToolCalls: 8,
      loopPatternWindow: 10,
      onViolation: (event) => {
        console.error(`\n⚠️  AGENT GUARD TRIGGERED: ${event.reason}`);
        console.error(`   Step: ${event.stepCount}`);
      },
    });

    this.rl = readline.createInterface({ input, output });
  }

  async run(initialTask: string): Promise<void> {
    console.log(`\n🤖 CLI Agent Starting`);
    console.log(`Task: ${initialTask}`);
    console.log(`Guard: maxSteps=50, maxDuration=300000ms\n`);

    this.guard.start();
    let stepCount = 0;
    let currentTask = initialTask;

    while (stepCount < 50) {
      stepCount++;
      
      // Get next action from "LLM" (simulated here)
      const action = await this.getNextAction(currentTask, stepCount);
      
      if (action.type === "finish") {
        console.log(`\n✅ Task completed: ${action.result}`);
        break;
      }

      // Check with guard
      const step: AgentStep = {
        type: "tool",
        name: action.tool!,
        arguments: action.args,
      };

      const decision = this.guard.check(step);
      if (!decision.allowed) {
        console.error(`\n🛑 AGENT STOPPED: ${decision.reason}`);
        console.error(`   Stats:`, this.guard.stats());
        this.guard.end();
        return;
      }

      // Execute tool
      const tool = this.tools.get(action.tool!);
      if (!tool) {
        console.error(`\n❌ Unknown tool: ${action.tool!}`);
        continue;
      }

      console.log(`\n🔧 Step ${stepCount}: ${action.tool!}(${JSON.stringify(action.args ?? {})})`);
      const result = await tool.execute(action.args ?? {});
      console.log(`   Result: ${result}`);

      currentTask = `${currentTask}\nStep ${stepCount} (${action.tool}): ${result}`;
    }

    this.guard.end();
    console.log(`\n📊 Final Stats:`, this.guard.stats());
    this.rl.close();
  }

  private async getNextAction(task: string, stepNumber: number): Promise<{
    type: "tool" | "finish";
    tool?: string;
    args?: Record<string, any>;
    result?: string;
  }> {
    // Simulate LLM decision - in real use, call an LLM API
    // const tools = Array.from(this.tools.keys());
    
    // Simple logic for demo
    if (stepNumber === 1) {
      return { type: "tool", tool: "search", args: { query: task } };
    }
    if (stepNumber === 2) {
      return { type: "tool", tool: "analyze", args: { data: "search results" } };
    }
    if (stepNumber === 3) {
      return { type: "finish", result: "Analysis complete" };
    }
    
    return { type: "finish", result: "Max demo steps reached" };
  }
}

// Example CLI tools
const searchTool: CLITool = {
  name: "search",
  description: "Search the web",
  async execute(args: { query: string }) {
    await new Promise(r => setTimeout(r, 100)); // Simulate API call
    return `Search results for "${args.query}": [Result 1, Result 2, Result 3]`;
  },
};

const analyzeTool: CLITool = {
  name: "analyze",
  description: "Analyze data",
  async execute(args: { data: string }) {
    await new Promise(r => setTimeout(r, 100));
    return `Analysis of "${args.data}": Key insights extracted`;
  },
};

const writeFileTool: CLITool = {
  name: "write_file",
  description: "Write to file",
  async execute(args: { path: string; content: string }) {
    await new Promise(r => setTimeout(r, 50));
    return `Written to ${args.path} (${args.content.length} chars)`;
  },
};

// Main
async function main() {
  const agent = new CLIAgent([searchTool, analyzeTool, writeFileTool]);
  
  // Get task from command line or prompt
  const task = process.argv[2] || "Research TypeScript best practices and create a summary";
  
  await agent.run(task);
}

main().catch(console.error);