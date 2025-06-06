"use client";

import React from 'react';
import { useAuth } from '@/components/providers/AuthProvider';

const DashboardPage = () => {
  const { storeId, loading } = useAuth();
  if (loading || !storeId) return <div>Loading...</div>;
  return (
    <div className="bg-app py-6 text-app-primary min-h-screen">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <h1 className="text-2xl font-semibold text-app-primary">Dashboard</h1>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
        <div className="py-4">
          <div className="h-96 rounded-lg border-4 border-dashed border-gray-300 flex items-center justify-center card">
            <p className="text-app-primary">Your dashboard content will go here</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage; 