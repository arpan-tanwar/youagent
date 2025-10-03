import prompts from 'prompts';
import chalk from 'chalk';
import { createInterface } from 'readline';
import { getConfig } from '@youagent/config';
import { initDb, sourceItemsRepo } from '@youagent/data';
import { createIndex } from '@youagent/index';
import { initGemini, getGemini } from '@youagent/ai';
import { makePlan, pickContext, synthesizeStream, classifyIntent } from '@youagent/agent';

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

          // Handle REPL commands
          if (trimmedMessage.startsWith(':')) {
            await handleReplCommand(trimmedMessage, gemini, vectorIndex);
            resolve();
            return;
          }

          if (
            trimmedMessage.toLowerCase() === 'exit' ||
            trimmedMessage.toLowerCase() === 'quit' ||
            trimmedMessage.toLowerCase() === 'bye'
          ) {
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

async function handleReplCommand(
  command: string,
  gemini: ReturnType<typeof getGemini>,
  vectorIndex: ReturnType<typeof createIndex>
): Promise<void> {
  const [cmd, ...args] = command.slice(1).split(' ');

  if (!cmd) {
    console.log(chalk.red('Invalid command'));
    return;
  }

  switch (cmd.toLowerCase()) {
    case 'help':
      showReplHelp();
      break;
    case 'sources':
      await showSources();
      break;
    case 'plan':
      if (args.length === 0) {
        console.log(chalk.yellow('Usage: :plan <message>'));
        return;
      }
      await showPlan(args.join(' '), gemini, vectorIndex);
      break;
    case 'facts':
      await showFacts();
      break;
    case 'refresh':
      if (args.length === 0) {
        console.log(chalk.yellow('Usage: :refresh <source> (github, twitter, rss, resume, all)'));
        return;
      }
      await refreshSource(args[0] || '');
      break;
    case 'stats':
      await showStats();
      break;
    case 'clear':
      console.clear();
      break;
    default:
      console.log(chalk.red(`Unknown command: ${cmd}`));
      console.log(chalk.gray('Type :help for available commands'));
  }
}

function showReplHelp(): void {
  console.log(chalk.bold.blue('\n📋 REPL Commands\n'));
  console.log(`${chalk.cyan(':help')}     Show this help`);
  console.log(`${chalk.cyan(':sources')}  Show available data sources`);
  console.log(`${chalk.cyan(':plan')}     Show planner decision for a message`);
  console.log(`${chalk.cyan(':facts')}    Show derived facts`);
  console.log(`${chalk.cyan(':refresh')}  Refresh data sources`);
  console.log(`${chalk.cyan(':stats')}    Show system statistics`);
  console.log(`${chalk.cyan(':clear')}    Clear screen`);
  console.log(chalk.gray('\nExample: :plan "Write a cover letter"'));
}

async function showSources(): Promise<void> {
  console.log(chalk.bold.blue('\n📚 Data Sources\n'));

  try {
    const githubCount = await sourceItemsRepo
      .findBySource('github')
      .then((items) => items.length)
      .catch(() => 0);
    const twitterCount = await sourceItemsRepo
      .findBySource('twitter')
      .then((items) => items.length)
      .catch(() => 0);
    const rssCount = await sourceItemsRepo
      .findBySource('rss')
      .then((items) => items.length)
      .catch(() => 0);
    const resumeCount = await sourceItemsRepo
      .findBySource('resume')
      .then((items) => items.length)
      .catch(() => 0);

    if (githubCount > 0) console.log(`${chalk.green('✓')} GitHub: ${githubCount} items`);
    if (twitterCount > 0) console.log(`${chalk.green('✓')} Twitter: ${twitterCount} tweets`);
    if (rssCount > 0) console.log(`${chalk.green('✓')} RSS/Blog: ${rssCount} articles`);
    if (resumeCount > 0) console.log(`${chalk.green('✓')} Resume: ${resumeCount} sections`);

    if (githubCount + twitterCount + rssCount + resumeCount === 0) {
      console.log(chalk.yellow('No data sources available. Run "youagent init" to set up.'));
    }
  } catch (error) {
    console.log(chalk.red('Failed to load sources'));
  }
}

async function showPlan(
  message: string,
  gemini: ReturnType<typeof getGemini>,
  vectorIndex: ReturnType<typeof createIndex>
): Promise<void> {
  console.log(chalk.bold.blue('\n🎯 Planner Analysis\n'));
  console.log(chalk.gray(`Message: "${message}"\n`));

  try {
    const plan = makePlan(message);
    const intent = classifyIntent(message);
    
    const sources = [];
    if (plan.useGithub) sources.push('GitHub');
    if (plan.useTwitter) sources.push('Twitter');
    if (plan.useRss) sources.push('RSS/Blog');
    if (plan.useResume) sources.push('Resume');
    
    console.log(`${chalk.cyan('Intent:')} ${intent}`);
    console.log(`${chalk.cyan('Sources:')} ${sources.join(', ') || 'None'}`);
    console.log(`${chalk.cyan('Max Results:')} ${plan.maxResults}`);
    console.log(`${chalk.cyan('Force Fresh:')} ${plan.forceFresh ? 'Yes' : 'No'}`);
  } catch (error) {
    console.log(chalk.red('Failed to analyze plan'));
  }
}

async function showFacts(): Promise<void> {
  console.log(chalk.bold.blue('\n📊 Derived Facts\n'));
  console.log(chalk.yellow('Feature coming soon!'));
  console.log(chalk.gray('This will show automatically extracted facts about you.'));
}

async function refreshSource(source: string): Promise<void> {
  console.log(chalk.blue(`\n🔄 Refreshing ${source}...`));
  console.log(chalk.yellow('Feature coming soon!'));
  console.log(chalk.gray('This will refresh the specified data source.'));
}

async function showStats(): Promise<void> {
  console.log(chalk.bold.blue('\n📈 System Statistics\n'));

  try {
    const githubCount = await sourceItemsRepo
      .findBySource('github')
      .then((items) => items.length)
      .catch(() => 0);
    const twitterCount = await sourceItemsRepo
      .findBySource('twitter')
      .then((items) => items.length)
      .catch(() => 0);
    const rssCount = await sourceItemsRepo
      .findBySource('rss')
      .then((items) => items.length)
      .catch(() => 0);
    const resumeCount = await sourceItemsRepo
      .findBySource('resume')
      .then((items) => items.length)
      .catch(() => 0);
    const totalItems = githubCount + twitterCount + rssCount + resumeCount;

    console.log(`${chalk.cyan('Total Items:')} ${totalItems}`);
    console.log(`${chalk.cyan('GitHub:')} ${githubCount} items`);
    console.log(`${chalk.cyan('Twitter:')} ${twitterCount} tweets`);
    console.log(`${chalk.cyan('RSS/Blog:')} ${rssCount} articles`);
    console.log(`${chalk.cyan('Resume:')} ${resumeCount} sections`);

    // TODO: Add more stats like cache hit rate, average response time, etc.
  } catch (error) {
    console.log(chalk.red('Failed to load statistics'));
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
    const sourceItems = await sourceItemsRepo.findBySource('github');
    const twitterItems = await sourceItemsRepo.findBySource('twitter');
    const rssItems = await sourceItemsRepo.findBySource('rss');
    const resumeItems = await sourceItemsRepo.findBySource('resume');
    const allItems = [...sourceItems, ...twitterItems, ...rssItems, ...resumeItems];

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

    // Show sources being used with counts
    const sourceCounts = context.reduce(
      (acc, item) => {
        acc[item.source] = (acc[item.source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const sourceChips = Object.entries(sourceCounts)
      .map(([source, count]) => `[${source.toUpperCase()}]`)
      .join(' ');

    if (!jsonOutput) {
      console.log(chalk.dim(`\nUsing sources: ${sourceChips}\n`));
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

      // Show source citations
      if (context.length > 0) {
        console.log(chalk.gray('\n📚 Sources:'));
        context.forEach((item, idx) => {
          const date = item.date ? new Date(item.date).toISOString().split('T')[0] : 'Unknown';
          const source = item.source.toUpperCase();
          const title = item.title ? ` — ${item.title}` : '';
          console.log(chalk.gray(`  [${idx + 1}] ${source}${title} (${date})`));
        });
      }
    } else {
      console.log(
        JSON.stringify({
          response: fullResponse,
          sources: sourceCounts,
          context: context.map((item) => ({
            source: item.source,
            title: item.title,
            date: item.date,
            url: item.url,
          })),
        })
      );
    }
  } catch (error) {
    console.error(chalk.red('Error processing message:'), error);
  }
}
