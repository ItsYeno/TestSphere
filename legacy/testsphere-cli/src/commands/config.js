const chalk = require('chalk');
const { configManager } = require('../utils/configManager');

const configCommand = async (options) => {
  try {
    if (options.set) {
      const [key, value] = options.set.split('=');
      if (key && value) {
        configManager.set(key, value);
        console.log(chalk.green(`✅ Set ${key} = ${value}`));
      } else {
        console.log(chalk.red('❌ Invalid format. Use: --set key=value'));
      }
    } else if (options.get) {
      const value = configManager.get(options.get);
      console.log(chalk.blue(`${options.get} = ${value || 'not set'}`));
    } else if (options.list) {
      const config = configManager.get();
      console.log(chalk.blue('📋 Current Configuration:'));
      Object.entries(config || {}).forEach(([key, value]) => {
        console.log(`  ${key}: ${value}`);
      });
    } else {
      console.log(chalk.yellow('ℹ️  Use --set, --get, or --list options'));
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
};

module.exports = configCommand;