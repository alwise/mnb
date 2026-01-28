'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTexts } from '@/hooks/useTexts';

export default function Navigation() {
  const pathname = usePathname();
  const { t } = useTexts();

  const navItems = [
    { href: '/dashboard', label: t('nav.dashboard') },
    { href: '/receipts/create', label: t('nav.createReceipt') },
    { href: '/receipts', label: t('nav.receiptList') },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-gray-900">{t('nav.companyName')}</h1>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${pathname === item.href
                      ? 'border-blue-500 text-gray-900'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
