/**
 * Context Builder Module
 * Builds comprehensive security analysis context using graph data
 */

import fs from 'fs';

export async function analyze(options) {
  const { changes: changesFile, graph: graphFile, output } = options;

  console.log('🔍 Building security analysis context...');

  try {
    // Load changes data
    const changesData = JSON.parse(fs.readFileSync(changesFile, 'utf8'));

    // Load graph data
    const graphData = JSON.parse(fs.readFileSync(graphFile, 'utf8'));

    console.log(`📊 Analyzing ${changesData.affectedFunctions?.length || 0} functions with graph data...`);

    // Build comprehensive context
    const context = await buildSecurityContext(changesData, graphData);

    console.log(`✅ Context built with ${context.relatedComponents?.length || 0} related components`);

    return {
      timestamp: new Date().toISOString(),
      originalChanges: changesData,
      securityContext: context,
      analysis: {
        affectedFunctions: changesData.affectedFunctions || [],
        affectedClasses: changesData.affectedClasses || [],
        affectedMethods: changesData.affectedMethods || [],
        relatedComponents: context.relatedComponents || [],
        securityHotspots: context.securityHotspots || [],
        dataFlows: context.dataFlows || [],
        externalDependencies: context.externalDependencies || []
      }
    };

  } catch (error) {
    console.error('Error building context:', error.message);
    throw error;
  }
}

async function buildSecurityContext(changesData, graphData) {
  const context = {
    relatedComponents: [],
    securityHotspots: [],
    dataFlows: [],
    externalDependencies: [],
    attackVectors: [],
    privilegeEscalationPaths: []
  };

  // Extract all affected components
  const affectedComponents = [
    ...(changesData.affectedFunctions || []),
    ...(changesData.affectedClasses || []),
    ...(changesData.affectedMethods || [])
  ];

  console.log(`🔗 Finding relationships for ${affectedComponents.length} components...`);

  // Find related components using graph data
  for (const component of affectedComponents) {
    const related = findRelatedComponents(component, graphData);
    context.relatedComponents.push(...related);
  }

  // Remove duplicates
  context.relatedComponents = [...new Set(context.relatedComponents)];

  // Identify security hotspots
  context.securityHotspots = identifySecurityHotspots(context.relatedComponents, graphData);

  // Analyze data flows
  context.dataFlows = analyzeDataFlows(affectedComponents, graphData);

  // Find external dependencies
  context.externalDependencies = findExternalDependencies(affectedComponents, graphData);

  // Identify potential attack vectors
  context.attackVectors = identifyAttackVectors(context.relatedComponents, graphData);

  // Find privilege escalation paths
  context.privilegeEscalationPaths = findPrivilegeEscalationPaths(affectedComponents, graphData);

  return context;
}

function findRelatedComponents(componentId, graphData) {
  const related = new Set();
  const visited = new Set();

  function traverse(component, depth = 0, maxDepth = 3) {
    if (depth > maxDepth || visited.has(component)) return;
    visited.add(component);

    // Find direct connections
    const connections = findDirectConnections(component, graphData);
    connections.forEach(conn => {
      related.add(conn);
      if (depth < maxDepth) {
        traverse(conn, depth + 1, maxDepth);
      }
    });
  }

  traverse(componentId);
  return Array.from(related);
}

function findDirectConnections(componentId, graphData) {
  const connections = new Set();

  // Check edges for direct connections
  if (graphData.edges) {
    graphData.edges.forEach(edge => {
      if (edge.source === componentId) {
        connections.add(edge.target);
      }
      if (edge.target === componentId) {
        connections.add(edge.source);
      }
    });
  }

  // Also check nodes for relationships (if stored in node data)
  if (graphData.nodes) {
    graphData.nodes.forEach(node => {
      if (node.id === componentId && node.connections) {
        // If node has connection data, add those
        node.connections.forEach(conn => connections.add(conn));
      }
    });
  }

  return Array.from(connections);
}

function identifySecurityHotspots(components, graphData) {
  const hotspots = [];

  components.forEach(component => {
    const node = graphData.nodes?.find(n => n.id === component);
    if (!node) return;

    const hotspot = {
      component,
      riskFactors: [],
      connections: node.in_degree + node.out_degree,
      file: node.file,
      type: node.type
    };

    // High connection count
    if (hotspot.connections > 10) {
      hotspot.riskFactors.push('High connectivity - potential attack surface');
    }

    // Database-related functions
    if (component.toLowerCase().includes('sql') ||
        component.toLowerCase().includes('query') ||
        component.toLowerCase().includes('db')) {
      hotspot.riskFactors.push('Database operations - SQL injection risk');
    }

    // Authentication functions
    if (component.toLowerCase().includes('auth') ||
        component.toLowerCase().includes('login') ||
        component.toLowerCase().includes('password')) {
      hotspot.riskFactors.push('Authentication logic - privilege escalation risk');
    }

    // File operations
    if (component.toLowerCase().includes('file') ||
        component.toLowerCase().includes('upload') ||
        component.toLowerCase().includes('download')) {
      hotspot.riskFactors.push('File operations - path traversal risk');
    }

    // External API calls
    if (component.toLowerCase().includes('api') ||
        component.toLowerCase().includes('http') ||
        component.toLowerCase().includes('curl')) {
      hotspot.riskFactors.push('External communications - SSRF risk');
    }

    // Input processing
    if (component.toLowerCase().includes('input') ||
        component.toLowerCase().includes('validate') ||
        component.toLowerCase().includes('sanitize')) {
      hotspot.riskFactors.push('Input processing - injection risk');
    }

    if (hotspot.riskFactors.length > 0) {
      hotspots.push(hotspot);
    }
  });

  return hotspots;
}

