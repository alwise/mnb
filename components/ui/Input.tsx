'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string;
  label?: string;
  helperText?: string;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', error, label, helperText, id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;
    const isPassword = type === 'password';
    const [showPassword, setShowPassword] = useState(false);
    const inputType = isPassword && showPassword ? 'text' : type;

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
            type={inputType}
            id={inputId}
            ref={ref}
            className={cn(
              'block w-full px-4 py-2.5 text-sm',
              'rounded-lg border transition-all duration-200',
              'bg-white text-gray-900',
              'placeholder:text-gray-400 placeholder:text-sm',
              'focus:outline-none focus:ring-2 focus:ring-offset-0',
              'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed disabled:border-gray-200',
              hasError
                ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20 bg-red-50/50'
                : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/20 hover:border-gray-400',
              type === 'number' && 'text-right',
              isPassword && 'pr-10',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 focus:outline-none focus:text-gray-700 transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <EyeOff className="h-5 w-5" />
              ) : (
                <Eye className="h-5 w-5" />
              )}
            </button>
          )}
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

Input.displayName = 'Input';

export default Input;
