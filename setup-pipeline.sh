#!/bin/bash

# 🔒 Security Analysis Pipeline Setup Script
# This script helps you set up the security analysis pipeline in your project

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

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

# Check if we're in a git repository
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        log_error "This script must be run from inside a Git repository"
        exit 1
    fi
}

# Check Node.js version
check_nodejs() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 16 or higher"
        log_info "Visit: https://nodejs.org/"
        exit 1
    fi

    NODE_VERSION=$(node --version | sed 's/v//')
    REQUIRED_VERSION="16.0.0"

    if ! [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
        log_error "Node.js version $NODE_VERSION is too old. Please upgrade to Node.js 16 or higher"
        exit 1
    fi

    log_success "Node.js version: $NODE_VERSION ✓"
}

# Setup the security analyzer
setup_analyzer() {
    log_step "Setting up Security Analyzer..."

    # Install dependencies
    log_info "Installing dependencies..."
    log_command "npm install"
    npm install

    # Make executable
    log_command "chmod +x sec-analyzer.js"
    chmod +x sec-analyzer.js

    log_success "Security Analyzer setup completed ✓"
}

# Initialize configuration
initialize_config() {
    log_step "Initializing Security Analyzer configuration..."

    # Check for API key
    if [ -z "$CHUTES_API_KEY" ]; then
        log_warning "CHUTES_API_KEY environment variable not set"
        echo ""
        log_info "Please set your Chutes AI API key:"
        log_command "export CHUTES_API_KEY='your-api-key-here'"
        echo ""
        log_info "Get your API key from: https://chutes.ai"
        echo ""
        read -p "Do you want to continue without API key? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_info "Please set CHUTES_API_KEY and run this script again"
            exit 1
        fi
    else
        log_success "API key found ✓"
    fi

    # Initialize
    log_command "./sec-analyzer.js init"
    ./sec-analyzer.js init

    log_success "Configuration initialized ✓"
}

# Setup graph data
setup_graph_data() {
    log_step "Setting up graph data..."

    GRAPH_FILE="php_graph.json"

    if [ -f "$GRAPH_FILE" ]; then
        log_success "Graph file found: $GRAPH_FILE ✓"
        return
    fi

    log_warning "Graph file not found: $GRAPH_FILE"

    echo ""
    log_info "You have several options for graph data:"
    echo "1. Download from your storage"
    echo "2. Generate from your codebase"
    echo "3. Use sample data for testing"
    echo ""

    read -p "Choose an option (1-3): " choice

    case $choice in
        1)
            read -p "Enter the URL to download graph data from: " graph_url
            log_command "curl -o $GRAPH_FILE '$graph_url'"
            if curl -o "$GRAPH_FILE" "$graph_url"; then
                log_success "Graph data downloaded ✓"
            else
                log_error "Failed to download graph data"
                exit 1
            fi
            ;;
        2)
            log_info "Generating graph data from your codebase..."

            # Try to use the PHP graph generator if it exists
            if [ -f "./generate-php-graph.sh" ]; then
                log_info "Found PHP graph generator script"
                chmod +x ./generate-php-graph.sh
                if ./generate-php-graph.sh; then
                    if [ -f "$GRAPH_FILE" ]; then
                        log_success "Graph data generated successfully ✓"
                    else
                        log_error "Graph generator ran but $GRAPH_FILE was not created"
                        exit 1
                    fi
                else
                    log_error "Graph generator failed"
                    exit 1
                fi
            elif [ -f "./graph_php.py" ]; then
                log_info "Found Python graph generator"
                if python3 graph_php.py; then
                    if [ -f "$GRAPH_FILE" ]; then
                        log_success "Graph data generated with Python script ✓"
                    else
                        log_error "Python script ran but $GRAPH_FILE was not created"
                        exit 1
                    fi
                else
                    log_error "Python graph generator failed"
                    exit 1
                fi
            else
                log_warning "No graph generation script found"
                log_info "Creating basic graph structure for testing..."

                # Create a minimal but valid graph structure
                cat > "$GRAPH_FILE" << 'EOF'
{
  "nodes": [
    {
      "id": "example_class",
      "label": "ExampleClass",
      "type": "class",
      "file": "src/Example.php",
      "line": 1,
      "in_degree": 0,
      "out_degree": 0
    }
  ],
  "edges": [],
  "stats": {
    "total_nodes": 1,
    "total_edges": 0,
    "classes": 1,
    "methods": 0,
    "functions": 0
  }
}
EOF
                log_warning "Created basic test graph. For production, add a proper graph generator"
            fi
            ;;
        3)
            log_info "Creating sample graph data for testing..."

            # Create realistic sample data for testing
            cat > "$GRAPH_FILE" << 'EOF'
{
  "nodes": [
    {
      "id": "UserManager",
      "label": "UserManager",
      "type": "class",
      "file": "src/UserManager.php",
      "line": 10,
      "in_degree": 3,
      "out_degree": 2
    },
    {
      "id": "Database",
      "label": "Database",
      "type": "class",
      "file": "src/Database.php",
      "line": 5,
      "in_degree": 2,
      "out_degree": 1
    },
    {
      "id": "UserManager::authenticate",
      "label": "authenticate",
      "type": "method",
      "file": "src/UserManager.php",
      "line": 25,
      "in_degree": 1,
      "out_degree": 0
    },
    {
      "id": "UserManager::getUserById",
      "label": "getUserById",
      "type": "method",
      "file": "src/UserManager.php",
      "line": 45,
      "in_degree": 2,
      "out_degree": 1
    },
    {
      "id": "Database::query",
      "label": "query",
      "type": "method",
      "file": "src/Database.php",
      "line": 30,
      "in_degree": 1,
      "out_degree": 0
    }
  ],
  "edges": [
    {
      "source": "UserManager",
      "target": "Database",
      "type": "method_call",
      "weight": 2
    },
    {
      "source": "UserManager::authenticate",
      "target": "Database::query",
      "type": "method_call",
      "weight": 1
    },
    {
      "source": "UserManager::getUserById",
      "target": "Database::query",
      "type": "method_call",
      "weight": 1
    }
  ],
  "stats": {
    "total_nodes": 5,
    "total_edges": 3,
    "classes": 2,
    "methods": 3,
    "functions": 0
  }
}
EOF
            log_success "Created sample graph data for testing ✓"
            log_info "This includes example classes and methods for security analysis testing"
            ;;
        *)
            log_error "Invalid choice"
            exit 1
            ;;
    esac
}

