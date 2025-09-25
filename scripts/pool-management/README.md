# ChatFactory Pool Management

Streamlined automated deployment system for creating Firebase projects that serve as infrastructure for ChatFactory chatbot deployments.

## 🚀 Quick Start

### 1. First Time Setup (Run once)
```bash
./scripts/pool-management/setup-prerequisites.sh
```

Sets up authentication, validates tools (gcloud, firebase-cli, jq), and configures billing accounts.

### 2. Deploy New Pool Projects

Deploy any pool number you want:

```bash
# Deploy specific pools
./scripts/pool-management/deploy-chatfactory-pool.sh 009
./scripts/pool-management/deploy-chatfactory-pool.sh 010
./scripts/pool-management/deploy-chatfactory-pool.sh 025

# Deploy with custom project name
./scripts/pool-management/deploy-chatfactory-pool.sh 011 "Custom Pool Name"
```

## 🎯 What Gets Created

Each pool deployment automatically creates:

- ✅ **Google Cloud Project** with billing linked
- ✅ **Firebase Project** with authentication enabled
- ✅ **OAuth Consent Screen** configured
- ✅ **OAuth Client** for Google Sign-in
- ✅ **Google Authentication Provider** fully configured
- ✅ **Firestore Database** ready for use
- ✅ **Service Account** for chatbot backend operations
- ✅ **Project Tracking** in central management system

## 📋 Requirements

- Google Cloud CLI (`gcloud`) with Editor permissions
- Firebase CLI (`firebase`) authenticated
- `jq` command-line JSON processor
- Personal account: `ori.somekh@wizechat.ai` with project access

## 🔧 Configuration

Pool projects are configured with:
- **Billing Account**: `011C35-0F1A1B-49FBEC`
- **Main Project**: `docsai-chatbot-app` (for central tracking)
- **Authentication**: Personal account throughout (no service account switching)
- **Naming**: `chatfactory-pool-XXX` format

## ⚡ Features

- **Generic Deployment**: Single script handles any pool number
- **Automatic OAuth Setup**: Creates and configures OAuth client automatically
- **Timing Optimized**: Proper delays for Google Cloud service propagation
- **Error Recovery**: Retry logic and comprehensive error handling
- **No Manual Steps**: Fully automated from start to finish

## 📁 Project Structure

```
scripts/pool-management/
├── deploy-chatfactory-pool.sh    # Main deployment script
├── setup-prerequisites.sh        # One-time setup script
└── README.md                     # This documentation
```

## 🎉 Result

After successful deployment, you'll have a fully configured Firebase project ready for ChatFactory chatbot deployment with:

- Google Authentication working out of the box
- All necessary APIs enabled
- Proper OAuth client configured
- Firebase console accessible at: `https://console.firebase.google.com/project/chatfactory-pool-XXX`

The pool project can then be used as infrastructure for deploying ChatFactory chatbots via the ChatFactoryTemplate.

## 🚨 Important Notes

- Pool projects are for **infrastructure setup**, not chatbot deployment
- Service accounts are created but credentials are managed via environment variables
- All timing delays are optimized for Google Cloud service propagation
- OAuth clients are automatically configured - no manual setup required

## 🔄 Workflow

1. **Run prerequisites** (first time only)
2. **Deploy pool** with desired number
3. **Pool ready** for chatbot deployment
4. **Repeat** for additional pools as needed

Simple, automated, and reliable! 🚀