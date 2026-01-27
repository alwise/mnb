/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, RotateCcw, Circle, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import ImageCrop from './ImageCrop';

export interface CameraCaptureProps {
  isOpen: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  facingMode?: 'user' | 'environment'; // 'user' = front, 'environment' = back
  enableCrop?: boolean; // Enable cropping after capture
  aspectRatio?: number; // Aspect ratio for cropping
}

export default function CameraCapture({
  isOpen,
  onClose,
  onCapture,
  facingMode: initialFacingMode = 'environment',
  enableCrop = true,
  aspectRatio = 1,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>(initialFacingMode);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [showCrop, setShowCrop] = useState(false);

  // Get available cameras
  useEffect(() => {
    if (isOpen) {
      navigator.mediaDevices
        .enumerateDevices()
        .then((devices) => {
          const videoDevices = devices.filter((device) => device.kind === 'videoinput');
          setAvailableDevices(videoDevices);
        })
        .catch((err) => {
          console.error('Error enumerating devices:', err);
        });
    }
  }, [isOpen]);

  // Start camera stream
  useEffect(() => {
    if (!isOpen) {
      stopStream();
      return;
    }

    startStream();

    return () => {
      stopStream();
    };
  }, [isOpen, facingMode, selectedDeviceId]);

  const startStream = async () => {
    try {
      setError(null);
      stopStream(); // Stop any existing stream

      const constraints: MediaStreamConstraints = {
        video: selectedDeviceId
          ? { deviceId: { exact: selectedDeviceId } }
          : {
            facingMode: facingMode,
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      setError(
        err.name === 'NotAllowedError'
          ? 'Camera access denied. Please allow camera access and try again.'
          : err.name === 'NotFoundError'
            ? 'No camera found. Please connect a camera and try again.'
            : 'Failed to access camera. Please try again.'
      );
    }
  };

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  const switchCamera = () => {
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'));
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    setIsCapturing(true);

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert canvas to data URL
    const dataUrl = canvas.toDataURL('image/png', 0.95);

    if (enableCrop) {
      // Show crop dialog
      setCapturedImage(dataUrl);
      setShowCrop(true);
      setIsCapturing(false);
    } else {
      // Convert canvas to blob and return directly
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const file = new File([blob], `photo_${Date.now()}.png`, { type: 'image/png' });
            onCapture(file);
            setIsCapturing(false);
            onClose();
          } else {
            setIsCapturing(false);
            setError('Failed to capture photo. Please try again.');
          }
        },
        'image/png',
        0.95
      );
    }
  };

  const handleCropComplete = (croppedFile: File) => {
    onCapture(croppedFile);
    setCapturedImage(null);
    setShowCrop(false);
    onClose();
  };

  const handleCropCancel = () => {
    setCapturedImage(null);
    setShowCrop(false);
    // Keep camera open
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      if (enableCrop) {
        // Read file as data URL for cropping
        const reader = new FileReader();
        reader.onloadend = () => {
          setCapturedImage(reader.result as string);
          setShowCrop(true);
        };
        reader.readAsDataURL(file);
      } else {
        onCapture(file);
        onClose();
      }
    }
  };

  if (!isOpen && !showCrop) return null;

  // Show crop dialog if image was captured
  if (showCrop && capturedImage) {
    return (
      <ImageCrop
        image={capturedImage}
        isOpen={showCrop}
        onClose={handleCropCancel}
        onCropComplete={handleCropComplete}
        aspectRatio={aspectRatio}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Take Photo</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Camera View */}
        <div className="relative flex-1 bg-black flex items-center justify-center min-h-[400px]">
          {error ? (
            <div className="text-center p-8">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={startStream}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-contain"
              />
              <canvas ref={canvasRef} className="hidden" />
            </>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between gap-4">
            {/* Camera Selection */}
            {availableDevices.length > 1 && (
              <div className="flex-1">
                <select
                  value={selectedDeviceId || ''}
                  onChange={(e) => setSelectedDeviceId(e.target.value || null)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Auto (Front/Back)</option>
                  {availableDevices.map((device) => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Switch Camera Button */}
            {availableDevices.length <= 1 && (
              <button
                onClick={switchCamera}
                className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                title={facingMode === 'user' ? 'Switch to back camera' : 'Switch to front camera'}
              >
                <RotateCcw className="w-5 h-5 text-gray-700" />
              </button>
            )}

            {/* Capture Button */}
            <button
              onClick={capturePhoto}
              disabled={!!error || isCapturing}
              className="p-4 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
              title="Capture photo"
            >
              <Circle className="w-8 h-8 fill-white" />
            </button>

            {/* File Upload Button */}
            <label className="p-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors shadow-sm cursor-pointer">
              <Upload className="w-5 h-5 text-gray-700" />
              <input
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>
          </div>

          {/* Helper Text */}
          <p className="text-xs text-gray-500 mt-3 text-center">
            Click the circle to capture, or use the upload button to select from computer
          </p>
        </div>
      </div>
    </div>
  );
}
