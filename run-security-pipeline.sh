#!/bin/bash

# 🔒 Security Analysis Pipeline Runner
# Runs the complete security analysis pipeline with proper graph data generation

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

log_command() {
    echo -e "${CYAN}[CMD]${NC} $1"
}

# Configuration
OUTPUT_DIR="${OUTPUT_DIR:-security-analysis-results}"
BASE_REF="${1:-HEAD~1}"
GRAPH_FILE="php_graph.json"

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."

    # Check Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 16+"
        exit 1
    fi

    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "Python3 is not installed. Please install Python 3"
        exit 1
    fi

    # Check Git
    if ! command -v git &> /dev/null; then
        log_error "Git is not installed. Please install Git"
        exit 1
    fi

    # Check if we're in a git repository
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "This script must be run from inside a Git repository"
        exit 1
    fi

    log_success "Prerequisites check passed ✓"
}

# Setup environment
setup_environment() {
    log_step "Setting up environment..."

    # Install Node.js dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing Node.js dependencies..."
        npm install
    fi

    # Make scripts executable
    chmod +x sec-analyzer.js 2>/dev/null || true
    chmod +x create-gitlab-sast-report.sh 2>/dev/null || true
    chmod +x generate-php-graph.sh 2>/dev/null || true

    # Initialize security analyzer
    if [ -f "sec-analyzer.js" ]; then
        log_info "Initializing security analyzer..."
        ./sec-analyzer.js init 2>/dev/null || log_warning "Could not initialize analyzer"
    fi

    log_success "Environment setup completed ✓"
}

# Generate/Update graph data
generate_graph_data() {
    log_step "Generating/Updating graph data..."

    # Check for graph_php.py first (most comprehensive for PHP)
    if [ -f "graph_php.py" ]; then
        log_info "Found graph_php.py - running comprehensive PHP analysis..."
        log_command "python3 graph_php.py"

        if python3 graph_php.py; then
            if [ -f "$GRAPH_FILE" ]; then
                log_success "Graph data updated successfully with graph_php.py ✓"
                return 0
            else
                log_warning "graph_php.py completed but $GRAPH_FILE not found"
            fi
        else
            log_warning "graph_php.py failed, trying alternatives..."
        fi
    fi

    # Check for anal.py as alternative
    if [ -f "anal.py" ]; then
        log_info "Found anal.py - running analysis..."
        log_command "python3 anal.py"

        if python3 anal.py; then
            if [ -f "$GRAPH_FILE" ]; then
                log_success "Graph data updated successfully with anal.py ✓"
                return 0
            else
                log_warning "anal.py completed but $GRAPH_FILE not found"
            fi
        else
            log_warning "anal.py failed, trying fallback..."
        fi
    fi

    # Fallback to basic generator
    log_info "Using fallback PHP graph generator..."
    if [ -f "generate-php-graph.sh" ]; then
        log_command "./generate-php-graph.sh"
        if ./generate-php-graph.sh; then
            if [ -f "$GRAPH_FILE" ]; then
                log_success "Graph data generated with fallback script ✓"
                return 0
            fi
        fi
    fi

    # Last resort: create minimal graph
    log_warning "Creating minimal graph file..."
    cat > "$GRAPH_FILE" << 'EOF'
{
  "nodes": [],
  "edges": [],
  "stats": {
    "total_nodes": 0,
    "total_edges": 0,
    "classes": 0,
    "methods": 0,
    "functions": 0
  }
}
EOF
    log_warning "Created minimal graph file - analysis may be limited"
    return 1
}

# Run security analysis
run_security_analysis() {
    log_step "Running security analysis..."

    # Create output directory
    mkdir -p "$OUTPUT_DIR"

    # Check if graph file exists
    if [ ! -f "$GRAPH_FILE" ]; then
        log_error "Graph file $GRAPH_FILE not found"
        exit 1
    fi

    # Verify graph file is valid JSON
    if ! jq empty "$GRAPH_FILE" 2>/dev/null; then
        log_error "Graph file $GRAPH_FILE is not valid JSON"
        exit 1
    fi

    # Run the analysis
    log_info "Starting security analysis pipeline..."
    log_command "./sec-analyzer.js pipeline --graph $GRAPH_FILE --git-diff $BASE_REF --output-dir $OUTPUT_DIR"

    if ./sec-analyzer.js pipeline --graph "$GRAPH_FILE" --git-diff "$BASE_REF" --output-dir "$OUTPUT_DIR"; then
        log_success "Security analysis completed successfully ✓"
    else
        log_error "Security analysis failed"
        exit 1
    fi
}

