import { auth } from '../firebase';

interface DeviceRegistrationResult {
  success: boolean;
  deviceId?: string;
  deviceName?: string;
  registeredAt?: string;
  wifiSetupUrl?: string;
  error?: string;
}

interface DeviceData {
  type: string;
  deviceId: string;
  setupWifi: string;
}

const API_BASE_URL = '/.netlify/functions';

/**
 * Register a pulse device using a pairing code
 * The pairing code is the last 6 characters of the device ID
 */
export async function registerPulseDeviceByPairingCode(
  pairingCode: string, 
  deviceName?: string
): Promise<DeviceRegistrationResult> {
  try {
    // Get the current user's ID token for authentication
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    // Validate pairing code format (should be 9 characters, alphanumeric)
    if (!pairingCode || pairingCode.length !== 9) {
      return { success: false, error: 'Pairing code must be exactly 9 characters' };
    }

    // Convert pairing code to uppercase for consistency
    const normalizedPairingCode = pairingCode.toUpperCase();
    
    // Construct device ID from pairing code
    const deviceId = `ESP32-${normalizedPairingCode}`;

    const idToken = await currentUser.getIdToken();
    
    const response = await fetch(`${API_BASE_URL}/register-pulse-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        deviceId,
        deviceName,
        pairingCode: normalizedPairingCode
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { 
        success: false, 
        error: errorData.error || `Registration failed with status ${response.status}` 
      };
    }

    const data = await response.json();
    return {
      success: true,
      deviceId: data.deviceId,
      deviceName: data.deviceName,
      registeredAt: data.registeredAt,
      wifiSetupUrl: data.wifiSetupUrl
    };

  } catch (error) {
    console.error('Error registering device with pairing code:', error);
    return { 
      success: false, 
      error: 'Failed to register device. Please try again.' 
    };
  }
}

/**
 * Register a pulse device to the current user
 */
export async function registerPulseDevice(
  deviceId: string, 
  deviceName?: string
): Promise<DeviceRegistrationResult> {
  try {
    // Get the current user's ID token for authentication
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    const idToken = await currentUser.getIdToken();
    
    const response = await fetch(`${API_BASE_URL}/register-pulse-device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify({
        deviceId,
        deviceName
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { 
        success: false, 
        error: errorData.error || `Registration failed with status ${response.status}` 
      };
    }

    const data = await response.json();
    return {
      success: true,
      deviceId: data.deviceId,
      deviceName: data.deviceName,
      registeredAt: data.registeredAt,
      wifiSetupUrl: data.wifiSetupUrl
    };

  } catch (error) {
    console.error('Error registering device:', error);
    return { 
      success: false, 
      error: 'Failed to register device. Please try again.' 
    };
  }
}

/**
 * Connect to device WiFi with enhanced functionality
 */
export async function connectToDeviceWifi(setupWifiName: string): Promise<{ success: boolean; method?: string; error?: string }> {
  try {
    // Check if Web WiFi API is available (experimental)
    if ('navigator' in window && 'wifi' in (navigator as any)) {
      const wifi = (navigator as any).wifi;
      await wifi.connect({
        ssid: setupWifiName,
        // No password needed for device hotspot
      });
      return { success: true, method: 'web-api' };
    }

    // Try to open WiFi settings on mobile devices
    const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile) {
      // Try to open WiFi settings on mobile
      if (navigator.userAgent.includes('Android')) {
        window.open('intent://wifi#Intent;scheme=android.settings;package=com.android.settings;end');
        return { success: true, method: 'android-settings' };
      } else if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
        window.open('App-Prefs:root=WIFI');
        return { success: true, method: 'ios-settings' };
      }
    }

    // Fallback for desktop or unsupported mobile browsers
    return { success: false, error: 'Automatic WiFi connection not supported on this device' };

  } catch (error) {
    console.error('WiFi connection error:', error);
    return { success: false, error: 'Failed to connect to WiFi' };
  }
}

/**
 * Get user's registered pulse devices
 */
export async function getUserPulseDevices(): Promise<{ success: boolean; devices?: any[]; error?: string }> {
  try {
    // Get the current user's ID token for authentication
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: 'User not authenticated' };
    }

    const idToken = await currentUser.getIdToken();
    
    const response = await fetch(`${API_BASE_URL}/get-user-devices`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { 
        success: false, 
        error: errorData.error || `Failed to fetch devices with status ${response.status}` 
      };
    }

    const data = await response.json();
    return {
      success: data.success,
      devices: data.devices || []
    };

  } catch (error) {
    console.error('Error fetching user devices:', error);
    return { 
      success: false, 
      error: 'Failed to fetch devices. Please try again.' 
    };
  }
}

/**
 * Open device configuration page (now immediately available after registration)
 */
export function openDeviceConfigPage(): void {
  window.open('http://192.168.4.1', '_blank', 'noopener,noreferrer');
}

/**
 * Parse QR code data from device
 */
export function parseDeviceQRCode(qrText: string): DeviceData | null {
  try {
    // First try URL format (new format)
    if (qrText.startsWith('https://') || qrText.startsWith('http://')) {
      const url = new URL(qrText);
      const deviceId = url.searchParams.get('deviceId');
      const setupWifi = url.searchParams.get('setupWifi');
      
      if (deviceId && setupWifi) {
        return {
          type: 'greenur_device',
          deviceId,
          setupWifi
        };
      }
    }
    
    // Fallback to JSON format (old format) for backward compatibility
    const data = JSON.parse(qrText);
    
    if (data.type === 'greenur_device' && data.deviceId && data.setupWifi) {
      return data as DeviceData;
    }
    
    return null;
  } catch {
    return null;
  }
} 