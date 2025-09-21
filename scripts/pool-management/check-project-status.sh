#!/bin/bash

# ChatFactory Project Status Checker
# Shows current status of a specific project or all projects

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
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

print_header() {
    echo -e "${CYAN}$1${NC}"
}

# Function to authenticate with service account
authenticate_service_account() {
    local key_file="$1"

    if [ ! -f "$key_file" ]; then
        return 1
    fi

    export GOOGLE_APPLICATION_CREDENTIALS="$key_file"
    gcloud auth activate-service-account --key-file="$key_file" >/dev/null 2>&1
}

# Function to check single project status
check_project_status() {
    local project_id="$1"

    print_header "📊 Project Status: $project_id"
    echo "=================================="

    # Check if project exists
    if ! gcloud projects describe "$project_id" >/dev/null 2>&1; then
        print_error "Project does not exist"
        return 1
    fi

    print_status "Project exists"

    # Get project details
    local project_name
    project_name=$(gcloud projects describe "$project_id" --format="value(name)" 2>/dev/null)
    echo "   Name: $project_name"

    local project_number
    project_number=$(gcloud projects describe "$project_id" --format="value(projectNumber)" 2>/dev/null)
    echo "   Number: $project_number"

    # Check project secret status
    echo ""
    print_info "Checking project secret..."

    if authenticate_service_account "./keys/$project_id-service-key.json"; then
        gcloud config set project "$project_id" >/dev/null 2>&1

        if gcloud secrets describe "project-in-use" --project="$project_id" >/dev/null 2>&1; then
            local secret_value
            secret_value=$(gcloud secrets versions access latest --secret="project-in-use" --project="$project_id" 2>/dev/null)

            case "$secret_value" in
                "true")
                    print_status "Project secret: IN-USE 🔴"
                    ;;
                "false")
                    print_status "Project secret: AVAILABLE 🟢"
                    ;;
                *)
                    print_warning "Project secret: UNKNOWN ($secret_value)"
                    ;;
            esac
        else
            print_warning "Project secret not found"
        fi
    else
        print_warning "Cannot access project secret (service account key missing)"
    fi

    # Check central tracking status
    echo ""
    print_info "Checking central tracking..."

    if authenticate_service_account "./keys/docsai-chatbot-app-main-key.json"; then
        local access_token
        access_token=$(gcloud auth print-access-token)

        local tracking_data
        tracking_data=$(curl -s -X GET "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
            -H "Authorization: Bearer $access_token" 2>/dev/null)

        if [ $? -eq 0 ] && [ -n "$tracking_data" ]; then
            local project_data
            project_data=$(echo "$tracking_data" | jq -r ".fields.\"$project_id\"" 2>/dev/null)

            if [ "$project_data" != "null" ] && [ -n "$project_data" ]; then
                local status
                status=$(echo "$project_data" | jq -r '.mapValue.fields.status.stringValue' 2>/dev/null)

                local created_at
                created_at=$(echo "$project_data" | jq -r '.mapValue.fields.createdAt.timestampValue' 2>/dev/null)

                local deployed_at
                deployed_at=$(echo "$project_data" | jq -r '.mapValue.fields.deployedAt.timestampValue' 2>/dev/null)

                local vercel_url
                vercel_url=$(echo "$project_data" | jq -r '.mapValue.fields.vercelUrl.stringValue' 2>/dev/null)

                local last_checked
                last_checked=$(echo "$project_data" | jq -r '.mapValue.fields.lastChecked.timestampValue' 2>/dev/null)

                case "$status" in
                    "available")
                        print_status "Central tracking: AVAILABLE 🟢"
                        ;;
                    "in-use")
                        print_status "Central tracking: IN-USE 🔴"
                        if [ "$vercel_url" != "null" ] && [ -n "$vercel_url" ]; then
                            echo "   Vercel URL: $vercel_url"
                        fi
                        ;;
                    "maintenance")
                        print_warning "Central tracking: MAINTENANCE 🟡"
                        ;;
                    "deprecated")
                        print_error "Central tracking: DEPRECATED ⚫"
                        ;;
                    *)
                        print_warning "Central tracking: UNKNOWN ($status)"
                        ;;
                esac

                echo ""
                echo "   Timestamps:"
                if [ "$created_at" != "null" ] && [ -n "$created_at" ]; then
                    echo "     Created: $created_at"
                fi
                if [ "$deployed_at" != "null" ] && [ -n "$deployed_at" ]; then
                    echo "     Deployed: $deployed_at"
                fi
                if [ "$last_checked" != "null" ] && [ -n "$last_checked" ]; then
                    echo "     Last checked: $last_checked"
                fi
            else
                print_warning "Project not found in central tracking"
            fi
        else
            print_error "Failed to access central tracking"
        fi
    else
        print_warning "Cannot access central tracking (main service account key missing)"
    fi

    # Check Firebase services
    echo ""
    print_info "Checking Firebase services..."

    if authenticate_service_account "./keys/$project_id-service-key.json"; then
        gcloud config set project "$project_id" >/dev/null 2>&1

        local enabled_services
        enabled_services=$(gcloud services list --enabled --format="value(name)" 2>/dev/null)

        local firebase_services=("firebase.googleapis.com" "identitytoolkit.googleapis.com" "firestore.googleapis.com" "secretmanager.googleapis.com")

        for service in "${firebase_services[@]}"; do
            if echo "$enabled_services" | grep -q "$service"; then
                print_status "$service enabled"
            else
                print_warning "$service not enabled"
            fi
        done

        # Check Firebase apps
        echo ""
        print_info "Firebase apps:"
        local apps_output
        apps_output=$(firebase apps:list --project="$project_id" 2>/dev/null)

        if [ $? -eq 0 ]; then
            local app_count
            app_count=$(echo "$apps_output" | grep -c "WEB" || echo "0")
            echo "   Web apps: $app_count"

            if [ "$app_count" -gt "0" ]; then
                echo "$apps_output" | grep "WEB" | while IFS= read -r line; do
                    echo "     $line"
                done
            fi
        else
            print_warning "Cannot list Firebase apps"
        fi
    else
        print_warning "Cannot check Firebase services (service account key missing)"
    fi

    echo ""
}

