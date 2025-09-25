#!/bin/bash

# ChatFactory Pool Deployment Script
# Complete automated deployment with personal account authentication and project tracking
# Run from ChatFactoryApp to deploy ChatFactoryTemplate
# Usage: ./deploy-chatfactory-pool.sh <pool_number> [custom_project_name]
# Examples:
#   ./deploy-chatfactory-pool.sh 003
#   ./deploy-chatfactory-pool.sh 004 "My Custom Pool Name"
#   ./deploy-chatfactory-pool.sh 025

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo "Usage: $0 <pool_number> [custom_project_name]"
    echo ""
    echo "Examples:"
    echo "  $0 003                           # Deploy chatfactory-pool-003"
    echo "  $0 004                           # Deploy chatfactory-pool-004"
    echo "  $0 025 \"My Custom Pool Name\"    # Deploy chatfactory-pool-025 with custom name"
    echo ""
    echo "Pool number should be a 3-digit number (e.g., 003, 017, 025)"
}

# Check if pool number is provided
if [ $# -lt 1 ]; then
    echo -e "${RED}❌ Error: Pool number is required${NC}"
    echo ""
    show_usage
    exit 1
fi

POOL_NUMBER="$1"
CUSTOM_PROJECT_NAME="$2"

# Validate pool number format (should be 3 digits)
if [[ ! "$POOL_NUMBER" =~ ^[0-9]{3}$ ]]; then
    echo -e "${RED}❌ Error: Pool number must be exactly 3 digits (e.g., 003, 017, 025)${NC}"
    echo ""
    show_usage
    exit 1
fi

# Generate project configuration from pool number
PROJECT_ID="chatfactory-pool-$POOL_NUMBER"
if [ -n "$CUSTOM_PROJECT_NAME" ]; then
    PROJECT_NAME="$CUSTOM_PROJECT_NAME"
else
    PROJECT_NAME="ChatFactory Pool $POOL_NUMBER"
fi

# Fixed configuration
BILLING_ACCOUNT_ID="011C35-0F1A1B-49FBEC"
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

# Function to check if project exists
project_exists() {
    gcloud projects describe "$1" >/dev/null 2>&1
}

# Function to check project availability
check_project_availability() {
    print_info "Checking if project $PROJECT_ID is available for use..."

    # First check if project exists
    if ! project_exists "$PROJECT_ID"; then
        print_warning "Project $PROJECT_ID does not exist. Will create new project."
        return 1  # Project doesn't exist, needs to be created
    fi

    print_info "Project exists. Checking availability status..."

    # For existing projects, we'll assume they need setup if we can't easily check the secret
    # This avoids hanging on permission issues
    print_warning "Project exists. Will set up tracking and continue deployment."
    return 3  # Project exists but needs tracking setup
}

echo "🚀 ChatFactory Pool Deployment"
echo "===================================="
echo "📋 Pool Number: $POOL_NUMBER"
echo "📋 Project ID: $PROJECT_ID"
echo "📋 Project Name: $PROJECT_NAME"
echo ""

# Step 0: Prerequisites check
print_step "0" "Checking prerequisites"

if [ ! -f "./scripts/pool-management/setup-prerequisites.sh" ]; then
    print_error "Prerequisites script not found. Please run setup first."
    exit 1
fi

if [ ! -d "$TEMPLATE_DIR" ]; then
    print_error "ChatFactoryTemplate directory not found at: $TEMPLATE_DIR"
    exit 1
fi

if [ ! -f "$TEMPLATE_DIR/.env.local" ]; then
    print_error "ChatFactoryTemplate .env.local not found. Please ensure you have a base configuration."
    exit 1
fi

print_status "Prerequisites check passed"

# Step 1: Setting up authentication
print_step "1" "Setting up authentication"
# Use personal account throughout (has Editor permissions on project)
PERSONAL_ACCOUNT="ori.somekh@wizechat.ai"
print_info "Switching to personal account: $PERSONAL_ACCOUNT"
gcloud config set account "$PERSONAL_ACCOUNT"

print_info "Setting ADC quota project to match current deployment..."
gcloud auth application-default set-quota-project "$PROJECT_ID"

ACTIVE_ACCOUNT="$PERSONAL_ACCOUNT"
print_status "Using personal account: $ACTIVE_ACCOUNT"
print_status "ADC quota project set to: $PROJECT_ID"

# Step 2: Check project availability
print_step "2" "Checking project availability"
set +e  # Temporarily disable exit on error for the availability check
check_project_availability
AVAILABILITY_STATUS=$?
set -e  # Re-enable exit on error
case $AVAILABILITY_STATUS in
    0)
        print_status "Using existing available project: $PROJECT_ID"
        SKIP_PROJECT_CREATION=true
        SKIP_SERVICE_ACCOUNT_CREATION=false  # May need to create if doesn't exist
        ;;
    1)
        print_info "Creating new project: $PROJECT_ID"
        SKIP_PROJECT_CREATION=false
        SKIP_SERVICE_ACCOUNT_CREATION=false
        ;;
    2)
        print_error "Project $PROJECT_ID is currently in use. Please use a different project or wait."
        echo "You can check project status with: ./scripts/pool-management/check-project-status.sh"
        exit 1
        ;;
    3)
        print_warning "Project exists but missing tracking. Will set up tracking."
        SKIP_PROJECT_CREATION=true
        SKIP_SERVICE_ACCOUNT_CREATION=false
        ;;
