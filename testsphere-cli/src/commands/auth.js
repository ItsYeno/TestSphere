const inquirer = require('inquirer');
const chalk = require('chalk');
const { apiClient } = require('../utils/apiClient');
const { configManager } = require('../utils/configManager');

const authCommand = async (options) => {
  try {
    if (options.login) {
      await handleLogin();
    } else if (options.logout) {
      await handleLogout();
    } else if (options.status) {
      await handleStatus();
    } else {
      // Default: show status
      await handleStatus();
    }
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
};

const handleLogin = async () => {
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'email',
      message: 'Email:',
      validate: input => input ? true : 'Email is required'
    },
    {
      type: 'password',
      name: 'password',
      message: 'Password:',
      mask: '*'
    }
  ]);

  console.log(chalk.blue('🔐 Logging in...'));
  
  const response = await apiClient.login(answers);
  
  if (response.success) {
    configManager.set('token', response.data.token);
    configManager.set('user', response.data.user);
    console.log(chalk.green(`✅ Logged in as ${response.data.user.name}`));
  } else {
    console.log(chalk.red(`❌ Login failed: ${response.error}`));
  }
};

const handleLogout = async () => {
  configManager.clear();
  console.log(chalk.green('✅ Logged out successfully'));
};

const handleStatus = async () => {
  const token = configManager.get('token');
  const user = configManager.get('user');
  
  if (token && user) {
    console.log(chalk.green(`✅ Logged in as ${user.name} (${user.email})`));
    console.log(chalk.blue(`🏢 Team: ${user.team?.display_name}`));
    console.log(chalk.blue(`👤 Role: ${user.role}`));
  } else {
    console.log(chalk.yellow('❌ Not logged in'));
  }
};

module.exports = authCommand;