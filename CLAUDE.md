# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chat Factory is a SaaS platform that transforms documentation into intelligent AI chatbots. Users upload documentation (PDF, Markdown, HTML, Word, Text), which is processed into vector embeddings, and then deploy customized AI assistants trained on their content.

## Development Commands

### Local Development
```bash
npm run dev          # Start Next.js development server (http://localhost:3000)
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Testing
```bash
npm run test:domains         # Test custom domain functionality
npm run test:domains:verbose # Test custom domains with debug output
```

## Architecture Overview

### Tech Stack
- **Frontend**: Next.js 14 (App Router), React, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API routes (serverless)
- **Authentication**: Firebase Authentication
- **Databases**:
  - Firebase Firestore (user data, chatbot metadata, analytics)
  - Pinecone (vector embeddings)
  - Neo4j Aura (optional knowledge graphs)
- **AI**: OpenAI API (embeddings & completion), with support for Mistral, Anthropic, Cohere
- **Deployment**: Vercel (main app), GCP Cloud Run (document processing microservices)
- **Storage**: Firebase Storage, Google Cloud Storage

### Key Architectural Patterns

#### 1. Multi-Tenant Firebase Project Management
The system uses a sophisticated **pool-based allocation system** for Firebase projects:

- **Pool-First Allocation**: Reusable Firebase projects are managed in a pool (`reusableFirebaseProjectService.ts`)
- **Dedicated Fallback**: If pool exhausted, creates dedicated projects (`firebaseProjectService.ts`)
- **Secrets Management**: Migrated from Google Secret Manager to Firestore (`firestoreSecretService.ts`) for cost optimization
- **Project Mapping**: Tracks chatbot-to-project assignments (`projectMappingService.ts`)

Key files:
- `src/services/reusableFirebaseProjectService.ts` - Pool cleanup and management
- `src/services/firebaseProjectService.ts` - Dedicated project creation
- `src/services/firestoreSecretService.ts` - Encrypted secret storage
- `src/services/projectMappingService.ts` - Project allocation tracking

#### 2. Document Processing Pipeline
```
Upload → Text Extraction → Chunking → Embedding Generation → Vector Storage
```

- **File Processing Services** (Cloud Run microservices):
  - `PDF_CONVERTER_URL` - PDF text extraction
  - `CHM_CONVERTER_URL` - CHM file conversion
  - `VIDEO_TRANSCRIBER_CPU_URL` / `VIDEO_TRANSCRIBER_GPU_URL` - Video transcription
- **Image OCR**: `src/services/imageOcrService.ts` - OpenAI Vision API for image text extraction
- **Vector Storage**: `src/services/pineconeService.ts` - Manages Pinecone namespaces per chatbot

#### 3. Chatbot Deployment Flow
```
Chatbot Creation → Firebase Project Allocation → Vercel Deployment → Domain Configuration
```

- **Deployment**: `src/app/api/vercel-deploy/route.ts` - Deploys from ChatFactoryTemplate repo
- **Domain Management**: `src/app/api/domains/` - Custom domain setup and verification
- **Firebase Config**: Each chatbot gets isolated Firebase project with auth enabled

Key deployment features:
- Automatic environment variable injection (API keys, Firebase config, model settings)
- Custom domain support with DNS verification
- Automatic favicon/logo upload to deployment

#### 4. YouTube Integration
Complete OAuth 2.0 flow for YouTube data access:

- `src/app/api/youtube/oauth/` - OAuth initiation, callback, refresh, disconnect
- `src/services/centralizedYouTubeService.ts` - Unified YouTube API client
- `src/lib/youtube/` - Transcript extraction, mobile utils, security utils

#### 5. Authentication & Authorization
- **Client-side**: `src/lib/firebase/config.ts` - Firebase client SDK
- **Server-side**: `src/lib/firebase/admin/index.ts` - Firebase Admin SDK with unified GCP credentials
- **Auth Provider**: `src/components/providers/AuthProvider.tsx` - React context for auth state

### Path Aliases
The project uses TypeScript path aliases:
```typescript
"@/*" → "./src/*"
```

Example: `import { adminDb } from '@/lib/firebase/admin'`

## Critical Services

### GCP Integration
All Google Cloud services share unified credentials via `src/lib/gcp-auth.ts`:
- Uses `GOOGLE_APPLICATION_CREDENTIALS_JSON` environment variable
- Supports both local development (service account file) and production (env var)

### Secret Management (Important!)
**DO NOT use Google Secret Manager** - the system has migrated to Firestore-based secrets:
- All secrets stored in `secrets` Firestore collection with AES-256-CBC encryption
- Use `FirestoreSecretService.getSecret(name)` and `FirestoreSecretService.storeSecret(name, value, metadata)`
- Encryption key: `FIRESTORE_ENCRYPTION_KEY` environment variable

### Neo4j Knowledge Graphs
Optional feature for advanced chatbots:
- `src/services/neo4jAuraService.ts` - Programmatic AuraDB instance creation
- OAuth 2.0 authentication with automatic token refresh
- Instance lifecycle: create → monitor status → delete
- Credentials stored per-chatbot in Firestore

## Environment Configuration

Required environment variables (see `.env.example` for full list):

**Firebase (Main App)**
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `NEXT_PUBLIC_FIREBASE_*` - Client-side config

**AI Providers**
- `OPENAI_API_KEY`, `MISTRAL_API_KEY`, `ANTHROPIC_API_KEY`, `COHERE_API_KEY`

**Deployment**
- `VERCEL_API_TOKEN` - Required for chatbot deployments
- `GOOGLE_APPLICATION_CREDENTIALS_JSON` - GCP service account (production)

**Security**
- `FIRESTORE_ENCRYPTION_KEY` - For secret encryption (default dev key should be changed in production)

**Feature Flags**
- `NEXT_PUBLIC_COMING_SOON=false` - Controls coming soon page
- `FORCE_AGGRESSIVE_CLEANUP=false` - Enable aggressive Firebase project cleanup

## Common Development Workflows

### Adding a New Document Type
1. Add converter service (similar to `src/services/pdfService.ts`, `src/services/chmService.ts`)
2. Update upload API: `src/app/api/documents/route.ts`
3. Add processing logic in upload component: `src/components/dashboard/InlineDocumentUpload.tsx`

### Creating New API Routes
- Place in `src/app/api/` following Next.js App Router conventions
- Use Firebase Admin SDK for database access: `import { adminDb } from '@/lib/firebase/admin'`
- Authentication check pattern: verify Firebase auth tokens in request headers

### Modifying Chatbot Deployment
- Template repo: https://github.com/Originn/ChatFactoryTemplate
- Deployment logic: `src/app/api/vercel-deploy/route.ts`
- Environment variables automatically injected from chatbot config + embedding models

### Working with Firebase Projects
- **Creating**: Use `FirebaseProjectService.createFirebaseProject()` (dedicated) or pool allocation
- **Cleanup**: `ReusableFirebaseProjectService.cleanupChatbotData()` with `aggressiveCleanup` flag
- **Mapping**: Always track with `ProjectMappingService`

## Database Schema (Firestore)

Key collections:
- `users` - User accounts and metadata
- `chatbots` - Chatbot configurations (including deployment URLs, Firebase project IDs)
- `userPdfs` - Uploaded document metadata
- `firebaseProjects` - Dedicated Firebase project records
- `projectMappings` - Chatbot → Firebase project assignments
- `reusableFirebaseProjects` - Pool of reusable projects
- `secrets` - Encrypted secrets (API keys, service accounts)
- `neo4jInstances` - Neo4j AuraDB instance metadata
- `youtubeData` - YouTube OAuth tokens per user

## UI Components

Built with shadcn/ui:
- Located in `src/components/ui/`
- Custom extensions: `custom-tooltip.tsx`, `simple-theme-toggle.tsx`
- Dashboard components: `src/components/dashboard/`
- Chatbot-specific: `src/components/chatbot/`

## Debugging & Utilities

### Debug Endpoints
Located in `src/app/api/debug/`:
- `/api/debug/pool-status` - Check Firebase pool status
- `/api/debug/check-secret` - Verify Firestore secret access
- `/api/debug/migrate-secrets-to-firestore` - Migration utility
- `/api/system-status` - Overall system health check

### Coming Soon Mode
- Enable with `NEXT_PUBLIC_COMING_SOON=true`
- Bypass via IP (`ADMIN_BYPASS_IPS`) or email (`ADMIN_BYPASS_EMAILS`)
- Bypass token validation: `src/lib/bypass.ts`

## Important Notes

1. **TypeScript Strict Mode**: Disabled (`strict: false` in tsconfig.json) - be mindful of type safety
2. **Embedding Models**: Configurable per chatbot - see `src/lib/embeddingModels.ts` for supported models
3. **Usage Tracking**: `src/services/usageTrackingService.ts` - tracks document uploads, chatbot queries
4. **Monthly Resets**: Cron job at `/api/cron/monthly-reset` - resets free tier limits
5. **Email Verification**: Required for chatbot users - see `src/services/chatbotEmailVerificationService.ts`