# Function to list all tracked projects
list_all_projects() {
    print_header "📋 All Tracked Projects"
    echo "========================="

    if authenticate_service_account "./keys/docsai-chatbot-app-main-key.json"; then
        local access_token
        access_token=$(gcloud auth print-access-token)

        local tracking_data
        tracking_data=$(curl -s -X GET "https://firestore.googleapis.com/v1/projects/docsai-chatbot-app/databases/(default)/documents/project-tracking/available-projects" \
            -H "Authorization: Bearer $access_token" 2>/dev/null)

        if [ $? -eq 0 ] && [ -n "$tracking_data" ]; then
            echo "$tracking_data" | jq -r '.fields | to_entries[] | "\(.key):\(.value.mapValue.fields.status.stringValue)"' 2>/dev/null | while IFS=':' read -r project status; do
                case "$status" in
                    "available")
                        echo -e "   ${GREEN}🟢 $project (available)${NC}"
                        ;;
                    "in-use")
                        echo -e "   ${RED}🔴 $project (in-use)${NC}"
                        ;;
                    "maintenance")
                        echo -e "   ${YELLOW}🟡 $project (maintenance)${NC}"
                        ;;
                    "deprecated")
                        echo -e "   ⚫ $project (deprecated)"
                        ;;
                    *)
                        echo -e "   ❓ $project ($status)"
                        ;;
                esac
            done
        else
            print_error "Failed to access central tracking"
        fi
    else
        print_error "Cannot access central tracking (main service account key missing)"
    fi

    echo ""
}

# Main script
if [ $# -eq 0 ]; then
    echo "Usage: $0 <project-id|--all>"
    echo ""
    echo "Examples:"
    echo "  $0 chatfactory-pool-002          # Check specific project"
    echo "  $0 --all                         # List all tracked projects"
    echo ""
    exit 1
fi

if [ "$1" = "--all" ]; then
    list_all_projects
else
    PROJECT_ID="$1"
    check_project_status "$PROJECT_ID"
fi