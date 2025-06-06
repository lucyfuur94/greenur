import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { QrCode, ExternalLink, CheckCircle, AlertCircle, Wifi, ArrowRight, ArrowLeft, Smartphone } from "lucide-react";
import { useNavigate } from 'react-router-dom';
import FooterNavigation from '@/components/FooterNavigation';
import { registerPulseDevice, openDeviceConfigPage } from '@/lib/services/deviceService';
import QRCameraScanner from '@/components/QRCameraScanner';

interface DeviceData {
  type: string;
  deviceId: string;
  setupWifi: string;
}

// Placeholder for API functions - you'll need to implement these
// These would typically live in a service file e.g., src/lib/services/pulseDeviceService.ts

interface PulseDeviceConfig {
  deviceId: string;
  wifiSsid?: string; // For storing/displaying, actual sending to device is complex
  // Add a user-friendly name if desired
  // friendlyName?: string;
}

// Mock API call - replace with actual API calls to your Netlify functions
const getUserPulseDeviceConfig = async (userId: string, token: string): Promise<PulseDeviceConfig | null> => {
  // TODO: API call to fetch from users collection in MongoDB via a new Netlify Function
  console.log('Fetching pulse device config for', userId, token);
  // Simulate no device initially for testing the setup instructions
  return null; 
  // return { deviceId: 'test-esp32-device' }; 
};

type WizardStep = 'scan' | 'register' | 'wifi-connect' | 'wifi-config' | 'complete';

