const fs = require('fs-extra');
const path = require('path');

class DetoxReporter {
  async parse(resultsPath) {
    try {
      let reportData;
      
      if ((await fs.stat(resultsPath)).isDirectory()) {
        // Detox typically uses JUnit format
        const junitFile = path.join(resultsPath, 'detox.junit.xml');
        if (await fs.pathExists(junitFile)) {
          const junitReporter = require('./junit');
          const result = await junitReporter.parse(junitFile);
          result.testFramework = 'detox';
          result.environment = 'mobile';
          return result;
        }
        
        // Or JSON format
        const jsonFile = path.join(resultsPath, 'detox-results.json');
        if (await fs.pathExists(jsonFile)) {
          reportData = await fs.readJson(jsonFile);
        }
      } else {
        reportData = await fs.readJson(resultsPath);
      }

      if (!reportData) {
        throw new Error('No Detox report data found');
      }

      return this.convertToStandardFormat(reportData);
      
    } catch (error) {
      throw new Error(`Detox report parsing failed: ${error.message}`);
    }
  }

  convertToStandardFormat(detoxData) {
    const testCases = [];
    let totalDuration = 0;
    let passedCount = 0;
    let failedCount = 0;

    if (detoxData.suites) {
      detoxData.suites.forEach(suite => {
        suite.tests.forEach(test => {
          const testCase = {
            title: test.title,
            fullName: `${suite.title} - ${test.title}`,
            status: test.status,
            duration: test.duration || 0,
            failureMessage: test.failure,
            stackTrace: test.stackTrace,
            attachments: this.extractAttachments(test)
          };

          testCases.push(testCase);
          totalDuration += test.duration || 0;
          if (test.status === 'passed') passedCount++;
          else failedCount++;
        });
      });
    }

    return {
      buildVersion: detoxData.buildVersion || '1.0.0',
      environment: 'mobile',
      testFramework: 'detox',
      startTime: detoxData.startTime || new Date().toISOString(),
      endTime: detoxData.endTime || new Date().toISOString(),
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
          name: `mobile-screenshot-${index + 1}.png`,
          path: screenshot
        });
      });
    }

    if (test.video) {
      attachments.push({
        type: 'video',
        name: 'mobile-test-recording.mp4',
        path: test.video
      });
    }

    return attachments;
  }
}

module.exports = new DetoxReporter();