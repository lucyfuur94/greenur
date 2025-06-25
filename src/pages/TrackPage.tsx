import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { Label } from "@/components/ui/label";
import { ExternalLink, CheckCircle, AlertCircle, Wifi, ArrowRight, ArrowLeft, Smartphone, Hash } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import FooterNavigation from '@/components/FooterNavigation';
import { registerPulseDevice, registerPulseDeviceByPairingCode, openDeviceConfigPage, getUserPulseDevices } from '@/lib/services/deviceService';
import QRCameraScanner from '@/components/QRCameraScanner';
import { PulseDataDisplay } from '@/components/PulseDataDisplay';
import { checkDeviceStatus, getStatusDisplay } from '@/lib/services/deviceStatusService';

interface DeviceData {
  type: string;
  deviceId: string;
  setupWifi: string;
}

interface PulseDeviceConfig {
  deviceId: string;
  wifiSsid?: string; // For storing/displaying, actual sending to device is complex
  deviceName?: string;
}

// Helper function to convert device service response to config
const getFirstDeviceConfig = async (): Promise<PulseDeviceConfig | null> => {
  try {
    const result = await getUserPulseDevices();
    
    if (result.success && result.devices && result.devices.length > 0) {
      const device = result.devices[0]; // Get the first device
      return {
        deviceId: device.deviceId,
        wifiSsid: device.wifiSsid || undefined,
        deviceName: device.deviceName || `Pulse Device ${device.deviceId}`
      };
    }

    return null;
  } catch (error) {
    console.error('Error fetching device config:', error);
    return null;
  }
};

type WizardStep = 'scan' | 'register' | 'wifi-connect' | 'wifi-config' | 'complete';

