'use client';

import { createContext, useContext, useEffect } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes/dist/types';
import { useAuth } from '@/contexts/AuthContext';
import { UserService } from '@/services/userService';

interface ThemeContextType {
  syncThemeWithProfile: (theme: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function ThemeSync() {
  const { user, userProfile } = useAuth();
  const { setTheme, theme } = useTheme();

  // Sync theme from user profile on mount
  useEffect(() => {
    if (userProfile?.preferences?.theme && userProfile.preferences.theme !== theme) {
      setTheme(userProfile.preferences.theme);
    }
  }, [userProfile?.preferences?.theme, setTheme, theme]);

  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const { user, userProfile } = useAuth();

  const syncThemeWithProfile = async (theme: string) => {
    if (user && userProfile) {
      try {
        await UserService.updateUserProfile(user.uid, {
          preferences: {
            ...userProfile.preferences,
            theme: theme as 'light' | 'dark' | 'system'
          }
        });
      } catch (error) {
        console.error('Failed to sync theme with profile:', error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ syncThemeWithProfile }}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        disableTransitionOnChange
        {...props}
      >
        <ThemeSync />
        {children}
      </NextThemesProvider>
    </ThemeContext.Provider>
  );
}

export const useThemeContext = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useThemeContext must be used within a ThemeProvider');
  }
  return context;
};
