import React from 'react';
import { cn } from '@/lib/utils';

export interface FileInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  error?: string;
  label?: string;
  helperText?: string;
  accept?: string;
}

const FileInput = React.forwardRef<HTMLInputElement, FileInputProps>(
  ({ className, error, label, helperText, id, accept, ...props }, ref) => {
    const inputId = id || `file-input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-semibold text-gray-900 mb-1.5"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <div className="relative">
          <input
            type="file"
            id={inputId}
            ref={ref}
            accept={accept}
            className={cn(
              'block w-full text-sm',
              'px-4 py-2.5 rounded-lg border transition-all duration-200',
              'bg-white',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              hasError
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/50'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 hover:border-gray-400',
              'file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0',
              'file:text-sm file:font-semibold file:cursor-pointer',
              'file:bg-blue-600 file:text-white file:transition-all',
              'hover:file:bg-blue-700 file:shadow-sm',
              'file:active:bg-blue-800',
              className
            )}
            {...props}
          />
        </div>
        {error && (
          <p className="mt-2 text-sm font-medium text-red-600 flex items-center gap-1">
            <span>⚠</span>
            <span>{error}</span>
          </p>
        )}
        {helperText && !error && (
          <p className="mt-2 text-xs text-gray-500 leading-relaxed">{helperText}</p>
        )}
      </div>
    );
  }
);

FileInput.displayName = 'FileInput';

export default FileInput;
