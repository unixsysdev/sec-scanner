#!/usr/bin/env node

/**
 * Security Analysis CLI Tool
 * Comprehensive security analysis pipeline for code changes
 */

import { Command } from 'commander';
import { detect } from './lib/change-detector.js';
import { analyze } from './lib/context-builder.js';
import { scan } from './lib/security-scanner.js';
import { review } from './lib/multi-model-review.js';
import { generateReport } from './lib/report-generator.js';
import { fix } from './lib/auto-fix-engine.js';
import { init } from './lib/init.js';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .name('sec-analyzer')
  .description('Security Analysis CLI for code changes')
  .version('1.0.0');

// Initialize configuration
program
  .command('init')
  .description('Initialize security analysis configuration')
  .action(async () => {
    await init();
  });

// Detect changes
program
  .command('detect')
  .description('Detect code changes and affected components')
  .option('-g, --git-diff <commit>', 'Git commit/diff to analyze')
  .option('-f, --files <files>', 'Specific files to analyze')
  .option('-o, --output <file>', 'Output file for detected changes', 'changes.json')
  .action(async (options) => {
    try {
      const changes = await detect(options);
      fs.writeFileSync(options.output, JSON.stringify(changes, null, 2));
      console.log(`✅ Changes detected and saved to ${options.output}`);
    } catch (error) {
      console.error('❌ Error detecting changes:', error.message);
      process.exit(1);
    }
  });

// Analyze context
program
  .command('analyze')
  .description('Build security analysis context from changes')
  .requiredOption('-c, --changes <file>', 'Changes file from detect command')
  .requiredOption('-g, --graph <file>', 'Graph data file (php_graph.json)')
  .option('-o, --output <file>', 'Output file for analysis context', 'context.json')
  .action(async (options) => {
    try {
      const context = await analyze(options);
      fs.writeFileSync(options.output, JSON.stringify(context, null, 2));
      console.log(`✅ Security context built and saved to ${options.output}`);
    } catch (error) {
      console.error('❌ Error building context:', error.message);
      process.exit(1);
    }
  });

// Security scan
program
  .command('scan')
  .description('Perform initial security analysis')
  .requiredOption('-c, --context <file>', 'Context file from analyze command')
  .option('-m, --model <model>', 'AI model to use', 'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8')
  .option('-o, --output <file>', 'Output file for scan results', 'scan-results.json')
  .action(async (options) => {
    try {
      const results = await scan(options);
      fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
      console.log(`✅ Security scan completed and saved to ${options.output}`);
    } catch (error) {
      console.error('❌ Error during security scan:', error.message);
      process.exit(1);
    }
  });

// Multi-model review
program
  .command('review')
  .description('Perform multi-model security review')
  .requiredOption('-s, --scan-results <file>', 'Scan results from scan command')
  .option('-c, --context <file>', 'Original context file')
  .option('-m, --models <models>', 'Comma-separated list of models to use', 'moonshotai/Kimi-K2-Instruct-75k,openai/gpt-oss-120b,Qwen/Qwen3-235B-A22B-Thinking-2507')
  .option('-o, --output <file>', 'Output file for review results', 'review-results.json')
  .action(async (options) => {
    try {
      const results = await review(options);
      fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
      console.log(`✅ Multi-model review completed and saved to ${options.output}`);
    } catch (error) {
      console.error('❌ Error during review:', error.message);
      process.exit(1);
    }
  });

// Generate report
program
  .command('report')
  .description('Generate comprehensive security report')
  .requiredOption('-r, --review-results <file>', 'Review results from review command')
  .option('-c, --context <file>', 'Original context file')
  .option('-f, --format <format>', 'Report format (html,pdf,json)', 'html')
  .option('-o, --output <file>', 'Output file for report', 'security-report')
  .action(async (options) => {
    try {
      await generateReport(options);
      console.log(`✅ Security report generated: ${options.output}`);
    } catch (error) {
      console.error('❌ Error generating report:', error.message);
      process.exit(1);
    }
  });

// Auto-fix engine
program
  .command('fix')
  .description('Apply automated security fixes')
  .requiredOption('-r, --report <file>', 'Security report file')
  .option('-a, --apply-safe', 'Apply only safe automated fixes', false)
  .option('-d, --dry-run', 'Show fixes without applying them', false)
  .option('-o, --output <file>', 'Output file for fix summary', 'fixes-applied.json')
  .action(async (options) => {
    try {
      console.log('🤖 AI-Powered Auto-Fix Engine Starting...');
      console.log(`📄 Report: ${options.report}`);
      console.log(`🛡️  Safe fixes only: ${options.applySafe ? 'Yes' : 'No'}`);
      console.log(`🔍 Dry run: ${options.dryRun ? 'Yes' : 'No'}`);

      const results = await fix(options);

      // Show detailed results
      console.log('\n📊 Fix Results Summary:');
      console.log(`   🔧 Automated fixes: ${results.summary?.safeFixes || 0} safe, ${results.summary?.riskyFixes || 0} risky`);
      console.log(`   📝 Manual fixes needed: ${results.summary?.manualRequired || 0}`);
      console.log(`   💾 Files modified: ${results.summary?.appliedCount || 0}`);

      if (results.appliedFixes?.length > 0) {
        console.log('\n✅ Applied Fixes:');
        results.appliedFixes.forEach((fix, index) => {
          console.log(`   ${index + 1}. ${fix.title || 'Unknown fix'}`);
          if (fix.details) {
            fix.details.forEach(detail => {
              if (detail.success) {
                console.log(`      ✅ ${detail.file} (${detail.changes} changes)`);
              } else {
                console.log(`      ❌ ${detail.file}: ${detail.error}`);
              }
            });
          }
        });
      }

      fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
      console.log(`\n💾 Detailed results saved to ${options.output}`);

    } catch (error) {
      console.error('❌ Error applying fixes:', error.message);
      process.exit(1);
    }
  });

