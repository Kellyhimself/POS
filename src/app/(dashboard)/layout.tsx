'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { cn } from '@/lib/utils';

interface AppState {
  user: any | null;
  storeId: string | null;
  storeName: string | null;
  isOnline: boolean;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, storeId, storeName, loading, isOnline } = useAuth();
  const router = useRouter();
  const [appState, setAppState] = useState<AppState>({
    user: null,
    storeId: null,
    storeName: null,
    isOnline: navigator.onLine
  });
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Listen for sidebar state changes
  useEffect(() => {
    const handleStorageChange = () => {
      const preference = localStorage.getItem('sidebarPreference');
      setSidebarOpen(preference === 'open');
    };

    // Initial check
    handleStorageChange();

    // Listen for changes from other tabs/windows
    window.addEventListener('storage', handleStorageChange);

    // Listen for changes from the current window
    const handleCustomEvent = (e: CustomEvent) => {
      setSidebarOpen(e.detail === 'open');
    };
    window.addEventListener('sidebarChange', handleCustomEvent as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('sidebarChange', handleCustomEvent as EventListener);
    };
  }, []);

  // Update app state when auth state changes
  useEffect(() => {
    if (!loading) {
      setAppState(prev => ({
        ...prev,
        user,
        storeId,
        storeName,
        isOnline
      }));
    }
  }, [user, storeId, storeName, isOnline, loading]);

  // Handle network status changes
  useEffect(() => {
    const handleOnline = () => {
      setAppState(prev => ({ ...prev, isOnline: true }));
    };

    const handleOffline = () => {
      setAppState(prev => ({ ...prev, isOnline: false }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const isValidAppState = () => {
    const hasUser = !!appState.user;
    const hasStore = !!appState.storeId;
    const isStateValid = hasUser && hasStore;

    console.log('=== RootLayout State Update ===');
    console.log('Loading:', loading);
    console.log('Online:', appState.isOnline);
    console.log('Network Status:', navigator.onLine);
    console.log('App State:', appState);
    console.log('✅ App state valid:', { hasUser, hasStore, isOnline: appState.isOnline });

    return isStateValid;
  };

  // Handle redirection only after loading is complete
  useEffect(() => {
    if (!loading && !isValidAppState()) {
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/login')) {
        console.log('🔄 Setting redirect flag due to invalid state');
        setShouldRedirect(true);
      }
    }
  }, [loading, appState]);

  // Handle actual redirection in a separate effect
  useEffect(() => {
    if (shouldRedirect) {
      console.log('🔄 Redirecting to login due to invalid state');
      router.push('/login');
      setShouldRedirect(false);
    }
  }, [shouldRedirect, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (!isValidAppState()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Redirecting to login...</h2>
          <p className="text-gray-600">Please wait while we redirect you.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar />
      <div className={cn(
        "flex-1 transition-all duration-300",
        sidebarOpen ? "lg:ml-64" : "lg:ml-20"
      )}>
        <Navbar isOnline={isOnline} storeName={storeName || undefined} />
        <main className="pt-16 p-8">
          {children}
        </main>
      </div>
    </div>
  );
} 