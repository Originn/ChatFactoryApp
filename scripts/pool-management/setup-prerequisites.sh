#!/bin/bash

# Prerequisites Setup Script for ChatFactory Pool Projects
# This script validates and sets up all required dependencies
# Run from ChatFactoryApp to manage ChatFactoryTemplate deployments

set -e  # Exit on any error

echo "🔧 ChatFactory Pool Prerequisites Setup"
echo "======================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BILLING_ACCOUNT_ID="011C35-0F1A1B-49FBEC"
MAIN_PROJECT="docsai-chatbot-app"
MAIN_SERVICE_ACCOUNT="firebase-project-manager@docsai-chatbot-app.iam.gserviceaccount.com"
TEMPLATE_DIR="../ChatFactoryTemplate"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

echo "📋 Checking required tools..."

# Check gcloud CLI
if command_exists gcloud; then
    print_status "gcloud CLI found"
    GCLOUD_VERSION=$(gcloud version 2>/dev/null | head -n1 | cut -d' ' -f4 || echo "unknown")
    echo "   Version: $GCLOUD_VERSION"
else
    print_error "gcloud CLI not found. Please install Google Cloud SDK."
    exit 1
fi

# Check Firebase CLI
if command_exists firebase; then
    print_status "Firebase CLI found"
    FIREBASE_VERSION=$(firebase --version 2>/dev/null)
    echo "   Version: $FIREBASE_VERSION"
else
    print_error "Firebase CLI not found. Please install with: npm install -g firebase-tools"
    exit 1
fi

# Check Vercel CLI
if command_exists vercel; then
    print_status "Vercel CLI found"
    VERCEL_VERSION=$(vercel --version 2>/dev/null)
    echo "   Version: $VERCEL_VERSION"
else
    print_error "Vercel CLI not found. Please install with: npm install -g vercel"
    exit 1
fi

# Check jq
if command_exists jq; then
    print_status "jq found"
else
    print_error "jq not found. Please install jq for JSON processing."
    exit 1
fi

# Check Node.js and npm
if command_exists node && command_exists npm; then
    print_status "Node.js and npm found"
    NODE_VERSION=$(node --version)
    NPM_VERSION=$(npm --version)
    echo "   Node.js: $NODE_VERSION, npm: $NPM_VERSION"
else
    print_error "Node.js and npm not found. Please install Node.js."
    exit 1
fi

echo ""
echo "🔐 Checking authentication..."

# Check if user is authenticated with gcloud
if gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1 >/dev/null 2>&1; then
    ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1)
    print_status "Authenticated with gcloud as: $ACTIVE_ACCOUNT"
else
    print_warning "Not authenticated with gcloud. Running authentication..."
    echo ""
    echo "Please authenticate with your Google Cloud account:"
    if gcloud auth login; then
        ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1)
        print_status "Successfully authenticated as: $ACTIVE_ACCOUNT"
    else
        print_error "Authentication failed"
        exit 1
    fi
fi

# Set up application default credentials quota project
echo ""
echo "🔧 Setting up Application Default Credentials..."
print_info "Configuring quota project to avoid billing warnings..."
if gcloud auth application-default set-quota-project "$MAIN_PROJECT"; then
    print_status "Application Default Credentials quota project set to: $MAIN_PROJECT"
else
    print_warning "Could not set quota project. You may see billing warnings during deployment."
fi

# Check billing account access
echo "💳 Verifying billing account access..."
if gcloud billing accounts list --format="value(ACCOUNT_ID)" | grep -q "$BILLING_ACCOUNT_ID"; then
    print_status "Billing account accessible: $BILLING_ACCOUNT_ID"
else
    print_error "Cannot access billing account. Please ensure you have billing permissions."
    exit 1
fi

# Check Firebase authentication
echo ""
echo "🔥 Checking Firebase authentication..."
if firebase projects:list >/dev/null 2>&1; then
    print_status "Firebase CLI authenticated"
else
    print_warning "Not authenticated with Firebase. Running authentication..."
    echo ""
    echo "Please authenticate with Firebase using your Google account:"
    if firebase login; then
        print_status "Successfully authenticated with Firebase"
    else
        print_error "Firebase authentication failed"
        exit 1
    fi
fi

echo ""
echo "📁 Checking directory structure..."

# Check if ChatFactoryTemplate exists
if [ -d "$TEMPLATE_DIR" ]; then
    print_status "ChatFactoryTemplate directory found: $TEMPLATE_DIR"
