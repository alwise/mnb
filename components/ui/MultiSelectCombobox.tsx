'use client';

import React, { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { X, ChevronDown, Check } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectComboboxProps {
  options: MultiSelectOption[];
  selectedValues: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
  disabled?: boolean;
}

export default function MultiSelectCombobox({
  options,
  selectedValues,
  onChange,
  placeholder = 'Select options...',
  label,
  className = '',
  disabled = false,
}: MultiSelectComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter options based on search query, exclude already selected options, and remove duplicates
  const filteredOptions = options
    .filter((option) => {
      // Exclude if already selected
      if (selectedValues.includes(option.value)) {
        return false;
      }
      // Filter by search query
      return option.label.toLowerCase().includes(searchQuery.toLowerCase());
    })
    // Remove duplicates by value (keep first occurrence)
    .filter((option, index, self) =>
      index === self.findIndex((o) => o.value === option.value)
    );

  // Get selected options
  const selectedOptions = options.filter((option) =>
    selectedValues.includes(option.value)
  );

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node) &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setIsOpen(true);
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (highlightedIndex > 0) {
          setHighlightedIndex((prev) => prev - 1);
        } else {
          setIsOpen(false);
        }
        break;
      case 'Enter':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          toggleOption(filteredOptions[highlightedIndex].value);
        } else if (!isOpen) {
          setIsOpen(true);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSearchQuery('');
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
      case 'Backspace':
        if (!searchQuery && selectedValues.length > 0) {
          // Remove last selected item
          onChange(selectedValues.slice(0, -1));
        }
        break;
    }
  };

  const toggleOption = (value: string) => {
    if (selectedValues.includes(value)) {
      onChange(selectedValues.filter((v) => v !== value));
    } else {
      onChange([...selectedValues, value]);
    }
    setSearchQuery('');
    setHighlightedIndex(-1);
  };

  const removeOption = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selectedValues.filter((v) => v !== value));
  };

  const handleInputFocus = () => {
    if (!disabled) {
      setIsOpen(true);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setIsOpen(true);
    setHighlightedIndex(-1);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          {label}
        </label>
      )}
      <div className="relative">
        <div
          className={`
            flex flex-wrap gap-1.5 min-h-[42px] px-3 py-2
            border rounded-lg bg-white
            transition-all duration-200
            ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'cursor-text'}
            ${isOpen
              ? 'border-blue-500 ring-2 ring-blue-500/20'
              : 'border-gray-300 hover:border-gray-400'
            }
          `}
          onClick={() => !disabled && inputRef.current?.focus()}
        >
          {/* Selected items */}
          {selectedOptions.map((option) => (
            <span
              key={option.value}
              className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 text-sm rounded-md border border-blue-200"
            >
              {option.label}
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => removeOption(option.value, e)}
                  className="hover:bg-blue-100 rounded p-0.5 transition-colors"
                  aria-label={`Remove ${option.label}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </span>
          ))}

          {/* Search input */}
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleInputFocus}
            placeholder={selectedOptions.length === 0 ? placeholder : ''}
            disabled={disabled}
            className="flex-1 min-w-[120px] outline-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400"
          />

          {/* Dropdown icon */}
          <div className="flex items-center">
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''
                }`}
            />
          </div>
        </div>

        {/* Dropdown */}
        {isOpen && !disabled && (
          <div
            ref={dropdownRef}
            className="absolute z-[9999] w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-auto"
          >
            {filteredOptions.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">
                No options found
              </div>
            ) : (
              filteredOptions.map((option, index) => {
                const isSelected = selectedValues.includes(option.value);
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={option.value}
                    onClick={() => toggleOption(option.value)}
                    className={`
                      flex items-center gap-2 px-4 py-2 cursor-pointer text-sm
                      transition-colors
                      ${isHighlighted
                        ? 'bg-blue-50 text-blue-900'
                        : 'hover:bg-gray-50 text-gray-900'
                      }
                    `}
                    onMouseEnter={() => setHighlightedIndex(index)}
                  >
                    <div
                      className={`
                        flex items-center justify-center w-4 h-4 border rounded
                        ${isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-gray-300'
                        }
                      `}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                    <span className="flex-1">{option.label}</span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
