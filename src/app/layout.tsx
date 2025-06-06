'use client';

import './globals.css';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import ReactQueryProvider from '@/components/providers/ReactQueryProvider';
import Sidebar from '@/components/layout/Sidebar';
import Navbar from '@/components/layout/Navbar';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';

const inter = Inter({ subsets: ['latin'] });

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light">
      <head>
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className + " bg-app text-app-primary"}>
        <AuthProvider>
          <ReactQueryProvider>
            <RootLayoutContent>{children}</RootLayoutContent>
          </ReactQueryProvider>
        </AuthProvider>
        <Toaster 
          position="top-center" 
          expand={false}
          richColors
          closeButton
          theme="light"
        />
      </body>
    </html>
  );
}

function RootLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, storeId, storeName, loading, isOnline } = useAuth();
  const router = useRouter();

  console.log('=== RootLayout State Update ===');
  console.log('Loading:', loading);
  console.log('Online:', isOnline);
  console.log('Network Status:', navigator.onLine);
  console.log('App State:', { user, storeId, storeName, isOnline });

  const isAppStateValid = {
    hasUser: !!user,
    hasStore: !!storeId,
    isOnline
  };

  console.log('✅ App state valid:', isAppStateValid);

  if (loading) {
    console.log('🔄 Rendering loading state');
    return <LoadingScreen>Loading...</LoadingScreen>;
  }

  // If not logged in and not on auth pages, redirect to login
  if (!user && !['/login', '/signup', '/invite'].includes(window.location.pathname)) {
    router.push('/login');
    return <LoadingScreen>Redirecting to login...</LoadingScreen>;
  }

  console.log('🔄 Rendering main layout');
  return (
    <div className="min-h-screen bg-app">
      <Sidebar />
      <div className="ml-64 flex-1">
        <Navbar isOnline={isOnline} storeName={storeName || undefined} />
        <main className="pt-16 px-8 py-6 text-app-primary w-full">
          {!storeId && !isOnline ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">Working Offline</h2>
                <p className="text-gray-600">Some features may be limited while offline.</p>
              </div>
            </div>
          ) : (
            <div className="w-full">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
