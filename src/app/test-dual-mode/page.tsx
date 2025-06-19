'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { getModeManager } from '@/lib/mode/ModeManager';
import { getUnifiedService } from '@/lib/services/UnifiedService';
import { useUnifiedProducts } from '@/lib/hooks/useUnifiedProducts';
import { useUnifiedSales } from '@/lib/hooks/useUnifiedSales';
import { ModeSettings } from '@/components/settings/ModeSettings';

export default function TestDualModePage() {
  console.log('🔄 TestDualModePage: Component rendering');
  
  const { user } = useAuth();
  console.log('🔄 TestDualModePage: User from auth:', user ? 'Authenticated' : 'Not authenticated');
  
  const [currentMode, setCurrentMode] = useState<'offline' | 'online'>('online');
  const [networkStatus, setNetworkStatus] = useState(true);
  const [testResults, setTestResults] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  console.log('🔄 TestDualModePage: State initialized', { currentMode, networkStatus, error });

  // Use refs to store singleton instances to prevent recreation
  const modeManagerRef = useRef<ReturnType<typeof getModeManager> | null>(null);
  const unifiedServiceRef = useRef<ReturnType<typeof getUnifiedService> | null>(null);

  // Initialize singletons once
  if (!modeManagerRef.current) {
    console.log('🔄 TestDualModePage: Initializing mode manager');
    try {
      modeManagerRef.current = getModeManager();
      console.log('✅ TestDualModePage: Mode manager initialized successfully');
    } catch (err) {
      console.error('❌ TestDualModePage: Failed to get mode manager:', err);
      setError('Failed to initialize mode manager');
    }
  }

  if (!unifiedServiceRef.current && modeManagerRef.current) {
    console.log('🔄 TestDualModePage: Initializing unified service');
    try {
      unifiedServiceRef.current = getUnifiedService(modeManagerRef.current);
      console.log('✅ TestDualModePage: Unified service initialized successfully');
    } catch (err) {
      console.error('❌ TestDualModePage: Failed to get unified service:', err);
      setError('Failed to initialize unified service');
    }
  }

  console.log('🔄 TestDualModePage: About to call useUnifiedProducts');
  
  // Test the unified hooks with error handling
  const { 
    products, 
    isLoading: productsLoading, 
    error: productsError,
    currentMode: productsMode,
    createProduct 
  } = useUnifiedProducts(user?.user_metadata?.store_id || '');

  console.log('🔄 TestDualModePage: useUnifiedProducts result:', { 
    productsCount: products.length, 
    productsLoading, 
    productsError, 
    productsMode 
  });

  console.log('🔄 TestDualModePage: About to call useUnifiedSales');
  
  const { 
    transactions, 
    isLoading: salesLoading, 
    error: salesError,
    currentMode: salesMode,
    createSale 
  } = useUnifiedSales(user?.user_metadata?.store_id || '');

  console.log('🔄 TestDualModePage: useUnifiedSales result:', { 
    transactionsCount: transactions.length, 
    salesLoading, 
    salesError, 
    salesMode 
  });

  useEffect(() => {
    console.log('🔄 TestDualModePage: Main useEffect running');
    
    if (!modeManagerRef.current) {
      console.log('❌ TestDualModePage: Mode manager not available in useEffect');
      return;
    }

    try {
      console.log('🔄 TestDualModePage: Setting up event listeners');
      
      // Set initial state
      const initialMode = modeManagerRef.current.getCurrentMode();
      const initialNetworkStatus = modeManagerRef.current.getNetworkStatus();
      
      console.log('🔄 TestDualModePage: Setting initial state', { initialMode, initialNetworkStatus });
      
      setCurrentMode(initialMode);
      setNetworkStatus(initialNetworkStatus);

      const handleModeChange = (event: CustomEvent) => {
        const newMode = event.detail.mode;
        console.log('🔄 TestDualModePage: Mode change event received:', newMode);
        setCurrentMode(newMode);
        addTestResult(`Mode changed to: ${newMode}`);
      };

      const handleOnline = () => {
        console.log('🔄 TestDualModePage: Online event received');
        setNetworkStatus(true);
        addTestResult('Network: Online');
      };

      const handleOffline = () => {
        console.log('🔄 TestDualModePage: Offline event received');
        setNetworkStatus(false);
        addTestResult('Network: Offline');
      };

      window.addEventListener('modeChange', handleModeChange as EventListener);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Initial test results
      addTestResult(`Initial mode: ${modeManagerRef.current.getCurrentMode()}`);
      addTestResult(`Network status: ${navigator.onLine ? 'Online' : 'Offline'}`);
      
      console.log('✅ TestDualModePage: Event listeners set up successfully');
      
      return () => {
        console.log('🔄 TestDualModePage: Cleaning up event listeners');
        window.removeEventListener('modeChange', handleModeChange as EventListener);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    } catch (err) {
      console.error('❌ TestDualModePage: Error in useEffect:', err);
      setError('Error setting up event listeners');
    }
  }, []); // Empty dependency array since we're using refs

  const addTestResult = (message: string) => {
    console.log('🔄 TestDualModePage: Adding test result:', message);
    const timestamp = new Date().toLocaleTimeString();
    setTestResults(prev => [`[${timestamp}] ${message}`, ...prev.slice(0, 19)]);
  };

  const testCreateProduct = async () => {
    console.log('🔄 TestDualModePage: testCreateProduct called');
    
    if (!user?.user_metadata?.store_id) {
      console.log('❌ TestDualModePage: No store ID available');
      addTestResult('❌ No store ID available');
      return;
    }

    try {
      addTestResult('🔄 Testing product creation...');
      const testProduct = {
        name: `Test Product ${Date.now()}`,
        sku: `TEST-${Date.now()}`,
        store_id: user.user_metadata.store_id,
        quantity: 10,
        cost_price: 100,
        selling_price: 150,
        vat_status: true,
        unit_of_measure: 'pcs',
        units_per_pack: 1
      };

      console.log('🔄 TestDualModePage: Creating test product:', testProduct);
      const result = await createProduct(testProduct);
      console.log('✅ TestDualModePage: Product created successfully:', result);
      addTestResult(`✅ Product created: ${result.name} (ID: ${result.id})`);
    } catch (error) {
      console.error('❌ TestDualModePage: Product creation failed:', error);
      addTestResult(`❌ Product creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testCreateSale = async () => {
    console.log('🔄 TestDualModePage: testCreateSale called');
    
    if (!user?.user_metadata?.store_id || products.length === 0) {
      console.log('❌ TestDualModePage: No store ID or products available');
      addTestResult('❌ No store ID or products available');
      return;
    }

    try {
      addTestResult('🔄 Testing sale creation...');
      const testSale = {
        store_id: user.user_metadata.store_id,
        user_id: user.id,
        products: [{
          id: products[0].id,
          quantity: 1,
          unit_price: products[0].selling_price,
          vat_amount: products[0].selling_price * 0.16 // 16% VAT
        }],
        payment_method: 'cash' as const,
        total_amount: products[0].selling_price,
        vat_total: products[0].selling_price * 0.16
      };

      console.log('🔄 TestDualModePage: Creating test sale:', testSale);
      const result = await createSale(testSale);
      console.log('✅ TestDualModePage: Sale created successfully:', result);
      addTestResult(`✅ Sale created: ${result.id}`);
    } catch (error) {
      console.error('❌ TestDualModePage: Sale creation failed:', error);
      addTestResult(`❌ Sale creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const testModeSwitch = () => {
    console.log('🔄 TestDualModePage: testModeSwitch called');
    
    if (!modeManagerRef.current) {
      console.log('❌ TestDualModePage: Mode manager not available');
      addTestResult('❌ Mode manager not available');
      return;
    }

    try {
      if (currentMode === 'online') {
        console.log('🔄 TestDualModePage: Switching to offline mode');
        modeManagerRef.current.forceOfflineMode();
        addTestResult('🔄 Manually switched to offline mode');
      } else {
        console.log('🔄 TestDualModePage: Switching to online mode');
        modeManagerRef.current.forceOnlineMode();
        addTestResult('🔄 Manually switched to online mode');
      }
    } catch (error) {
      console.error('❌ TestDualModePage: Mode switch failed:', error);
      addTestResult(`❌ Mode switch failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  console.log('🔄 TestDualModePage: About to render, checking conditions');
  console.log('🔄 TestDualModePage: Render conditions:', { 
    user: !!user, 
    error, 
    currentMode, 
    networkStatus,
    productsCount: products.length,
    transactionsCount: transactions.length
  });

  if (!user) {
    console.log('🔄 TestDualModePage: Rendering login required message');
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Dual Mode Test</h1>
          <p className="text-gray-600">Please log in to test the dual-mode functionality.</p>
        </div>
      </div>
    );
  }

  if (error) {
    console.log('🔄 TestDualModePage: Rendering error message:', error);
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-red-600">Error</h1>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  console.log('🔄 TestDualModePage: Rendering main content');
  
  return (
    <div className="container mx-auto py-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Dual Mode Test</h1>
        <p className="text-gray-600">Test the dual-mode functionality safely</p>
      </div>

      {/* Current Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Current Status</h2>
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                currentMode === 'online' ? 'bg-green-500' : 'bg-yellow-500'
              }`} />
              <span>Mode: {currentMode}</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                networkStatus ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span>Network: {networkStatus ? 'Connected' : 'Disconnected'}</span>
            </div>
            <div>Store ID: {user.user_metadata.store_id}</div>
            <div>Products: {products.length}</div>
            <div>Transactions: {transactions.length}</div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Hook Status</h2>
          <div className="space-y-2">
            <div>Products Mode: {productsMode}</div>
            <div>Products Loading: {productsLoading ? 'Yes' : 'No'}</div>
            <div>Products Error: {productsError || 'None'}</div>
            <div>Sales Mode: {salesMode}</div>
            <div>Sales Loading: {salesLoading ? 'Yes' : 'No'}</div>
            <div>Sales Error: {salesError || 'None'}</div>
          </div>
        </div>
      </div>

      {/* Test Controls */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
        <div className="flex flex-wrap gap-4">
          <button
            onClick={testModeSwitch}
            disabled={!modeManagerRef.current}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Switch to {currentMode === 'online' ? 'Offline' : 'Online'}
          </button>
          <button
            onClick={testCreateProduct}
            disabled={!unifiedServiceRef.current}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Test Create Product
          </button>
          <button
            onClick={testCreateSale}
            disabled={!unifiedServiceRef.current || products.length === 0}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Test Create Sale
          </button>
        </div>
      </div>

      {/* Mode Settings */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Mode Settings</h2>
        <ModeSettings />
      </div>

      {/* Test Results */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-semibold mb-4">Test Results</h2>
        <div className="bg-gray-50 p-4 rounded-lg h-64 overflow-y-auto">
          {testResults.length === 0 ? (
            <p className="text-gray-500">No test results yet. Try the test controls above.</p>
          ) : (
            <div className="space-y-1">
              {testResults.map((result, index) => (
                <div key={index} className="text-sm font-mono">
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 