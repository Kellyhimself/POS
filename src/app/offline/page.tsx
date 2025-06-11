'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/button';
import { WifiOff, RefreshCw } from 'lucide-react';

export default function OfflinePage() {
  const router = useRouter();
  const { isOnline } = useAuth();
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const checkOnline = () => {
      if (navigator.onLine) {
        router.push('/');
      }
    };

    window.addEventListener('online', checkOnline);
    return () => window.removeEventListener('online', checkOnline);
  }, [router]);

  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    router.refresh();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
        <div className="flex flex-col items-center mb-6">
          <WifiOff className="h-12 w-12 text-red-500 mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">You're Offline</h1>
          <p className="text-gray-600 text-center mb-4">
            {isOnline 
              ? "The app is in offline mode. Some features may be limited."
              : "Please check your internet connection and try again."}
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="bg-gray-50 p-4 rounded-lg">
            <p className="text-sm text-gray-500 mb-2">Try:</p>
            <ul className="list-disc list-inside text-sm text-gray-500 space-y-1">
              <li>Checking your network cables</li>
              <li>Reconnecting to Wi-Fi</li>
              <li>Checking your router</li>
              <li>Refreshing the page</li>
            </ul>
          </div>

          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={handleRetry}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Retry Connection
            </Button>
            <Button
              onClick={() => router.push('/')}
              className="flex items-center gap-2"
            >
              Go to Dashboard
            </Button>
          </div>

          {retryCount > 0 && (
            <p className="text-sm text-gray-500 text-center mt-4">
              Retry attempt: {retryCount}
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 