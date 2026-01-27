'use client';

import { ReactNode } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import { DialogProvider } from '@/components/ui/Dialog';
import { QueryProvider } from '@/hooks/useQueryClient';

interface AppProviderProps {
  children: ReactNode;
}

/**
 * Main application provider that wraps all context providers
 * This consolidates all providers in one place for easier management
 */
export function AppProvider({ children }: AppProviderProps) {
  return (
    <QueryProvider>
      <AuthProvider>
        <DialogProvider>
          {children}
        </DialogProvider>
      </AuthProvider>
    </QueryProvider>
  );
}
