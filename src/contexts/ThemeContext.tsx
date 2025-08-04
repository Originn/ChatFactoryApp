'use client';

import { createContext, useContext, useEffect } from 'react';
import { ThemeProvider as NextThemesProvider, useTheme } from 'next-themes';
import { type ThemeProviderProps } from 'next-themes';
import { useAuth } from '@/contexts/AuthContext';
import { UserService } from '@/services/userService';

interface ThemeContextType {
  syncThemeWithProfile: (theme: string) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function ThemeSync() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const { setTheme, theme } = useTheme();

  // Only sync theme from user profile on initial load, not on every theme change
  useEffect(() => {
    if (authLoading || !user || !userProfile) return; // Wait for auth and profile to be ready
    
    // Only set theme from profile if it's different and we haven't set a theme yet
    if (userProfile.preferences?.theme && 
        userProfile.preferences.theme !== theme && 
        theme === 'system') { // Only change from default system theme
      setTheme(userProfile.preferences.theme);
    }
  }, [user, userProfile, authLoading, setTheme, theme]);

  return null;
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  const { user, userProfile, loading: authLoading } = useAuth();

  const syncThemeWithProfile = async (theme: string) => {
    console.log('🔄 Sync theme with profile requested:', theme);
    console.log('🔄 User:', !!user);
    console.log('🔄 UserProfile:', !!userProfile);
    console.log('🔄 AuthLoading:', authLoading);
    
    // Only sync if user is authenticated and profile is loaded
    if (!user || !userProfile || authLoading) {
      console.log('🔄 Skipping theme sync - auth not ready');
      return;
    }

    try {
      await UserService.updateUserProfile(user.uid, {
        preferences: {
          ...userProfile.preferences,
          theme: theme as 'light' | 'dark' | 'system'
        }
      });
      console.log('🔄 Theme synced with profile:', theme);
    } catch (error) {
      console.error('🔄 Failed to sync theme with profile:', error);
    }
  };

  return (
    <ThemeContext.Provider value={{ syncThemeWithProfile }}>
      <NextThemesProvider
        attribute="class"
        defaultTheme="system"
        enableSystem
        storageKey="chatfactory-theme"
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
    // Return a safe default instead of throwing
    return {
      syncThemeWithProfile: async (theme: string) => {
        console.log('Theme context not available, skipping sync');
      }
    };
  }
  return context;
};
