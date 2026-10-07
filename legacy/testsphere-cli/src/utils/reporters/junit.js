const fs = require('fs-extra');
const xml2js = require('xml2js');

class JunitReporter {
  async parse(resultsPath) {
    try {
      const xmlContent = await fs.readFile(resultsPath, 'utf8');
      const parser = new xml2js.Parser();
      const result = await parser.parseStringPromise(xmlContent);
      
      return this.convertToStandardFormat(result);
      
    } catch (error) {
      throw new Error(`JUnit report parsing failed: ${error.message}`);
    }
  }

  convertToStandardFormat(junitData) {
    const testCases = [];
    let totalDuration = 0;
    let passedCount = 0;
    let failedCount = 0;

    const extractTests = (testsuite) => {
      if (testsuite.testcase) {
        testsuite.testcase.forEach(testcase => {
          const hasFailure = testcase.failure || testcase.error;
          const status = hasFailure ? 'failed' : 'passed';
          
          testCases.push({
            title: testcase.$.name,
            fullName: testcase.$.classname ? `${testcase.$.classname}.${testcase.$.name}` : testcase.$.name,
            status: status,
            duration: parseFloat(testcase.$.time || 0) * 1000, // Convert to milliseconds
            failureMessage: hasFailure ? this.extractFailureMessage(hasFailure) : null,
            stackTrace: hasFailure ? this.extractStackTrace(hasFailure) : null
          });

          totalDuration += parseFloat(testcase.$.time || 0) * 1000;
          if (status === 'passed') passedCount++;
          if (status === 'failed') failedCount++;
        });
      }
    };

    if (junitData.testsuites && junitData.testsuites.testsuite) {
      junitData.testsuites.testsuite.forEach(extractTests);
    } else if (junitData.testsuite) {
      extractTests(junitData.testsuite);
    }

    return {
      buildVersion: '1.0.0',
      environment: 'unknown',
      testFramework: 'junit',
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
      duration: totalDuration,
      status: failedCount > 0 ? 'failed' : 'passed',
      total_tests: testCases.length,
      passed_tests: passedCount,
      failed_tests: failedCount,
      testCases
    };
  }

  extractFailureMessage(failure) {
    if (Array.isArray(failure)) {
      return failure[0]._ || failure[0].$.message;
    }
    return failure._ || failure.$.message;
  }

  extractStackTrace(failure) {
    if (Array.isArray(failure)) {
      return failure[0]._;
    }
    return failure._;
  }
}

module.exports = new JunitReporter();