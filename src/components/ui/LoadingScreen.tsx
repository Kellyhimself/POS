"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useOfflineProducts } from '@/lib/hooks/useOfflineProducts';
import { usePathname } from 'next/navigation';
import { WifiOff } from 'lucide-react';

interface LoadingScreenProps {
  children: React.ReactNode;
}

export function LoadingScreen({ children }: LoadingScreenProps) {
  const { loading: authLoading, isOnline, storeId } = useAuth();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  // Get products loading state if we're on a page that needs products
  const needsProducts = ['/pos', '/inventory', '/dashboard'].includes(pathname);
  const { isLoading: productsLoading } = useOfflineProducts(needsProducts && storeId ? storeId : '');

  useEffect(() => {
    // Determine loading state and message
    if (authLoading) {
      setLoadingMessage(isOnline ? 'Authenticating...' : 'Checking offline access...');
      setIsLoading(true);
    } else if (needsProducts && productsLoading) {
      setLoadingMessage(isOnline ? 'Loading products...' : 'Loading cached products...');
      setIsLoading(true);
    } else {
      setIsLoading(false);
    }
  }, [authLoading, productsLoading, pathname, isOnline, needsProducts]);

  if (!isLoading) {
    return <>{children}</>;
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50">
      <div className="fixed left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-lg font-medium text-foreground">{loadingMessage}</p>
          {!isOnline && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <WifiOff className="h-4 w-4" />
              <span>Working offline</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 