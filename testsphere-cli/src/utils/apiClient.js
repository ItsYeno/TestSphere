const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs-extra');
const { configManager } = require('./configManager');

class ApiClient {
  constructor() {
    this.baseURL = configManager.get('apiUrl') || 'http://localhost:5000/api';
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 30000
    });

    // Add auth token to requests
    const token = configManager.get('token');
    if (token) {
      this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }

  async uploadTestResults(testData) {
    try {
      const response = await this.client.post('/test-runs', testData);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Upload failed');
    }
  }

  async uploadWithFiles(testData, filePaths = []) {
    try {
      const formData = new FormData();
      
      // Add test data as JSON
      formData.append('data', JSON.stringify(testData));
      
      // Add files
      for (const filePath of filePaths) {
        if (await fs.pathExists(filePath)) {
          formData.append('files', fs.createReadStream(filePath));
        }
      }

      const response = await this.client.post('/test-runs/upload', formData, {
        headers: {
          ...formData.getHeaders(),
        }
      });

      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'File upload failed');
    }
  }

  async login(credentials) {
    try {
      const response = await this.client.post('/auth/login', credentials);
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  }
}

module.exports = {
  apiClient: new ApiClient()
};