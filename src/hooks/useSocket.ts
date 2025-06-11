import { useEffect, useState, useCallback } from 'react';
import { socketService, type DeviceStatus, type DeviceDataUpdate, type SocketServiceCallbacks } from '../lib/services/socketService';
import { auth } from '../lib/firebase';
import { useAuthState } from 'react-firebase-hooks/auth';

interface UseSocketOptions {
  autoConnect?: boolean;
  deviceIds?: string[];
}

interface UseSocketReturn {
  isConnected: boolean;
  error: string | null;
  deviceStatuses: Record<string, DeviceStatus>;
  subscribeToDevice: (deviceId: string) => void;
  unsubscribeFromDevice: (deviceId: string) => void;
  checkDeviceStatus: (deviceId: string) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
}

export function useSocket(options: UseSocketOptions = {}): UseSocketReturn {
  const { autoConnect = true, deviceIds = [] } = options;
  const [user] = useAuthState(auth);
  
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceStatuses, setDeviceStatuses] = useState<Record<string, DeviceStatus>>({});

  // Socket event callbacks
  const callbacks: SocketServiceCallbacks = {
    onConnectionChange: (connected: boolean) => {
      setIsConnected(connected);
      if (connected) {
        setError(null);
      }
    },
    
    onError: (errorMessage: string) => {
      setError(errorMessage);
      console.error('Socket error:', errorMessage);
    },
    
    onDeviceStatusUpdate: (status: DeviceStatus) => {
      setDeviceStatuses(prev => ({
        ...prev,
        [status.deviceId]: status
      }));
    },
    
    onDeviceDataUpdate: (update: DeviceDataUpdate) => {
      // Update the device status with new data
      setDeviceStatuses(prev => {
        const currentStatus = prev[update.deviceId];
        if (currentStatus) {
          return {
            ...prev,
            [update.deviceId]: {
              ...currentStatus,
              latestData: update.data,
              lastSeen: update.timestamp,
              isOnline: true,
              status: 'online' as const,
              message: 'Device is online'
            }
          };
        }
        return prev;
      });
    },
    
    onInitialDeviceStatuses: (statuses: DeviceStatus[]) => {
      const statusMap = statuses.reduce((acc, status) => {
        acc[status.deviceId] = status;
        return acc;
      }, {} as Record<string, DeviceStatus>);
      
      setDeviceStatuses(statusMap);
    }
  };

  // Connect to socket
  const connect = useCallback(async (): Promise<boolean> => {
    if (!user) {
      setError('User not authenticated');
      return false;
    }

    try {
      setError(null);
      const success = await socketService.connect(callbacks);
      
      if (success) {
        // Subscribe to initial devices
        deviceIds.forEach(deviceId => {
          socketService.subscribeToDevice(deviceId);
        });
      }
      
      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Connection failed';
      setError(errorMessage);
      return false;
    }
  }, [user, deviceIds]);

  // Subscribe to device
  const subscribeToDevice = useCallback((deviceId: string) => {
    socketService.subscribeToDevice(deviceId);
  }, []);

  // Unsubscribe from device
  const unsubscribeFromDevice = useCallback((deviceId: string) => {
    socketService.unsubscribeFromDevice(deviceId);
    // Remove from local state
    setDeviceStatuses(prev => {
      const newStatuses = { ...prev };
      delete newStatuses[deviceId];
      return newStatuses;
    });
  }, []);

  // Check device status
  const checkDeviceStatus = useCallback((deviceId: string) => {
    socketService.checkDeviceStatus(deviceId);
  }, []);

  // Disconnect from socket
  const disconnect = useCallback(() => {
    socketService.disconnect();
    setIsConnected(false);
    setDeviceStatuses({});
    setError(null);
  }, []);

  // Auto-connect when user is authenticated
  useEffect(() => {
    if (autoConnect && user && !socketService.isConnected()) {
      connect();
    }
  }, [user, autoConnect, connect]);

  // Update callbacks when they change
  useEffect(() => {
    socketService.updateCallbacks(callbacks);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Don't disconnect on unmount, let other components use the socket
      // socketService.disconnect();
    };
  }, []);

  // Subscribe to new device IDs when they change
  useEffect(() => {
    if (isConnected) {
      const currentSubscriptions = socketService.getSubscribedDevices();
      
      // Subscribe to new devices
      deviceIds.forEach(deviceId => {
        if (!currentSubscriptions.includes(deviceId)) {
          socketService.subscribeToDevice(deviceId);
        }
      });
      
      // Unsubscribe from removed devices
      currentSubscriptions.forEach(deviceId => {
        if (!deviceIds.includes(deviceId)) {
          socketService.unsubscribeFromDevice(deviceId);
        }
      });
    }
  }, [deviceIds, isConnected]);

  return {
    isConnected,
    error,
    deviceStatuses,
    subscribeToDevice,
    unsubscribeFromDevice,
    checkDeviceStatus,
    connect,
    disconnect
  };
} 