/**
 * Security Scanner Module
 * Performs initial security analysis using AI models
 */

import fs from 'fs';
import { AIClient } from './ai-client.js';

export async function scan(options) {
  const { context: contextFile, model, output } = options;

  console.log('🔎 Performing security scan...');

  try {
    // Load context data
    const contextData = JSON.parse(fs.readFileSync(contextFile, 'utf8'));

    // Initialize AI client
    const aiClient = new AIClient(model);

    console.log(`🤖 Using model: ${model}`);
    console.log(`📊 Analyzing ${contextData.originalChanges?.affectedFunctions?.length || 0} affected functions...`);

    // Perform security analysis
    const analysisResults = await performSecurityAnalysis(contextData, aiClient);

    console.log(`✅ Security scan completed with ${analysisResults.findings?.length || 0} findings`);

    return {
      timestamp: new Date().toISOString(),
      model: model,
      context: contextData,
      results: analysisResults,
      summary: {
        totalFindings: analysisResults.findings?.length || 0,
        criticalIssues: analysisResults.findings?.filter(f => f.severity >= 9).length || 0,
        highRiskIssues: analysisResults.findings?.filter(f => f.severity >= 7).length || 0,
        mediumRiskIssues: analysisResults.findings?.filter(f => f.severity >= 4 && f.severity < 7).length || 0,
        lowRiskIssues: analysisResults.findings?.filter(f => f.severity < 4).length || 0,
        overallRisk: calculateOverallRisk(analysisResults.findings || [])
      }
    };

  } catch (error) {
    console.error('Error during security scan:', error.message);
    throw error;
  }
}

async function performSecurityAnalysis(contextData, aiClient) {
  const allFindings = [];
  const allRecommendations = [];

  // Analyze each affected component
  const components = [
    ...(contextData.originalChanges?.affectedFunctions || []),
    ...(contextData.originalChanges?.affectedClasses || []),
    ...(contextData.originalChanges?.affectedMethods || [])
  ];

  console.log(`🔍 Analyzing ${components.length} components...`);

  for (const component of components) {
    try {
      console.log(`   Analyzing: ${component}`);

      // Get component code (this would need to be enhanced to actually read the code)
      const codeSnippet = await getComponentCode(component, contextData);

      // Build context for this component
      const componentContext = buildComponentContext(component, contextData);

      // Analyze with AI
      const analysis = await aiClient.analyzeSecurity(codeSnippet, componentContext);

      if (analysis.findings) {
        // Add component info to each finding
        analysis.findings.forEach(finding => {
          finding.component = component;
          finding.affectedFile = componentContext.file;
        });

        allFindings.push(...analysis.findings);
      }

      if (analysis.recommendations) {
        allRecommendations.push(...analysis.recommendations);
      }

    } catch (error) {
      console.warn(`Warning: Failed to analyze ${component}:`, error.message);
    }
  }

  // Analyze security hotspots
  if (contextData.securityContext?.securityHotspots) {
    console.log(`🎯 Analyzing ${contextData.securityContext.securityHotspots.length} security hotspots...`);

    for (const hotspot of contextData.securityContext.securityHotspots) {
      try {
        const hotspotAnalysis = await analyzeSecurityHotspot(hotspot, aiClient);
        if (hotspotAnalysis.findings) {
          allFindings.push(...hotspotAnalysis.findings);
        }
      } catch (error) {
        console.warn(`Warning: Failed to analyze hotspot ${hotspot.component}:`, error.message);
      }
    }
  }

  // Analyze attack vectors
  if (contextData.securityContext?.attackVectors) {
    console.log(`⚔️ Analyzing ${contextData.securityContext.attackVectors.length} attack vectors...`);

    for (const vector of contextData.securityContext.attackVectors) {
      try {
        const vectorAnalysis = await analyzeAttackVector(vector, aiClient);
        if (vectorAnalysis.findings) {
          allFindings.push(...vectorAnalysis.findings);
        }
      } catch (error) {
        console.warn(`Warning: Failed to analyze attack vector ${vector.component}:`, error.message);
      }
    }
  }

  return {
    findings: allFindings,
    recommendations: [...new Set(allRecommendations)],
    summary: {
      totalFindings: allFindings.length,
      criticalIssues: allFindings.filter(f => f.severity >= 9).length,
      highRiskIssues: allFindings.filter(f => f.severity >= 7).length,
      mediumRiskIssues: allFindings.filter(f => f.severity >= 4 && f.severity < 7).length,
      lowRiskIssues: allFindings.filter(f => f.severity < 4).length,
      overallRisk: calculateOverallRisk(allFindings)
    }
  };
}

