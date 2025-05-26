'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Crown, 
  Check, 
  Zap, 
  Globe, 
  BarChart3, 
  Users,
  Shield,
  ArrowLeft,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';

export default function BillingPage() {
  const { userProfile } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const upgradeSource = searchParams?.get('source') || 'billing_page';
  const [selectedPlan, setSelectedPlan] = useState<'pro' | 'enterprise'>('pro');
  const [isLoading, setIsLoading] = useState(false);

  const handleUpgrade = async (plan: 'pro' | 'enterprise') => {
    setIsLoading(true);
    
    // In a real implementation, integrate with Stripe or your payment processor
    try {
      // Simulate upgrade process
      alert(`Upgrade to ${plan.toUpperCase()} coming soon! This will integrate with Stripe for payments.`);
      console.log(`Upgrading to ${plan} from source: ${upgradeSource}`);
    } catch (error) {
      console.error('Upgrade failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentPlan = userProfile?.subscription.plan || 'free';
  const monthlyQueries = userProfile?.usage.monthlyQueries || 0;
  const usagePercentage = (monthlyQueries / 100) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard/settings">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Settings
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Upgrade Your Plan</h1>
                <p className="text-gray-600">Unlock more features and higher limits</p>
              </div>
            </div>
            <Badge variant="secondary" className="bg-purple-100 text-purple-700">
              <Crown className="h-3 w-3 mr-1" />
              Current: {currentPlan.toUpperCase()}
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Current Usage Alert */}
        {currentPlan === 'free' && usagePercentage >= 80 && (
          <Alert className="mb-8 border-amber-200 bg-amber-50">
            <Zap className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              <strong>You're approaching your monthly limit!</strong> You've used {monthlyQueries}/100 queries this month.
              Upgrade now to avoid interruption.
            </AlertDescription>
          </Alert>
        )}

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* Pro Plan */}
          <Card className={`relative ${selectedPlan === 'pro' ? 'ring-2 ring-purple-500' : ''}`}>
            <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
              <Badge className="bg-gradient-to-r from-purple-500 to-blue-600 text-white">
                <Sparkles className="h-3 w-3 mr-1" />
                Most Popular
              </Badge>
            </div>
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold">Pro Plan</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900">$19</span>
                <span className="text-gray-600">/month</span>
              </div>
              <p className="text-gray-600 mt-2">Perfect for growing businesses</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Unlimited chatbot deployments</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>2,000 queries per month (20x more)</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Custom domain support</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Remove ChatFactory branding</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Advanced analytics (90 days)</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Priority email support</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>API access</span>
                </li>
              </ul>
              
              <Button 
                className="w-full bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700"
                size="lg"
                onClick={() => handleUpgrade('pro')}
                disabled={isLoading || currentPlan === 'pro'}
              >
                {currentPlan === 'pro' ? (
                  <>
                    <Crown className="h-4 w-4 mr-2" />
                    Current Plan
                  </>
                ) : (
                  <>
                    <Crown className="h-4 w-4 mr-2" />
                    {isLoading ? 'Processing...' : 'Upgrade to Pro'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Enterprise Plan */}
          <Card className={`relative ${selectedPlan === 'enterprise' ? 'ring-2 ring-gray-800' : ''}`}>
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl font-bold">Enterprise</CardTitle>
              <div className="mt-4">
                <span className="text-4xl font-bold text-gray-900">$99</span>
                <span className="text-gray-600">/month</span>
              </div>
              <p className="text-gray-600 mt-2">For large organizations</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-3">
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Everything in Pro</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Unlimited queries</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>White-label solutions</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Advanced security & compliance</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Dedicated account manager</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>24/7 phone & chat support</span>
                </li>
                <li className="flex items-center">
                  <Check className="h-5 w-5 text-green-500 mr-3" />
                  <span>Custom integrations</span>
                </li>
              </ul>
              
              <Button 
                className="w-full bg-gray-800 hover:bg-gray-900"
                size="lg"
                onClick={() => handleUpgrade('enterprise')}
                disabled={isLoading || currentPlan === 'enterprise'}
              >
                {currentPlan === 'enterprise' ? (
                  <>
                    <Crown className="h-4 w-4 mr-2" />
                    Current Plan
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    {isLoading ? 'Processing...' : 'Contact Sales'}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Free Plan Comparison */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-center">Plan Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 font-medium">Feature</th>
                    <th className="text-center py-3 font-medium">Free</th>
                    <th className="text-center py-3 font-medium">Pro</th>
                    <th className="text-center py-3 font-medium">Enterprise</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  <tr>
                    <td className="py-3">Chatbot Deployments</td>
                    <td className="text-center py-3">2</td>
                    <td className="text-center py-3">Unlimited</td>
                    <td className="text-center py-3">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-3">Monthly Queries</td>
                    <td className="text-center py-3">100</td>
                    <td className="text-center py-3">2,000</td>
                    <td className="text-center py-3">Unlimited</td>
                  </tr>
                  <tr>
                    <td className="py-3">Custom Domains</td>
                    <td className="text-center py-3">❌</td>
                    <td className="text-center py-3">✅</td>
                    <td className="text-center py-3">✅</td>
                  </tr>
                  <tr>
                    <td className="py-3">Remove Branding</td>
                    <td className="text-center py-3">❌</td>
                    <td className="text-center py-3">✅</td>
                    <td className="text-center py-3">✅</td>
                  </tr>
                  <tr>
                    <td className="py-3">Analytics Retention</td>
                    <td className="text-center py-3">7 days</td>
                    <td className="text-center py-3">90 days</td>
                    <td className="text-center py-3">1 year</td>
                  </tr>
                  <tr>
                    <td className="py-3">Support</td>
                    <td className="text-center py-3">Community</td>
                    <td className="text-center py-3">Email</td>
                    <td className="text-center py-3">24/7 Phone</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>Frequently Asked Questions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium mb-2">Can I change plans anytime?</h4>
              <p className="text-sm text-gray-600">Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">What happens to my data if I downgrade?</h4>
              <p className="text-sm text-gray-600">Your data is preserved, but you'll be subject to the new plan's limitations. Extra chatbots will be paused until you're within limits.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">Do you offer refunds?</h4>
              <p className="text-sm text-gray-600">We offer a 14-day money-back guarantee for all paid plans. Contact support for assistance.</p>
            </div>
            <div>
              <h4 className="font-medium mb-2">How are queries counted?</h4>
              <p className="text-sm text-gray-600">Each message sent to your chatbot counts as one query. This includes both user questions and AI responses.</p>
            </div>
          </CardContent>
        </Card>

        {/* Bottom CTA */}
        {currentPlan === 'free' && (
          <div className="text-center mt-8">
            <p className="text-gray-600 mb-4">
              Questions about upgrading? <a href="mailto:support@chatfactory.ai" className="text-blue-600 hover:underline">Contact our team</a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
