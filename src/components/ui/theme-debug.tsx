'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

export function ThemeDebug() {
  const [mounted, setMounted] = useState(false);
  const { theme, resolvedTheme, systemTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div className="fixed bottom-4 left-4 p-3 bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-xs z-50">
      <div><strong>Theme Debug:</strong></div>
      <div>theme: {theme}</div>
      <div>resolvedTheme: {resolvedTheme}</div>
      <div>systemTheme: {systemTheme}</div>
      <div>HTML class: {typeof document !== 'undefined' ? document.documentElement.className : 'N/A'}</div>
    </div>
  );
}
