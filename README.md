# Chat Factory - Documentation-Powered AI Assistants

Chat Factory is a SaaS platform that transforms documentation into intelligent AI chatbots. It allows businesses to upload their documentation and automatically create AI assistants that can answer user questions based on the content.

## Features

- **Document Processing**: Upload and process documentation in various formats (PDF, Markdown, HTML, Word, Text)
- **AI-Powered Embeddings**: Automatically converts documents into vector embeddings for AI retrieval
- **Smart Chunking**: Intelligent document chunking with AI suggestions for optimization
- **Custom Chatbots**: Create branded chatbots trained on your specific documentation
- **Analytics Dashboard**: Track usage, popular questions, and chatbot performance
- **User Management**: Firebase authentication with user roles and permissions
- **Customization Options**: Tailor chatbot appearance, behavior, and integration
- **Freemium Model**: Free tier with limited document uploads and a two-week trial period

## Technology Stack

- **Frontend**: Next.js with App Router, React, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Authentication**: Firebase Authentication
- **Database**: Firebase Firestore (for user data, analytics)
- **Vector Store**: Pinecone/Supabase (for embeddings storage)
- **AI Integration**: OpenAI API for embeddings and completion
- **Analytics**: Custom analytics dashboard with Recharts

## Software Architecture

### 1. Overall Architecture (Layered Approach)

```
┌───────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                  │
│  (Next.js App Router, React Components, Client-side Logic) │
└─────────────────────────────┬─────────────────────────────┘
                             │
┌─────────────────────────────▼─────────────────────────────┐
│                        APPLICATION LAYER                   │
│    (API Routes, Server Components, Service Orchestration)  │
└─────────────────────────────┬─────────────────────────────┘
                             │
┌─────────────────────────────▼─────────────────────────────┐
│                          DOMAIN LAYER                      │
│       (Business Logic, Document Processing, Chat Logic)    │
└─────────────────────────────┬─────────────────────────────┘
                             │
┌─────────────────────────────▼─────────────────────────────┐
│                      INFRASTRUCTURE LAYER                  │
│  (Firebase, Vector DB, OpenAI API, File Storage, Caching)  │
└───────────────────────────────────────────────────────────┘
```

### 2. Core Services & Components

#### Authentication Module
- Firebase Auth integration
- User session management
- Role-based access control
- JWT handling for API requests

#### Document Processing Pipeline
```
┌─────────────┐    ┌─────────────┐    ┌──────────────┐    ┌───────────────┐
│ File Upload │ -> │ Text Extract│ -> │ Text Chunking│ -> │ Embedding Gen │
└─────────────┘    └─────────────┘    └──────────────┘    └───────────────┘
                                                                  │
                                          ┌────────────────┐      │
                                          │ Retrieval API  │ <----┘
                                          └────────────────┘
```

#### Chatbot Generation Service
- Chatbot configuration manager
- Embedding selector/combiner
- Response generation service
- Deployment & integration service

#### Analytics Engine
- Query tracking
- Performance metrics collection
- Usage statistics
- Visualization data preparation

### 3. Data Architecture

```
┌─────────────────┐    ┌───────────────────┐    ┌─────────────────┐
│  Firebase Auth  │    │  Firebase Firestore│    │  Firebase Storage│
│  (User Data)    │    │  (Document Metadata│    │  (Original Docs) │
└─────────────────┘    │   Config Settings) │    └─────────────────┘
                       └───────────────────┘
                                │
                    ┌───────────┴──────────┐
                    │                      │
           ┌────────▼────────┐    ┌────────▼────────┐
           │  Vector Database │    │  Analytics DB   │
           │  (Embeddings)    │    │  (Usage Data)   │
           └─────────────────┘    └─────────────────┘
```

### 4. API Structure

