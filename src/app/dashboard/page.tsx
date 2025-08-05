'use client';

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { useAuth } from "@/contexts/AuthContext";
import { UsageOverviewCard, UsageAnalyticsChart } from "@/components/deployment/UsageDashboards";
import { UsageWarningBanner } from "@/components/deployment/UsageBanners";
import { db } from "@/lib/firebase/config";
import { collection, query, where, getDocs, orderBy, limit } from "firebase/firestore";
import { 
  Crown, 
  AlertTriangle, 
  Zap, 
  CheckCircle, 
  TrendingUp, 
  Globe, 
  BarChart3,
  Plus,
  FileText,
  Sparkles,
  Activity,
  Users,
  MessageCircle,
  Target,
  ArrowUpRight,
  Bot,
  Upload,
  Settings,
  Star,
  Rocket,
  Menu,
  X,
  LogOut
} from "lucide-react";
import { useRouter } from 'next/navigation';

// Define the Chatbot type
interface Chatbot {
  id: string;
  name: string;
  description: string;
  status: string;
  createdAt: any;
  updatedAt: any;
  documents?: any[];
  stats?: {
    queries: number;
    successRate: number;
  };
}

export default function DashboardPage() {
  const { user, userProfile, loading: authLoading, signOut } = useAuth();
  const router = useRouter();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const hasFetchedRef = useRef(false);
  const [stats, setStats] = useState({
    totalChatbots: 0,
    totalDocuments: 0,
    totalQueries: 0,
    successRate: 0
  });

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    // Reset fetch flag when user changes
    hasFetchedRef.current = false;
    
    async function fetchData() {
      if (!user?.uid || hasFetchedRef.current) {
        return;
      }
      
      hasFetchedRef.current = true;
      setIsLoading(true);
      
      try {
        // Fetch chatbots (limited to 5 most recent)
        const chatbotsQuery = query(
          collection(db, "chatbots"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(5)
        );
        
        const chatbotsSnapshot = await getDocs(chatbotsQuery);
        const chatbotsList: Chatbot[] = [];
        let totalDocs = 0;
        let totalQueries = 0;
        let successRateSum = 0;
        let successRateCount = 0;
        
        chatbotsSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Chatbot, 'id'>;
          chatbotsList.push({
            id: doc.id,
            ...data
          });
          
          // Accumulate stats
          totalDocs += (data.documents?.length || 0);
          totalQueries += (data.stats?.queries || 0);
          
          if (data.stats?.successRate !== undefined) {
            successRateSum += data.stats.successRate;
            successRateCount++;
          }
        });
        
        setChatbots(chatbotsList);
        
        // Update stats
        setStats({
          totalChatbots: chatbotsSnapshot.size,
          totalDocuments: totalDocs,
          totalQueries: totalQueries,
          successRate: successRateCount ? Math.round(successRateSum / successRateCount) : 0
        });
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [user?.uid]);

  const handleUpgrade = () => {
    window.location.href = '/dashboard/settings/billing?upgrade=pro&source=dashboard';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background relative overflow-hidden dark:from-background dark:via-muted/20 dark:to-background">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20" />
      
      {/* Dashboard Header */}
      <header className="relative z-50 backdrop-blur-sm bg-background/70 border-b border-border/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            {/* Left section with logo */}
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                <img src="/logo.png" alt="WizeChat" className="h-10 w-10" />
                <span className="font-bold text-lg sm:text-xl text-gradient">WizeChat</span>
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
            <nav className="hidden lg:flex lg:space-x-8">
              <Link
                href="/dashboard"
                className="border-purple-500 text-foreground inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Dashboard
              </Link>
              <Link
                href="/dashboard/chatbots"
                className="border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors"
              >
                Chatbots
              </Link>
              <Link
                href="/dashboard/settings"
                className="border-transparent text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors"
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

            {/* Right section with actions */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              {/* Create button - responsive sizing */}
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
          {isMobileMenuOpen && (
            <div className="lg:hidden border-t border-border/20 bg-background/80 backdrop-blur-sm">
              <div className="px-2 pt-2 pb-3 space-y-1">
                <Link
                  href="/dashboard"
                  className="bg-purple-50 border-purple-500 text-purple-700 block pl-3 pr-4 py-3 border-l-4 text-base font-medium rounded-r-lg"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/chatbots"
                  className="border-transparent text-muted-foreground hover:bg-muted/50 hover:border-muted-foreground/50 hover:text-foreground block pl-3 pr-4 py-3 border-l-4 text-base font-medium rounded-r-lg transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  Chatbots
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="border-transparent text-muted-foreground hover:bg-muted/50 hover:border-muted-foreground/50 hover:text-foreground block pl-3 pr-4 py-3 border-l-4 text-base font-medium rounded-r-lg transition-colors"
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

      {/* Dashboard Content */}
      <main className="relative max-w-7xl mx-auto py-4 sm:py-6 lg:py-8 px-4 sm:px-6 lg:px-8">
          {/* Welcome Section */}
          <div className="mb-6 sm:mb-8 animate-fade-in">
            <div className="flex flex-col space-y-4 lg:flex-row lg:items-center lg:justify-between lg:space-y-0">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-2">
                  Welcome back, {user?.displayName?.split(' ')[0] || 'there'}! 👋
                </h1>
                <p className="text-muted-foreground text-sm sm:text-base">
                  Here's what's happening with your AI chatbots today.
                </p>
              </div>
              {userProfile?.subscription.plan === 'free' && (
                <div className="lg:hidden">
                  <div className="bg-background/60 backdrop-blur-sm rounded-lg p-3 border border-border/40">
                    <div className="text-sm text-muted-foreground mb-2">Query Usage</div>
                    <div className="flex items-center space-x-3">
                      <Progress 
                        value={((userProfile.usage.monthlyQueries || 0) / 100) * 100} 
                        className="flex-1 h-2"
                      />
                      <span className="text-sm font-medium text-foreground whitespace-nowrap">
                        {userProfile.usage.monthlyQueries || 0}/100
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {userProfile?.subscription.plan === 'free' && (
                <div className="hidden lg:block">
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground mb-1">Your Progress</div>
                    <div className="flex items-center space-x-2">
                      <Progress 
                        value={((userProfile.usage.monthlyQueries || 0) / 100) * 100} 
                        className="w-24 h-2"
                      />
                      <span className="text-xs text-muted-foreground">
                        {100 - (userProfile.usage.monthlyQueries || 0)} left
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          
          {/* Usage Warning Banner - Shows at critical usage levels */}
          {userProfile && (
            <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <UsageWarningBanner 
                user={userProfile} 
                onUpgrade={handleUpgrade} 
              />
            </div>
          )}

          {/* Usage Overview Card - Always visible for free users */}
          {userProfile && userProfile.subscription.plan === 'free' && (
            <div className="mb-8 animate-slide-up" style={{ animationDelay: '0.3s' }}>
              <UsageOverviewCard />
            </div>
          )}
          
          {/* Enhanced Stats Grid */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6 sm:mb-8 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <Card variant="elevated" hover="lift" className="group">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Bot className="h-5 w-5 text-blue-600" />
                    <span className="text-xs sm:text-sm">Total Chatbots</span>
                  </div>
                  {userProfile?.subscription.plan === 'free' && (
                    <Badge variant="outline" className="text-xs text-purple-600 border-purple-200 px-1.5 py-0.5">
                      {userProfile.usage.chatbotsCreated}/2
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 sm:pt-2">
                <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1">{stats.totalChatbots}</div>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center">
                  {userProfile?.subscription.plan === 'free' 
                    ? `${2 - (userProfile.usage.chatbotsCreated || 0)} remaining` 
                    : 'Your AI assistants'}
                  {userProfile?.subscription.plan !== 'free' && <TrendingUp className="h-3 w-3 ml-1 text-green-500" />}
                </p>
              </CardContent>
            </Card>
            
            <Card variant="elevated" hover="lift" className="group">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center space-x-2">
                  <MessageCircle className="h-5 w-5 text-green-600" />
                  <span className="text-xs sm:text-sm">Monthly Queries</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 sm:pt-2">
                <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                  {userProfile?.usage.monthlyQueries || 0}
                  {userProfile?.subscription.plan === 'free' && (
                    <span className="text-base sm:text-lg text-muted-foreground ml-1">/100</span>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center">
                  {userProfile?.subscription.plan === 'free' 
                    ? `${100 - (userProfile.usage.monthlyQueries || 0)} remaining this month`
                    : 'Questions answered this month'}
                  <Activity className="h-3 w-3 ml-1 text-blue-500" />
                </p>
              </CardContent>
            </Card>
            
            <Card variant="elevated" hover="lift" className="group">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-purple-600" />
                  <span className="text-xs sm:text-sm">Total Documents</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 sm:pt-2">
                <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1">{stats.totalDocuments}</div>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center">
                  Knowledge base files
                  <Upload className="h-3 w-3 ml-1 text-purple-500" />
                </p>
              </CardContent>
            </Card>
            
            <Card variant="elevated" hover="lift" className="group">
              <CardHeader className="pb-2 sm:pb-3">
                <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center space-x-2">
                  <Target className="h-5 w-5 text-amber-600" />
                  <span className="text-xs sm:text-sm">Success Rate</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0 sm:pt-2">
                <div className="text-2xl sm:text-3xl font-bold text-foreground mb-1">{stats.successRate}%</div>
                <p className="text-xs sm:text-sm text-muted-foreground flex items-center">
                  Average performance
                  <CheckCircle className="h-3 w-3 ml-1 text-green-500" />
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Free Tier Upgrade Promotion */}
          {userProfile?.subscription.plan === 'free' && (
            <Card variant="premium" className="mb-6 sm:mb-8 animate-slide-up" style={{ animationDelay: '0.5s' }}>
              <CardContent className="p-4 sm:p-6 lg:p-8">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-6 lg:space-y-0">
                  <div className="flex-1">
                    <div className="flex items-center mb-3">
                      <Rocket className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 mr-2" />
                      <h3 className="text-lg sm:text-xl font-bold text-foreground">
                        Ready to Scale Your AI Chatbots?
                      </h3>
                    </div>
                    <p className="text-muted-foreground mb-4 text-sm sm:text-base">
                      Upgrade to Pro and unlock unlimited chatbots, 2,000 queries/month, custom domains, and advanced analytics.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div className="flex items-center text-green-600 bg-green-50 rounded-lg px-3 py-2">
                        <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Unlimited chatbots</span>
                      </div>
                      <div className="flex items-center text-green-600 bg-green-50 rounded-lg px-3 py-2">
                        <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>20x more queries</span>
                      </div>
                      <div className="flex items-center text-green-600 bg-green-50 rounded-lg px-3 py-2">
                        <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
                        <span>Remove branding</span>
                      </div>
                    </div>
                  </div>
                  <div className="lg:ml-8">
                    <Button 
                      onClick={handleUpgrade}
                      variant="gradient"
                      className="w-full lg:w-auto shadow-xl shadow-purple-500/25 hover:shadow-2xl hover:shadow-purple-500/30 transition-all h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base"
                    >
                      <Star className="h-4 w-4 mr-2" />
                      Upgrade to Pro
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Usage Analytics Chart for Free Users */}
          {userProfile?.subscription.plan === 'free' && (
            <div className="mb-6 sm:mb-8 animate-slide-up" style={{ animationDelay: '0.6s' }}>
              <UsageAnalyticsChart />
            </div>
          )}

          {/* Active Chatbots Section */}
          <div className="mb-6 sm:mb-8 animate-slide-up" style={{ animationDelay: '0.7s' }}>
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-foreground flex items-center">
                <Bot className="h-6 w-6 text-blue-600 mr-3" />
                Your Chatbots
              </h2>
              <Button asChild variant="outline" className="border-purple-200 hover:bg-purple-50 h-10 sm:h-11">
                <Link href="/dashboard/chatbots">
                  <span className="hidden sm:inline">View All</span>
                  <span className="sm:hidden">View</span>
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>

            {authLoading || isLoading || !user || !userProfile ? (
              <Card variant="elevated">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Loading dashboard...</p>
                </CardContent>
              </Card>
            ) : chatbots.length === 0 ? (
              <Card variant="glow">
                <CardContent className="p-12 text-center">
                  <Bot className="h-16 w-16 text-purple-600 mx-auto mb-6" />
                  <h3 className="text-xl font-semibold text-foreground mb-3">No chatbots yet</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    {userProfile?.subscription.plan === 'free' 
                      ? 'Get started with your first free chatbot. You have 2 chatbots included in your free plan!'
                      : 'Get started by creating your first AI-powered chatbot to assist your users.'}
                  </p>
                  <Button 
                    asChild
                    variant="gradient"
                    className="shadow-lg shadow-purple-500/25 h-11 sm:h-12 px-6 sm:px-8 text-sm sm:text-base"
                    disabled={userProfile?.subscription.plan === 'free' && (userProfile.usage.chatbotsCreated || 0) >= 2}
                  >
                    <Link href="/dashboard/chatbots/new">
                      <Plus className="h-4 w-4 mr-2" />
                      <span className="hidden sm:inline">Create Your First Chatbot</span>
                      <span className="sm:hidden">Create Chatbot</span>
                    </Link>
                  </Button>
                  {userProfile?.subscription.plan === 'free' && (userProfile.usage.chatbotsCreated || 0) >= 2 && (
                    <p className="text-sm text-muted-foreground mt-4">
                      Free plan limit reached. 
                      <button onClick={handleUpgrade} className="text-purple-600 underline ml-1 hover:text-purple-700">
                        Upgrade to create more
                      </button>
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Desktop Table View */}
                <Card variant="elevated" className="hidden lg:block">
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-border">
                        <thead className="bg-gradient-to-r from-muted/30 to-muted/50">
                          <tr>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                              Chatbot
                            </th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                              Status
                            </th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                              Documents
                            </th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                              Queries
                            </th>
                            <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-foreground uppercase tracking-wider">
                              Last Updated
                            </th>
                            <th scope="col" className="relative px-6 py-4">
                              <span className="sr-only">Actions</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-background divide-y divide-border">
                          {chatbots.map((chatbot, index) => {
                            const lastUpdated = chatbot.updatedAt ? 
                              new Date(chatbot.updatedAt.seconds * 1000).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric'
                              }) : 'N/A';
                              
                            return (
                              <tr key={chatbot.id} className="hover:bg-gradient-to-r hover:from-blue-25/50 hover:to-purple-25/50 transition-all duration-200">
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className="flex-shrink-0 h-12 w-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                                      <span className="text-white font-bold text-lg">{chatbot.name.charAt(0)}</span>
                                    </div>
                                    <div className="ml-4">
                                      <div className="text-sm font-semibold text-foreground">{chatbot.name}</div>
                                      <div className="text-sm text-muted-foreground">{chatbot.description || 'No description'}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <Badge 
                                    variant="outline"
                                    className={`${
                                      chatbot.status === 'active'
                                        ? 'bg-green-50 text-green-700 border-green-200'
                                        : chatbot.status === 'preview'
                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                        : chatbot.status === 'draft'
                                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                        : 'bg-muted text-foreground border-border'
                                    }`}
                                  >
                                    {chatbot.status === 'active' ? 'Active' :
                                     chatbot.status === 'preview' ? 'Preview' :
                                     chatbot.status === 'draft' ? 'Draft' : chatbot.status}
                                  </Badge>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground font-medium">
                                  {chatbot.documents?.length || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground font-medium">
                                  {chatbot.stats?.queries || 0}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                  {lastUpdated}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                                  <Link 
                                    href={`/dashboard/chatbots/${chatbot.id}`} 
                                    className="text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                                  >
                                    View
                                  </Link>
                                  <Link 
                                    href={`/dashboard/chatbots/${chatbot.id}/edit`} 
                                    className="text-purple-600 hover:text-purple-800 hover:underline transition-colors"
                                  >
                                    Edit
                                  </Link>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>

                {/* Mobile Card View */}
                <div className="lg:hidden space-y-4">
                  {chatbots.map((chatbot, index) => {
                    const lastUpdated = chatbot.updatedAt ? 
                      new Date(chatbot.updatedAt.seconds * 1000).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      }) : 'N/A';
                      
                    return (
                      <Card key={chatbot.id} variant="elevated" hover="lift" className="overflow-hidden">
                        <CardContent className="p-0">
                          {/* Card Header */}
                          <div className="bg-gradient-to-r from-muted/30 to-muted/50 p-4 border-b border-border">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-3">
                                <div className="flex-shrink-0 h-10 w-10 sm:h-12 sm:w-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center shadow-lg">
                                  <span className="text-white font-bold text-sm sm:text-lg">{chatbot.name.charAt(0)}</span>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-sm sm:text-base font-semibold text-foreground truncate">{chatbot.name}</h3>
                                  <p className="text-xs sm:text-sm text-muted-foreground truncate">{chatbot.description || 'No description'}</p>
                                </div>
                              </div>
                              <Badge 
                                variant="outline"
                                className={`${
                                  chatbot.status === 'active'
                                    ? 'bg-green-50 text-green-700 border-green-200'
                                    : chatbot.status === 'preview'
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : chatbot.status === 'draft'
                                    ? 'bg-yellow-50 text-yellow-700 border-yellow-200'
                                    : 'bg-muted text-foreground border-border'
                                } text-xs px-2 py-1`}
                              >
                                {chatbot.status === 'active' ? 'Active' :
                                 chatbot.status === 'preview' ? 'Preview' :
                                 chatbot.status === 'draft' ? 'Draft' : chatbot.status}
                              </Badge>
                            </div>
                          </div>
                          
                          {/* Card Body */}
                          <div className="p-4">
                            {/* Stats Row */}
                            <div className="grid grid-cols-3 gap-4 mb-4">
                              <div className="text-center">
                                <div className="text-lg sm:text-xl font-bold text-foreground">{chatbot.documents?.length || 0}</div>
                                <div className="text-xs text-muted-foreground">Documents</div>
                              </div>
                              <div className="text-center">
                                <div className="text-lg sm:text-xl font-bold text-foreground">{chatbot.stats?.queries || 0}</div>
                                <div className="text-xs text-muted-foreground">Queries</div>
                              </div>
                              <div className="text-center">
                                <div className="text-xs sm:text-sm font-medium text-foreground">Updated</div>
                                <div className="text-xs text-muted-foreground">{lastUpdated}</div>
                              </div>
                            </div>
                            
                            {/* Actions Row */}
                            <div className="flex space-x-3">
                              <Button 
                                asChild 
                                variant="blue-outline" 
                                size="sm" 
                                className="flex-1 h-10 text-sm"
                              >
                                <Link href={`/dashboard/chatbots/${chatbot.id}`}>
                                  View
                                </Link>
                              </Button>
                              <Button 
                                asChild 
                                variant="purple-outline" 
                                size="sm" 
                                className="flex-1 h-10 text-sm"
                              >
                                <Link href={`/dashboard/chatbots/${chatbot.id}/edit`}>
                                  Edit
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Enhanced Quick Actions */}
          <div className="animate-slide-up" style={{ animationDelay: '0.8s' }}>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6 flex items-center">
              <Sparkles className="h-6 w-6 text-purple-600 mr-3" />
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card variant="elevated" hover="lift" className="group">
                <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center h-full">
                  <Plus className="h-12 w-12 sm:h-16 sm:w-16 text-blue-600 mb-3 sm:mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">Create New Chatbot</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 flex-grow">
                    {userProfile?.subscription.plan === 'free' 
                      ? `Set up a new AI assistant (${2 - (userProfile.usage.chatbotsCreated || 0)} remaining)`
                      : 'Set up a new AI assistant for your documentation.'}
                  </p>
                  <Button 
                    asChild 
                    variant="blue-outline" 
                    className="w-full group-hover:bg-blue-50 h-10 sm:h-11 text-sm"
                    disabled={userProfile?.subscription.plan === 'free' && (userProfile.usage.chatbotsCreated || 0) >= 2}
                  >
                    <Link href="/dashboard/chatbots/new">
                      Get Started
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card variant="elevated" hover="lift" className="group">
                <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center h-full">
                  <Upload className="h-12 w-12 sm:h-16 sm:w-16 text-green-600 mb-3 sm:mb-4 group-hover:scale-110 transition-transform" />
                  <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">Upload Documents</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 flex-grow">
                    Add new documentation files to your knowledge base and train your chatbots.
                  </p>
                  <Button asChild variant="outline" className="w-full border-green-200 hover:bg-green-50 group-hover:border-green-300 h-10 sm:h-11 text-sm">
                    <Link href="/dashboard/documents/upload">
                      Upload Files
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card variant="premium" hover="glow" className="group">
                <CardContent className="p-4 sm:p-6 flex flex-col items-center text-center h-full">
                  <div className="h-12 w-12 sm:h-16 sm:w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform shadow-lg">
                    {userProfile?.subscription.plan === 'free' ? (
                      <Crown className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                    ) : (
                      <BarChart3 className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">
                    {userProfile?.subscription.plan === 'free' ? 'Upgrade Plan' : 'View Analytics'}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6 flex-grow">
                    {userProfile?.subscription.plan === 'free' 
                      ? 'Unlock unlimited chatbots and advanced features with Pro plan.'
                      : 'See detailed performance metrics for your chatbots.'}
                  </p>
                  <Button 
                    variant={userProfile?.subscription.plan === 'free' ? 'gradient' : 'purple-outline'}
                    className={`w-full h-10 sm:h-11 text-sm ${userProfile?.subscription.plan === 'free' ? 'shadow-lg shadow-purple-500/25' : 'hover:bg-purple-50'}`}
                    onClick={userProfile?.subscription.plan === 'free' ? handleUpgrade : undefined}
                    asChild={userProfile?.subscription.plan !== 'free'}
                  >
                    {userProfile?.subscription.plan === 'free' ? (
                      <span>Upgrade Now</span>
                    ) : (
                      <Link href="/dashboard/analytics">View Reports</Link>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
      </main>
    </div>
  );
}