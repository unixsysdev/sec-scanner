/**
 * AI Client for Chutes API Integration
 * Handles communication with Chutes AI models
 */

import fetch from 'node-fetch';
import fs from 'fs';

const API_URL = 'https://llm.chutes.ai/v1/chat/completions';
const API_KEY = process.env.CHUTES_API_KEY || process.env.CHUTES_API_TOKEN || '';

// Model options with display names
export const MODEL_OPTIONS = {
  'openai/gpt-oss-120b': 'GPT OSS 120B',
  'moonshotai/Kimi-K2-Instruct-75k': 'Kimi K2',
  'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8': 'Qwen3 Coder',
  'Qwen/Qwen3-235B-A22B-Thinking-2507': 'Qwen3 Thinking'
};

export class AIClient {
  constructor(model = 'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8') {
    this.model = model;
    this.conversationHistory = [];
  }

  /**
   * Send a message to the AI model
   */
  async sendMessage(message, options = {}) {
    const {
      temperature = 0.7,
      maxTokens = 4000,
      stream = false,
      systemPrompt = null
    } = options;

    // Build messages array
    const messages = [];

    // Add system prompt if provided
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt
      });
    }

    // Add conversation history
    messages.push(...this.conversationHistory);

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    const requestBody = {
      model: this.model,
      messages: messages,
      temperature: temperature,
      max_tokens: maxTokens,
      stream: stream
    };

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.choices && data.choices.length > 0) {
        const aiResponse = data.choices[0].message.content;

        // Add to conversation history
        this.conversationHistory.push(
          { role: 'user', content: message },
          { role: 'assistant', content: aiResponse }
        );

        return {
          content: aiResponse,
          usage: data.usage,
          model: this.model
        };
      } else {
        throw new Error('No response from AI model');
      }

    } catch (error) {
      console.error(`AI Client Error (${this.model}):`, error.message);
      throw error;
    }
  }

  /**
   * Analyze code for security issues
   */
  async analyzeSecurity(code, context = {}) {
    const systemPrompt = `You are a senior security researcher and code auditor specializing in PHP security. Your task is to analyze code changes for security vulnerabilities, insecure patterns, and potential security risks.

Guidelines:
- Focus on real security issues, not style preferences
- Consider the broader context and data flow
- Identify both direct vulnerabilities and indirect risks
- Provide specific recommendations for fixes
- Rate severity on a scale of 1-10 (10 being critical)
- Be thorough but concise

Respond in JSON format with this structure:
{
  "findings": [
    {
      "type": "vulnerability_type",
      "severity": 1-10,
      "title": "Brief title",
      "description": "Detailed description",
      "location": "file:line or function name",
      "code": "relevant code snippet",
      "recommendation": "How to fix it",
      "cwe": "CWE number if applicable"
    }
  ],
  "summary": {
    "total_findings": number,
    "critical_issues": number,
    "high_risk_issues": number,
    "overall_risk": "Low/Medium/High/Critical"
  },
  "recommendations": ["general recommendations"]
}`;

    const contextInfo = context ? `
Context Information:
- Changed Files: ${context.changedFiles?.join(', ') || 'N/A'}
- Affected Functions: ${context.affectedFunctions?.join(', ') || 'N/A'}
- Dependencies: ${context.dependencies?.join(', ') || 'N/A'}
- Database Interactions: ${context.databaseCalls?.join(', ') || 'N/A'}
- External APIs: ${context.externalAPIs?.join(', ') || 'N/A'}
` : '';

    const message = `Please analyze this PHP code for security vulnerabilities:

${contextInfo}

Code to analyze:
\`\`\`php
${code}
\`\`\`

Please provide a comprehensive security analysis focusing on:
1. Input validation and sanitization
2. SQL injection vulnerabilities
3. XSS (Cross-Site Scripting)
4. CSRF (Cross-Site Request Forgery)
5. Authentication and authorization issues
6. Session management problems
7. File upload and path traversal
8. Command injection
9. Information disclosure
10. Race conditions and timing attacks

Respond with detailed findings and actionable recommendations.`;

    const response = await this.sendMessage(message, {
      systemPrompt,
      temperature: 0.3,
      maxTokens: 6000
    });

    try {
      // Try to parse JSON response
      const parsed = JSON.parse(response.content);
      return {
        ...parsed,
        model: this.model,
        timestamp: new Date().toISOString()
      };
    } catch (parseError) {
      // If JSON parsing fails, return structured response
      return {
        findings: [],
        summary: {
          total_findings: 0,
          critical_issues: 0,
          high_risk_issues: 0,
          overall_risk: "Unknown"
        },
        recommendations: [response.content],
        model: this.model,
        timestamp: new Date().toISOString(),
        raw_response: response.content
      };
    }
  }

  /**
   * Review findings from another model
   */
  async reviewFindings(findings, originalCode, context = {}) {
    const systemPrompt = `You are a senior security auditor reviewing findings from another security analysis. Your role is to:

1. Validate the accuracy of reported vulnerabilities
2. Identify any false positives or missed issues
3. Assess the severity and impact of findings
4. Provide additional context or insights
5. Suggest prioritization and remediation strategies

Be critical and thorough in your review. Focus on:
- Technical accuracy of vulnerability assessments
- Completeness of the analysis
- Realistic impact assessment
- Practical remediation approaches

Respond in JSON format.`;

    const findingsSummary = findings.findings?.map(f =>
      `${f.type}: ${f.title} (Severity: ${f.severity}/10)`
    ).join('\n') || 'No findings reported';

    const message = `Please review these security findings:

Original Code:
\`\`\`php
${originalCode}
\`\`\`

Reported Findings:
${findingsSummary}

Detailed Findings:
${JSON.stringify(findings.findings, null, 2)}

Please provide:
1. Validation of each finding's accuracy
2. Any additional vulnerabilities you identify
3. Assessment of severity and business impact
4. Prioritization recommendations
5. Alternative remediation approaches`;

    const response = await this.sendMessage(message, {
      systemPrompt,
      temperature: 0.2,
      maxTokens: 5000
    });

    return {
      review: response.content,
      reviewer_model: this.model,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Generate security recommendations
   */
  async generateRecommendations(findings, context = {}) {
    const systemPrompt = `You are a security architect providing actionable recommendations for fixing identified vulnerabilities. Focus on:

1. Immediate remediation steps
2. Long-term security improvements
3. Best practices implementation
4. Tool and process recommendations
5. Prevention strategies

Provide specific, actionable advice that development teams can implement.`;

    const criticalFindings = findings.findings?.filter(f => f.severity >= 8) || [];
    const highFindings = findings.findings?.filter(f => f.severity >= 6 && f.severity < 8) || [];

    const message = `Based on this security analysis, provide comprehensive recommendations:

Critical Issues (${criticalFindings.length}):
${criticalFindings.map(f => `- ${f.title}: ${f.recommendation}`).join('\n')}

High Priority Issues (${highFindings.length}):
${highFindings.map(f => `- ${f.title}: ${f.recommendation}`).join('\n')}

Context:
- Project Type: ${context.projectType || 'PHP Application'}
- Framework: ${context.framework || 'Unknown'}
- Database: ${context.database || 'Unknown'}
- Authentication: ${context.auth || 'Unknown'}

Please provide:
1. Immediate action items (next 24-48 hours)
2. Short-term fixes (1-2 weeks)
3. Long-term security improvements (1-3 months)
4. Prevention measures for future development
5. Tool recommendations for ongoing security monitoring`;

    const response = await this.sendMessage(message, {
      systemPrompt,
      temperature: 0.4,
      maxTokens: 4000
    });

    return {
      recommendations: response.content,
      generated_by: this.model,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Clear conversation history
   */
  clearHistory() {
    this.conversationHistory = [];
  }

  /**
   * Switch to a different model
   */
  switchModel(model) {
    if (!MODEL_OPTIONS[model]) {
      throw new Error(`Unknown model: ${model}. Available: ${Object.keys(MODEL_OPTIONS).join(', ')}`);
    }
    this.model = model;
    this.clearHistory();
  }
}

/**
 * Create specialized AI clients for different security domains
 */
export function createSecuritySpecialist(domain) {
  const specialists = {
    'cryptography': new AIClient('Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8'),
    'injection': new AIClient('moonshotai/Kimi-K2-Instruct-75k'),
    'authentication': new AIClient('openai/gpt-oss-120b'),
    'general': new AIClient('Qwen/Qwen3-235B-A22B-Thinking-2507')
  };

  return specialists[domain] || specialists.general;
}

export default AIClient;