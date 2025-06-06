#include <WiFi.h>
#include <WebServer.h>
#include <EEPROM.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <DNSServer.h>
#include <SPIFFS.h>

// OLED Display Libraries
#include <Wire.h>
#include "SH1106Wire.h"

// QR Code Library - Using QRcodeOled library (ESP32 optimized for OLED)
#include "qrcodeoled.h"

// Pin definitions for ESP32
#define LIGHT_SENSOR_PIN 23   // Light sensor pin (D23)
#define OLED_SDA_PIN 21       // OLED SDA pin (D21)
#define OLED_SCK_PIN 22       // OLED SCL pin (D22)
#define LED_PIN 2             // Built-in LED pin
#define BUTTON_PIN 0          // Boot button for reset

// OLED Display Configuration
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
SH1106Wire display(0x3c, OLED_SDA_PIN, OLED_SCK_PIN);

// Global variable to track OLED status
bool oled_available = false;

// Web server and DNS server
WebServer server(80);
DNSServer dnsServer;

// Configuration constants
const char* ap_ssid = "Greenur-Device-Setup";
const int ap_timeout = 300000; // 5 minutes AP timeout
const int data_send_interval = 60000; // Send data every minute
const int max_wifi_attempts = 30;

// Variables for configuration
String wifi_ssid = "";
String wifi_password = "";
String device_id = "";
String api_key = "";
String server_url = "https://legendary-naiad-02cf89.netlify.app/.netlify/functions/log-pulse-data";

// Runtime variables
bool config_mode = false;
bool device_registered = false;
bool show_qr_code = false;
unsigned long last_data_send = 0;
unsigned long last_sensor_read = 0;
unsigned long last_display_update = 0;
unsigned long last_internet_check = 0;
bool wifi_connected = false;
bool internet_connected = false;
int connection_attempts = 0;
int wifi_signal_strength = 0;
bool last_api_call_success = false;

// Sensor data structure
struct SensorData {
  int light_level;
  unsigned long timestamp;
};

SensorData latest_data;

// EEPROM addresses
#define EEPROM_SIZE 512
#define SSID_ADDR 0
#define PASS_ADDR 64
#define DEVICE_ID_ADDR 128
#define API_KEY_ADDR 192
#define CONFIG_FLAG_ADDR 300
#define REGISTERED_FLAG_ADDR 301

void setup() {
  Serial.begin(115200);
  delay(1000); // Give serial time to initialize
  Serial.println();
  Serial.println("===================");
  Serial.println("Greenur Pulse Device Starting...");
  Serial.println("===================");
  
  // Initialize pins first
  pinMode(LED_PIN, OUTPUT);
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LIGHT_SENSOR_PIN, INPUT);
  digitalWrite(LED_PIN, LOW);
  
  // Initialize I2C for OLED with specific frequency
  Wire.begin(OLED_SDA_PIN, OLED_SCK_PIN);
  Wire.setClock(100000); // Set I2C clock to 100kHz (slower, more reliable)
  delay(100);
  
  // Initialize OLED display with better error handling
  initializeOLED();
  
  // Initialize EEPROM
  EEPROM.begin(EEPROM_SIZE);
  
  // Check if this is first boot - clear EEPROM if corrupted
  checkAndClearEEPROM();
  
  // Generate device ID if not exists
  generateDeviceId();
  
  // Check if device is already registered
  device_registered = (EEPROM.read(REGISTERED_FLAG_ADDR) == 0xBB);
  
  // Load configuration from EEPROM
  loadConfiguration();
  
  // Check if configuration exists and device is registered
  if (wifi_ssid.length() == 0 || wifi_ssid.indexOf('\xFF') >= 0 || !device_registered) {
    // Device needs setup - start both QR display AND WiFi hotspot
    Serial.println("Device needs setup - starting QR display and WiFi hotspot...");
    
    if (!device_registered) {
      Serial.println("Device not registered - user must scan QR code first");
    } else {
      Serial.println("Device registered but no WiFi config - user can go directly to WiFi setup");
    }
    
    // Start both QR code display and configuration mode simultaneously
    show_qr_code = true;
    displayQRCodeAndSetupInfo();
    startConfigMode();
  } else {
    Serial.println("Device configured and registered. Attempting WiFi connection...");
    displayConnectingMessage();
    connectToWiFi();
  }
  
  // Setup web server routes
  setupWebServer();
  
  Serial.println("Setup complete!");
}

