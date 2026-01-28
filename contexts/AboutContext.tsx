'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AboutContextType {
  isOpen: boolean;
  openAbout: () => void;
  closeAbout: () => void;
  checkForUpdates: (silent?: boolean) => Promise<void>;
  checking: boolean;
}

const AboutContext = createContext<AboutContextType | undefined>(undefined);

export function useAbout() {
  const context = useContext(AboutContext);
  if (!context) {
    throw new Error('useAbout must be used within AboutProvider');
  }
  return context;
}

interface AboutProviderProps {
  children: ReactNode;
  checkForUpdates: (silent?: boolean) => Promise<void>;
  checking: boolean;
}

export function AboutProvider({ children, checkForUpdates, checking }: AboutProviderProps) {
  const [isOpen, setIsOpen] = useState(false);

  const openAbout = useCallback(() => setIsOpen(true), []);
  const closeAbout = useCallback(() => setIsOpen(false), []);

  return (
    <AboutContext.Provider
      value={{ isOpen, openAbout, closeAbout, checkForUpdates, checking }}
    >
      {children}
    </AboutContext.Provider>
  );
}
