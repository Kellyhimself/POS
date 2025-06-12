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

  const pathname = usePathname();
  const { user, loading } = useAuth();

  // Initialize hooks at the top level
  useGlobalProductSync();
  useGlobalSaleSync();
  useGlobalProductCache();

  // Register service worker
  React.useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      const registerSW = async () => {
        try {
          console.log('🔄 Starting service worker registration process...');

          // Wait for the page to be fully loaded
          if (document.readyState !== 'complete') {
            console.log('⏳ Waiting for page to load completely...');
            await new Promise(resolve => window.addEventListener('load', resolve));
          }

          // Check existing registrations
          const existingRegistrations = await navigator.serviceWorker.getRegistrations();
          console.log('📝 Found existing registrations:', existingRegistrations.length);

          // Unregister existing service workers
          for (const registration of existingRegistrations) {
            console.log('🗑️ Unregistering existing service worker:', registration.scope);
            await registration.unregister();
          }

          // Clear existing caches
          const cacheNames = await caches.keys();
          console.log('🗑️ Clearing existing caches:', cacheNames);
          await Promise.all(cacheNames.map(name => caches.delete(name)));

          // Register new service worker
          console.log('📝 Registering new service worker...');
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none'
          });
          console.log('✅ Service Worker registered successfully:', registration.scope);

          // Set up update handling
          registration.addEventListener('updatefound', () => {
            const newWorker = registration.installing;
            console.log('🔄 New service worker found:', newWorker?.state);
            
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                console.log('🔄 Service worker state changed:', newWorker.state);
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('🔄 New content available, reloading...');
                  window.location.reload();
                }
              });
            }
          });

          // Handle service worker errors
          registration.addEventListener('error', (error) => {
            console.error('❌ Service Worker registration error:', error);
          });

          // Handle service worker messages
          navigator.serviceWorker.addEventListener('message', (event) => {
            console.log('📨 Service worker message received:', event.data);
            if (event.data && event.data.type === 'SKIP_WAITING') {
              window.location.reload();
            }
          });

          // Cache critical assets
          if (registration.active) {
            console.log('📦 Caching critical assets...');
            const cache = await caches.open('critical-assets-v1');
            const assetsToCache = [
              '/',
              '/dashboard',
              '/login',
              '/pos',
              '/reports',
              '/bulk-reports',
              '/settings',
              '/manifest.json',
              '/icons/icon-192x192.png',
              '/icons/icon-512x512.png'
            ];
            
            try {
              await cache.addAll(assetsToCache);
              console.log('✅ Critical assets cached successfully');
            } catch (error) {
              console.error('❌ Error caching critical assets:', error);
            }
          }

          // Force activation if needed
          if (registration.waiting) {
            console.log('🔄 Forcing service worker activation...');
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

          // Log service worker state
          console.log('📊 Service Worker State:', {
            controller: !!navigator.serviceWorker.controller,
            ready: !!registration.active,
            installing: !!registration.installing,
            waiting: !!registration.waiting
          });

        } catch (error) {
          console.error('❌ Service Worker registration failed:', error);
        }
      };

      registerSW();
    }
  }, []);

  // Log when auth is ready and sync should start
  React.useEffect(() => {
    if (!loading && user?.user_metadata?.store_id) {
      console.log('🔄 Auth ready for sync', {
        storeId: user.user_metadata.store_id,
        isOnline: navigator.onLine
      });
    }
  }, [loading, user]);

  // Log app state for debugging
  React.useEffect(() => {
    console.log('App State:', {
      user: user ? 'Logged in' : 'Not logged in',
      path: pathname,
      storeId: user?.user_metadata?.store_id,
      loading
    });
  }, [user, pathname, loading]);

  // Remove the redirect effect and let middleware handle it
  if (loading) {
    return null;
  }

  // Don't show layout for auth pages
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
      console.log('🔧 Service Worker supported');
      
      // Check if service worker is already registered
      navigator.serviceWorker.getRegistrations().then(registrations => {
        console.log('📝 Current service worker registrations:', registrations.length);
        registrations.forEach(reg => {
          console.log('🔍 Service Worker:', {
            scope: reg.scope,
            state: reg.active ? 'active' : 'inactive'
          });
        });
      });

      // Listen for service worker registration
      navigator.serviceWorker.register('/sw.js').then(
        registration => {
          console.log('✅ Service Worker registered successfully:', registration.scope);
        },
        error => {
          console.error('❌ Service Worker registration failed:', error);
        }
      );

      // Listen for service worker updates
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('🔄 Service Worker controller changed');
      });
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