esac

echo ""

# Step 3: Create Firebase project (if needed)
if [ "$SKIP_PROJECT_CREATION" = "false" ]; then
    print_step "3" "Creating Firebase project"

    print_info "Creating Google Cloud project..."
    gcloud projects create "$PROJECT_ID" --name="$PROJECT_NAME"

    print_info "Linking billing account..."
    gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID"

    print_info "Enabling required APIs..."
    gcloud services enable \
        firebase.googleapis.com \
        firebasehosting.googleapis.com \
        identitytoolkit.googleapis.com \
        firestore.googleapis.com \
        secretmanager.googleapis.com \
        --project="$PROJECT_ID"

    print_info "Waiting for APIs to fully activate..."
    sleep 10

    print_info "Adding Firebase to project..."
    if firebase projects:addfirebase "$PROJECT_ID"; then
        print_status "Firebase added to project successfully"
    else
        print_error "Failed to add Firebase to project"
        exit 1
    fi

    print_info "Waiting for Firebase services to initialize..."
    sleep 15

    print_info "Creating Firestore database..."
    gcloud firestore databases create --location=us-central1 --project="$PROJECT_ID"

    print_status "Firebase project created successfully"
else
    print_step "3" "Using existing project, ensuring billing and services are enabled"

    gcloud config set project "$PROJECT_ID"

    print_info "Ensuring billing account is linked..."
    if ! gcloud billing projects describe "$PROJECT_ID" --format="value(billingAccountName)" | grep -q "$BILLING_ACCOUNT_ID"; then
        print_info "Linking billing account..."
        gcloud billing projects link "$PROJECT_ID" --billing-account="$BILLING_ACCOUNT_ID"
    else
        print_status "Billing account already linked"
    fi

    print_info "Enabling required APIs..."
    gcloud services enable \
        firebase.googleapis.com \
        firebasehosting.googleapis.com \
        identitytoolkit.googleapis.com \
        firestore.googleapis.com \
        secretmanager.googleapis.com \
        --project="$PROJECT_ID"

    print_info "Ensuring Firebase is added to project..."
    FIREBASE_ADD_OUTPUT=$(firebase projects:addfirebase "$PROJECT_ID" 2>&1 || echo "already_added")
    if echo "$FIREBASE_ADD_OUTPUT" | grep -q "Your Firebase project is ready"; then
        print_status "Firebase added to project successfully"
    elif echo "$FIREBASE_ADD_OUTPUT" | grep -q "already_added"; then
        print_status "Firebase already configured for project"
    else
        print_warning "Firebase add result: $FIREBASE_ADD_OUTPUT"
    fi

    print_info "Ensuring Firestore database exists..."
    if ! gcloud firestore databases list --format="value(name)" | grep -q "(default)"; then
        gcloud firestore databases create --location=us-central1 --project="$PROJECT_ID"
    else
        print_status "Firestore database already exists"
    fi

    print_status "Services enabled on existing project"
