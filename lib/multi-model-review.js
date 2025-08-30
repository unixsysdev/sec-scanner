/**
 * Multi-Model Review Module
 * Coordinates multiple AI models for comprehensive security review
 */

import fs from 'fs';
import { AIClient, createSecuritySpecialist } from './ai-client.js';

export async function review(options) {
  const { scanResults: scanResultsFile, context: contextFile, models, output } = options;

  console.log('🤖 Starting multi-model security review...');

  try {
    // Load scan results and context
    const scanResults = JSON.parse(fs.readFileSync(scanResultsFile, 'utf8'));
    const contextData = JSON.parse(fs.readFileSync(contextFile, 'utf8'));

    // Parse model list
    const modelList = models.split(',').map(m => m.trim());

    console.log(`📋 Coordinating ${modelList.length} AI models for review...`);
    console.log(`🔍 Reviewing ${scanResults.results?.findings?.length || 0} security findings...`);

    // Perform multi-model review
    const reviewResults = await performMultiModelReview(scanResults, contextData, modelList);

    console.log(`✅ Multi-model review completed with ${reviewResults.reviews?.length || 0} expert reviews`);

    return {
      timestamp: new Date().toISOString(),
      models: modelList,
      originalFindings: scanResults.results?.findings || [],
      reviews: reviewResults.reviews,
      consensus: reviewResults.consensus,
      finalAssessment: reviewResults.finalAssessment,
      summary: {
        totalReviews: reviewResults.reviews?.length || 0,
        consensusReached: reviewResults.consensus?.agreement || false,
        escalatedIssues: reviewResults.consensus?.escalatedIssues || 0,
        newFindings: reviewResults.consensus?.newFindings || 0,
        overallRisk: reviewResults.finalAssessment?.overallRisk || 'Unknown'
      }
    };

  } catch (error) {
    console.error('Error during multi-model review:', error.message);
    throw error;
  }
}

async function performMultiModelReview(scanResults, contextData, modelList) {
  const reviews = [];
  const allNewFindings = [];

  // Create specialist models
  const specialists = {
    primary: new AIClient(modelList[0] || 'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8'),
    cryptography: createSecuritySpecialist('cryptography'),
    injection: createSecuritySpecialist('injection'),
    authentication: createSecuritySpecialist('authentication'),
    general: createSecuritySpecialist('general')
  };

  // Step 1: Primary model review
  console.log('🔍 Primary model review...');
  const primaryReview = await performPrimaryReview(scanResults, contextData, specialists.primary);
  reviews.push(primaryReview);

  // Step 2: Specialist reviews based on findings
  const findings = scanResults.results?.findings || [];

  // Cryptography specialist
  const cryptoFindings = findings.filter(f =>
    f.type?.toLowerCase().includes('crypto') ||
    f.type?.toLowerCase().includes('encrypt') ||
    f.title?.toLowerCase().includes('crypt')
  );

  if (cryptoFindings.length > 0) {
    console.log('🔐 Cryptography specialist review...');
    const cryptoReview = await performSpecialistReview(
      cryptoFindings,
      contextData,
      specialists.cryptography,
      'Cryptography'
    );
    reviews.push(cryptoReview);
    allNewFindings.push(...(cryptoReview.newFindings || []));
  }

  // Injection specialist
  const injectionFindings = findings.filter(f =>
    f.type?.toLowerCase().includes('injection') ||
    f.type?.toLowerCase().includes('sql') ||
    f.type?.toLowerCase().includes('xss') ||
    f.title?.toLowerCase().includes('inject')
  );

  if (injectionFindings.length > 0) {
    console.log('💉 Injection specialist review...');
    const injectionReview = await performSpecialistReview(
      injectionFindings,
      contextData,
      specialists.injection,
      'Injection Attacks'
    );
    reviews.push(injectionReview);
    allNewFindings.push(...(injectionReview.newFindings || []));
  }

  // Authentication specialist
  const authFindings = findings.filter(f =>
    f.type?.toLowerCase().includes('auth') ||
    f.type?.toLowerCase().includes('login') ||
    f.type?.toLowerCase().includes('session') ||
    f.title?.toLowerCase().includes('auth')
  );

  if (authFindings.length > 0) {
    console.log('🔒 Authentication specialist review...');
    const authReview = await performSpecialistReview(
      authFindings,
      contextData,
      specialists.authentication,
      'Authentication & Authorization'
    );
    reviews.push(authReview);
    allNewFindings.push(...(authReview.newFindings || []));
  }

  // Step 3: Consensus building
  console.log('⚖️ Building consensus across models...');
  const consensus = await buildConsensus(reviews, findings, allNewFindings);

  // Step 4: Final assessment
  console.log('📊 Generating final assessment...');
  const finalAssessment = await generateFinalAssessment(
    reviews,
    consensus,
    findings,
    allNewFindings,
    specialists.general
  );

  return {
    reviews,
    consensus,
    finalAssessment,
    newFindings: allNewFindings
  };
}