# Generate reports
generate_reports() {
    log_step "Generating additional reports..."

    # Generate GitLab SAST report if script exists
    if [ -f "create-gitlab-sast-report.sh" ]; then
        log_info "Generating GitLab SAST report..."
        ./create-gitlab-sast-report.sh
    fi
}

# Display results
display_results() {
    log_step "Analysis Results Summary"

    REPORT_FILE="$OUTPUT_DIR/security-report.json"

    if [ -f "$REPORT_FILE" ]; then
        echo ""
        echo "=========================================="
        echo "🔒 SECURITY ANALYSIS RESULTS"
        echo "=========================================="

        # Extract key metrics
        CRITICAL_ISSUES=$(jq '.executiveSummary.criticalIssues // 0' "$REPORT_FILE")
        HIGH_ISSUES=$(jq '.executiveSummary.highRiskIssues // 0' "$REPORT_FILE")
        TOTAL_FINDINGS=$(jq '.executiveSummary.totalFindings // 0' "$REPORT_FILE")
        OVERALL_RISK=$(jq -r '.executiveSummary.overallRisk // "Unknown"' "$REPORT_FILE")

        echo "📊 Summary:"
        echo "   🔴 Critical Issues: $CRITICAL_ISSUES"
        echo "   🟠 High Risk Issues: $HIGH_ISSUES"
        echo "   📊 Total Findings: $TOTAL_FINDINGS"
        echo "   🎯 Overall Risk: $OVERALL_RISK"
        echo ""

        # Show recommendations
        if [ "$CRITICAL_ISSUES" -gt 0 ]; then
            log_error "🚨 CRITICAL ISSUES DETECTED!"
            echo "   📋 Review the HTML report immediately"
            echo ""
        elif [ "$HIGH_ISSUES" -gt 0 ]; then
            log_warning "⚠️ HIGH-RISK ISSUES FOUND"
            echo "   📋 Review the HTML report before deployment"
            echo ""
        elif [ "$TOTAL_FINDINGS" -gt 0 ]; then
            log_warning "⚠️ SECURITY ISSUES DETECTED"
            echo "   📋 Review findings in the HTML report"
            echo ""
        else
            log_success "✅ NO SECURITY ISSUES DETECTED"
            echo "   🎉 Code appears secure"
            echo ""
        fi

        echo "📁 Results saved to: $OUTPUT_DIR"
        echo "📋 HTML Report: $OUTPUT_DIR/security-report.html"
        echo "📄 JSON Report: $OUTPUT_DIR/security-report.json"
        echo ""

        # Show file locations
        if [ -f "$OUTPUT_DIR/security-report.html" ]; then
            echo "🌐 To view the HTML report:"
            echo "   open $OUTPUT_DIR/security-report.html"
            echo ""
        fi

    else
        log_error "Report file not found: $REPORT_FILE"
        echo "📁 Check the output directory: $OUTPUT_DIR"
        exit 1
    fi
}

# Show usage
show_usage() {
    echo "🔒 Security Analysis Pipeline Runner"
    echo ""
    echo "Usage: $0 [BASE_REF]"
    echo ""
    echo "Arguments:"
    echo "  BASE_REF    Git reference to compare against (default: HEAD~1)"
    echo ""
    echo "Environment Variables:"
    echo "  OUTPUT_DIR  Output directory (default: security-analysis-results)"
    echo "  CHUTES_API_KEY  Your Chutes AI API key"
    echo ""
    echo "Examples:"
    echo "  $0                    # Analyze last commit"
    echo "  $0 HEAD~5            # Analyze last 5 commits"
    echo "  $0 origin/main       # Compare with main branch"
    echo ""
    echo "The script will:"
    echo "  1. Check prerequisites"
    echo "  2. Setup environment"
    echo "  3. Generate/update graph data using anal.py"
    echo "  4. Run security analysis"
    echo "  5. Generate reports"
    echo "  6. Display results summary"
}

# Main execution
main() {
    echo "🔒 Security Analysis Pipeline Runner"
    echo "===================================="

    # Check for help flag
    if [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
        show_usage
        exit 0
    fi

    # Check for API key
    if [ -z "$CHUTES_API_KEY" ]; then
        log_warning "CHUTES_API_KEY environment variable not set"
        echo "Set it with: export CHUTES_API_KEY='your-api-key'"
        echo ""
        read -p "Continue without API key? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Please set CHUTES_API_KEY and try again"
            exit 1
        fi
    fi

    check_prerequisites
    setup_environment
    generate_graph_data
    run_security_analysis
    generate_reports
    display_results

    echo ""
    log_success "🎉 Security analysis pipeline completed!"
    echo ""
}

# Run main function with all arguments
main "$@"