const TrackPage: React.FC = () => {
  const { user, token, isLoading: authLoading } = useAuth();
  const [deviceConfig, setDeviceConfig] = useState<PulseDeviceConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showSetupWizard, setShowSetupWizard] = useState<boolean>(false);
  const [showQRScanner, setShowQRScanner] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>('scan');
  const [scannedDevice, setScannedDevice] = useState<DeviceData | null>(null);
  const [pairingCode, setPairingCode] = useState<string>('');
  const [pairingError, setPairingError] = useState<string | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [wifiConnectionStatus, setWifiConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchConfig = async () => {
      // Don't do anything while auth is loading
      if (authLoading) {
        return;
      }
      
      if (user && token) {
        setIsLoading(true);
        try {
          const config = await getFirstDeviceConfig();
          setDeviceConfig(config);
          if (!config) {
            setShowSetupWizard(true); // If no config, show setup wizard
          }
        } catch (error) {
          console.error("Error fetching device config:", error);
        } finally {
          setIsLoading(false);
        }
      } else if (user === null && !authLoading) {
        // User is explicitly null and auth loading is complete (not authenticated), redirect to login
        console.log('User not authenticated, redirecting to login');
        navigate('/login');
      }
      // If user is undefined, we're still loading auth state
    };
    fetchConfig();
  }, [user, authLoading, navigate]);



  const handleQRScanSuccess = async (deviceData: DeviceData) => {
    setScannedDevice(deviceData);
    setShowQRScanner(false);
    setCurrentStep('register');
    setRegistrationError(null);

    // Automatically register the device
    try {
      const result = await registerPulseDevice(deviceData.deviceId);
      if (result.success) {
        setCurrentStep('wifi-connect');
        console.log('Device registered successfully. Ready for WiFi setup.');
      } else {
        setRegistrationError(result.error || 'Registration failed');
        setCurrentStep('scan');
      }
    } catch (error) {
      setRegistrationError('Failed to register device');
      setCurrentStep('scan');
    }
  };




  const handlePairingCodeSubmit = async () => {
    setPairingError(null);
    setRegistrationError(null);
    
    if (!pairingCode || pairingCode.trim().length !== 9) {
      setPairingError('Please enter a 9-character pairing code');
      return;
    }

    // Check authentication before proceeding
    if (!user || !token) {
      setRegistrationError('You must be logged in to register a device');
      return;
    }

    setCurrentStep('register');

    // Register device using pairing code
    try {
      console.log('Attempting to register device with pairing code:', pairingCode.trim());
      console.log('User authenticated:', !!user, 'Token available:', !!token);
      
      const result = await registerPulseDeviceByPairingCode(pairingCode.trim());
      if (result.success && result.deviceId) {
        // Create device data object for WiFi setup
        const deviceData: DeviceData = {
          type: 'greenur_device',
          deviceId: result.deviceId,
          setupWifi: `Greenur-Device-Setup-${pairingCode.trim().toUpperCase()}`
        };
        setScannedDevice(deviceData);
        setCurrentStep('wifi-connect');
        console.log('Device registered successfully via pairing code. Ready for WiFi setup.');
      } else {
        console.error('Registration failed:', result.error);
        setRegistrationError(result.error || 'Registration failed');
        setCurrentStep('scan');
      }
    } catch (error) {
      console.error('Registration error:', error);
      setRegistrationError('Failed to register device');
      setCurrentStep('scan');
    }
  };

  const handleWifiConnection = async () => {
    if (!scannedDevice) return;
    
    setWifiConnectionStatus('connecting');
    
    try {
      // Try to use Web WiFi API if available (experimental)
      if ('navigator' in window && 'wifi' in (navigator as any)) {
        const wifi = (navigator as any).wifi;
        await wifi.connect({
          ssid: scannedDevice.setupWifi,
          // No password needed for device hotspot
        });
        setWifiConnectionStatus('connected');
        setCurrentStep('wifi-config');
      } else {
        // Fallback: Open WiFi settings and provide instructions
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          // Try to open WiFi settings on mobile
          if (navigator.userAgent.includes('Android')) {
            window.open('intent://wifi#Intent;scheme=android.settings;package=com.android.settings;end');
          } else if (navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')) {
            window.open('App-Prefs:root=WIFI');
          }
        }
        
        // Show manual connection instructions
        setWifiConnectionStatus('failed');
        setTimeout(() => {
          setWifiConnectionStatus('idle');
        }, 3000);
      }
    } catch (error) {
      console.error('WiFi connection failed:', error);
      setWifiConnectionStatus('failed');
      setTimeout(() => {
        setWifiConnectionStatus('idle');
      }, 3000);
    }
  };

  const handleManualWifiConnection = () => {
    setCurrentStep('wifi-config');
  };

  const handleWifiConfigComplete = () => {
    setCurrentStep('complete');
  };

  const handleRefreshDeviceStatus = async () => {
    setIsLoading(true);
    setRegistrationError(null);
    
    if (!user || !token) {
      setRegistrationError('You must be logged in to check device status');
      setIsLoading(false);
      return;
    }

    try {
      // Get device ID from the current setup wizard state
      const deviceId = scannedDevice?.deviceId;
      
      if (!deviceId) {
        setRegistrationError('No device found. Please complete device setup first.');
        setIsLoading(false);
        return;
      }

      // Check if the device is actually online
      console.log('Checking status for device:', deviceId);
      const statusResponse = await checkDeviceStatus(deviceId);
      
      if (!statusResponse.success) {
        setRegistrationError(statusResponse.error || 'Failed to check device status');
        setIsLoading(false);
        return;
      }

      // Check if device is online or has recent activity
      if (statusResponse.online) {
        // Device is online - show the dashboard
        const config: PulseDeviceConfig = {
          deviceId: deviceId,
          // We don't need wifiSsid for the dashboard display
        };
        setDeviceConfig(config);
        setShowSetupWizard(false);
        setCurrentStep('scan'); // Reset wizard for next time
        console.log('Device is online, showing dashboard');
      } else {
        // Device is offline - show error with helpful message
        const statusDisplay = getStatusDisplay(statusResponse.status || 'offline');
        setRegistrationError(
          `Device appears to be ${statusDisplay.text.toLowerCase()}. ${statusResponse.message || statusDisplay.description}. Please ensure your device is powered on and connected to WiFi.`
        );
      }
    } catch (error) {
      console.error("Error checking device status:", error);
      setRegistrationError('Failed to check device status. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resetWizard = () => {
    setCurrentStep('scan');
    setScannedDevice(null);
    setPairingCode('');
    setPairingError(null);
    setRegistrationError(null);
    setWifiConnectionStatus('idle');
  };

  const renderSkeletonLoader = () => (
    <div className="container mx-auto p-4 space-y-6">
                  <div className="bg-card rounded-xl shadow-md p-6 animate-pulse border border-border">
              <div className="h-4 bg-muted rounded w-1/4 mb-2"></div>
              <div className="h-6 bg-muted rounded w-1/2 mb-4"></div>
              <div className="h-32 bg-muted rounded"></div>
            </div>
    </div>
  );

  const WizardStepIndicator = () => {
    const steps = [
      { id: 'scan', label: 'Enter Code', icon: Hash },
      { id: 'register', label: 'Register', icon: CheckCircle },
      { id: 'wifi-connect', label: 'Connect WiFi', icon: Wifi },
      { id: 'wifi-config', label: 'Configure', icon: ExternalLink },
      { id: 'complete', label: 'Complete', icon: CheckCircle }
    ];

    const getCurrentStepIndex = () => {
      return steps.findIndex(step => step.id === currentStep);
    };

    const currentIndex = getCurrentStepIndex();

    return (
      <div className="flex items-center justify-between mb-6 px-4">
        {steps.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === currentIndex;
          const isCompleted = index < currentIndex;
          const isUpcoming = index > currentIndex;

          return (
            <React.Fragment key={step.id}>
              <div className="flex flex-col items-center">
                <div className={`
                  w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                  ${isActive ? 'bg-primary text-primary-foreground' : ''}
                  ${isCompleted ? 'bg-primary/80 text-primary-foreground' : ''}
                  ${isUpcoming ? 'bg-muted text-muted-foreground' : ''}
                `}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-xs mt-1 ${isActive ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${index < currentIndex ? 'bg-primary' : 'bg-border'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const DeviceSetupWizard = () => {
    // Step 1: Pairing Code Input
    if (currentStep === 'scan') {
      return (
        <Card className="bg-card shadow-md rounded-xl overflow-hidden border border-border">
          <CardHeader className="bg-primary/5 pb-3">
            <CardTitle className="text-lg text-primary flex items-center">
              <Hash className="w-5 h-5 mr-2" />
              Step 1: Enter Pairing Code
            </CardTitle>
            <CardDescription>
              Enter the 9-character code displayed on your Pulse device
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="mb-6 text-center">
              <Hash className="w-16 h-16 mx-auto text-primary mb-4" />
              <p className="text-card-foreground mb-4">
                Power on your Pulse device and enter the 9-character pairing code shown on its display.
              </p>
            </div>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="pairingCode" className="text-sm font-medium text-card-foreground">
                  Pairing Code
                </Label>
                <input
                  ref={inputRef}
                  key="pairing-code-input"
                  id="pairingCode"
                  type="text"
                  placeholder="Enter 9-character code (e.g., ABC123DEF)"
                  value={pairingCode}
                  onChange={(e) => {
                    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 9);
                    setPairingCode(value);
                    if (pairingError) {
                      setPairingError(null);
                    }
                    // Maintain focus after state update
                    setTimeout(() => {
                      if (inputRef.current && document.activeElement !== inputRef.current) {
                        inputRef.current.focus();
                      }
                    }, 0);
                  }}
                  onKeyDown={(e) => {
                    // Submit on Enter if all 9 characters entered
                    if (e.key === 'Enter' && pairingCode.length === 9) {
                      handlePairingCodeSubmit();
                    }
                    // Allow only alphanumeric characters and control keys
                    if (!/[A-Za-z0-9]/.test(e.key) && !['Backspace', 'Delete', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
                      e.preventDefault();
                    }
                  }}
                  className="w-full p-3 text-center text-lg font-mono tracking-wider border border-input rounded-xl focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background shadow-sm transition-all duration-200 text-foreground"
                  maxLength={9}
                  autoComplete="one-time-code"
                />
                {pairingError && (
                  <p className="text-destructive text-sm mt-1">{pairingError}</p>
                )}
              </div>
              
              <Button 
                onClick={handlePairingCodeSubmit}
                disabled={pairingCode.length !== 9}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground disabled:bg-muted disabled:text-muted-foreground"
                size="lg"
              >
                <Hash className="w-5 h-5 mr-2" />
                Pair Device
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    // Step 2: Device Registration
    if (currentStep === 'register') {
      return (
        <Card className="bg-card shadow-md rounded-xl overflow-hidden border border-border">
          <CardHeader className="bg-primary/5 pb-3">
            <CardTitle className="text-lg text-primary flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Step 2: Registering Device
            </CardTitle>
            <CardDescription>
              Device ID: {scannedDevice?.deviceId}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-center p-6 bg-blue-500/10 dark:bg-blue-500/20 rounded-lg border border-blue-500/30">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-4"></div>
              <div>
                <p className="text-blue-700 dark:text-blue-300 font-medium">Registering device to your account...</p>
                <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">This will only take a moment</p>
              </div>
            </div>
            {registrationError && (
              <div className="mt-4 p-4 bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                  <span className="text-red-700 dark:text-red-300">{registrationError}</span>
                </div>
                {registrationError.includes('Unauthorized') && (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    Please make sure you are logged in and try again.
                  </div>
                )}
                <Button 
                  onClick={resetWizard}
                  variant="outline"
                  className="mt-3 w-full"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      );
    }

    // Step 3: WiFi Connection
    if (currentStep === 'wifi-connect') {
      return (
        <Card className="bg-card shadow-md rounded-xl overflow-hidden border border-border">
          <CardHeader className="bg-blue-500/5 pb-3">
            <CardTitle className="text-lg text-blue-600 dark:text-blue-400 flex items-center">
              <Wifi className="w-5 h-5 mr-2" />
              Step 3: Connect to Device WiFi
            </CardTitle>
            <CardDescription>
              Connect your phone to the device's WiFi hotspot
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <Wifi className="w-16 h-16 mx-auto text-blue-600 mb-4" />
              <p className="text-foreground mb-2">
                Your device is broadcasting a WiFi hotspot:
              </p>
              <div className="bg-blue-500/10 dark:bg-blue-500/20 p-3 rounded-lg mb-4 border border-blue-500/30">
                <code className="text-blue-800 dark:text-blue-200 font-mono text-sm">
                  {scannedDevice?.setupWifi}
                </code>
              </div>
            </div>

            <div className="space-y-3">
              <Button 
                onClick={handleWifiConnection}
                disabled={wifiConnectionStatus === 'connecting'}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                size="lg"
              >
                {wifiConnectionStatus === 'connecting' ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Connecting to WiFi...
                  </>
                ) : (
                  <>
                    <Wifi className="w-5 h-5 mr-2" />
                    Connect Automatically
                  </>
                )}
              </Button>

              <div className="text-center">
                <span className="text-muted-foreground text-sm">or</span>
              </div>

              <Button 
                onClick={handleManualWifiConnection}
                variant="outline"
                className="w-full"
              >
                <Smartphone className="w-4 h-4 mr-2" />
                I'll Connect Manually
              </Button>
            </div>

                                                    {wifiConnectionStatus === 'failed' && (
               <div className="mt-4 p-4 bg-yellow-500/10 dark:bg-yellow-500/20 border border-yellow-500/30 rounded-lg">
                 <div className="flex items-start">
                   <AlertCircle className="w-5 h-5 text-yellow-500 mr-2 mt-0.5" />
                   <div>
                     <p className="text-yellow-800 dark:text-yellow-200 font-medium">Automatic connection not available</p>
                     <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                       Please go to your phone's WiFi settings and connect to "{scannedDevice?.setupWifi}" manually, then click "I'll Connect Manually" above.
                     </p>
                   </div>
                 </div>
               </div>
             )}

             <div className="mt-4 p-4 bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/30 rounded-lg">
               <div className="flex items-start">
                 <AlertCircle className="w-5 h-5 text-blue-500 mr-2 mt-0.5" />
                 <div>
                   <p className="text-blue-800 dark:text-blue-200 font-medium">Important: Internet Access</p>
                   <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
                     Once connected to the device WiFi, you'll lose internet access temporarily. This is normal - the device WiFi is only for configuration.
                   </p>
                 </div>
               </div>
             </div>
          </CardContent>
        </Card>
      );
    }

    // Step 4: WiFi Configuration
    if (currentStep === 'wifi-config') {
      return (
        <Card className="bg-card shadow-md rounded-xl overflow-hidden border border-border">
          <CardHeader className="bg-purple-500/5 pb-3">
            <CardTitle className="text-lg text-purple-800 dark:text-purple-200 flex items-center">
              <Smartphone className="w-5 h-5 mr-2" />
              Step 4: Configure Home WiFi
            </CardTitle>
            <CardDescription>
              Set up your device to connect to your home WiFi network
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="text-center mb-4">
              <Smartphone className="w-16 h-16 mx-auto text-purple-600 mb-4" />
              <p className="text-foreground mb-4">
                Now configure your device to connect to your home WiFi network
              </p>
            </div>

            <div className="bg-purple-500/10 dark:bg-purple-500/20 p-4 rounded-lg border border-purple-500/30">
              <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">Configuration Steps:</h4>
              <ol className="text-sm text-purple-700 dark:text-purple-300 space-y-1 list-decimal list-inside">
                <li>Open the device configuration page</li>
                <li>Click "Scan for Networks"</li>
                <li>Select your home WiFi network</li>
                <li>Enter your WiFi password</li>
                <li>Click "Save & Connect"</li>
              </ol>
            </div>

            <Button 
              onClick={openDeviceConfigPage}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              size="lg"
            >
              <ExternalLink className="w-5 h-5 mr-2" />
              Open Device Config Page
            </Button>

                         <div className="bg-orange-500/10 dark:bg-orange-500/20 p-4 rounded-lg border border-orange-500/30">
               <div className="flex items-start">
                 <AlertCircle className="w-5 h-5 text-orange-500 mr-2 mt-0.5" />
                 <div>
                   <p className="text-orange-800 dark:text-orange-200 font-medium">No Internet While Connected</p>
                   <p className="text-orange-700 dark:text-orange-300 text-sm mt-1">
                     While connected to the device WiFi, you won't have internet access. This is normal - only the device configuration page (192.168.4.1) will work.
                   </p>
                 </div>
               </div>
             </div>

             <div className="text-center">
               <p className="text-xs text-muted-foreground mb-3">
                 Or go to: <code className="bg-muted px-1 rounded">http://192.168.4.1</code>
               </p>
               <Button 
                 onClick={handleWifiConfigComplete}
                 variant="outline"
                 className="w-full"
               >
                 <ArrowRight className="w-4 h-4 mr-2" />
                 I've Completed WiFi Setup
               </Button>
             </div>
          </CardContent>
        </Card>
      );
    }

    // Step 5: Setup Complete
    if (currentStep === 'complete') {
      return (
        <Card className="bg-card shadow-md rounded-xl overflow-hidden border border-border">
          <CardHeader className="bg-green-500/5 pb-3">
            <CardTitle className="text-lg text-green-800 dark:text-green-200 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Setup Complete!
            </CardTitle>
            <CardDescription>
              Your Pulse device is now configured and should be online
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <CheckCircle className="w-16 h-16 mx-auto text-green-600 mb-4" />
              <div className="bg-green-500/10 dark:bg-green-500/20 p-4 rounded-lg border border-green-500/30">
                <p className="text-green-800 dark:text-green-200 font-medium mb-2">
                  🎉 Congratulations!
                </p>
                <p className="text-green-700 dark:text-green-300 text-sm">
                  Your Pulse device is now registered and should start sending data within a few minutes. 
                  The device will automatically connect to your home WiFi and begin monitoring your plant.
                </p>
              </div>
                             <div className="bg-yellow-500/10 dark:bg-yellow-500/20 p-4 rounded-lg border border-yellow-500/30 mb-4">
                 <div className="flex items-start">
                   <AlertCircle className="w-5 h-5 text-yellow-500 mr-2 mt-0.5" />
                   <div>
                     <p className="text-yellow-800 dark:text-yellow-200 font-medium">Reconnect to Your Home WiFi</p>
                     <p className="text-yellow-700 dark:text-yellow-300 text-sm mt-1">
                       Make sure to reconnect your phone to your home WiFi network before checking device status, as you'll need internet access.
                     </p>
                   </div>
                 </div>
               </div>
               <Button 
                 onClick={handleRefreshDeviceStatus}
                 className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                 size="lg"
                 disabled={isLoading}
               >
                 <CheckCircle className="w-5 h-5 mr-2" />
                 {isLoading ? 'Checking Status...' : 'Check Device Status'}
               </Button>
               
               {registrationError && (
                 <div className="mt-4 p-4 bg-red-500/10 dark:bg-red-500/20 border border-red-500/30 rounded-lg">
                   <div className="flex items-center">
                     <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                     <span className="text-red-700 dark:text-red-300">{registrationError}</span>
                   </div>
                   <Button 
                     onClick={resetWizard}
                     variant="outline"
                     className="mt-3 w-full"
                   >
                     <ArrowLeft className="w-4 h-4 mr-2" />
                     Back to Setup
                   </Button>
                 </div>
               )}
            </div>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className="relative flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-16">
        {/* Top Bar */}
        <div className="w-full bg-background shadow-sm sticky top-0 z-10 border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-lg font-semibold text-primary">Track Your Devices</h1>
            {deviceConfig && (
                 <Button variant="outline" size="sm" onClick={() => setShowSetupWizard(true)} className="ml-auto">
                    Edit Device
                 </Button>
            )}
          </div>
        </div>

        {(authLoading || (isLoading && !deviceConfig && !showSetupWizard)) ? (
          renderSkeletonLoader()
        ) : (
          <div className="container mx-auto p-4 space-y-6">
            {deviceConfig && !showSetupWizard && (
              <PulseDataDisplay 
                deviceId={deviceConfig.deviceId}
                deviceName={deviceConfig.deviceName || `Pulse Device ${deviceConfig.deviceId}`}
              />
            )}

            {(showSetupWizard || (!isLoading && !deviceConfig)) && (
              <div>
                <WizardStepIndicator />
                <DeviceSetupWizard />
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR Scanner Modal */}
      <QRCameraScanner 
        isVisible={showQRScanner}
        onScanSuccess={handleQRScanSuccess}
        onClose={() => setShowQRScanner(false)}
      />

      <FooterNavigation 
        activeTab="track" 
        onNavigate={(page) => {
          if (page === 'home') navigate('/home');
          else if (page === 'ai') navigate('/ai-chat');
          // No need to navigate for 'track' as we're already here
        }} 
      />
    </div>
  );
};

export default TrackPage; 