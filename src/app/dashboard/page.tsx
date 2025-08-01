'use client';

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import Link from "next/link";
import UserDropdown from "@/components/dashboard/UserDropdown";
import { BillingAccessGuide } from "@/components/dashboard/BillingAccessGuide";
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
  Rocket
} from "lucide-react";

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
  const { user, userProfile } = useAuth();
  const [chatbots, setChatbots] = useState<Chatbot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({
    totalChatbots: 0,
    totalDocuments: 0,
    totalQueries: 0,
    successRate: 0
  });

  useEffect(() => {
    async function fetchData() {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
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
  }, [user]);

  const handleUpgrade = () => {
    window.location.href = '/dashboard/settings/billing?upgrade=pro&source=dashboard';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-25 via-white to-purple-25 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-mesh opacity-30" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" />
      <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: '2s' }} />
      
      {/* Dashboard Header */}
      <header className="relative z-10 backdrop-blur-sm bg-white/70 border-b border-white/20 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <span className="font-bold text-xl text-gradient">Chat Factory</span>
                </div>
                {userProfile?.subscription.plan === 'free' && (
                  <div className="ml-4 flex items-center space-x-3">
                    <Badge variant="secondary" className="bg-gradient-to-r from-purple-100 to-blue-100 text-purple-700 border border-purple-200/50 shadow-sm">
                      <Crown className="h-3 w-3 mr-1" />
                      Free Plan
                    </Badge>
                    <div className="flex items-center space-x-2 bg-white/60 rounded-full px-3 py-1 backdrop-blur-sm">
                      <span className="text-xs text-gray-600">Queries:</span>
                      <span className="text-xs font-semibold text-gray-800">
                        {userProfile.usage.monthlyQueries || 0}/100
                      </span>
                      {((userProfile.usage.monthlyQueries || 0) / 100) >= 0.8 && (
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                      )}
                    </div>
                  </div>
                )}
              </div>
              <nav className="hidden sm:ml-8 sm:flex sm:space-x-8">
                <Link
                  href="/dashboard"
                  className="border-purple-500 text-gray-900 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                >
                  Dashboard
                </Link>
                <Link
                  href="/dashboard/chatbots"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors"
                >
                  Chatbots
                </Link>
                <Link
                  href="/dashboard/settings"
                  className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors"
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
            </div>
            <div className="flex items-center space-x-4">
              <Button
                asChild
                variant="gradient"
                className="shadow-lg shadow-purple-500/25"
              >
                <Link href="/dashboard/chatbots/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Create New Chatbot
                </Link>
              </Button>
              <UserDropdown />
            </div>
          </div>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="relative z-10 max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
        <div className="px-4 sm:px-0">
          {/* Welcome Section */}
          <div className="mb-8 animate-fade-in">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                  Welcome back, {user?.displayName?.split(' ')[0] || 'there'}! 👋
                </h1>
                <p className="text-gray-600">
                  Here's what's happening with your AI chatbots today.
                </p>
              </div>
              {userProfile?.subscription.plan === 'free' && (
                <div className="hidden md:block">
                  <div className="text-right">
                    <div className="text-sm text-gray-500 mb-1">Your Progress</div>
                    <div className="flex items-center space-x-2">
                      <Progress 
                        value={((userProfile.usage.monthlyQueries || 0) / 100) * 100} 
                        className="w-24 h-2"
                      />
                      <span className="text-xs text-gray-600">
                        {100 - (userProfile.usage.monthlyQueries || 0)} left
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Billing Access Guide - Shows for free users */}
          {userProfile?.subscription.plan === 'free' && (
            <div className="mb-6 animate-slide-up">
              <BillingAccessGuide />
            </div>
          )}
          
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
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 mb-8 animate-slide-up" style={{ animationDelay: '0.4s' }}>
            <Card variant="elevated" hover="lift" className="group">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Bot className="h-4 w-4 text-white" />
                    </div>
                    <span>Total Chatbots</span>
                  </div>
                  {userProfile?.subscription.plan === 'free' && (
                    <Badge variant="outline" className="text-xs text-purple-600 border-purple-200">
                      {userProfile.usage.chatbotsCreated}/2
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalChatbots}</div>
                <p className="text-sm text-gray-500 flex items-center">
                  {userProfile?.subscription.plan === 'free' 
                    ? `${2 - (userProfile.usage.chatbotsCreated || 0)} remaining` 
                    : 'Your AI assistants'}
                  {userProfile?.subscription.plan !== 'free' && <TrendingUp className="h-3 w-3 ml-1 text-green-500" />}
                </p>
              </CardContent>
            </Card>
            
            <Card variant="elevated" hover="lift" className="group">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageCircle className="h-4 w-4 text-white" />
                  </div>
                  <span>Monthly Queries</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {userProfile?.usage.monthlyQueries || 0}
                  {userProfile?.subscription.plan === 'free' && (
                    <span className="text-lg text-gray-500 ml-1">/100</span>
                  )}
                </div>
                <p className="text-sm text-gray-500 flex items-center">
                  {userProfile?.subscription.plan === 'free' 
                    ? `${100 - (userProfile.usage.monthlyQueries || 0)} remaining this month`
                    : 'Questions answered this month'}
                  <Activity className="h-3 w-3 ml-1 text-blue-500" />
                </p>
              </CardContent>
            </Card>
            
            <Card variant="elevated" hover="lift" className="group">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  <span>Total Documents</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.totalDocuments}</div>
                <p className="text-sm text-gray-500 flex items-center">
                  Knowledge base files
                  <Upload className="h-3 w-3 ml-1 text-purple-500" />
                </p>
              </CardContent>
            </Card>
            
            <Card variant="elevated" hover="lift" className="group">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-600 flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-amber-500 to-orange-500 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform">
                    <Target className="h-4 w-4 text-white" />
                  </div>
                  <span>Success Rate</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-gray-900 mb-1">{stats.successRate}%</div>
                <p className="text-sm text-gray-500 flex items-center">
                  Average performance
                  <CheckCircle className="h-3 w-3 ml-1 text-green-500" />
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Free Tier Upgrade Promotion */}
          {userProfile?.subscription.plan === 'free' && (
            <Card variant="premium" className="mb-8 animate-slide-up" style={{ animationDelay: '0.5s' }}>
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center mb-3">
                      <Rocket className="h-6 w-6 text-purple-600 mr-2" />
                      <h3 className="text-xl font-bold text-gray-900">
                        Ready to Scale Your AI Chatbots?
                      </h3>
                    </div>
                    <p className="text-gray-600 mb-4 text-base">
                      Upgrade to Pro and unlock unlimited chatbots, 2,000 queries/month, custom domains, and advanced analytics.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div className="flex items-center text-green-600 bg-green-50 rounded-lg px-3 py-2">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Unlimited chatbots
                      </div>
                      <div className="flex items-center text-green-600 bg-green-50 rounded-lg px-3 py-2">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        20x more queries
                      </div>
                      <div className="flex items-center text-green-600 bg-green-50 rounded-lg px-3 py-2">
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Remove branding
                      </div>
                    </div>
                  </div>
                  <div className="ml-8">
                    <Button 
                      onClick={handleUpgrade}
                      variant="gradient"
                      size="lg"
                      className="shadow-xl shadow-purple-500/25 hover:shadow-2xl hover:shadow-purple-500/30 transition-all"
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
            <div className="mb-8 animate-slide-up" style={{ animationDelay: '0.6s' }}>
              <UsageAnalyticsChart />
            </div>
          )}

          {/* Active Chatbots Section */}
          <div className="mb-8 animate-slide-up" style={{ animationDelay: '0.7s' }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mr-3">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                Your Chatbots
              </h2>
              <Button asChild variant="outline" className="border-purple-200 hover:bg-purple-50">
                <Link href="/dashboard/chatbots">
                  View All
                  <ArrowUpRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>

            {isLoading ? (
              <Card variant="elevated">
                <CardContent className="p-8 text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading your chatbots...</p>
                </CardContent>
              </Card>
            ) : chatbots.length === 0 ? (
              <Card variant="glow" className="animate-pulse-soft">
                <CardContent className="p-12 text-center">
                  <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-100 to-purple-100 rounded-2xl flex items-center justify-center mb-6">
                    <Bot className="h-8 w-8 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">No chatbots yet</h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    {userProfile?.subscription.plan === 'free' 
                      ? 'Get started with your first free chatbot. You have 2 chatbots included in your free plan!'
                      : 'Get started by creating your first AI-powered chatbot to assist your users.'}
                  </p>
                  <Button 
                    asChild
                    variant="gradient"
                    size="lg"
                    className="shadow-lg shadow-purple-500/25"
                    disabled={userProfile?.subscription.plan === 'free' && (userProfile.usage.chatbotsCreated || 0) >= 2}
                  >
                    <Link href="/dashboard/chatbots/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Your First Chatbot
                    </Link>
                  </Button>
                  {userProfile?.subscription.plan === 'free' && (userProfile.usage.chatbotsCreated || 0) >= 2 && (
                    <p className="text-sm text-gray-500 mt-4">
                      Free plan limit reached. 
                      <button onClick={handleUpgrade} className="text-purple-600 underline ml-1 hover:text-purple-700">
                        Upgrade to create more
                      </button>
                    </p>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card variant="elevated">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gradient-to-r from-gray-50 to-blue-25">
                        <tr>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Chatbot
                          </th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Status
                          </th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Documents
                          </th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Queries
                          </th>
                          <th scope="col" className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Last Updated
                          </th>
                          <th scope="col" className="relative px-6 py-4">
                            <span className="sr-only">Actions</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-100">
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
                                    <div className="text-sm font-semibold text-gray-900">{chatbot.name}</div>
                                    <div className="text-sm text-gray-500">{chatbot.description || 'No description'}</div>
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
                                      : 'bg-gray-50 text-gray-700 border-gray-200'
                                  }`}
                                >
                                  {chatbot.status === 'active' ? 'Active' :
                                   chatbot.status === 'preview' ? 'Preview' :
                                   chatbot.status === 'draft' ? 'Draft' : chatbot.status}
                                </Badge>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                                {chatbot.documents?.length || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                                {chatbot.stats?.queries || 0}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
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
            )}
          </div>

          {/* Enhanced Quick Actions */}
          <div className="animate-slide-up" style={{ animationDelay: '0.8s' }}>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
              <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mr-3">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              Quick Actions
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Card variant="elevated" hover="lift" className="group">
                <CardContent className="p-6 flex flex-col items-center text-center h-full">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                    <Plus className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Create New Chatbot</h3>
                  <p className="text-sm text-gray-600 mb-6 flex-grow">
                    {userProfile?.subscription.plan === 'free' 
                      ? `Set up a new AI assistant (${2 - (userProfile.usage.chatbotsCreated || 0)} remaining)`
                      : 'Set up a new AI assistant for your documentation.'}
                  </p>
                  <Button 
                    asChild 
                    variant="blue-outline" 
                    className="w-full group-hover:bg-blue-50"
                    disabled={userProfile?.subscription.plan === 'free' && (userProfile.usage.chatbotsCreated || 0) >= 2}
                  >
                    <Link href="/dashboard/chatbots/new">
                      Get Started
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card variant="elevated" hover="lift" className="group">
                <CardContent className="p-6 flex flex-col items-center text-center h-full">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                    <Upload className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Upload Documents</h3>
                  <p className="text-sm text-gray-600 mb-6 flex-grow">
                    Add new documentation files to your knowledge base and train your chatbots.
                  </p>
                  <Button asChild variant="outline" className="w-full border-green-200 hover:bg-green-50 group-hover:border-green-300">
                    <Link href="/dashboard/documents/upload">
                      Upload Files
                    </Link>
                  </Button>
                </CardContent>
              </Card>

              <Card variant="premium" hover="glow" className="group">
                <CardContent className="p-6 flex flex-col items-center text-center h-full">
                  <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg">
                    {userProfile?.subscription.plan === 'free' ? (
                      <Crown className="h-8 w-8 text-white" />
                    ) : (
                      <BarChart3 className="h-8 w-8 text-white" />
                    )}
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {userProfile?.subscription.plan === 'free' ? 'Upgrade Plan' : 'View Analytics'}
                  </h3>
                  <p className="text-sm text-gray-600 mb-6 flex-grow">
                    {userProfile?.subscription.plan === 'free' 
                      ? 'Unlock unlimited chatbots and advanced features with Pro plan.'
                      : 'See detailed performance metrics for your chatbots.'}
                  </p>
                  <Button 
                    variant={userProfile?.subscription.plan === 'free' ? 'gradient' : 'purple-outline'}
                    className={`w-full ${userProfile?.subscription.plan === 'free' ? 'shadow-lg shadow-purple-500/25' : 'hover:bg-purple-50'}`}
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
        </div>
      </main>
    </div>
  );
}