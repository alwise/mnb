'use client';

import { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { Input } from './ui';

interface AutocompleteInputProps<T = string> {
  value: string;
  onChange: (value: string) => void;
  onSelect?: (item: T) => void;
  fetchSuggestions: (query: string) => Promise<T[]>;
  getDisplayValue: (item: T) => string;
  getItemValue?: (item: T) => string;
  placeholder?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  minChars?: number;
}

export default function AutocompleteInput<T = string>({
  value,
  onChange,
  onSelect,
  fetchSuggestions,
  getDisplayValue,
  getItemValue,
  placeholder,
  className = '',
  required = false,
  disabled = false,
  minChars = 1,
}: AutocompleteInputProps<T>) {
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (value.length >= minChars && !disabled) {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(async () => {
        setLoading(true);
        try {
          const results = await fetchSuggestions(value);
          setSuggestions(results);
          setShowSuggestions(results.length > 0);
          setSelectedIndex(-1);
        } catch (error) {
          console.error('Error fetching suggestions:', error);
          setSuggestions([]);
          setShowSuggestions(false);
        } finally {
          setLoading(false);
        }
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, minChars, disabled, fetchSuggestions]);

  const handleSelect = (item: T) => {
    const displayValue = getDisplayValue(item);
    onChange(displayValue);
    if (onSelect) {
      onSelect(item);
    }
    setShowSuggestions(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) {
      if (e.key === 'Enter') {
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSelect(suggestions[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleBlur = () => {
    // Delay hiding suggestions to allow click events to fire
    setTimeout(() => {
      setShowSuggestions(false);
      setSelectedIndex(-1);
    }, 200);
  };

  const handleFocus = () => {
    if (value.length >= minChars && suggestions.length > 0) {
      setShowSuggestions(true);
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="text"
        autoCorrect='off'
        autoCapitalize='off'
        autoComplete='off'
        spellCheck={true}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        className={className}
        required={required}
        disabled={disabled}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto"
        >
          {loading && (
            <div className="px-4 py-2 text-sm text-gray-500">Loading...</div>
          )}
          {!loading &&
            suggestions.map((item, index) => (
              <div
                key={index}
                onClick={() => handleSelect(item)}
                className={`px-4 py-2 cursor-pointer text-sm ${index === selectedIndex
                  ? 'bg-blue-100 text-blue-900'
                  : 'hover:bg-gray-100 text-gray-900'
                  }`}
              >
                {getDisplayValue(item)}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
