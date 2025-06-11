import React, { useState, useEffect, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Info, Trash2, Plus, Users, Mail, CheckCircle, Clock, XCircle } from "lucide-react";
import { InvitedUser, ChatbotConfig } from "@/types/chatbot";

interface ChatbotUserManagementProps {
  chatbot: ChatbotConfig;
  onUpdate: () => void; // Callback to refresh parent data
  isLoading?: boolean;
}

export default function ChatbotUserManagement({ chatbot, onUpdate, isLoading = false }: ChatbotUserManagementProps) {
  const [users, setUsers] = useState<InvitedUser[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Email validation function
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Load users function with useCallback
  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      // Try the regular endpoint first, fallback to temp endpoint
      let response = await fetch(`/api/chatbot-users?chatbotId=${chatbot.id}`);
      let data = await response.json();
      
      if (!data.success && data.error?.includes('Firebase project not found')) {
        console.log('🔄 Falling back to temporary user storage...');
        response = await fetch(`/api/chatbot-users-temp?chatbotId=${chatbot.id}`);
        data = await response.json();
      }
      
      if (data.success) {
        setUsers(data.users || []);
        if (data.note) {
          console.log('📝 Note:', data.note);
        }
      } else {
        console.error('Failed to load users:', data.error);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoadingUsers(false);
    }
  }, [chatbot.id]);

  // Load users on component mount
  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Invite user
  const handleInviteUser = async () => {
    const email = newEmail.trim().toLowerCase();
    
    if (!email) {
      setEmailError('Please enter an email address');
      return;
    }
    
    if (!validateEmail(email)) {
      setEmailError('Please enter a valid email address');
      return;
    }
    
    if (users.some(user => user.email === email)) {
      setEmailError('This email is already invited');
      return;
    }
    
    setIsInviting(true);
    setEmailError('');
    
    try {
      // Try the regular endpoint first, fallback to temp endpoint
      let response = await fetch('/api/chatbot-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'invite',
          chatbotId: chatbot.id,
          email: email,
          displayName: newDisplayName.trim() || undefined
        })
      });
      
      let data = await response.json();
      
      if (!data.success && data.error?.includes('Firebase project not found')) {
        console.log('🔄 Falling back to temporary user storage...');
        response = await fetch('/api/chatbot-users-temp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'invite',
            chatbotId: chatbot.id,
            email: email,
            displayName: newDisplayName.trim() || undefined
          })
        });
        data = await response.json();
      }
      
      if (data.success) {
        setNewEmail('');
        setNewDisplayName('');
        await loadUsers(); // Refresh the list
        onUpdate(); // Notify parent
        if (data.message) {
          console.log('📝 Message:', data.message);
        }
      } else {
        setEmailError(data.error || 'Failed to invite user');
      }
    } catch (error) {
      console.error('Error inviting user:', error);
      setEmailError('Failed to invite user. Please try again.');
    } finally {
      setIsInviting(false);
    }
  };

  // Remove user
  const handleRemoveUser = async (userId: string) => {
    if (!confirm('Are you sure you want to remove this user? They will no longer be able to access the chatbot.')) {
      return;
    }
    
    setIsRemoving(userId);
    
    try {
      // Try the regular endpoint first, fallback to temp endpoint
      let response = await fetch('/api/chatbot-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove',
          chatbotId: chatbot.id,
          userId: userId
        })
      });
      
      let data = await response.json();
      
      if (!data.success && data.error?.includes('Firebase project not found')) {
        console.log('🔄 Falling back to temporary user storage...');
        response = await fetch('/api/chatbot-users-temp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'remove',
            chatbotId: chatbot.id,
            userId: userId
          })
        });
        data = await response.json();
      }
      
      if (data.success) {
        await loadUsers(); // Refresh the list
        onUpdate(); // Notify parent
      } else {
        alert('Failed to remove user: ' + (data.error || 'Unknown error'));
      }
    } catch (error) {
      console.error('Error removing user:', error);
      alert('Failed to remove user. Please try again.');
    } finally {
      setIsRemoving(null);
    }
  };

  // Handle Enter key in email input
  const handleEmailKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleInviteUser();
    }
  };

  // Get status icon and color
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case 'disabled':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Clock className="h-4 w-4 text-gray-600" />;
    }
  };

  if (!chatbot.requireAuth) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>User Management</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Info className="h-5 w-5 text-gray-600" />
              <h4 className="text-sm font-medium text-gray-900">Authentication Disabled</h4>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              This chatbot allows anonymous access. Users can start chatting without creating an account.
            </p>
            <p className="text-sm text-gray-500">
              To manage users, enable authentication in your chatbot settings and redeploy.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }


  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>User Management</span>
          </div>
          <span className="text-sm font-normal text-gray-500">
            {users.length} user(s) invited
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Invite New User */}
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg border">
          <h5 className="text-sm font-medium text-gray-900">Invite New User</h5>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              type="email"
              placeholder="Email address"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                setEmailError('');
              }}
              onKeyPress={handleEmailKeyPress}
              className="flex-1"
            />
            <Input
              type="text"
              placeholder="Display name (optional)"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              onKeyPress={handleEmailKeyPress}
            />
          </div>
          
          {emailError && (
            <p className="text-sm text-red-600">{emailError}</p>
          )}
          
          <Button
            onClick={handleInviteUser}
            disabled={isInviting || !newEmail.trim()}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            {isInviting ? 'Sending Invitation...' : 'Send Invitation'}
          </Button>
          
          <p className="text-xs text-gray-500">
            Users will receive an email with verification instructions to access the chatbot.
          </p>
        </div>

        {/* Users List */}
        <div className="space-y-4">
          <h5 className="text-sm font-medium text-gray-900">Invited Users</h5>
          
          {loadingUsers ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No users invited yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Start by inviting users above to give them access to your chatbot.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between bg-white px-4 py-3 rounded border">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(user.status)}
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {user.displayName || user.email}
                      </div>
                      {user.displayName && (
                        <div className="text-xs text-gray-500">{user.email}</div>
                      )}
                      <div className="text-xs text-gray-400">
                        Invited {new Date(user.invitedAt.seconds * 1000).toLocaleDateString()}
                        {user.status === 'active' && user.lastSignInAt && (
                          <> • Last signed in {new Date(user.lastSignInAt.seconds * 1000).toLocaleDateString()}</>
                        )}
                        {user.status === 'pending' && (
                          <> • <span className="text-amber-600">Awaiting email verification</span></>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      user.status === 'active' ? 'bg-green-100 text-green-700' :
                      user.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {user.status === 'active' ? 'Active' :
                       user.status === 'pending' ? 'Pending Verification' : 'Disabled'}
                    </span>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveUser(user.id)}
                      disabled={isRemoving === user.id}
                      className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:border-red-300"
                    >
                      {isRemoving === user.id ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-t border-red-600"></div>
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