void loop() {
  // Handle web server requests
  server.handleClient();
  
  // Handle DNS requests in config mode
  if (config_mode) {
    dnsServer.processNextRequest();
    
    // Blink LED in config mode
    static unsigned long last_blink = 0;
    if (millis() - last_blink > 500) {
      digitalWrite(LED_PIN, !digitalRead(LED_PIN));
      last_blink = millis();
    }
    
    // Update display periodically in setup mode
    static unsigned long last_setup_display_update = 0;
    if (millis() - last_setup_display_update > 5000) { // Update every 5 seconds
      displayQRCodeAndSetupInfo();
      last_setup_display_update = millis();
    }
  }
  
  // Check button for factory reset
  if (digitalRead(BUTTON_PIN) == LOW) {
    delay(50); // Debounce
    if (digitalRead(BUTTON_PIN) == LOW) {
      Serial.println("Button pressed - Factory reset in 5 seconds...");
      displayResetMessage();
      delay(5000);
      if (digitalRead(BUTTON_PIN) == LOW) {
        factoryReset();
      }
    }
  }
  
  // Regular operations when connected to WiFi and fully configured
  if (!config_mode && !show_qr_code && wifi_connected && device_registered) {
    // Read sensors periodically
    if (millis() - last_sensor_read > 2000) { // Read every 2 seconds
      readSensors();
      last_sensor_read = millis();
    }
    
    // Update display periodically
    if (millis() - last_display_update > 3000) { // Update display every 3 seconds
      displaySensorData();
      last_display_update = millis();
    }
    
    // Check internet connectivity periodically
    if (millis() - last_internet_check > 30000) { // Check every 30 seconds
      checkInternetConnectivity();
      last_internet_check = millis();
    }
    
    // Send data periodically
    if (millis() - last_data_send > data_send_interval) {
      sendSensorData();
      last_data_send = millis();
    }
    
    // LED solid on when connected and working
    digitalWrite(LED_PIN, HIGH);
  }
  
  // Check WiFi connection periodically (only if not in config mode)
  if (!config_mode && !show_qr_code && WiFi.status() != WL_CONNECTED) {
    wifi_connected = false;
    internet_connected = false;
    Serial.println("WiFi disconnected. Attempting reconnection...");
    displayReconnectingMessage();
    connectToWiFi();
  }
  
  delay(100);
}

void initializeOLED() {
  Serial.println("Initializing SH1106 OLED display...");
  
  // Initialize SH1106 display
  Serial.println("Attempting SH1106 init...");
  display.init();
  display.flipScreenVertically();
  Serial.println("SH1106 initialization called");
  oled_available = true;
  
  if (oled_available) {
    Serial.println("OLED available, clearing display...");
    // Clear the display buffer and test basic functionality
    display.clear();
    delay(100);
    
    Serial.println("Setting up test text...");
    // Test write to display
    display.setTextAlignment(TEXT_ALIGN_LEFT);
    display.setFont(ArialMT_Plain_10);
    display.drawString(0, 0, "OLED Test");
    
    Serial.println("Attempting display update...");
    // Try to update display
    if (safeDisplayUpdate()) {
      Serial.println("OLED initialization successful!");
      delay(1000);
      Serial.println("Calling displayBootMessage...");
      displayBootMessage();
      Serial.println("displayBootMessage completed");
    } else {
      Serial.println("OLED display update failed - continuing without display");
      oled_available = false;
    }
  }
  Serial.println("initializeOLED completed");
}

bool safeDisplayUpdate() {
  if (!oled_available) return false;
  
  // Simple retry logic
  for (int retry = 0; retry < 3; retry++) {
    display.display();
    delay(10); // Small delay to let I2C settle
    
    // Simple success check - if we get here, assume it worked
    if (retry == 0) {
      return true; // First attempt successful
    }
    
    Serial.println("Display update retry " + String(retry + 1));
    delay(100);
  }
  
  Serial.println("Display update failed after 3 retries");
  return false;
}

void displayBootMessage() {
  if (!oled_available) {
    Serial.println("displayBootMessage: OLED not available");
    return;
  }
  
  Serial.println("displayBootMessage: Starting...");
  display.clear();
  display.setTextAlignment(TEXT_ALIGN_LEFT);
  display.setFont(ArialMT_Plain_10);
  display.drawString(0, 0, "Greenur Pulse Device");
  display.drawString(0, 12, "Light Sensor Monitor");
  display.drawString(0, 24, "Starting up...");
  
  Serial.println("displayBootMessage: Calling safeDisplayUpdate...");
  safeDisplayUpdate();
  Serial.println("displayBootMessage: Delay starting...");
  delay(2000);
  Serial.println("displayBootMessage: Completed");
}