# Test the setup
test_setup() {
    log_step "Testing Security Analyzer setup..."

    # Test basic functionality
    log_command "./sec-analyzer.js --help"
    if ./sec-analyzer.js --help > /dev/null 2>&1; then
        log_success "CLI help works ✓"
    else
        log_error "CLI help failed"
        exit 1
    fi

    # Test change detection
    log_command "./sec-analyzer.js detect --git-diff HEAD~1 --output test-changes.json"
    if ./sec-analyzer.js detect --git-diff HEAD~1 --output test-changes.json > /dev/null 2>&1; then
        log_success "Change detection works ✓"
        rm -f test-changes.json
    else
        log_warning "Change detection test failed (this might be normal if no changes exist)"
    fi

    log_success "Setup test completed ✓"
}

# Setup CI/CD integration
setup_ci_cd() {
    log_step "Setting up CI/CD integration..."

    echo ""
    log_info "Which CI/CD platform are you using?"
    echo "1. GitHub Actions"
    echo "2. GitLab CI"
    echo "3. Jenkins"
    echo "4. Azure DevOps"
    echo "5. CircleCI"
    echo "6. Local development only"
    echo ""

    read -p "Choose your platform (1-6): " platform

    case $platform in
        1)
            setup_github_actions
            ;;
        2)
            setup_gitlab_ci
            ;;
        3)
            setup_jenkins
            ;;
        4)
            setup_azure_devops
            ;;
        5)
            setup_circleci
            ;;
        6)
            log_info "Skipping CI/CD setup for local development"
            ;;
        *)
            log_error "Invalid choice"
            exit 1
            ;;
    esac
}