```
/api
├── auth
│   ├── login
│   ├── logout
│   └── register
├── documents
│   ├── upload
│   ├── process
│   ├── embed
│   └── list
├── chatbots
│   ├── create
│   ├── configure
│   ├── deploy
│   └── integrate
├── chat
│   ├── query
│   └── feedback
└── analytics
    ├── usage
    ├── performance
    └── insights
```

### 5. State Management Strategy

- **Server State**: React Query for API data fetching
- **Client State**: Context API or Zustand for UI state
- **Global App State**: Redux (if complex) or Context API for auth/user state

### 6. Optimizations & Scaling Considerations

#### Performance Optimizations
- Edge caching for static content
- CDN for assets
- Serverless functions for API routes
- Chunked file uploads for large documents

#### Scaling Strategy
- Horizontal scaling of stateless services
- Queue-based processing for document ingestion
- Rate limiting for free-tier users
- Incremental static regeneration for dashboards

### 7. Implementation in Next.js App Router Structure

```
/src
├── app
│   ├── (marketing)        # Public pages
│   ├── (auth)             # Authentication 
│   ├── dashboard          # Protected routes
│   └── api                # API routes
├── components             # UI components
├── lib
│   ├── auth               # Auth utilities
│   ├── documents          # Document processing
│   ├── embeddings         # Vector operations
│   ├── chatbot            # Chatbot logic
│   └── analytics          # Analytics utilities
├── hooks                  # Custom React hooks
├── contexts               # Global contexts
├── services               # External service integrations
│   ├── firebase           # Firebase client
│   ├── openai             # OpenAI integration
│   └── vectordb           # Vector DB client
└── types                  # TypeScript definitions
```

### 8. Key Technical Decisions

1. **LLM Integration**:
   - OpenAI API for embedding generation and chat completion
   - Potential for multi-model support (switch between providers)

2. **Vector Database**:
   - Pinecone or Supabase for production
   - Local vector store (FAISS) for development

3. **File Processing**:
   - Worker threads for CPU-intensive tasks
   - Support for PDF, DOCX, MD, HTML, TXT

4. **Deployment Strategy**:
   - Vercel for Next.js frontend
   - Firebase for authentication and database
   - Separate serverless functions for heavy processing

### 9. Security Considerations

- Firebase Authentication for user management
- Server-side API key storage
- Rate limiting to prevent abuse
- Data isolation between tenants
- Input validation and sanitization
- CORS policies for API endpoints

## Project Structure

```
/src
  /app
    /(marketing)     # Landing page and public content
    /(auth)          # Authentication pages (login, signup)
    /dashboard       # User dashboard
      /documents     # Document management
      /chatbots      # Chatbot creation and management
      /analytics     # Usage analytics
      /settings      # User and account settings
  /components        # Reusable UI components
  /lib               # Utility functions and services
```

## Getting Started

1. Clone the repository
2. Install dependencies with `npm install`
3. Set up environment variables:
   - Create a `.env.local` file with required API keys for Firebase, etc.
4. Run the development server with `npm run dev`
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Key Workflows

### Document Processing

1. Users upload documentation files
2. System processes and chunks documents
3. AI generates embeddings for each chunk
4. System displays chunking results with suggestions for optimization
5. Users can approve or modify the chunking approach
6. Final embeddings are stored for retrieval

### Chatbot Creation

1. Users create a new chatbot
2. Select which document collections to include
3. Configure appearance and behavior
4. Get a deployment link or embed code
5. Monitor performance in the analytics dashboard

### User Journey

1. Users sign up for a free or paid account
2. Upload documentation
3. Create and customize chatbots
4. Deploy chatbots to their websites/applications
5. Monitor and optimize based on analytics

## Development Roadmap

- [ ] Initial project setup and landing page
- [ ] Authentication system integration
- [ ] Document upload and processing
- [ ] Embedding generation and storage
- [ ] Chatbot creation interface
- [ ] Analytics dashboard
- [ ] User management and subscriptions
- [ ] API for chatbot integration
- [ ] Advanced customization options

## License

This project is private and proprietary.
