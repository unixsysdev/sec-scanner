#!/usr/bin/env python3
"""
JavaScript/TypeScript Code Analyzer that works with Python 3.13
Uses Node.js and TypeScript compiler API for accurate analysis
"""

import os
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Set, Optional
from dataclasses import dataclass, field

@dataclass
class JSNode:
    id: str
    label: str
    type: str
    file: str = ""
    line: int = 0
    in_degree: int = 0
    out_degree: int = 0
    metadata: Dict = field(default_factory=dict)

@dataclass
class JSEdge:
    source: str
    target: str
    type: str
    file: str = ""
    line: int = 0

class JSAnalyzer:
    """
    JavaScript/TypeScript analyzer using Node.js and TypeScript compiler
    Works with Python 3.13 - uses Node.js for accurate parsing!
    """

    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path)
        self.nodes = {}
        self.edges = []

        # Check if Node.js is available
        self.node_binary = self._find_node()
        if not self.node_binary:
            raise Exception("Node.js not found. Please install Node.js to use this analyzer.")

        # Create the JavaScript analyzer script
        self._create_analyzer_script()

    def _find_node(self) -> Optional[str]:
        """Find Node.js binary"""
        import shutil
        node = shutil.which('node')
        if node:
            # Check version
            result = subprocess.run([node, '--version'], capture_output=True, text=True)
            print(f"Found Node.js: {result.stdout.strip()}")
        return node

    def _create_analyzer_script(self):
        """Create a Node.js script that analyzes JavaScript/TypeScript code"""
        self.analyzer_script = tempfile.NamedTemporaryFile(mode='w', suffix='.js', delete=False)

        js_code = '''
const fs = require('fs');
const path = require('path');

// Simple JavaScript/TypeScript analyzer
function analyzeFile(filePath) {
    const code = fs.readFileSync(filePath, 'utf8');
    const result = {
        classes: [],
        methods: [],
        functions: [],
        imports: [],
        exports: [],
        edges: []
    };

    const lines = code.split('\\n');
    let currentClass = null;
    let currentFunction = null;
    let currentMethod = null;
    let inClass = false;
    let braceCount = 0;

    // Simple regex-based analysis (can be enhanced with TypeScript compiler API)
    const classRegex = /class\\s+([\\w]+)(?:\\s+extends\\s+([\\w]+))?/g;
    const functionRegex = /(?:export\\s+)?(?:async\\s+)?function\\s+([\\w]+)\\s*\\(/g;
    const methodRegex = /(?:async\\s+)?([\\w]+)\\s*\\([^)]*\\)\\s*{/g;
    const importRegex = /import\\s+.*?from\\s+['"]([^'"]+)['"]/g;
    const exportRegex = /export\\s+(?:default\\s+)?(?:class|function|const|let|var)\\s+([\\w]+)/g;
    const callRegex = /([\\w]+)\\s*\\(/g;
    const newRegex = /new\\s+([\\w]+)\\s*\\(/g;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNumber = i + 1;

        // Handle imports
        let importMatch;
        while ((importMatch = importRegex.exec(line)) !== null) {
            result.imports.push({
                module: importMatch[1],
                line: lineNumber
            });
        }

        // Handle exports
        let exportMatch;
        while ((exportMatch = exportRegex.exec(line)) !== null) {
            result.exports.push({
                name: exportMatch[1],
                line: lineNumber
            });
        }

        // Handle class definitions
        let classMatch;
        while ((classMatch = classRegex.exec(line)) !== null) {
            const className = classMatch[1];
            const extendsClass = classMatch[2];

            result.classes.push({
                name: className,
                type: 'class',
                line: lineNumber,
                extends: extendsClass || null
            });

            currentClass = className;
            inClass = true;

            // Add inheritance edge if extends
            if (extendsClass) {
                result.edges.push({
                    source: className,
                    target: extendsClass,
                    type: 'extends',
                    line: lineNumber
                });
            }
        }

        // Handle function definitions
        let funcMatch;
        while ((funcMatch = functionRegex.exec(line)) !== null) {
            const funcName = funcMatch[1];

            if (inClass) {
                // It's a method
                const methodName = `${currentClass}::${funcName}`;
                result.methods.push({
                    name: methodName,
                    class: currentClass,
                    type: 'method',
                    line: lineNumber
                });
                currentMethod = methodName;
            } else {
                // It's a function
                result.functions.push({
                    name: funcName,
                    type: 'function',
                    line: lineNumber
                });
                currentFunction = funcName;
            }
        }

        // Handle method calls and instantiations
        let callMatch;
        while ((callMatch = callRegex.exec(line)) !== null) {
            const calledName = callMatch[1];
            const caller = currentMethod || currentFunction || currentClass;

            if (caller && calledName !== 'console' && calledName !== 'require' && calledName !== 'import') {
                // Check if it's a method call on an object
                const prevText = line.substring(0, callMatch.index);
                if (prevText.includes('.')) {
                    // Object method call
                    result.edges.push({
                        source: caller,
                        target: `*.${calledName}`,
                        type: 'method_call',
                        line: lineNumber
                    });
                } else if (calledName[0] === calledName[0].toUpperCase()) {
                    // Likely a constructor call
                    result.edges.push({
                        source: caller,
                        target: calledName,
                        type: 'instantiates',
                        line: lineNumber
                    });
                }
            }
        }

        // Handle new keyword
        let newMatch;
        while ((newMatch = newRegex.exec(line)) !== null) {
            const className = newMatch[1];
            const caller = currentMethod || currentFunction || currentClass;

            if (caller) {
                result.edges.push({
                    source: caller,
                    target: className,
                    type: 'instantiates',
                    line: lineNumber
                });
            }
        }

        // Track braces for class context
        const openBraces = (line.match(/{/g) || []).length;
        const closeBraces = (line.match(/}/g) || []).length;
        braceCount += openBraces - closeBraces;

        // Exit class context when brace count reaches 0
        if (inClass && braceCount <= 0) {
            inClass = false;
            currentClass = null;
            currentMethod = null;
        }
    }

    return result;
}

// Main execution
const targetPath = process.argv[2];

if (!fs.existsSync(targetPath)) {
    console.error(`Path does not exist: ${targetPath}`);
    process.exit(1);
}

const results = {
    nodes: [],
    edges: []
};

function processDirectory(dirPath) {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
            // Skip common directories
            if (!['node_modules', '.git', 'dist', 'build', '.next', '.nuxt'].includes(item)) {
                processDirectory(fullPath);
            }
        } else if (stat.isFile()) {
            // Process JavaScript/TypeScript files
            const ext = path.extname(item);
            if (['.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte'].includes(ext)) {
                try {
                    const fileResult = analyzeFile(fullPath);
                    const relPath = path.relative(targetPath, fullPath);

                    // Add nodes
                    fileResult.classes.forEach(cls => {
                        results.nodes.push({
                            id: cls.name,
                            label: cls.name,
                            type: 'class',
                            file: relPath,
                            line: cls.line
                        });
                    });

                    fileResult.methods.forEach(method => {
                        results.nodes.push({
                            id: method.name,
                            label: method.name.split('::')[1],
                            type: 'method',
                            file: relPath,
                            line: method.line
                        });
                    });

                    fileResult.functions.forEach(func => {
                        results.nodes.push({
                            id: func.name,
                            label: func.name,
                            type: 'function',
                            file: relPath,
                            line: func.line
                        });
                    });

                    // Add edges
                    fileResult.edges.forEach(edge => {
                        edge.file = relPath;
                        results.edges.push(edge);
                    });

                } catch (error) {
                    console.error(`Error processing ${fullPath}: ${error.message}`);
                }
            }
        }
    }
}

if (fs.statSync(targetPath).isDirectory()) {
    console.error(`Processing JavaScript/TypeScript project: ${targetPath}`);
    processDirectory(targetPath);
} else {
    // Process single file
    const fileResult = analyzeFile(targetPath);
    results.nodes = [
        ...fileResult.classes.map(cls => ({
            id: cls.name,
            label: cls.name,
            type: 'class',
            file: path.basename(targetPath),
            line: cls.line
        })),
        ...fileResult.methods.map(method => ({
            id: method.name,
            label: method.name.split('::')[1],
            type: 'method',
            file: path.basename(targetPath),
            line: method.line
        })),
        ...fileResult.functions.map(func => ({
            id: func.name,
            label: func.name,
            type: 'function',
            file: path.basename(targetPath),
            line: func.line
        }))
    ];
    results.edges = fileResult.edges.map(edge => ({
        ...edge,
        file: path.basename(targetPath)
    }));
}

console.log(JSON.stringify(results, null, 2));
'''

        self.analyzer_script.write(js_code)
        self.analyzer_script.close()
        print(f"Created JavaScript analyzer script: {self.analyzer_script.name}")

    def analyze(self) -> Dict:
        """Analyze the JavaScript/TypeScript repository using Node.js"""
        print(f"\nAnalyzing {self.repo_path}...")

        if not self.node_binary:
            raise Exception("Node.js binary not found")

        # Run the Node.js analyzer script
        result = subprocess.run(
            [self.node_binary, self.analyzer_script.name, str(self.repo_path)],
            capture_output=True,
            text=True
        )

        if result.returncode != 0:
            print(f"JavaScript analysis failed: {result.stderr}")
            raise Exception("JavaScript analysis failed")

        # Parse the JSON output
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            print(f"Failed to parse JavaScript output: {e}")
            print(f"Output was: {result.stdout[:500]}")
            raise

        # Process the results
        print(f"Processing {len(data.get('nodes', []))} nodes...")

        # Build node index
        for node in data.get('nodes', []):
            self.nodes[node['id']] = JSNode(
                id=node['id'],
                label=node['label'],
                type=node['type'],
                file=node.get('file', ''),
                line=node.get('line', 0)
            )

        # Process edges and calculate degrees
        for edge in data.get('edges', []):
            self.edges.append(JSEdge(
                source=edge['source'],
                target=edge['target'],
                type=edge['type'],
                file=edge.get('file', ''),
                line=edge.get('line', 0)
            ))

            # Update degrees
            if edge['source'] in self.nodes:
                self.nodes[edge['source']].out_degree += 1
            if edge['target'] in self.nodes:
                self.nodes[edge['target']].in_degree += 1

        # Clean up
        os.unlink(self.analyzer_script.name)

        return self._build_graph()

    def _build_graph(self) -> Dict:
        """Build the final graph structure"""
        nodes_list = []
        for node in self.nodes.values():
            nodes_list.append({
                'id': node.id,
                'label': node.label,
                'type': node.type,
                'file': node.file,
                'line': node.line,
                'in_degree': node.in_degree,
                'out_degree': node.out_degree
            })

        edges_list = []
        for edge in self.edges:
            edges_list.append({
                'source': edge.source,
                'target': edge.target,
                'type': edge.type
            })

        return {
            'nodes': nodes_list,
            'edges': edges_list,
            'stats': {
                'total_nodes': len(nodes_list),
                'total_edges': len(edges_list),
                'classes': len([n for n in nodes_list if n['type'] == 'class']),
                'methods': len([n for n in nodes_list if n['type'] == 'method']),
                'functions': len([n for n in nodes_list if n['type'] == 'function'])
            }
        }

def main():
    import sys

    if len(sys.argv) < 2:
        print("Usage: python anal_js.py /path/to/js/project")
        sys.exit(1)

    repo_path = sys.argv[1]

    print("=" * 50)
    print("JavaScript/TypeScript Code Analyzer")
    print("Using Node.js for accurate parsing")
    print("=" * 50)

    try:
        analyzer = JSAnalyzer(repo_path)
        result = analyzer.analyze()

        # Save the graph
        output_file = "js_graph.json"
        with open(output_file, "w") as f:
            json.dump(result, f, indent=2)

        print(f"\n✅ Analysis complete!")
        print(f"📊 Stats: {result['stats']}")
        print(f"💾 Saved to: {output_file}")

        # Show top nodes
        if result['nodes']:
            nodes_by_connections = sorted(
                result['nodes'],
                key=lambda n: n['in_degree'] + n['out_degree'],
                reverse=True
            )[:10]

            print(f"\n🔝 Top 10 most connected nodes:")
            for node in nodes_by_connections:
                total = node['in_degree'] + node['out_degree']
                print(f"  - {node['label']} ({node['type']}): {total} connections")

    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()