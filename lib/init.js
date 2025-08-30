/**
 * Initialization Module
 * Sets up configuration and dependencies for the security analysis CLI
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function init() {
  console.log('🚀 Initializing Security Analysis CLI...\n');

  try {
    // Create configuration directory
    const configDir = path.join(process.cwd(), '.sec-analyzer');
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
      console.log('✅ Created configuration directory: .sec-analyzer');
    }

    // Create default configuration
    const configPath = path.join(configDir, 'config.json');
    if (!fs.existsSync(configPath)) {
      const defaultConfig = {
        version: '1.0.0',
        ai: {
          provider: 'chutes',
          apiKey: process.env.CHUTES_API_KEY || '',
          models: {
            primary: 'Qwen/Qwen3-Coder-480B-A35B-Instruct-FP8',
            review: [
              'moonshotai/Kimi-K2-Instruct-75k',
              'openai/gpt-oss-120b',
              'Qwen/Qwen3-235B-A22B-Thinking-2507'
            ]
          },
          temperature: {
            analysis: 0.3,
            review: 0.2,
            generation: 0.4
          }
        },
        analysis: {
          maxFileSize: '10MB',
          supportedLanguages: ['php', 'javascript', 'python', 'java', 'cpp'],
          excludePatterns: [
            'node_modules/**',
            'vendor/**',
            '.git/**',
            'dist/**',
            'build/**',
            '*.min.js',
            '*.min.css'
          ]
        },
        reporting: {
          formats: ['html', 'json', 'pdf'],
          includeCodeSnippets: true,
          includeRecommendations: true,
          riskThresholds: {
            critical: 9,
            high: 7,
            medium: 4,
            low: 0
          }
        },
        automation: {
          safeFixesOnly: true,
          backupFiles: true,
          dryRun: false,
          maxConcurrentFixes: 5
        }
      };

      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
      console.log('✅ Created default configuration file');
    }

    // Create .gitignore for analysis artifacts
    const gitignorePath = path.join(process.cwd(), '.sec-analyzer', '.gitignore');
    if (!fs.existsSync(gitignorePath)) {
      const gitignoreContent = `# Security Analysis CLI artifacts
*.log
temp/
cache/
reports/raw/
backups/
`;
      fs.writeFileSync(gitignorePath, gitignoreContent);
      console.log('✅ Created .gitignore for analysis artifacts');
    }

    // Create directories for analysis artifacts
    const dirs = [
      'reports',
      'backups',
      'cache',
      'temp'
    ];

    dirs.forEach(dir => {
      const dirPath = path.join(configDir, dir);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    });
    console.log('✅ Created analysis artifact directories');

    // Check for required dependencies
    await checkDependencies();

    // Validate AI configuration
    await validateAIConfig();

    console.log('\n🎉 Security Analysis CLI initialized successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Set your CHUTES_API_KEY environment variable');
    console.log('2. Run: sec-analyzer detect --git-diff HEAD~1');
    console.log('3. Run: sec-analyzer pipeline --graph php_graph.json');
    console.log('\n📖 For help: sec-analyzer --help');

  } catch (error) {
    console.error('❌ Initialization failed:', error.message);
    process.exit(1);
  }
}

async function checkDependencies() {
  console.log('\n🔍 Checking dependencies...');

  const requiredDeps = [
    'node-fetch',
    '@babel/parser',
    '@babel/traverse'
  ];

  const missingDeps = [];

  // Check if dependencies are available
  for (const dep of requiredDeps) {
    try {
      await import(dep);
    } catch (error) {
      missingDeps.push(dep);
    }
  }

  if (missingDeps.length > 0) {
    console.log('⚠️  Missing dependencies detected:');
    missingDeps.forEach(dep => console.log(`   - ${dep}`));

    console.log('\n📦 Install missing dependencies:');
    console.log(`   npm install ${missingDeps.join(' ')}`);

    // Try to install them automatically
    console.log('\n🔧 Attempting automatic installation...');
    try {
      const { execSync } = await import('child_process');
      execSync(`npm install ${missingDeps.join(' ')}`, { stdio: 'inherit' });
      console.log('✅ Dependencies installed successfully');
    } catch (installError) {
      console.log('❌ Automatic installation failed. Please install manually.');
    }
  } else {
    console.log('✅ All dependencies are available');
  }
}

async function validateAIConfig() {
  console.log('\n🤖 Validating AI configuration...');

  const apiKey = process.env.CHUTES_API_KEY || process.env.CHUTES_API_TOKEN;

  if (!apiKey) {
    console.log('⚠️  No Chutes AI API key found');
    console.log('   Set environment variable: CHUTES_API_KEY or CHUTES_API_TOKEN');
    console.log('   Get your key from: https://chutes.ai');
  } else {
    // Test API connection
    try {
      const { AIClient } = await import('./ai-client.js');
      const client = new AIClient();

      console.log('🔗 Testing API connection...');
      const testResponse = await client.sendMessage('Hello, this is a test message for API validation.', {
        temperature: 0.1,
        maxTokens: 50
      });

      if (testResponse.content) {
        console.log('✅ AI API connection successful');
      }
    } catch (error) {
      console.log('❌ AI API connection failed:', error.message);
      console.log('   Please check your API key and network connection');
    }
  }
}

export { init };