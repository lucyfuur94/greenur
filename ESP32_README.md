# Greenur Pulse - ESP32 Plant Monitoring Device

This is the complete ESP32 code for the Greenur Pulse plant monitoring device that integrates with your Greenur web application.

## 🌱 Features

- **QR Code Setup**: Displays QR code on OLED for easy device registration via mobile app
- **WiFi Configuration**: Easy setup via captive portal web interface
- **OLED Display**: Real-time status and sensor data display
- **Sensor Monitoring**: Temperature, humidity, soil moisture, and light level readings
- **Cloud Integration**: Automatic data upload to your Netlify backend
- **LED Status Indicators**: Visual feedback for device status
- **Factory Reset**: Long-press button for complete reset
- **Auto-reconnection**: Handles WiFi disconnections gracefully
- **Responsive Web UI**: Mobile-friendly configuration interface

## 🔌 Hardware Requirements

### ESP32 Development Board
- ESP32-WROOM-32 or similar
- USB-C or Micro-USB cable for programming

### Sensors & Components
- **DHT22** (Temperature & Humidity sensor)
- **Soil Moisture Sensor** (Analog capacitive type recommended)
- **Light Sensor** (Analog light sensor/LDR)
- **0.96 inch OLED Display** (128x64, I2C interface)

### Optional Components
- **LED** (Built-in LED on pin 2 is used by default)
- **Breadboard and jumper wires**
- **10kΩ pullup resistor** for DHT22 (optional, most modules have built-in)

## 📦 Required Libraries

Install these libraries in your Arduino IDE:

### Core Libraries
- **WiFi** (Built-in ESP32 library)
- **WebServer** (Built-in ESP32 library)
- **EEPROM** (Built-in ESP32 library)
- **HTTPClient** (Built-in ESP32 library)
- **ArduinoJson** by Benoit Blanchon
- **DNSServer** (Built-in ESP32 library)

### Display Libraries
- **ESP8266 and ESP32 OLED driver for SSD1306 displays** by ThingPulse
  - Library Manager search: "ESP8266 and ESP32 OLED"
  - Or install: `SH1106Wire` library

### QR Code Library
- **QRcodeDisplay** by yoprogramo (Manual installation required)
  - **GitHub**: https://github.com/yoprogramo/QRcodeDisplay
  - **OLED Subclass**: https://github.com/yoprogramo/QRcodeOled
  - **Benefits**: ESP32 optimized, modern API, active maintenance, multiple display support
  - **Compatibility**: Specifically designed for ESP32 and OLED displays
  - This enables advanced QR code generation on the OLED display

### QR Code Library Installation
**Step 1: Install QRcodeDisplay (Base Library)**
1. Go to https://github.com/yoprogramo/QRcodeDisplay
2. Click "Code" → "Download ZIP"
3. In Arduino IDE: Sketch → Include Library → Add .ZIP Library
4. Select the QRcodeDisplay ZIP file

**Step 2: Install QRcodeOled (OLED Support)**
1. Go to https://github.com/yoprogramo/QRcodeOled
2. Click "Code" → "Download ZIP"  
3. In Arduino IDE: Sketch → Include Library → Add .ZIP Library
4. Select the QRcodeOled ZIP file

**Step 3: Verify Installation**
- Both libraries should appear in Sketch → Include Library list
- Restart Arduino IDE if needed
- Libraries work together: QRcodeDisplay + QRcodeOled

### QR Code Features
- **Multiple QR Versions**: Supports QR versions 1-10 (configurable)
- **Error Correction**: Built-in ECC levels 1-3
- **Display Optimization**: Designed specifically for small OLED displays
- **Memory Efficient**: Optimized for ESP32 memory constraints
- **Easy Integration**: Simple API for OLED displays

### Installation Steps
1. Open Arduino IDE
2. Go to **Tools > Manage Libraries**
3. Search and install each library listed above
4. Restart Arduino IDE after installation

## 📐 Wiring Diagram

```
ESP32 Pin  │  Component        │  Notes
═══════════│═══════════════════│══════════════════════════
GPIO 4     │  DHT22 Data       │  Temperature & Humidity
A0         │  Soil Moisture    │  Analog reading (0-4095)
GPIO 23    │  Light Sensor     │  Analog light level (D23)
GPIO 21    │  OLED SDA         │  I2C Data (D21)
GPIO 22    │  OLED SCL         │  I2C Clock (D22)
GPIO 2     │  Built-in LED     │  Status indicator
GPIO 0     │  BOOT Button      │  Factory reset (built-in)
3.3V       │  Sensors VCC      │  Power for sensors
GND        │  Sensors GND      │  Common ground
```