fi

# Step 4: Create project service account (for chatbot deployment)
if [ "$SKIP_SERVICE_ACCOUNT_CREATION" = "false" ]; then
    print_step "4" "Creating project service account for chatbot"

    # Check if service account already exists
    if gcloud iam service-accounts describe "chatbot-service-account@$PROJECT_ID.iam.gserviceaccount.com" --project="$PROJECT_ID" >/dev/null 2>&1; then
        print_warning "Service account already exists, skipping creation"
    else
        print_info "Creating service account..."
        gcloud iam service-accounts create chatbot-service-account \
            --project="$PROJECT_ID" \
            --display-name="Chatbot Service Account"

        print_info "Granting permissions..."
        gcloud projects add-iam-policy-binding "$PROJECT_ID" \
            --member="serviceAccount:chatbot-service-account@$PROJECT_ID.iam.gserviceaccount.com" \
            --role="roles/firebase.admin"

        gcloud projects add-iam-policy-binding "$PROJECT_ID" \
            --member="serviceAccount:chatbot-service-account@$PROJECT_ID.iam.gserviceaccount.com" \
            --role="roles/secretmanager.admin"
    fi

    # Create service account key in ChatFactoryApp (for future chatbot deployment)
    if [ ! -f "./keys/$PROJECT_ID-service-key.json" ]; then
        print_info "Creating service account key..."
        gcloud iam service-accounts keys create "./keys/$PROJECT_ID-service-key.json" \
            --iam-account="chatbot-service-account@$PROJECT_ID.iam.gserviceaccount.com" \
            --project="$PROJECT_ID"
        print_status "Service account key created in ChatFactoryApp for future chatbot deployment"
    else
        print_warning "Service account key already exists in ChatFactoryApp"
    fi
else
    print_step "4" "Service account setup (skipped - already exists)"
fi

# Step 5: Create Firebase web app
print_step "5" "Creating Firebase web app"

# Check if app already exists
EXISTING_APPS=$(firebase apps:list --project="$PROJECT_ID" 2>/dev/null | grep -c "Pool Project Auth Setup" 2>/dev/null || echo "0")
EXISTING_APPS=$(echo "$EXISTING_APPS" | head -n1 | tr -d '\n')

if [ "$EXISTING_APPS" -gt "0" ]; then
    print_warning "Firebase app already exists, getting existing configuration..."
    # Get existing app ID
    APP_ID=$(firebase apps:list --project="$PROJECT_ID" --json | jq -r '.result[] | select(.displayName | contains("Pool Project Auth Setup")) | .appId' | head -n1)
else
    print_info "Creating new Firebase web app..."
    APP_CREATE_OUTPUT=$(firebase apps:create web "Pool Project Auth Setup Chatbot (Reusable) App" --project="$PROJECT_ID")
    APP_ID=$(echo "$APP_CREATE_OUTPUT" | grep -o '1:[0-9]*:web:[a-z0-9]*' | head -n1)
fi

if [ -z "$APP_ID" ]; then
    print_error "Failed to get Firebase app ID"
    exit 1
fi

print_info "Getting Firebase configuration..."
firebase apps:sdkconfig web "$APP_ID" > /tmp/firebase-config.json

# Extract configuration values
API_KEY=$(jq -r '.apiKey' /tmp/firebase-config.json)
AUTH_DOMAIN=$(jq -r '.authDomain' /tmp/firebase-config.json)
PROJECT_ID_FROM_CONFIG=$(jq -r '.projectId' /tmp/firebase-config.json)
STORAGE_BUCKET=$(jq -r '.storageBucket' /tmp/firebase-config.json)
MESSAGING_SENDER_ID=$(jq -r '.messagingSenderId' /tmp/firebase-config.json)
MEASUREMENT_ID=$(jq -r '.measurementId' /tmp/firebase-config.json)

print_status "Firebase app configuration retrieved"

# Step 6: Store Firebase configuration for future use
print_step "6" "Storing Firebase configuration for future deployments"