void displayConfigModeMessage(String ap_name) {
  if (!oled_available) return;
  
  display.clear();
  display.setTextAlignment(TEXT_ALIGN_LEFT);
  display.setFont(ArialMT_Plain_10);
  display.drawString(0, 0, "WiFi Setup Mode");
  display.drawString(0, 12, "");
  display.drawString(0, 24, "Connect to:");
  display.drawString(0, 36, ap_name.substring(0, 20));
  display.drawString(0, 48, "Go to: 192.168.4.1");
  safeDisplayUpdate();
}

void displayConnectingMessage() {
  if (!oled_available) return;
  
  display.clear();
  display.setTextAlignment(TEXT_ALIGN_LEFT);
  display.setFont(ArialMT_Plain_10);
  display.drawString(0, 0, "Connecting to WiFi");
  display.drawString(0, 12, wifi_ssid.substring(0, 20));
  display.drawString(0, 24, "");
  display.drawString(0, 36, "Please wait...");
  safeDisplayUpdate();
}

void displayConnectedMessage() {
  if (!oled_available) return;
  
  display.clear();
  display.setTextAlignment(TEXT_ALIGN_LEFT);
  display.setFont(ArialMT_Plain_10);
  display.drawString(0, 0, "WiFi Connected!");
  display.drawString(0, 12, wifi_ssid.substring(0, 20));
  display.drawString(0, 24, "");
  display.drawString(0, 36, "IP:");
  display.drawString(0, 48, WiFi.localIP().toString());
  safeDisplayUpdate();
  delay(3000);
}

void displayReconnectingMessage() {
  if (!oled_available) return;
  
  display.clear();
  display.setTextAlignment(TEXT_ALIGN_LEFT);
  display.setFont(ArialMT_Plain_10);
  display.drawString(0, 0, "WiFi Disconnected");
  display.drawString(0, 12, "Reconnecting...");
  safeDisplayUpdate();
}

void displayResetMessage() {
  if (!oled_available) return;
  
  display.clear();
  display.setTextAlignment(TEXT_ALIGN_LEFT);
  display.setFont(ArialMT_Plain_10);
  display.drawString(0, 0, "Factory Reset");
  display.drawString(0, 12, "Hold button to");
  display.drawString(0, 24, "confirm reset...");
  safeDisplayUpdate();
}

void displaySensorData() {
  if (!oled_available) return;
  
  display.clear();
  display.normalDisplay(); // Ensure normal display mode (not inverted)
  display.setTextAlignment(TEXT_ALIGN_LEFT);
  display.setFont(ArialMT_Plain_10);
  
  // Top row: WiFi signal and Internet status
  display.drawString(0, 0, "WiFi:" + String(wifi_signal_strength) + "dBm");
  
  String internetStatus = internet_connected ? "Internet:OK" : "Internet:X";
  display.drawString(70, 0, internetStatus);
  
  // Device title
  display.setTextAlignment(TEXT_ALIGN_CENTER);
  display.setFont(ArialMT_Plain_16);
  display.drawString(64, 16, "Greenur Pulse");
  
  // Current sensor value - centered and prominent
  display.setFont(ArialMT_Plain_24);
  display.drawString(64, 35, String(latest_data.light_level));
  
  // Light percentage and API status
  display.setFont(ArialMT_Plain_10);
  display.setTextAlignment(TEXT_ALIGN_LEFT);
  
  int light_percentage = map(latest_data.light_level, 0, 4095, 0, 100);
  display.drawString(0, 54, "Light: " + String(light_percentage) + "%");
  
  // API call status
  String apiStatus = last_api_call_success ? "API:OK" : "API:ERR";
  display.drawString(70, 54, apiStatus);
  
  safeDisplayUpdate();
}

void generateDeviceId() {
  device_id = readStringFromEEPROM(DEVICE_ID_ADDR);
  if (device_id.length() == 0) {
    // Generate unique device ID based on MAC address
    uint8_t mac[6];
    WiFi.macAddress(mac);
    device_id = "ESP32-";
    for (int i = 0; i < 6; i++) {
      device_id += String(mac[i], HEX);
    }
    device_id.toUpperCase();
    writeStringToEEPROM(DEVICE_ID_ADDR, device_id);
    EEPROM.commit();
    Serial.println("Generated Device ID: " + device_id);
  }
}