async function getComponentCode(component, contextData) {
  try {
    // Extract file path from component
    const filePath = extractFileFromComponent(component, contextData);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️  Source file not found: ${filePath} for component: ${component}`);
      return `// Component: ${component}
// File not found: ${filePath}
// Unable to read source code for security analysis.`;
    }

    // Read the entire file
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Extract specific component code based on type
    if (component.includes('::')) {
      // PHP method: ClassName::methodName
      return extractPHPMethod(fileContent, component, filePath);
    } else if (component.includes('.')) {
      // Python method: ClassName.methodName or JavaScript method
      const fileExt = filePath.split('.').pop().toLowerCase();
      if (fileExt === 'py') {
        return extractPythonMethod(fileContent, component, filePath);
      } else if (['js', 'ts', 'jsx', 'tsx'].includes(fileExt)) {
        return extractJSMethod(fileContent, component, filePath);
      }
    }

    // Function or class
    const fileExt = filePath.split('.').pop().toLowerCase();
    if (fileExt === 'php') {
      return extractPHPFunction(fileContent, component, filePath);
    } else if (fileExt === 'py') {
      return extractPythonFunction(fileContent, component, filePath);
    } else if (['js', 'ts', 'jsx', 'tsx'].includes(fileExt)) {
      return extractJSFunction(fileContent, component, filePath);
    }

    // Fallback: return a portion of the file around the component
    return extractCodeSnippet(fileContent, component, filePath);

  } catch (error) {
    console.error(`❌ Error reading component code for ${component}:`, error.message);
    return `// Component: ${component}
// Error reading source code: ${error.message}
// Unable to perform security analysis.`;
  }
}

function buildComponentContext(component, contextData) {
  return {
    component,
    changedFiles: contextData.originalChanges?.changedFiles || [],
    affectedFunctions: contextData.originalChanges?.affectedFunctions || [],
    relatedComponents: contextData.securityContext?.relatedComponents || [],
    securityHotspots: contextData.securityContext?.securityHotspots || [],
    dataFlows: contextData.securityContext?.dataFlows || [],
    externalDependencies: contextData.securityContext?.externalDependencies || [],
    attackVectors: contextData.securityContext?.attackVectors || [],
    file: extractFileFromComponent(component, contextData)
  };
}

function extractFileFromComponent(component, contextData) {
  // Try to find the file for this component from the graph data
  if (contextData.securityContext?.graphData?.nodes) {
    const node = contextData.securityContext.graphData.nodes.find(n => n.id === component);
    if (node && node.file) {
      return node.file;
    }
  }

  // Try to find in changed files
  if (contextData.originalChanges?.changedFiles) {
    for (const changedFile of contextData.originalChanges.changedFiles) {
      try {
        if (fs.existsSync(changedFile)) {
          const content = fs.readFileSync(changedFile, 'utf8');
          if (content.includes(component)) {
            return changedFile;
          }
        }
      } catch (error) {
        // Continue to next file
      }
    }
  }

  // Fallback: try to infer from component name
  if (component.includes('::')) {
    // PHP method: ClassName::methodName
    const className = component.split('::')[0];
    // Try common PHP file locations
    const possiblePaths = [
      `${className}.php`,
      `src/${className}.php`,
      `app/${className}.php`,
      `lib/${className}.php`,
      `classes/${className}.php`,
      `models/${className}.php`,
      `controllers/${className}.php`
    ];

    for (const path of possiblePaths) {
      if (fs.existsSync(path)) {
        return path;
      }
    }
  } else if (component.includes('.')) {
    // Python method: ClassName.methodName or JavaScript method
    const className = component.split('.')[0];
    const possiblePaths = [
      `${className}.py`,
      `${className}.js`,
      `src/${className}.py`,
      `src/${className}.js`,
      `lib/${className}.py`,
      `lib/${className}.js`
    ];

    for (const path of possiblePaths) {
      if (fs.existsSync(path)) {
        return path;
      }
    }
  }

  // Function name - try to find in common locations
  const functionName = component.replace(/[^a-zA-Z0-9_]/g, '');
  const possiblePaths = [
    `${functionName}.php`,
    `${functionName}.py`,
    `${functionName}.js`,
    `src/${functionName}.php`,
    `src/${functionName}.py`,
    `src/${functionName}.js`,
    `functions.php`,
    `utils.php`,
    `helpers.php`
  ];

  for (const path of possiblePaths) {
    if (fs.existsSync(path)) {
      return path;
    }
  }

  // Last resort
  return `src/${component.replace(/[^a-zA-Z0-9_]/g, '')}.php`;
}

