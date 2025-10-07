import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Info, UserX, Plus, Users, Mail, CheckCircle, Clock, XCircle, ChevronLeft, ChevronRight, X } from "lucide-react";
import { InvitedUser, ChatbotConfig } from "@/types/chatbot";

interface ChatbotUserManagementProps {
  chatbot: ChatbotConfig;
  onUpdate: () => void; // Callback to refresh parent data
  isLoading?: boolean;
}

const USERS_PER_PAGE = 25;

type PendingRemovalUser = {
  id: string;
  displayName?: string;
  email?: string;
  firebaseUid?: string;
  dedicatedProjectUserId?: string;
};

type PendingRemoval = {
  userIds: string[];
  users: PendingRemovalUser[];
};

export default function ChatbotUserManagement({ chatbot, onUpdate, isLoading = false }: ChatbotUserManagementProps) {
  const [users, setUsers] = useState<InvitedUser[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [isRemoving, setIsRemoving] = useState<string | null>(null);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [removalError, setRemovalError] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  const invitedUsersCount = useMemo(() => {
    if (!users?.length) {
      return 0;
    }

    return users.reduce((count, user: any) => {
      if (!user) {
        return count;
      }

      if (typeof user.isInvited === 'boolean') {
        return user.isInvited ? count + 1 : count;
      }

      if (typeof user.source === 'string') {
        return user.source !== 'signed-in' ? count + 1 : count;
      }

      // Fallback to treating entries as invited when no metadata is available
      return count + 1;
    }, 0);
  }, [users]);

  const allUsersSelected = users.length > 0 && selectedUserIds.size === users.length;
  const partiallySelected = selectedUserIds.size > 0 && !allUsersSelected;
  const selectAllCheckboxState: boolean | "indeterminate" = allUsersSelected
    ? true
    : partiallySelected
      ? "indeterminate"
      : false;

  const handleSelectAllChange = (checked: boolean | "indeterminate") => {
    if (checked === true || checked === "indeterminate") {
      const next = new Set<string>();
      users.forEach((user: any) => {
        if (user?.id) {
          next.add(user.id);
        }
      });
      setSelectedUserIds(next);
    } else {
      setSelectedUserIds(new Set());
    }
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedUserIds(new Set());
  };

  const totalPages = useMemo(() => {
    if (!users.length) {
      return 1;
    }

    return Math.max(1, Math.ceil(users.length / USERS_PER_PAGE));
  }, [users.length]);

  const paginatedUsers = useMemo(() => {
    if (!users.length) {
      return [];
    }

    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    return users.slice(startIndex, startIndex + USERS_PER_PAGE);
  }, [users, currentPage]);

  const pageRange = useMemo(() => {
    if (!users.length) {
      return { start: 0, end: 0 };
    }

    const start = (currentPage - 1) * USERS_PER_PAGE + 1;
    const end = Math.min(currentPage * USERS_PER_PAGE, users.length);
    return { start, end };
  }, [users.length, currentPage]);

  useEffect(() => {
    setCurrentPage((prev) => {
      if (prev > totalPages) {
        return totalPages;
      }
      return prev;
    });
  }, [totalPages]);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  useEffect(() => {
    setSelectedUserIds((prev) => {
      if (prev.size === 0) {
        return prev;
      }

      const next = new Set<string>();
      users.forEach((user: any) => {
        if (prev.has(user.id)) {
          next.add(user.id);
        }
      });

      if (next.size === prev.size && Array.from(next).every((id) => prev.has(id))) {
        return prev;
      }

      return next;
    });
  }, [users]);

  const renderPagination = () => {
    if (loadingUsers || users.length === 0) {
      return null;
    }

    return (
      <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          Showing {pageRange.start}-{pageRange.end} of {users.length}
        </span>
        <div className="flex items-center space-x-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevPage}
            disabled={currentPage === 1}
            className="h-7 w-7 p-0 flex items-center justify-center"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="h-7 w-7 p-0 flex items-center justify-center"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!feedback) {
      return;
    }

    const timeout = setTimeout(() => setFeedback(null), 6000);
    return () => clearTimeout(timeout);
  }, [feedback]);

  // Email validation function
  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Load users function with useCallback
  const loadUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      // Fetch all users including signed-in users from Firebase Auth
      let response = await fetch(`/api/chatbot-users?chatbotId=${chatbot.id}&includeSignedIn=true`);
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
        if (data.warning) {
          console.warn('⚠️ Warning:', data.warning);
        }
        if (data.stats) {
          console.log('📊 User stats:', data.stats);
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

  const handleRequestRemoveUser = (user: any) => {
    if (!user?.id) {
      return;
    }

    setPendingRemoval({
      userIds: [user.id],
      users: [{
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        firebaseUid: user.firebaseUid || user.dedicatedProjectUserId
      }]
    });
    setFeedback(null);
    setRemovalError(null);
  };

  const handleBulkRemove = () => {
    if (selectedUserIds.size === 0) {
      return;
    }

    const selectedUsers = users.filter((user: any) => selectedUserIds.has(user.id));

    if (selectedUsers.length === 0) {
      setSelectedUserIds(new Set());
      return;
    }

    setPendingRemoval({
      userIds: selectedUsers.map((user: any) => user.id),
      users: selectedUsers.map((user: any) => ({
        id: user.id,
        displayName: user.displayName,
        email: user.email,
        firebaseUid: user.firebaseUid || user.dedicatedProjectUserId
      }))
    });
    setFeedback(null);
    setRemovalError(null);
  };

  const handleCancelRemoveUser = () => {
    if (isRemoving) {
      return;
    }
    setPendingRemoval(null);
    setRemovalError(null);
  };

  const handleRestoreUser = async (user: any) => {
    if (!user?.id) {
      return;
    }

    setIsRestoring(user.id);
    setFeedback(null);
    setRemovalError(null);

    const payload = {
      action: 'restore',
      chatbotId: chatbot.id,
      userId: user.id,
      firebaseUid: user.firebaseUid || user.dedicatedProjectUserId,
      email: user.email
    };

    try {
      const response = await fetch('/api/chatbot-users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.success) {
        await loadUsers();
        onUpdate();
        setFeedback({
          type: 'success',
          message: `${user.displayName || user.email || 'User'} re-enabled successfully.`
        });
        setSelectedUserIds((prev) => {
          if (!prev.has(user.id)) {
            return prev;
          }
          const next = new Set(prev);
          next.delete(user.id);
          return next;
        });
      } else {
        setFeedback({
          type: 'error',
          message: data.error || 'Failed to re-enable user.'
        });
      }
    } catch (error) {
      console.error('Error restoring user:', error);
      setFeedback({
        type: 'error',
        message: 'Failed to re-enable user. Please try again.'
      });
    } finally {
      setIsRestoring(null);
    }
  };

  const handleConfirmRemoveUser = async () => {
    if (!pendingRemoval) {
      return;
    }

    const { userIds, users: usersToRemove } = pendingRemoval;

    if (userIds.length === 0) {
      setPendingRemoval(null);
      return;
    }

    const isBulk = userIds.length > 1;
    setIsRemoving(isBulk ? 'bulk' : userIds[0]);
    setFeedback(null);
    setRemovalError(null);

    const errors: Array<{ id: string; message: string }> = [];
    const successfulIds: string[] = [];

    try {
      for (const userId of userIds) {
        try {
          const userMeta = usersToRemove.find((user) => user.id === userId);
          const removalPayload = {
            action: 'remove' as const,
            chatbotId: chatbot.id,
            userId,
            firebaseUid: userMeta?.firebaseUid || userMeta?.dedicatedProjectUserId,
            email: userMeta?.email
          };

          // Try the regular endpoint first, fallback to temp endpoint
          let response = await fetch('/api/chatbot-users', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(removalPayload)
          });

          let data = await response.json();

          if (!data.success && data.error?.includes('Firebase project not found')) {
            console.log('🔄 Falling back to temporary user storage...');
            response = await fetch('/api/chatbot-users-temp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(removalPayload)
            });
            data = await response.json();
          }

          if (data.success) {
            successfulIds.push(userId);
          } else {
            errors.push({ id: userId, message: data.error || 'Failed to disable user.' });
          }
        } catch (error) {
          console.error('Error disabling user:', error);
          errors.push({ id: userId, message: 'Failed to disable user. Please try again.' });
        }
      }

      if (successfulIds.length > 0) {
        await loadUsers(); // Refresh the list
        onUpdate(); // Notify parent
        setSelectedUserIds((prev) => {
          if (prev.size === 0) {
            return prev;
          }
          const next = new Set(prev);
          successfulIds.forEach((id) => next.delete(id));
          return next;
        });
      }

      if (errors.length === 0) {
        const successMessage = isBulk
          ? `${successfulIds.length} user${successfulIds.length === 1 ? '' : 's'} disabled successfully.`
          : `${usersToRemove[0]?.displayName || usersToRemove[0]?.email || 'User'} disabled successfully.`;

        setFeedback({
          type: 'success',
          message: successMessage
        });
        setPendingRemoval(null);
      } else {
        const failedUsers = usersToRemove.filter((user) =>
          errors.some((error) => error.id === user.id)
        );

        const failureCount = failedUsers.length;
        const failureMessage = failureCount === 1
          ? errors[0].message
          : `${failureCount} users could not be disabled. Please try again.`;

        setRemovalError(failureMessage);

        if (failedUsers.length > 0) {
          setPendingRemoval({
            userIds: failedUsers.map((user) => user.id),
            users: failedUsers
          });
        } else {
          setPendingRemoval(null);
        }
      }
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
          <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <div className="flex items-center space-x-2 mb-2">
              <Info className="h-5 w-5 text-gray-600" />
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">Authentication Disabled</h4>
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
    <>
      {feedback && (
        <div className="fixed top-4 right-4 z-50 animate-in fade-in">
          <div
            className={`flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg ${
              feedback.type === 'success'
                ? 'bg-green-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            <span className="text-sm font-medium leading-tight">{feedback.message}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="ml-auto rounded-full p-1 text-white/80 transition hover:text-white"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5" />
              <span>User Management</span>
            </div>
            <span className="text-sm font-normal text-gray-500">
              {invitedUsersCount} user(s) invited
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Invite New User */}
        <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border dark:border-gray-600">
          <h5 className="text-sm font-medium text-gray-900 dark:text-white">Invite New User</h5>
          
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
          <h5 className="text-sm font-medium text-gray-900 dark:text-white">All Users</h5>

          {!loadingUsers && users.length > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700 dark:text-gray-200">
                  <Checkbox
                    checked={selectAllCheckboxState}
                    onCheckedChange={handleSelectAllChange}
                    aria-label={allUsersSelected ? 'Deselect all users' : 'Select all users'}
                    disabled={isRemoving === 'bulk' || Boolean(isRestoring)}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSelectAllChange(allUsersSelected ? false : true)}
                    disabled={isRemoving === 'bulk' || Boolean(isRestoring)}
                    className="h-7 px-3"
                  >
                    {allUsersSelected ? 'Deselect all' : 'Select all'}
                  </Button>
                  {selectedUserIds.size > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={clearSelection}
                      disabled={isRemoving === 'bulk' || Boolean(isRestoring)}
                      className="h-7 px-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Clear
                    </Button>
                  )}
                  <span className="text-xs text-gray-400 dark:text-gray-500">
                    {selectedUserIds.size} selected
                  </span>
                </div>
                <div className="flex-1 min-w-[220px]">
                  {renderPagination()}
                </div>
              </div>

              {selectedUserIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkRemove}
                  disabled={isRemoving === 'bulk' || Boolean(isRestoring)}
                  className="h-8 w-full sm:w-auto"
                >
                  {isRemoving === 'bulk'
                    ? 'Disabling selected...'
                    : `Disable selected (${selectedUserIds.size})`}
                </Button>
              )}
            </div>
          )}

          {loadingUsers ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Loading users...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8">
              <Mail className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No users yet.</p>
              <p className="text-xs text-gray-400 mt-1">
                Invite users above or let them sign up directly to give them access to your chatbot.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {paginatedUsers.map((user: any) => {
                const invitedDate = user.invitedAt?.seconds
                  ? new Date(user.invitedAt.seconds * 1000)
                  : new Date(user.invitedAt);
                const lastSignIn = user.lastSignInAt?.seconds
                  ? new Date(user.lastSignInAt.seconds * 1000)
                  : user.lastSignInAt ? new Date(user.lastSignInAt) : null;

                const isSelected = selectedUserIds.has(user.id);

                return (
                  <div key={user.id} className="flex items-center justify-between bg-white dark:bg-gray-700 px-4 py-3 rounded border dark:border-gray-600">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleUserSelection(user.id)}
                        aria-label={isSelected ? `Deselect ${user.displayName || user.email}` : `Select ${user.displayName || user.email}`}
                        disabled={isRemoving === 'bulk' || isRemoving === user.id || isRestoring === user.id}
                      />
                      <div className="flex items-center gap-3">
                        {getStatusIcon(user.status)}
                        <div>
                          <div className="flex items-center space-x-2">
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.displayName || user.email}
                            </div>
                            {/* Source badge */}
                            {user.source === 'signed-in' && (
                              <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                                Signed Up
                              </span>
                            )}
                            {user.source === 'both' && lastSignIn && (
                              <span className="px-1.5 py-0.5 text-xs rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                                ✓ Signed In
                              </span>
                            )}
                          </div>
                          {user.displayName && (
                            <div className="text-xs text-gray-500">{user.email}</div>
                          )}
                          <div className="text-xs text-gray-400">
                            {user.source === 'signed-in' ? 'Signed up' : 'Invited'} {invitedDate.toLocaleDateString()}
                            {lastSignIn && (
                              <> • Last signed in {lastSignIn.toLocaleDateString()}</>
                            )}
                            {user.status === 'pending' && !lastSignIn && (
                              <> • <span className="text-amber-600">Awaiting email verification</span></>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                        user.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                      }`}>
                        {user.status === 'active' ? 'Active' :
                         user.status === 'pending' ? 'Pending' : 'Disabled'}
                      </span>

                      {user.status === 'disabled' ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestoreUser(user)}
                          disabled={isRestoring === user.id || isRemoving === 'bulk'}
                          className="h-8 px-3 text-gray-500 hover:text-green-600 hover:border-green-300"
                        >
                          {isRestoring === user.id ? 'Enabling...' : 'Enable'}
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRequestRemoveUser(user)}
                          disabled={isRemoving === user.id || isRemoving === 'bulk'}
                          className="h-8 w-8 p-0 text-gray-400 hover:text-amber-600 hover:border-amber-300"
                          aria-label={`Disable ${user.displayName || user.email || 'user'}`}
                        >
                          {isRemoving === user.id ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-t border-amber-600"></div>
                          ) : (
                            <UserX className="h-3 w-3" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {renderPagination()}
        </div>
        </CardContent>
      </Card>

      <Dialog
        open={Boolean(pendingRemoval)}
        onOpenChange={(open) => {
          if (!open) {
            handleCancelRemoveUser();
          }
        }}
      >
        <DialogContent className="p-6">
          {pendingRemoval && (() => {
            const removalCount = pendingRemoval.users.length;
            const isBulkRemoval = removalCount > 1;
            const primaryUser = pendingRemoval.users[0];
            const targetLabel = isBulkRemoval
              ? `${removalCount} selected user${removalCount === 1 ? '' : 's'}`
              : primaryUser?.displayName || primaryUser?.email || 'this user';
            const isBulkRemoving = isRemoving === 'bulk';
            const singleRemoving = removalCount === 1 && isRemoving === pendingRemoval.userIds[0];
            const actionDisabled = isBulkRemoving || singleRemoving;
            const previewUsers = isBulkRemoval ? pendingRemoval.users.slice(0, 3) : [];
            const extraCount = Math.max(0, removalCount - previewUsers.length);

            return (
              <div className="space-y-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {isBulkRemoval ? 'Disable selected users' : 'Disable user'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {isBulkRemoval
                        ? `This will disable access for ${targetLabel}. They will remain listed but cannot sign in until re-enabled.`
                        : `This will disable access for ${targetLabel}. They will remain listed but cannot sign in until re-enabled.`}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCancelRemoveUser}
                    disabled={actionDisabled}
                    className="rounded-md p-1 text-gray-400 hover:text-gray-600 disabled:opacity-40 dark:hover:text-gray-200"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {isBulkRemoval && (
                  <div className="rounded-md border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    <ul className="space-y-1">
                      {previewUsers.map((user) => (
                        <li key={user.id}>{user.displayName || user.email || user.id}</li>
                      ))}
                      {extraCount > 0 && (
                        <li className="text-xs text-gray-500 dark:text-gray-400">
                          +{extraCount} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-100">
                  Disabled users will need to be re-enabled or reinvited before they can sign in again.
                </div>

                {removalError && (
                  <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800/60 dark:bg-red-900/30 dark:text-red-200">
                    {removalError}
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={handleCancelRemoveUser}
                    disabled={actionDisabled}
                  >
                    Keep active
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleConfirmRemoveUser}
                    disabled={actionDisabled}
                  >
                    {actionDisabled
                      ? 'Disabling...'
                      : isBulkRemoval
                        ? `Disable ${removalCount} user${removalCount === 1 ? '' : 's'}`
                        : 'Disable user'}
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}
