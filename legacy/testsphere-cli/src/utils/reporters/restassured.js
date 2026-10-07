const fs = require('fs-extra');
const path = require('path');

class RestAssuredReporter {
  async parse(resultsPath) {
    try {
      // RestAssured typically uses JUnit format
      if ((await fs.stat(resultsPath)).isDirectory()) {
        const junitFiles = await fs.readdir(resultsPath);
        const xmlFile = junitFiles.find(f => f.endsWith('.xml'));
        if (xmlFile) {
          const junitReporter = require('./junit');
          const result = await junitReporter.parse(path.join(resultsPath, xmlFile));
          result.testFramework = 'rest-assured';
          result.environment = 'api';
          return result;
        }
      } else if (resultsPath.endsWith('.xml')) {
        const junitReporter = require('./junit');
        const result = await junitReporter.parse(resultsPath);
        result.testFramework = 'rest-assured';
        result.environment = 'api';
        return result;
      }

      throw new Error('No RestAssured (JUnit) report data found');
      
    } catch (error) {
      throw new Error(`RestAssured report parsing failed: ${error.message}`);
    }
  }
}

module.exports = new RestAssuredReporter();