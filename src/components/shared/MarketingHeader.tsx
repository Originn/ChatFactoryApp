'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface MarketingHeaderProps {
  showHomeButton?: boolean;
  showAuthButtons?: boolean;
  variant?: 'light' | 'dark';
  currentPage?: 'home' | 'login' | 'signup';
  className?: string;
}

export default function MarketingHeader({ 
  showHomeButton = false, 
  showAuthButtons = true,
  variant = 'dark',
  currentPage = 'home',
  className = ""
}: MarketingHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const isDark = variant === 'dark';
  
  return (
    <header className={`${isDark ? 'fixed w-full top-0 z-50' : ''} bg-background/80 backdrop-blur-sm border-b border-border/20 shadow-sm ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo section - fixed position */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <img src="/logo.svg" alt="WizeChat" className="h-10 w-10" />
              <div className="font-bold text-xl text-gradient">WizeChat</div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex md:items-center md:space-x-8">
            <Link 
              href="/#features" 
              className={`${isDark ? 'text-gray-300 hover:text-white' : 'text-muted-foreground hover:text-foreground'} transition-colors text-sm font-medium`}
            >
              Features
            </Link>
            <Link 
              href="/#pricing" 
              className={`${isDark ? 'text-gray-300 hover:text-white' : 'text-muted-foreground hover:text-foreground'} transition-colors text-sm font-medium`}
            >
              Pricing
            </Link>
            <Link 
              href="/#contact" 
              className={`${isDark ? 'text-gray-300 hover:text-white' : 'text-muted-foreground hover:text-foreground'} transition-colors text-sm font-medium`}
            >
              Contact
            </Link>
          </nav>
          
          {/* Right section with actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {showHomeButton && (
              <Link href="/">
                <Button variant="ghost" className={`${isDark ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-muted'}`}>
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Button>
              </Link>
            )}
            
            {/* Theme Toggle - with proper visibility styling */}
            <div className={`${isDark ? '[&_button]:border-white/20 [&_button]:hover:bg-white/10 [&_button]:text-white' : ''}`}>
              <ThemeToggle />
            </div>
            
            {showAuthButtons && (
              <>
                <Link href="/login">
                  <Button 
                    variant="ghost" 
                    className={`${
                      currentPage === 'login' 
                        ? (isDark ? 'bg-white/20 text-white' : 'bg-muted text-foreground')
                        : (isDark ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-muted')
                    } transition-colors`}
                  >
                    Login
                  </Button>
                </Link>
                <Link href="/signup">
                  <Button 
                    className={`${
                      currentPage === 'signup'
                        ? 'bg-purple-600 hover:bg-purple-700'
                        : 'bg-blue-600 hover:bg-blue-700'
                    } text-white shadow-lg`}
                  >
                    Sign Up
                  </Button>
                </Link>
              </>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="icon"
              className={`md:hidden h-10 w-10 ${isDark ? 'text-white hover:bg-white/10' : 'text-foreground hover:bg-muted'}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className={`md:hidden border-t ${isDark ? 'border-gray-800/50 bg-gray-900/90' : 'border-border/20 bg-background/90'} backdrop-blur-sm`}>
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link
                href="/#features"
                className={`${isDark ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'} block px-3 py-2 rounded-md text-base font-medium transition-colors`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Features
              </Link>
              <Link
                href="/#pricing"
                className={`${isDark ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'} block px-3 py-2 rounded-md text-base font-medium transition-colors`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="/#contact"
                className={`${isDark ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'} block px-3 py-2 rounded-md text-base font-medium transition-colors`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                Contact
              </Link>
              
              {/* Mobile Theme Toggle */}
              <div className={`pt-3 border-t ${isDark ? 'border-gray-800/50' : 'border-border/20'} mt-3`}>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className={`text-base font-medium ${isDark ? 'text-gray-300' : 'text-muted-foreground'}`}>
                    Theme
                  </span>
                  <div className={`${isDark ? '[&_button]:border-white/20 [&_button]:hover:bg-white/10 [&_button]:text-white' : ''}`}>
                    <ThemeToggle />
                  </div>
                </div>
              </div>

              {/* Mobile Auth Buttons */}
              {showAuthButtons && (
                <div className={`pt-3 border-t ${isDark ? 'border-gray-800/50' : 'border-border/20'} mt-3 space-y-2`}>
                  <Link
                    href="/login"
                    className={`${
                      currentPage === 'login'
                        ? (isDark ? 'bg-white/20 text-white' : 'bg-muted text-foreground')
                        : (isDark ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground')
                    } block px-3 py-2 rounded-md text-base font-medium transition-colors`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Login
                  </Link>
                  <Link
                    href="/signup"
                    className={`${
                      currentPage === 'signup'
                        ? 'bg-purple-600 text-white'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    } block px-3 py-2 rounded-md text-base font-medium transition-colors`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    Sign Up
                  </Link>
                </div>
              )}

              {showHomeButton && (
                <div className={`pt-3 border-t ${isDark ? 'border-gray-800/50' : 'border-border/20'} mt-3`}>
                  <Link
                    href="/"
                    className={`${isDark ? 'text-gray-300 hover:bg-white/10 hover:text-white' : 'text-muted-foreground hover:bg-muted hover:text-foreground'} flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <Home className="h-4 w-4 mr-2" />
                    Home
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}