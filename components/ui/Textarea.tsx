import React from 'react';
import { cn } from '@/lib/utils';

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
  label?: React.ReactNode;
  helperText?: string;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, label, helperText, id, ...props }, ref) => {
    const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
    const hasError = !!error;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={textareaId}
            className="block text-sm font-semibold text-gray-900 mb-1.5"
          >
            {label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        <textarea
          id={textareaId}
          ref={ref}
          className={cn(
            'block w-full px-4 py-2.5 text-sm min-h-[100px]',
            'rounded-lg border transition-all duration-200 resize-y',
            'bg-white text-gray-900',
            'placeholder:text-gray-400 placeholder:text-sm',
            'focus:outline-none focus:ring-4 focus:ring-offset-0',
            'disabled:bg-gray-50 disabled:text-gray-500 disabled:cursor-not-allowed disabled:border-gray-200',
            hasError
              ? 'border-red-400 focus:border-red-500 focus:ring-red-500/10 bg-red-50/30'
              : 'border-gray-300 focus:border-blue-500 focus:ring-blue-500/10 hover:border-gray-400',
            className
          )}
          {...props}
        />
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

Textarea.displayName = 'Textarea';

export default Textarea;