// PHP code extraction functions
function extractPHPMethod(fileContent, component, filePath) {
  const [className, methodName] = component.split('::');

  // Find the class
  const classRegex = new RegExp(`class\\s+${className}\\b[^]*?\\{([\\s\\S]*?)\\}`, 's');
  const classMatch = fileContent.match(classRegex);

  if (!classMatch) {
    return `// PHP Method: ${component}
// Class ${className} not found in ${filePath}
// File content preview:
// ${fileContent.substring(0, 500)}...`;
  }

  const classContent = classMatch[1];

  // Find the method within the class
  const methodRegex = new RegExp(`(?:public|private|protected)?\\s*function\\s+${methodName}\\s*\\([^)]*\\)\\s*(?:\\{[\\s\\S]*?\\}|;)`, 's');
  const methodMatch = classContent.match(methodRegex);

  if (methodMatch) {
    return `// PHP Method: ${component}
// File: ${filePath}
// Class: ${className}

class ${className} {
${methodMatch[0]}
}`;
  }

  return `// PHP Method: ${component}
// Method ${methodName} not found in class ${className}
// Class content preview:
// ${classContent.substring(0, 500)}...`;
}

function extractPHPFunction(fileContent, component, filePath) {
  // Try to find function definition
  const functionRegex = new RegExp(`function\\s+${component}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\}`, 's');
  const functionMatch = fileContent.match(functionRegex);

  if (functionMatch) {
    return `// PHP Function: ${component}
// File: ${filePath}

${functionMatch[0]}`;
  }

  // Try to find class
  const classRegex = new RegExp(`class\\s+${component}\\b[^]*?\\{[\\s\\S]*?\\}`, 's');
  const classMatch = fileContent.match(classRegex);

  if (classMatch) {
    return `// PHP Class: ${component}
// File: ${filePath}

${classMatch[0]}`;
  }

  return `// PHP Component: ${component}
// Component not found with standard patterns
// File content preview:
// ${fileContent.substring(0, 500)}...`;
}

// Python code extraction functions
function extractPythonMethod(fileContent, component, filePath) {
  const [className, methodName] = component.split('.');

  // Find the class
  const classRegex = new RegExp(`class\\s+${className}\\b[^:]*:\\s*([\\s\\S]*?)(?=\\nclass\\s|\\n@|\\n\\n\\n|\\n\\Z)`, 's');
  const classMatch = fileContent.match(classRegex);

  if (!classMatch) {
    return `// Python Method: ${component}
// Class ${className} not found in ${filePath}
// File content preview:
// ${fileContent.substring(0, 500)}...`;
  }

  const classContent = classMatch[1];

  // Find the method within the class
  const methodRegex = new RegExp(`\\s+def\\s+${methodName}\\s*\\([^)]*\\):\\s*([\\s\\S]*?)(?=\\n\\s+def\\s|\\n\\s+@|\\n\\n\\n|\\n\\Z)`, 's');
  const methodMatch = classContent.match(methodRegex);

  if (methodMatch) {
    return `// Python Method: ${component}
// File: ${filePath}
// Class: ${className}

class ${className}:
${methodMatch[0]}`;
  }

  return `// Python Method: ${component}
// Method ${methodName} not found in class ${className}
// Class content preview:
// ${classContent.substring(0, 500)}...`;
}

function extractPythonFunction(fileContent, component, filePath) {
  // Try to find function definition
  const functionRegex = new RegExp(`def\\s+${component}\\s*\\([^)]*\\):\\s*([\\s\\S]*?)(?=\\n\\s+def\\s|\\n\\s+@|\\n\\n\\n|\\n\\Z)`, 's');
  const functionMatch = fileContent.match(functionRegex);

  if (functionMatch) {
    return `// Python Function: ${component}
// File: ${filePath}

${functionMatch[0]}`;
  }

  // Try to find class
  const classRegex = new RegExp(`class\\s+${component}\\b[^:]*:\\s*([\\s\\S]*?)(?=\\nclass\\s|\\n@|\\n\\n\\n|\\n\\Z)`, 's');
  const classMatch = fileContent.match(classRegex);

  if (classMatch) {
    return `// Python Class: ${component}
// File: ${filePath}

${classMatch[0]}`;
  }

  return `// Python Component: ${component}
// Component not found with standard patterns
// File content preview:
// ${fileContent.substring(0, 500)}...`;
}