# Setup GitHub Actions
setup_github_actions() {
    WORKFLOW_DIR=".github/workflows"
    WORKFLOW_FILE="$WORKFLOW_DIR/security-analysis.yml"

    log_info "Setting up GitHub Actions..."

    # Create directory if it doesn't exist
    mkdir -p "$WORKFLOW_DIR"

    # Create workflow file
    cat > "$WORKFLOW_FILE" << 'EOF'
name: Security Analysis
on:
  pull_request:
    branches: [ main, develop ]
  push:
    branches: [ main ]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Install Security Analyzer
        run: |
          npm install
          chmod +x sec-analyzer.js

      - name: Initialize Security Analyzer
        run: ./sec-analyzer.js init
        env:
          CHUTES_API_KEY: ${{ secrets.CHUTES_API_KEY }}

      - name: Download Graph Data
        run: |
          # Download graph data from your storage
          # Options:
          # 1. From GitHub Releases: https://github.com/YOUR-ORG/YOUR-REPO/releases/download/latest/php_graph.json
          # 2. From cloud storage: https://storage.googleapis.com/YOUR-BUCKET/php_graph.json
          # 3. From your CI artifacts: Copy from previous build
          # 4. Generate fresh: ./generate-php-graph.sh

          curl -o php_graph.json "${GRAPH_DATA_URL:-https://storage.googleapis.com/your-security-data/php_graph.json}" || {
            echo "Failed to download graph data, generating fresh..."
            chmod +x ./generate-php-graph.sh
            ./generate-php-graph.sh
          }

      - name: Run Security Analysis
        run: |
          ./sec-analyzer.js pipeline \
            --graph php_graph.json \
            --git-diff ${{ github.event.pull_request.base.sha || 'HEAD~1' }} \
            --output-dir security-results
        env:
          CHUTES_API_KEY: ${{ secrets.CHUTES_API_KEY }}

      - name: Upload Security Report
        uses: actions/upload-artifact@v4
        with:
          name: security-analysis-report
          path: security-results/
          retention-days: 30

      - name: Comment PR with Results
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const path = require('path');

            const reportPath = path.join('security-results', 'security-report.html');
            if (fs.existsSync(reportPath)) {
              const reportContent = fs.readFileSync(reportPath, 'utf8');

              const findingsMatch = reportContent.match(/Total Findings: (\d+)/);
              const criticalMatch = reportContent.match(/Critical Issues: (\d+)/);

              const findings = findingsMatch ? findingsMatch[1] : '0';
              const critical = criticalMatch ? criticalMatch[1] : '0';

              let comment = '## 🔒 Security Analysis Results\n\n';
              comment += `📊 **Findings:** ${findings}\n`;
              comment += `🚨 **Critical Issues:** ${critical}\n\n`;

              if (parseInt(critical) > 0) {
                comment += '⚠️ **Action Required:** Critical security issues found.\n\n';
              } else if (parseInt(findings) > 0) {
                comment += '✅ **Review Needed:** Security issues detected.\n\n';
              } else {
                comment += '✅ **All Clear:** No security issues detected.\n\n';
              }

              comment += '[📋 View Full Report](https://github.com/' + process.env.GITHUB_REPOSITORY + '/actions/runs/' + process.env.GITHUB_RUN_ID + ')\n';

              github.rest.issues.createComment({
                issue_number: context.issue.number,
                owner: context.repo.owner,
                repo: context.repo.repo,
                body: comment
              });
            }
EOF

    log_success "GitHub Actions workflow created: $WORKFLOW_FILE"
    echo ""
    log_info "Next steps for GitHub Actions:"
    log_info "1. Add CHUTES_API_KEY to GitHub repository secrets"
    log_info "2. Update the graph data URL in the workflow"
    log_info "3. Commit and push the workflow file"
}

# Setup GitLab CI
setup_gitlab_ci() {
    CI_FILE=".gitlab-ci.yml"

    log_info "Setting up GitLab CI..."

    if [ -f "$CI_FILE" ]; then
        log_warning "GitLab CI file already exists. Please merge the security job manually."
        return
    fi

    cat > "$CI_FILE" << 'EOF'
stages:
  - security

security_analysis:
  stage: security
  image: node:18
  before_script:
    - npm install
    - chmod +x sec-analyzer.js
    - ./sec-analyzer.js init
  script:
    - |
      # Download graph data
      curl -o php_graph.json "$GRAPH_DATA_URL" || {
        echo "Failed to download graph data"
        exit 1
      }

      # Run security analysis
      ./sec-analyzer.js pipeline \
        --graph php_graph.json \
        --git-diff ${CI_MERGE_REQUEST_TARGET_BRANCH_NAME:-main} \
        --output-dir security-results
  artifacts:
    paths:
      - security-results/
    expire_in: 1 week
  only:
    - merge_requests
  except:
    - main
  variables:
    CHUTES_API_KEY: $CHUTES_API_KEY
    GRAPH_DATA_URL: $GRAPH_DATA_URL
EOF

    log_success "GitLab CI configuration created: $CI_FILE"
    echo ""
    log_info "Next steps for GitLab CI:"
    log_info "1. Add CHUTES_API_KEY and GRAPH_DATA_URL to GitLab CI variables"
    log_info "2. Update the graph data URL"
    log_info "3. Commit and push the CI file"
}

