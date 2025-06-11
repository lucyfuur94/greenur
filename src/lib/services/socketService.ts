import { io, Socket } from 'socket.io-client';
import { auth } from '../firebase';

interface DeviceData {
  soilMoisture: number;
  temperature: number;
  humidity: number;
  lightLevel: number;
  isWaterOn: boolean;
}

interface DeviceStatus {
  deviceId: string;
  isOnline: boolean;
  lastSeen: Date | null;
  status: 'online' | 'offline' | 'error';
  message: string;
  latestData?: DeviceData;
}

interface DeviceDataUpdate {
  deviceId: string;
  timestamp: Date;
  data: DeviceData;
}

interface SocketServiceCallbacks {
  onDeviceStatusUpdate?: (status: DeviceStatus) => void;
  onDeviceDataUpdate?: (update: DeviceDataUpdate) => void;
  onInitialDeviceStatuses?: (statuses: DeviceStatus[]) => void;
  onConnectionChange?: (connected: boolean) => void;
  onError?: (error: string) => void;
}

class SocketService {
  private socket: Socket | null = null;
  private callbacks: SocketServiceCallbacks = {};
  private isConnecting = false;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private subscribedDevices = new Set<string>();

  // Get backend URL from environment or default to localhost for development
  private getBackendUrl(): string {
    // Check if we have a custom backend URL configured
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    
    if (backendUrl) {
      return backendUrl;
    }
    
    // Default development URLs
    if (import.meta.env.DEV) {
      return 'http://localhost:3000';
    }
    
    // You'll need to replace this with your actual Render backend URL
    return 'https://your-backend-service.onrender.com';
  }

  /**
   * Initialize Socket.IO connection
   */
  async connect(callbacks: SocketServiceCallbacks = {}): Promise<boolean> {
    if (this.socket?.connected) {
      console.log('✅ Socket already connected');
      return true;
    }

    if (this.isConnecting) {
      console.log('⏳ Socket connection already in progress');
      return false;
    }

    try {
      this.isConnecting = true;
      this.callbacks = callbacks;

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('User not authenticated');
      }

      const backendUrl = this.getBackendUrl();
      console.log(`🔌 Connecting to Socket.IO server: ${backendUrl}`);

      // Initialize socket connection
      this.socket = io(backendUrl, {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: true,
        reconnectionAttempts: this.maxReconnectAttempts,
        reconnectionDelay: this.reconnectDelay,
      });

      // Set up event listeners
      this.setupEventListeners();

      // Wait for connection
      await this.waitForConnection();

      // Authenticate user
      await this.authenticate();

      console.log('✅ Socket.IO connected and authenticated');
      this.isConnecting = false;

      return true;

    } catch (error) {
      console.error('❌ Failed to connect to Socket.IO:', error);
      this.isConnecting = false;
      this.callbacks.onError?.(error instanceof Error ? error.message : 'Connection failed');
      return false;
    }
  }

  /**
   * Set up Socket.IO event listeners
   */
  private setupEventListeners(): void {
    if (!this.socket) return;

    // Connection events
    this.socket.on('connect', () => {
      console.log('🔌 Socket connected');
      this.callbacks.onConnectionChange?.(true);
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('🔌 Socket disconnected:', reason);
      this.callbacks.onConnectionChange?.(false);
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('🔌 Socket connection error:', error);
      this.callbacks.onError?.(`Connection error: ${error.message}`);
    });

    // Authentication events
    this.socket.on('authenticated', (data: { message: string }) => {
      console.log('✅ Socket authenticated:', data.message);
    });

    this.socket.on('auth_error', (error: { message: string }) => {
      console.error('❌ Socket authentication error:', error);
      this.callbacks.onError?.(`Authentication error: ${error.message}`);
    });

    // Device events
    this.socket.on('device_status_update', (status: DeviceStatus) => {
      console.log('📱 Device status update:', status);
      this.callbacks.onDeviceStatusUpdate?.(status);
    });

    this.socket.on('device_data_update', (update: DeviceDataUpdate) => {
      console.log('📊 Device data update:', update);
      this.callbacks.onDeviceDataUpdate?.(update);
    });

    this.socket.on('initial_device_statuses', (statuses: DeviceStatus[]) => {
      console.log('📱 Initial device statuses:', statuses);
      this.callbacks.onInitialDeviceStatuses?.(statuses);
    });

    // Subscription events
    this.socket.on('device_subscribed', (data: { deviceId: string; message: string }) => {
      console.log('✅ Subscribed to device:', data.deviceId);
    });

    this.socket.on('device_unsubscribed', (data: { deviceId: string; message: string }) => {
      console.log('❌ Unsubscribed from device:', data.deviceId);
    });

    this.socket.on('subscription_error', (error: { message: string }) => {
      console.error('❌ Subscription error:', error);
      this.callbacks.onError?.(`Subscription error: ${error.message}`);
    });

    // Reconnection handling
    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
      this.resubscribeToDevices();
    });
  }

  /**
   * Wait for socket connection to be established
   */
  private waitForConnection(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not initialized'));
        return;
      }

      if (this.socket.connected) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Connection timeout'));
      }, 10000);

      this.socket.once('connect', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket.once('connect_error', (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Authenticate user with the backend
   */
  private authenticate(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      const currentUser = auth.currentUser;
      if (!currentUser) {
        reject(new Error('User not authenticated'));
        return;
      }

      const timeout = setTimeout(() => {
        reject(new Error('Authentication timeout'));
      }, 5000);

      this.socket.once('authenticated', () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket.once('auth_error', (error: { message: string }) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });

      // Send authentication data
      this.socket.emit('authenticate', {
        userId: currentUser.uid,
        userEmail: currentUser.email,
      });
    });
  }

  /**
   * Subscribe to device updates
   */
  subscribeToDevice(deviceId: string): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot subscribe to device');
      return;
    }

    this.socket.emit('subscribe_device', { deviceId });
    this.subscribedDevices.add(deviceId);
    console.log(`📱 Subscribing to device: ${deviceId}`);
  }

  /**
   * Unsubscribe from device updates
   */
  unsubscribeFromDevice(deviceId: string): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot unsubscribe from device');
      return;
    }

    this.socket.emit('unsubscribe_device', { deviceId });
    this.subscribedDevices.delete(deviceId);
    console.log(`📱 Unsubscribing from device: ${deviceId}`);
  }

  /**
   * Check device status manually
   */
  checkDeviceStatus(deviceId: string): void {
    if (!this.socket?.connected) {
      console.warn('Socket not connected, cannot check device status');
      return;
    }

    this.socket.emit('check_device_status', { deviceId });
    console.log(`📱 Checking device status: ${deviceId}`);
  }

  /**
   * Resubscribe to all devices after reconnection
   */
  private resubscribeToDevices(): void {
    console.log('🔄 Resubscribing to devices after reconnection');
    for (const deviceId of this.subscribedDevices) {
      this.subscribeToDevice(deviceId);
    }
  }

  /**
   * Disconnect from Socket.IO server
   */
  disconnect(): void {
    if (this.socket) {
      console.log('🔌 Disconnecting Socket.IO');
      this.socket.disconnect();
      this.socket = null;
    }
    this.subscribedDevices.clear();
    this.callbacks = {};
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Get subscribed devices
   */
  getSubscribedDevices(): string[] {
    return Array.from(this.subscribedDevices);
  }

  /**
   * Update callbacks
   */
  updateCallbacks(callbacks: SocketServiceCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }
}

// Export singleton instance
export const socketService = new SocketService();
export type { DeviceData, DeviceStatus, DeviceDataUpdate, SocketServiceCallbacks }; 