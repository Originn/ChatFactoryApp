# Vercel Project Deletion Implementation

## Overview
This implementation adds the capability to delete Vercel projects when chatbots are deleted from the ChatFactory App, ensuring that both the Firestore database records and the deployed Vercel projects are cleaned up together.

## Changes Made

### 1. Added Vercel SDK Dependency
- Installed `@vercel/sdk` package to interact with Vercel API
- Used `--legacy-peer-deps` flag to resolve ESLint dependency conflicts

### 2. Created Vercel Delete API Endpoint
**File**: `src/app/api/vercel-delete/route.ts`
- New DELETE endpoint at `/api/vercel-delete`
- Accepts `projectId` or `projectName` in request body
- Uses Vercel SDK to delete projects
- Handles error cases gracefully (e.g., project not found)
- Returns success/error responses with detailed logging

### 3. Updated Chatbots Listing Page
**File**: `src/app/dashboard/chatbots/page.tsx`
- Enhanced `handleDeleteChatbot` function to:
  - Retrieve Vercel project information from Firestore
  - Call the new `/api/vercel-delete` endpoint
  - Continue with Firestore deletion even if Vercel deletion fails
  - Provide detailed console logging for debugging
- Added `vercelProjectId` to the Chatbot interface

### 4. Updated Individual Chatbot Page  
**File**: `src/app/dashboard/chatbots/[id]/page.tsx`
- Enhanced `handleDeleteChatbot` function with same logic as listing page
- Added `vercelProjectId` and `vercelDeploymentId` to the Chatbot interface
- Maintains existing redirect behavior after successful deletion

## How It Works

1. **During Deployment**: The vercel-deploy endpoint stores the project name as `vercelProjectId` in Firestore
2. **During Deletion**: 
   - Retrieve the chatbot data from Firestore to get `vercelProjectId`
   - If no `vercelProjectId`, generate project name from chatbot name
   - Call `/api/vercel-delete` with the project information
   - Delete from Firestore regardless of Vercel deletion success/failure
   - Update UI and redirect as appropriate

## Error Handling
- Graceful fallback: If Vercel deletion fails, Firestore deletion still proceeds
- Handles "project not found" errors as success (project already deleted)
- Detailed logging for debugging purposes
- User-friendly error messages

## Environment Requirements
- `VERCEL_API_TOKEN` environment variable must be set in your deployment environment
- The token should have project deletion permissions

## Testing
1. Create a new chatbot and deploy it to Vercel
2. Verify the deployment creates a project in your Vercel dashboard
3. Delete the chatbot from the ChatFactory App
4. Verify both the Firestore record and Vercel project are deleted
5. Check browser console for detailed logs during the deletion process

## Benefits
- Prevents accumulation of unused Vercel projects
- Maintains consistency between local database and deployed resources
- Reduces Vercel project count and potential billing issues
- Provides clear audit trail through logging
