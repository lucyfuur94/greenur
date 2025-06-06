import React, { useRef, useEffect, useState } from 'react';
import { Camera, X, AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import QrScanner from 'qr-scanner';
import { parseDeviceQRCode } from '@/lib/services/deviceService';

interface QRCameraScannerProps {
  onScanSuccess: (deviceData: DeviceData) => void;
  onClose: () => void;
  isVisible: boolean;
}

interface DeviceData {
  type: string;
  deviceId: string;
  setupWifi: string;
}

const QRCameraScanner: React.FC<QRCameraScannerProps> = ({ onScanSuccess, onClose, isVisible }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrScanner, setQrScanner] = useState<QrScanner | null>(null);
  const [showManualInput, setShowManualInput] = useState(false);
  const [manualInput, setManualInput] = useState('');
  const [hasBackCamera, setHasBackCamera] = useState(true);

  useEffect(() => {
    if (isVisible && videoRef.current) {
      startScanning();
    }

    return () => {
      stopScanning();
    };
  }, [isVisible]);

  const startScanning = async () => {
    if (!videoRef.current) return;

    try {
      setError(null);
      setIsScanning(true);

      // Create QR scanner instance
      const scanner = new QrScanner(
        videoRef.current,
        (result) => handleScanResult(result.data),
        {
          preferredCamera: 'environment', // Use back camera by default
          highlightScanRegion: true,
          highlightCodeOutline: true,
          maxScansPerSecond: 5,
        }
      );

      setQrScanner(scanner);

      // Check if back camera is available
      const cameras = await QrScanner.listCameras(true);
      const backCamera = cameras.find(camera => camera.label.toLowerCase().includes('back'));
      setHasBackCamera(!!backCamera);

      // Start scanning
      await scanner.start();
      console.log('QR Scanner started successfully');

    } catch (err) {
      console.error('Error starting QR scanner:', err);
      let errorMessage = 'Failed to start camera. ';
      
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          errorMessage += 'Please grant camera permission and try again.';
        } else if (err.name === 'NotFoundError') {
          errorMessage += 'No camera found on this device.';
        } else if (err.name === 'NotSupportedError') {
          errorMessage += 'Camera not supported in this browser.';
        } else {
          errorMessage += err.message;
        }
      }
      
      setError(errorMessage);
      setShowManualInput(true);
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (qrScanner) {
      qrScanner.stop();
      qrScanner.destroy();
      setQrScanner(null);
    }
    setIsScanning(false);
  };

  const handleScanResult = (result: string) => {
    try {
      console.log('QR Code scanned:', result);
      
      // Use the parseDeviceQRCode function to handle both URL and JSON formats
      const deviceData = parseDeviceQRCode(result);
      
      if (deviceData) {
        stopScanning();
        onScanSuccess(deviceData);
      } else {
        setError('Invalid QR code. Please scan a Greenur device QR code.');
        // Continue scanning for valid QR code
      }
    } catch (err) {
      setError('Invalid QR code format. Please scan a valid Greenur device QR code.');
      // Continue scanning for valid QR code
    }
  };

  const handleManualInput = () => {
    try {
      // Use the parseDeviceQRCode function for manual input as well
      const deviceData = parseDeviceQRCode(manualInput);
      
      if (deviceData) {
        onScanSuccess(deviceData);
      } else {
        setError('Invalid QR code format. Please enter valid Greenur device QR code data.');
      }
    } catch (err) {
      setError('Invalid format. Please enter valid QR code data or URL.');
    }
  };

  const flipCamera = async () => {
    if (!qrScanner) return;

    try {
      const cameras = await QrScanner.listCameras(true);
      if (cameras.length <= 1) return; // No other cameras to switch to
      
      // Stop current scanner
      qrScanner.stop();
      
      // Try to switch to next available camera
      // Since we can't get current camera, we'll cycle through available cameras
      const nextCameraId = cameras[1]?.id || cameras[0]?.id;
      await qrScanner.setCamera(nextCameraId);
      
      // Restart scanner
      await qrScanner.start();
    } catch (err) {
      console.error('Error flipping camera:', err);
      setError('Failed to switch camera.');
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-white">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center">
              <Camera className="w-5 h-5 mr-2 text-green-600" />
              Scan Device QR Code
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {error && (
            <div className="flex items-center p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}
          
          {!showManualInput && (
            <>
              {/* Camera Preview */}
              <div className="relative bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-64 object-cover"
                />
                
                {/* Scanning overlay */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-48 h-48 border-2 border-green-500 border-dashed relative">
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-500"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-500"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-500"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-500"></div>
                    
                    {isScanning && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-full h-1 bg-green-500 animate-pulse"></div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Camera flip button */}
                {hasBackCamera && isScanning && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={flipCamera}
                    className="absolute top-2 right-2 bg-black bg-opacity-50 text-white hover:bg-black hover:bg-opacity-70"
                  >
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                )}
              </div>
              
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-3">
                  Position the QR code within the frame to scan
                </p>
                <p className="text-xs text-gray-500 mb-3">
                  The QR code should appear on your Pulse device's OLED display
                </p>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setShowManualInput(true)}
                  className="text-xs"
                >
                  Can't scan? Enter manually
                </Button>
              </div>
            </>
          )}

          {/* Manual Input Fallback */}
          {showManualInput && (
            <div className="space-y-4">
              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <Camera className="w-12 h-12 mx-auto text-gray-400 mb-3" />
                <p className="text-sm text-gray-600 mb-4">
                  Enter the QR code data manually:
                </p>
                <textarea
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  placeholder='{"type":"greenur_device","deviceId":"ESP32-XXXXXX","setupWifi":"Greenur-Device-Setup-XXXXXX"}'
                  className="w-full h-24 p-3 border rounded-lg text-xs font-mono"
                />
              </div>
              
              <div className="flex space-x-2">
                <Button 
                  variant="outline" 
                  onClick={() => setShowManualInput(false)}
                  className="flex-1"
                  disabled={!videoRef.current}
                >
                  Back to Camera
                </Button>
                <Button 
                  onClick={handleManualInput}
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  disabled={!manualInput.trim()}
                >
                  Continue
                </Button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!showManualInput && (
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={onClose}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={startScanning}
                className="flex-1 bg-green-600 hover:bg-green-700"
                disabled={isScanning}
              >
                {isScanning ? 'Scanning...' : 'Retry'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default QRCameraScanner; 