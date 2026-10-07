const inquirer = require('inquirer');
const chalk = require('chalk');
const { configManager } = require('../utils/configManager');

const initCommand = async () => {
  try {
    console.log(chalk.blue('🚀 Initializing TestSphere configuration...'));
    
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectId',
        message: 'Project ID:',
        validate: input => input ? true : 'Project ID is required'
      },
      {
        type: 'input',
        name: 'projectName',
        message: 'Project Name:'
      },
      {
        type: 'list',
        name: 'defaultEnvironment',
        message: 'Default Environment:',
        choices: ['development', 'staging', 'preproduction', 'production']
      },
      {
        type: 'list',
        name: 'testFramework',
        message: 'Primary Test Framework:',
        choices: ['playwright', 'cypress', 'appium', 'selenium', 'postman', 'other']
      }
    ]);

    const config = {
      projectId: answers.projectId,
      projectName: answers.projectName,
      defaultEnvironment: answers.defaultEnvironment,
      testFramework: answers.testFramework
    };

    await configManager.setProjectConfig(config);
    
    console.log(chalk.green('✅ TestSphere configuration created!'));
    console.log(chalk.blue('📁 Configuration saved to testsphere.json'));
    
  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
};

module.exports = initCommand;