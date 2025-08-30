# 🔒 Security Analysis CLI

A comprehensive security analysis pipeline that uses AI-powered multi-model review to analyze code changes for security vulnerabilities.

## 🚀 Features

- **Change Detection**: Automatically detect code changes from git diffs or file analysis
- **AI-Powered Analysis**: Uses multiple specialized AI models for comprehensive security review
- **Graph Integration**: Leverages code dependency graphs for context-aware analysis
- **Multi-Model Consensus**: Coordinates multiple AI models to reach consensus on findings
- **Automated Fixes**: Applies safe automated security fixes
- **Rich Reporting**: Generates detailed HTML/JSON reports with actionable recommendations
- **CI/CD Integration**: Designed for seamless integration into development pipelines

## 🤖 AI Models Used

- **Qwen3 Coder** (`Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8`) - Primary analysis
- **Kimi K2** (`moonshotai/Kimi-K2-Instruct-75k`) - Injection attacks specialist
- **GPT OSS 120B** (`openai/gpt-oss-120b`) - Authentication specialist
- **Qwen3 Thinking** (`Qwen/Qwen3-235B-A22B-Thinking-2507`) - General security analysis

## 📋 Installation

### Prerequisites
- Node.js 16+
- Git
- Chutes AI API key

### Setup
```bash
# Clone or download the repository
git clone <repository-url>
cd sec-analyzer

# Install dependencies
npm install

# Make executable
chmod +x sec-analyzer.js

# Initialize configuration
./sec-analyzer.js init

# Set your Chutes AI API key
export CHUTES_API_KEY="your-api-key-here"
```

## 🔧 Usage

### Quick Start Pipeline
```bash
# Run complete security analysis pipeline
sec-analyzer pipeline --graph php_graph.json --git-diff HEAD~1
```

### Individual Commands

#### 1. Detect Changes
```bash
# Detect changes from git diff
sec-analyzer detect --git-diff HEAD~1

# Detect changes from specific files
sec-analyzer detect --files "src/auth.php,src/database.php"

# Custom output location
sec-analyzer detect --git-diff HEAD~1 --output my-changes.json
```

#### 2. Build Security Context
```bash
sec-analyzer analyze \
  --changes changes.json \
  --graph php_graph.json \
  --output context.json
```

#### 3. Security Scan
```bash
sec-analyzer scan \
  --context context.json \
  --model Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8 \
  --output scan-results.json
```

#### 4. Multi-Model Review
```bash
sec-analyzer review \
  --scan-results scan-results.json \
  --context context.json \
  --models "moonshotai/Kimi-K2-Instruct-75k,openai/gpt-oss-120b" \
  --output review-results.json
```

#### 5. Generate Report
```bash
# HTML Report (default)
sec-analyzer report \
  --review-results review-results.json \
  --context context.json \
  --format html \
  --output security-report

# JSON Report
sec-analyzer report \
  --review-results review-results.json \
  --format json \
  --output security-report.json
```

#### 6. Apply Automated Fixes
```bash
# Apply only safe fixes
sec-analyzer fix \
  --report security-report.json \
  --apply-safe

# Dry run (show what would be fixed)
sec-analyzer fix \
  --report security-report.json \
  --dry-run
```

## 📊 Pipeline Integration

### GitHub Actions Example
```yaml
name: Security Analysis
on: [pull_request]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install Security Analyzer
        run: |
          npm install -g sec-analyzer
          sec-analyzer init

      - name: Run Security Analysis
        run: |
          sec-analyzer pipeline \
            --graph php_graph.json \
            --git-diff ${{ github.event.pull_request.base.sha }} \
            --output-dir security-results

      - name: Upload Report
        uses: actions/upload-artifact@v3
        with:
          name: security-report
          path: security-results/
```

### GitLab CI Example
```yaml
security_scan:
  stage: test
  script:
    - npm install -g sec-analyzer
    - sec-analyzer init
    - sec-analyzer pipeline --graph php_graph.json --git-diff $CI_MERGE_REQUEST_TARGET_BRANCH_NAME
  artifacts:
    reports:
      junit: security-results/report.xml
    paths:
      - security-results/
  only:
    - merge_requests
```

## 🎯 Analysis Capabilities

### Vulnerability Types Detected
- **SQL Injection**: Dynamic query analysis and prepared statement detection
- **XSS (Cross-Site Scripting)**: Output encoding and input sanitization review
- **CSRF**: Token validation and SameSite cookie analysis
- **Authentication Bypass**: Session management and auth logic review
- **Authorization Issues**: Access control and privilege escalation
- **File Upload Vulnerabilities**: Path traversal and content validation
- **Command Injection**: Shell command and system call analysis
- **Information Disclosure**: Error handling and logging review
- **Cryptography Issues**: Weak algorithms and key management
- **Race Conditions**: Concurrent execution and synchronization

### Code Languages Supported
- PHP
- JavaScript/TypeScript
- Python
- Java
- C/C++

## 📈 Graph Integration

