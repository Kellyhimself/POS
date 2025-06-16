"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { useQuery } from '@tanstack/react-query';
import { syncService } from '@/lib/sync';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertCircle, TrendingUp, Package, AlertTriangle, RefreshCw, ShoppingCart, Receipt, Settings, BarChart3, DollarSign } from 'lucide-react';
import { useSync } from '@/hooks/useSync';
import { useGlobalSaleSync } from '@/lib/hooks/useGlobalSaleSync';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import SyncManager from '@/components/etims/SyncQRCode';

const DashboardPage = () => {
  const { storeId, loading, isOnline, user } = useAuth();
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isSyncSheetOpen, setIsSyncSheetOpen] = useState(false);
  const { syncStatus: inventorySyncStatus } = useSync(storeId || '');
  const syncStatus = useGlobalSaleSync();
  const router = useRouter();

  // Handle PWA installation
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setShowInstallPrompt(false);
    }
    setDeferredPrompt(null);
  };

  // Fetch key metrics
  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['products', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      return await syncService.getProducts(storeId);
    },
    enabled: !!storeId,
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions', storeId],
    queryFn: async () => {
      if (!storeId) return [];
      return await syncService.getTransactions(storeId);
    },
    enabled: !!storeId,
  });

  // Calculate metrics
  const lowStockItems = products?.filter(p => p.quantity < 10) || [];
  const totalProducts = products?.length || 0;
  const totalValue = products?.reduce((sum, p) => sum + (p.quantity * (p.retail_price || 0)), 0) || 0;
  const pendingSync = inventorySyncStatus?.pendingSync || 0;

  // Calculate sync progress
  const syncProgress = syncStatus.totalItems > 0 
    ? (syncStatus.currentItem / syncStatus.totalItems) * 100 
    : 0;

  if (loading) return <div>Loading auth state...</div>;
  if (!storeId) return <div>No store assigned. Please contact your administrator.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      {/* PWA Install Prompt */}
      {deferredPrompt && (
        <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm sm:max-w-md">
          <Card className="bg-white dark:bg-gray-800 shadow-lg border-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Install POS App</CardTitle>
              <CardDescription>
                Install our app for a better experience
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-2">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Get quick access to your POS system, even when you&apos;re offline
              </p>
            </CardContent>
            <CardFooter className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setDeferredPrompt(null)}
              >
                Not now
              </Button>
              <Button
                size="sm"
                className="flex-1 bg-[#0ABAB5] hover:bg-[#0ABAB5]/90"
                onClick={handleInstall}
              >
                Install
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      <div className="container mx-auto px-4 py-8 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-white dark:bg-gray-800 shadow-sm border-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Total Products
                </CardTitle>
                <div className="p-2 rounded-lg bg-[#0ABAB5]/10">
                  <Package className="h-4 w-4 text-[#0ABAB5]" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalProducts}</div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 shadow-sm border-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Low Stock Items
                </CardTitle>
                <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20">
                  <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-500 dark:text-red-400">
                {lowStockItems.length}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 shadow-sm border-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Inventory Value
                </CardTitle>
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20">
                  <DollarSign className="h-4 w-4 text-green-500 dark:text-green-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500 dark:text-green-400">
                KES {totalValue.toLocaleString()}
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-gray-800 shadow-sm border-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Sync Status
                </CardTitle>
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <RefreshCw className="h-4 w-4 text-blue-500 dark:text-blue-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500 dark:text-blue-400">
                {isOnline ? 'Online' : 'Offline'}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button
            variant="outline"
            className="h-auto py-6 px-4 flex flex-col items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-0 shadow-sm"
            onClick={() => router.push('/pos')}
          >
            <div className="p-2 rounded-lg bg-[#0ABAB5]/10">
              <ShoppingCart className="h-6 w-6 text-[#0ABAB5]" />
            </div>
            <span className="text-sm font-medium">New Sale</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-6 px-4 flex flex-col items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-0 shadow-sm"
            onClick={() => router.push('/inventory')}
          >
            <div className="p-2 rounded-lg bg-[#0ABAB5]/10">
              <Package className="h-6 w-6 text-[#0ABAB5]" />
            </div>
            <span className="text-sm font-medium">Inventory</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto py-6 px-4 flex flex-col items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-0 shadow-sm"
            onClick={() => router.push('/reports')}
          >
            <div className="p-2 rounded-lg bg-[#0ABAB5]/10">
              <BarChart3 className="h-6 w-6 text-[#0ABAB5]" />
            </div>
            <span className="text-sm font-medium">Reports</span>
          </Button>

          <Sheet open={isSyncSheetOpen} onOpenChange={setIsSyncSheetOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                className="h-auto py-6 px-4 flex flex-col items-center gap-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border-0 shadow-sm"
              >
                <div className="p-2 rounded-lg bg-[#0ABAB5]/10">
                  <RefreshCw className="h-6 w-6 text-[#0ABAB5]" />
                </div>
                <span className="text-sm font-medium">Sync</span>
              </Button>
            </SheetTrigger>
            <SheetContent 
              side="right" 
              className="w-full sm:w-[800px] sm:max-w-[800px] overflow-y-auto h-screen bg-[#1A1F36] border-l border-[#0ABAB5]/20"
            >
              <div className="flex flex-col h-full">
                <SheetHeader className="px-6 py-4 border-b border-white/10">
                  <SheetTitle className="text-xl font-semibold text-white">Sync eTIMS Submissions</SheetTitle>
                </SheetHeader>
                
                <div className="flex-1 overflow-y-auto">
                  <div className="flex flex-col h-full">
                    {/* Instructions */}
                    <div className="p-6 border-b border-white/10">
                      <h3 className="text-lg font-medium text-white mb-4">Sync Process</h3>
                      <div className="space-y-4 text-gray-300">
                        <p className="text-sm">
                          1. Click "Download Submissions" to get a file with pending submissions
                        </p>
                        <p className="text-sm">
                          2. Transfer this file to your online device (phone/tablet)
                        </p>
                        <p className="text-sm">
                          3. On your online device, visit the sync page to process submissions:
                        </p>
                        <Button
                          variant="outline"
                          className="w-full bg-white/10 hover:bg-white/20 text-white border-white/20"
                          onClick={() => {
                            window.open('/sync', '_blank');
                            setIsSyncSheetOpen(false);
                          }}
                        >
                          Open Sync Page
                        </Button>
                        <p className="text-sm">
                          4. After processing, download the results file
                        </p>
                        <p className="text-sm">
                          5. Return here and click "Upload Results" to update your local submissions
                        </p>
                      </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-6">
                      {user?.user_metadata?.store_id && (
                        <SyncManager 
                          storeId={user.user_metadata.store_id}
                          onResultsUploaded={() => {
                            // Refresh the page or update the UI as needed
                            setIsSyncSheetOpen(false);
                          }}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Low Stock Alerts */}
        <Card className="bg-white dark:bg-gray-800 shadow-sm border-0">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold">Low Stock Alerts</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="text-[#0ABAB5] hover:text-[#0ABAB5]/90"
                onClick={() => router.push('/inventory?filter=low-stock')}
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {lowStockItems.length > 0 ? (
              <div className="space-y-4">
                {lowStockItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-[#0ABAB5]/10">
                        <Package className="h-4 w-4 text-[#0ABAB5]" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{item.name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          SKU: {item.sku}
                        </p>
                      </div>
                    </div>
                    <Badge variant="destructive" className="ml-2">
                      {item.quantity} left
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No low stock items</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage; 