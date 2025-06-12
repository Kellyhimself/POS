'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ReactQueryProvider } from '@/components/providers/ReactQueryProvider';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useGlobalProductCache } from '@/lib/hooks/useGlobalProductCache';
import { useGlobalSaleSync } from '@/lib/hooks/useGlobalSaleSync';
import { useGlobalProductSync } from '@/lib/hooks/useGlobalProductSync';
import * as React from 'react';

// Structured logging utility
const logger = {
  info: (category: string, message: string, data?: any) =>
    console.debug(`[${new Date().toISOString()}] [${category}] ${message}`, data),
  error: (category: string, message: string, error?: any) =>
    console.error(`[${new Date().toISOString()}] [${category}] ${message}`, error),
};

const inter = Inter({
  subsets: ['latin'],
  // Fallback to system fonts if Google Fonts fail
  fallback: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
});

function RootLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Initialize hooks
  useGlobalProductSync();
  useGlobalSaleSync();
  useGlobalProductCache();

  // Monitor online/offline status
  const [isOnline, setIsOnline] = React.useState(true);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      logger.info('NETWORK', 'App is online');
    };
    const handleOffline = () => {
      setIsOnline(false);
      logger.info('NETWORK', 'App is offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Log auth and sync readiness
  React.useEffect(() => {
    if (!loading && user?.user_metadata?.store_id) {
      logger.info('AUTH', 'Auth ready for sync', {
        storeId: user.user_metadata.store_id,
        isOnline,
      });
    }
  }, [loading, user, isOnline]);

  // Log app state
  React.useEffect(() => {
    logger.info('APP', 'State update', {
      user: user ? 'Logged in' : 'Not logged in',
      path: pathname,
      storeId: user?.user_metadata?.store_id,
      loading,
      isOnline,
    });
  }, [user, pathname, loading, isOnline]);

  if (loading) {
    return null;
  }

  // Don't show layout for auth pages
  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Offline fallback UI
  if (!isOnline && !navigator.serviceWorker.controller) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold">Offline Mode</h1>
        <p>You're offline and no cached data is available. Please check your connection.</p>
      </div>
    );
  }

  return <>{children}</>;
}

// Service worker registration (moved to a separate file in production)
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (registration) {
          logger.info('SW', 'ServiceWorker already registered', { scope: registration.scope });
          return;
        }

        const newRegistration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
          updateViaCache: 'none',
        });

        logger.info('SW', 'ServiceWorker registration successful', { scope: newRegistration.scope });

        // Handle updates
        newRegistration.addEventListener('updatefound', () => {
          const newWorker = newRegistration.installing;
          logger.info('SW', 'Update found');

          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              logger.info('SW', 'State changed', { state: newWorker.state });
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                logger.info('SW', 'New version available');
                // Notify user of update (e.g., via Toaster)
                // toast('New app version available! Refresh to update.');
              }
            });
          }
        });
      } catch (error) {
        logger.error('SW', 'ServiceWorker registration failed', error);
      }
    });
  } else {
    logger.info('SW', 'Service Workers not supported');
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Register service worker on mount
  React.useEffect(() => {
    registerServiceWorker();
  }, []);

  return (
    <html lang="en">
      <head>
        <meta name="application-name" content="POS System" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="POS" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0ABAB5" />
        <meta name="description" content="Point of Sale and Inventory Management System" />
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
          <ReactQueryProvider>
            <RootLayoutContent>{children}</RootLayoutContent>
            <Toaster />
          </ReactQueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
