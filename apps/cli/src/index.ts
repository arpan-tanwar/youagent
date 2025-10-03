#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { chatCommand } from './commands/chat.js';
import { refreshCommand } from './commands/refresh.js';
import { doctorCommand } from './commands/doctor.js';

const program = new Command();

program.name('youagent').description('Local-first personal AI agent').version('0.1.0');

program
  .command('init')
  .description('Initialize YouAgent with your data sources')
  .action(initCommand);

program
  .command('chat')
  .description('Chat with your agent (interactive REPL)')
  .option('-m, --message <message>', 'Single message mode')
  .option('--json', 'Output JSON format')
  .action(chatCommand);

program
  .command('refresh')
  .description('Refresh data from sources')
  .option('--all', 'Refresh all sources')
  .option('--github', 'Refresh GitHub only')
  .option('--twitter', 'Refresh Twitter only')
  .option('--rss', 'Refresh RSS only')
  .option('--resume', 'Refresh resume only')
  .action(refreshCommand);

program
  .command('doctor')
  .description('Check system health and configuration')
  .action(doctorCommand);

program.parse();

