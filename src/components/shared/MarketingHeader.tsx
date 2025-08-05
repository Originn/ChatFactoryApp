'use client';

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Home, Menu, X } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

interface MarketingHeaderProps {
  showHomeButton?: boolean;
  showAuthButtons?: boolean;
  currentPage?: 'home' | 'login' | 'signup';
  className?: string;
}

export default function MarketingHeader({ 
  showHomeButton = false, 
  showAuthButtons = true,
  currentPage = 'home',
  className = ""
}: MarketingHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  return (
    <header className={`bg-background/80 backdrop-blur-sm border-b border-border/20 shadow-sm sticky top-0 z-50 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo section - responsive */}
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <img src="/logo.svg" alt="WizeChat" className="h-10 w-10" />
              {/* Hide text on mobile, show on desktop */}
              <div className="font-bold text-xl text-gradient hidden sm:block">WizeChat</div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex md:items-center md:space-x-8">
            <Link 
              href="/#features" 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Features
            </Link>
            <Link 
              href="/#pricing" 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Pricing
            </Link>
            <Link 
              href="/#contact" 
              className="text-muted-foreground hover:text-foreground transition-colors text-sm font-medium"
            >
              Contact
            </Link>
          </nav>
          
          {/* Right section with actions */}
          <div className="flex items-center space-x-1 sm:space-x-4">
            {showHomeButton && (
              <Link href="/">
                <Button variant="ghost" className="text-foreground hover:bg-muted">
                  <Home className="h-4 w-4 mr-2" />
                  Home
                </Button>
              </Link>
            )}
            
            {/* Theme Toggle - Desktop only */}
            <div className="hidden md:block">
              <ThemeToggle />
            </div>
            
            {showAuthButtons && (
              <>
                {/* Desktop: Show both buttons */}
                <div className="hidden sm:flex sm:space-x-4">
                  <Link href="/login">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className={`${
                        currentPage === 'login' 
                          ? 'bg-muted text-foreground'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                      } transition-colors px-4`}
                    >
                      Login
                    </Button>
                  </Link>
                  <Link href="/signup">
                    <Button 
                      size="sm"
                      className={`${
                        currentPage === 'signup'
                          ? 'bg-purple-600 hover:bg-purple-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      } text-white shadow-lg px-4`}
                    >
                      Sign Up
                    </Button>
                  </Link>
                </div>
                
                {/* Mobile: Single "Get Started" button */}
                <div className="sm:hidden">
                  <Link href="/login">
                    <Button 
                      size="sm"
                      className="bg-blue-600 hover:bg-blue-700 text-white shadow-lg px-3"
                    >
                      Get Started
                    </Button>
                  </Link>
                </div>
              </>
            )}

            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden h-8 w-8 p-0 text-foreground hover:bg-muted"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? (
                <X className="h-4 w-4" />
              ) : (
                <Menu className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-border/20 bg-background/90 backdrop-blur-sm">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {/* Mobile Theme Toggle - at the top */}
              <div className="px-3 py-2 mb-2">
                <div className="flex items-center justify-between">
                  <span className="text-base font-medium text-muted-foreground">
                    Theme
                  </span>
                  <ThemeToggle />
                </div>
              </div>
              
              {/* Navigation Links */}
              <div className="border-t border-border/20 pt-2 space-y-1">
                <Link
                  href="/#features"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground block px-3 py-2 rounded-md text-base font-medium transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Features
                </Link>
                <Link
                  href="/#pricing"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground block px-3 py-2 rounded-md text-base font-medium transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link
                  href="/#contact"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground block px-3 py-2 rounded-md text-base font-medium transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Contact
                </Link>
              </div>

              {/* Mobile Auth Buttons */}
              {showAuthButtons && (
                <div className="pt-3 border-t border-border/20 mt-3 space-y-2">
                  <Link
                    href="/login"
                    className={`${
                      currentPage === 'login'
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
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
                <div className="pt-3 border-t border-border/20 mt-3">
                  <Link
                    href="/"
                    className="text-muted-foreground hover:bg-muted hover:text-foreground flex items-center px-3 py-2 rounded-md text-base font-medium transition-colors"
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