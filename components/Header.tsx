'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, User, Settings, LogOut, ChevronDown, Info } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAbout } from '@/contexts/AboutContext';
import { useEffect, useState, useRef } from 'react';
import { getUserProfilePhotoDataUrl } from '@/lib/auth';
import { getCompanyLogoDataUrl } from '@/lib/company';
import { useTexts } from '@/hooks/useTexts';
import Image from 'next/image';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { QUERY_KEYS } from '@/lib/queryKeys';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { openAbout } = useAbout();
  const { t } = useTexts();
  // const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: logoUrl } = useQuery<string | null>({
    queryKey: QUERY_KEYS.settings.companyLogo,
    queryFn: getCompanyLogoDataUrl,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    retry: true,
    retryDelay: 20000, // 20 seconds
  });

  // useEffect(() => {
  //   async function loadLogo() {
  //     const logo = await getCompanyLogoDataUrl();
  //     setLogoUrl(logo);
  //   }
  //   loadLogo();
  // }, []);

  useEffect(() => {
    async function loadAvatar() {
      if (user?.id) {
        const avatar = await getUserProfilePhotoDataUrl(user.id);
        setAvatarUrl(avatar);
      }
    }
    loadAvatar();
  }, [user]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    }

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const canGoBack = pathname !== '/dashboard' && pathname !== '/login' && pathname !== '/signup';

  const getPageTitle = () => {
    if (pathname === '/dashboard') return t('nav.dashboard');
    if (pathname === '/receipts') return t('receiptList.title');
    if (pathname.includes('/receipts/create')) return t('nav.createReceipt');
    if (pathname.includes('/receipts/view')) return t('receipts.viewReceipt');
    if (pathname.includes('/receipts/edit')) return t('receipts.editReceipt');
    if (pathname === '/profile') return t('nav.settings');
    if (pathname === '/data-management') return t('profile.dataManagement');
    return '';
  };

  const pageTitle = getPageTitle();

  const handleProfileClick = () => {
    setIsDropdownOpen(false);
    router.push('/profile');
  };

  const handleAboutClick = () => {
    setIsDropdownOpen(false);
    openAbout();
  };

  const handleLogoutClick = () => {
    setIsDropdownOpen(false);
    logout();
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 shadow-sm z-50">
      <div className="h-full flex items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left side: Logo and Back button */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => canGoBack && router.back()}
            disabled={!canGoBack}
            className="p-2 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-40 disabled:pointer-events-none disabled:hover:bg-transparent"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          {logoUrl ? (
            <div className="h-10 w-10 relative">
              <Image
                src={logoUrl}
                alt="Company Logo"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          ) : (
            <div className="h-10 w-10 bg-gray-200 rounded flex items-center justify-center">
              <span className="text-xs text-gray-500">Logo</span>
            </div>
          )}

          {pageTitle && (
            <div className="flex items-center">
              <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block" />
              <h1 className="text-lg font-semibold text-gray-900 truncate max-w-[150px] sm:max-w-[300px] lg:max-w-none ml-2">
                {pageTitle}
              </h1>
            </div>
          )}
        </div>

        {/* Right side: User avatar dropdown */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-2 p-2 hover:bg-gray-100 rounded-md transition-colors"
                aria-label="User menu"
                aria-expanded={isDropdownOpen}
              >
                {avatarUrl ? (
                  <div className="h-8 w-8 relative rounded-full overflow-hidden">
                    <Image
                      src={avatarUrl}
                      alt={user.full_name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center">
                    <User className="h-5 w-5 text-white" />
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700 hidden sm:block">
                  {user.full_name}
                </span>
                <ChevronDown className={`h-4 w-4 text-gray-600 hidden sm:block transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  <div className="py-1">
                    <button
                      onClick={handleProfileClick}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Settings</span>
                    </button>
                    <button
                      onClick={handleAboutClick}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                    >
                      <Info className="h-4 w-4" />
                      <span>{t('about.menuItem', 'About')}</span>
                    </button>
                    <div className="border-t border-gray-200 my-1"></div>
                    <button
                      onClick={handleLogoutClick}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
              <User className="h-5 w-5 text-gray-600" />
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
