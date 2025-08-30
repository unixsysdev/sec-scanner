#!/usr/bin/env node

/**
 * 🔧 AI Auto-Fix Engine Demo
 * Demonstrates how the AI generates specific file modification commands
 */

import fs from 'fs';
import { AIClient } from './lib/ai-client.js';

async function demoAIFix() {
  console.log('🤖 AI Auto-Fix Engine Demo');
  console.log('==========================\n');

  // Create a sample vulnerable PHP file
  const vulnerableCode = `<?php
// Vulnerable PHP code with SQL injection
class UserManager {
    private $db;

    public function __construct($db) {
        $this->db = $db;
    }

    // VULNERABLE: SQL Injection
    public function getUserById($userId) {
        $query = "SELECT * FROM users WHERE id = " . $userId;
        $result = mysqli_query($this->db, $query);
        return mysqli_fetch_assoc($result);
    }

    // VULNERABLE: XSS
    public function displayUserName($name) {
        echo "<div>Welcome " . $name . "</div>";
    }

    // VULNERABLE: Weak password check
    public function authenticate($password) {
        return md5($password) === $this->storedHash;
    }
}
?>`;

  // Save the vulnerable file
  fs.writeFileSync('demo-vulnerable.php', vulnerableCode);
  console.log('📝 Created demo vulnerable file: demo-vulnerable.php\n');

  // Initialize AI client
  const aiClient = new AIClient();

  // Demo 1: SQL Injection Fix
  console.log('🔧 Demo 1: SQL Injection Fix');
  console.log('-----------------------------');

  const sqlInjectionPrompt = `Fix this SQL injection vulnerability in PHP:

VULNERABLE CODE:
$query = "SELECT * FROM users WHERE id = " . $userId;
$result = mysqli_query($this->db, $query);

Provide the exact search and replace strings to fix this. Return JSON format:
{
  "commands": [
    {
      "type": "search_replace",
      "description": "Fix SQL injection with prepared statement",
      "search": "exact string to find",
      "replace": "exact replacement string"
    }
  ]
}`;

  try {
    const sqlResponse = await aiClient.sendMessage(sqlInjectionPrompt, {
      temperature: 0.1,
      maxTokens: 1000
    });

    console.log('🤖 AI Generated Fix:');
    console.log(sqlResponse.content);
    console.log('');

  } catch (error) {
    console.log('❌ AI call failed:', error.message);
  }

  // Demo 2: XSS Fix
  console.log('🔧 Demo 2: XSS Fix');
  console.log('------------------');

  const xssPrompt = `Fix this XSS vulnerability in PHP:

VULNERABLE CODE:
echo "<div>Welcome " . $name . "</div>";

Provide the exact search and replace strings to fix this. Return JSON format.`;

  try {
    const xssResponse = await aiClient.sendMessage(xssPrompt, {
      temperature: 0.1,
      maxTokens: 1000
    });

    console.log('🤖 AI Generated Fix:');
    console.log(xssResponse.content);
    console.log('');

  } catch (error) {
    console.log('❌ AI call failed:', error.message);
  }

  // Demo 3: Password Hashing Fix
  console.log('🔧 Demo 3: Password Hashing Fix');
  console.log('-------------------------------');

  const passwordPrompt = `Fix this weak password hashing in PHP:

VULNERABLE CODE:
return md5($password) === $this->storedHash;

Provide the exact search and replace strings to fix this. Return JSON format.`;

  try {
    const passwordResponse = await aiClient.sendMessage(passwordPrompt, {
      temperature: 0.1,
      maxTokens: 1000
    });

    console.log('🤖 AI Generated Fix:');
    console.log(passwordResponse.content);
    console.log('');

  } catch (error) {
    console.log('❌ AI call failed:', error.message);
  }

  console.log('🎯 How It Works:');
  console.log('================');
  console.log('1. AI analyzes the vulnerable code');
  console.log('2. AI generates exact search/replace commands');
  console.log('3. System applies the fixes to actual files');
  console.log('4. Backups are created automatically');
  console.log('5. Results are logged and reported');
  console.log('');
  console.log('💡 The AI provides context-aware, syntax-preserving fixes!');
  console.log('');
  console.log('🧹 Cleaning up demo files...');
  fs.unlinkSync('demo-vulnerable.php');
  console.log('✅ Demo completed!');
}

// Run the demo
demoAIFix().catch(console.error);