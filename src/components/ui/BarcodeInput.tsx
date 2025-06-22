import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { 
  Scan, 
  CheckCircle, 
  AlertCircle, 
  Loader2,
  Volume2,
  VolumeX
} from 'lucide-react';
import { toast } from 'sonner';

interface BarcodeInputProps {
  onScan: (barcode: string) => void;
  placeholder?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showStatus?: boolean;
  autoFocus?: boolean;
  className?: string;
  disabled?: boolean;
  enableSound?: boolean;
  showInstructions?: boolean;
}

export function BarcodeInput({
  onScan,
  placeholder = "Scan barcode...",
  label = "Barcode Scanner",
  size = 'md',
  showStatus = false,
  autoFocus = true,
  className,
  disabled = false,
  enableSound = true,
  showInstructions = false
}: BarcodeInputProps) {
  const [value, setValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  // Sound effects
  const playSuccessSound = () => {
    if (!enableSound || isMuted) return;
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
      audio.volume = 0.3;
      audio.play().catch(() => {}); // Ignore errors if audio fails
    } catch (error) {
      // Ignore audio errors
    }
  };

  const playErrorSound = () => {
    if (!enableSound || isMuted) return;
    try {
      const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBSuBzvLZiTYIG2m98OScTgwOUarm7blmGgU7k9n1unEiBC13yO/eizEIHWq+8+OWT');
      audio.volume = 0.5;
      audio.play().catch(() => {}); // Ignore errors if audio fails
    } catch (error) {
      // Ignore audio errors
    }
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    
    // Clear previous timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set a timeout to detect when barcode scanner finishes (usually adds Enter key)
    timeoutRef.current = setTimeout(() => {
      if (newValue.trim() && newValue.length >= 8) { // Most barcodes are 8+ characters
        handleBarcodeScan(newValue.trim());
      }
    }, 100); // Short delay to catch Enter key from scanner
  };

  // Handle key press for manual entry
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && value.trim()) {
      e.preventDefault();
      handleBarcodeScan(value.trim());
    }
  };

  // Process barcode scan
  const handleBarcodeScan = (barcode: string) => {
    if (disabled || !barcode) return;

    setIsScanning(true);
    setLastScanned(barcode);
    setScanCount(prev => prev + 1);
    
    try {
      // Validate barcode format
      if (isValidBarcode(barcode)) {
        playSuccessSound();
        onScan(barcode);
        setValue('');
        
        // Show success feedback
        if (showStatus) {
          toast.success(`Barcode scanned: ${barcode}`, {
            duration: 2000,
            icon: <CheckCircle className="w-4 h-4" />
          });
        }
      } else {
        playErrorSound();
        if (showStatus) {
          toast.error(`Invalid barcode format: ${barcode}`, {
            duration: 3000,
            icon: <AlertCircle className="w-4 h-4" />
          });
        }
      }
    } catch (error) {
      playErrorSound();
      console.error('Barcode scan error:', error);
      if (showStatus) {
        toast.error('Error processing barcode scan');
      }
    } finally {
      setIsScanning(false);
    }
  };

  // Validate barcode format
  const isValidBarcode = (barcode: string): boolean => {
    // EAN-13: 13 digits
    if (/^\d{13}$/.test(barcode)) return true;
    
    // UPC-A: 12 digits
    if (/^\d{12}$/.test(barcode)) return true;
    
    // Code 128: 1-48 alphanumeric characters
    if (/^[A-Za-z0-9\-\.\/\+\s]{1,48}$/.test(barcode)) return true;
    
    // Code 39: 1-43 alphanumeric characters
    if (/^[A-Z0-9\-\.\/\+\s]{1,43}$/.test(barcode)) return true;
    
    // QR Code: variable length (more permissive)
    if (barcode.length <= 100) return true;
    
    return false;
  };

  // Auto-focus management
  useEffect(() => {
    if (autoFocus && inputRef.current && !disabled) {
      inputRef.current.focus();
    }
  }, [autoFocus, disabled]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const sizeClasses = {
    sm: 'h-8 text-sm',
    md: 'h-10 text-base',
    lg: 'h-12 text-lg'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="flex items-center gap-2 text-sm font-medium">
          <Scan className={cn("text-blue-600", iconSizes[size])} />
          {label}
          {scanCount > 0 && (
            <span className="text-xs text-gray-500">
              ({scanCount} scans)
            </span>
          )}
        </Label>
      )}
      
      <div className="relative">
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyPress={handleKeyPress}
          placeholder={placeholder}
          disabled={disabled || isScanning}
            className={cn(
            "pr-20 transition-all duration-200",
              sizeClasses[size],
            isScanning && "ring-2 ring-blue-500 ring-opacity-50",
            lastScanned && "border-green-500 bg-green-50"
          )}
        />
        
        {/* Status indicators */}
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
          {isScanning && (
            <Loader2 className={cn("animate-spin text-blue-600", iconSizes[size])} />
          )}
          
          {lastScanned && !isScanning && (
            <CheckCircle className={cn("text-green-600", iconSizes[size])} />
          )}
          
          {/* Sound toggle */}
          {enableSound && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsMuted(!isMuted)}
              className="h-6 w-6 p-0 hover:bg-gray-100"
              title={isMuted ? "Enable sound" : "Mute sound"}
            >
              {isMuted ? (
                <VolumeX className="w-3 h-3 text-gray-400" />
              ) : (
                <Volume2 className="w-3 h-3 text-gray-600" />
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Instructions */}
      {showInstructions && (
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Connect USB barcode scanner or type manually</p>
          <p>• Supported formats: EAN-13, UPC-A, Code 128, Code 39</p>
          <p>• Press Enter to submit manually entered barcodes</p>
        </div>
      )}

      {/* Last scanned display */}
      {lastScanned && showStatus && (
        <div className="text-xs text-green-600 bg-green-50 p-2 rounded">
          Last scanned: <span className="font-mono">{lastScanned}</span>
        </div>
      )}
    </div>
  );
} 