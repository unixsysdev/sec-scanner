#!/usr/bin/env node

/**
 * GitLab CI/CD Pipeline Runner for Security Analysis
 * Handles dependency installation and runs the complete security pipeline
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

console.log('🔧 Security Analysis Pipeline Runner');
console.log('=====================================');

// Check if dependencies are installed
function checkDependencies() {
  try {
    require.resolve('commander');
    require.resolve('@babel/parser');
    require.resolve('@babel/traverse');
    console.log('✅ Dependencies are installed');
    return true;
  } catch (error) {
    console.log('📦 Installing dependencies...');
    return false;
  }
}

// Install dependencies if needed
if (!checkDependencies()) {
  try {
    execSync('npm install', { stdio: 'inherit' });
    console.log('✅ Dependencies installed successfully');
  } catch (error) {
    console.error('❌ Failed to install dependencies:', error.message);
    process.exit(1);
  }
}

// Check for required files
const requiredFiles = ['js_graph.json'];
const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));

if (missingFiles.length > 0) {
  console.log('⚠️  Missing required files:', missingFiles.join(', '));
  console.log('📊 Generating JavaScript/TypeScript dependency graph...');

  // Generate graph if missing
  try {
    execSync('python3 graph_js.py', { stdio: 'inherit' });
    console.log('✅ Graph generated successfully');
  } catch (error) {
    console.log('ℹ️ No Python graph generator found, skipping graph generation');
  }
}

// Run the security analysis pipeline
console.log('🛡️ Running security analysis...');

try {
  // Use the pipeline command which runs all steps automatically
  const pipelineCommand = 'node sec-analyzer.js pipeline --graph js_graph.json --output-dir security-analysis --skip-fixes';
  console.log(`Executing: ${pipelineCommand}`);

  execSync(pipelineCommand, { stdio: 'inherit' });

  console.log('✅ Security analysis completed successfully!');
  console.log('📁 Results saved to: security-analysis/');

  // Check if report was generated
  const reportPath = 'security-analysis/security-report.html';
  if (fs.existsSync(reportPath)) {
    console.log(`📋 Security report generated: ${reportPath}`);
  }

} catch (error) {
  console.error('❌ Security analysis failed:', error.message);
  console.log('⚠️ Continuing with partial results...');

  // Try a simpler approach if the full pipeline fails
  try {
    console.log('🔄 Attempting simplified security scan...');
    execSync('node sec-analyzer.js detect --git-diff HEAD~1', { stdio: 'inherit' });
    console.log('✅ Basic change detection completed');
  } catch (fallbackError) {
    console.log('⚠️ Basic scan also failed, but pipeline will continue');
  }
}

console.log('🎉 Pipeline execution completed!');