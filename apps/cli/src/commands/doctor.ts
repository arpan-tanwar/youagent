import chalk from 'chalk';
import { existsSync } from 'fs';
import { validateConfig, getConfig } from '@youagent/config';
import { initDb, sourceItemsRepo } from '@youagent/data';
import { createIndex } from '@youagent/index';
import { initGemini } from '@youagent/ai';

interface CheckResult {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

export async function doctorCommand(): Promise<void> {
  console.log(chalk.bold.blue('\n🔍 Running YouAgent health checks\n'));

  const checks: CheckResult[] = [];

  // Check 1: Environment config
  const configCheck = validateConfig();
  if (configCheck.success) {
    checks.push({
      name: 'Configuration',
      status: 'pass',
      message: 'All required environment variables set',
    });
  } else {
    checks.push({
      name: 'Configuration',
      status: 'fail',
      message: `Missing: ${configCheck.errors?.errors.map((e) => e.path.join('.')).join(', ')}`,
    });
  }

  let config;
  try {
    config = getConfig();
  } catch {
    // Config already checked above
  }

  // Check 2: Home directory
  if (config && existsSync(config.youagentHome)) {
    checks.push({
      name: 'Home Directory',
      status: 'pass',
      message: `Found at ${config.youagentHome}`,
    });
  } else {
    checks.push({
      name: 'Home Directory',
      status: 'warn',
      message: 'Not initialized. Run `youagent init`',
    });
  }

  // Check 3: Database
  if (config && existsSync(config.dbPath!)) {
    try {
      const db = initDb(config.dbPath!);
      const items = await sourceItemsRepo.findBySource('github');
      checks.push({
        name: 'Database',
        status: 'pass',
        message: `Connected (${items.length} GitHub items)`,
      });
    } catch (error) {
      checks.push({
        name: 'Database',
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    checks.push({
      name: 'Database',
      status: 'warn',
      message: 'Not found. Run `youagent init`',
    });
  }

  // Check 4: Vector index
  if (config && existsSync(`${config.youagentHome}/vectors.db`)) {
    try {
      const vectorIndex = createIndex(config.vectorBackend, {
        dbPath: `${config.youagentHome}/vectors.db`,
        dimension: 768,
      });
      const count = await vectorIndex.count();
      checks.push({
        name: 'Vector Index',
        status: 'pass',
        message: `Connected (${count} embeddings)`,
      });
    } catch (error) {
      checks.push({
        name: 'Vector Index',
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  } else {
    checks.push({
      name: 'Vector Index',
      status: 'warn',
      message: 'Not found. Run `youagent init`',
    });
  }

  // Check 5: Gemini API
  if (config) {
    try {
      const gemini = initGemini(config.geminiApiKey, config.geminiModel);
      const testEmbedding = await gemini.embed(['test']);
      if (testEmbedding.length > 0) {
        checks.push({
          name: 'Gemini API',
          status: 'pass',
          message: 'Connected successfully',
        });
      }
    } catch (error) {
      checks.push({
        name: 'Gemini API',
        status: 'fail',
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Display results
  for (const check of checks) {
    const icon = check.status === 'pass' ? '✓' : check.status === 'warn' ? '⚠' : '✗';
    const color =
      check.status === 'pass' ? chalk.green : check.status === 'warn' ? chalk.yellow : chalk.red;
    console.log(color(`${icon} ${check.name}: ${check.message}`));
  }

  const failCount = checks.filter((c) => c.status === 'fail').length;
  const warnCount = checks.filter((c) => c.status === 'warn').length;

  console.log();
  if (failCount > 0) {
    console.log(chalk.red(`${failCount} checks failed`));
    process.exit(1);
  } else if (warnCount > 0) {
    console.log(chalk.yellow(`${warnCount} warnings`));
  } else {
    console.log(chalk.green('All checks passed!'));
  }
  console.log();
}

