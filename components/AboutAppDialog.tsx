'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAbout } from '@/contexts/AboutContext';
import { useTexts } from '@/hooks/useTexts';
import { isTauri } from '@/lib/utils';
import Button from './ui/Button';
import { Info, RefreshCw } from 'lucide-react';

const APP_NAME = 'MAN NO BE GOD COMPANY LIMITED';

export default function AboutAppDialog() {
  const { isOpen, closeAbout, checkForUpdates, checking } = useAbout();
  const { t } = useTexts();
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!isTauri()) {
      setVersion(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const { getVersion } = await import('@tauri-apps/api/app');
        const v = await getVersion();
        if (!cancelled) setVersion(v);
      } catch {
        if (!cancelled) setVersion(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  const handleCheckUpdates = () => {
    checkForUpdates(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/40 backdrop-blur-sm"
          onClick={closeAbout}
          aria-hidden
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-dialog-title"
        >
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <Info className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2
                  id="about-dialog-title"
                  className="text-xl font-bold text-gray-900"
                >
                  {t('about.title', 'About')}
                </h2>
                {version != null && (
                  <p className="text-sm text-gray-500">
                    {t('about.version', 'Version')} {version}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-base font-semibold text-gray-900">
                {APP_NAME}
              </p>
              <p className="text-gray-600 text-sm leading-relaxed">
                {t(
                  'about.description',
                  'Stock card and receipt management for LBA units. Create, edit, and track stock cards, manage LBA names, export to PDF, and keep your inventory organized.'
                )}
              </p>
              {version == null && isTauri() && (
                <p className="text-xs text-gray-400">
                  {t('about.versionUnavailable', 'Version info unavailable')}
                </p>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              {isTauri() && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCheckUpdates}
                  disabled={checking}
                  className="order-2 sm:order-1 inline-flex items-center"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 shrink-0 ${checking ? 'animate-spin' : ''}`}
                  />
                  {checking
                    ? t('about.checking', 'Checking...')
                    : t('about.checkForUpdates', 'Check for updates')}
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                onClick={closeAbout}
                className="order-1 sm:order-2"
              >
                {t('common.close', 'Close')}
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
