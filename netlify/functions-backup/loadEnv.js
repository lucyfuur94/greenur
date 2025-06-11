const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    
    if (fs.existsSync(envPath)) {
      console.log('Loading environment variables from .env');
      const envConfig = dotenv.parse(fs.readFileSync(envPath));
      
      // Set environment variables if they don't exist
      for (const key in envConfig) {
        if (!process.env[key]) {
          process.env[key] = envConfig[key];
        }
      }
    }
  } catch (error) {
    console.error('Error loading environment variables:', error);
  }
}

module.exports = { loadEnv }; 