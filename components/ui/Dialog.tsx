'use client';
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Button from './Button';

interface DialogContextType {
  showAlert: (message: string, title?: string) => Promise<void>;
  showConfirm: (message: string, title?: string) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('useDialog must be used within DialogProvider');
  }
  return context;
}

interface DialogProviderProps {
  children: ReactNode;
}

interface AlertState {
  isOpen: boolean;
  message: string;
  title?: string;
  resolve?: () => void;
}

interface ConfirmState {
  isOpen: boolean;
  message: string;
  title?: string;
  resolve?: (value: boolean) => void;
}

export function DialogProvider({ children }: DialogProviderProps) {
  const [alertState, setAlertState] = useState<AlertState>({
    isOpen: false,
    message: '',
  });
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    isOpen: false,
    message: '',
  });

  const showAlert = useCallback((message: string, title?: string): Promise<void> => {
    return new Promise((resolve) => {
      setAlertState({
        isOpen: true,
        message,
        title,
        resolve: () => {
          setAlertState((prev) => ({ ...prev, isOpen: false }));
          resolve();
        },
      });
    });
  }, []);

  const showConfirm = useCallback((message: string, title?: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmState({
        isOpen: true,
        message,
        title,
        resolve: (value: boolean) => {
          setConfirmState((prev) => ({ ...prev, isOpen: false }));
          resolve(value);
        },
      });
    });
  }, []);

  const handleAlertClose = useCallback(() => {
    alertState.resolve?.();
  }, [alertState]);

  const handleConfirmYes = useCallback(() => {
    confirmState.resolve?.(true);
  }, [confirmState]);

  const handleConfirmNo = useCallback(() => {
    confirmState.resolve?.(false);
  }, [confirmState]);

  return (
    <DialogContext.Provider value={{ showAlert, showConfirm }}>
      {children}

      <AnimatePresence mode="wait">
        {/* Alert Dialog */}
        {alertState.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={handleAlertClose}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {alertState.title && (
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {alertState.title}
                  </h3>
                )}
                <div className="mb-8">
                  <p className="text-gray-600 leading-relaxed">
                    {alertState.message}
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleAlertClose} variant="primary" className="px-8">
                    Close
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Confirm Dialog */}
        {confirmState.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm"
              onClick={handleConfirmNo}
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                {confirmState.title && (
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {confirmState.title}
                  </h3>
                )}
                <div className="mb-8">
                  <p className="text-gray-600 leading-relaxed">
                    {confirmState.message}
                  </p>
                </div>
                <div className="flex justify-end gap-3">
                  <Button onClick={handleConfirmNo} variant="outline" className="flex-1 sm:flex-none">
                    Cancel
                  </Button>
                  <Button onClick={handleConfirmYes} variant="danger" className="flex-1 sm:flex-none">
                    Confirm
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DialogContext.Provider>
  );
}
