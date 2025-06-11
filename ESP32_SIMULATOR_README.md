# ESP32 Data Simulator

This script simulates an ESP32 device sending sensor data to the Greenur platform for testing purposes.

## Features

- **Realistic Data Generation**: Simulates light levels, temperature, humidity, and soil moisture with natural variations
- **Day/Night Cycle**: Light levels vary based on time of day
- **Continuous Operation**: Runs indefinitely until stopped with Ctrl+C
- **Graceful Shutdown**: Provides summary statistics when stopped
- **Error Handling**: Handles network errors and API failures gracefully

## Configuration

The script uses the following hardcoded configuration:
- **Device ID**: `ESP32-FC3FFF000`
- **Source IP**: `103.211.18.8`
- **API URL**: `http://localhost:8888/.netlify/functions/log-pulse-data`
- **Interval**: 60 seconds (matches real ESP32 behavior)

## Prerequisites

1. Make sure your Netlify dev server is running:
   ```bash
   npm run dev
   ```

2. Set the API key environment variable:
   ```bash
   export PULSE_DEVICE_API_KEY=your-actual-api-key-here
   ```

## Usage

### Method 1: Direct execution
```bash
./simulate-esp32-data.js
```

### Method 2: Using Node
```bash
node simulate-esp32-data.js
```

### Method 3: With environment variable inline
```bash
PULSE_DEVICE_API_KEY=your-api-key node simulate-esp32-data.js
```

## Sample Output

```
🚀 ESP32 Data Simulator Starting...
=====================================
📱 Device ID: ESP32-FC3FFF000
🌐 API URL: http://localhost:8888/.netlify/functions/log-pulse-data
📍 Source IP: 103.211.18.8
⏱️  Interval: 60 seconds
🔑 API Key: your-api...
=====================================
💡 Press Ctrl+C to stop the simulator

📡 [2024-01-15T10:30:00.000Z] Sending data point #1:
   Light: 2150, Temp: 24.5°C, Humidity: 55%, Soil: 42%
   ✅ Success! Response: Data logged successfully

📡 [2024-01-15T10:31:00.000Z] Sending data point #2:
   Light: 2200, Temp: 24.8°C, Humidity: 53%, Soil: 43%
   ✅ Success! Response: Data logged successfully
```

## Stopping the Simulator

Press `Ctrl+C` to stop the simulator. It will show a summary:

```
🛑 Received SIGINT (Ctrl+C). Shutting down gracefully...
📊 Summary:
   • Data points sent: 15
   • Runtime: 14m 30s
   • Device ID: ESP32-FC3FFF000
   • Source IP: 103.211.18.8

👋 Goodbye!
```

## Sensor Data Simulation

- **Light Level**: 0-4095 range, varies with day/night cycle
- **Temperature**: 17-27°C range, varies throughout the day
- **Humidity**: 20-90% range, inversely related to temperature
- **Soil Moisture**: 30-60% range, slowly changing values

## Notes

- The script sends real timestamps (not millis() like the actual ESP32)
- Server will override the timestamp anyway due to the recent fix
- Data is sent to the local development server by default
- All sensor values include realistic noise and variations 