## 📚 Required Libraries

Install these libraries in Arduino IDE:

1. **WiFi** (Built-in with ESP32)
2. **WebServer** (Built-in with ESP32)
3. **EEPROM** (Built-in with ESP32)
4. **HTTPClient** (Built-in with ESP32)
5. **ArduinoJson** by Benoit Blanchon
6. **DNSServer** (Built-in with ESP32)
7. **Wire** (Built-in with ESP32 - for I2C)
8. **DHT sensor library** by Adafruit
9. **Adafruit GFX Library** by Adafruit
10. **Adafruit SSD1306** by Adafruit

### Installation Steps:

1. Open Arduino IDE
2. Go to **Tools > Manage Libraries**
3. Search and install:
   - "ArduinoJson" by Benoit Blanchon
   - "DHT sensor library" by Adafruit
   - "Adafruit Unified Sensor" (dependency)
   - "Adafruit GFX Library" by Adafruit
   - "Adafruit SSD1306" by Adafruit

## ⚙️ Configuration

### 1. Arduino IDE Setup

1. Install ESP32 board support:
   - File > Preferences
   - Add to Additional Board Manager URLs: 
     ```
     https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
     ```
   - Tools > Board > Boards Manager
   - Search "ESP32" and install

2. Select your board:
   - Tools > Board > ESP32 Arduino > ESP32 Dev Module

3. Configure settings:
   - Upload Speed: 921600
   - CPU Frequency: 240MHz
   - Flash Frequency: 80MHz
   - Flash Mode: QIO
   - Flash Size: 4MB
   - Partition Scheme: Default 4MB

### 2. Code Configuration

Before uploading, verify these settings in the code:

```cpp
// API Configuration
String api_key = "greenur-pulse-device-2024"; // Must match your PULSE_DEVICE_API_KEY
String server_url = "https://greenur-webapp.netlify.app/.netlify/functions/log-pulse-data";

// Pin Definitions (adjust if needed)
#define SOIL_MOISTURE_PIN A0
#define DHT_PIN 4
#define LIGHT_SENSOR_PIN 23
#define OLED_SDA_PIN 21
#define OLED_SCK_PIN 22
#define LED_PIN 2
#define BUTTON_PIN 0
```

### 3. Environment Variables

Ensure your Netlify environment has:

```env
PULSE_DEVICE_API_KEY=greenur-pulse-device-2024
```

## 🚀 QR Code Setup Process

### 1. Device Power-On & Setup Mode

1. Flash the updated code to your ESP32
2. Power on the device
3. **Device simultaneously:**
   - **Displays QR code** on OLED (if not registered)
   - **Starts WiFi hotspot** for configuration
   - **Shows setup instructions** on display

### 2. User Setup Flow

1. **Scan QR code** with Greenur mobile app (WiFi hotspot is already broadcasting)
2. **Device gets registered** automatically (no restart needed)
3. **Device display updates** to show "Device Registered!" 
4. **Connect to device WiFi** - hotspot remains active (same one broadcasting during QR scan)
5. **Open 192.168.4.1** to configure home WiFi
6. **Scan networks, select home WiFi, enter password** and save
7. **Device connects** to home WiFi and starts operation

### 3. Device State Logic

- **Unregistered device**: Shows QR code + starts WiFi hotspot simultaneously
- **During registration**: QR code disappears, display updates, WiFi hotspot continues running
- **Registered device without WiFi**: Shows "Device Registered!" + WiFi setup info + continues WiFi hotspot
- **Registered device with WiFi**: Connects to home WiFi and starts normal operation

### 4. Key Benefits

- **No device restarts** during setup process
- **WiFi hotspot available during AND after** QR scan (runs continuously)
- **Seamless user experience** - scan QR code and immediately connect to already-running hotspot
- **Faster setup** - no waiting for device to restart or hotspot to start
- **Simultaneous operation** - QR display and WiFi hotspot run at the same time

## 📺 OLED Display Information

The OLED display shows different information based on device status:

### Setup Mode - Unregistered Device:
```
    [QR CODE DISPLAY]
    
    1. Scan QR Code
    2. Connect to WiFi
```

### Setup Mode - Registered Device:
```
   Device Registered!
   
   Connect to WiFi:
   Greenur-Device-Setup-XXXXXX
   
   Go to 192.168.4.1
```

### Connecting to Home WiFi:
```
Connecting to WiFi
[Your Network Name]

Please wait...
```

### Normal Operation:
```
Greenur Pulse
----------------
Light: 2048
WiFi: Connected
API: OK
```

## 🔧 LED Status Indicators

