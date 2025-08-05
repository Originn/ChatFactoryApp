'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Home, Crown, AlertTriangle, Menu, X, LogOut, Plus } from "lucide-react";
import { useState } from "react";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useAuth } from "@/contexts/AuthContext";

interface HeaderProps {
  showHomeButton?: boolean;
  showAuthButtons?: boolean;
  showDashboardNav?: boolean;
  showCreateButton?: boolean;
  variant?: 'light' | 'dark' | 'dashboard';
  currentPage?: 'dashboard' | 'chatbots' | 'settings';
  className?: string;
}

export default function Header({ 
  showHomeButton = false, 
  showAuthButtons = false,
  showDashboardNav = false,
  showCreateButton = false,
  variant = 'light',
  currentPage = 'dashboard',
  className = ""
}: HeaderProps) {
  const { user, userProfile, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isDark = variant === 'dark';
  const isDashboard = variant === 'dashboard';

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Dashboard header variant
  if (isDashboard) {
    return (
      <header className="relative z-50 backdrop-blur-sm bg-background/70 border-b border-border/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Left section with logo */}
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                <img src="/logo.svg" alt="WizeChat" className="h-10 w-10" />
                <div className="font-bold text-xl text-gradient">WizeChat</div>
              </div>
              
              {/* Free plan badge - hidden on mobile, shown on tablet+ */}
              {userProfile?.subscription.plan === 'free' && (
                <div className="hidden md:flex items-center space-x-3 ml-4">
                  <Badge variant="secondary" className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-800 dark:to-blue-800 text-purple-900 dark:text-purple-100 border-2 border-purple-400 dark:border-purple-500 shadow-md font-bold">
                    <Crown className="h-3 w-3 mr-1 text-purple-800 dark:text-purple-200" />
                    Free Plan
                  </Badge>
                  <div className="flex items-center space-x-2 bg-background/60 rounded-full px-3 py-1 backdrop-blur-sm">
                    <span className="text-xs text-muted-foreground">Queries:</span>
                    <span className="text-xs font-semibold text-foreground">
                      {userProfile.usage.monthlyQueries || 0}/100
                    </span>
                    {((userProfile.usage.monthlyQueries || 0) / 100) >= 0.8 && (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop Navigation */}
            {showDashboardNav && (
              <nav className="hidden lg:flex lg:space-x-8">
                <Link
                  href="/dashboard"
                  className={`${
                    currentPage === 'dashboard'
                      ? 'border-purple-500 text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/chatbots"
                  className={`${
                    currentPage === 'chatbots'
                      ? 'border-purple-500 text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                >
                  Chatbots
                </Link>
                <Link
                  href="/dashboard/settings"
                  className={`${
                    currentPage === 'settings'
                      ? 'border-purple-500 text-foreground'
                      : 'border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors`}
                >
                  Settings
                </Link>
                {userProfile?.subscription.plan === 'free' && (
                  <Link
                    href="/dashboard/settings/billing"
                    className="border-transparent text-purple-600 hover:text-purple-800 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium hover:border-purple-300 transition-colors"
                  >
                    <Crown className="h-4 w-4 mr-1" />
                    Upgrade
                  </Link>
                )}
              </nav>
            )}

            {/* Right section with actions */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Create button - responsive sizing */}
              {showCreateButton && (
                <Button
                  asChild
                  variant="gradient"
                  className="shadow-lg shadow-purple-500/25 h-10 sm:h-11"
                  size="sm"
                >
                  <Link href="/dashboard/chatbots/new">
                    <Plus className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Create New Chatbot</span>
                    <span className="sm:hidden">Create</span>
                  </Link>
                </Button>
              )}
              
              {/* Mobile menu button */}
              <Button
                variant="ghost"
                size="icon"
                className="lg:hidden h-10 w-10"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                {isMobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </Button>
              
              {/* User dropdown - hidden on small mobile, shown on larger screens */}
              <div className="hidden sm:block">
                <UserDropdown />
              </div>
            </div>
          </div>

          {/* Mobile Navigation Menu */}
          {isMobileMenuOpen && showDashboardNav && (
            <div className="lg:hidden border-t border-border/20 bg-background/80 backdrop-blur-sm">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <Link
                  href="/dashboard"
                  className={`${
                    currentPage === 'dashboard'
                      ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-200'
                      : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:border-muted-foreground/50 hover:text-foreground'
                  } block pl-3 pr-4 py-3 border-l-4 text-base font-medium rounded-r-lg transition-colors`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/chatbots"
                  className={`${
                    currentPage === 'chatbots'
                      ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-200'
                      : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:border-muted-foreground/50 hover:text-foreground'
                  } block pl-3 pr-4 py-3 border-l-4 text-base font-medium rounded-r-lg transition-colors`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Chatbots
                </Link>
                <Link
                  href="/dashboard/settings"
                  className={`${
                    currentPage === 'settings'
                      ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-700 dark:text-purple-200'
                      : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:border-muted-foreground/50 hover:text-foreground'
                  } block pl-3 pr-4 py-3 border-l-4 text-base font-medium rounded-r-lg transition-colors`}
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Settings
                </Link>
                {userProfile?.subscription.plan === 'free' && (
                  <Link
                    href="/dashboard/settings/billing"
                    className="border-transparent text-purple-600 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700 block pl-3 pr-4 py-3 border-l-4 text-base font-medium rounded-r-lg transition-colors"
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className="flex items-center">
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade to Pro
                    </div>
                  </Link>
                )}
              </div>
              
              {/* Mobile user section */}
              <div className="pt-4 pb-3 border-t border-white/20">
                <div className="flex items-center px-4 space-x-3">
                  <div className="flex-shrink-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                      <span className="text-white font-medium text-sm">
                        {user?.displayName?.charAt(0) || user?.email?.charAt(0) || '?'}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-base font-medium text-foreground">
                      {user?.displayName || 'User'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {user?.email}
                    </div>
                  </div>
                </div>
                
                {/* Mobile plan info */}
                {userProfile?.subscription.plan === 'free' && (
                  <div className="mt-3 px-4">
                    <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-800 dark:to-blue-800 rounded-lg border-2 border-purple-400 dark:border-purple-500 shadow-md">
                      <div className="flex items-center space-x-2">
                        <Crown className="h-4 w-4 text-purple-800 dark:text-purple-200" />
                        <span className="text-sm font-bold text-purple-900 dark:text-purple-100">Free Plan</span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {userProfile.usage.monthlyQueries || 0}/100 queries
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Mobile logout button */}
                <div className="mt-3 px-4">
                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </header>
    );
  }
  
  // Standard header variants (light/dark)
  return (
    <header className={`${isDark ? 'fixed w-full top-0 z-10 bg-gray-900/80 backdrop-blur-sm' : 'bg-card border-b border-border'} py-4 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
        <Link href="/" className="flex items-center space-x-3">
          <img src="/logo.svg" alt="WizeChat" className="h-10 w-10" />
          <div className={`font-bold text-xl ${isDark ? 'text-white' : 'text-foreground'}`}>WizeChat</div>
        </Link>
        
        <nav className="flex items-center space-x-2">
          {showHomeButton && (
            <Link href="/">
              <Button variant="ghost" className={`${isDark ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-muted'}`}>
                <Home className="h-4 w-4 mr-2" />
                Home
              </Button>
            </Link>
          )}
          
          {showAuthButtons && (
            <>
              <Link href="/login">
                <Button variant="ghost" className={`mr-2 ${isDark ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-muted'}`}>
                  Login
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="bg-blue-600 hover:bg-blue-700">Sign Up</Button>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}