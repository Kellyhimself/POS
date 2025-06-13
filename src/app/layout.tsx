'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/providers/AuthProvider';
import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useGlobalProductCache } from '@/lib/hooks/useGlobalProductCache';
import { useGlobalSaleSync } from '@/lib/hooks/useGlobalSaleSync';
import { useGlobalProductSync } from '@/lib/hooks/useGlobalProductSync';
import * as React from 'react';

const inter = Inter({ subsets: ['latin'] });

function RootLayoutContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();

  const productSync = useGlobalProductSync();
  const saleSync = useGlobalSaleSync();
  const productCache = useGlobalProductCache();

  React.useEffect(() => {
    if (!loading && user?.user_metadata?.store_id) {
      console.log('🔍 Auth ready for sync', {
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
    if ('serviceWorker' in navigator) {
      // Only handle development mode cleanup
      if (process.env.NODE_ENV === 'development') {
        const cleanupSW = async () => {
          try {
            const registrations = await navigator.serviceWorker.getRegistrations();
            for (const registration of registrations) {
              await registration.unregister();
              console.log('🗑️ Unregistered service worker:', registration.scope);
            }
            await caches.keys().then((keys) =>
              Promise.all(keys.map((key) => caches.delete(key)))
            );
            console.log('🗑️ Cleared all caches in development');
          } catch (error) {
            console.error('❌ Service Worker cleanup failed:', error);
          }
        };
        cleanupSW();
      }

      // Add service worker lifecycle event listeners
      const handleServiceWorkerEvents = () => {
        // Log when a new service worker is installing
        navigator.serviceWorker.addEventListener('install', (event) => {
          console.log('📦 next-pwa Service Worker installing...', event);
        });

        // Log when a service worker is activated
        navigator.serviceWorker.addEventListener('activate', (event) => {
          console.log('✅ next-pwa Service Worker activated', event);
        });

        // Log when a service worker is controlling the page
        navigator.serviceWorker.addEventListener('controllerchange', (event) => {
          console.log('🎮 next-pwa Service Worker controlling the page', event);
        });

        // Log when a service worker receives a message
        navigator.serviceWorker.addEventListener('message', (event) => {
          console.log('📨 next-pwa Service Worker message received:', event.data);
        });

        // Log when a service worker encounters an error
        navigator.serviceWorker.addEventListener('error', (event) => {
          console.error('❌ next-pwa Service Worker error:', event);
        });

        // Log the current service worker state
        if (navigator.serviceWorker.controller) {
          console.log('🔍 Current next-pwa Service Worker state:', {
            controller: navigator.serviceWorker.controller.state,
            scope: navigator.serviceWorker.controller.scope,
          });
        }
      };

      handleServiceWorkerEvents();
    } else {
      console.log('⚠️ Service Worker not supported');
    }
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
        <link rel="manifest" href="/pos/manifest.json" />
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