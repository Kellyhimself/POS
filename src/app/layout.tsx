'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/providers/AuthProvider';
import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { useGlobalProductCache } from '@/lib/hooks/useGlobalProductCache';
import { useGlobalSaleSync } from '@/lib/hooks/useGlobalSaleSync';
import { useGlobalProductSync } from '@/lib/hooks/useGlobalProductSync';
import * as React from 'react';

const inter = Inter({ subsets: ['latin'] });

function RootLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Initialize hooks at the top level (unchanged)
  useGlobalProductSync();
  useGlobalSaleSync();
  useGlobalProductCache();

  // Log when auth is ready and sync should start (unchanged)
  React.useEffect(() => {
    if (!loading && user?.user_metadata?.store_id) {
      console.log('🔄 Auth ready for sync', {
        storeId: user.user_metadata.store_id,
        isOnline: navigator.onLine
      });
    }
  }, [loading, user]);

  // Log app state for debugging (unchanged)
  React.useEffect(() => {
    console.log('App State:', {
      user: user ? 'Logged in' : 'Not logged in',
      path: pathname,
      storeId: user?.user_metadata?.store_id,
      loading
    });
  }, [user, pathname, loading]);

  if (loading) {
    return null;
  }

  // Don't show layout for auth pages (unchanged)
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return <>{children}</>;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
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
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if (typeof window !== 'undefined') {
                window.addEventListener('load', async () => {
                  if ('serviceWorker' in navigator) {
                    try {
                      // Unregister old service workers to avoid conflicts
                      const registrations = await navigator.serviceWorker.getRegistrations();
                      for (let registration of registrations) {
                        if (registration.scope !== window.location.origin + '/') {
                          await registration.unregister();
                          console.log('Unregistered old service worker:', registration.scope);
                        }
                      }

                      // Check if service worker is already registered
                      const registration = await navigator.serviceWorker.getRegistration('/');
                      if (registration) {
                        console.log('ServiceWorker already registered with scope:', registration.scope);
                        registration.update();
                        return;
                      }

                      // Register new service worker
                      const newRegistration = await navigator.serviceWorker.register('/sw.js', {
                        scope: '/',
                        updateViaCache: 'none'
                      });
                      console.log('ServiceWorker registration successful with scope:', newRegistration.scope);

                      // Handle updates
                      newRegistration.addEventListener('updatefound', () => {
                        const newWorker = newRegistration.installing;
                        console.log('Service Worker update found!');

                        newWorker.addEventListener('statechange', () => {
                          console.log('Service Worker state:', newWorker.state);
                          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            console.log('New Service Worker ready to take over');
                          } else if (newWorker.state === 'redundant') {
                            console.error('Service Worker became redundant');
                          }
                        });
                      });

                      // Log controller changes
                      navigator.serviceWorker.addEventListener('controllerchange', () => {
                        console.log('Service Worker controller changed');
                      });
                    } catch (error) {
                      console.error('ServiceWorker registration failed:', error);
                    }
                  } else {
                    console.log('Service Workers are not supported in this browser');
                  }
                });
              }
            `
          }}
        />
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