| LED Pattern | Status |
|-------------|--------|
| Solid ON | QR code display mode (waiting for registration) |
| Blinking slowly (500ms) | WiFi configuration mode (after registration) |
| Blinking rapidly | Connecting to WiFi |
| Solid ON | Connected and working |
| 3 quick blinks | Data sent successfully |
| OFF | Error or no power |

## 🔄 Factory Reset

To perform a factory reset:

1. Hold the BOOT button (GPIO 0) for 5+ seconds
2. OLED shows "Factory Reset - Hold button to confirm reset..."
3. Device will clear all stored settings including registration
4. Automatically restarts and shows QR code for re-registration

## 📊 Data Format

The device sends this data to your backend:

```json
{
  "deviceId": "ESP32-XXXXXXXXXXXX",
  "timestamp": "1640995200000",
  "temperature": 22.5,
  "humidity": 65.0,
  "soilMoisture": 75,
  "lightLevel": 2048
}
```

## 🐛 Troubleshooting

### QR Code Issues

1. **QR code not displaying:**
   - Check OLED wiring (SDA to GPIO 21, SCL to GPIO 22)
   - Verify QRCode library is installed
   - Check serial monitor for QR generation errors

2. **QR code scan fails:**
   - Ensure good lighting on OLED display
   - Try adjusting distance from camera
   - Use manual QR input option in app
   - Check QR code library version compatibility

### OLED Display Issues

1. **OLED not working/blank:**
   - Check I2C wiring (SDA to GPIO 21, SCL to GPIO 22)
   - Verify OLED address is 0x3C
   - Check power connections (3.3V and GND)

2. **OLED shows garbled text:**
   - Check I2C connections for loose wires
   - Verify OLED library is properly installed

### WiFi Connection Issues

1. **Device not showing WiFi network:**
   - Hold BOOT button for factory reset
   - Check OLED display for status messages

2. **Can't connect to configuration page:**
   - Ensure you're connected to device WiFi
   - Try `http://192.168.4.1` manually
   - Disable mobile data on phone

3. **WiFi password not working:**
   - Double-check password (case-sensitive)
   - Try factory reset and reconfigure

### Sensor Issues

1. **Temperature/Humidity reading -999:**
   - Check DHT22 wiring
   - Verify DHT22 is connected to GPIO 4
   - Replace DHT22 sensor if faulty

2. **Soil moisture always 0 or 100:**
   - Check soil sensor wiring
   - Verify sensor is connected to A0
   - Calibrate sensor in dry vs wet soil

3. **Light sensor not responding:**
   - Check light sensor wiring to GPIO 23
   - Test with covering/uncovering sensor
   - Verify sensor power connections

### Backend Connection Issues

1. **Data not appearing in app:**
   - Verify API key matches environment variable
   - Check server URL is correct
   - Monitor serial output for HTTP response codes

## 📈 Performance & Optimization

- **Data transmission**: Every 60 seconds (configurable)
- **Sensor readings**: Every 5 seconds
- **Display updates**: Every 2 seconds
- **Power consumption**: ~100mA active (with OLED), ~20mA idle
- **Memory usage**: ~45% of ESP32 flash
- **WiFi range**: Typical 50-100 meters indoor

## 🔐 Security Notes

- Device uses API key authentication
- WiFi credentials stored in EEPROM (encrypted recommended for production)
- Configuration portal only active when not connected to WiFi
- Consider implementing OTA updates for production deployment

## 📝 Customization

### Adding New Sensors

1. Define new pins in the pin definitions section
2. Add sensor reading code in `readSensors()` function
3. Update JSON payload in `sendSensorData()` function
4. Update backend schema to handle new data fields
5. Add display code in `displaySensorData()` function

### Changing Data Intervals

```cpp
const int data_send_interval = 60000; // Change to desired interval in milliseconds
const int last_display_update = 2000; // Change display update interval
```

### Custom Device Names

The device automatically generates a unique ID based on MAC address. To customize:

```cpp
// In generateDeviceId() function
device_id = "MyCustomDevice-" + String(mac[4], HEX) + String(mac[5], HEX);
```

### OLED Display Customization

You can modify the `displaySensorData()` function to show different information or layout:

```cpp
void displaySensorData() {
  display.clearDisplay();
  // Add your custom display code here
  display.display();
}
```

## 🆘 Support

If you encounter issues:

1. Check the Serial Monitor (115200 baud) for debug information
2. Monitor OLED display for status messages
3. Verify all wiring connections
4. Ensure libraries are properly installed
5. Check that environment variables are set correctly in Netlify

## 📄 License

This code is part of the Greenur project. Modify and use according to your project's license terms.

---

**Happy Growing! 🌱** 