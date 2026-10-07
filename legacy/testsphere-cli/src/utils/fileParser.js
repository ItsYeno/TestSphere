const fs = require('fs-extra');
const path = require('path');
const glob = require('glob');

// Import all reporters
const playwrightReporter = require('./reporters/playwright');
const cypressReporter = require('./reporters/cypress');
const appiumReporter = require('./reporters/appium');
const seleniumReporter = require('./reporters/selenium');
const postmanReporter = require('./reporters/postman');
const detoxReporter = require('./reporters/detox');
const restAssuredReporter = require('./reporters/restassured');
const mochaReporter = require('./reporters/mocha');
const junitReporter = require('./reporters/junit');

class FileParser {
  constructor() {
    this.reporters = {
      // Web Testing
      playwright: playwrightReporter,
      cypress: cypressReporter,
      selenium: seleniumReporter,
      
      // Mobile Testing
      appium: appiumReporter,
      detox: detoxReporter,
      
      // API Testing
      postman: postmanReporter,
      'rest-assured': restAssuredReporter,
      
      // Generic/JavaScript
      mocha: mochaReporter,
      junit: junitReporter
    };
  }

  async detectFramework(resultsPath) {
    const stats = await fs.stat(resultsPath);
    
    if (stats.isDirectory()) {
      // Check for framework-specific directories and files
      if (await fs.pathExists(path.join(resultsPath, 'playwright-report'))) return 'playwright';
      if (await fs.pathExists(path.join(resultsPath, 'cypress.json'))) return 'cypress';
      if (await fs.pathExists(path.join(resultsPath, 'newman'))) return 'postman';
      if (await fs.pathExists(path.join(resultsPath, 'detox.junit.xml'))) return 'detox';
      
      // Check file patterns
      const files = await fs.readdir(resultsPath);
      if (files.some(f => f.includes('playwright'))) return 'playwright';
      if (files.some(f => f.includes('cypress'))) return 'cypress';
      if (files.some(f => f.includes('newman') || f.includes('postman'))) return 'postman';
      if (files.some(f => f.includes('detox'))) return 'detox';
      if (files.some(f => f.includes('appium'))) return 'appium';
      if (files.some(f => f.includes('selenium'))) return 'selenium';
      if (files.some(f => f.includes('mocha'))) return 'mocha';
      if (files.some(f => f.endsWith('.xml'))) return 'junit';
      
    } else {
      // Single file detection
      const filename = path.basename(resultsPath).toLowerCase();
      
      if (filename.includes('playwright')) return 'playwright';
      if (filename.includes('cypress')) return 'cypress';
      if (filename.includes('newman') || filename.includes('postman')) return 'postman';
      if (filename.includes('detox')) return 'detox';
      if (filename.includes('appium')) return 'appium';
      if (filename.includes('selenium')) return 'selenium';
      if (filename.includes('mocha')) return 'mocha';
      if (filename.includes('rest-assured')) return 'rest-assured';
      if (filename.endsWith('.xml')) return 'junit';
      
      // Check JSON content for framework hints
      if (filename.endsWith('.json')) {
        try {
          const content = await fs.readJson(resultsPath);
          if (content.config?.testFramework) return content.config.testFramework;
          if (content.framework) return content.framework;
        } catch (error) {
          // Not JSON or invalid JSON
        }
      }
    }

    return null;
  }

 
  async parseGeneric(resultsPath) {
    const stats = await fs.stat(resultsPath);
    
    if (stats.isDirectory()) {
      // Try to find and parse any result files
      const jsonFiles = glob.sync('**/*.json', { cwd: resultsPath });
      const xmlFiles = glob.sync('**/*.xml', { cwd: resultsPath });
      
      for (const file of [...jsonFiles, ...xmlFiles]) {
        const filePath = path.join(resultsPath, file);
        try {
          const result = await this.parseFile(filePath);
          if (result) return result;
        } catch (error) {
          // Continue to next file
        }
      }
    } else {
      return await this.parseFile(resultsPath);
    }

    return null;
  }

  async parseFile(filePath) {
    if (filePath.endsWith('.json')) {
      const content = await fs.readJson(filePath);
      return this.normalizeResults(content);
    } else if (filePath.endsWith('.xml')) {
      return await this.reporters.junit.parse(filePath);
    }
    
    return null;
  }

  normalizeResults(rawResults) {
    // Basic normalization for unknown formats
    return {
      buildVersion: '1.0.0',
      environment: 'unknown',
      testFramework: 'generic',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      status: 'completed',
      testCases: this.extractTestCases(rawResults),
      duration: this.calculateDuration(rawResults)
    };
  }

  extractTestCases(rawResults) {
    // Generic test case extraction logic
    if (Array.isArray(rawResults)) {
      return rawResults.map(tc => ({
        title: tc.name || tc.title || 'Unknown Test',
        status: tc.status || (tc.passed ? 'passed' : 'failed'),
        duration: tc.duration || 0,
        failureMessage: tc.error || tc.failureMessage,
        stackTrace: tc.stackTrace
      }));
    }
    
    return [];
  }

  calculateDuration(rawResults) {
    // Simple duration calculation
    return rawResults.duration || rawResults.totalTime || 0;
  }
}

module.exports = new FileParser();
