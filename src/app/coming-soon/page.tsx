'use client';

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, Sparkles, Zap, Shield, BarChart3, Mail, Moon, Sun } from "lucide-react";
import { useTheme } from 'next-themes';
import { useEffect } from 'react';

export default function ComingSoonPage() {
  const [email, setEmail] = useState('');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme, resolvedTheme } = useTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();

      if (response.ok) {
        setIsSubscribed(true);
        setEmail('');
        console.log('✅ Waitlist signup successful:', result.message);
      } else {
        console.error('❌ Waitlist signup failed:', result.error);
        // Could add error state handling here
      }
    } catch (error) {
      console.error('❌ Waitlist signup error:', error);
      // Could add error state handling here
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      {/* Background Gradient Mesh */}
      <div className="absolute inset-0 gradient-mesh opacity-50" />
      
      {/* Header */}
      <header className="relative z-10 flex justify-between items-center p-6 max-w-7xl mx-auto">
        <div className="flex items-center space-x-3">
          <img src="/logo.svg" alt="WizeChat" className="h-10 w-10" />
          <div className="font-bold text-xl text-gradient">WizeChat</div>
        </div>
        {mounted && (
          <Button
            variant="outline"
            size="icon"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            className="h-8 w-8"
          >
            {resolvedTheme === 'dark' ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>
        )}
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-100px)] px-6">
        
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-16 animate-fade-in">
          <div className="mb-8 animate-float">
            <img src="/logo.svg" alt="WizeChat" className="h-24 w-24 mx-auto mb-6" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold mb-6 text-gradient leading-tight">
            Something Amazing<br />is Coming Soon
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            We're building the future of AI-powered documentation. Transform your static docs into intelligent, conversational experiences that your users will love.
          </p>
          
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-card mb-8">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <span className="font-medium">Launching Q1 2025</span>
          </div>
        </div>

        {/* Feature Preview Cards */}
        <div className="grid md:grid-cols-3 gap-6 mb-16 max-w-6xl mx-auto w-full">
          {[
            {
              icon: <Zap className="h-8 w-8" />,
              title: "Instant AI Answers",
              description: "Your documentation becomes an intelligent assistant that provides instant, accurate responses to user questions.",
              gradient: "card-premium"
            },
            {
              icon: <Shield className="h-8 w-8" />,
              title: "Privacy-First Design", 
              description: "Your data stays secure with enterprise-grade privacy controls and on-premise deployment options.",
              gradient: "card-elevated"
            },
            {
              icon: <BarChart3 className="h-8 w-8" />,
              title: "Advanced Analytics",
              description: "Deep insights into user questions, popular content, and chatbot performance to improve your docs.",
              gradient: "card-glow"
            }
          ].map((feature, index) => (
            <Card key={index} className={`${feature.gradient} card-interactive animate-scale-in`} style={{animationDelay: `${index * 0.1}s`}}>
              <CardContent className="p-6 text-center">
                <div className="mb-4 text-purple-500 flex justify-center">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Email Signup Section */}
        <div className="w-full max-w-xl mx-auto mb-12">
          {!isSubscribed ? (
            <Card className="glass-card p-8 text-center">
              <CardContent className="p-0">
                <div className="mb-6">
                  <Mail className="h-12 w-12 text-purple-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold mb-2">Get Early Access</h3>
                  <p className="text-muted-foreground">
                    Be the first to experience the future of AI documentation. Join our waitlist for exclusive early access and special launch pricing.
                  </p>
                </div>
                
                <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
                  <Input
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1"
                    required
                  />
                  <Button 
                    type="submit" 
                    disabled={isLoading}
                    className="gradient-primary text-white font-medium px-8 py-2 safe-animation"
                  >
                    {isLoading ? 'Joining...' : 'Join Waitlist'}
                  </Button>
                </form>
                
                <p className="text-xs text-muted-foreground mt-3">
                  No spam, unsubscribe at any time. We respect your privacy.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="card-glow p-8 text-center animate-scale-in">
              <CardContent className="p-0">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold mb-2 text-gradient">You're In!</h3>
                <p className="text-muted-foreground mb-4">
                  Welcome to the WizeChat early access list. We'll notify you as soon as we launch with exclusive benefits and special pricing.
                </p>
                <p className="text-sm text-muted-foreground">
                  Keep an eye on your inbox for updates and behind-the-scenes content.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Social Proof */}
        <div className="text-center">
          <div className="inline-flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse-soft"></div>
              <span>1000+ developers waiting</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse-soft"></div>
              <span>Coming Q1 2025</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center p-6 text-sm text-muted-foreground border-t border-border/20 mt-16">
        <div className="max-w-7xl mx-auto">
          <p>&copy; {new Date().getFullYear()} WizeChat. All rights reserved.</p>
          <div className="flex justify-center items-center gap-4 mt-2">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <span>•</span>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
            <span>•</span>
            <a href="mailto:hello@wizechat.ai" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}