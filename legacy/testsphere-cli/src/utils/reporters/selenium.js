const fs = require('fs-extra');
const path = require('path');

class SeleniumReporter {
  async parse(resultsPath) {
    try {
      let reportData;
      
      if ((await fs.stat(resultsPath)).isDirectory()) {
        // Selenium typically uses JUnit format or custom JSON
        const junitFile = path.join(resultsPath, 'TEST-results.xml');
        const jsonFile = path.join(resultsPath, 'selenium-results.json');
        
        if (await fs.pathExists(junitFile)) {
          // Use JUnit reporter for Selenium JUnit output
          const junitReporter = require('./junit');
          return await junitReporter.parse(junitFile);
        } else if (await fs.pathExists(jsonFile)) {
          reportData = await fs.readJson(jsonFile);
        }
      } else {
        reportData = await fs.readJson(resultsPath);
      }

      if (!reportData) {
        throw new Error('No Selenium report data found');
      }

      return this.convertToStandardFormat(reportData);
      
    } catch (error) {
      throw new Error(`Selenium report parsing failed: ${error.message}`);
    }
  }

  convertToStandardFormat(seleniumData) {
    const testCases = [];
    let totalDuration = 0;
    let passedCount = 0;
    let failedCount = 0;

    // Handle different Selenium report formats
    if (seleniumData.suites) {
      // WebDriverIO format
      seleniumData.suites.forEach(suite => {
        suite.tests.forEach(test => {
          const testCase = {
            title: test.name,
            fullName: `${suite.name} - ${test.name}`,
            status: test.passed ? 'passed' : 'failed',
            duration: test.duration || 0,
            failureMessage: test.error?.message,
            stackTrace: test.error?.stack,
            attachments: this.extractAttachments(test)
          };

          testCases.push(testCase);
          totalDuration += test.duration || 0;
          if (test.passed) passedCount++;
          else failedCount++;
        });
      });
    } else if (seleniumData.results) {
      // Protractor format
      seleniumData.results.forEach(spec => {
        spec.assertions.forEach(assertion => {
          testCases.push({
            title: assertion.description,
            fullName: `${spec.description} - ${assertion.description}`,
            status: assertion.passed ? 'passed' : 'failed',
            duration: 0,
            failureMessage: assertion.errorMsg
          });
        });
      });
    } else if (Array.isArray(seleniumData)) {
      // Custom Selenium JSON format
      seleniumData.forEach(test => {
        testCases.push({
          title: test.name,
          status: test.status,
          duration: test.duration || 0,
          failureMessage: test.error,
          attachments: this.extractAttachments(test)
        });
      });
    }

    return {
      buildVersion: seleniumData.buildVersion || '1.0.0',
      environment: seleniumData.environment || 'web',
      testFramework: 'selenium',
      startTime: seleniumData.startTime || new Date().toISOString(),
      endTime: seleniumData.endTime || new Date().toISOString(),
      duration: totalDuration,
      status: failedCount > 0 ? 'failed' : 'passed',
      total_tests: testCases.length,
      passed_tests: passedCount,
      failed_tests: failedCount,
      testCases
    };
  }

  extractAttachments(test) {
    const attachments = [];
    
    if (test.screenshots) {
      test.screenshots.forEach((screenshot, index) => {
        attachments.push({
          type: 'screenshot',
          name: `screenshot-${index + 1}.png`,
          path: screenshot
        });
      });
    }

    return attachments;
  }
}

module.exports = new SeleniumReporter();