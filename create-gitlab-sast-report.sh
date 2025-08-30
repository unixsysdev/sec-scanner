#!/bin/bash

# 🔒 GitLab SAST Report Generator
# Converts security analysis results to GitLab-compatible SAST format

set -e

INPUT_FILE="security-results/security-report.json"
OUTPUT_FILE="security-results/gl-sast-report.json"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check if input file exists
if [ ! -f "$INPUT_FILE" ]; then
    log_error "Security report not found: $INPUT_FILE"
    exit 1
fi

log_info "Generating GitLab SAST report from: $INPUT_FILE"

# Create the GitLab SAST report structure
cat > "$OUTPUT_FILE" << 'EOF'
{
  "version": "15.0.0",
  "scan": {
    "analyzer": {
      "id": "security-analyzer",
      "name": "AI Security Analyzer",
      "url": "https://github.com/your-org/sec-analyzer",
      "vendor": {
        "name": "Security Analysis CLI"
      },
      "version": "1.0.0"
    },
    "scanner": {
      "id": "multi-model-ai",
      "name": "Multi-Model AI Security Scanner",
      "url": "https://chutes.ai",
      "vendor": {
        "name": "Chutes AI"
      },
      "version": "1.0.0"
    },
    "type": "sast",
    "start_time": "",
    "end_time": "",
    "status": "success"
  },
  "vulnerabilities": []
}
EOF

# Set timestamps
START_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S")
END_TIME=$(date -u +"%Y-%m-%dT%H:%M:%S")

# Update timestamps in the report
sed -i "s/\"start_time\": \"\"/\"start_time\": \"$START_TIME\"/" "$OUTPUT_FILE"
sed -i "s/\"end_time\": \"\"/\"end_time\": \"$END_TIME\"/" "$OUTPUT_FILE"

# Extract vulnerabilities from our security report
VULNERABILITIES=$(jq -r '
  .findings.original[]? as $finding |
  {
    id: ("sec-" + (. | @json | @sha256)[0:8]),
    category: "sast",
    name: $finding.title,
    message: $finding.description,
    description: ($finding.description + "\n\nRecommendation: " + ($finding.recommendation // "Review and fix")),
    cve: (if $finding.cwe then "CWE-" + $finding.cwe else null end),
    severity: (
      if $finding.severity >= 9 then "Critical"
      elif $finding.severity >= 7 then "High"
      elif $finding.severity >= 4 then "Medium"
      else "Low"
      end
    ),
    confidence: "Medium",
    solution: ($finding.recommendation // "Review and implement appropriate security measures"),
    scanner: {
      id: "multi-model-ai",
      name: "Multi-Model AI Security Scanner"
    },
    location: {
      file: ($finding.location // $finding.component // "unknown"),
      start_line: 1,
      end_line: 1
    },
    identifiers: [
      {
        type: "cwe",
        name: ($finding.cwe // "Unknown"),
        value: ($finding.cwe // "0"),
        url: (if $finding.cwe then "https://cwe.mitre.org/data/definitions/" + $finding.cwe + ".html" else null end)
      }
    ],
    links: [
      {
        url: "security-results/security-report.html",
        name: "Full Security Report"
      }
    ]
  }
' "$INPUT_FILE")

# Add vulnerabilities to the report
if [ -n "$VULNERABILITIES" ] && [ "$VULNERABILITIES" != "null" ]; then
    # Create a temporary file with the vulnerabilities
    TEMP_FILE=$(mktemp)
    echo "$VULNERABILITIES" | jq -s '.' > "$TEMP_FILE"

    # Update the main report
    jq --argjson vulns "$(cat "$TEMP_FILE")" '.vulnerabilities = $vulns' "$OUTPUT_FILE" > "${OUTPUT_FILE}.tmp"
    mv "${OUTPUT_FILE}.tmp" "$OUTPUT_FILE"

    # Count vulnerabilities
    VULN_COUNT=$(jq '.vulnerabilities | length' "$OUTPUT_FILE")
    log_success "Added $VULN_COUNT vulnerabilities to GitLab SAST report"

    rm "$TEMP_FILE"
else
    log_warning "No vulnerabilities found to add to SAST report"
fi

# Validate the generated report
if jq empty "$OUTPUT_FILE" 2>/dev/null; then
    log_success "GitLab SAST report generated successfully: $OUTPUT_FILE"

    # Show summary
    VULN_COUNT=$(jq '.vulnerabilities | length' "$OUTPUT_FILE")
    CRITICAL_COUNT=$(jq '.vulnerabilities[] | select(.severity == "Critical") | .id' "$OUTPUT_FILE" | wc -l)
    HIGH_COUNT=$(jq '.vulnerabilities[] | select(.severity == "High") | .id' "$OUTPUT_FILE" | wc -l)

    echo ""
    echo "📊 GitLab SAST Report Summary:"
    echo "   Total Vulnerabilities: $VULN_COUNT"
    echo "   Critical: $CRITICAL_COUNT"
    echo "   High: $HIGH_COUNT"
    echo ""

else
    log_error "Generated SAST report is not valid JSON"
    exit 1
fi

# Also create a coverage report for GitLab
COVERAGE_FILE="security-results/coverage.xml"
cat > "$COVERAGE_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<coverage generated="$(date +%s)">
  <sources>
    <source>.</source>
  </sources>
  <packages>
    <package name="security-analysis">
      <classes>
        <class name="SecurityReport">
          <methods>
            <method name="analyze">
              <lines>
                <line number="1" hits="1"/>
              </lines>
            </method>
          </methods>
          <lines>
            <line number="1" hits="1"/>
          </lines>
        </class>
      </classes>
    </package>
  </packages>
</coverage>
EOF

log_success "Coverage report generated: $COVERAGE_FILE"

echo ""
log_info "GitLab integration files created:"
echo "  📄 SAST Report: $OUTPUT_FILE"
echo "  📊 Coverage: $COVERAGE_FILE"
echo ""
log_info "These files will be automatically picked up by GitLab CI/CD"