# Setup Jenkins
setup_jenkins() {
    JENKINS_FILE="Jenkinsfile"

    log_info "Setting up Jenkins pipeline..."

    if [ -f "$JENKINS_FILE" ]; then
        log_warning "Jenkinsfile already exists. Please merge the security stage manually."
        return
    fi

    cat > "$JENKINS_FILE" << 'EOF'
pipeline {
    agent {
        docker {
            image 'node:18'
            args '-u root'
        }
    }

    environment {
        CHUTES_API_KEY = credentials('chutes-api-key')
        GRAPH_DATA_URL = credentials('graph-data-url') ?: 'https://storage.googleapis.com/your-security-data/php_graph.json'
    }

    stages {
        stage('Security Analysis') {
            steps {
                sh '''
                    npm install
                    chmod +x sec-analyzer.js
                    ./sec-analyzer.js init

                    curl -o php_graph.json "$GRAPH_DATA_URL"

                    ./sec-analyzer.js pipeline \
                        --graph php_graph.json \
                        --git-diff origin/main \
                        --output-dir security-results
                '''
            }
        }

        stage('Publish Results') {
            steps {
                publishHTML([
                    allowMissing: false,
                    alwaysLinkToLastBuild: true,
                    keepAll: true,
                    reportDir: 'security-results',
                    reportFiles: 'security-report.html',
                    reportName: 'Security Analysis Report'
                ])
            }
        }
    }
}
EOF

    log_success "Jenkins pipeline created: $JENKINS_FILE"
    echo ""
    log_info "Next steps for Jenkins:"
    log_info "1. Add 'chutes-api-key' credential in Jenkins"
    log_info "2. Update GRAPH_DATA_URL in the pipeline"
    log_info "3. Configure the pipeline in Jenkins"
}

# Setup Azure DevOps
setup_azure_devops() {
    AZURE_FILE="azure-pipelines.yml"

    log_info "Setting up Azure DevOps pipeline..."

    cat > "$AZURE_FILE" << 'EOF'
trigger:
  - main

pool:
  vmImage: 'ubuntu-latest'

variables:
  CHUTES_API_KEY: $(chutesApiKey)
  GRAPH_DATA_URL: $(graphDataUrl)

stages:
  - stage: SecurityAnalysis
    jobs:
      - job: Analyze
        steps:
          - checkout: self
            fetchDepth: 0

          - task: NodeTool@0
            inputs:
              versionSpec: '18.x'

          - script: |
              npm install
              chmod +x sec-analyzer.js
              ./sec-analyzer.js init
            displayName: 'Setup Security Analyzer'

          - script: |
              curl -o php_graph.json "$(GRAPH_DATA_URL)"
            displayName: 'Download Graph Data'

          - script: |
              ./sec-analyzer.js pipeline \
                --graph php_graph.json \
                --git-diff origin/main \
                --output-dir security-results
            displayName: 'Run Security Analysis'
            env:
              CHUTES_API_KEY: $(CHUTES_API_KEY)

          - publish: security-results
            artifact: SecurityAnalysisResults
            displayName: 'Publish Security Results'
EOF

    log_success "Azure DevOps pipeline created: $AZURE_FILE"
    echo ""
    log_info "Next steps for Azure DevOps:"
    log_info "1. Add 'chutesApiKey' and 'graphDataUrl' variables in Azure DevOps"
    log_info "2. Update the graph data URL"
    log_info "3. Import the pipeline in Azure DevOps"
}

