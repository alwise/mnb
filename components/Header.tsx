'use client';

import { useRouter, usePathname } from 'next/navigation';
import { ArrowLeft, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState, useRef } from 'react';
import { getUserProfilePhotoDataUrl } from '@/lib/auth';
import { getCompanyLogoDataUrl } from '@/lib/company';
import Image from 'next/image';

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function loadLogo() {
      const logo = await getCompanyLogoDataUrl();
      setLogoUrl(logo);
    }
    loadLogo();
  }, []);

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

  const handleProfileClick = () => {
    setIsDropdownOpen(false);
    router.push('/profile');
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
          {canGoBack && (
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-gray-100 rounded-md transition-colors"
              aria-label="Go back"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
          )}
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
