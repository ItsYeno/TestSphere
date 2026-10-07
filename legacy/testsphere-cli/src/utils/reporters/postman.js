const fs = require('fs-extra');
const path = require('path');

class PostmanReporter {
  async parse(resultsPath) {
    try {
      let reportData;
      
      if ((await fs.stat(resultsPath)).isDirectory()) {
        // Look for Newman (Postman) results
        const resultsFile = path.join(resultsPath, 'newman', 'report.json');
        if (await fs.pathExists(resultsFile)) {
          reportData = await fs.readJson(resultsFile);
        } else {
          // Try to find any JSON file in directory
          const files = await fs.readdir(resultsPath);
          const jsonFile = files.find(f => f.endsWith('.json') && (f.includes('newman') || f.includes('postman')));
          if (jsonFile) {
            reportData = await fs.readJson(path.join(resultsPath, jsonFile));
          }
        }
      } else {
        reportData = await fs.readJson(resultsPath);
      }

      if (!reportData) {
        throw new Error('No Postman/Newman report data found');
      }

      return this.convertToStandardFormat(reportData);
      
    } catch (error) {
      throw new Error(`Postman report parsing failed: ${error.message}`);
    }
  }

  convertToStandardFormat(newmanData) {
    const testCases = [];
    let totalDuration = 0;
    let passedCount = 0;
    let failedCount = 0;

    // Parse Newman results
    newmanData.run.executions?.forEach(execution => {
      const request = execution.request;
      const response = execution.response;
      const testResults = execution.assertions || [];
      
      const testCase = {
        title: `${request.method} ${request.url.raw || request.url}`,
        fullName: `API: ${request.method} ${request.url.raw || request.url}`,
        status: 'passed', // Default to passed
        duration: execution.response?.responseTime || 0,
        request: {
          method: request.method,
          url: request.url.raw || request.url,
          headers: request.header,
          body: request.body
        },
        response: response ? {
          status: response.code,
          headers: response.header,
          body: response.body
        } : null,
        assertions: []
      };

      // Check assertions
      testResults.forEach(assertion => {
        testCase.assertions.push({
          name: assertion.assertion,
          passed: assertion.skipped ? 'skipped' : (assertion.error ? 'failed' : 'passed'),
          error: assertion.error
        });

        if (assertion.error && !assertion.skipped) {
          testCase.status = 'failed';
          testCase.failureMessage = assertion.error.message;
        }
      });

      testCases.push(testCase);
      totalDuration += testCase.duration;
      
      if (testCase.status === 'passed') passedCount++;
      else failedCount++;
    });

    return {
      buildVersion: newmanData.run.timings?.startedAt || '1.0.0',
      environment: newmanData.environment?.name || 'api',
      testFramework: 'postman',
      startTime: new Date(newmanData.run.timings?.started).toISOString(),
      endTime: new Date(newmanData.run.timings?.completed).toISOString(),
      duration: totalDuration,
      status: failedCount > 0 ? 'failed' : 'passed',
      total_tests: testCases.length,
      passed_tests: passedCount,
      failed_tests: failedCount,
      testCases
    };
  }
}

module.exports = new PostmanReporter();