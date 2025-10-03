import ora from 'ora';
import chalk from 'chalk';
import { getConfig } from '@youagent/config';
import { initDb, sourceItemsRepo, consentRepo } from '@youagent/data';
import { createIndex } from '@youagent/index';
import { initGemini } from '@youagent/ai';
import { GitHubConnector, RSSConnector, ResumeConnector } from '@youagent/connectors';

interface RefreshOptions {
  all?: boolean;
  github?: boolean;
  twitter?: boolean;
  rss?: boolean;
  resume?: boolean;
}

export async function refreshCommand(options: RefreshOptions): Promise<void> {
  console.log(chalk.bold.blue('\n🔄 Refreshing data sources\n'));

  try {
    const config = getConfig();
    const db = initDb(config.dbPath!);
    const vectorIndex = createIndex(config.vectorBackend, {
      dbPath: `${config.youagentHome}/vectors.db`,
      dimension: 768,
    });
    const gemini = initGemini(config.geminiApiKey, config.geminiModel);

    const shouldRefreshAll =
      options.all || (!options.github && !options.twitter && !options.rss && !options.resume);

    // GitHub
    if (shouldRefreshAll || options.github) {
      const hasConsent = await consentRepo.isGranted('github');
      if (hasConsent && config.githubToken) {
        const spinner = ora('Refreshing GitHub...').start();
        try {
          // For simplicity, assume we have username in settings (or prompt user)
          // In production, store username during init
          const username = process.env.GITHUB_USERNAME || 'user';

          const github = new GitHubConnector({
            token: config.githubToken,
            username,
          });

          const items = await github.fetch();
          let updated = 0;

          for (const item of items) {
            const existing = await sourceItemsRepo.findById(item.id);
            if (!existing || existing.contentHash !== item.contentHash) {
              await sourceItemsRepo.upsert({
                ...item,
                metadata: item.metadata ? JSON.stringify(item.metadata) : undefined,
              });

              // Re-embed changed items
              const text = `${item.title || ''}\n${item.content}`.trim();
              const embeddings = await gemini.embed([text]);
              await vectorIndex.upsert(
                [{ id: item.id, text, metadata: { source: item.source } }],
                embeddings
              );

              updated++;
            }
          }

          spinner.succeed(`GitHub: ${updated} items updated`);
        } catch (error) {
          spinner.fail('Failed to refresh GitHub');
          console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        }
      }
    }

    // RSS
    if (shouldRefreshAll || options.rss) {
      const hasConsent = await consentRepo.isGranted('rss');
      if (hasConsent && config.siteRssUrl) {
        const spinner = ora('Refreshing RSS...').start();
        try {
          const rss = new RSSConnector({ url: config.siteRssUrl });
          const items = await rss.fetch();
          let updated = 0;

          for (const item of items) {
            const existing = await sourceItemsRepo.findById(item.id);
            if (!existing || existing.contentHash !== item.contentHash) {
              await sourceItemsRepo.upsert({
                ...item,
                metadata: item.metadata ? JSON.stringify(item.metadata) : undefined,
              });

              const text = `${item.title || ''}\n${item.content}`.trim();
              const embeddings = await gemini.embed([text]);
              await vectorIndex.upsert(
                [{ id: item.id, text, metadata: { source: item.source } }],
                embeddings
              );

              updated++;
            }
          }

          spinner.succeed(`RSS: ${updated} items updated`);
        } catch (error) {
          spinner.fail('Failed to refresh RSS');
          console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        }
      }
    }

    console.log(chalk.bold.green('\n✓ Refresh complete\n'));
  } catch (error) {
    console.error(chalk.red('\n✗ Refresh failed:'), error);
    process.exit(1);
  }
}
