#!/usr/bin/env node

const { Command } = require('commander');
const chalk = require('chalk');
const figlet = require('figlet');
const authCommand = require('./src/commands/auth');
const uploadCommand = require('./src/commands/upload');
const initCommand = require('./src/commands/init');
const configCommand = require('./src/commands/config');

const program = new Command();

// Display banner
console.log(
  chalk.hex('#FFCC00')(
    figlet.textSync('TestSphere', { horizontalLayout: 'full' })
  )
);
console.log(chalk.hex('#FFCC00')('MTN Enterprise Testing Dashboard CLI\n'));

program
  .name('testsphere')
  .description('CLI tool for uploading test results to TestSphere Dashboard')
  .version('1.0.0');

// Auth commands
program
  .command('auth')
  .description('Manage authentication')
  .option('-l, --login', 'Login to TestSphere')
  .option('-o, --logout', 'Logout from TestSphere')
  .option('-s, --status', 'Check login status')
  .action(authCommand);

// Upload command
program
  .command('upload')
  .description('Upload test results to TestSphere')
  .option('-d, --dir <directory>', 'Directory containing test results')
  .option('-f, --file <file>', 'Specific test results file')
  .option('-p, --project <projectId>', 'Project ID')
  .option('-b, --build <buildVersion>', 'Build version')
  .option('-e, --env <environment>', 'Test environment')
  .action(uploadCommand);

// Init command
program
  .command('init')
  .description('Initialize TestSphere configuration in current directory')
  .action(initCommand);

// Config command
program
  .command('config')
  .description('Manage CLI configuration')
  .option('-s, --set <key=value>', 'Set configuration value')
  .option('-g, --get <key>', 'Get configuration value')
  .option('-l, --list', 'List all configuration')
  .action(configCommand);

program.parse();