const TrackPage: React.FC = () => {
  const { user, token } = useAuth();
  const [deviceConfig, setDeviceConfig] = useState<PulseDeviceConfig | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [showSetupWizard, setShowSetupWizard] = useState<boolean>(false);
  const [showQRScanner, setShowQRScanner] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<WizardStep>('scan');
  const [scannedDevice, setScannedDevice] = useState<DeviceData | null>(null);
  const [registrationError, setRegistrationError] = useState<string | null>(null);
  const [wifiConnectionStatus, setWifiConnectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'failed'>('idle');
  const navigate = useNavigate();

  useEffect(() => {
    const fetchConfig = async () => {
      if (user && token) {
        setIsLoading(true);
        try {
          const config = await getUserPulseDeviceConfig(user.uid, token);
          setDeviceConfig(config);
          if (!config) {
            setShowSetupWizard(true); // If no config, show setup wizard
          }
        } catch (error) {
          console.error("Error fetching device config:", error);
        } finally {
          setIsLoading(false);
        }
      }
    };
    fetchConfig();
  }, [user, token]);

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

  const handleRefreshDeviceStatus = () => {
    setIsLoading(true);
    if (user && token) {
        getUserPulseDeviceConfig(user.uid, token)
            .then(config => {
                setDeviceConfig(config);
                if (config) {
                    setShowSetupWizard(false); // Hide wizard if device is found
                }
            })
            .catch(error => console.error("Error refreshing device status:", error))
            .finally(() => setIsLoading(false));
    }
  };

  const resetWizard = () => {
    setCurrentStep('scan');
    setScannedDevice(null);
    setRegistrationError(null);
    setWifiConnectionStatus('idle');
  };

  const renderSkeletonLoader = () => (
    <div className="container mx-auto p-4 space-y-6">
      <div className="bg-white rounded-xl shadow-md p-6 animate-pulse">
        <div className="h-4 bg-gray-300 rounded w-1/4 mb-2"></div>
        <div className="h-6 bg-gray-300 rounded w-1/2 mb-4"></div>
        <div className="h-32 bg-gray-300 rounded"></div>
      </div>
    </div>
  );

  const WizardStepIndicator = () => {
    const steps = [
      { id: 'scan', label: 'Scan QR', icon: QrCode },
      { id: 'register', label: 'Register', icon: CheckCircle },
      { id: 'wifi-connect', label: 'Connect WiFi', icon: Wifi },
      { id: 'wifi-config', label: 'Configure', icon: Smartphone },
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
                  ${isActive ? 'bg-green-600 text-white' : ''}
                  ${isCompleted ? 'bg-green-500 text-white' : ''}
                  ${isUpcoming ? 'bg-gray-200 text-gray-500' : ''}
                `}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-xs mt-1 ${isActive ? 'text-green-600 font-medium' : 'text-gray-500'}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${index < currentIndex ? 'bg-green-500' : 'bg-gray-200'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const DeviceSetupWizard = () => {
    // Step 1: QR Code Scanning
    if (currentStep === 'scan') {
      return (
        <Card className="bg-white shadow-md rounded-xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-green-50 to-blue-50 pb-3">
            <CardTitle className="text-lg text-green-800 flex items-center">
              <QrCode className="w-5 h-5 mr-2" />
              Step 1: Scan Device QR Code
            </CardTitle>
            <CardDescription>
              Scan the QR code displayed on your Pulse device's OLED screen
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 text-center">
            <div className="mb-6">
              <QrCode className="w-16 h-16 mx-auto text-green-600 mb-4" />
              <p className="text-gray-700 mb-4">
                Power on your Pulse device and scan the QR code shown on its display to register it to your account.
              </p>
            </div>
            <Button 
              onClick={() => setShowQRScanner(true)}
              className="w-full bg-green-600 hover:bg-green-700 text-white"
              size="lg"
            >
              <QrCode className="w-5 h-5 mr-2" />
              Start QR Code Scan
            </Button>
          </CardContent>
        </Card>
      );
    }

    // Step 2: Device Registration
    if (currentStep === 'register') {
      return (
        <Card className="bg-white shadow-md rounded-xl overflow-hidden">
          <CardHeader className="bg-green-50 pb-3">
            <CardTitle className="text-lg text-green-800 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2" />
              Step 2: Registering Device
            </CardTitle>
            <CardDescription>
              Device ID: {scannedDevice?.deviceId}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="flex items-center justify-center p-6 bg-blue-50 rounded-lg">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-4"></div>
              <div>
                <p className="text-blue-700 font-medium">Registering device to your account...</p>
                <p className="text-blue-600 text-sm mt-1">This will only take a moment</p>
              </div>
            </div>
            {registrationError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                  <span className="text-red-700">{registrationError}</span>
                </div>
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
        <Card className="bg-white shadow-md rounded-xl overflow-hidden">
          <CardHeader className="bg-blue-50 pb-3">
            <CardTitle className="text-lg text-blue-800 flex items-center">
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
              <p className="text-gray-700 mb-2">
                Your device is broadcasting a WiFi hotspot:
              </p>
              <div className="bg-blue-50 p-3 rounded-lg mb-4">
                <code className="text-blue-800 font-mono text-sm">
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
                <span className="text-gray-500 text-sm">or</span>
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
               <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                 <div className="flex items-start">
                   <AlertCircle className="w-5 h-5 text-yellow-500 mr-2 mt-0.5" />
                   <div>
                     <p className="text-yellow-800 font-medium">Automatic connection not available</p>
                     <p className="text-yellow-700 text-sm mt-1">
                       Please go to your phone's WiFi settings and connect to "{scannedDevice?.setupWifi}" manually, then click "I'll Connect Manually" above.
                     </p>
                   </div>
                 </div>
               </div>
             )}

             <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
               <div className="flex items-start">
                 <AlertCircle className="w-5 h-5 text-blue-500 mr-2 mt-0.5" />
                 <div>
                   <p className="text-blue-800 font-medium">Important: Internet Access</p>
                   <p className="text-blue-700 text-sm mt-1">
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
        <Card className="bg-white shadow-md rounded-xl overflow-hidden">
          <CardHeader className="bg-purple-50 pb-3">
            <CardTitle className="text-lg text-purple-800 flex items-center">
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
              <p className="text-gray-700 mb-4">
                Now configure your device to connect to your home WiFi network
              </p>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-medium text-purple-800 mb-2">Configuration Steps:</h4>
              <ol className="text-sm text-purple-700 space-y-1 list-decimal list-inside">
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

                         <div className="bg-orange-50 p-4 rounded-lg border border-orange-200">
               <div className="flex items-start">
                 <AlertCircle className="w-5 h-5 text-orange-500 mr-2 mt-0.5" />
                 <div>
                   <p className="text-orange-800 font-medium">No Internet While Connected</p>
                   <p className="text-orange-700 text-sm mt-1">
                     While connected to the device WiFi, you won't have internet access. This is normal - only the device configuration page (192.168.4.1) will work.
                   </p>
                 </div>
               </div>
             </div>

             <div className="text-center">
               <p className="text-xs text-gray-500 mb-3">
                 Or go to: <code className="bg-gray-100 px-1 rounded">http://192.168.4.1</code>
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
        <Card className="bg-white shadow-md rounded-xl overflow-hidden">
          <CardHeader className="bg-green-50 pb-3">
            <CardTitle className="text-lg text-green-800 flex items-center">
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
              <div className="bg-green-50 p-4 rounded-lg">
                <p className="text-green-800 font-medium mb-2">
                  🎉 Congratulations!
                </p>
                <p className="text-green-700 text-sm">
                  Your Pulse device is now registered and should start sending data within a few minutes. 
                  The device will automatically connect to your home WiFi and begin monitoring your plant.
                </p>
              </div>
                             <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200 mb-4">
                 <div className="flex items-start">
                   <AlertCircle className="w-5 h-5 text-yellow-500 mr-2 mt-0.5" />
                   <div>
                     <p className="text-yellow-800 font-medium">Reconnect to Your Home WiFi</p>
                     <p className="text-yellow-700 text-sm mt-1">
                       Make sure to reconnect your phone to your home WiFi network before checking device status, as you'll need internet access.
                     </p>
                   </div>
                 </div>
               </div>
               <Button 
                 onClick={handleRefreshDeviceStatus}
                 className="w-full bg-green-600 hover:bg-green-700 text-white"
                 size="lg"
               >
                 <CheckCircle className="w-5 h-5 mr-2" />
                 Check Device Status
               </Button>
            </div>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <div className="relative flex flex-col h-screen w-full bg-[#F5F7F5] text-[#333333] overflow-hidden">
      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-16">
        {/* Top Bar */}
        <div className="w-full bg-white shadow-sm sticky top-0 z-10">
          <div className="flex items-center justify-between px-4 py-3">
            <h1 className="text-lg font-semibold text-[#17A34A]">Track Your Devices</h1>
            {deviceConfig && (
                 <Button variant="outline" size="sm" onClick={() => setShowSetupWizard(true)} className="ml-auto">
                    Setup New Device
                 </Button>
            )}
          </div>
        </div>

        {isLoading && !deviceConfig && !showSetupWizard ? (
          renderSkeletonLoader()
        ) : (
          <div className="container mx-auto p-4 space-y-6">
            {deviceConfig && !showSetupWizard && (
              <Card className="bg-white shadow-md rounded-xl overflow-hidden">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">Pulse Device: {deviceConfig.deviceId}</CardTitle>
                  {deviceConfig.wifiSsid && <CardDescription>Connected to Wi-Fi: {deviceConfig.wifiSsid}</CardDescription>}
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-sm text-gray-600">Real-time data from your device will appear here.</p>
                  {/* TODO: Implement PulseDataDisplay component here */}
                  <div className="bg-gray-100 p-8 rounded-xl text-center shadow-inner">
                    <p className="text-lg">Chart placeholder for {deviceConfig.deviceId}</p>
                  </div>
                </CardContent>
              </Card>
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