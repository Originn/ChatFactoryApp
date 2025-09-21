# ChatFactory Pool Management Scripts

Automated deployment and management scripts for ChatFactory pool projects.

## 🚀 Quick Start

### 1. Run the Master Script (Recommended)
```bash
./scripts/chatfactory-manager.sh
```

This interactive menu provides access to all operations with guidance.

### 2. Or Run Individual Scripts

#### First Time Setup
```bash
./scripts/setup-prerequisites.sh
```

#### Deploy chatfactory-pool-002 (Test)
```bash
./scripts/deploy-chatfactory-pool-002.sh
```

#### Validate Deployment
```bash
./scripts/validate-deployment.sh chatfactory-pool-002 [vercel-url]
```

#### Check Project Status
```bash
./scripts/check-project-status.sh chatfactory-pool-002
./scripts/check-project-status.sh --all
```

#### Cleanup for Re-testing
```bash
./scripts/cleanup-pool-002.sh
```

## 📋 Script Overview

### Core Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `chatfactory-manager.sh` | Interactive master script | `./scripts/chatfactory-manager.sh` |
| `setup-prerequisites.sh` | One-time environment setup | `./scripts/setup-prerequisites.sh` |
| `deploy-chatfactory-pool-002.sh` | Deploy pool-002 test project | `./scripts/deploy-chatfactory-pool-002.sh` |
| `validate-deployment.sh` | Test deployment health | `./scripts/validate-deployment.sh <project-id>` |
| `check-project-status.sh` | Check project status | `./scripts/check-project-status.sh <project-id>` |
| `cleanup-pool-002.sh` | Reset pool-002 for testing | `./scripts/cleanup-pool-002.sh` |

### Features

#### 🔐 Security
- **Individual service accounts** per project for complete isolation
- **Minimal permissions** following principle of least privilege
- **Secure key management** with local storage in `./keys/`

#### 📊 Project Tracking
- **Dual tracking system**: Google Secret Manager + Firestore
- **Real-time status**: available, in-use, maintenance, deprecated
- **Central visibility**: Track all projects from one location

#### 🔄 Smart Reuse
- **Project discovery**: Automatically finds available projects
- **Resource optimization**: Reuses existing infrastructure
- **Cost efficiency**: Minimizes new project creation

#### 🧪 Testing Framework
- **Complete validation**: OAuth, Firebase, Vercel integration
- **Easy cleanup**: Reset projects for iterative testing
- **Health monitoring**: System-wide status checks

## 🗂️ File Structure

```
scripts/
├── chatfactory-manager.sh          # Master interactive script
├── setup-prerequisites.sh          # Environment validation & setup
├── deploy-chatfactory-pool-002.sh  # Test deployment script
├── validate-deployment.sh          # Deployment validation
├── check-project-status.sh         # Project status checker
├── cleanup-pool-002.sh            # Pool-002 cleanup
└── README.md                       # This file

keys/                               # Service account keys (auto-created)
├── docsai-chatbot-app-main-key.json
├── chatfactory-pool-002-service-key.json
└── ...

.env.local.backup                   # Environment backup (auto-created)
```

## 🎯 Testing Workflow

### Initial Setup
1. Run `./scripts/setup-prerequisites.sh`
2. Verify all prerequisites pass

### Test Deployment
1. Run `./scripts/deploy-chatfactory-pool-002.sh`
2. Complete OAuth setup manually (as instructed)
3. Run `./scripts/validate-deployment.sh chatfactory-pool-002`

### Iterative Testing
1. Run `./scripts/cleanup-pool-002.sh`
2. Make code changes
3. Re-run deployment script
4. Validate again

### Production Preparation
1. Test with pool-002 until perfect
2. Use the validated process for 50-project automation
3. Scale the scripts for bulk deployment

## 🔧 Troubleshooting

### Common Issues

#### "Service account key not found"
```bash
# Run prerequisites setup
./scripts/setup-prerequisites.sh
```

#### "Project already in use"
```bash
# Check status first
./scripts/check-project-status.sh chatfactory-pool-002

# If needed, cleanup
./scripts/cleanup-pool-002.sh
```

#### "Firebase authentication failed"
```bash
# Re-authenticate
firebase login
gcloud auth login
```

#### "OAuth redirect URI mismatch"
- Complete the manual OAuth setup as shown in deployment output
- Wait 5-15 minutes for propagation
- Verify URLs match exactly

### Debug Mode
Add `-x` to any script for verbose debugging:
```bash
bash -x ./scripts/deploy-chatfactory-pool-002.sh
```

## 📊 Project Status Codes

| Status | Symbol | Description |
|--------|--------|-------------|
| `available` | 🟢 | Ready for new deployment |
| `in-use` | 🔴 | Currently hosting a chatbot |
| `maintenance` | 🟡 | Temporarily unavailable |
| `deprecated` | ⚫ | Should not be used |

## 🔐 Security Notes

### Service Account Isolation
- Each project has its own service account
- Permissions limited to specific project only
- Keys stored locally, never committed to git

### Central Tracking Access
- Main service account only for central Firestore
- Read/write access to project tracking collection
- Separate from individual project access

### Best Practices
- Keep service account keys secure
- Rotate keys periodically
- Use principle of least privilege
- Monitor access logs

## 🚀 Scaling to 50 Projects

This testing framework is designed to validate the process before scaling to 50 projects:

1. **Perfect the process** with pool-002
2. **Adapt deployment script** for dynamic project IDs
3. **Create bulk deployment** wrapper
4. **Implement monitoring** for all projects
5. **Add cleanup procedures** for production

The core architecture (service account isolation, dual tracking, smart reuse) is already designed for large-scale deployment.

## 📞 Support

For issues or questions:
1. Check the troubleshooting section above
2. Run `./scripts/chatfactory-manager.sh` and use option 8 (System health check)
3. Review logs in the deployment output
4. Validate each step with the validation script

## 🎉 Success Criteria

A successful pool-002 deployment should show:
- ✅ Project created and tracked
- ✅ Firebase services enabled
- ✅ Authentication providers configured
- ✅ Vercel deployment accessible
- ✅ OAuth flow working (after manual setup)
- ✅ Project marked as in-use in both tracking systems

Once this works reliably, the process is ready for 50-project automation!