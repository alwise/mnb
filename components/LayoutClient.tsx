'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { AboutProvider } from '@/contexts/AboutContext';
import Header from '@/components/Header';
import Sidebar from '@/components/Sidebar';
import AboutAppDialog from '@/components/AboutAppDialog';
import { useUpdater } from '@/hooks/useUpdater';
import { ScrollView } from '@/components/ui';

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { checkForUpdates, checking } = useUpdater();

  // Pages that don't need sidebar/header or authentication
  const authPages = ['/login', '/signup', '/forgot-password', '/reset-password'];
  const isAuthPage = authPages.includes(pathname);

  // Redirect to login if user is not authenticated and not on auth pages
  useEffect(() => {
    if (!loading && !user && !isAuthPage) {
      // Check if there's a stale session in localStorage
      const userId = typeof window !== 'undefined' ? localStorage.getItem('current_user_id') : null;
      if (userId) {
        // Clear stale session
        localStorage.removeItem('current_user_id');
      }
      router.push('/login');
    }
  }, [user, loading, isAuthPage, router]);

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated and not on auth page, show nothing (redirect will happen)
  if (!user && !isAuthPage) {
    return null;
  }

  // Auth pages don't need sidebar/header
  if (isAuthPage) {
    return <>{children}</>;
  }

  // Protected pages with sidebar/header
  return (
    <AboutProvider checkForUpdates={checkForUpdates} checking={checking}>
      <div className="flex flex-col h-screen overflow-hidden">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 bg-gray-50 ml-64 pt-16 flex flex-col overflow-hidden">
            <ScrollView>
              {children}
            </ScrollView>
          </main>
        </div>
      </div>
      <AboutAppDialog />
    </AboutProvider>
  );
}
