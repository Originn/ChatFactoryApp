'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from '@/contexts/AuthContext';

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

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await deleteAccount(deleteData.password);
      router.push('/');
    } catch (error: any) {
      setError(error.message || 'Failed to delete account');
      setIsLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Account Settings</h1>
      
      {message && (
        <div className="bg-green-50 border border-green-200 text-green-600 px-4 py-2 rounded mb-4">
          {message}
        </div>
      )}
      
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded mb-4">
          {error}
        </div>
      )}

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="danger">Danger Zone</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
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

        <TabsContent value="security">
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

        <TabsContent value="danger">
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-600">Danger Zone</CardTitle>
              <CardDescription>Irreversible and destructive actions</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleDeleteAccount} className="space-y-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded">
                  <h4 className="font-medium text-red-800 mb-2">Delete Account</h4>
                  <p className="text-sm text-red-600 mb-4">
                    This will permanently delete your account and all associated data. This action cannot be undone.
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
                </div>
                <Button 
                  type="submit" 
                  variant="destructive"
                  disabled={isLoading || !deleteData.password}
                >
                  {isLoading ? 'Deleting...' : 'Delete Account Permanently'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