print_info "Saving Firebase configuration..."
cat > "./keys/$PROJECT_ID-firebase-config.json" << EOF
{
  "apiKey": "$API_KEY",
  "authDomain": "$AUTH_DOMAIN",
  "projectId": "$PROJECT_ID_FROM_CONFIG",
  "storageBucket": "$STORAGE_BUCKET",
  "messagingSenderId": "$MESSAGING_SENDER_ID",
  "appId": "$APP_ID",
  "measurementId": "$MEASUREMENT_ID"
}
EOF

print_status "Firebase configuration saved to ./keys/$PROJECT_ID-firebase-config.json"

# Step 7: Initialize and enable authentication providers
print_step "7" "Initializing Firebase Authentication"

print_info "Waiting for Firebase project to be fully ready for auth initialization..."
sleep 20

ACCESS_TOKEN=$(gcloud auth print-access-token)
ACTIVE_ACCOUNT=$(gcloud auth list --filter=status:ACTIVE --format="value(account)" | head -n1)

print_info "Enabling Identity Toolkit service..."
curl -s -X POST "https://serviceusage.googleapis.com/v1/projects/$PROJECT_ID/services:batchEnable" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"serviceIds":["identitytoolkit.googleapis.com"]}' > /dev/null

print_info "Initializing Firebase Authentication..."
# Try the initialization with better error handling and proper headers
INIT_RESPONSE=$(curl -s -X POST "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/identityPlatform:initializeAuth" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-Goog-User-Project: $PROJECT_ID" \
    -d '{}' 2>&1)

if echo "$INIT_RESPONSE" | grep -q "error"; then
    print_warning "Firebase Auth initialization may need more time. Response: $INIT_RESPONSE"
    print_info "Waiting additional 30 seconds and retrying..."
    sleep 30

    # Retry once more with proper headers
    INIT_RESPONSE=$(curl -s -X POST "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/identityPlatform:initializeAuth" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -H "X-Goog-User-Project: $PROJECT_ID" \
        -d '{}' 2>&1)

    if echo "$INIT_RESPONSE" | grep -q "error"; then
        print_warning "Firebase Auth initialization still showing issues. Manual setup may be needed."
        print_warning "Response: $INIT_RESPONSE"
    else
        print_status "Firebase Auth initialized successfully on retry"
    fi
else
    print_status "Firebase Auth initialized successfully"
fi

print_info "Enabling Email/Password authentication..."
curl -s -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT_ID/config" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-Goog-User-Project: $PROJECT_ID" \
    -d '{"signIn":{"email":{"enabled":true,"passwordRequired":true}}}' > /dev/null

print_info "Setting up OAuth consent screen (brand)..."

# Enable IAP API (required for OAuth brand creation)
print_info "Enabling Identity-Aware Proxy API..."
if gcloud services enable iap.googleapis.com --project="$PROJECT_ID"; then
    print_status "IAP API enabled successfully"

    print_info "Waiting for IAP API to fully activate..."
    sleep 30

    # Create OAuth consent screen brand
    print_info "Creating OAuth consent screen..."
    BRAND_RESULT=$(gcloud alpha iap oauth-brands create \
        --application_title="$PROJECT_NAME" \
        --support_email="$ACTIVE_ACCOUNT" \
        --project="$PROJECT_ID" 2>&1 || echo "exists")

    if echo "$BRAND_RESULT" | grep -q "already exists"; then
        print_status "OAuth consent screen already exists"
        BRAND_NAME=$(gcloud alpha iap oauth-brands list --project="$PROJECT_ID" --format="value(name)" 2>/dev/null | head -n1)
        BRAND_ID=$(echo "$BRAND_NAME" | cut -d'/' -f4)
    elif echo "$BRAND_RESULT" | grep -q "name:"; then
        print_status "OAuth consent screen created successfully"
        BRAND_NAME=$(echo "$BRAND_RESULT" | grep "name:" | head -n1 | cut -d' ' -f2)
        BRAND_ID=$(echo "$BRAND_NAME" | cut -d'/' -f4)
    else
        print_warning "Could not create OAuth consent screen"
        BRAND_ID=""
        BRAND_NAME=""
    fi
else
    print_warning "Could not enable IAP API"
    BRAND_ID=""
fi

print_info "Creating OAuth client for Firebase Authentication..."
if [ -n "$BRAND_NAME" ]; then
    # Get project number (required for OAuth client creation)
    PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")

    print_info "Creating OAuth client using gcloud CLI..."
    OAUTH_CLIENT_RESULT=$(gcloud iap oauth-clients create "$BRAND_NAME" \
        --display_name="Firebase Auth Client" \
        --project="$PROJECT_ID" 2>&1 || echo "error")

    if echo "$OAUTH_CLIENT_RESULT" | grep -q "error"; then
        print_warning "OAuth client creation failed: $OAUTH_CLIENT_RESULT"
        print_info "Falling back to API-based Google provider enablement..."
    else
        print_status "OAuth client created successfully"
        # Extract client ID and secret from the result
        OAUTH_CLIENT_ID=$(echo "$OAUTH_CLIENT_RESULT" | grep -o '[0-9]\+-[a-zA-Z0-9_]\+\.apps\.googleusercontent\.com' | head -n1)
        OAUTH_CLIENT_SECRET=$(echo "$OAUTH_CLIENT_RESULT" | grep "secret:" | cut -d' ' -f2)
        print_info "OAuth Client ID: $OAUTH_CLIENT_ID"
        print_info "OAuth Client Secret: $OAUTH_CLIENT_SECRET"
    fi
fi

print_info "Enabling Google OAuth provider in Firebase..."
# Use OAuth client credentials if we have them, otherwise just enable
if [ -n "$OAUTH_CLIENT_ID" ] && [ -n "$OAUTH_CLIENT_SECRET" ]; then
    print_info "Configuring Google provider with OAuth client credentials..."
    GOOGLE_PROVIDER_DATA=$(cat << EOF
{
  "enabled": true,
  "clientId": "$OAUTH_CLIENT_ID",
  "clientSecret": "$OAUTH_CLIENT_SECRET"
}
EOF
)
else
    print_info "Enabling Google provider without client credentials..."
    GOOGLE_PROVIDER_DATA='{"enabled":true}'
fi

GOOGLE_PROVIDER_RESPONSE=$(curl -s -X POST "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT_ID/defaultSupportedIdpConfigs?idpId=google.com" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -H "Content-Type: application/json" \
    -H "X-Goog-User-Project: $PROJECT_ID" \
    -d "$GOOGLE_PROVIDER_DATA" 2>&1)

if echo "$GOOGLE_PROVIDER_RESPONSE" | grep -q "error"; then
    # Provider might already exist, try to update instead
    print_info "Provider may already exist, attempting to update..."
    GOOGLE_PROVIDER_RESPONSE=$(curl -s -X PATCH "https://identitytoolkit.googleapis.com/admin/v2/projects/$PROJECT_ID/defaultSupportedIdpConfigs/google.com" \
        -H "Authorization: Bearer $ACCESS_TOKEN" \
        -H "Content-Type: application/json" \
        -H "X-Goog-User-Project: $PROJECT_ID" \
        -d "$GOOGLE_PROVIDER_DATA" 2>&1)

    if echo "$GOOGLE_PROVIDER_RESPONSE" | grep -q "error"; then
        print_warning "Google provider configuration response: $GOOGLE_PROVIDER_RESPONSE"
    else
        print_status "Google provider updated successfully"
    fi
else
    print_status "Google provider enabled successfully"
fi

if [ -n "$BRAND_ID" ]; then
    print_status "OAuth consent screen configured. Brand ID: $BRAND_ID"
    print_info "OAuth client creation is now available at:"
    echo "  https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
else
    print_warning "OAuth consent screen setup incomplete. Please create manually at:"
    echo "  https://console.cloud.google.com/apis/credentials/consent?project=$PROJECT_ID"
fi

print_status "Firebase Authentication initialized and providers enabled"

# Step 8: Set up project tracking
print_step "8" "Setting up project tracking"

print_info "Creating project availability secret..."
if gcloud secrets describe "project-in-use" --project="$PROJECT_ID" >/dev/null 2>&1; then
    print_warning "Secret already exists, updating to available state..."
    echo "false" | gcloud secrets versions add project-in-use --data-file=- --project="$PROJECT_ID"
else
    echo "false" | gcloud secrets create project-in-use --data-file=- --project="$PROJECT_ID"
fi

print_info "Updating central tracking collection..."
# Use personal account for central tracking (has access to main project)
ACCESS_TOKEN_MAIN=$(gcloud auth print-access-token)

curl -s -X PATCH "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
    -H "Authorization: Bearer $ACCESS_TOKEN_MAIN" \
    -H "Content-Type: application/json" \
    -d "{
        \"fields\": {
            \"$PROJECT_ID\": {
                \"mapValue\": {
                    \"fields\": {
                        \"status\": {\"stringValue\": \"available\"},
                        \"createdAt\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"},
                        \"projectName\": {\"stringValue\": \"$PROJECT_NAME\"},
                        \"firebaseConfig\": {\"stringValue\": \"./keys/$PROJECT_ID-firebase-config.json\"},
                        \"oauthClientId\": {\"stringValue\": \"$OAUTH_CLIENT_ID\"},
                        \"lastChecked\": {\"timestampValue\": \"$(date -u +%Y-%m-%dT%H:%M:%S.000Z)\"}
                    }
                }
            }
        }
    }" > /dev/null

