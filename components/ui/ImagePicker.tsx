import React, { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { Upload, X, Camera } from 'lucide-react';
import CameraCapture from './CameraCapture';
import ImageSourceDialog from './ImageSourceDialog';

export interface ImagePickerProps {
  value?: string | null; // Data URL or image URL
  onChange?: (file: File | null) => void;
  onRemove?: () => void;
  accept?: string; // Always defaults to 'image/*' - only images are accepted
  disabled?: boolean;
  label?: string | React.ReactNode;
  helperText?: string;
  error?: string;
  className?: string;
  previewClassName?: string;
  pickerClassName?: string;
  size?: 'sm' | 'md' | 'lg' | 'custom';
  aspectRatio?: 'square' | 'wide' | 'auto';
  showRemoveButton?: boolean;
  placeholder?: React.ReactNode;
  onError?: (error: string) => void; // Callback for validation errors
  enableCamera?: boolean; // Enable camera capture option
  defaultFacingMode?: 'user' | 'environment'; // Default camera facing mode
}

const sizeClasses = {
  sm: 'h-16 w-16',
  md: 'h-20 w-20',
  lg: 'h-32 w-32',
  custom: '',
};

const aspectRatioClasses = {
  square: 'aspect-square',
  wide: 'aspect-[4/3]',
  auto: '',
};

const ImagePicker = React.forwardRef<HTMLInputElement, ImagePickerProps>(
  (
    {
      value,
      onChange,
      onRemove,
      accept = 'image/*',
      disabled = false,
      label,
      helperText,
      error,
      className,
      previewClassName,
      pickerClassName,
      size = 'md',
      aspectRatio = 'square',
      showRemoveButton = true,
      placeholder,
      onError,
      enableCamera = false,
      defaultFacingMode = 'environment',
      ...props
    },
    ref
  ) => {
    const [preview, setPreview] = React.useState<string | null>(value || null);
    const [validationError, setValidationError] = React.useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [showSourceDialog, setShowSourceDialog] = useState(false);

    // Sync preview with value prop
    useEffect(() => {
      setPreview(value || null);
    }, [value]);

    const handleFileSelect = useCallback(
      (file: File) => {
        // Validate file type - only images are accepted
        if (!file.type.startsWith('image/')) {
          const errorMsg = 'Please select an image file. Only image files are supported.';
          setValidationError(errorMsg);
          onError?.(errorMsg);
          return;
        }

        // Clear any previous errors
        setValidationError(null);

        // Create preview
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          setPreview(dataUrl);
        };
        reader.onerror = () => {
          const errorMsg = 'Failed to read image file. Please try again.';
          setValidationError(errorMsg);
          onError?.(errorMsg);
        };
        reader.readAsDataURL(file);

        onChange?.(file);
      },
      [onChange, onError]
    );

    const onDrop = useCallback(
      (acceptedFiles: File[], rejectedFiles: any[]) => {
        if (rejectedFiles.length > 0) {
          const errorMsg = 'Please select an image file. Only image files are supported.';
          setValidationError(errorMsg);
          onError?.(errorMsg);
          return;
        }

        if (acceptedFiles.length > 0) {
          handleFileSelect(acceptedFiles[0]);
        }
      },
      [handleFileSelect, onError]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
      onDrop,
      accept: {
        'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']
      },
      disabled,
      multiple: false,
      noClick: false,
      noKeyboard: false,
    });

    const handleRemove = (e: React.MouseEvent) => {
      e.stopPropagation();
      setPreview(null);
      setValidationError(null);
      onChange?.(null);
      onRemove?.();
    };

    const handleCameraCapture = (file: File) => {
      handleFileSelect(file);
    };

    const handleFileInputClick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) {
          handleFileSelect(file);
        }
      };
      input.click();
    };

    const hasError = !!error || !!validationError;
    const displayError = error || validationError;
    const sizeClass = size === 'custom' ? '' : sizeClasses[size];
    const aspectClass = aspectRatioClasses[aspectRatio];

    // Merge refs
    const inputProps = getInputProps({
      ...props,
    });

    return (
      <>
        <div className={cn('w-full', className)}>
          {label && (
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {label}
            </label>
          )}

          <div className="relative">
            {/* Dropzone area */}
            <div
              {...getRootProps()}
              className={cn(
                'relative border-2 border-dashed rounded-lg transition-all cursor-pointer',
                'flex items-center justify-center overflow-hidden',
                sizeClass,
                aspectClass,
                hasError
                  ? 'border-red-400 bg-red-50/50'
                  : isDragActive
                    ? 'border-blue-600 bg-blue-100 shadow-xl scale-[1.02] ring-2 ring-blue-300 ring-opacity-50'
                    : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100',
                disabled && 'opacity-50 cursor-not-allowed',
                preview && !isDragActive && 'border-solid border-gray-300 bg-white',
                pickerClassName
              )}
            >
              <input {...inputProps} />

              {preview ? (
                <>
                  <div className={cn('relative w-full h-full', previewClassName)}>
                    <Image
                      src={preview}
                      alt="Preview"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>
                  {showRemoveButton && !disabled && (
                    <button
                      type="button"
                      onClick={handleRemove}
                      className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-sm z-10"
                      aria-label="Remove image"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                  {!disabled && (
                    <div className={cn(
                      "absolute inset-0 transition-all flex items-center justify-center",
                      isDragActive
                        ? "bg-blue-500/20 opacity-100"
                        : "bg-black/0 hover:bg-black/5 opacity-0 hover:opacity-100"
                    )}>
                      <div className={cn(
                        "transition-all",
                        isDragActive ? "opacity-100" : "opacity-0"
                      )}>
                        <div className="p-2 bg-blue-600 rounded-full shadow-lg">
                          <Upload className="h-5 w-5 text-white" />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center p-6 text-center w-full h-full group">
                  {placeholder || (
                    <>
                      <div className={cn(
                        "mb-3 p-3 rounded-full transition-all duration-200",
                        isDragActive
                          ? "bg-blue-200 scale-125 shadow-lg"
                          : "bg-blue-50 group-hover:bg-blue-100"
                      )}>
                        <Upload className={cn(
                          "h-6 w-6 transition-all duration-200",
                          isDragActive
                            ? "text-blue-800 scale-110"
                            : "text-blue-600 group-hover:text-blue-700"
                        )} />
                      </div>
                      <p className={cn(
                        "text-sm font-medium mb-1 transition-colors duration-200",
                        isDragActive
                          ? "text-blue-800 font-semibold"
                          : "text-gray-700 group-hover:text-gray-900"
                      )}>
                        {isDragActive ? 'Drop image here' : 'Click to upload image'}
                      </p>
                      <p className={cn(
                        "text-xs transition-colors duration-200",
                        isDragActive
                          ? "text-blue-700 font-medium"
                          : "text-gray-500 group-hover:text-gray-600"
                      )}>
                        {isDragActive ? 'Release to upload' : 'or drag and drop here'}
                      </p>
                    </>
                  )}
                </div>
              )}
              {/* Camera Button */}
              {enableCamera && !disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSourceDialog(true);
                  }}
                  className="absolute bottom-2 right-2 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors shadow-lg z-10"
                  title="Take photo with camera or upload"
                >
                  <Camera className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {displayError && (
            <p className="mt-2 text-sm font-medium text-red-600 flex items-center gap-1">
              <span>⚠</span>
              <span>{displayError}</span>
            </p>
          )}
          {helperText && !displayError && (
            <p className="mt-2 text-xs text-gray-500 leading-relaxed">{helperText}</p>
          )}
        </div>

        {/* Image Source Dialog */}
        {enableCamera && (
          <ImageSourceDialog
            isOpen={showSourceDialog}
            onClose={() => setShowSourceDialog(false)}
            onSelectCamera={() => {
              setShowSourceDialog(false);
              setShowCamera(true);
            }}
            onSelectUpload={() => {
              setShowSourceDialog(false);
              handleFileInputClick();
            }}
            title="Select Image Source"
          />
        )}

        {/* Camera Capture Modal */}
        {enableCamera && (
          <CameraCapture
            isOpen={showCamera}
            onClose={() => setShowCamera(false)}
            onCapture={handleCameraCapture}
            facingMode={defaultFacingMode}
            enableCrop={true}
          />
        )}
      </>
    );
  }
);

ImagePicker.displayName = 'ImagePicker';

export default ImagePicker;
