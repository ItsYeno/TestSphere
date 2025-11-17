const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const inquirer = require('inquirer');
const { apiClient } = require('../utils/apiClient');
const { configManager } = require('../utils/configManager');
const { fileParser } = require('../utils/fileParser');

const uploadCommand = async (options) => {
  try {
    // Check authentication
    const token = configManager.get('token');
    if (!token) {
      console.log(chalk.red('❌ Not authenticated. Please run "testsphere auth --login" first.'));
      return;
    }

    // Determine results directory/file
    let resultsPath = options.dir || options.file || './test-results';
    
    if (!(await fs.pathExists(resultsPath))) {
      console.log(chalk.red(`❌ Path not found: ${resultsPath}`));
      return;
    }

    // Get project configuration
    let projectId = options.project;
    let buildVersion = options.build;
    let environment = options.env;

    if (!projectId) {
      const config = await configManager.getProjectConfig();
      projectId = config?.projectId;
    }

    if (!projectId) {
      console.log(chalk.yellow('ℹ️  No project ID specified.'));
      
      const answer = await inquirer.prompt([
        {
          type: 'input',
          name: 'projectId',
          message: 'Enter project ID:',
          validate: input => input ? true : 'Project ID is required'
        }
      ]);
      projectId = answer.projectId;
    }

    // Parse test results
    console.log(chalk.blue('📁 Parsing test results...'));
    const testResults = await fileParser.parseResults(resultsPath);

    if (!testResults) {
      console.log(chalk.red('❌ No test results found or unsupported format.'));
      return;
    }

    // Prepare upload data
    const uploadData = {
      project_id: projectId,
      build_version: buildVersion || testResults.buildVersion || '1.0.0',
      environment: environment || testResults.environment || 'development',
      test_framework: testResults.testFramework || 'unknown',
      start_time: testResults.startTime || new Date().toISOString(),
      end_time: testResults.endTime || new Date().toISOString(),
      duration: testResults.duration || 0,
      status: testResults.status || 'completed',
      test_cases: testResults.testCases || []
    };

    // Upload to API
    console.log(chalk.blue('🔼 Uploading test results...'));
    const response = await apiClient.uploadTestResults(uploadData);

    if (response.success) {
      console.log(chalk.green('✅ Test results uploaded successfully!'));
      console.log(chalk.blue(`📊 View results at: ${configManager.get('apiUrl')}/test-runs/${response.data.id}`));
    } else {
      console.log(chalk.red(`❌ Upload failed: ${response.error}`));
    }

  } catch (error) {
    console.log(chalk.red(`❌ Error: ${error.message}`));
  }
};

module.exports = uploadCommand;