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

    // First, ask for GitHub username (required)
    const githubAnswer = await prompts({
      type: 'text',
      name: 'githubUsername',
      message: 'GitHub username:',
      validate: (value: string) => value.length > 0 || 'Required',
    });

    // Ask for optional integrations
    const integrationAnswers = await prompts([
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
        type: 'confirm',
        name: 'enableResume',
        message: 'Upload resume (PDF)?',
        initial: false,
      },
    ]);

    // Ask for RSS URL only if enabled
    let rssUrl = '';
    if (integrationAnswers.enableRss) {
      const rssAnswer = await prompts({
        type: 'text',
        name: 'rssUrl',
        message: 'Blog RSS URL:',
        validate: (value: string) => value.length > 0 || 'Required when RSS is enabled',
      });
      rssUrl = rssAnswer.rssUrl;
    }

    // Ask for resume path only if enabled
    let resumePath = '';
    if (integrationAnswers.enableResume) {
      const resumeAnswer = await prompts({
        type: 'text',
        name: 'resumePath',
        message: 'Resume PDF path:',
        validate: (value: string) => value.length > 0 || 'Required when resume is enabled',
      });
      resumePath = resumeAnswer.resumePath;
    }

    // Combine all answers
    const answers = {
      ...githubAnswer,
      ...integrationAnswers,
      rssUrl,
      resumePath,
    };

    // Grant consent
    await consentRepo.grant('github');
    if (answers.enableTwitter) await consentRepo.grant('twitter');
    if (answers.enableRss) await consentRepo.grant('rss');
    if (answers.enableResume) await consentRepo.grant('resume');

    // Fetch data from sources
    console.log(chalk.bold('\nFetching your data...\n'));

    // GitHub
    if (answers.githubUsername) {
      if (!config.githubToken) {
        console.log(
          chalk.yellow('⚠️  GitHub token not found in environment. Skipping GitHub data fetch.')
        );
        console.log(chalk.gray('   Set GITHUB_TOKEN in your .env file to fetch GitHub data.'));
      } else {
        const githubSpinner = ora(`Fetching GitHub data for @${answers.githubUsername}...`).start();
        try {
          const github = new GitHubConnector({
            token: config.githubToken,
            username: answers.githubUsername,
          });
          const items = await github.fetch();

          if (items.length === 0) {
            githubSpinner.warn('No GitHub data found');
            console.log(
              chalk.gray('   This might be a private account or the username is incorrect.')
            );
          } else {
            for (const item of items) {
              await sourceItemsRepo.upsert({
                ...item,
                metadata: item.metadata ? JSON.stringify(item.metadata) : undefined,
              });
            }
            githubSpinner.succeed(`Fetched ${items.length} items from GitHub`);
          }
        } catch (error) {
          githubSpinner.fail('Failed to fetch GitHub data');
          if (error instanceof Error) {
            if (error.message.includes('404')) {
              console.error(chalk.red('   User not found. Please check the username.'));
            } else if (error.message.includes('401')) {
              console.error(chalk.red('   Invalid GitHub token. Please check GITHUB_TOKEN.'));
            } else if (error.message.includes('403')) {
              console.error(chalk.red('   GitHub API rate limit exceeded. Try again later.'));
            } else {
              console.error(chalk.red(`   ${error.message}`));
            }
          } else {
            console.error(chalk.red(`   ${String(error)}`));
          }
        }
      }
    }

    // Twitter (via RSS)
    if (answers.enableTwitter) {
      if (!config.twitterRssUrl) {
        console.log(
          chalk.yellow('⚠️  Twitter RSS URL not found in environment. Skipping Twitter data fetch.')
        );
        console.log(chalk.gray('   Set TWITTER_RSS_URL in your .env file to fetch Twitter data.'));
      } else {
        const twitterSpinner = ora('Fetching Twitter data via RSS...').start();
        try {
          const twitter = new TwitterConnector({ rssUrl: config.twitterRssUrl });
          const items = await twitter.fetch();

          if (items.length === 0) {
            twitterSpinner.warn('No Twitter data found');
            console.log(chalk.gray('   The RSS feed might be empty or invalid.'));
          } else {
            for (const item of items) {
              await sourceItemsRepo.upsert({
                ...item,
                metadata: item.metadata ? JSON.stringify(item.metadata) : undefined,
              });
            }
            twitterSpinner.succeed(`Fetched ${items.length} tweets from Twitter`);
          }
        } catch (error) {
          twitterSpinner.fail('Failed to fetch Twitter data');
          if (error instanceof Error) {
            if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
              console.error(
                chalk.red('   Network error. Please check your internet connection and RSS URL.')
              );
            } else if (error.message.includes('Invalid XML')) {
              console.error(chalk.red('   Invalid RSS feed. Please check TWITTER_RSS_URL.'));
            } else {
              console.error(chalk.red(`   ${error.message}`));
            }
          } else {
            console.error(chalk.red(`   ${String(error)}`));
          }
        }
      }
    }

    // RSS/Blog
    if (answers.enableRss && answers.rssUrl) {
      const rssSpinner = ora(`Fetching RSS data from ${answers.rssUrl}...`).start();
      try {
        const rss = new RSSConnector({ url: answers.rssUrl });
        const items = await rss.fetch();

        if (items.length === 0) {
          rssSpinner.warn('No RSS data found');
          console.log(chalk.gray('   The RSS feed might be empty or invalid.'));
        } else {
          for (const item of items) {
            await sourceItemsRepo.upsert({
              ...item,
              metadata: item.metadata ? JSON.stringify(item.metadata) : undefined,
            });
          }
          rssSpinner.succeed(`Fetched ${items.length} items from RSS`);
        }
      } catch (error) {
        rssSpinner.fail('Failed to fetch RSS data');
        if (error instanceof Error) {
          if (error.message.includes('ENOTFOUND') || error.message.includes('timeout')) {
            console.error(
              chalk.red('   Network error. Please check your internet connection and RSS URL.')
            );
          } else if (error.message.includes('Invalid XML')) {
            console.error(chalk.red('   Invalid RSS feed. Please check the URL.'));
          } else {
            console.error(chalk.red(`   ${error.message}`));
          }
        } else {
          console.error(chalk.red(`   ${String(error)}`));
        }
      }
    }

    // Resume
    if (answers.enableResume && answers.resumePath) {
      const resumeSpinner = ora(`Parsing resume from ${answers.resumePath}...`).start();
      try {
        // Check if file exists
        const fs = await import('fs/promises');
        try {
          await fs.access(answers.resumePath);
        } catch {
          throw new Error(`File not found: ${answers.resumePath}`);
        }

        const resume = new ResumeConnector({ pdfPath: answers.resumePath });
        const items = await resume.fetch();

        if (items.length === 0) {
          resumeSpinner.warn('No content found in resume');
          console.log(chalk.gray('   The PDF might be empty or corrupted.'));
        } else {
          for (const item of items) {
            await sourceItemsRepo.upsert({
              ...item,
              metadata: item.metadata ? JSON.stringify(item.metadata) : undefined,
            });
          }
          resumeSpinner.succeed(`Parsed resume (${items.length} sections)`);
        }
      } catch (error) {
        resumeSpinner.fail('Failed to parse resume');
        if (error instanceof Error) {
          if (error.message.includes('File not found')) {
            console.error(chalk.red(`   ${error.message}`));
          } else if (error.message.includes('pdf-parse')) {
            console.error(chalk.red('   PDF parsing failed. Make sure the file is a valid PDF.'));
          } else {
            console.error(chalk.red(`   ${error.message}`));
          }
        } else {
          console.error(chalk.red(`   ${String(error)}`));
        }
      }
    }

    // Generate embeddings
    console.log(chalk.bold('\nGenerating embeddings...\n'));
    const embeddingSpinner = ora('Creating vector embeddings...').start();

    try {
      const gemini = initGemini(config.geminiApiKey, config.geminiModel);
      const githubItems = await sourceItemsRepo.findBySource('github');
      const twitterItems = await sourceItemsRepo.findBySource('twitter');
      const rssItems = await sourceItemsRepo.findBySource('rss');
      const resumeItems = await sourceItemsRepo.findBySource('resume');

      const items = [...githubItems, ...twitterItems, ...rssItems, ...resumeItems];

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

    // Final summary
    console.log(chalk.bold.green('\n✓ YouAgent initialized successfully!\n'));

    // Show summary of what was fetched
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

    console.log(chalk.bold('📊 Data Summary:'));
    if (githubCount > 0) console.log(`   • GitHub: ${githubCount} items`);
    if (twitterCount > 0) console.log(`   • Twitter: ${twitterCount} tweets`);
    if (rssCount > 0) console.log(`   • RSS/Blog: ${rssCount} articles`);
    if (resumeCount > 0) console.log(`   • Resume: ${resumeCount} sections`);

    if (totalItems === 0) {
      console.log(chalk.yellow('   ⚠️  No data was fetched. Check your configuration.'));
    } else {
      console.log(chalk.green(`   ✅ Total: ${totalItems} items ready for chat`));
    }

    console.log('\n🚀 Next steps:');
    console.log('   • Run ' + chalk.cyan('youagent chat') + ' to start chatting');
    console.log('   • Run ' + chalk.cyan('youagent doctor') + ' to check system health');
    console.log('   • Run ' + chalk.cyan('youagent refresh') + ' to update your data\n');
  } catch (error) {
    console.error(chalk.red('\n✗ Initialization failed:'), error);
    process.exit(1);
  }
}