async function performPrimaryReview(scanResults, contextData, aiClient) {
  const systemPrompt = `You are the primary security reviewer conducting a comprehensive analysis of security findings.
Your role is to validate findings, assess overall risk, and identify any missed issues.`;

  const findings = scanResults.results?.findings || [];
  const findingsSummary = findings.map(f =>
    `${f.type}: ${f.title} (Severity: ${f.severity}/10)`
  ).join('\n');

  const message = `Please conduct a comprehensive security review:

ORIGINAL FINDINGS:
${findingsSummary}

CONTEXT:
- Total Components Analyzed: ${contextData.originalChanges?.affectedFunctions?.length || 0}
- Security Hotspots: ${contextData.securityContext?.securityHotspots?.length || 0}
- Attack Vectors: ${contextData.securityContext?.attackVectors?.length || 0}

Please provide:
1. Validation of each finding's accuracy and severity
2. Overall risk assessment
3. Any additional security concerns you identify
4. Recommendations for specialist reviews
5. Prioritization of remediation efforts`;

  const response = await aiClient.sendMessage(message, {
    systemPrompt,
    temperature: 0.2,
    maxTokens: 4000
  });

  return {
    reviewer: 'Primary Security Analyst',
    model: aiClient.model,
    review: response.content,
    timestamp: new Date().toISOString(),
    validatedFindings: findings.length,
    newFindings: []
  };
}

async function performSpecialistReview(findings, contextData, aiClient, specialty) {
  const systemPrompt = `You are a ${specialty} security specialist conducting an expert review.
Focus on your area of expertise and provide detailed technical analysis.`;

  const findingsSummary = findings.map(f =>
    `${f.component}: ${f.title} - ${f.description}`
  ).join('\n\n');

  const message = `${specialty} Specialist Review:

FINDINGS TO REVIEW:
${findingsSummary}

Please provide:
1. Technical validation of each finding
2. Detailed exploitation scenarios
3. Advanced attack techniques specific to ${specialty.toLowerCase()}
4. Recommended security controls and mitigations
5. Any additional vulnerabilities you identify
6. Best practices for ${specialty.toLowerCase()} security`;

  const response = await aiClient.sendMessage(message, {
    systemPrompt,
    temperature: 0.3,
    maxTokens: 3500
  });

  // Extract new findings from specialist review (simplified)
  const newFindings = extractNewFindingsFromReview(response.content, specialty);

  return {
    reviewer: `${specialty} Specialist`,
    model: aiClient.model,
    specialty,
    review: response.content,
    timestamp: new Date().toISOString(),
    reviewedFindings: findings.length,
    newFindings
  };
}

function extractNewFindingsFromReview(reviewText, specialty) {
  // This is a simplified extraction - in practice, you'd use more sophisticated NLP
  const newFindings = [];

  // Look for keywords that indicate new findings
  const indicators = [
    'additional vulnerability',
    'also found',
    'furthermore',
    'another issue',
    'potential risk',
    'security concern'
  ];

  if (indicators.some(indicator => reviewText.toLowerCase().includes(indicator))) {
    newFindings.push({
      type: specialty.toLowerCase().replace(' ', '_'),
      severity: 6, // Medium by default
      title: `Additional ${specialty} Finding`,
      description: 'Identified during specialist review',
      source: 'specialist_review'
    });
  }

  return newFindings;
}

async function buildConsensus(reviews, originalFindings, newFindings) {
  const consensus = {
    agreement: true,
    escalatedIssues: 0,
    newFindings: newFindings.length,
    riskLevels: {},
    recommendations: []
  };

  // Analyze agreement across models
  const riskAssessments = reviews.map(review => extractRiskAssessment(review.review));

  // Count risk level agreements
  const riskCounts = {};
  riskAssessments.forEach(risk => {
    riskCounts[risk] = (riskCounts[risk] || 0) + 1;
  });

  // Find majority risk level
  const majorityRisk = Object.entries(riskCounts)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'Medium';

  consensus.overallRisk = majorityRisk;

  // Check for escalated issues (disagreements)
  const uniqueRisks = Object.keys(riskCounts);
  if (uniqueRisks.length > 1) {
    consensus.agreement = false;
    consensus.escalatedIssues = Math.max(...originalFindings.map(f => f.severity)) + 1;
  }

  // Extract common recommendations
  const allRecommendations = reviews.flatMap(review =>
    extractRecommendations(review.review)
  );

  consensus.recommendations = [...new Set(allRecommendations)].slice(0, 10); // Top 10

  return consensus;
}

function extractRiskAssessment(reviewText) {
  const text = reviewText.toLowerCase();

  if (text.includes('critical') || text.includes('severe')) return 'Critical';
  if (text.includes('high risk') || text.includes('high priority')) return 'High';
  if (text.includes('medium risk') || text.includes('moderate')) return 'Medium';
  if (text.includes('low risk') || text.includes('minimal')) return 'Low';

  return 'Medium'; // Default
}

