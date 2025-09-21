#!/bin/bash

# ChatFactory Pool Deployment Validation Script
# Tests OAuth functionality and deployment health

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
    echo -e "${BLUE}📋 $1${NC}"
}

# Function to authenticate with service account
authenticate_service_account() {
    local key_file="$1"
    local description="$2"

    if [ ! -f "$key_file" ]; then
        print_error "Service account key not found: $key_file"
        return 1
    fi

    export GOOGLE_APPLICATION_CREDENTIALS="$key_file"
    if gcloud auth activate-service-account --key-file="$key_file" >/dev/null 2>&1; then
        print_status "$description authentication successful"
        return 0
    else
        print_error "Failed to authenticate with $description"
        return 1
    fi
}

# Function to test URL accessibility
test_url() {
    local url="$1"
    local description="$2"

    if curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" | grep -q "200\|301\|302"; then
        print_status "$description is accessible"
        return 0
    else
        print_error "$description is not accessible"
        return 1
    fi
}

# Function to check OAuth configuration
check_oauth_config() {
    local project_id="$1"

    print_step "Checking OAuth configuration for $project_id"

    # Get OAuth client configuration
    local access_token
    access_token=$(gcloud auth print-access-token 2>/dev/null)

    if [ -z "$access_token" ]; then
        print_error "Failed to get access token"
        return 1
    fi

    local oauth_config
    oauth_config=$(curl -s -X GET "https://identitytoolkit.googleapis.com/v2/projects/$project_id/defaultSupportedIdpConfigs/google.com" \
        -H "Authorization: Bearer $access_token" 2>/dev/null)

    if [ $? -eq 0 ] && [ -n "$oauth_config" ]; then
        local client_id
        client_id=$(echo "$oauth_config" | jq -r '.clientId' 2>/dev/null)

        if [ "$client_id" != "null" ] && [ -n "$client_id" ]; then
            print_status "OAuth client ID found: $client_id"
            echo "   To configure OAuth redirect URIs:"
            echo "   1. Go to: https://console.cloud.google.com/apis/credentials?project=$project_id"
            echo "   2. Edit OAuth client: $client_id"
            echo "   3. Add authorized domains as shown in deployment output"
            return 0
        else
            print_warning "OAuth client ID not found or not configured"
            return 1
        fi
    else
        print_error "Failed to get OAuth configuration"
        return 1
    fi
}

# Function to check project tracking status
check_tracking_status() {
    local project_id="$1"

    print_step "Checking project tracking status"

    # Check project secret
    if authenticate_service_account "./keys/$project_id-service-key.json" "Project service account"; then
        gcloud config set project "$project_id" >/dev/null 2>&1

        if gcloud secrets describe "project-in-use" --project="$project_id" >/dev/null 2>&1; then
            local secret_value
            secret_value=$(gcloud secrets versions access latest --secret="project-in-use" --project="$project_id" 2>/dev/null)

            if [ "$secret_value" = "true" ]; then
                print_status "Project secret shows: in-use ✓"
            elif [ "$secret_value" = "false" ]; then
                print_warning "Project secret shows: available (should be in-use after deployment)"
            else
                print_error "Project secret has unexpected value: $secret_value"
            fi
        else
            print_error "Project tracking secret not found"
        fi
    else
        print_warning "Cannot check project secret (service account key missing)"
    fi

    # Check central tracking
    if authenticate_service_account "./keys/docsai-chatbot-app-main-key.json" "Main service account"; then
        local access_token
        access_token=$(gcloud auth print-access-token)

        local tracking_data
        tracking_data=$(curl -s -X GET "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
            -H "Authorization: Bearer $access_token" 2>/dev/null)

        if [ $? -eq 0 ] && [ -n "$tracking_data" ]; then
            local project_status
            project_status=$(echo "$tracking_data" | jq -r ".fields.\"$project_id\".mapValue.fields.status.stringValue" 2>/dev/null)

            if [ "$project_status" = "in-use" ]; then
                print_status "Central tracking shows: in-use ✓"
            elif [ "$project_status" = "available" ]; then
                print_warning "Central tracking shows: available (should be in-use after deployment)"
            elif [ "$project_status" = "null" ]; then
                print_error "Project not found in central tracking"
            else
                print_info "Central tracking shows: $project_status"
            fi
        else
            print_error "Failed to check central tracking"
        fi
    else
        print_warning "Cannot check central tracking (main service account key missing)"
    fi
}

