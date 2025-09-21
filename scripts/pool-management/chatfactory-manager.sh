#!/bin/bash

# ChatFactory Pool Manager
# Master script for managing ChatFactory pool projects

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_title() {
    echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${PURPLE}║                                ChatFactory Pool Manager                              ║${NC}"
    echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════════════════════════════╝${NC}"
}

print_header() {
    echo -e "${CYAN}$1${NC}"
}

print_success() {
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

# Function to show menu
show_menu() {
    echo ""
    print_header "Available Operations:"
    echo ""
    echo "  🔧 SETUP & VALIDATION"
    echo "     1) Setup prerequisites"
    echo "     2) Check project status"
    echo "     3) List all projects"
    echo ""
    echo "  🚀 DEPLOYMENT"
    echo "     4) Deploy chatfactory-pool-002 (test)"
    echo "     5) Validate deployment"
    echo ""
    echo "  🧹 MAINTENANCE"
    echo "     6) Cleanup pool-002 (reset for testing)"
    echo "     7) Release project (mark as available)"
    echo ""
    echo "  📊 MONITORING"
    echo "     8) Full system health check"
    echo "     9) View deployment logs"
    echo ""
    echo "  ❓ HELP"
    echo "     h) Show detailed help"
    echo "     q) Quit"
    echo ""
}

# Function to run script with error handling
run_script() {
    local script="$1"
    local description="$2"
    shift 2
    local args="$@"

    print_info "Running: $description"

    if [ ! -f "$script" ]; then
        print_error "Script not found: $script"
        return 1
    fi

    if [ ! -x "$script" ]; then
        print_warning "Making script executable: $script"
        chmod +x "$script"
    fi

    echo ""
    if "$script" $args; then
        echo ""
        print_success "$description completed successfully"
        return 0
    else
        local exit_code=$?
        echo ""
        print_error "$description failed with exit code: $exit_code"
        return 1
    fi
}

# Function to validate environment
validate_environment() {
    print_info "Validating environment..."

    # Check if we're in the right directory (ChatFactoryApp)
    if [ ! -f "package.json" ]; then
        print_error "Not in ChatFactoryApp directory. Please cd to the correct directory."
        return 1
    fi

    # Check if pool management scripts directory exists
    if [ ! -d "scripts/pool-management" ]; then
        print_error "Pool management scripts directory not found. Please ensure all scripts are in ./scripts/pool-management/"
        return 1
    fi

    # Check if ChatFactoryTemplate exists
    if [ ! -d "../ChatFactoryTemplate" ]; then
        print_error "ChatFactoryTemplate directory not found. Please ensure it's in the same parent directory as ChatFactoryApp."
        return 1
    fi

    # Check for required scripts
    local required_scripts=(
        "scripts/pool-management/setup-prerequisites.sh"
        "scripts/pool-management/deploy-chatfactory-pool-002.sh"
        "scripts/pool-management/cleanup-pool-002.sh"
        "scripts/pool-management/validate-deployment.sh"
        "scripts/pool-management/check-project-status.sh"
    )

    for script in "${required_scripts[@]}"; do
        if [ ! -f "$script" ]; then
            print_error "Required script missing: $script"
            return 1
        fi
    done

    print_success "Environment validation passed"
    return 0
}

# Function to show help
show_help() {
    print_header "ChatFactory Pool Manager - Detailed Help"
    echo ""
    echo "OVERVIEW:"
    echo "This tool manages ChatFactory pool projects for automated chatbot deployment."
    echo ""
    echo "WORKFLOW:"
    echo "1. First time setup: Run option 1 (Setup prerequisites)"
    echo "2. Deploy test project: Run option 4 (Deploy pool-002)"
    echo "3. Validate deployment: Run option 5 (Validate deployment)"
    echo "4. For testing iterations: Run option 6 (Cleanup) then repeat from step 2"
    echo ""
    echo "DETAILED OPTIONS:"
    echo ""
    echo "1) Setup prerequisites"
    echo "   - Validates required tools (gcloud, firebase, vercel, jq)"
    echo "   - Checks authentication"
    echo "   - Creates service account keys"
    echo "   - Sets up directory structure"
    echo ""
    echo "2) Check project status"
    echo "   - Shows current status of a specific project"
    echo "   - Displays secret status, central tracking, and Firebase services"
    echo ""
    echo "3) List all projects"
    echo "   - Shows all projects in the central tracking system"
    echo "   - Color-coded by status (available/in-use/maintenance/deprecated)"
    echo ""
    echo "4) Deploy chatfactory-pool-002"
    echo "   - Complete automated deployment of pool-002"
    echo "   - Creates project if needed, sets up Firebase, deploys to Vercel"
    echo "   - Shows OAuth setup instructions"
    echo ""
    echo "5) Validate deployment"
    echo "   - Tests deployment health and OAuth configuration"
    echo "   - Verifies tracking systems and Firebase services"
    echo ""
    echo "6) Cleanup pool-002"
    echo "   - Resets pool-002 to available state for re-testing"
    echo "   - Preserves project infrastructure"
    echo ""
    echo "7) Release project"
    echo "   - Mark any project as available (for production use)"
    echo ""
    echo "8) System health check"
    echo "   - Comprehensive check of all systems and projects"
    echo ""
    echo "9) View deployment logs"
    echo "   - Shows recent deployment activity and logs"
    echo ""
    echo "FILES CREATED:"
    echo "  ./keys/                     - Service account keys"
    echo "  ./scripts/                  - All management scripts"
    echo "  .env.local.backup          - Backup of environment config"
    echo ""
    echo "SECURITY:"
    echo "- Each project has its own service account for isolation"
    echo "- Central tracking uses main service account"
    echo "- Service keys stored locally in ./keys/ (gitignored)"
    echo ""
}

# Function to release any project
release_project() {
    echo ""
    read -p "Enter project ID to release (e.g., chatfactory-pool-003): " project_id

    if [ -z "$project_id" ]; then
        print_error "Project ID cannot be empty"
        return 1
    fi

    print_warning "This will mark $project_id as available. Continue? (y/N)"
    read -p "> " -n 1 -r
    echo

    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Operation cancelled."
        return 0
    fi

    # Use the cleanup script as a template but adapt for any project
    print_info "Releasing project: $project_id"

    # Check if project exists
    if ! gcloud projects describe "$project_id" >/dev/null 2>&1; then
        print_error "Project $project_id does not exist"
        return 1
    fi

    # TODO: Implement generic project release logic
    print_warning "Generic project release not yet implemented."
    print_info "For now, use the cleanup script for pool-002 specifically."
    print_info "To implement: adapt cleanup-pool-002.sh for any project ID"

    return 1
}

# Function to show system health
system_health_check() {
    print_header "System Health Check"
    echo ""

    local issues=0

    # Check prerequisites
    print_info "Checking prerequisites..."
    if run_script "./scripts/setup-prerequisites.sh" "Prerequisites check" >/dev/null 2>&1; then
        print_success "Prerequisites: OK"
    else
        print_error "Prerequisites: FAILED"
        ((issues++))
    fi

    # Check all projects
    print_info "Checking tracked projects..."
    if [ -f "./keys/docsai-chatbot-app-main-key.json" ]; then
        print_success "Main service account key: OK"
    else
        print_error "Main service account key: MISSING"
        ((issues++))
    fi

    # Check specific projects
    local projects=("chatfactory-pool-001" "chatfactory-pool-002")
    for project in "${projects[@]}"; do
        if gcloud projects describe "$project" >/dev/null 2>&1; then
            print_success "Project $project: EXISTS"
        else
            print_warning "Project $project: NOT FOUND"
        fi
    done

    echo ""
    if [ $issues -eq 0 ]; then
        print_success "System health: ALL GOOD ✨"
    else
        print_warning "System health: $issues ISSUES FOUND"
    fi

    return $issues
}

# Main function
main() {
    clear
    print_title

    # Validate environment first
    if ! validate_environment; then
        echo ""
        print_error "Environment validation failed. Please fix the issues above."
        exit 1
    fi

    while true; do
        show_menu
        read -p "Choose an option: " choice

        case $choice in
            1)
                echo ""
                run_script "./scripts/pool-management/setup-prerequisites.sh" "Prerequisites setup"
                ;;
            2)
                echo ""
                read -p "Enter project ID (or press Enter for chatfactory-pool-002): " project_id
                project_id=${project_id:-chatfactory-pool-002}
                run_script "./scripts/pool-management/check-project-status.sh" "Project status check" "$project_id"
                ;;
            3)
                echo ""
                run_script "./scripts/pool-management/check-project-status.sh" "List all projects" "--all"
                ;;
            4)
                echo ""
                print_warning "This will deploy chatfactory-pool-002. Continue? (y/N)"
                read -p "> " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    run_script "./scripts/pool-management/deploy-chatfactory-pool-002.sh" "Deploy chatfactory-pool-002"
                else
                    print_info "Deployment cancelled"
                fi
                ;;
            5)
                echo ""
                read -p "Enter project ID (default: chatfactory-pool-002): " project_id
                project_id=${project_id:-chatfactory-pool-002}
                read -p "Enter Vercel URL (optional): " vercel_url
                run_script "./scripts/pool-management/validate-deployment.sh" "Validate deployment" "$project_id" "$vercel_url"
                ;;
            6)
                echo ""
                print_warning "This will reset pool-002 for re-testing. Continue? (y/N)"
                read -p "> " -n 1 -r
                echo
                if [[ $REPLY =~ ^[Yy]$ ]]; then
                    run_script "./scripts/pool-management/cleanup-pool-002.sh" "Cleanup pool-002"
                else
                    print_info "Cleanup cancelled"
                fi
                ;;
            7)
                release_project
                ;;
            8)
                echo ""
                system_health_check
                ;;
            9)
                echo ""
                print_info "Deployment logs feature not yet implemented"
                print_info "For now, check Vercel dashboard or gcloud logs"
                ;;
            h|H)
                echo ""
                show_help
                ;;
            q|Q)
                echo ""
                print_info "Goodbye! 👋"
                exit 0
                ;;
            *)
                echo ""
                print_warning "Invalid option. Please choose 1-9, h for help, or q to quit."
                ;;
        esac

        echo ""
        read -p "Press Enter to continue..."
        clear
        print_title
    done
}

# Run main function
main "$@"