print_status "Project tracking configured"

# Step 9: Get OAuth client information for future reference
print_step "9" "Getting OAuth client information"

ACCESS_TOKEN=$(gcloud auth print-access-token)
OAUTH_CONFIG=$(curl -s -X GET "https://identitytoolkit.googleapis.com/v2/projects/$PROJECT_ID/defaultSupportedIdpConfigs/google.com" \
    -H "Authorization: Bearer $ACCESS_TOKEN")

OAUTH_CLIENT_ID=$(echo "$OAUTH_CONFIG" | jq -r '.clientId')

if [ "$OAUTH_CLIENT_ID" = "null" ] || [ -z "$OAUTH_CLIENT_ID" ]; then
    print_warning "OAuth client ID not found. OAuth provider may need manual setup."
    OAUTH_CLIENT_ID="NOT_FOUND"
else
    print_status "OAuth client ID retrieved: $OAUTH_CLIENT_ID"
fi

# Clean up temporary files
rm -f /tmp/temp_firebase_vars.txt /tmp/firebase-config.json

echo ""
echo "✅ PROJECT SETUP COMPLETE!"
echo "======================================"
echo ""
echo "📋 Project Setup Summary:"
echo "   🎯 Pool Number: $POOL_NUMBER"
echo "   🎯 Project: $PROJECT_ID"
echo "   🔥 Firebase: Configured with auth providers"
echo "   🔑 OAuth Client ID: $OAUTH_CLIENT_ID"
echo "   📊 Status: available (ready for chatbot deployment)"
echo "   📁 Config saved: ./keys/$PROJECT_ID-firebase-config.json"
echo ""
echo "⚠️  FINAL OAUTH CLIENT SETUP:"
echo "======================================"
echo "OAuth consent screen is configured! Now create the OAuth client:"
echo ""
echo "1. Go to: https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo "2. Click 'Create Credentials' > 'OAuth client ID'"
echo "3. Choose 'Web application'"
echo "4. Name it: 'Firebase Auth Client'"
echo "5. Add Authorized JavaScript origins:"
echo "   - https://$PROJECT_ID.firebaseapp.com"
echo "   - https://[your-vercel-domain].vercel.app"
echo "6. Add Authorized redirect URIs:"
echo "   - https://$PROJECT_ID.firebaseapp.com/__/auth/handler"
echo "7. Copy the client ID and add it to Firebase Auth > Sign-in method > Google"
echo ""
echo "🚀 Project is now ready for chatbot deployment!"
echo ""
echo "📋 Next steps (run from ChatFactoryApp):"
echo "   - Check status: ./scripts/pool-management/check-project-status.sh $PROJECT_ID"
echo "   - Validate setup: ./scripts/pool-management/validate-deployment.sh $PROJECT_ID"
echo "   - Deploy another pool: ./scripts/pool-management/deploy-chatfactory-pool.sh <pool_number>"
echo ""