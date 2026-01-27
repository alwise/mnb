'use client';

import React from 'react';
import { Camera, Upload, X } from 'lucide-react';

export interface ImageSourceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectUpload: () => void;
  title?: string;
}

export default function ImageSourceDialog({
  isOpen,
  onClose,
  onSelectCamera,
  onSelectUpload,
  title = 'Select Image Source',
}: ImageSourceDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Options */}
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4">
            {/* Camera Option */}
            <button
              onClick={() => {
                onSelectCamera();
                onClose();
              }}
              className="flex items-center gap-4 p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className="p-3 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                <Camera className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-semibold text-gray-900">Take Photo</h4>
                <p className="text-sm text-gray-600">Use camera or webcam to capture a photo</p>
              </div>
            </button>

            {/* Upload Option */}
            <button
              onClick={() => {
                onSelectUpload();
                onClose();
              }}
              className="flex items-center gap-4 p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all group"
            >
              <div className="p-3 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                <Upload className="w-6 h-6 text-blue-600" />
              </div>
              <div className="flex-1 text-left">
                <h4 className="font-semibold text-gray-900">Browse from Computer</h4>
                <p className="text-sm text-gray-600">Select an image file from your device</p>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
