import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Scan, 
  Package, 
  CheckCircle, 
  AlertCircle, 
  Trash2,
  Download,
  Upload,
  Play,
  Pause,
  RotateCcw
} from 'lucide-react';
import { BarcodeInput } from '@/components/ui/BarcodeInput';
import { toast } from 'sonner';

interface ScannedItem {
  barcode: string;
  timestamp: Date;
  count: number;
  productName?: string;
  error?: string;
}

interface BulkBarcodeScannerProps {
  mode: 'inventory' | 'receiving' | 'stock-count';
  onComplete: (items: ScannedItem[]) => void;
  onItemScanned?: (item: ScannedItem) => void;
  className?: string;
  autoStart?: boolean;
  maxItems?: number;
}

export function BulkBarcodeScanner({
  mode,
  onComplete,
  onItemScanned,
  className,
  autoStart = false,
  maxItems = 1000
}: BulkBarcodeScannerProps) {
  const [isScanning, setIsScanning] = useState(autoStart);
  const [scannedItems, setScannedItems] = useState<ScannedItem[]>([]);
  const [currentSession, setCurrentSession] = useState<Date>(new Date());
  const [scanCount, setScanCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout>();

  const handleBarcodeScan = async (barcode: string) => {
    if (!isScanning) return;

    const timestamp = new Date();
    const existingItem = scannedItems.find(item => item.barcode === barcode);

    if (existingItem) {
      // Increment count for existing item
      const updatedItems = scannedItems.map(item =>
        item.barcode === barcode
          ? { ...item, count: item.count + 1 }
          : item
      );
      setScannedItems(updatedItems);
      setScanCount(prev => prev + 1);
      
      toast.success(`Counted: ${barcode} (${existingItem.count + 1})`, {
        duration: 1000
      });
    } else {
      // Add new item
      const newItem: ScannedItem = {
        barcode,
        timestamp,
        count: 1
      };

      // Try to get product name from API
      try {
        const response = await fetch(`/api/products/barcode/${encodeURIComponent(barcode)}`);
        const result = await response.json();
        if (result.success && result.data) {
          newItem.productName = result.data.name;
        }
      } catch (error) {
        newItem.error = 'Product not found';
        setErrorCount(prev => prev + 1);
      }

      setScannedItems(prev => [...prev, newItem]);
      setScanCount(prev => prev + 1);
      
      toast.success(`Added: ${barcode}`, {
        duration: 1000
      });
    }

    // Call callback if provided
    if (onItemScanned) {
      const item = scannedItems.find(item => item.barcode === barcode) || 
                   scannedItems[scannedItems.length - 1];
      onItemScanned(item);
    }

    // Check if we've reached max items
    if (scannedItems.length >= maxItems) {
      handleComplete();
    }
  };

  const handleStart = () => {
    setIsScanning(true);
    setCurrentSession(new Date());
    toast.success('Barcode scanning started');
  };

  const handlePause = () => {
    setIsScanning(false);
    toast.info('Barcode scanning paused');
  };

  const handleReset = () => {
    setScannedItems([]);
    setScanCount(0);
    setErrorCount(0);
    setCurrentSession(new Date());
    toast.info('Session reset');
  };

  const handleComplete = () => {
    setIsScanning(false);
    onComplete(scannedItems);
    toast.success(`Session completed: ${scannedItems.length} items scanned`);
  };

  const exportToCSV = () => {
    const csvContent = [
      'Barcode,Product Name,Count,Timestamp,Error',
      ...scannedItems.map(item => 
        `"${item.barcode}","${item.productName || ''}","${item.count}","${item.timestamp.toISOString()}","${item.error || ''}"`
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${mode}-scan-${currentSession.toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getModeConfig = () => {
    switch (mode) {
      case 'inventory':
        return {
          title: 'Inventory Count',
          description: 'Scan products to count inventory',
          icon: Package,
          color: 'blue'
        };
      case 'receiving':
        return {
          title: 'Receiving',
          description: 'Scan received products',
          icon: Upload,
          color: 'green'
        };
      case 'stock-count':
        return {
          title: 'Stock Count',
          description: 'Count stock levels',
          icon: Package,
          color: 'purple'
        };
    }
  };

  const config = getModeConfig();
  const IconComponent = config.icon;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <IconComponent className={`w-5 h-5 text-${config.color}-600`} />
          {config.title}
        </CardTitle>
        <p className="text-sm text-gray-600">{config.description}</p>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Session Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-blue-50 p-3 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">{scanCount}</div>
            <div className="text-xs text-blue-600">Total Scans</div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{scannedItems.length}</div>
            <div className="text-xs text-green-600">Unique Items</div>
          </div>
          <div className="bg-red-50 p-3 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{errorCount}</div>
            <div className="text-xs text-red-600">Errors</div>
          </div>
        </div>

        {/* Scanner Input */}
        <div className="space-y-2">
          <BarcodeInput
            onScan={handleBarcodeScan}
            placeholder="Scan barcodes continuously..."
            label="Barcode Scanner"
            size="lg"
            showStatus={true}
            autoFocus={isScanning}
            disabled={!isScanning}
            enableSound={true}
          />
        </div>

        {/* Control Buttons */}
        <div className="flex gap-2">
          {!isScanning ? (
            <Button onClick={handleStart} className="flex-1">
              <Play className="w-4 h-4 mr-2" />
              Start Scanning
            </Button>
          ) : (
            <Button onClick={handlePause} variant="outline" className="flex-1">
              <Pause className="w-4 h-4 mr-2" />
              Pause
            </Button>
          )}
          
          <Button onClick={handleReset} variant="outline" size="sm">
            <RotateCcw className="w-4 h-4" />
          </Button>
          
          <Button onClick={handleComplete} variant="outline" size="sm">
            <CheckCircle className="w-4 h-4" />
          </Button>
        </div>

        {/* Scanned Items List */}
        {scannedItems.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">Scanned Items</h4>
              <Button onClick={exportToCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
            </div>
            
            <div className="max-h-60 overflow-y-auto space-y-1">
              {scannedItems.map((item, index) => (
                <div
                  key={`${item.barcode}-${index}`}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded text-sm"
                >
                  <div className="flex-1">
                    <div className="font-mono text-xs">{item.barcode}</div>
                    {item.productName && (
                      <div className="text-gray-600 truncate">{item.productName}</div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant={item.error ? "destructive" : "default"}>
                      {item.count}
                    </Badge>
                    
                    {item.error && (
                      <AlertCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Connect USB barcode scanner for continuous scanning</p>
          <p>• Each scan increments the count for that product</p>
          <p>• Use pause to temporarily stop scanning</p>
          <p>• Export results to CSV for further processing</p>
        </div>
      </CardContent>
    </Card>
  );
} 