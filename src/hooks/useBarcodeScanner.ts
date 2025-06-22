import { useState, useCallback, useRef, useEffect } from 'react';

export interface BarcodeScannerOptions {
  onScan: (barcode: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
  debounceMs?: number;
  validateFormat?: boolean;
  onError?: (error: string) => void;
}

export interface BarcodeScannerState {
  isScanning: boolean;
  lastScanned: string | null;
  error: string | null;
  inputValue: string;
}

// Common barcode format validators
export const BARCODE_VALIDATORS = {
  'EAN-13': /^\d{13}$/,
  'UPC-A': /^\d{12}$/,
  'CODE-128': /^[A-Za-z0-9\-\.\/\+\s]{1,48}$/,
  'CODE-39': /^[A-Z0-9\-\.\/\+\s]{1,43}$/,
  'ANY': /^.+$/ // Accept any non-empty string
};

export function useBarcodeScanner(options: BarcodeScannerOptions) {
  const {
    onScan,
    autoFocus = true,
    placeholder = "Scan barcode...",
    debounceMs = 100,
    validateFormat = true,
    onError
  } = options;

  const [state, setState] = useState<BarcodeScannerState>({
    isScanning: false,
    lastScanned: null,
    error: null,
    inputValue: ''
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();
  const lastScanTimeRef = useRef<number>(0);

  // Validate barcode format
  const validateBarcode = useCallback((barcode: string): boolean => {
    if (!validateFormat) return true;
    
    // Check against common formats
    for (const [format, validator] of Object.entries(BARCODE_VALIDATORS)) {
      if (validator.test(barcode)) {
        return true;
      }
    }
    
    return false;
  }, [validateFormat]);

  // Process scanned barcode
  const processBarcode = useCallback((barcode: string) => {
    const now = Date.now();
    
    // Prevent duplicate scans (scanners often send multiple events)
    if (now - lastScanTimeRef.current < 500) {
      return;
    }
    
    lastScanTimeRef.current = now;
    
    // Clean the barcode (remove whitespace and special characters)
    const cleanBarcode = barcode.trim();
    
    if (!cleanBarcode) {
      setState(prev => ({ ...prev, error: 'Empty barcode' }));
      onError?.('Empty barcode');
      return;
    }
    
    if (!validateBarcode(cleanBarcode)) {
      setState(prev => ({ ...prev, error: 'Invalid barcode format' }));
      onError?.('Invalid barcode format');
      return;
    }
    
    // Clear any previous errors
    setState(prev => ({ 
      ...prev, 
      error: null,
      lastScanned: cleanBarcode,
      isScanning: false,
      inputValue: ''
    }));
    
    // Call the onScan callback
    onScan(cleanBarcode);
    
    // Play success sound (optional)
    playSuccessSound();
    
    // Auto-focus back to input for next scan
    if (autoFocus && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [onScan, validateBarcode, autoFocus, onError]);

  // Handle input change
  const handleInputChange = useCallback((value: string) => {
    setState(prev => ({ ...prev, inputValue: value, error: null }));
    
    // Clear previous timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    // Set new timeout for debounced processing
    debounceTimeoutRef.current = setTimeout(() => {
      if (value.trim()) {
        setState(prev => ({ ...prev, isScanning: true }));
        processBarcode(value);
      }
    }, debounceMs);
  }, [processBarcode, debounceMs]);

  // Handle key press (for Enter key from scanner)
  const handleKeyPress = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const value = (event.target as HTMLInputElement).value;
      if (value.trim()) {
        setState(prev => ({ ...prev, isScanning: true }));
        processBarcode(value);
      }
    }
  }, [processBarcode]);

  // Handle manual input submission
  const handleManualSubmit = useCallback(() => {
    if (state.inputValue.trim()) {
      setState(prev => ({ ...prev, isScanning: true }));
      processBarcode(state.inputValue);
    }
  }, [state.inputValue, processBarcode]);

  // Clear error
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  // Reset scanner state
  const reset = useCallback(() => {
    setState({
      isScanning: false,
      lastScanned: null,
      error: null,
      inputValue: ''
    });
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
  }, []);

  // Auto-focus on mount
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    ...state,
    
    // Refs
    inputRef,
    
    // Handlers
    handleInputChange,
    handleKeyPress,
    handleManualSubmit,
    
    // Actions
    clearError,
    reset,
    
    // Props for input element
    inputProps: {
      ref: inputRef,
      value: state.inputValue,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => handleInputChange(e.target.value),
      onKeyPress: handleKeyPress,
      placeholder,
      autoFocus,
      'aria-label': 'Barcode scanner input',
      'data-testid': 'barcode-input'
    }
  };
}

// Utility function to play success sound
function playSuccessSound() {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.1);
  } catch (error) {
    // Fallback: silent failure if audio is not supported
    console.debug('Audio feedback not available');
  }
} 