void checkAndClearEEPROM() {
  // Check if EEPROM contains valid data or is corrupted
  byte testByte = EEPROM.read(CONFIG_FLAG_ADDR);
  if (testByte != 0xAA) { // Magic byte to indicate valid EEPROM
    Serial.println("EEPROM appears corrupted or uninitialized. Clearing...");
    
    // Clear entire EEPROM
    for (int i = 0; i < EEPROM_SIZE; i++) {
      EEPROM.write(i, 0);
    }
    
    // Set magic byte to indicate EEPROM is initialized
    EEPROM.write(CONFIG_FLAG_ADDR, 0xAA);
    EEPROM.commit();
    
    Serial.println("EEPROM cleared and initialized.");
  } else {
    Serial.println("EEPROM appears valid.");
  }
}

void loadConfiguration() {
  Serial.println("Loading configuration from EEPROM...");
  
  wifi_ssid = readStringFromEEPROM(SSID_ADDR);
  wifi_password = readStringFromEEPROM(PASS_ADDR);
  device_id = readStringFromEEPROM(DEVICE_ID_ADDR);
  api_key = readStringFromEEPROM(API_KEY_ADDR);
  
  // Set API key - this matches your PULSE_DEVICE_API_KEY environment variable
  if (api_key.length() == 0) {
    api_key = "greenur_pulse_8717"; // Your specified API key
  }
  
  // Clean up any corrupted strings
  wifi_ssid.trim();
  wifi_password.trim();
  device_id.trim();
  api_key.trim();
  
  Serial.println("Loaded configuration:");
  Serial.print("SSID: '");
  Serial.print(wifi_ssid);
  Serial.println("'");
  Serial.print("Device ID: '");
  Serial.print(device_id);
  Serial.println("'");
  Serial.print("API Key: '");
  Serial.print(api_key);
  Serial.println("'");
}

void startConfigMode() {
  config_mode = true;
  WiFi.mode(WIFI_AP);
  
  // Create unique AP name with device ID
  String ap_name = String(ap_ssid) + "-" + device_id.substring(6); // Last 6 chars of device ID
  
  WiFi.softAP(ap_name.c_str());
  
  // Start DNS server for captive portal
  dnsServer.start(53, "*", WiFi.softAPIP());
  
  IPAddress IP = WiFi.softAPIP();
  Serial.println("AP started: " + ap_name);
  Serial.println("IP address: " + IP.toString());
  Serial.println("Open http://192.168.4.1 to configure");
  
  // Display config mode message on OLED
  displayConfigModeMessage(ap_name);
}

void connectToWiFi() {
  if (wifi_ssid.length() == 0) return;
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifi_ssid.c_str(), wifi_password.c_str());
  
  Serial.println("Connecting to WiFi: " + wifi_ssid);
  
  connection_attempts = 0;
  while (WiFi.status() != WL_CONNECTED && connection_attempts < max_wifi_attempts) {
    delay(1000);
    Serial.print(".");
    connection_attempts++;
    
    // Blink LED while connecting
    digitalWrite(LED_PIN, !digitalRead(LED_PIN));
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifi_connected = true;
    wifi_signal_strength = WiFi.RSSI(); // Get signal strength
    Serial.println("\nWiFi connected!");
    Serial.println("IP address: " + WiFi.localIP().toString());
    Serial.println("Signal strength: " + String(wifi_signal_strength) + " dBm");
    
    // Display connected message on OLED
    displayConnectedMessage();
    
    // Check internet connectivity
    checkInternetConnectivity();
    
    // Send initial "device online" signal
    sendDeviceOnlineSignal();
  } else {
    Serial.println("\nWiFi connection failed. Starting configuration mode...");
    startConfigMode();
  }
}

void checkInternetConnectivity() {
  Serial.println("Checking internet connectivity...");
  
  HTTPClient http;
  http.begin("http://httpbin.org/get"); // Simple HTTP endpoint
  http.setTimeout(5000); // 5 second timeout
  
  int httpCode = http.GET();
  
  if (httpCode > 0) {
    if (httpCode == HTTP_CODE_OK) {
      internet_connected = true;
      Serial.println("✅ Internet connectivity confirmed");
    } else {
      internet_connected = false;
      Serial.println("❌ Internet check failed - HTTP " + String(httpCode));
    }
  } else {
    internet_connected = false;
    Serial.println("❌ Internet connectivity failed - " + http.errorToString(httpCode));
  }
  
  http.end();
  
  // Update WiFi signal strength while we're at it
  if (WiFi.status() == WL_CONNECTED) {
    wifi_signal_strength = WiFi.RSSI();
  }
}