The CLI integrates with your existing code dependency graph (`php_graph.json`) to:

- **Understand Relationships**: Map how components interact and depend on each other
- **Trace Attack Paths**: Identify potential vulnerability chains
- **Assess Blast Radius**: Determine impact scope of security issues
- **Prioritize Fixes**: Focus on high-impact security hotspots
- **Context-Aware Analysis**: Provide relevant context for each finding

## 🤖 Multi-Model AI Analysis

### Primary Analysis Model
- **Qwen3 Coder**: Performs initial comprehensive security scan
- Analyzes code patterns, identifies vulnerabilities
- Provides detailed technical findings

### Specialist Models
- **Kimi K2**: Focuses on injection attacks (SQL, NoSQL, command injection)
- **GPT OSS 120B**: Specializes in authentication and authorization issues
- **Qwen3 Thinking**: Provides general security analysis and recommendations

### Consensus Building
- Models review each other's findings
- Identify false positives and missed issues
- Reach consensus on severity and impact
- Provide comprehensive remediation strategies

## 🔧 Automated Fixes

### Safe Automated Fixes
- **SQL Injection**: Convert to prepared statements
- **XSS**: Add output escaping
- **Input Validation**: Add filter functions
- **Session Security**: Configure secure session settings
- **File Upload**: Add validation and content checking

### Manual Fix Suggestions
- **Library Updates**: Identify outdated dependencies
- **Architecture Changes**: Suggest secure design patterns
- **Configuration Updates**: Security hardening recommendations
- **Code Refactoring**: Complex vulnerability fixes

## 📊 Reporting

### Report Formats
- **HTML**: Interactive web report with charts and visualizations
- **JSON**: Structured data for integration with other tools
- **PDF**: Printable reports for documentation

### Report Contents
- Executive Summary
- Risk Assessment Matrix
- Detailed Findings with Code Examples
- Expert Model Reviews
- Remediation Roadmap
- Compliance Recommendations
- Monitoring Suggestions

## ⚙️ Configuration

### Environment Variables
```bash
# Required
CHUTES_API_KEY=your-chutes-api-key

# Optional
SEC_ANALYZER_CONFIG=/path/to/config.json
SEC_ANALYZER_CACHE_DIR=/tmp/sec-cache
```

### Configuration File (`.sec-analyzer/config.json`)
```json
{
  "ai": {
    "provider": "chutes",
    "models": {
      "primary": "Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8",
      "review": ["moonshotai/Kimi-K2-Instruct-75k"]
    }
  },
  "analysis": {
    "maxFileSize": "10MB",
    "excludePatterns": ["node_modules/**", "vendor/**"]
  },
  "reporting": {
    "formats": ["html", "json"],
    "riskThresholds": {
      "critical": 9,
      "high": 7,
      "medium": 4
    }
  }
}
```

## 🚨 Security Considerations

- **API Key Security**: Store API keys securely, never commit to version control
- **Data Privacy**: No code is stored permanently, analysis is performed in memory
- **Network Security**: All AI communications use HTTPS with API authentication
- **False Positives**: AI analysis may produce false positives, manual review recommended
- **Rate Limiting**: Respect API rate limits to avoid service disruption

## 📝 Examples

### Basic Security Scan
```bash
# Initialize
sec-analyzer init

# Detect changes
sec-analyzer detect --git-diff HEAD~1 --output changes.json

# Analyze with context
sec-analyzer analyze --changes changes.json --graph php_graph.json --output context.json

# Scan for vulnerabilities
sec-analyzer scan --context context.json --output scan-results.json

# Multi-model review
sec-analyzer review --scan-results scan-results.json --context context.json --output review-results.json

# Generate report
sec-analyzer report --review-results review-results.json --output security-report.html

# Apply safe fixes
sec-analyzer fix --report security-report.json --apply-safe
```

### CI/CD Integration
```bash
# One-command pipeline
sec-analyzer pipeline \
  --graph php_graph.json \
  --git-diff origin/main \
  --output-dir ./security-analysis \
  --skip-fixes
```

## 🐛 Troubleshooting

### Common Issues

**API Connection Failed**
```bash
# Check API key
echo $CHUTES_API_KEY

# Test connection
curl -H "Authorization: Bearer $CHUTES_API_KEY" https://llm.chutes.ai/v1/models
```

**Git Diff Not Working**
```bash
# Ensure you're in a git repository
git status

# Check git history
git log --oneline -10
```

**Memory Issues with Large Codebases**
```bash
# Increase Node.js memory limit
NODE_OPTIONS="--max-old-space-size=4096" sec-analyzer pipeline --graph php_graph.json
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Issues**: [GitHub Issues](https://github.com/your-org/sec-analyzer/issues)
- **Documentation**: [Wiki](https://github.com/your-org/sec-analyzer/wiki)
- **Discussions**: [GitHub Discussions](https://github.com/your-org/sec-analyzer/discussions)

---

**Made with ❤️ for secure software development**
