#!/usr/bin/env python3
"""
PHP Code Analyzer that works with Python 3.13
Uses php-parser CLI tool directly - no Python tree-sitter needed
"""

import os
import json
import subprocess
import tempfile
from pathlib import Path
from typing import Dict, List, Set, Optional
from dataclasses import dataclass, field

@dataclass
class PHPNode:
    id: str
    label: str
    type: str
    file: str = ""
    line: int = 0
    in_degree: int = 0
    out_degree: int = 0
    metadata: Dict = field(default_factory=dict)

@dataclass
class PHPEdge:
    source: str
    target: str
    type: str
    file: str = ""
    line: int = 0

class PHPAnalyzer:
    """
    PHP analyzer using PHP's own tokenizer/parser
    Works with Python 3.13 - no tree-sitter needed!
    """
    
    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path)
        self.nodes = {}
        self.edges = []
        
        # Check if PHP is available
        self.php_binary = self._find_php()
        if not self.php_binary:
            raise Exception("PHP not found. Please install PHP to use this analyzer.")
        
        # Create the PHP parser script
        self._create_parser_script()
    
    def _find_php(self) -> Optional[str]:
        """Find PHP binary"""
        import shutil
        php = shutil.which('php')
        if php:
            # Check version
            result = subprocess.run([php, '--version'], capture_output=True, text=True)
            print(f"Found PHP: {result.stdout.split('\n')[0]}")
        return php
    
    def _create_parser_script(self):
        """Create a PHP script that analyzes code using PHP's built-in functions"""
        self.parser_script = tempfile.NamedTemporaryFile(mode='w', suffix='.php', delete=False)
        
        php_code = '''<?php
// PHP AST Analyzer using built-in PHP tokenizer
// Works without any external dependencies

function analyzeFile($filePath) {
    $code = file_get_contents($filePath);
    if ($code === false) return null;
    
    $result = [
        'classes' => [],
        'methods' => [],
        'functions' => [],
        'edges' => []
    ];
    
    // Use PHP's built-in tokenizer
    $tokens = token_get_all($code);
    
    $namespace = '';
    $currentClass = null;
    $currentMethod = null;
    $currentFunction = null;
    $useStatements = [];
    
    for ($i = 0; $i < count($tokens); $i++) {
        if (!is_array($tokens[$i])) continue;
        
        list($token, $text, $line) = $tokens[$i];
        
        // Handle namespace
        if ($token === T_NAMESPACE) {
            $namespace = '';
            $j = $i + 1;
            while ($j < count($tokens) && $tokens[$j][0] !== ';') {
                if (is_array($tokens[$j]) && $tokens[$j][0] === T_STRING) {
                    $namespace .= $tokens[$j][1];
                } elseif (is_array($tokens[$j]) && $tokens[$j][0] === T_NS_SEPARATOR) {
                    $namespace .= '\\\\';
                }
                $j++;
            }
        }
        
        // Handle use statements
        if ($token === T_USE) {
            $useClass = '';
            $j = $i + 1;
            while ($j < count($tokens) && $tokens[$j] !== ';') {
                if (is_array($tokens[$j]) && in_array($tokens[$j][0], [T_STRING, T_NS_SEPARATOR])) {
                    $useClass .= $tokens[$j][1];
                }
                $j++;
            }
            if ($useClass) {
                $parts = explode('\\\\', $useClass);
                $alias = end($parts);
                $useStatements[$alias] = $useClass;
            }
        }
        
        // Handle class definitions
        if ($token === T_CLASS) {
            $j = $i + 1;
            while ($j < count($tokens) && is_array($tokens[$j])) {
                if ($tokens[$j][0] === T_STRING) {
                    $className = $tokens[$j][1];
                    $fullName = $namespace ? $namespace . '\\\\' . $className : $className;
                    $currentClass = $fullName;
                    
                    $classInfo = [
                        'name' => $fullName,
                        'type' => 'class',
                        'line' => $line
                    ];
                    
                    // Check for extends
                    $k = $j + 1;
                    while ($k < count($tokens) && $tokens[$k] !== '{') {
                        if (is_array($tokens[$k]) && $tokens[$k][0] === T_EXTENDS) {
                            $k++;
                            while ($k < count($tokens) && is_array($tokens[$k])) {
                                if ($tokens[$k][0] === T_STRING) {
                                    $classInfo['extends'] = $tokens[$k][1];
                                    
                                    // Add inheritance edge
                                    $result['edges'][] = [
                                        'source' => $fullName,
                                        'target' => $tokens[$k][1],
                                        'type' => 'extends',
                                        'line' => $line
                                    ];
                                    break;
                                }
                                $k++;
                            }
                        }
                        $k++;
                    }
                    
                    $result['classes'][] = $classInfo;
                    break;
                }
                $j++;
            }
        }
        
        // Handle function/method definitions
        if ($token === T_FUNCTION) {
            $j = $i + 1;
            while ($j < count($tokens) && is_array($tokens[$j])) {
                if ($tokens[$j][0] === T_STRING) {
                    $funcName = $tokens[$j][1];
                    
                    if ($currentClass) {
                        // It's a method
                        $fullName = $currentClass . '::' . $funcName;
                        $currentMethod = $fullName;
                        
                        $result['methods'][] = [
                            'name' => $fullName,
                            'class' => $currentClass,
                            'type' => 'method',
                            'line' => $line
                        ];
                    } else {
                        // It's a function
                        $fullName = $namespace ? $namespace . '\\\\' . $funcName : $funcName;
                        $currentFunction = $fullName;
                        
                        $result['functions'][] = [
                            'name' => $fullName,
                            'type' => 'function',
                            'line' => $line
                        ];
                    }
                    break;
                }
                $j++;
            }
        }
        
        // Handle new statements (instantiation)
        if ($token === T_NEW) {
            $j = $i + 1;
            while ($j < count($tokens) && is_array($tokens[$j])) {
                if ($tokens[$j][0] === T_STRING) {
                    $className = $tokens[$j][1];
                    $caller = $currentMethod ?: $currentFunction ?: $currentClass;
                    
                    if ($caller) {
                        $result['edges'][] = [
                            'source' => $caller,
                            'target' => $className,
                            'type' => 'instantiates',
                            'line' => $line
                        ];
                    }
                    break;
                }
                $j++;
            }
        }
        
        // Handle static method calls (::)
        if ($token === T_DOUBLE_COLON) {
            // Look back for class name
            $className = null;
            $j = $i - 1;
            if ($j >= 0 && is_array($tokens[$j]) && $tokens[$j][0] === T_STRING) {
                $className = $tokens[$j][1];
            }
            
            // Look forward for method name
            $methodName = null;
            $j = $i + 1;
            if ($j < count($tokens) && is_array($tokens[$j]) && $tokens[$j][0] === T_STRING) {
                $methodName = $tokens[$j][1];
            }
            
            if ($className && $methodName) {
                $caller = $currentMethod ?: $currentFunction ?: $currentClass;
                if ($caller) {
                    $result['edges'][] = [
                        'source' => $caller,
                        'target' => $className . '::' . $methodName,
                        'type' => 'static_call',
                        'line' => $line
                    ];
                }
            }
        }
        
        // Handle object method calls (->)
        if ($token === T_OBJECT_OPERATOR) {
            // Look forward for method name
            $j = $i + 1;
            if ($j < count($tokens) && is_array($tokens[$j]) && $tokens[$j][0] === T_STRING) {
                $methodName = $tokens[$j][1];
                $caller = $currentMethod ?: $currentFunction ?: $currentClass;
                
                if ($caller) {
                    // We don't know the object type, so use wildcard
                    $result['edges'][] = [
                        'source' => $caller,
                        'target' => '*::' . $methodName,
                        'type' => 'method_call',
                        'line' => $line
                    ];
                }
            }
        }
        
        // Reset context when leaving class
        if ($tokens[$i] === '}' && $currentClass) {
            // Simple heuristic: if we're at a closing brace and have a current class
            // This isn't perfect but works for most cases
            $braceCount = 0;
            for ($j = $i - 1; $j >= 0; $j--) {
                if ($tokens[$j] === '{') $braceCount++;
                if ($tokens[$j] === '}') $braceCount--;
                if ($braceCount > 0) break;
            }
            if ($braceCount === 0) {
                $currentClass = null;
                $currentMethod = null;
            }
        }
    }
    
    return $result;
}

// Main execution
$filePath = $argv[1];

if (is_dir($filePath)) {
    // Process directory
    $results = [
        'nodes' => [],
        'edges' => []
    ];
    
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($filePath)
    );
    
    $phpFiles = [];
    foreach ($files as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $path = $file->getPathname();
            // Skip vendor directory
            if (strpos($path, '/vendor/') === false && 
                strpos($path, '/node_modules/') === false) {
                $phpFiles[] = $path;
            }
        }
    }
    
    error_log("Found " . count($phpFiles) . " PHP files");
    
    foreach ($phpFiles as $idx => $phpFile) {
        if ($idx % 100 === 0) {
            error_log("Processing file " . ($idx + 1) . "/" . count($phpFiles));
        }
        
        $fileResult = analyzeFile($phpFile);
        if ($fileResult) {
            $relPath = str_replace($filePath . '/', '', $phpFile);
            
            // Add nodes
            foreach ($fileResult['classes'] as $class) {
                $results['nodes'][] = [
                    'id' => $class['name'],
                    'label' => basename($class['name']),
                    'type' => 'class',
                    'file' => $relPath,
                    'line' => $class['line'] ?? 0
                ];
            }
            
            foreach ($fileResult['methods'] as $method) {
                $results['nodes'][] = [
                    'id' => $method['name'],
                    'label' => explode('::', $method['name'])[1] ?? $method['name'],
                    'type' => 'method',
                    'file' => $relPath,
                    'line' => $method['line'] ?? 0
                ];
            }
            
            foreach ($fileResult['functions'] as $func) {
                $results['nodes'][] = [
                    'id' => $func['name'],
                    'label' => basename($func['name']),
                    'type' => 'function',
                    'file' => $relPath,
                    'line' => $func['line'] ?? 0
                ];
            }
            
            // Add edges
            foreach ($fileResult['edges'] as $edge) {
                $edge['file'] = $relPath;
                $results['edges'][] = $edge;
            }
        }
    }
    
    echo json_encode($results, JSON_PRETTY_PRINT);
    
} else {
    // Process single file
    $result = analyzeFile($filePath);
    echo json_encode($result, JSON_PRETTY_PRINT);
}
'''
        
        self.parser_script.write(php_code)
        self.parser_script.close()
        print(f"Created PHP parser script: {self.parser_script.name}")
    
    def analyze(self) -> Dict:
        """Analyze the PHP repository using PHP's tokenizer"""
        print(f"\nAnalyzing {self.repo_path}...")
        
        # Run the PHP parser script
        result = subprocess.run(
            [self.php_binary, self.parser_script.name, str(self.repo_path)],
            capture_output=True,
            text=True
        )
        
        if result.returncode != 0:
            print(f"PHP analysis failed: {result.stderr}")
            raise Exception("PHP analysis failed")
        
        # Parse the JSON output
        try:
            data = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            print(f"Failed to parse PHP output: {e}")
            print(f"Output was: {result.stdout[:500]}")
            raise
        
        # Process the results
        print(f"Processing {len(data.get('nodes', []))} nodes...")
        
        # Build node index
        for node in data.get('nodes', []):
            self.nodes[node['id']] = PHPNode(
                id=node['id'],
                label=node['label'],
                type=node['type'],
                file=node.get('file', ''),
                line=node.get('line', 0)
            )
        
        # Process edges and calculate degrees
        for edge in data.get('edges', []):
            self.edges.append(PHPEdge(
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
        os.unlink(self.parser_script.name)
        
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
        print("Usage: python analyzer.py /path/to/php/project")
        sys.exit(1)
    
    repo_path = sys.argv[1]
    
    print("=" * 50)
    print("PHP Code Analyzer (Python 3.13 compatible)")
    print("Using PHP's built-in tokenizer")
    print("=" * 50)
    
    try:
        analyzer = PHPAnalyzer(repo_path)
        result = analyzer.analyze()
        
        # Save the graph
        output_file = "php_graph.json"
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
