const fs = require('fs-extra');
const path = require('path');

class PlaywrightReporter {
  async parse(resultsPath) {
    try {
      let reportData;
      
      if ((await fs.stat(resultsPath)).isDirectory()) {
        // Look for playwright report files
        const reportFile = path.join(resultsPath, 'playwright-report', 'report.json');
        if (await fs.pathExists(reportFile)) {
          reportData = await fs.readJson(reportFile);
        } else {
          // Try to find any JSON file with playwright data
          const files = await fs.readdir(resultsPath);
          const jsonFile = files.find(f => f.endsWith('.json') && f.includes('playwright'));
          if (jsonFile) {
            reportData = await fs.readJson(path.join(resultsPath, jsonFile));
          }
        }
      } else {
        reportData = await fs.readJson(resultsPath);
      }

      if (!reportData) {
        throw new Error('No Playwright report data found');
      }

      return this.convertToStandardFormat(reportData);
      
    } catch (error) {
      throw new Error(`Playwright report parsing failed: ${error.message}`);
    }
  }

  convertToStandardFormat(playwrightData) {
    const testCases = [];
    let totalDuration = 0;
    let passedCount = 0;
    let failedCount = 0;

    // Extract tests from Playwright report structure
    const extractTests = (suite, parentTitle = '') => {
      if (suite.tests) {
        suite.tests.forEach(test => {
          const fullTitle = parentTitle ? `${parentTitle} > ${test.title}` : test.title;
          
          testCases.push({
            title: fullTitle,
            fullName: fullTitle,
            status: this.mapStatus(test.outcome),
            duration: test.duration || 0,
            failureMessage: test.error?.message,
            stackTrace: test.error?.stack,
            attachments: this.extractAttachments(test.attachments)
          });

          totalDuration += test.duration || 0;
          if (test.outcome === 'passed') passedCount++;
          if (test.outcome === 'failed') failedCount++;
        });
      }

      if (suite.suites) {
        suite.suites.forEach(childSuite => {
          const suiteTitle = parentTitle ? `${parentTitle} > ${childSuite.title}` : childSuite.title;
          extractTests(childSuite, suiteTitle);
        });
      }
    };

    if (playwrightData.suites) {
      playwrightData.suites.forEach(suite => extractTests(suite));
    }

    return {
      buildVersion: playwrightData.config?.version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      testFramework: 'playwright',
      startTime: new Date(playwrightData.startTime).toISOString(),
      endTime: new Date(playwrightData.startTime + totalDuration).toISOString(),
      duration: totalDuration,
      status: failedCount > 0 ? 'failed' : 'passed',
      total_tests: testCases.length,
      passed_tests: passedCount,
      failed_tests: failedCount,
      testCases
    };
  }

  mapStatus(playwrightOutcome) {
    const statusMap = {
      'passed': 'passed',
      'failed': 'failed',
      'skipped': 'skipped',
      'timedOut': 'failed'
    };
    return statusMap[playwrightOutcome] || 'unknown';
  }

  extractAttachments(attachments) {
    if (!attachments) return [];
    
    return attachments.map(att => ({
      type: att.contentType.startsWith('image/') ? 'screenshot' : 
            att.contentType.startsWith('video/') ? 'video' : 'other',
      name: att.name,
      path: att.path,
      contentType: att.contentType
    }));
  }
}

module.exports = new PlaywrightReporter();