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

  // Initialize hooks at the top level
  const productSync = useGlobalProductSync();
  const saleSync = useGlobalSaleSync();
  const productCache = useGlobalProductCache();

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

  // Redirect to login if not authenticated
  React.useEffect(() => {
    if (!loading && !user && pathname !== '/login') {
      router.push('/login');
    }
  }, [user, pathname, router, loading]);

  if (loading) {
    return null;
  }

  if (!user && pathname !== '/login') {
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
  return (
    <html lang="en">
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
