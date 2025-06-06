import { ReactNode } from 'react';
import { useAppState } from '@/lib/hooks/useAppState';
import AppLayout from './AppLayout';

interface PageProps {
  children: ReactNode;
  title: string;
}

export default function Page({ children, title }: PageProps) {
  const { appState, isLoading, isOnline } = useAppState();

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#0ABAB5]"></div>
        </div>
      </AppLayout>
    );
  }

  if (!appState?.store) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-800 mb-2">No Store Selected</h2>
            <p className="text-gray-600">Please select a store to continue.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
        {!isOnline && (
          <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              You are currently offline. Some features may be limited.
            </p>
          </div>
        )}
      </div>
      {children}
    </AppLayout>
  );
} 