const fs = require('fs-extra');
const path = require('path');

class AppiumReporter {
  async parse(resultsPath) {
    try {
      let reportData;
      
      if ((await fs.stat(resultsPath)).isDirectory()) {
        // Look for Appium test results
        const resultsFile = path.join(resultsPath, 'appium-results.json');
        if (await fs.pathExists(resultsFile)) {
          reportData = await fs.readJson(resultsFile);
        }
      } else {
        reportData = await fs.readJson(resultsPath);
      }

      if (!reportData) {
        // Try to parse from standard Appium output
        return await this.parseFromLogs(resultsPath);
      }

      return this.convertToStandardFormat(reportData);
      
    } catch (error) {
      throw new Error(`Appium report parsing failed: ${error.message}`);
    }
  }

  async parseFromLogs(resultsPath) {
    // Parse Appium server logs or test runner outputs
    const logFiles = await fs.readdir(resultsPath);
    const testCases = [];
    
    // This is a simplified parser - in reality, you'd want more sophisticated log parsing
    for (const file of logFiles) {
      if (file.endsWith('.log') || file.endsWith('.txt')) {
        const content = await fs.readFile(path.join(resultsPath, file), 'utf8');
        const lines = content.split('\n');
        
        lines.forEach(line => {
          if (line.includes('TEST PASSED:')) {
            testCases.push({
              title: line.split('TEST PASSED:')[1].trim(),
              status: 'passed',
              duration: 0
            });
          } else if (line.includes('TEST FAILED:')) {
            testCases.push({
              title: line.split('TEST FAILED:')[1].trim(),
              status: 'failed',
              duration: 0,
              failureMessage: 'Test failed - check Appium logs'
            });
          }
        });
      }
    }

    return {
      buildVersion: '1.0.0',
      environment: 'mobile',
      testFramework: 'appium',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: 0,
      status: testCases.some(tc => tc.status === 'failed') ? 'failed' : 'passed',
      total_tests: testCases.length,
      passed_tests: testCases.filter(tc => tc.status === 'passed').length,
      failed_tests: testCases.filter(tc => tc.status === 'failed').length,
      testCases
    };
  }

  convertToStandardFormat(appiumData) {
    const testCases = appiumData.tests?.map(test => ({
      title: test.name,
      fullName: test.fullName || test.name,
      status: test.status,
      duration: test.duration || 0,
      failureMessage: test.failure,
      stackTrace: test.stackTrace,
      attachments: this.extractAttachments(test)
    })) || [];

    return {
      buildVersion: appiumData.buildVersion || '1.0.0',
      environment: appiumData.environment || 'mobile',
      testFramework: 'appium',
      startTime: appiumData.startTime || new Date().toISOString(),
      endTime: appiumData.endTime || new Date().toISOString(),
      duration: appiumData.duration || 0,
      status: appiumData.status || 'completed',
      total_tests: testCases.length,
      passed_tests: testCases.filter(tc => tc.status === 'passed').length,
      failed_tests: testCases.filter(tc => tc.status === 'failed').length,
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

    if (test.video) {
      attachments.push({
        type: 'video',
        name: 'test-recording.mp4',
        path: test.video
      });
    }

    return attachments;
  }
}

module.exports = new AppiumReporter();