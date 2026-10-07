const fs = require('fs-extra');
const path = require('path');

class CypressReporter {
  async parse(resultsPath) {
    try {
      let reportData;
      
      if ((await fs.stat(resultsPath)).isDirectory()) {
        // Look for Cypress results
        const resultsFile = path.join(resultsPath, 'results.json');
        if (await fs.pathExists(resultsFile)) {
          reportData = await fs.readJson(resultsFile);
        }
      } else {
        reportData = await fs.readJson(resultsPath);
      }

      if (!reportData) {
        throw new Error('No Cypress report data found');
      }

      return this.convertToStandardFormat(reportData);
      
    } catch (error) {
      throw new Error(`Cypress report parsing failed: ${error.message}`);
    }
  }

  convertToStandardFormat(cypressData) {
    const testCases = [];
    let totalDuration = 0;
    let passedCount = 0;
    let failedCount = 0;

    cypressData.runs?.forEach(run => {
      run.tests?.forEach(test => {
        const testCase = {
          title: test.title.join(' > '),
          fullName: test.title.join(' '),
          status: test.state,
          duration: test.duration || 0,
          failureMessage: test.displayError,
          attachments: this.extractAttachments(test)
        };

        testCases.push(testCase);
        totalDuration += test.duration || 0;
        
        if (test.state === 'passed') passedCount++;
        if (test.state === 'failed') failedCount++;
      });
    });

    return {
      buildVersion: cypressData.browserVersion || '1.0.0',
      environment: cypressData.config?.env || 'development',
      testFramework: 'cypress',
      startTime: new Date(cypressData.started).toISOString(),
      endTime: new Date(cypressData.ended).toISOString(),
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
    
    // Cypress automatically captures screenshots on failure
    if (test.state === 'failed' && test.screenshot) {
      attachments.push({
        type: 'screenshot',
        name: path.basename(test.screenshot),
        path: test.screenshot
      });
    }

    return attachments;
  }
}

module.exports = new CypressReporter();