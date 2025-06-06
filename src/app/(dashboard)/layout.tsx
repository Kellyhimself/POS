'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

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
    isOnline: true
  });

  useEffect(() => {
    const updateAppState = () => {
      setAppState({
        user,
        storeId,
        storeName,
        isOnline
      });
    };

    updateAppState();
  }, [user, storeId, storeName, isOnline]);

  const isValidAppState = () => {
    const hasUser = !!appState.user;
    const hasStore = !!appState.storeId;
    const isStateValid = hasUser && hasStore;

    console.log('=== RootLayout State Update ===');
    console.log('Loading:', loading);
    console.log('Online:', isOnline);
    console.log('Network Status:', navigator.onLine);
    console.log('App State:', appState);
    console.log('✅ App state valid:', { hasUser, hasStore, isOnline: appState.isOnline });

    return isStateValid;
  };

  useEffect(() => {
    if (!loading) {
      if (!isValidAppState()) {
        // Only redirect if we're not already on the login page
        if (!window.location.pathname.startsWith('/login')) {
          router.push('/login');
        }
      }
    }
  }, [loading, appState, router]);

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
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
} 