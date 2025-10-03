import prompts from 'prompts';
import ora from 'ora';
import chalk from 'chalk';
import { existsSync, mkdirSync } from 'fs';
import { getConfig } from '@youagent/config';
import { initDb, runMigrations, sourceItemsRepo, consentRepo } from '@youagent/data';
import { createIndex } from '@youagent/index';
import { initGemini } from '@youagent/ai';
import {
  GitHubConnector,
  RSSConnector,
  ResumeConnector,
  TwitterConnector,
} from '@youagent/connectors';
import { sha256 } from '@youagent/utils/hash';

export async function initCommand(): Promise<void> {
  console.log(chalk.bold.blue('\n🤖 Welcome to YouAgent!\n'));
  console.log("Let's set up your personal AI agent.\n");

  try {
    // Load config
    const config = getConfig();

    // Ensure home directory exists
    if (!existsSync(config.youagentHome)) {
      mkdirSync(config.youagentHome, { recursive: true });
    }

    // Initialize database
    const spinner = ora('Initializing database...').start();
    const db = initDb(config.dbPath!);
    await runMigrations(db);
    spinner.succeed('Database initialized');

    // Initialize vector index
    spinner.start('Initializing vector index...');
    const vectorIndex = createIndex(config.vectorBackend, {
      dbPath: `${config.youagentHome}/vectors.db`,
      dimension: 768,
    });
    spinner.succeed('Vector index initialized');

    // Initialize Gemini
    spinner.start('Connecting to Gemini...');
    initGemini(config.geminiApiKey, config.geminiModel);
    spinner.succeed('Connected to Gemini');

    // Collect user preferences
    console.log(chalk.bold('\nData Sources Configuration:\n'));

    const answers = await prompts([
      {
        type: 'text',
        name: 'githubUsername',
        message: 'GitHub username:',
        validate: (value: string) => value.length > 0 || 'Required',
      },
      {
        type: 'confirm',
        name: 'enableTwitter',
        message: 'Enable Twitter/X integration?',
        initial: false,
      },
      {
        type: 'confirm',
        name: 'enableRss',
        message: 'Enable Blog/RSS integration?',
        initial: false,
      },
      {
        type: 'text',
        name: 'rssUrl',
        message: 'Blog RSS URL:',
        initial: '',
        validate: (value: string, prev: Record<string, unknown>) =>
          !prev.enableRss || value.length > 0 || 'Required when RSS is enabled',
      },
      {
        type: 'confirm',
        name: 'enableResume',
        message: 'Upload resume (PDF)?',
        initial: false,
      },
      {
        type: 'text',
        name: 'resumePath',
        message: 'Resume PDF path:',
        initial: '',
        validate: (value: string, prev: Record<string, unknown>) =>
          !prev.enableResume || value.length > 0 || 'Required when resume is enabled',
      },
    ]);

    // Grant consent
    await consentRepo.grant('github');
    if (answers.enableTwitter) await consentRepo.grant('twitter');
    if (answers.enableRss) await consentRepo.grant('rss');
    if (answers.enableResume) await consentRepo.grant('resume');

    // Fetch data from sources
    console.log(chalk.bold('\nFetching your data...\n'));

    // GitHub
    if (config.githubToken && answers.githubUsername) {
      const githubSpinner = ora('Fetching GitHub data...').start();
      try {
        const github = new GitHubConnector({
          token: config.githubToken,
          username: answers.githubUsername,
        });
        const items = await github.fetch();

        for (const item of items) {
          await sourceItemsRepo.upsert({
            ...item,
            metadata: item.metadata ? JSON.stringify(item.metadata) : undefined,
          });
        }

        githubSpinner.succeed(`Fetched ${items.length} items from GitHub`);
      } catch (error) {
        githubSpinner.fail('Failed to fetch GitHub data');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
    }

    // RSS
    if (answers.enableRss && answers.rssUrl) {
      const rssSpinner = ora('Fetching RSS data...').start();
      try {
        const rss = new RSSConnector({ url: answers.rssUrl });
        const items = await rss.fetch();

        for (const item of items) {
          await sourceItemsRepo.upsert({
            ...item,
            metadata: item.metadata ? JSON.stringify(item.metadata) : undefined,
          });
        }

        rssSpinner.succeed(`Fetched ${items.length} items from RSS`);
      } catch (error) {
        rssSpinner.fail('Failed to fetch RSS data');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
    }

    // Resume
    if (answers.enableResume && answers.resumePath) {
      const resumeSpinner = ora('Parsing resume...').start();
      try {
        const resume = new ResumeConnector({ pdfPath: answers.resumePath });
        const items = await resume.fetch();

        for (const item of items) {
          await sourceItemsRepo.upsert({
            ...item,
            metadata: item.metadata ? JSON.stringify(item.metadata) : undefined,
          });
        }

        resumeSpinner.succeed(`Parsed resume (${items.length} sections)`);
      } catch (error) {
        resumeSpinner.fail('Failed to parse resume');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      }
    }

    // Generate embeddings
    console.log(chalk.bold('\nGenerating embeddings...\n'));
    const embeddingSpinner = ora('Creating vector embeddings...').start();

    try {
      const gemini = initGemini(config.geminiApiKey, config.geminiModel);
      const allItems = await sourceItemsRepo.findBySource('github');
      const rssItems = await sourceItemsRepo.findBySource('rss');
      const resumeItems = await sourceItemsRepo.findBySource('resume');

      const items = [...allItems, ...rssItems, ...resumeItems];

      if (items.length > 0) {
        // Batch embeddings (process in chunks of 10)
        const batchSize = 10;
        for (let i = 0; i < items.length; i += batchSize) {
          const batch = items.slice(i, i + batchSize);
          const texts = batch.map((item) => `${item.title || ''}\n${item.content}`.trim());
          const embeddings = await gemini.embed(texts);

          // Upsert to vector index
          await vectorIndex.upsert(
            batch.map((item) => ({
              id: item.id,
              text: texts[batch.indexOf(item)]!,
              metadata: { source: item.source },
            })),
            embeddings
          );

          embeddingSpinner.text = `Creating embeddings... (${Math.min(i + batchSize, items.length)}/${items.length})`;
        }
      }

      embeddingSpinner.succeed(`Generated embeddings for ${items.length} items`);
    } catch (error) {
      embeddingSpinner.fail('Failed to generate embeddings');
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    }

    console.log(chalk.bold.green('\n✓ YouAgent initialized successfully!\n'));
    console.log('Run ' + chalk.cyan('youagent chat') + ' to start chatting.\n');
  } catch (error) {
    console.error(chalk.red('\n✗ Initialization failed:'), error);
    process.exit(1);
  }
}