void setupWebServer() {
  // Root page - configuration interface
  server.on("/", HTTP_GET, handleRoot);
  
  // WiFi scan endpoint
  server.on("/scan", HTTP_GET, handleWiFiScan);
  
  // Save configuration endpoint
  server.on("/save", HTTP_POST, handleSaveConfig);
  
  // Status endpoint
  server.on("/status", HTTP_GET, handleStatus);
  
  // Sensor data endpoint
  server.on("/sensors", HTTP_GET, handleSensorData);
  
  // Reset endpoint
  server.on("/reset", HTTP_POST, handleReset);
  
  // Device registration confirmation endpoint
  server.on("/register", HTTP_POST, handleDeviceRegistration);
  
  // Handle all other requests (captive portal)
  server.onNotFound(handleRoot);
  
  server.begin();
  Serial.println("Web server started");
}

void handleRoot() {
  String html = R"(
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Greenur Pulse Configuration</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #17A34A, #2E7D32);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
        }
        .container {
            max-width: 500px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            overflow: hidden;
        }
        .header {
            background: #17A34A;
            color: white;
            padding: 24px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 600;
        }
        .header p {
            margin: 8px 0 0 0;
            opacity: 0.9;
            font-size: 14px;
        }
        .content {
            padding: 24px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        .form-group label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #333;
        }
        .form-group select,
        .form-group input {
            width: 100%;
            padding: 12px;
            border: 2px solid #E5E7EB;
            border-radius: 8px;
            font-size: 16px;
            transition: border-color 0.2s;
            box-sizing: border-box;
        }
        .form-group select:focus,
        .form-group input:focus {
            outline: none;
            border-color: #17A34A;
        }
        .btn {
            background: #17A34A;
            color: white;
            border: none;
            padding: 14px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            width: 100%;
            transition: background-color 0.2s;
        }
        .btn:hover {
            background: #14532d;
        }
        .btn:disabled {
            background: #9CA3AF;
            cursor: not-allowed;
        }
        .status {
            padding: 12px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-weight: 500;
        }
        .status.success {
            background: #D1FAE5;
            color: #065F46;
            border: 1px solid #A7F3D0;
        }
        .status.error {
            background: #FEE2E2;
            color: #991B1B;
            border: 1px solid #FECACA;
        }
        .device-info {
            background: #F9FAFB;
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
        }
        .device-info h3 {
            margin: 0 0 8px 0;
            color: #374151;
        }
        .device-info p {
            margin: 4px 0;
            color: #6B7280;
            font-size: 14px;
        }
        .loading {
            display: none;
            text-align: center;
            padding: 20px;
        }
        .spinner {
            border: 3px solid #f3f3f3;
            border-top: 3px solid #17A34A;
            border-radius: 50%;
            width: 30px;
            height: 30px;
            animation: spin 1s linear infinite;
            margin: 0 auto 10px;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌱 Greenur Pulse</h1>
            <p>Light Sensor Monitor Setup</p>
        </div>
        <div class="content">
            <div class="device-info">
                <h3>Device Information</h3>
                <p><strong>Device ID:</strong> )" + device_id + R"(</p>
                <p><strong>Sensor:</strong> Light Level Monitor</p>
                <p><strong>Status:</strong> <span id="deviceStatus">Configuration Mode</span></p>
            </div>
            
            <div id="statusMessage"></div>
            
            <form id="configForm">
                <div class="form-group">
                    <label for="ssid">WiFi Network:</label>
                    <select id="ssid" name="ssid" required>
                        <option value="">Select WiFi Network...</option>
                    </select>
                    <button type="button" id="scanBtn" style="margin-top: 8px; padding: 8px 16px; font-size: 14px;">
                        🔄 Scan Networks
                    </button>
                </div>
                
                <div class="form-group">
                    <label for="password">WiFi Password:</label>
                    <input type="password" id="password" name="password" placeholder="Enter WiFi password">
                </div>
                
                <div class="loading" id="loading">
                    <div class="spinner"></div>
                    <p>Connecting to WiFi...</p>
                </div>
                
                <button type="submit" class="btn" id="saveBtn">Connect & Save</button>
            </form>
            
            <div style="margin-top: 24px; padding-top: 24px; border-top: 1px solid #E5E7EB;">
                <button type="button" class="btn" id="resetBtn" style="background: #DC2626;">
                    🔄 Factory Reset
                </button>
            </div>
        </div>
    </div>

    <script>
        // Scan for WiFi networks on page load
        window.onload = function() {
            scanNetworks();
        };

        function scanNetworks() {
            document.getElementById('scanBtn').disabled = true;
            document.getElementById('scanBtn').textContent = '🔄 Scanning...';
            
            fetch('/scan')
                .then(response => response.json())
                .then(data => {
                    const select = document.getElementById('ssid');
                    select.innerHTML = '<option value="">Select WiFi Network...</option>';
                    
                    data.networks.forEach(network => {
                        const option = document.createElement('option');
                        option.value = network.ssid;
                        option.textContent = `${network.ssid} (${network.rssi} dBm)`;
                        select.appendChild(option);
                    });
                })
                .catch(error => {
                    console.error('Scan failed:', error);
                    showStatus('Failed to scan networks. Please try again.', 'error');
                })
                .finally(() => {
                    document.getElementById('scanBtn').disabled = false;
                    document.getElementById('scanBtn').textContent = '🔄 Scan Networks';
                });
        }

        document.getElementById('scanBtn').onclick = scanNetworks;

        document.getElementById('configForm').onsubmit = function(e) {
            e.preventDefault();
            
            const ssid = document.getElementById('ssid').value;
            const password = document.getElementById('password').value;
            
            if (!ssid) {
                showStatus('Please select a WiFi network.', 'error');
                return;
            }
            
            // Show loading state
            document.getElementById('loading').style.display = 'block';
            document.getElementById('saveBtn').disabled = true;
            
            const formData = new FormData();
            formData.append('ssid', ssid);
            formData.append('password', password);
            
            fetch('/save', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showStatus('Configuration saved! Device is connecting to WiFi...', 'success');
                    document.getElementById('deviceStatus').textContent = 'Connecting to WiFi...';
                    
                    // Check connection status
                    setTimeout(checkConnectionStatus, 5000);
                } else {
                    showStatus('Failed to save configuration: ' + data.message, 'error');
                    document.getElementById('loading').style.display = 'none';
                    document.getElementById('saveBtn').disabled = false;
                }
            })
            .catch(error => {
                console.error('Save failed:', error);
                showStatus('Failed to save configuration. Please try again.', 'error');
                document.getElementById('loading').style.display = 'none';
                document.getElementById('saveBtn').disabled = false;
            });
        };

        function checkConnectionStatus() {
            fetch('/status')
                .then(response => response.json())
                .then(data => {
                    if (data.wifi_connected) {
                        showStatus('✅ Successfully connected to WiFi! Device is now online.', 'success');
                        document.getElementById('deviceStatus').textContent = 'Connected & Online';
                        document.getElementById('loading').style.display = 'none';
                    } else {
                        showStatus('❌ Failed to connect to WiFi. Please check password and try again.', 'error');
                        document.getElementById('deviceStatus').textContent = 'Connection Failed';
                        document.getElementById('loading').style.display = 'none';
                        document.getElementById('saveBtn').disabled = false;
                    }
                })
                .catch(error => {
                    // Still checking...
                    setTimeout(checkConnectionStatus, 3000);
                });
        }

        document.getElementById('resetBtn').onclick = function() {
            if (confirm('Are you sure you want to reset all settings? This will erase WiFi configuration.')) {
                fetch('/reset', { method: 'POST' })
                    .then(() => {
                        showStatus('Device reset successfully. Restarting...', 'success');
                        setTimeout(() => location.reload(), 3000);
                    })
                    .catch(error => {
                        showStatus('Reset failed. Please try again.', 'error');
                    });
            }
        };

        function showStatus(message, type) {
            const statusDiv = document.getElementById('statusMessage');
            statusDiv.innerHTML = `<div class="status ${type}">${message}</div>`;
        }
    </script>