# Function to check Firebase services
check_firebase_services() {
    local project_id="$1"

    print_step "Checking Firebase services"

    if authenticate_service_account "./keys/$project_id-service-key.json" "Project service account"; then
        gcloud config set project "$project_id" >/dev/null 2>&1

        # Check if Firebase is enabled
        if gcloud services list --enabled --filter="name:firebase.googleapis.com" --format="value(name)" | grep -q "firebase.googleapis.com"; then
            print_status "Firebase API enabled"
        else
            print_error "Firebase API not enabled"
        fi

        # Check if Identity Toolkit is enabled
        if gcloud services list --enabled --filter="name:identitytoolkit.googleapis.com" --format="value(name)" | grep -q "identitytoolkit.googleapis.com"; then
            print_status "Identity Toolkit API enabled"
        else
            print_error "Identity Toolkit API not enabled"
        fi

        # Check if Firestore is enabled
        if gcloud services list --enabled --filter="name:firestore.googleapis.com" --format="value(name)" | grep -q "firestore.googleapis.com"; then
            print_status "Firestore API enabled"
        else
            print_error "Firestore API not enabled"
        fi

        # Check Firestore database
        if gcloud firestore databases list --format="value(name)" | grep -q "(default)"; then
            print_status "Firestore database exists"
        else
            print_error "Firestore database not found"
        fi
    else
        print_warning "Cannot check Firebase services (service account key missing)"
    fi
}

# Main validation function
validate_deployment() {
    local project_id="$1"
    local vercel_url="$2"

    echo "🧪 ChatFactory Deployment Validation"
    echo "===================================="
    echo ""
    echo "📋 Validating: $project_id"
    if [ -n "$vercel_url" ]; then
        echo "🌐 Vercel URL: $vercel_url"
    fi
    echo ""

    local validation_errors=0

    # Test 1: Check if Vercel deployment is accessible
    if [ -n "$vercel_url" ]; then
        print_step "Testing Vercel deployment accessibility"
        if test_url "$vercel_url" "Vercel deployment"; then
            # Test specific endpoints
            if test_url "$vercel_url/api/health" "Health endpoint"; then
                true  # Health endpoint exists
            else
                print_warning "Health endpoint not found (this may be normal)"
            fi
        else
            ((validation_errors++))
        fi
        echo ""
    fi

    # Test 2: Check Firebase auth domain
    print_step "Testing Firebase auth domain"
    local firebase_domain="https://$project_id.firebaseapp.com"
    if test_url "$firebase_domain" "Firebase auth domain"; then
        true
    else
        print_warning "Firebase auth domain not accessible (this may be normal for new projects)"
    fi
    echo ""

    # Test 3: Check Firebase services
    check_firebase_services "$project_id"
    echo ""

    # Test 4: Check OAuth configuration
    check_oauth_config "$project_id"
    echo ""

    # Test 5: Check project tracking
    check_tracking_status "$project_id"
    echo ""

    # Test 6: Environment configuration
    print_step "Checking environment configuration"
    if [ -f ".env.local" ]; then
        if grep -q "NEXT_PUBLIC_FIREBASE_PROJECT_ID=$project_id" .env.local; then
            print_status "Environment configured for $project_id"
        else
            print_warning "Environment may not be configured for $project_id"
            local configured_project
            configured_project=$(grep "NEXT_PUBLIC_FIREBASE_PROJECT_ID=" .env.local | cut -d'=' -f2)
            if [ -n "$configured_project" ]; then
                print_info "Currently configured for: $configured_project"
            fi
        fi
    else
        print_error ".env.local not found"
        ((validation_errors++))
    fi

    echo ""
    echo "📊 Validation Summary"
    echo "===================="

    if [ $validation_errors -eq 0 ]; then
        print_status "All critical validations passed!"
        echo ""
        echo "🚀 Next steps:"
        echo "   1. Complete OAuth setup if not done (see deployment output)"
        echo "   2. Test OAuth login at: $vercel_url"
        echo "   3. Verify authentication flow works end-to-end"
        echo ""
        return 0
    else
        print_warning "$validation_errors validation issues found"
        echo ""
        echo "🔧 Recommended actions:"
        echo "   1. Review the errors above"
        echo "   2. Re-run deployment if needed: ./scripts/deploy-chatfactory-pool-002.sh"
        echo "   3. Check project status: ./scripts/check-project-status.sh $project_id"
        echo ""
        return 1
    fi
}

# Script usage
if [ $# -eq 0 ]; then
    echo "Usage: $0 <project-id> [vercel-url]"
    echo ""
    echo "Examples:"
    echo "  $0 chatfactory-pool-002"
    echo "  $0 chatfactory-pool-002 https://testbot-abc123.vercel.app"
    echo ""
    exit 1
fi

PROJECT_ID="$1"
VERCEL_URL="$2"

# Validate inputs
if [ -z "$PROJECT_ID" ]; then
    print_error "Project ID is required"
    exit 1
fi

validate_deployment "$PROJECT_ID" "$VERCEL_URL"