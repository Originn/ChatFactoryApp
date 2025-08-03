'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { 
  Crown, 
  Zap, 
  BarChart3, 
  Globe, 
  Calendar,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  ArrowLeft
} from 'lucide-react';

export default function SettingsPage() {
  const { user, userProfile, updateProfile, updateUserPassword, deleteAccount, sendVerificationEmail, loading } = useAuth();
  const router = useRouter();
  
  const [profileData, setProfileData] = useState({
    displayName: userProfile?.displayName || '',
    email: user?.email || ''
  });
  
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [deleteData, setDeleteData] = useState({ password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (userProfile) {
      setProfileData({
        displayName: userProfile.displayName,
        email: userProfile.email
      });
    }
  }, [userProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      await updateProfile({ displayName: profileData.displayName });
      setMessage('Profile updated successfully');
    } catch (error: any) {
      setError(error.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    setIsLoading(true);
    setError('');
    setMessage('');

    try {
      await updateUserPassword(passwordData.currentPassword, passwordData.newPassword);
      setMessage('Password updated successfully');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        setError('Current password is incorrect');
      } else {
        setError(error.message || 'Failed to update password');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = () => {
    window.location.href = '/dashboard/settings/billing?upgrade=pro&source=settings';
  };

  const getNextResetDate = () => {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return nextMonth.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  // Calculate usage statistics
  const isFree = !userProfile?.subscription?.plan || userProfile.subscription.plan === 'free';
  const currentPlan = userProfile?.subscription?.plan || 'free'; // Default to free if undefined
  const monthlyQueries = userProfile?.usage.monthlyQueries || 0;
  const monthlyLimit = isFree ? 100 : (userProfile?.subscription.plan === 'pro' ? 2000 : -1);
  const usagePercentage = monthlyLimit > 0 ? (monthlyQueries / monthlyLimit) * 100 : 0;
  const chatbotsUsed = userProfile?.usage.chatbotsCreated || 0;
  const chatbotLimit = isFree ? 2 : -1;

  // Helper function to get plan display name
  const getPlanDisplayName = () => {
    switch(currentPlan) {
      case 'free': return 'FREE';
      case 'pro': return 'PRO';
      case 'enterprise': return 'ENTERPRISE';
      default: return 'FREE';
    }
  };

  // Helper function to get plan price
  const getPlanPrice = () => {
    switch(currentPlan) {
      case 'free': return 'Free Forever';
      case 'pro': return '$19/month';
      case 'enterprise': return '$99/month';
      default: return 'Free Forever';
    }
  };

  // Helper function to get plan features
  const getPlanFeatures = (planType: string) => {
    switch(planType) {
      case 'free':
        return [
          { icon: 'check', text: '2 chatbot deployments' },
          { icon: 'check', text: '100 queries per month' },
          { icon: 'check', text: '3 deployments per month' },
          { icon: 'check', text: 'Vercel subdomain hosting' },
          { icon: 'check', text: 'Basic analytics (7 days)' },
          { icon: 'check', text: 'Community support' },
          { icon: 'warning', text: '"Powered by ChatFactory" branding' },
          { icon: 'warning', text: 'No custom domains' }
        ];
      case 'pro':
        return [
          { icon: 'check', text: '10 chatbot deployments' },
          { icon: 'check', text: '2,000 queries per month' },
          { icon: 'check', text: '20 deployments per month' },
          { icon: 'check', text: 'Custom domains' },
          { icon: 'check', text: 'Advanced analytics (90 days)' },
          { icon: 'check', text: 'Email support' },
          { icon: 'check', text: 'Remove ChatFactory branding' }
        ];
      case 'enterprise':
        return [
          { icon: 'check', text: 'Unlimited chatbot deployments' },
          { icon: 'check', text: 'Unlimited queries per month' },
          { icon: 'check', text: 'Unlimited deployments' },
          { icon: 'check', text: 'Custom domains' },
          { icon: 'check', text: 'Advanced analytics (365 days)' },
          { icon: 'check', text: '24/7 priority support' },
          { icon: 'check', text: 'White-label solutions' },
          { icon: 'check', text: 'Remove ChatFactory branding' }
        ];
      default:
        return getPlanFeatures('free');
    }
  };

  return (
    <div className="container mx-auto py-4 sm:py-8 px-4 max-w-4xl">
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4 space-y-3 sm:space-y-0">
            <Link href="/dashboard">
              <Button variant="outline" size="sm" className="w-fit">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">Account Settings</h1>
              <p className="text-gray-600 mt-1 text-sm sm:text-base">Manage your account and usage</p>
            </div>
          </div>
          {isFree && (
            <Button 
              onClick={handleUpgrade}
              className="bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 w-fit"
              size="sm"
            >
              <Crown className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Upgrade to Pro</span>
              <span className="sm:hidden">Upgrade</span>
            </Button>
          )}
        </div>
      </div>
      
      {message && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{message}</AlertDescription>
        </Alert>
      )}
      
      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="usage" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-1 h-auto p-1">
          <TabsTrigger value="usage" className="text-xs sm:text-sm px-2 py-2">
            <span className="hidden sm:inline">Usage & Plan</span>
            <span className="sm:hidden">Usage</span>
          </TabsTrigger>
          <TabsTrigger value="billing" className="text-xs sm:text-sm px-2 py-2">Billing</TabsTrigger>
          <TabsTrigger value="profile" className="text-xs sm:text-sm px-2 py-2">Profile</TabsTrigger>
          <TabsTrigger value="security" className="text-xs sm:text-sm px-2 py-2">Security</TabsTrigger>
          <TabsTrigger value="danger" className="text-xs sm:text-sm px-2 py-2 col-span-2 sm:col-span-1">
            <span className="hidden sm:inline">Danger Zone</span>
            <span className="sm:hidden">Danger</span>
          </TabsTrigger>
        </TabsList>

        {/* Usage & Plan Tab */}
        <TabsContent value="usage" className="space-y-4 sm:space-y-6">
          {/* Current Plan Card */}
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                    <Crown className="h-5 w-5" />
                    Current Plan
                  </CardTitle>
                  <CardDescription className="text-sm">Your subscription and usage details</CardDescription>
                </div>
                <Badge 
                  variant="secondary" 
                  className={`text-xs sm:text-sm px-2 py-1 font-medium ${
                    isFree 
                      ? 'bg-purple-600 text-white' 
                      : 'bg-green-600 text-white'
                  }`}
                >
                  {getPlanDisplayName()} PLAN
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 p-4 sm:p-6">
              {/* Plan Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h4 className="font-medium text-sm">What's Included</h4>
                  <ul className="space-y-2 text-sm">
                    {getPlanFeatures(currentPlan).map((feature, index) => (
                      <li key={index} className="flex items-center gap-2">
                        {feature.icon === 'check' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                        {feature.text}
                      </li>
                    ))}
                  </ul>
                </div>
                
                {/* Upgrade Benefits for Free Users */}
                {isFree && (
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Upgrade to Pro</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        5x more chatbots (10 vs 2)
                      </li>
                      <li className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        20x more queries (2,000/month vs 100)
                      </li>
                      <li className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-blue-500" />
                        Custom domain support
                      </li>
                      <li className="flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-blue-500" />
                        Advanced analytics (90 days vs 7)
                      </li>
                      <li className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-500" />
                        Remove ChatFactory branding
                      </li>
                    </ul>
                    <Button 
                      onClick={handleUpgrade}
                      className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
                    >
                      <Crown className="h-4 w-4 mr-2" />
                      Upgrade to Pro - $19/month
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Usage Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Usage Statistics
              </CardTitle>
              <CardDescription>Your current usage this month</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Monthly Queries */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Monthly Queries</span>
                  <span className="text-sm text-gray-600">
                    {monthlyQueries} / {monthlyLimit > 0 ? monthlyLimit : '∞'}
                  </span>
                </div>
                {monthlyLimit > 0 && (
                  <div className="space-y-2">
                    <Progress 
                      value={usagePercentage} 
                      className={`h-3 ${
                        usagePercentage >= 100 ? 'bg-red-100' : 
                        usagePercentage >= 80 ? 'bg-amber-100' : 'bg-blue-100'
                      }`}
                    />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{Math.max(0, monthlyLimit - monthlyQueries)} remaining</span>
                      <span>Resets on {getNextResetDate()}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Chatbots Usage */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Chatbots Created</span>
                  <span className="text-sm text-gray-600">
                    {chatbotsUsed} / {chatbotLimit > 0 ? chatbotLimit : '∞'}
                  </span>
                </div>
                {chatbotLimit > 0 && (
                  <div className="space-y-2">
                    <Progress 
                      value={(chatbotsUsed / chatbotLimit) * 100} 
                      className="h-3 bg-purple-100"
                    />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{Math.max(0, chatbotLimit - chatbotsUsed)} remaining</span>
                      <span>Lifetime limit</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Monthly Deployments Usage */}
              {isFree && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Monthly Deployments</span>
                    <span className="text-sm text-gray-600">
                      {userProfile?.usage.monthlyDeployments || 0} / 3
                    </span>
                  </div>
                  <div className="space-y-2">
                    <Progress 
                      value={((userProfile?.usage.monthlyDeployments || 0) / 3) * 100} 
                      className="h-3 bg-orange-100"
                    />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>{Math.max(0, 3 - (userProfile?.usage.monthlyDeployments || 0))} remaining</span>
                      <span>Resets on {getNextResetDate()}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Usage Summary Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{monthlyQueries}</div>
                  <div className="text-xs text-gray-600">This Month</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{userProfile?.usage.totalQueries || 0}</div>
                  <div className="text-xs text-gray-600">All Time</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{chatbotsUsed}</div>
                  <div className="text-xs text-gray-600">Chatbots</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {isFree ? (userProfile?.usage.monthlyDeployments || 0) : (userProfile?.usage.deploymentsCreated || 0)}
                  </div>
                  <div className="text-xs text-gray-600">
                    {isFree ? 'This Month' : 'Total'} Deployments
                  </div>
                </div>
              </div>

              {/* Usage Warning */}
              {isFree && usagePercentage >= 80 && (
                <Alert className={`${usagePercentage >= 100 ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}`}>
                  <AlertTriangle className={`h-4 w-4 ${usagePercentage >= 100 ? 'text-red-600' : 'text-amber-600'}`} />
                  <AlertDescription className={usagePercentage >= 100 ? 'text-red-800' : 'text-amber-800'}>
                    {usagePercentage >= 100 ? (
                      <div>
                        <strong>Monthly limit reached!</strong> Your chatbots are paused for new conversations.
                        <Button 
                          size="sm" 
                          className="ml-3 bg-red-600 hover:bg-red-700"
                          onClick={handleUpgrade}
                        >
                          Upgrade Now
                        </Button>
                      </div>
                    ) : (
                      <div>
                        You've used {Math.round(usagePercentage)}% of your monthly queries.
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="ml-3"
                          onClick={handleUpgrade}
                        >
                          Upgrade for More
                        </Button>
                      </div>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Billing Tab */}
        <TabsContent value="billing" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5" />
                Billing & Upgrade
              </CardTitle>
              <CardDescription>Manage your subscription and billing</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Quick Upgrade Section */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Current Plan */}
                <div className="space-y-4">
                  <h3 className="font-medium">Current Plan</h3>
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <Badge className={`font-medium ${
                        isFree ? 'bg-purple-600 text-white' : 'bg-green-600 text-white'
                      }`}>
                        {getPlanDisplayName()} PLAN
                      </Badge>
                      <span className="text-lg font-semibold text-green-600">
                        {getPlanPrice()}
                      </span>
                    </div>
                    <ul className="space-y-1 text-sm">
                      {getPlanFeatures(currentPlan).slice(0, 4).map((feature, index) => (
                        <li key={index} className="flex items-center gap-2">
                          {feature.icon === 'check' ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <AlertTriangle className="h-4 w-4 text-amber-500" />
                          )}
                          {feature.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Upgrade Options */}
                <div className="space-y-4">
                  <h3 className="font-medium">
                    {isFree ? 'Upgrade Your Plan' : 'Change Plan'}
                  </h3>
                  <div className="space-y-3">
                    {/* Only show Pro plan for free users */}
                    {isFree && (
                      <div className="p-4 border-2 border-purple-200 rounded-lg bg-gradient-to-r from-purple-50 to-blue-50">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Pro Plan</h4>
                          <span className="text-lg font-bold">$19/month</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          Perfect for growing businesses
                        </p>
                        <ul className="space-y-1 text-xs text-gray-700 mb-4">
                          <li>• 10 chatbot deployments (5x more)</li>
                          <li>• 2,000 queries per month (20x more)</li>
                          <li>• Custom domain support</li>
                          <li>• Advanced analytics (90 days)</li>
                          <li>• Remove ChatFactory branding</li>
                          <li>• Email support</li>
                        </ul>
                        <Link href="/dashboard/settings/billing">
                          <Button className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700">
                            <Crown className="h-4 w-4 mr-2" />
                            Upgrade to Pro
                          </Button>
                        </Link>
                      </div>
                    )}
                    
                    {/* Only show Enterprise plan for Pro users */}
                    {currentPlan === 'pro' && (
                      <div className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">Enterprise Plan</h4>
                          <span className="text-lg font-bold">$99/month</span>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                          For large organizations
                        </p>
                        <ul className="space-y-1 text-xs text-gray-700 mb-4">
                          <li>• Everything in Pro</li>
                          <li>• Unlimited queries</li>
                          <li>• White-label solutions</li>
                          <li>• 24/7 priority support</li>
                        </ul>
                        <Link href="/dashboard/settings/billing">
                          <Button variant="outline" className="w-full">
                            <Globe className="h-4 w-4 mr-2" />
                            Contact Sales
                          </Button>
                        </Link>
                      </div>
                    )}

                    {/* For free users, show Enterprise as a small secondary option */}
                    {isFree && (
                      <div className="border-t pt-4">
                        <div className="text-xs text-gray-500 text-center mb-2">
                          Need even more? 
                        </div>
                        <div className="p-3 border rounded-lg bg-gray-50">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">Enterprise Plan</span>
                            <span className="text-sm font-semibold">$99/month</span>
                          </div>
                          <p className="text-xs text-gray-600 mb-2">
                            Unlimited everything + white-label solutions
                          </p>
                          <Link href="/dashboard/settings/billing">
                            <Button variant="outline" size="sm" className="w-full text-xs">
                              Learn More
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )}

                    {/* Show current plan status for Enterprise users */}
                    {currentPlan === 'enterprise' && (
                      <div className="p-4 border-2 border-green-200 rounded-lg bg-green-50">
                        <div className="text-center">
                          <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                          <h4 className="font-medium text-green-800">You're on Enterprise!</h4>
                          <p className="text-sm text-green-700 mt-1">
                            You have access to all features and premium support.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Billing Actions */}
              <div className="border-t pt-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-medium">Need Help?</h3>
                    <p className="text-sm text-gray-600">
                      Questions about billing or need a custom plan?
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                    <Link href="/dashboard/settings/billing" className="w-full sm:w-auto">
                      <Button variant="outline" className="w-full sm:w-auto">
                        View Full Pricing
                      </Button>
                    </Link>
                    <Button variant="outline" className="w-full sm:w-auto">
                      Contact Support
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>Update your account profile information</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    value={profileData.displayName}
                    onChange={(e) => setProfileData(prev => ({ ...prev, displayName: e.target.value }))}
                    placeholder="Your display name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={profileData.email}
                    disabled
                    className="bg-gray-100"
                  />
                  <p className="text-xs text-gray-500">Email cannot be changed</p>
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Updating...' : 'Update Profile'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4 sm:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Password & Security</CardTitle>
              <CardDescription>Manage your password and security settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  />
                </div>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Updating...' : 'Update Password'}
                </Button>
              </form>
              
              <div className="border-t pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium">Email Verification</h4>
                    <p className="text-sm text-gray-500">
                      Status: {user?.emailVerified ? 'Verified' : 'Not Verified'}
                    </p>
                  </div>
                  {!user?.emailVerified && (
                    <Button 
                      variant="outline" 
                      onClick={() => sendVerificationEmail()}
                      disabled={isLoading}
                    >
                      Send Verification Email
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Danger Zone Tab */}
        <TabsContent value="danger" className="space-y-4 sm:space-y-6">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>Irreversible and destructive actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-red-50 border border-red-200 rounded">
                <h4 className="font-medium text-red-800 mb-2">Delete Account</h4>
                <p className="text-sm text-red-600 mb-4">
                  This will permanently delete your account, all chatbots, deployments, and usage data. This action cannot be undone.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="deletePassword">Enter your password to confirm</Label>
                  <Input
                    id="deletePassword"
                    type="password"
                    value={deleteData.password}
                    onChange={(e) => setDeleteData({ password: e.target.value })}
                    placeholder="Your password"
                  />
                </div>
                <Button 
                  type="button"
                  variant="destructive"
                  disabled={isLoading || !deleteData.password}
                  className="mt-4"
                  onClick={() => {
                    if (confirm('Are you absolutely sure? This cannot be undone.')) {
                      // handleDeleteAccount();
                    }
                  }}
                >
                  {isLoading ? 'Deleting...' : 'Delete Account Permanently'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