else
    print_error "ChatFactoryTemplate directory not found at: $TEMPLATE_DIR"
    echo "Please ensure both ChatFactoryApp and ChatFactoryTemplate are in the same parent directory."
    exit 1
fi

# Check if template has package.json
if [ -f "$TEMPLATE_DIR/package.json" ]; then
    print_status "ChatFactoryTemplate package.json found"
else
    print_error "ChatFactoryTemplate package.json not found. Is it a valid template?"
    exit 1
fi

# Create keys directory in ChatFactoryApp
mkdir -p ./keys
print_status "Keys directory created in ChatFactoryApp: ./keys/"

# Create pool management scripts directory
mkdir -p ./scripts/pool-management
print_status "Pool management scripts directory ready: ./scripts/pool-management/"

echo ""
echo "🔑 Setting up service account keys..."

# Check if main service account key exists
if [ -f "./keys/docsai-chatbot-app-main-key.json" ]; then
    print_status "Main service account key found"
else
    print_warning "Main service account key not found. Creating..."

    # Check if the service account exists
    if gcloud iam service-accounts describe "$MAIN_SERVICE_ACCOUNT" --project="$MAIN_PROJECT" >/dev/null 2>&1; then
        print_status "Main service account exists"

        # Create the key
        echo "Creating service account key..."
        gcloud iam service-accounts keys create "./keys/docsai-chatbot-app-main-key.json" \
            --iam-account="$MAIN_SERVICE_ACCOUNT" \
            --project="$MAIN_PROJECT"

        print_status "Main service account key created"
    else
        print_error "Main service account does not exist: $MAIN_SERVICE_ACCOUNT"
        echo "Please create the service account first or check the account name."
        exit 1
    fi
fi

echo ""
echo "🧪 Testing service account authentication..."

# Test main service account
export GOOGLE_APPLICATION_CREDENTIALS="./keys/docsai-chatbot-app-main-key.json"
if gcloud auth activate-service-account --key-file="./keys/docsai-chatbot-app-main-key.json" >/dev/null 2>&1; then
    print_status "Main service account authentication successful"

    # Test access to central tracking collection
    ACCESS_TOKEN=$(gcloud auth print-access-token)
    if curl -s -f -X GET "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
        -H "Authorization: Bearer $ACCESS_TOKEN" >/dev/null 2>&1; then
        print_status "Central tracking collection accessible"
    else
        print_warning "Cannot access central tracking collection. It may not exist yet."
    fi
else
    print_error "Failed to authenticate with main service account"
    exit 1
fi

echo ""
echo "📦 Checking ChatFactoryTemplate dependencies..."

# Change to template directory to check dependencies
cd "$TEMPLATE_DIR"

# Check if node_modules exists in template
if [ -d "node_modules" ]; then
    print_status "ChatFactoryTemplate node_modules found"
else
    print_warning "ChatFactoryTemplate node_modules not found. Running npm install..."
    npm install
    print_status "ChatFactoryTemplate dependencies installed"
fi

# Check if .env.local exists in template
if [ -f ".env.local" ]; then
    print_status "ChatFactoryTemplate .env.local found"
else
    print_warning "ChatFactoryTemplate .env.local not found."
    if [ -f ".env.example" ]; then
        print_warning "Consider copying from .env.example to .env.local"
    fi
fi

# Return to ChatFactoryApp directory
cd - >/dev/null

echo ""
echo "🎯 Verifying Firebase authentication..."

# Test Firebase authentication
if firebase login:ci --token="$(gcloud auth print-access-token)" >/dev/null 2>&1; then
    print_status "Firebase authentication working"
else
    print_warning "Firebase authentication may need setup. Please run: firebase login"
fi

echo ""
echo "✅ PREREQUISITES SETUP COMPLETE!"
echo "======================================"
echo ""
echo "📋 Summary:"
echo "   ✅ All required tools installed"
echo "   ✅ Authentication configured"
echo "   ✅ Service account keys ready in ChatFactoryApp"
echo "   ✅ ChatFactoryTemplate dependencies installed"
echo "   ✅ Directory structure validated"
echo ""
echo "🚀 You're ready to run the pool management scripts!"
echo ""
echo "Next steps (run from ChatFactoryApp):"
echo "   1. Deploy: ./scripts/pool-management/deploy-chatfactory-pool-002.sh"
echo "   2. Check status: ./scripts/pool-management/check-project-status.sh"
echo "   3. Use manager: ./scripts/pool-management/chatfactory-manager.sh"
echo ""