function analyzeDataFlows(components, graphData) {
  const dataFlows = [];

  components.forEach(component => {
    const flows = traceDataFlow(component, graphData);
    dataFlows.push(...flows);
  });

  return dataFlows;
}

function traceDataFlow(componentId, graphData, visited = new Set(), depth = 0, maxDepth = 5) {
  if (depth > maxDepth || visited.has(componentId)) return [];

  visited.add(componentId);
  const flows = [];

  // Find data flow patterns
  const connections = findDirectConnections(componentId, graphData);

  connections.forEach(target => {
    const edge = graphData.edges?.find(e =>
      (e.source === componentId && e.target === target) ||
      (e.source === target && e.target === componentId)
    );

    if (edge) {
      flows.push({
        from: componentId,
        to: target,
        type: edge.type,
        weight: edge.weight || 1,
        depth: depth
      });

      // Continue tracing
      if (depth < maxDepth) {
        flows.push(...traceDataFlow(target, graphData, new Set(visited), depth + 1, maxDepth));
      }
    }
  });

  return flows;
}

function findExternalDependencies(components, graphData) {
  const dependencies = [];

  components.forEach(component => {
    const node = graphData.nodes?.find(n => n.id === component);
    if (!node) return;

    // Look for external library usage patterns
    const externalPatterns = [
      'composer', 'npm', 'pip', 'maven',
      'vendor', 'node_modules', 'lib', 'library'
    ];

    if (node.file && externalPatterns.some(pattern => node.file.includes(pattern))) {
      dependencies.push({
        component,
        type: 'external_library',
        file: node.file,
        risk: 'Supply chain attack potential'
      });
    }

    // Check for external API calls
    if (component.toLowerCase().includes('api') ||
        component.toLowerCase().includes('http') ||
        component.toLowerCase().includes('curl') ||
        component.toLowerCase().includes('request')) {
      dependencies.push({
        component,
        type: 'external_api',
        risk: 'SSRF or data exfiltration risk'
      });
    }
  });

  return dependencies;
}

function identifyAttackVectors(components, graphData) {
  const vectors = [];

  components.forEach(component => {
    const node = graphData.nodes?.find(n => n.id === component);
    if (!node) return;

    // User input processing
    if (component.toLowerCase().includes('input') ||
        component.toLowerCase().includes('post') ||
        component.toLowerCase().includes('get') ||
        component.toLowerCase().includes('request')) {
      vectors.push({
        component,
        type: 'user_input',
        risk: 'Injection attacks',
        severity: 'High'
      });
    }

    // Authentication bypass
    if (component.toLowerCase().includes('auth') ||
        component.toLowerCase().includes('login') ||
        component.toLowerCase().includes('session')) {
      vectors.push({
        component,
        type: 'authentication',
        risk: 'Unauthorized access',
        severity: 'Critical'
      });
    }

    // File system access
    if (component.toLowerCase().includes('file') ||
        component.toLowerCase().includes('upload') ||
        component.toLowerCase().includes('include') ||
        component.toLowerCase().includes('require')) {
      vectors.push({
        component,
        type: 'file_system',
        risk: 'Path traversal, LFI/RFI',
        severity: 'High'
      });
    }

    // Database operations
    if (component.toLowerCase().includes('sql') ||
        component.toLowerCase().includes('query') ||
        component.toLowerCase().includes('database')) {
      vectors.push({
        component,
        type: 'database',
        risk: 'SQL injection',
        severity: 'High'
      });
    }
  });

  return vectors;
}

function findPrivilegeEscalationPaths(components, graphData) {
  const paths = [];

  // Look for patterns that could lead to privilege escalation
  components.forEach(component => {
    if (component.toLowerCase().includes('admin') ||
        component.toLowerCase().includes('sudo') ||
        component.toLowerCase().includes('root') ||
        component.toLowerCase().includes('permission') ||
        component.toLowerCase().includes('role')) {

      const connections = findDirectConnections(component, graphData);
      paths.push({
        component,
        connections,
        risk: 'Potential privilege escalation path',
        severity: 'High'
      });
    }
  });

  return paths;
}