</body>
</html>
  )";
  
  server.send(200, "text/html", html);
}

void handleWiFiScan() {
  Serial.println("Scanning for WiFi networks...");
  
  int n = WiFi.scanNetworks();
  
  DynamicJsonDocument doc(1024);
  JsonArray networks = doc.createNestedArray("networks");
  
  for (int i = 0; i < n; i++) {
    JsonObject network = networks.createNestedObject();
    network["ssid"] = WiFi.SSID(i);
    network["rssi"] = WiFi.RSSI(i);
    network["encryption"] = (WiFi.encryptionType(i) == WIFI_AUTH_OPEN) ? "open" : "encrypted";
  }
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
}

void handleSaveConfig() {
  String ssid = server.arg("ssid");
  String password = server.arg("password");
  
  Serial.println("Saving configuration:");
  Serial.println("SSID: " + ssid);
  
  // Save to EEPROM
  writeStringToEEPROM(SSID_ADDR, ssid);
  writeStringToEEPROM(PASS_ADDR, password);
  EEPROM.commit();
  
  // Update global variables
  wifi_ssid = ssid;
  wifi_password = password;
  
  DynamicJsonDocument doc(256);
  doc["success"] = true;
  doc["message"] = "Configuration saved successfully";
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
  
  // Start WiFi connection in background
  delay(1000);
  connectToWiFi();
}