// JavaScript code extraction functions
function extractJSMethod(fileContent, component, filePath) {
  const [className, methodName] = component.split('.');

  // Find the class (ES6 class or constructor function)
  const classRegex = new RegExp(`class\\s+${className}\\b[^]*?\\{[\\s\\S]*?\\}`, 's');
  const classMatch = fileContent.match(classRegex);

  if (classMatch) {
    const classContent = classMatch[1];

    // Find the method within the class
    const methodRegex = new RegExp(`${methodName}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\}`, 's');
    const methodMatch = classContent.match(methodRegex);

    if (methodMatch) {
      return `// JavaScript Method: ${component}
// File: ${filePath}
// Class: ${className}

class ${className} {
  ${methodMatch[0]}
}`;
    }
  }

  // Try constructor function pattern
  const constructorRegex = new RegExp(`function\\s+${className}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\}`, 's');
  const constructorMatch = fileContent.match(constructorRegex);

  if (constructorMatch) {
    const constructorContent = constructorMatch[1];

    // Find method on prototype
    const prototypeRegex = new RegExp(`${className}\\.prototype\\.${methodName}\\s*=\\s*function\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\}`, 's');
    const prototypeMatch = constructorContent.match(prototypeRegex);

    if (prototypeMatch) {
      return `// JavaScript Method: ${component}
// File: ${filePath}
// Constructor: ${className}

function ${className} {
  // Constructor content...
}

${className}.prototype.${methodName} = ${prototypeMatch[1]};
    }
  }

  return `// JavaScript Method: ${component}
// Method ${methodName} not found in class ${className}
// File content preview:
// ${fileContent.substring(0, 500)}...`;
}

function extractJSFunction(fileContent, component, filePath) {
  // Try to find function definition
  const functionRegex = new RegExp(`function\\s+${component}\\s*\\([^)]*\\)\\s*\\{[\\s\\S]*?\\}`, 's');
  const functionMatch = fileContent.match(functionRegex);

  if (functionMatch) {
    return `// JavaScript Function: ${component}
// File: ${filePath}

${functionMatch[0]}`;
  }

  // Try arrow function
  const arrowRegex = new RegExp(`(?:const|let|var)\\s+${component}\\s*=\\s*\\([^)]*\\)\\s*=>\\s*\\{[\\s\\S]*?\\}`, 's');
  const arrowMatch = fileContent.match(arrowRegex);

  if (arrowMatch) {
    return `// JavaScript Arrow Function: ${component}
// File: ${filePath}

${arrowMatch[0]}`;
  }

  // Try class
  const classRegex = new RegExp(`class\\s+${component}\\b[^]*?\\{[\\s\\S]*?\\}`, 's');
  const classMatch = fileContent.match(classRegex);

  if (classMatch) {
    return `// JavaScript Class: ${component}
// File: ${filePath}

${classMatch[0]}`;
  }

  return `// JavaScript Component: ${component}
// Component not found with standard patterns
// File content preview:
// ${fileContent.substring(0, 500)}...`;
}

// Generic code snippet extraction
function extractCodeSnippet(fileContent, component, filePath) {
  // Find lines containing the component
  const lines = fileContent.split('\n');
  const componentLines = [];

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(component)) {
      // Get context around the line (5 lines before and after)
      const start = Math.max(0, i - 5);
      const end = Math.min(lines.length, i + 6);
      componentLines.push(...lines.slice(start, end));
      break; // Only get first occurrence for now
    }
  }

  if (componentLines.length > 0) {
    return `// Code snippet for: ${component}
// File: ${filePath}
// Lines around component:

${componentLines.join('\n')}`;
  }

  return `// Component: ${component}
// File: ${filePath}
// Component not found in file content
// File size: ${fileContent.length} characters
// First 500 characters:
// ${fileContent.substring(0, 500)}...`;
}

