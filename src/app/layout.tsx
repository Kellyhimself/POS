'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/providers/AuthProvider';
import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { ModeIndicator } from '@/components/ui/ModeIndicator';
import { SettingsProvider } from '@/components/providers/SettingsProvider';
import { UnifiedServiceProvider } from '@/components/providers/UnifiedServiceProvider';
import { getUnifiedService } from '@/lib/services/UnifiedService';
import { getModeManager } from '@/lib/mode/ModeManager';

import * as React from 'react';

const inter = Inter({ subsets: ['latin'] });

function RootLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Initialize unified service and mode manager
  React.useEffect(() => {
    const modeManager = getModeManager();
    getUnifiedService(modeManager);
    
    console.log('🔧 Unified Service initialized:', {
      currentMode: modeManager.getCurrentMode(),
      isOnline: modeManager.isOnlineMode(),
      isOffline: modeManager.isOfflineMode(),
    });
  }, []);

  React.useEffect(() => {
    if (!loading && user?.user_metadata?.store_id) {
      console.log('🔍 Auth ready for unified service', {
        storeId: user.user_metadata.store_id,
        isOnline: navigator.onLine,
      });
    }
  }, [loading, user]);

  React.useEffect(() => {
    console.log('📋 App State:', {
      user: user ? 'Logged in' : 'Not logged in',
      path: pathname,
      storeId: user?.user_metadata?.store_id,
      loading,
      isOnline: navigator.onLine,
    });
  }, [user, pathname, loading]);

  React.useEffect(() => {
    const handleOnline = () => console.log('🌐 App is online');
    const handleOffline = () => console.log('⚠️ App is offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (loading) {
    return null;
  }

  if (pathname === '/login') {
    return <>{children}</>;
  }

  return <>{children}</>;
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('✅ Service Worker registered:', registration.scope);
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                console.log('🔄 Service Worker state:', newWorker.state);
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('🔄 New service worker installed, reloading...');
                  window.location.reload();
                }
              });
            }
          });
        })
        .catch((error) => {
          console.error('❌ Service Worker registration failed:', error);
        });
    }
  }, []);

  return (
    <html lang="en">
      <head>
        <meta name="application-name" content="BMS" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="BMS" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0ABAB5" />
        <meta name="description" content="Business Management System - Point of Sale and Inventory Management" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <meta name="msapplication-TileColor" content="#0ABAB5" />
        <meta name="msapplication-TileImage" content="/icons/icon-144x144.png" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
        <link rel="mask-icon" href="/icons/safari-pinned-tab.svg" color="#0ABAB5" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <UnifiedServiceProvider>
            <SettingsProvider>
              <ModeIndicator />
              <ReactQueryProvider>
                <RootLayoutContent>{children}</RootLayoutContent>
                <Toaster />
              </ReactQueryProvider>
            </SettingsProvider>
          </UnifiedServiceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}