void handleStatus() {
  DynamicJsonDocument doc(512);
  doc["device_id"] = device_id;
  doc["wifi_connected"] = wifi_connected;
  doc["wifi_ssid"] = wifi_ssid;
  doc["ip_address"] = WiFi.localIP().toString();
  doc["rssi"] = WiFi.RSSI();
  doc["config_mode"] = config_mode;
  doc["uptime"] = millis();
  doc["light_level"] = latest_data.light_level;
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
}

void handleSensorData() {
  readSensors();
  
  DynamicJsonDocument doc(512);
  doc["device_id"] = device_id;
  doc["timestamp"] = latest_data.timestamp;
  doc["light_level"] = latest_data.light_level;
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
}

void handleReset() {
  factoryReset();
  
  DynamicJsonDocument doc(256);
  doc["success"] = true;
  doc["message"] = "Device reset successfully";
  
  String response;
  serializeJson(doc, response);
  
  server.send(200, "application/json", response);
  
  delay(2000);
  ESP.restart();
}

void readSensors() {
  // Read light sensor (0-4095 range)
  latest_data.light_level = analogRead(LIGHT_SENSOR_PIN);
  latest_data.timestamp = millis();
  
  Serial.println("Sensor readings:");
  Serial.println("Light Level: " + String(latest_data.light_level));
}

void sendSensorData() {
  if (!wifi_connected) return;
  
  HTTPClient http;
  http.begin(server_url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", api_key);
  
  // Create JSON payload
  DynamicJsonDocument doc(512);
  doc["deviceId"] = device_id;
  doc["timestamp"] = getCurrentTimestamp();
  doc["lightLevel"] = latest_data.light_level;  // Only light sensor data
  
  String payload;
  serializeJson(doc, payload);
  
  Serial.println("📡 Sending sensor data to API...");
  Serial.println("Payload: " + payload);
  
  int httpResponseCode = http.POST(payload);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.println("📡 HTTP Response code: " + String(httpResponseCode));
    
    if (httpResponseCode == 201) {
      last_api_call_success = true;
      Serial.println("✅ Sensor data sent successfully!");
      
      // Quick LED blink to indicate successful transmission
      for (int i = 0; i < 2; i++) {
        digitalWrite(LED_PIN, LOW);
        delay(100);
        digitalWrite(LED_PIN, HIGH);
        delay(100);
      }
    } else {
      last_api_call_success = false;
      Serial.println("⚠️ API call completed but with unexpected response code");
    }
  } else {
    last_api_call_success = false;
    Serial.println("❌ API call failed: " + String(httpResponseCode) + " - " + http.errorToString(httpResponseCode));
  }
  
  http.end();
}

void sendDeviceOnlineSignal() {
  // Send initial device online signal
  HTTPClient http;
  http.begin(server_url);
  http.addHeader("Content-Type", "application/json");
  http.addHeader("x-api-key", api_key);
  
  DynamicJsonDocument doc(256);
  doc["deviceId"] = device_id;
  doc["timestamp"] = getCurrentTimestamp();
  doc["status"] = "online";
  doc["ip_address"] = WiFi.localIP().toString();
  doc["lightLevel"] = latest_data.light_level;
  
  String payload;
  serializeJson(doc, payload);
  
  int httpResponseCode = http.POST(payload);
  
  if (httpResponseCode > 0) {
    Serial.println("Device online signal sent successfully!");
  } else {
    Serial.println("Failed to send device online signal");
  }
  
  http.end();
}

String getCurrentTimestamp() {
  // Get current time - using millis() since WiFi.getTime() is not available on all ESP32 versions
  // For production, you might want to use NTP time synchronization
  return String(millis());
}

