'use client';

import React, { useState, useCallback, useEffect } from 'react';
import Cropper from 'react-easy-crop';
import { X, Check, RotateCw, RotateCcw, Maximize2 } from 'lucide-react';
import { Area } from 'react-easy-crop';

export interface ImageCropProps {
  image: string;
  isOpen: boolean;
  onClose: () => void;
  onCropComplete: (croppedImageFile: File) => void;
  aspectRatio?: number; // undefined = free crop
}

export default function ImageCrop({
  image,
  isOpen,
  onClose,
  onCropComplete,
  aspectRatio,
}: ImageCropProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop);
  }, []);

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom);
  }, []);

  const onRotationChange = useCallback((rotation: number) => {
    setRotation(rotation);
  }, []);

  const handleReset = useCallback(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  }, []);

  const onCropCompleteCallback = useCallback(
    (croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedAreaPixels(croppedAreaPixels);
    },
    []
  );

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });

  const getCroppedImg = async (
    imageSrc: string,
    pixelCrop: Area,
    rotation: number = 0
  ): Promise<File> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('No 2d context');
    }

    // Calculate rotated image dimensions
    const rad = (rotation * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));
    const imageWidth = image.width;
    const imageHeight = image.height;
    const rotatedWidth = imageWidth * cos + imageHeight * sin;
    const rotatedHeight = imageWidth * sin + imageHeight * cos;

    // Set canvas size to rotated dimensions
    canvas.width = rotatedWidth;
    canvas.height = rotatedHeight;

    // Translate to center, rotate, then translate back
    ctx.translate(rotatedWidth / 2, rotatedHeight / 2);
    ctx.rotate(rad);
    ctx.translate(-imageWidth / 2, -imageHeight / 2);

    // Draw the image
    ctx.drawImage(image, 0, 0);

    // Create cropped canvas
    const croppedCanvas = document.createElement('canvas');
    const croppedCtx = croppedCanvas.getContext('2d');
    if (!croppedCtx) {
      throw new Error('No 2d context');
    }

    croppedCanvas.width = pixelCrop.width;
    croppedCanvas.height = pixelCrop.height;

    // Draw the cropped portion
    croppedCtx.drawImage(
      canvas,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      croppedCanvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          const file = new File([blob], `cropped_${Date.now()}.png`, {
            type: 'image/png',
          });
          resolve(file);
        },
        'image/png',
        0.95
      );
    });
  };

  const handleSave = async () => {
    if (!croppedAreaPixels) return;

    try {
      const croppedImage = await getCroppedImg(image, croppedAreaPixels, rotation);
      onCropComplete(croppedImage);
      onClose();
    } catch (error) {
      console.error('Error cropping image:', error);
    }
  };

  // Reset state when image changes
  React.useEffect(() => {
    if (image && isOpen) {
      setImageLoaded(false);
      setImageError(false);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setCroppedAreaPixels(null);
      
      // Preload image to check if it's valid
      const img = new Image();
      img.onload = () => {
        setImageLoaded(true);
        setImageError(false);
      };
      img.onerror = () => {
        setImageError(true);
        setImageLoaded(false);
      };
      img.src = image;
    }
  }, [image, isOpen]);

  if (!isOpen || !image) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-4xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Crop Image</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cropper */}
        <div className="relative bg-gray-900" style={{ height: '500px', width: '100%' }}>
          {imageError ? (
            <div className="flex items-center justify-center h-full text-red-600">
              <p>Failed to load image. Please try again.</p>
            </div>
          ) : !imageLoaded ? (
            <div className="flex items-center justify-center h-full text-gray-400">
              <p>Loading image...</p>
            </div>
          ) : (
            <Cropper
              image={image}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              {...(aspectRatio !== undefined && { aspect: aspectRatio })}
              onCropChange={onCropChange}
              onZoomChange={onZoomChange}
              onRotationChange={onRotationChange}
              onCropComplete={onCropCompleteCallback}
              restrictPosition={false}
              style={{
                containerStyle: {
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                },
                cropAreaStyle: {
                  border: '2px solid #3b82f6',
                  boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
                },
              }}
            />
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="space-y-4">
            {/* Rotation Controls */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setRotation((prev) => Math.max(-180, prev - 15))}
                className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="Rotate counter-clockwise"
              >
                <RotateCcw className="w-5 h-5 text-gray-700" />
              </button>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                  Rotation: {rotation}°
                </label>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={rotation}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
              <button
                type="button"
                onClick={() => setRotation((prev) => Math.min(180, prev + 15))}
                className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                title="Rotate clockwise"
              >
                <RotateCw className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            {/* Zoom Control */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Zoom: {Math.round(zoom * 100)}%
              </label>
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.1}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-2"
                title="Reset zoom and rotation"
              >
                <Maximize2 className="w-4 h-4" />
                Reset
              </button>
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={!croppedAreaPixels}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Check className="w-4 h-4" />
                  Save Crop
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
