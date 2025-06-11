'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OfflinePage() {
  const router = useRouter();

  useEffect(() => {
    const checkOnline = () => {
      if (navigator.onLine) {
        router.push('/');
      }
    };

    window.addEventListener('online', checkOnline);
    return () => window.removeEventListener('online', checkOnline);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full p-6 bg-white rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">You're Offline</h1>
        <p className="text-gray-600 mb-4">
          Please check your internet connection and try again.
        </p>
        <div className="space-y-2">
          <p className="text-sm text-gray-500">Try:</p>
          <ul className="list-disc list-inside text-sm text-gray-500">
            <li>Checking your network cables</li>
            <li>Reconnecting to Wi-Fi</li>
            <li>Checking your router</li>
          </ul>
        </div>
      </div>
    </div>
  );
} 