void factoryReset() {
  Serial.println("Performing factory reset...");
  
  // Clear EEPROM
  for (int i = 0; i < EEPROM_SIZE; i++) {
    EEPROM.write(i, 0);
  }
  EEPROM.commit();
  
  // Clear variables
  wifi_ssid = "";
  wifi_password = "";
  config_mode = false;
  wifi_connected = false;
  device_registered = false;
  show_qr_code = false;
  
  Serial.println("Factory reset complete. Restarting...");
}

// Helper functions for EEPROM string operations
void writeStringToEEPROM(int addr, String data) {
  int len = data.length();
  if (len > 63) len = 63; // Limit string length to prevent corruption
  
  EEPROM.write(addr, len);
  for (int i = 0; i < len; i++) {
    EEPROM.write(addr + 1 + i, data[i]);
  }
  // Add null terminator
  EEPROM.write(addr + 1 + len, 0);
}

String readStringFromEEPROM(int addr) {
  int len = EEPROM.read(addr);
  if (len > 63 || len < 0) return ""; // Corrupted length
  
  String data = "";
  for (int i = 0; i < len; i++) {
    byte c = EEPROM.read(addr + 1 + i);
    if (c == 0 || c == 0xFF) break; // Stop at null or uninitialized
    data += char(c);
  }
  return data;
}

String getWiFiSignalIcon() {
  if (wifi_signal_strength > -50) return "📶"; // Excellent
  else if (wifi_signal_strength > -60) return "📶"; // Good  
  else if (wifi_signal_strength > -70) return "📶"; // Fair
  else return "📶"; // Poor - still show icon but we'll indicate strength differently
}

String getInternetStatusIcon() {
  return internet_connected ? "🌐" : "🌐"; // Use same icon, we'll show status with text
}

void displayQRCodeAndSetupInfo() {
  if (!oled_available) {
    Serial.println("displayPairingCodeAndSetupInfo: OLED not available");
    return;
  }
  
  // Always ensure normal display mode first
  display.normalDisplay();
  display.clear();
  
  if (!device_registered) {
    // Show pairing code instead of QR code
    String pairingCode = device_id.substring(6); // Get last 6 characters after "ESP32-"
    
    Serial.println("Device ID: " + device_id);
    Serial.println("Pairing Code: " + pairingCode);
    
    // Display pairing code prominently
    display.setTextAlignment(TEXT_ALIGN_CENTER);
    display.setFont(ArialMT_Plain_10);
    display.drawString(64, 5, "Pairing Code:");
    
    // Large pairing code display
    display.setFont(ArialMT_Plain_24);
    display.drawString(64, 20, pairingCode);
    
    // Instructions
    display.setFont(ArialMT_Plain_10);
    display.drawString(64, 45, "Enter this code in");
    display.drawString(64, 55, "Greenur app to pair");
    
    Serial.println("Pairing Code displayed: " + pairingCode);
  } else {
    // Device is registered, show WiFi setup info
    display.setTextAlignment(TEXT_ALIGN_CENTER);
    display.setFont(ArialMT_Plain_10);
    display.drawString(64, 10, "Device Registered!");
    display.drawString(64, 25, "Connect to WiFi:");
    display.drawString(64, 35, (String(ap_ssid) + "-" + device_id.substring(6)).substring(0, 20));
    display.drawString(64, 50, "Go to 192.168.4.1");
  }
  
  safeDisplayUpdate();
}

void handleDeviceRegistration() {
  String body = server.arg("plain");
  DynamicJsonDocument doc(256);
  deserializeJson(doc, body);
  
  String userId = doc["userId"];
  
  if (userId.length() > 0) {
    // Mark device as registered
    EEPROM.write(REGISTERED_FLAG_ADDR, 0xBB);
    EEPROM.commit();
    device_registered = true;
    show_qr_code = false; // Stop showing QR code
    
    Serial.println("Device registered to user: " + userId);
    Serial.println("WiFi hotspot already running - user can proceed to WiFi setup");
    
    // Update display to show WiFi setup info instead of QR code
    displayQRCodeAndSetupInfo();
    
    DynamicJsonDocument response(256);
    response["success"] = true;
    response["deviceId"] = device_id;
    response["wifiSetupUrl"] = "http://192.168.4.1";
    response["message"] = "Device registered successfully. Connect to device WiFi to continue setup.";
    
    String responseStr;
    serializeJson(response, responseStr);
    
    server.send(200, "application/json", responseStr);
    
    // No restart needed - WiFi hotspot is already running
  } else {
    server.send(400, "application/json", "{\"error\":\"Missing userId\"}");
  }
} 