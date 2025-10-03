import { Command } from 'commander';
import chalk from 'chalk';
import prompts from 'prompts';
import { getConfig, loadConfig } from '@youagent/config';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

interface ConfigOptions {
  get?: string;
  set?: string;
  value?: string;
  list?: boolean;
  edit?: boolean;
}

// Configuration schema for validation
const configSchema = {
  nodeEnv: 'development',
  youagentHome: '~/.youagent',
  dbPath: '~/.youagent/youagent.db',
  vectorBackend: 'sqlite-vss',
  geminiApiKey: '***',
  geminiModel: 'gemini-2.0-flash',
  githubToken: '***',
  twitterRssUrl: 'https://example.com/twitter/rss',
  siteRssUrl: 'https://example.com/blog/rss',
};

export async function configCommand(options: ConfigOptions): Promise<void> {
  try {
    if (options.list) {
      await listConfig();
    } else if (options.edit) {
      await editConfig();
    } else if (options.get) {
      await getConfigValue(options.get);
    } else if (options.set && options.value) {
      await setConfigValue(options.set, options.value);
    } else {
      // Default: show current config
      await showConfig();
    }
  } catch (error) {
    console.error(chalk.red('\n✗ Config command failed:'), error);
    process.exit(1);
  }
}

async function showConfig(): Promise<void> {
  console.log(chalk.bold.blue('\n🔧 YouAgent Configuration\n'));

  const config = getConfig();
  const configPath = resolve(process.cwd(), '.env');

  console.log(chalk.gray(`Config file: ${configPath}`));
  console.log(chalk.gray(`Exists: ${existsSync(configPath) ? 'Yes' : 'No'}\n`));

  // Create a table-like display
  const configEntries = [
    { key: 'NODE_ENV', value: config.nodeEnv, description: 'Environment mode' },
    { key: 'YOUAGENT_HOME', value: config.youagentHome, description: 'Data directory' },
    { key: 'DB_PATH', value: config.dbPath, description: 'Database file path' },
    { key: 'VECTOR_BACKEND', value: config.vectorBackend, description: 'Vector search backend' },
    {
      key: 'GEMINI_API_KEY',
      value: config.geminiApiKey ? '***' : '(not set)',
      description: 'Gemini API key',
    },
    { key: 'GEMINI_MODEL', value: config.geminiModel, description: 'Gemini model name' },
    {
      key: 'GITHUB_TOKEN',
      value: config.githubToken ? '***' : '(not set)',
      description: 'GitHub access token',
    },
    {
      key: 'TWITTER_RSS_URL',
      value: config.twitterRssUrl || '(not set)',
      description: 'Twitter RSS feed URL',
    },
    {
      key: 'SITE_RSS_URL',
      value: config.siteRssUrl || '(not set)',
      description: 'Blog RSS feed URL',
    },
  ];

  // Find the longest key for alignment
  const maxKeyLength = Math.max(...configEntries.map((entry) => entry.key.length));

  configEntries.forEach((entry) => {
    const key = entry.key.padEnd(maxKeyLength);
    const value = entry.value;
    const description = entry.description;

    let valueColor = chalk.green;
    if (value === '(not set)') valueColor = chalk.red;
    else if (value && value.includes('***')) valueColor = chalk.yellow;

    console.log(`${chalk.cyan(key)} ${valueColor((value || '').padEnd(20))} ${chalk.gray(description)}`);
  });

  console.log(chalk.gray('\nUse --help for more options'));
}

async function listConfig(): Promise<void> {
  console.log(chalk.bold.blue('\n📋 Available Configuration Keys\n'));

  const configKeys = Object.keys(configSchema);

  configKeys.forEach((key) => {
    const envKey = key.toUpperCase();
    const defaultValue = configSchema[key as keyof typeof configSchema];
    const description = getConfigDescription(key);

    console.log(`${chalk.cyan(envKey.padEnd(20))} ${chalk.gray(description)}`);
    console.log(`${' '.repeat(20)} ${chalk.dim(`Default: ${defaultValue}`)}\n`);
  });
}

async function getConfigValue(key: string): Promise<void> {
  const config = getConfig();
  const normalizedKey = key.toLowerCase();

  let value: string | undefined;

  switch (normalizedKey) {
    case 'nodeenv':
    case 'node_env':
      value = config.nodeEnv;
      break;
    case 'youagenthome':
    case 'youagent_home':
      value = config.youagentHome;
      break;
    case 'dbpath':
    case 'db_path':
      value = config.dbPath;
      break;
    case 'vectorbackend':
    case 'vector_backend':
      value = config.vectorBackend;
      break;
    case 'gemini_api_key':
      value = config.geminiApiKey ? '***' : undefined;
      break;
    case 'geminimodel':
    case 'gemini_model':
      value = config.geminiModel;
      break;
    case 'github_token':
      value = config.githubToken ? '***' : undefined;
      break;
    case 'twitter_rss_url':
      value = config.twitterRssUrl || undefined;
      break;
    case 'site_rss_url':
      value = config.siteRssUrl || undefined;
      break;
    default:
      console.error(chalk.red(`Unknown config key: ${key}`));
      console.log(chalk.gray('Use "youagent config --list" to see available keys'));
      process.exit(1);
  }

  if (value === undefined) {
    console.log(chalk.red('(not set)'));
  } else {
    console.log(value);
  }
}

async function setConfigValue(key: string, value: string): Promise<void> {
  const envPath = resolve(process.cwd(), '.env');

  // Read existing .env file
  let envContent = '';
  if (existsSync(envPath)) {
    envContent = readFileSync(envPath, 'utf8');
  }

  // Convert key to environment variable format
  const envKey = key.toUpperCase().replace(/-/g, '_');

  // Update or add the key
  const lines = envContent.split('\n');
  let found = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line && line.startsWith(`${envKey}=`)) {
      lines[i] = `${envKey}=${value}`;
      found = true;
      break;
    }
  }

  if (!found) {
    lines.push(`${envKey}=${value}`);
  }

  // Write back to .env file
  writeFileSync(envPath, lines.join('\n'));

  console.log(chalk.green(`✓ Set ${envKey}=${value}`));
  console.log(chalk.gray('Note: Restart YouAgent for changes to take effect'));
}

async function editConfig(): Promise<void> {
  const envPath = resolve(process.cwd(), '.env');

  if (!existsSync(envPath)) {
    console.log(chalk.yellow('⚠️  No .env file found. Creating one...'));
    writeFileSync(envPath, '# YouAgent Configuration\n');
  }

  const editor = process.env.EDITOR || process.env.VISUAL || 'nano';

  console.log(chalk.blue(`Opening ${envPath} in ${editor}...`));

  // Note: In a real implementation, you'd spawn the editor process
  // For now, just show the path
  console.log(chalk.gray(`Run: ${editor} ${envPath}`));
  console.log(chalk.gray('Note: Restart YouAgent after editing'));
}

function getConfigDescription(key: string): string {
  const descriptions: Record<string, string> = {
    nodeEnv: 'Environment mode (development, production, test)',
    youagentHome: 'Directory for storing YouAgent data',
    dbPath: 'Path to the SQLite database file',
    vectorBackend: 'Vector search backend (sqlite-vss)',
    geminiApiKey: 'Google Gemini API key for LLM access',
    geminiModel: 'Gemini model name (gemini-2.0-flash, etc.)',
    githubToken: 'GitHub personal access token',
    twitterRssUrl: 'Twitter RSS feed URL (via RSSHub)',
    siteRssUrl: 'Your blog/site RSS feed URL',
  };

  return descriptions[key] || 'Configuration option';
}
