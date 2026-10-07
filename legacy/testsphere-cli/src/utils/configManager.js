const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class ConfigManager {
  constructor() {
    this.configDir = path.join(os.homedir(), '.testsphere');
    this.configFile = path.join(this.configDir, 'config.json');
    this.projectConfigFile = path.join(process.cwd(), 'testsphere.json');
    this.ensureConfigDir();
  }

  ensureConfigDir() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  get(key) {
    try {
      if (fs.existsSync(this.configFile)) {
        const config = fs.readJsonSync(this.configFile);
        return key ? config[key] : config;
      }
    } catch (error) {
      // Config file doesn't exist or is invalid
    }
    return null;
  }

  set(key, value) {
    try {
      const config = this.get() || {};
      config[key] = value;
      fs.writeJsonSync(this.configFile, config, { spaces: 2 });
      return true;
    } catch (error) {
      return false;
    }
  }

  delete(key) {
    try {
      const config = this.get();
      if (config && config[key]) {
        delete config[key];
        fs.writeJsonSync(this.configFile, config, { spaces: 2 });
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  async getProjectConfig() {
    try {
      if (await fs.pathExists(this.projectConfigFile)) {
        return await fs.readJson(this.projectConfigFile);
      }
    } catch (error) {
      // Project config doesn't exist or is invalid
    }
    return null;
  }

  async setProjectConfig(config) {
    try {
      await fs.writeJson(this.projectConfigFile, config, { spaces: 2 });
      return true;
    } catch (error) {
      return false;
    }
  }

  clear() {
    try {
      if (fs.existsSync(this.configFile)) {
        fs.unlinkSync(this.configFile);
      }
      return true;
    } catch (error) {
      return false;
    }
  }
}

module.exports = {
  configManager: new ConfigManager()
};