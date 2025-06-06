'use client';

import { useEffect, useState } from 'react';
import { useGlobalProductCache } from '@/lib/hooks/useGlobalProductCache';

export function GlobalProductCache() {
  const [isMounted, setIsMounted] = useState(false);
  useGlobalProductCache();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return null;
} 