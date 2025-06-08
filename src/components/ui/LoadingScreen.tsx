"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { usePathname } from 'next/navigation';
import { WifiOff } from 'lucide-react';
import { syncService } from '@/lib/sync';

export function LoadingScreen() {
  const { isOnline, user } = useAuth();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user?.user_metadata?.store_id) return;

      try {
        // Use syncService to get products
        await syncService.getProducts(user.user_metadata.store_id);
        setIsLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setIsLoading(false);
      }
    };

    loadData();
  }, [user?.user_metadata?.store_id]);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isOnline && pathname !== '/offline') {
    return (
      <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <WifiOff className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">You are offline</p>
        </div>
      </div>
    );
  }

  return null;
} 