# Setup CircleCI
setup_circleci() {
    CIRCLE_FILE=".circleci/config.yml"

    log_info "Setting up CircleCI..."

    mkdir -p ".circleci"

    cat > "$CIRCLE_FILE" << 'EOF'
version: 2.1

executors:
  node-executor:
    docker:
      - image: cimg/node:18

workflows:
  security-analysis:
    jobs:
      - security-scan:
          filters:
            branches:
              only:
                - main
                - develop

jobs:
  security-scan:
    executor: node-executor
    steps:
      - checkout

      - run:
          name: Install dependencies
          command: |
            npm install
            chmod +x sec-analyzer.js

      - run:
          name: Initialize Security Analyzer
          command: ./sec-analyzer.js init
          environment:
            CHUTES_API_KEY: $CHUTES_API_KEY

      - run:
          name: Download Graph Data
          command: |
            curl -o php_graph.json "${GRAPH_DATA_URL:-https://storage.googleapis.com/your-security-data/php_graph.json}" || {
              echo "Failed to download graph data, generating fresh..."
              chmod +x ./generate-php-graph.sh
              ./generate-php-graph.sh
            }

      - run:
          name: Run Security Analysis
          command: |
            ./sec-analyzer.js pipeline \
              --graph php_graph.json \
              --git-diff origin/main \
              --output-dir security-results
          environment:
            CHUTES_API_KEY: $CHUTES_API_KEY

      - store_artifacts:
          path: security-results/
          destination: security-analysis-results
EOF

    log_success "CircleCI configuration created: $CIRCLE_FILE"
    echo ""
    log_info "Next steps for CircleCI:"
    log_info "1. Add CHUTES_API_KEY and GRAPH_DATA_URL environment variables"
    log_info "2. Update the graph data URL"
    log_info "3. Commit and push the configuration"
}

# Create run script
create_run_script() {
    log_step "Creating run script for local development..."

    cat > "run-security-analysis.sh" << 'EOF'
#!/bin/bash

# Configuration
CHUTES_API_KEY="${CHUTES_API_KEY:-}"
GRAPH_FILE="php_graph.json"
OUTPUT_DIR="security-analysis-results"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Main execution
main() {
    echo "🔒 Security Analysis Pipeline"
    echo "============================"

    if [ -z "$CHUTES_API_KEY" ]; then
        log_error "CHUTES_API_KEY not set"
        exit 1
    fi

    mkdir -p "$OUTPUT_DIR"

    BASE_COMMIT="${1:-HEAD~1}"
    log_info "Analyzing changes since: $BASE_COMMIT"

    if [ ! -f "$GRAPH_FILE" ]; then
        log_error "Graph file not found: $GRAPH_FILE"
        exit 1
    fi

    log_info "Running security analysis..."
    ./sec-analyzer.js pipeline \
        --graph "$GRAPH_FILE" \
        --git-diff "$BASE_COMMIT" \
        --output-dir "$OUTPUT_DIR"

    if [ $? -eq 0 ]; then
        log_success "Analysis completed successfully"
        echo "📁 Results: $OUTPUT_DIR"
    else
        log_error "Analysis failed"
        exit 1
    fi
}

main "$@"
EOF

    chmod +x run-security-analysis.sh
    log_success "Run script created: run-security-analysis.sh"
}

# Show final instructions
show_final_instructions() {
    echo ""
    echo "=========================================="
    echo "🎉 SETUP COMPLETED SUCCESSFULLY!"
    echo "=========================================="
    echo ""
    log_success "Security Analysis Pipeline is ready!"
    echo ""
    echo "📋 What you can do now:"
    echo ""
    echo "🔧 Local Development:"
    echo "  ./run-security-analysis.sh"
    echo "  ./run-security-analysis.sh HEAD~5  # Analyze last 5 commits"
    echo ""
    echo "🔧 Manual Commands:"
    echo "  ./sec-analyzer.js detect --git-diff HEAD~1"
    echo "  ./sec-analyzer.js pipeline --graph php_graph.json --git-diff HEAD~1"
    echo ""
    echo "📊 View Results:"
    echo "  open security-analysis-results/security-report.html"
    echo ""
    echo "⚙️  Configuration:"
    echo "  Edit .sec-analyzer/config.json for advanced settings"
    echo ""
    echo "📖 Documentation:"
    echo "  cat README.md"
    echo ""
    echo "=========================================="
    echo "🚀 Your DevSecOps pipeline is ready!"
    echo "=========================================="
}

# Main execution
main() {
    echo "🔒 Security Analysis Pipeline Setup"
    echo "==================================="
    echo ""

    check_git_repo
    check_nodejs
    setup_analyzer
    initialize_config
    setup_graph_data
    test_setup
    setup_ci_cd
    create_run_script
    show_final_instructions
}

# Run main function
main "$@"