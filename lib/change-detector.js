/**
 * Change Detection Module
 * Analyzes git diffs and extracts affected code components
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { parse } from '@babel/parser';
import { traverse } from '@babel/traverse';

export async function detect(options) {
  const { gitDiff, files, output } = options;

  console.log('🔍 Detecting code changes...');

  let changedFiles = [];
  let affectedFunctions = [];
  let affectedClasses = [];
  let affectedMethods = [];

  try {
    if (gitDiff) {
      // Analyze git diff
      changedFiles = await analyzeGitDiff(gitDiff);
    } else if (files) {
      // Analyze specific files
      changedFiles = files.split(',').map(f => f.trim());
    } else {
      // Analyze current working directory changes
      changedFiles = await analyzeWorkingDirectory();
    }

    console.log(`📁 Found ${changedFiles.length} changed files`);

    // Analyze each changed file
    for (const filePath of changedFiles) {
      if (fs.existsSync(filePath)) {
        const analysis = await analyzeFile(filePath);
        affectedFunctions.push(...analysis.functions);
        affectedClasses.push(...analysis.classes);
        affectedMethods.push(...analysis.methods);
      }
    }

    console.log(`🔧 Extracted ${affectedFunctions.length} functions, ${affectedClasses.length} classes, ${affectedMethods.length} methods`);

    return {
      timestamp: new Date().toISOString(),
      changedFiles,
      affectedFunctions: [...new Set(affectedFunctions)],
      affectedClasses: [...new Set(affectedClasses)],
      affectedMethods: [...new Set(affectedMethods)],
      analysis: {
        totalFiles: changedFiles.length,
        totalFunctions: affectedFunctions.length,
        totalClasses: affectedClasses.length,
        totalMethods: affectedMethods.length
      }
    };

  } catch (error) {
    console.error('Error in change detection:', error.message);
    throw error;
  }
}

async function analyzeGitDiff(commitRef) {
  try {
    // Get list of changed files
    const gitCommand = `git diff --name-only ${commitRef}`;
    const changedFilesOutput = execSync(gitCommand, { encoding: 'utf8' });

    // Get detailed diff
    const diffCommand = `git diff ${commitRef}`;
    const diffOutput = execSync(diffCommand, { encoding: 'utf8' });

    const files = changedFilesOutput.trim().split('\n').filter(f => f && isCodeFile(f));

    console.log(`📋 Git diff analysis for ${commitRef}:`);
    console.log(`   Changed files: ${files.length}`);

    return files;
  } catch (error) {
    console.error('Error analyzing git diff:', error.message);
    // Fallback to analyzing working directory
    return await analyzeWorkingDirectory();
  }
}

async function analyzeWorkingDirectory() {
  try {
    // Get git status
    const statusCommand = 'git status --porcelain';
    const statusOutput = execSync(statusCommand, { encoding: 'utf8' });

    const files = statusOutput.trim().split('\n')
      .map(line => line.substring(3).trim())
      .filter(f => f && isCodeFile(f));

    console.log(`📋 Working directory analysis:`);
    console.log(`   Modified files: ${files.length}`);

    return files;
  } catch (error) {
    console.error('Error analyzing working directory:', error.message);
    // Fallback to manual file discovery
    return await discoverFiles();
  }
}

async function discoverFiles() {
  const extensions = ['.php', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.cs'];
  const files = [];

  function scanDirectory(dir) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules' && item !== 'vendor') {
        scanDirectory(fullPath);
      } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
        files.push(fullPath);
      }
    }
  }

  scanDirectory('.');
  console.log(`📋 File discovery: Found ${files.length} code files`);
  return files;
}

function isCodeFile(filename) {
  const codeExtensions = ['.php', '.js', '.ts', '.py', '.java', '.cpp', '.c', '.cs', '.rb', '.go'];
  return codeExtensions.some(ext => filename.endsWith(ext));
}

async function analyzeFile(filePath) {
  const functions = [];
  const classes = [];
  const methods = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const extension = path.extname(filePath).toLowerCase();

    if (extension === '.php') {
      const analysis = analyzePHPFile(content);
      functions.push(...analysis.functions);
      classes.push(...analysis.classes);
      methods.push(...analysis.methods);
    } else if (['.js', '.ts'].includes(extension)) {
      const analysis = analyzeJSFile(content);
      functions.push(...analysis.functions);
      classes.push(...analysis.classes);
      methods.push(...analysis.methods);
    } else if (extension === '.py') {
      const analysis = analyzePythonFile(content);
      functions.push(...analysis.functions);
      classes.push(...analysis.classes);
      methods.push(...analysis.methods);
    }

  } catch (error) {
    console.warn(`Warning: Could not analyze ${filePath}:`, error.message);
  }

  return { functions, classes, methods };
}

function analyzePHPFile(content) {
  const functions = [];
  const classes = [];
  const methods = [];

  // Extract classes
  const classRegex = /class\s+(\w+)/g;
  let classMatch;
  while ((classMatch = classRegex.exec(content)) !== null) {
    classes.push(classMatch[1]);
  }

  // Extract functions
  const functionRegex = /function\s+(\w+)\s*\(/g;
  let functionMatch;
  while ((functionMatch = functionRegex.exec(content)) !== null) {
    // Check if it's a method (inside a class) or standalone function
    const beforeMatch = content.substring(0, functionMatch.index);
    const lastClassIndex = beforeMatch.lastIndexOf('class ');

    if (lastClassIndex !== -1) {
      // Find the class name
      const classMatch = beforeMatch.substring(lastClassIndex).match(/class\s+(\w+)/);
      if (classMatch) {
        methods.push(`${classMatch[1]}::${functionMatch[1]}`);
      }
    } else {
      functions.push(functionMatch[1]);
    }
  }

  return { functions, classes, methods };
}

function analyzeJSFile(content) {
  const functions = [];
  const classes = [];
  const methods = [];

  try {
    const ast = parse(content, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript']
    });

    traverse(ast, {
      ClassDeclaration(path) {
        if (path.node.id) {
          classes.push(path.node.id.name);
        }
      },
      FunctionDeclaration(path) {
        if (path.node.id) {
          functions.push(path.node.id.name);
        }
      },
      MethodDefinition(path) {
        if (path.node.key.name) {
          // Find parent class
          let parent = path.parent;
          while (parent && parent.type !== 'ClassDeclaration') {
            parent = parent.parent;
          }
          if (parent && parent.id) {
            methods.push(`${parent.id.name}::${path.node.key.name}`);
          } else {
            functions.push(path.node.key.name);
          }
        }
      },
      ArrowFunctionExpression(path) {
        // Handle arrow functions assigned to variables
        if (path.parent.type === 'VariableDeclarator' && path.parent.id.name) {
          functions.push(path.parent.id.name);
        }
      }
    });
  } catch (error) {
    // Fallback to regex-based analysis
    console.warn('AST parsing failed, using regex fallback');

    const classRegex = /class\s+(\w+)/g;
    let classMatch;
    while ((classMatch = classRegex.exec(content)) !== null) {
      classes.push(classMatch[1]);
    }

    const functionRegex = /function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*\(|let\s+(\w+)\s*=\s*\(/g;
    let functionMatch;
    while ((functionMatch = functionRegex.exec(content)) !== null) {
      const funcName = functionMatch[1] || functionMatch[2] || functionMatch[3];
      if (funcName) {
        functions.push(funcName);
      }
    }
  }

  return { functions, classes, methods };
}

function analyzePythonFile(content) {
  const functions = [];
  const classes = [];
  const methods = [];

  // Extract classes
  const classRegex = /class\s+(\w+)/g;
  let classMatch;
  while ((classMatch = classRegex.exec(content)) !== null) {
    classes.push(classMatch[1]);
  }

  // Extract functions
  const functionRegex = /def\s+(\w+)\s*\(/g;
  let functionMatch;
  while ((functionMatch = functionRegex.exec(content)) !== null) {
    // Check if it's a method (indented under a class)
    const beforeMatch = content.substring(0, functionMatch.index);
    const lines = beforeMatch.split('\n');
    let indentLevel = 0;
    let isMethod = false;

    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('class ')) {
        isMethod = true;
        const classMatch = line.match(/class\s+(\w+)/);
        if (classMatch) {
          methods.push(`${classMatch[1]}.${functionMatch[1]}`);
        }
        break;
      }
      if (line && !line.startsWith(' ') && !line.startsWith('\t')) {
        break;
      }
    }

    if (!isMethod) {
      functions.push(functionMatch[1]);
    }
  }

  return { functions, classes, methods };
}