function extractRecommendations(reviewText) {
  const recommendations = [];

  // Simple extraction based on common patterns
  const lines = reviewText.split('\n');
  lines.forEach(line => {
    if (line.includes('recommend') ||
        line.includes('should') ||
        line.includes('must') ||
        line.includes('implement') ||
        line.startsWith('-') ||
        line.startsWith('•')) {
      recommendations.push(line.trim());
    }
  });

  return recommendations;
}

async function generateFinalAssessment(reviews, consensus, originalFindings, newFindings, aiClient) {
  const systemPrompt = `You are synthesizing multiple expert security reviews into a final assessment.
Provide a comprehensive, actionable security report that considers all perspectives.`;

  const message = `FINAL SECURITY ASSESSMENT SYNTHESIS:

MULTI-MODEL REVIEWS: ${reviews.length}
ORIGINAL FINDINGS: ${originalFindings.length}
NEW FINDINGS: ${newFindings.length}
CONSENSUS RISK: ${consensus.overallRisk}
AGREEMENT LEVEL: ${consensus.agreement ? 'High' : 'Mixed'}

KEY INSIGHTS FROM EXPERTS:
${reviews.map(r => `${r.reviewer}: ${r.review.substring(0, 200)}...`).join('\n\n')}

Please provide:
1. Executive Summary
2. Risk Assessment Matrix
3. Critical Findings & Priorities
4. Remediation Roadmap
5. Compliance & Best Practices
6. Monitoring Recommendations`;

  const response = await aiClient.sendMessage(message, {
    systemPrompt,
    temperature: 0.2,
    maxTokens: 5000
  });

  return {
    overallRisk: consensus.overallRisk,
    executiveSummary: extractExecutiveSummary(response.content),
    riskMatrix: generateRiskMatrix(originalFindings, newFindings),
    criticalFindings: identifyCriticalFindings(originalFindings, newFindings),
    remediationRoadmap: extractRemediationRoadmap(response.content),
    complianceRecommendations: extractComplianceRecommendations(response.content),
    monitoringRecommendations: extractMonitoringRecommendations(response.content),
    fullReport: response.content
  };
}

function extractExecutiveSummary(text) {
  // Extract first paragraph or section as executive summary
  const lines = text.split('\n');
  const summaryLines = [];

  for (const line of lines) {
    if (line.trim() && !line.toLowerCase().includes('please provide')) {
      summaryLines.push(line);
      if (summaryLines.length >= 3) break; // First 3 meaningful lines
    }
  }

  return summaryLines.join(' ').substring(0, 500);
}

function generateRiskMatrix(originalFindings, newFindings) {
  const allFindings = [...originalFindings, ...newFindings];

  return {
    critical: allFindings.filter(f => f.severity >= 9).length,
    high: allFindings.filter(f => f.severity >= 7 && f.severity < 9).length,
    medium: allFindings.filter(f => f.severity >= 4 && f.severity < 7).length,
    low: allFindings.filter(f => f.severity < 4).length,
    total: allFindings.length
  };
}

function identifyCriticalFindings(originalFindings, newFindings) {
  const allFindings = [...originalFindings, ...newFindings];
  return allFindings
    .filter(f => f.severity >= 8)
    .sort((a, b) => b.severity - a.severity)
    .slice(0, 5); // Top 5 critical findings
}

function extractRemediationRoadmap(text) {
  // Extract remediation-related content
  const lines = text.split('\n');
  const roadmap = [];

  let inRoadmap = false;
  for (const line of lines) {
    if (line.toLowerCase().includes('remediat') ||
        line.toLowerCase().includes('fix') ||
        line.toLowerCase().includes('roadmap')) {
      inRoadmap = true;
    }

    if (inRoadmap && (line.startsWith('-') || line.startsWith('•') || line.includes(':'))) {
      roadmap.push(line.trim());
      if (roadmap.length >= 10) break; // Limit to 10 items
    }
  }

  return roadmap;
}

function extractComplianceRecommendations(text) {
  // Extract compliance-related content
  const complianceKeywords = ['compliance', 'regulatory', 'standard', 'policy', 'gdpr', 'owasp', 'pci'];
  const lines = text.split('\n');

  return lines.filter(line =>
    complianceKeywords.some(keyword => line.toLowerCase().includes(keyword))
  ).slice(0, 5);
}

function extractMonitoringRecommendations(text) {
  // Extract monitoring-related content
  const monitoringKeywords = ['monitor', 'log', 'alert', 'detect', 'scan', 'audit'];
  const lines = text.split('\n');

  return lines.filter(line =>
    monitoringKeywords.some(keyword => line.toLowerCase().includes(keyword))
  ).slice(0, 5);
}