/**
 * Report Generator Module
 * Creates comprehensive security reports in multiple formats
 */

import fs from 'fs';
import path from 'path';

export async function generateReport(options) {
  const { reviewResults: reviewResultsFile, context: contextFile, format, output } = options;

  console.log('📊 Generating security report...');

  try {
    // Load review results and context
    const reviewResults = JSON.parse(fs.readFileSync(reviewResultsFile, 'utf8'));
    const contextData = JSON.parse(fs.readFileSync(contextFile, 'utf8'));

    console.log(`📋 Generating ${format} report with ${reviewResults.reviews?.length || 0} expert reviews...`);

    // Generate report based on format
    let reportContent = '';
    let reportPath = '';

    switch (format.toLowerCase()) {
      case 'html':
        reportContent = await generateHTMLReport(reviewResults, contextData);
        reportPath = output.endsWith('.html') ? output : `${output}.html`;
        break;
      case 'json':
        reportContent = JSON.stringify(generateJSONReport(reviewResults, contextData), null, 2);
        reportPath = output.endsWith('.json') ? output : `${output}.json`;
        break;
      case 'pdf':
        // For PDF, we'll generate HTML first and note that PDF conversion would need additional tools
        reportContent = await generateHTMLReport(reviewResults, contextData);
        reportPath = output.endsWith('.html') ? output : `${output}.html`;
        console.log('📝 Note: PDF generation requires additional tools like puppeteer or wkhtmltopdf');
        break;
      default:
        throw new Error(`Unsupported format: ${format}. Supported: html, json, pdf`);
    }

    // Write report to file
    fs.writeFileSync(reportPath, reportContent);

    console.log(`✅ Report generated: ${reportPath}`);

    return {
      format,
      path: reportPath,
      size: reportContent.length,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Error generating report:', error.message);
    throw error;
  }
}

function generateJSONReport(reviewResults, contextData) {
  return {
    reportMetadata: {
      generatedAt: new Date().toISOString(),
      version: '1.0.0',
      analysisType: 'Multi-Model Security Review'
    },
    executiveSummary: {
      overallRisk: reviewResults.finalAssessment?.overallRisk || 'Unknown',
      totalFindings: reviewResults.originalFindings?.length || 0,
      criticalIssues: reviewResults.originalFindings?.filter(f => f.severity >= 9).length || 0,
      modelsUsed: reviewResults.models || [],
      consensusReached: reviewResults.consensus?.agreement || false
    },
    findings: {
      original: reviewResults.originalFindings || [],
      new: reviewResults.consensus?.newFindings || [],
      critical: reviewResults.finalAssessment?.criticalFindings || []
    },
    expertReviews: reviewResults.reviews || [],
    recommendations: {
      immediate: extractImmediateActions(reviewResults),
      shortTerm: extractShortTermActions(reviewResults),
      longTerm: extractLongTermActions(reviewResults)
    },
    context: {
      changedFiles: contextData.originalChanges?.changedFiles || [],
      affectedComponents: [
        ...(contextData.originalChanges?.affectedFunctions || []),
        ...(contextData.originalChanges?.affectedClasses || []),
        ...(contextData.originalChanges?.affectedMethods || [])
      ],
      securityHotspots: contextData.securityContext?.securityHotspots || []
    },
    riskMatrix: reviewResults.finalAssessment?.riskMatrix || {},
    compliance: {
      recommendations: reviewResults.finalAssessment?.complianceRecommendations || [],
      standards: identifyRelevantStandards(reviewResults)
    },
    monitoring: {
      recommendations: reviewResults.finalAssessment?.monitoringRecommendations || [],
      alerts: generateMonitoringAlerts(reviewResults)
    }
  };
}

async function generateHTMLReport(reviewResults, contextData) {
  const jsonData = generateJSONReport(reviewResults, contextData);

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Security Analysis Report</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f8f9fa;
        }

        .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }

        .header {
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }

        .header h1 {
            font-size: 2.5em;
            margin-bottom: 10px;
        }

        .header .subtitle {
            font-size: 1.2em;
            opacity: 0.9;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }

        .summary-card {
            background: white;
            padding: 25px;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            border-left: 4px solid #667eea;
        }

        .summary-card h3 {
            color: #667eea;
            margin-bottom: 15px;
            font-size: 1.3em;
        }

        .risk-badge {
            display: inline-block;
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 0.9em;
        }

        .risk-critical { background: #dc3545; color: white; }
        .risk-high { background: #fd7e14; color: white; }
        .risk-medium { background: #ffc107; color: black; }
        .risk-low { background: #28a745; color: white; }

        .findings-section {
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .findings-section h2 {
            color: #333;
            margin-bottom: 20px;
            border-bottom: 2px solid #667eea;
            padding-bottom: 10px;
        }

        .finding-item {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
            background: #fafafa;
        }

        .finding-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .finding-title {
            font-weight: bold;
            font-size: 1.1em;
        }

        .finding-severity {
            padding: 3px 10px;
            border-radius: 12px;
            font-size: 0.8em;
            font-weight: bold;
        }

        .severity-critical { background: #dc3545; color: white; }
        .severity-high { background: #fd7e14; color: white; }
        .severity-medium { background: #ffc107; color: black; }
        .severity-low { background: #28a745; color: white; }

        .finding-details {
            color: #666;
            margin-bottom: 10px;
        }

        .finding-location {
            font-family: monospace;
            background: #f8f9fa;
            padding: 5px 10px;
            border-radius: 4px;
            font-size: 0.9em;
        }

        .recommendations-section {
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .recommendations-section h2 {
            color: #333;
            margin-bottom: 20px;
            border-bottom: 2px solid #28a745;
            padding-bottom: 10px;
        }

        .recommendation-item {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 10px;
            border-left: 4px solid #28a745;
        }

        .expert-reviews {
            background: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }

        .expert-reviews h2 {
            color: #333;
            margin-bottom: 20px;
            border-bottom: 2px solid #6f42c1;
            padding-bottom: 10px;
        }

        .review-item {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 15px;
        }

        .review-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }

        .reviewer-name {
            font-weight: bold;
            color: #6f42c1;
        }

        .review-model {
            font-family: monospace;
            background: #f8f9fa;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 0.8em;
        }

        .footer {
            text-align: center;
            padding: 20px;
            color: #666;
            border-top: 1px solid #e0e0e0;
            margin-top: 40px;
        }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
            margin-top: 20px;
        }

        .stat-item {
            text-align: center;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
        }

        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }

        .stat-label {
            font-size: 0.9em;
            color: #666;
            margin-top: 5px;
        }

        @media (max-width: 768px) {
            .container {
                padding: 10px;
            }

            .header {
                padding: 20px;
            }

            .header h1 {
                font-size: 2em;
            }

            .summary-grid {
                grid-template-columns: 1fr;
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 Security Analysis Report</h1>
            <p class="subtitle">Multi-Model AI Security Assessment</p>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-value">${jsonData.executiveSummary.totalFindings}</div>
                    <div class="stat-label">Total Findings</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${jsonData.executiveSummary.criticalIssues}</div>
                    <div class="stat-label">Critical Issues</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${jsonData.executiveSummary.modelsUsed.length}</div>
                    <div class="stat-label">AI Models Used</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value" style="color: ${getRiskColor(jsonData.executiveSummary.overallRisk)}">${jsonData.executiveSummary.overallRisk}</div>
                    <div class="stat-label">Overall Risk</div>
                </div>
            </div>
        </div>

        <div class="summary-grid">
            <div class="summary-card">
                <h3>📊 Risk Assessment</h3>
                <p><strong>Overall Risk:</strong> <span class="risk-badge risk-${jsonData.executiveSummary.overallRisk.toLowerCase()}">${jsonData.executiveSummary.overallRisk}</span></p>
                <p><strong>Consensus:</strong> ${jsonData.executiveSummary.consensusReached ? '✅ Reached' : '⚠️ Mixed Opinions'}</p>
                <p><strong>Analysis Date:</strong> ${new Date(jsonData.reportMetadata.generatedAt).toLocaleDateString()}</p>
            </div>

            <div class="summary-card">
                <h3>🎯 Risk Matrix</h3>
                <p><strong>Critical:</strong> ${jsonData.riskMatrix.critical || 0}</p>
                <p><strong>High:</strong> ${jsonData.riskMatrix.high || 0}</p>
                <p><strong>Medium:</strong> ${jsonData.riskMatrix.medium || 0}</p>
                <p><strong>Low:</strong> ${jsonData.riskMatrix.low || 0}</p>
            </div>

            <div class="summary-card">
                <h3>📁 Scope</h3>
                <p><strong>Files Changed:</strong> ${jsonData.context.changedFiles.length}</p>
                <p><strong>Components:</strong> ${jsonData.context.affectedComponents.length}</p>
                <p><strong>Hotspots:</strong> ${jsonData.context.securityHotspots.length}</p>
            </div>
        </div>

        ${generateFindingsHTML(jsonData.findings)}

        ${generateRecommendationsHTML(jsonData.recommendations)}

        ${generateExpertReviewsHTML(jsonData.expertReviews)}

        <div class="footer">
            <p>Report generated by Security Analysis CLI v${jsonData.reportMetadata.version}</p>
            <p>Analysis completed on ${new Date(jsonData.reportMetadata.generatedAt).toLocaleString()}</p>
        </div>
    </div>
</body>
</html>`;
}

function generateFindingsHTML(findings) {
  const allFindings = [...(findings.original || []), ...(findings.new || [])];

  if (allFindings.length === 0) {
    return `
    <div class="findings-section">
        <h2>🔍 Security Findings</h2>
        <p>No security findings detected. 🎉</p>
    </div>`;
  }

  const findingsHTML = allFindings.map(finding => `
    <div class="finding-item">
        <div class="finding-header">
            <div class="finding-title">${escapeHtml(finding.title || 'Unknown Finding')}</div>
            <span class="finding-severity severity-${getSeverityClass(finding.severity || 5)}">
                ${finding.severity || 5}/10
            </span>
        </div>
        <div class="finding-details">
            <p><strong>Type:</strong> ${escapeHtml(finding.type || 'Unknown')}</p>
            <p><strong>Description:</strong> ${escapeHtml(finding.description || 'No description available')}</p>
            ${finding.location ? `<p><strong>Location:</strong> <span class="finding-location">${escapeHtml(finding.location)}</span></p>` : ''}
            ${finding.cwe ? `<p><strong>CWE:</strong> ${escapeHtml(finding.cwe)}</p>` : ''}
        </div>
        ${finding.recommendation ? `
        <div class="finding-details">
            <p><strong>Recommendation:</strong> ${escapeHtml(finding.recommendation)}</p>
        </div>` : ''}
    </div>`).join('');

  return `
    <div class="findings-section">
        <h2>🔍 Security Findings (${allFindings.length})</h2>
        ${findingsHTML}
    </div>`;
}

function generateRecommendationsHTML(recommendations) {
  const allRecommendations = [
    ...(recommendations.immediate || []),
    ...(recommendations.shortTerm || []),
    ...(recommendations.longTerm || [])
  ];

  if (allRecommendations.length === 0) {
    return '';
  }

  const recommendationsHTML = allRecommendations.map(rec => `
    <div class="recommendation-item">
        ${escapeHtml(rec)}
    </div>`).join('');

  return `
    <div class="recommendations-section">
        <h2>💡 Recommendations</h2>
        ${recommendationsHTML}
    </div>`;
}

function generateExpertReviewsHTML(reviews) {
  if (!reviews || reviews.length === 0) {
    return '';
  }

  const reviewsHTML = reviews.map(review => `
    <div class="review-item">
        <div class="review-header">
            <div class="reviewer-name">${escapeHtml(review.reviewer || 'Unknown Reviewer')}</div>
            <span class="review-model">${escapeHtml(review.model || 'Unknown Model')}</span>
        </div>
        <div class="finding-details">
            ${review.specialty ? `<p><strong>Specialty:</strong> ${escapeHtml(review.specialty)}</p>` : ''}
            <p><strong>Reviewed Findings:</strong> ${review.reviewedFindings || 0}</p>
            <p><strong>New Findings:</strong> ${review.newFindings?.length || 0}</p>
        </div>
        <div class="finding-details">
            <p><strong>Analysis:</strong></p>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 4px; margin-top: 5px;">
                ${escapeHtml(review.review || 'No review available').replace(/\\n/g, '<br>')}
            </div>
        </div>
    </div>`).join('');

  return `
    <div class="expert-reviews">
        <h2>🧠 Expert Reviews (${reviews.length})</h2>
        ${reviewsHTML}
    </div>`;
}

function getRiskColor(risk) {
  switch (risk?.toLowerCase()) {
    case 'critical': return '#dc3545';
    case 'high': return '#fd7e14';
    case 'medium': return '#ffc107';
    case 'low': return '#28a745';
    default: return '#6c757d';
  }
}

function getSeverityClass(severity) {
  if (severity >= 9) return 'critical';
  if (severity >= 7) return 'high';
  if (severity >= 4) return 'medium';
  return 'low';
}

function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function extractImmediateActions(reviewResults) {
  // Extract immediate/high-priority actions from reviews
  const actions = [];

  if (reviewResults.finalAssessment?.remediationRoadmap) {
    actions.push(...reviewResults.finalAssessment.remediationRoadmap.slice(0, 3));
  }

  return actions;
}

function extractShortTermActions(reviewResults) {
  // Extract short-term actions
  const actions = [];

  if (reviewResults.finalAssessment?.remediationRoadmap) {
    actions.push(...reviewResults.finalAssessment.remediationRoadmap.slice(3, 7));
  }

  return actions;
}

function extractLongTermActions(reviewResults) {
  // Extract long-term actions
  const actions = [];

  if (reviewResults.finalAssessment?.remediationRoadmap) {
    actions.push(...reviewResults.finalAssessment.remediationRoadmap.slice(7));
  }

  return actions;
}

function identifyRelevantStandards(reviewResults) {
  // Identify relevant security standards based on findings
  const standards = ['OWASP Top 10'];

  const findings = reviewResults.originalFindings || [];
  const hasAuth = findings.some(f => f.type?.toLowerCase().includes('auth'));
  const hasCrypto = findings.some(f => f.type?.toLowerCase().includes('crypto'));
  const hasInjection = findings.some(f => f.type?.toLowerCase().includes('injection'));

  if (hasAuth) standards.push('NIST 800-63');
  if (hasCrypto) standards.push('FIPS 140-2');
  if (hasInjection) standards.push('OWASP ASVS');

  return standards;
}

function generateMonitoringAlerts(reviewResults) {
  // Generate monitoring alerts based on findings
  const alerts = [];

  const criticalFindings = (reviewResults.originalFindings || [])
    .filter(f => f.severity >= 8);

  criticalFindings.forEach(finding => {
    alerts.push({
      type: 'security_alert',
      severity: 'high',
      message: `Critical security issue detected: ${finding.title}`,
      component: finding.component,
      recommendation: finding.recommendation
    });
  });

  return alerts;
}

export { generateReport };