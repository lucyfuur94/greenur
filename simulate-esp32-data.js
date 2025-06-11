#!/usr/bin/env node

import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Configuration - matches your requirements
const CONFIG = {
  deviceId: 'ESP32-FC3FFF000',
  sourceIp: '103.211.18.8',
  apiUrl: 'http://localhost:8888/.netlify/functions/log-pulse-data',
  apiKey: process.env.PULSE_DEVICE_API_KEY || 'your-api-key-here',
  interval: 60000, // 60 seconds (1 minute) - same as ESP32
  // Water control thresholds
  waterOnThreshold: 30, // Turn water on when soil moisture falls below this
  waterOffThreshold: 60, // Turn water off when soil moisture reaches this
};

// Track script state
let isRunning = true;
let dataCount = 0;
let startTime = Date.now();
let currentThreshold = CONFIG.waterOnThreshold; // Current user-set threshold
let isWaterCurrentlyOn = false; // Track water state

// Simulate realistic sensor data
function generateSensorData() {
  const now = Date.now();
  const timeOfDay = (now % (24 * 60 * 60 * 1000)) / (24 * 60 * 60 * 1000); // 0-1 for 24 hours
  
  // Simulate soil moisture - slowly changing, affected by watering
  let baseSoilMoisture;
  
  if (isWaterCurrentlyOn) {
    // When water is on, soil moisture increases
    baseSoilMoisture = 50 + Math.sin(timeOfDay * 0.5 * Math.PI) * 20; // 30-70% range when watering
  } else {
    // When water is off, soil moisture decreases over time
    baseSoilMoisture = 35 + Math.sin(timeOfDay * 0.3 * Math.PI) * 15; // 20-50% range when not watering
  }
  
  const soilNoise = (Math.random() - 0.5) * 5; // Add some noise
  const soilMoisture = Math.max(0, Math.min(100, Math.round(baseSoilMoisture + soilNoise)));
  
  // Water control logic
  if (!isWaterCurrentlyOn && soilMoisture <= currentThreshold) {
    isWaterCurrentlyOn = true;
    console.log(`💧 Water turned ON - Soil moisture (${soilMoisture}%) dropped below threshold (${currentThreshold}%)`);
  } else if (isWaterCurrentlyOn && soilMoisture >= CONFIG.waterOffThreshold) {
    isWaterCurrentlyOn = false;
    console.log(`🛑 Water turned OFF - Soil moisture (${soilMoisture}%) reached upper limit (${CONFIG.waterOffThreshold}%)`);
  }
  
  // Occasionally change threshold to simulate user interaction (5% chance)
  if (Math.random() < 0.05) {
    const newThreshold = Math.round(25 + Math.random() * 20); // Random threshold between 25-45%
    if (newThreshold !== currentThreshold) {
      console.log(`⚙️  Threshold changed from ${currentThreshold}% to ${newThreshold}% (simulating user adjustment)`);
      currentThreshold = newThreshold;
    }
  }
  
  return {
    deviceId: CONFIG.deviceId,
    timestamp: now, // ESP32 would send millis(), but we'll send actual timestamp for testing
    soilMoisture: soilMoisture,
    isWaterOn: isWaterCurrentlyOn ? 1 : 0,
    threshold: currentThreshold
  };
}

// Send data to API
async function sendSensorData() {
  if (!isRunning) return;
  
  const sensorData = generateSensorData();
  
  try {
    console.log(`📡 [${new Date().toISOString()}] Sending data point #${dataCount + 1}:`);
    console.log(`   Soil Moisture: ${sensorData.soilMoisture}%, Water: ${sensorData.isWaterOn ? 'On' : 'Off'}, Threshold: ${sensorData.threshold}%`);
    
    const response = await fetch(CONFIG.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CONFIG.apiKey,
        'x-forwarded-for': CONFIG.sourceIp, // Correct header for Netlify source IP
      },
      body: JSON.stringify(sensorData)
    });
    
    if (response.ok) {
      const result = await response.json();
      dataCount++;
      console.log(`   ✅ Success! Response: ${result.message}`);
    } else {
      const error = await response.text();
      console.log(`   ❌ Failed! Status: ${response.status}, Error: ${error}`);
    }
    
  } catch (error) {
    console.log(`   💥 Network Error: ${error.message}`);
  }
  
  console.log(''); // Empty line for readability
}

// Graceful shutdown handler
function setupGracefulShutdown() {
  const shutdown = (signal) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    isRunning = false;
    
    const runTime = Math.floor((Date.now() - startTime) / 1000);
    const minutes = Math.floor(runTime / 60);
    const seconds = runTime % 60;
    
    console.log(`📊 Summary:`);
    console.log(`   • Data points sent: ${dataCount}`);
    console.log(`   • Runtime: ${minutes}m ${seconds}s`);
    console.log(`   • Device ID: ${CONFIG.deviceId}`);
    console.log(`   • Source IP: ${CONFIG.sourceIp}`);
    console.log(`\n👋 Goodbye!\n`);
    
    process.exit(0);
  };
  
  process.on('SIGINT', () => shutdown('SIGINT (Ctrl+C)'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

// Main function
async function main() {
  console.log('🚀 ESP32 Data Simulator Starting...');
  console.log('=====================================');
  console.log(`📱 Device ID: ${CONFIG.deviceId}`);
  console.log(`🌐 API URL: ${CONFIG.apiUrl}`);
  console.log(`📍 Source IP: ${CONFIG.sourceIp}`);
  console.log(`⏱️  Interval: ${CONFIG.interval / 1000} seconds`);
  console.log(`🔑 API Key: ${CONFIG.apiKey.substring(0, 8)}...`);
  console.log('=====================================');
  console.log('💡 Press Ctrl+C to stop the simulator\n');
  
  // Setup graceful shutdown
  setupGracefulShutdown();
  
  // Send initial data point immediately
  await sendSensorData();
  
  // Then send data at regular intervals
  const intervalId = setInterval(async () => {
    if (isRunning) {
      await sendSensorData();
    } else {
      clearInterval(intervalId);
    }
  }, CONFIG.interval);
}

// Check if API key is provided
if (!process.env.PULSE_DEVICE_API_KEY && CONFIG.apiKey === 'your-api-key-here') {
  console.error('❌ Error: PULSE_DEVICE_API_KEY environment variable is not set!');
  console.error('💡 Set it with: export PULSE_DEVICE_API_KEY=your-actual-api-key');
  console.error('💡 Or edit the script to hardcode the API key (not recommended for production)');
  process.exit(1);
}

// Start the simulator
main().catch(error => {
  console.error('💥 Fatal Error:', error);
  process.exit(1);
}); 