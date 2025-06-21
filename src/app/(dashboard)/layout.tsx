'use client';

import { useEffect, useState } from 'react';
import { useSimplifiedAuth } from '@/components/providers/SimplifiedAuthProvider';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

interface AppState {
  user: unknown | null;
  storeId: string | null;
  storeName: string | null;
  mode: 'online' | 'offline';
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, storeId, storeName, loading, mode } = useSimplifiedAuth();
  const [appState, setAppState] = useState<AppState>({
    user: null,
    storeId: null,
    storeName: null,
    mode: 'online'
  });

  // Update app state when auth state changes
  useEffect(() => {
    if (!loading) {
      setAppState(prev => ({
        ...prev,
        user,
        storeId,
        storeName,
        mode
      }));
    }
  }, [user, storeId, storeName, mode, loading]);

  // Handle network status changes
  useEffect(() => {
    const handleOnline = () => {
      setAppState(prev => ({ ...prev, mode: 'online' }));
    };

    const handleOffline = () => {
      setAppState(prev => ({ ...prev, mode: 'offline' }));
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
    console.log('Mode:', appState.mode);
    console.log('Network Status:', navigator.onLine);
    console.log('App State:', appState);
    console.log('✅ App state valid:', { hasUser, hasStore, mode: appState.mode });

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