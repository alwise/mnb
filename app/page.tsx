'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTexts } from '@/hooks/useTexts';

export default function Home() {
  const router = useRouter();
  const { t } = useTexts();

  useEffect(() => {
    router.push('/dashboard');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-2xl font-bold mb-4">{t('common.appName', 'MAN NO BE GOD COMPANY LIMITED')}</h1>
        <p className="text-gray-600">{t('common.loading', 'Loading...')}</p>
      </div>
    </div>
  );
}
