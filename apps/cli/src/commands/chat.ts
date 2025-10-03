import prompts from 'prompts';
import chalk from 'chalk';
import { createInterface } from 'readline';
import { getConfig } from '@youagent/config';
import { initDb, sourceItemsRepo } from '@youagent/data';
import { createIndex } from '@youagent/index';
import { initGemini, getGemini } from '@youagent/ai';
import { makePlan, pickContext, synthesizeStream } from '@youagent/agent';

interface ChatOptions {
  message?: string;
  json?: boolean;
}

export async function chatCommand(options: ChatOptions): Promise<void> {
  try {
    // Load config
    const config = getConfig();

    // Initialize database
    const db = initDb(config.dbPath!);

    // Initialize vector index
    const vectorIndex = createIndex(config.vectorBackend, {
      dbPath: `${config.youagentHome}/vectors.db`,
      dimension: 768,
    });

    // Initialize Gemini
    const gemini = initGemini(config.geminiApiKey, config.geminiModel);

    // Single message mode
    if (options.message) {
      await processSingleMessage(options.message, gemini, vectorIndex, options.json);
      return;
    }

    // Interactive REPL mode
    console.log(chalk.bold.blue('\n🤖 YouAgent Chat\n'));
    console.log('Type your questions. Press Ctrl+C to exit.\n');

    // Create readline interface for better Ctrl+C handling
    const rl = createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // Handle Ctrl+C gracefully
    const handleExit = () => {
      console.log(chalk.blue('\n\nGoodbye!\n'));
      rl.close();
      process.exit(0);
    };

    process.on('SIGINT', handleExit);
    process.on('SIGTERM', handleExit);

    // Ask for user input
    const askQuestion = (): Promise<void> => {
      return new Promise((resolve) => {
        rl.question(chalk.cyan('You: '), async (message) => {
          const trimmedMessage = message.trim();

          if (!trimmedMessage) {
            resolve();
            return;
          }

          if (trimmedMessage.toLowerCase() === 'exit' || 
              trimmedMessage.toLowerCase() === 'quit' || 
              trimmedMessage.toLowerCase() === 'bye') {
            console.log(chalk.blue('\nGoodbye!\n'));
            rl.close();
            process.exit(0);
          }

          await processSingleMessage(trimmedMessage, gemini, vectorIndex, false);
          resolve();
        });
      });
    };

    // Main chat loop
    try {
      while (true) {
        await askQuestion();
      }
    } catch (error) {
      console.log(chalk.blue('\n\nGoodbye!\n'));
      rl.close();
      process.exit(0);
    }
  } catch (error) {
    console.error(chalk.red('\n✗ Chat failed:'), error);
    process.exit(1);
  }
}

async function processSingleMessage(
  message: string,
  gemini: ReturnType<typeof getGemini>,
  vectorIndex: ReturnType<typeof createIndex>,
  jsonOutput?: boolean
): Promise<void> {
  try {
    // Make plan
    const plan = makePlan(message);

    // Load relevant source items
    const sourceItems = await sourceItemsRepo.findBySource('github'); // Simplified: load all
    const rssItems = await sourceItemsRepo.findBySource('rss');
    const resumeItems = await sourceItemsRepo.findBySource('resume');
    const allItems = [...sourceItems, ...rssItems, ...resumeItems];

    // Generate query embedding
    const queryEmbeddings = await gemini.embed([message]);
    const queryEmbedding = queryEmbeddings[0]!;

    // Pick context
    const context = await pickContext(message, queryEmbedding, vectorIndex, allItems, {
      maxResults: plan.maxResults,
    });

    if (context.length === 0) {
      console.log(chalk.yellow('\nNo relevant information found.\n'));
      return;
    }

    // Show sources being used
    const sources = Array.from(new Set(context.map((c: { source: string }) => c.source)));
    if (!jsonOutput) {
      console.log(chalk.dim(`\nUsing sources: [${sources.join(', ')}]\n`));
      console.log(chalk.cyan('Agent: ') + chalk.dim('(streaming...)\n'));
    }

    // Synthesize answer (stream)
    let fullResponse = '';
    for await (const chunk of synthesizeStream(gemini, { query: message, context })) {
      if (!jsonOutput) {
        process.stdout.write(chunk);
      }
      fullResponse += chunk;
    }

    if (!jsonOutput) {
      console.log('\n');
    } else {
      console.log(JSON.stringify({ response: fullResponse, sources, context }));
    }
  } catch (error) {
    console.error(chalk.red('Error processing message:'), error);
  }
}
