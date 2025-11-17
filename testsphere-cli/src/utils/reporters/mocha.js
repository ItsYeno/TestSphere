const fs = require('fs-extra');
const path = require('path');

class MochaReporter {
  async parse(resultsPath) {
    try {
      let reportData;
      
      if ((await fs.stat(resultsPath)).isDirectory()) {
        // Mocha JSON reporter output
        const jsonFile = path.join(resultsPath, 'mocha-results.json');
        if (await fs.pathExists(jsonFile)) {
          reportData = await fs.readJson(jsonFile);
        }
      } else {
        reportData = await fs.readJson(resultsPath);
      }

      if (!reportData) {
        throw new Error('No Mocha report data found');
      }

      return this.convertToStandardFormat(reportData);
      
    } catch (error) {
      throw new Error(`Mocha report parsing failed: ${error.message}`);
    }
  }

  convertToStandardFormat(mochaData) {
    const testCases = [];
    let totalDuration = 0;
    let passedCount = 0;
    let failedCount = 0;

    const extractTests = (suite, parentTitle = '') => {
      if (suite.tests) {
        suite.tests.forEach(test => {
          const fullTitle = parentTitle ? `${parentTitle} > ${test.title}` : test.title;
          
          testCases.push({
            title: fullTitle,
            fullName: fullTitle,
            status: test.state || (test.passed ? 'passed' : 'failed'),
            duration: test.duration || 0,
            failureMessage: test.err?.message,
            stackTrace: test.err?.stack
          });

          totalDuration += test.duration || 0;
          if (test.state === 'passed') passedCount++;
          if (test.state === 'failed') failedCount++;
        });
      }

      if (suite.suites) {
        suite.suites.forEach(childSuite => {
          const suiteTitle = parentTitle ? `${parentTitle} > ${childSuite.title}` : childSuite.title;
          extractTests(childSuite, suiteTitle);
        });
      }
    };

    extractTests(mochaData);

    return {
      buildVersion: '1.0.0',
      environment: 'node',
      testFramework: 'mocha',
      startTime: new Date(mochaData.stats?.start).toISOString(),
      endTime: new Date(mochaData.stats?.end).toISOString(),
      duration: totalDuration,
      status: failedCount > 0 ? 'failed' : 'passed',
      total_tests: testCases.length,
      passed_tests: passedCount,
      failed_tests: failedCount,
      testCases
    };
  }
}

module.exports = new MochaReporter();