async function analyzeSecurityHotspot(hotspot, aiClient) {
  const systemPrompt = `You are analyzing a security hotspot - a component with multiple risk factors.
Focus on the interconnected nature of the risks and potential attack chains.`;

  const message = `Analyze this security hotspot:

Component: ${hotspot.component}
File: ${hotspot.file}
Type: ${hotspot.type}
Connections: ${hotspot.connections}
Risk Factors: ${hotspot.riskFactors.join(', ')}

Please identify:
1. How these risk factors interact
2. Potential attack chains
3. Most critical vulnerabilities
4. Recommended security controls`;

  const response = await aiClient.sendMessage(message, {
    systemPrompt,
    temperature: 0.3,
    maxTokens: 3000
  });

  return {
    findings: [{
      type: 'security_hotspot',
      severity: 8,
      title: `Security Hotspot: ${hotspot.component}`,
      description: `Component with multiple risk factors: ${hotspot.riskFactors.join(', ')}`,
      location: hotspot.file,
      code: hotspot.component,
      recommendation: response.content,
      cwe: 'CWE-710' // Improper Adherence to Coding Standards
    }]
  };
}

async function analyzeAttackVector(vector, aiClient) {
  const systemPrompt = `You are analyzing a potential attack vector in the codebase.
Focus on the specific attack type and how it could be exploited.`;

  const message = `Analyze this attack vector:

Component: ${vector.component}
Attack Type: ${vector.type}
Risk: ${vector.risk}
Severity: ${vector.severity}

Please provide:
1. Detailed exploitation scenario
2. Potential impact
3. Specific mitigation steps
4. Code examples for secure implementation`;

  const response = await aiClient.sendMessage(message, {
    systemPrompt,
    temperature: 0.3,
    maxTokens: 2500
  });

  const severityMap = {
    'Critical': 10,
    'High': 8,
    'Medium': 6,
    'Low': 3
  };

  return {
    findings: [{
      type: vector.type,
      severity: severityMap[vector.severity] || 5,
      title: `${vector.type} Attack Vector: ${vector.component}`,
      description: vector.risk,
      location: vector.component,
      code: vector.component,
      recommendation: response.content,
      cwe: getCWEMapping(vector.type)
    }]
  };
}

function getCWEMapping(attackType) {
  const cweMap = {
    'user_input': 'CWE-20', // Improper Input Validation
    'authentication': 'CWE-287', // Improper Authentication
    'file_system': 'CWE-22', // Improper Limitation of a Pathname to a Restricted Directory
    'database': 'CWE-89', // SQL Injection
    'external_api': 'CWE-918', // Server-Side Request Forgery (SSRF)
    'session': 'CWE-613', // Insufficient Session Expiration
    'cryptography': 'CWE-327', // Use of a Broken or Risky Cryptographic Algorithm
    'authorization': 'CWE-285', // Improper Authorization
    'configuration': 'CWE-2', // 7PK - Environment
    'logging': 'CWE-532', // Information Exposure Through Log Files
    'error_handling': 'CWE-209', // Information Exposure Through an Error Message
    'race_condition': 'CWE-362', // Concurrent Execution using Shared Resource with Improper Synchronization
    'denial_of_service': 'CWE-400', // Uncontrolled Resource Consumption
    'injection': 'CWE-74', // Improper Neutralization of Special Elements in Output Used by a Downstream Component
    'xss': 'CWE-79', // Cross-site Scripting
    'csrf': 'CWE-352', // Cross-Site Request Forgery
    'xxe': 'CWE-611', // Improper Restriction of XML External Entity Reference
    'deserialization': 'CWE-502', // Deserialization of Untrusted Data
    'command_injection': 'CWE-78', // Improper Neutralization of Special Elements used in an OS Command
    'path_traversal': 'CWE-22', // Improper Limitation of a Pathname to a Restricted Directory
    'ssrf': 'CWE-918', // Server-Side Request Forgery (SSRF)
    'ssti': 'CWE-1336', // Improper Neutralization of Special Elements used in a Template Engine
    'idor': 'CWE-639', // Authorization Bypass Through User-Controlled Key
    'mass_assignment': 'CWE-915', // Improperly Controlled Modification of Dynamically-Determined Object Attributes
    'security_hotspot': 'CWE-710' // Improper Adherence to Coding Standards
  };

  return cweMap[attackType] || 'CWE-710';
}

function calculateOverallRisk(findings) {
  if (!findings || findings.length === 0) {
    return 'Low';
  }

  const criticalCount = findings.filter(f => f.severity >= 9).length;
  const highCount = findings.filter(f => f.severity >= 7).length;
  const totalCount = findings.length;

  if (criticalCount > 0 || highCount > 3) {
    return 'Critical';
  } else if (highCount > 0 || totalCount > 10) {
    return 'High';
  } else if (totalCount > 5) {
    return 'Medium';
  } else {
    return 'Low';
  }
}