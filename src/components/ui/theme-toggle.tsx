'use client';

import { Moon, Sun, Monitor } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { useState, useEffect } from 'react';
import { useThemeContext } from '@/contexts/ThemeContext';

interface ThemeToggleProps {
  showLabel?: boolean;
  variant?: 'icon' | 'dropdown' | 'settings';
}

export function ThemeToggle({ showLabel = false, variant = 'icon' }: ThemeToggleProps) {
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { syncThemeWithProfile } = useThemeContext();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleThemeChange = async (newTheme: string) => {
    // Prevent setting the same theme
    if (newTheme === theme) return;
    
    console.log('🎨 Theme change requested:', newTheme);
    console.log('🎨 Current theme before change:', theme);
    
    // Set theme immediately for instant UI feedback
    setTheme(newTheme);
    
    // Sync with user profile in background (don't await to prevent UI blocking)
    syncThemeWithProfile(newTheme).catch(error => {
      console.error('🎨 Failed to sync theme with profile:', error);
    });
    
    console.log('🎨 Theme change applied instantly');
  };

  if (!mounted) {
    return <Button variant="outline" size="icon" disabled><Sun className="h-4 w-4" /></Button>;
  }

  if (variant === 'settings') {
    return (
      <div className="space-y-3">
        <h4 className="text-sm font-medium">Theme Preference</h4>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={theme === 'light' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleThemeChange('light')}
            className="flex flex-col items-center gap-2 h-16"
          >
            <Sun className="h-4 w-4" />
            <span className="text-xs">Light</span>
          </Button>
          <Button
            variant={theme === 'dark' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleThemeChange('dark')}
            className="flex flex-col items-center gap-2 h-16"
          >
            <Moon className="h-4 w-4" />
            <span className="text-xs">Dark</span>
          </Button>
          <Button
            variant={theme === 'system' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleThemeChange('system')}
            className="flex flex-col items-center gap-2 h-16"
          >
            <Monitor className="h-4 w-4" />
            <span className="text-xs">System</span>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Choose your preferred theme or follow your system setting
        </p>
      </div>
    );
  }

  if (variant === 'dropdown') {
    return (
      <div className="space-y-1">
        <button
          onClick={() => handleThemeChange('light')}
          className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${
            theme === 'light' 
              ? 'bg-blue-50 text-blue-700' 
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Sun className="h-4 w-4 mr-2" />
          Light Theme
        </button>
        <button
          onClick={() => handleThemeChange('dark')}
          className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${
            theme === 'dark' 
              ? 'bg-blue-50 text-blue-700' 
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Moon className="h-4 w-4 mr-2" />
          Dark Theme
        </button>
        <button
          onClick={() => handleThemeChange('system')}
          className={`flex items-center w-full px-3 py-2 text-sm rounded-md transition-colors ${
            theme === 'system' 
              ? 'bg-blue-50 text-blue-700' 
              : 'text-gray-700 hover:bg-gray-50'
          }`}
        >
          <Monitor className="h-4 w-4 mr-2" />
          System Theme
        </button>
      </div>
    );
  }

  // Default icon variant
  return (
    <Button
      variant="outline"
      size="icon"
      onClick={() => handleThemeChange(resolvedTheme === 'dark' ? 'light' : 'dark')}
      className="h-8 w-8"
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className="h-4 w-4" />
      )}
    </Button>
  );
}
