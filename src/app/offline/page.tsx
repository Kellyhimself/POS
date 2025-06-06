'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, WifiOff } from 'lucide-react';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md p-6 text-center">
        <div className="flex flex-col items-center space-y-4">
          <WifiOff className="h-16 w-16 text-red-500" />
          <h1 className="text-2xl font-bold text-gray-900">You're Offline</h1>
          <p className="text-gray-600">
            Don't worry! Your POS system is still fully functional offline. All your sales and inventory updates are being saved locally.
          </p>
          <div className="bg-yellow-50 p-4 rounded-lg w-full">
            <div className="flex items-start">
              <AlertCircle className="h-5 w-5 text-yellow-400 mr-2" />
              <p className="text-sm text-yellow-700">
                Your data will automatically sync when you're back online. You can continue working normally.
              </p>
            </div>
          </div>
          <Button
            onClick={handleRetry}
            className="mt-4"
            disabled={!isOnline}
          >
            {isOnline ? 'Retry Connection' : 'Waiting for Connection...'}
          </Button>
        </div>
      </Card>
    </div>
  );
} 