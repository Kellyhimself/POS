'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AppState {
  user: unknown | null;
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
  const [appState, setAppState] = useState<AppState>({
    user: null,
    storeId: null,
    storeName: null,
    isOnline: navigator.onLine
  });

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

    console.log('=== DashboardLayout State Update ===');
    console.log('Loading:', loading);
    console.log('Online:', appState.isOnline);
    console.log('Network Status:', navigator.onLine);
    console.log('App State:', appState);
    console.log('✅ App state valid:', { hasUser, hasStore, isOnline: appState.isOnline });

    return isStateValid;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Let middleware handle redirects, just show loading state if invalid
  if (!isValidAppState()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Just render children - the layout structure is handled in root layout
  return <>{children}</>;
} 