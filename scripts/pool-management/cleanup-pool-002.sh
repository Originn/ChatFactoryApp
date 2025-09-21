#!/bin/bash

# ChatFactory Pool 002 Cleanup Script
# Resets the project to available state for re-testing
# Run from ChatFactoryApp to manage ChatFactoryTemplate

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ID="chatfactory-pool-002"
PROJECT_NAME="ChatFactory Pool 002"
MAIN_PROJECT="docsai-chatbot-app"
TEMPLATE_DIR="../ChatFactoryTemplate"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_step() {
    echo -e "${BLUE}📋 Step $1: $2${NC}"
}

# Function to authenticate with service account
authenticate_service_account() {
    local key_file="$1"
    local description="$2"

    if [ ! -f "$key_file" ]; then
        print_error "Service account key not found: $key_file"
        exit 1
    fi

    export GOOGLE_APPLICATION_CREDENTIALS="$key_file"
    if gcloud auth activate-service-account --key-file="$key_file" >/dev/null 2>&1; then
        print_status "$description authentication successful"
    else
        print_error "Failed to authenticate with $description"
        exit 1
    fi
}

# Function to check if project exists
project_exists() {
    gcloud projects describe "$1" >/dev/null 2>&1
}

echo "🧹 ChatFactory Pool 002 Cleanup"
echo "================================="
echo ""

# Check if project exists
if ! project_exists "$PROJECT_ID"; then
    print_warning "Project $PROJECT_ID does not exist. Nothing to clean up."
    exit 0
fi

# Confirmation prompt
echo "This will:"
echo "  - Mark the project as 'available' in tracking systems"
echo "  - Reset the project secret to 'false' (available)"
echo "  - Clear Firebase Auth users (optional)"
echo "  - Restore ChatFactoryTemplate .env.local backup (if exists)"
echo ""
echo "⚠️  The project will remain intact but marked as available for reuse."
echo ""
read -p "Are you sure you want to cleanup $PROJECT_ID? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cleanup cancelled."
    exit 0
fi

echo ""

# Step 1: Authenticate with project service account
print_step "1" "Authenticating with project service account"

if [ ! -f "./keys/$PROJECT_ID-service-key.json" ]; then
    print_warning "Project service account key not found. Using main service account."
    if [ ! -f "./keys/docsai-chatbot-app-main-key.json" ]; then
        print_error "No service account keys found. Please run setup-prerequisites.sh first."
        exit 1
    fi
    authenticate_service_account "./keys/docsai-chatbot-app-main-key.json" "Main service account"
    gcloud config set project "$PROJECT_ID"
else
    authenticate_service_account "./keys/$PROJECT_ID-service-key.json" "Project service account"
fi

# Step 2: Reset project secret to available
print_step "2" "Resetting project availability secret"

if gcloud secrets describe "project-in-use" --project="$PROJECT_ID" >/dev/null 2>&1; then
    print_info "Marking project as available (setting secret to 'false')..."
    echo "false" | gcloud secrets versions add project-in-use --data-file=- --project="$PROJECT_ID"
    print_status "Project secret updated to 'available'"
else
    print_warning "Project secret does not exist. Creating it as 'available'..."
    echo "false" | gcloud secrets create project-in-use --data-file=- --project="$PROJECT_ID"
    print_status "Project secret created as 'available'"
fi

# Step 3: Update central tracking
print_step "3" "Updating central tracking system"

print_info "Switching to main service account for central tracking..."
authenticate_service_account "./keys/docsai-chatbot-app-main-key.json" "Main service account"
ACCESS_TOKEN_MAIN=$(gcloud auth print-access-token)

print_info "Updating project status in central collection..."
curl -s -X PATCH "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
    -H "Authorization: Bearer $ACCESS_TOKEN_MAIN" \
    -H "Content-Type: application/json" \
    -d "{
        \"fields\": {
            \"$PROJECT_ID\": {
                \"mapValue\": {
                    \"fields\": {
                        \"status\": {\"stringValue\": \"available\"},
                        \"releasedAt\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"},
                        \"lastChecked\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"},
                        \"projectName\": {\"stringValue\": \"$PROJECT_NAME\"}
                    }
                }
            }
        }
    }" > /dev/null

print_status "Central tracking updated"

# Step 4: Optional Firebase Auth cleanup
print_step "4" "Firebase Authentication cleanup (optional)"

echo ""
read -p "Do you want to clear Firebase Auth users? This will delete all user accounts. (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_warning "Firebase Auth user cleanup requires manual action or Firebase Admin SDK."
    print_info "To clear users manually:"
    echo "   1. Go to https://console.firebase.google.com/project/$PROJECT_ID/authentication/users"
    echo "   2. Select all users and delete them"
    echo "   3. Or use Firebase Admin SDK to programmatically delete users"
    print_warning "Skipping automatic user cleanup for now."
else
    print_info "Skipping Firebase Auth user cleanup"
fi

# Step 5: Restore environment backup in ChatFactoryTemplate
print_step "5" "Restoring ChatFactoryTemplate environment configuration"

if [ -f "$TEMPLATE_DIR/.env.local.backup" ]; then
    print_info "Restoring ChatFactoryTemplate .env.local from backup..."
    cp "$TEMPLATE_DIR/.env.local.backup" "$TEMPLATE_DIR/.env.local"
    print_status "ChatFactoryTemplate environment configuration restored"
else
    print_warning "No ChatFactoryTemplate .env.local backup found. Current configuration preserved."
fi

# Step 6: Optional Vercel deployment cleanup
print_step "6" "Vercel deployment cleanup (optional)"

echo ""
read -p "Do you want to remove the Vercel deployment? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_info "Checking for Vercel deployments..."

    # Try to find and remove Vercel deployment
    # Note: This requires the deployment to be linked to the current directory
    if command -v vercel >/dev/null 2>&1; then
        print_warning "Manual Vercel cleanup required:"
        echo "   1. Go to https://vercel.com/dashboard"
        echo "   2. Find the deployment for $PROJECT_ID"
        echo "   3. Delete the deployment"
        echo "   or"
        echo "   1. Run: vercel remove <deployment-name> --yes"
    else
        print_warning "Vercel CLI not found. Manual cleanup required via dashboard."
    fi
else
    print_info "Skipping Vercel deployment cleanup"
fi

# Step 7: Cleanup temporary files
print_step "7" "Cleaning up temporary files"

print_info "Removing temporary files..."
rm -f /tmp/firebase-config.json /tmp/temp_firebase_vars.txt

if [ -d "$TEMPLATE_DIR" ]; then
    rm -f "$TEMPLATE_DIR/.env.local.temp"
fi

print_status "Temporary files cleaned"

echo ""
echo "✅ CLEANUP COMPLETE!"
echo "===================="
echo ""
echo "📋 Cleanup Summary:"
echo "   🎯 Project: $PROJECT_ID"
echo "   📊 Status: available"
echo "   🔄 Ready for: re-deployment testing"
echo "   📁 Template: $TEMPLATE_DIR"
echo ""
echo "🚀 Next steps (run from ChatFactoryApp):"
echo "   - Run deployment again: ./scripts/pool-management/deploy-chatfactory-pool-002.sh"
echo "   - Check project status: ./scripts/pool-management/check-project-status.sh $PROJECT_ID"
echo "   - View all projects: ./scripts/pool-management/check-project-status.sh --all"
echo ""
echo "⚠️  Note: The project infrastructure remains intact."
echo "         Only the tracking status has been reset."
echo ""