// Pipeline command (runs all steps)
program
  .command('pipeline')
  .description('Run complete security analysis pipeline')
  .option('-g, --git-diff <commit>', 'Git commit/diff to analyze')
  .option('-f, --files <files>', 'Specific files to analyze')
  .requiredOption('-G, --graph <file>', 'Graph data file (php_graph.json)')
  .option('-m, --model <model>', 'Primary AI model', 'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8')
  .option('-M, --review-models <models>', 'Review models', 'moonshotai/Kimi-K2-Instruct-75k,openai/gpt-oss-120b,Qwen/Qwen3-235B-A22B-Thinking-2507')
  .option('-o, --output-dir <dir>', 'Output directory', 'security-analysis')
  .option('--skip-fixes', 'Skip automated fixes', false)
  .action(async (options) => {
    try {
      console.log('🚀 Starting complete security analysis pipeline...\n');

      // Create output directory
      if (!fs.existsSync(options.outputDir)) {
        fs.mkdirSync(options.outputDir, { recursive: true });
      }

      // Step 1: Detect changes
      console.log('📋 Step 1: Detecting changes...');
      const detectOptions = {
        gitDiff: options.gitDiff,
        files: options.files,
        output: path.join(options.outputDir, 'changes.json')
      };
      const changes = await detect(detectOptions);
      fs.writeFileSync(detectOptions.output, JSON.stringify(changes, null, 2));
      console.log('✅ Changes detected\n');

      // Step 2: Analyze context
      console.log('🔍 Step 2: Building security context...');
      const analyzeOptions = {
        changes: detectOptions.output,
        graph: options.graph,
        output: path.join(options.outputDir, 'context.json')
      };
      const context = await analyze(analyzeOptions);
      fs.writeFileSync(analyzeOptions.output, JSON.stringify(context, null, 2));
      console.log('✅ Security context built\n');

      // Step 3: Security scan
      console.log('🔎 Step 3: Performing security scan...');
      const scanOptions = {
        context: analyzeOptions.output,
        model: options.model,
        output: path.join(options.outputDir, 'scan-results.json')
      };
      const scanResults = await scan(scanOptions);
      fs.writeFileSync(scanOptions.output, JSON.stringify(scanResults, null, 2));
      console.log('✅ Security scan completed\n');

      // Step 4: Multi-model review
      console.log('🤖 Step 4: Multi-model security review...');
      const reviewOptions = {
        scanResults: scanOptions.output,
        context: analyzeOptions.output,
        models: options.reviewModels,
        output: path.join(options.outputDir, 'review-results.json')
      };
      const reviewResults = await review(reviewOptions);
      fs.writeFileSync(reviewOptions.output, JSON.stringify(reviewResults, null, 2));
      console.log('✅ Multi-model review completed\n');

      // Step 5: Generate report
      console.log('📊 Step 5: Generating security report...');
      const reportOptions = {
        reviewResults: reviewOptions.output,
        context: analyzeOptions.output,
        format: 'html',
        output: path.join(options.outputDir, 'security-report')
      };
      await generateReport(reportOptions);
      console.log('✅ Security report generated\n');

      // Step 6: Apply fixes (optional)
      if (!options.skipFixes) {
        console.log('🔧 Step 6: Applying automated fixes...');
        const fixOptions = {
          report: path.join(options.outputDir, 'security-report.json'),
          applySafe: true,
          dryRun: false,
          output: path.join(options.outputDir, 'fixes-applied.json')
        };
        const fixResults = await fix(fixOptions);
        fs.writeFileSync(fixOptions.output, JSON.stringify(fixResults, null, 2));
        console.log('✅ Automated fixes applied\n');
      }

      console.log('🎉 Security analysis pipeline completed successfully!');
      console.log(`📁 Results saved to: ${options.outputDir}`);
      console.log(`📋 Summary:`);
      console.log(`   - Changes detected: ${changes.affectedFiles?.length || 0} files`);
      console.log(`   - Security issues found: ${scanResults.findings?.length || 0}`);
      console.log(`   - Fixes applied: ${options.skipFixes ? 'Skipped' : 'Applied'}`);

    } catch (error) {
      console.error('❌ Pipeline failed:', error.message);
      process.exit(1);
    }
  });

// Parse arguments
program.parse();