/**
 * Auto-Fix Engine Module
 * Applies automated security fixes and suggests manual improvements
 */

import fs from 'fs';
import path from 'path';

export async function fix(options) {
  const { report: reportFile, applySafe, dryRun, output } = options;

  console.log('🔧 Running AI-powered auto-fix engine...');

  try {
    // Load security report
    const reportData = JSON.parse(fs.readFileSync(reportFile, 'utf8'));

    console.log(`📋 Processing ${reportData.findings?.length || 0} findings for automated fixes...`);

    if (dryRun) {
      console.log('🔍 DRY RUN MODE: No files will be modified');
    }

    // Analyze findings and generate fixes
    const fixResults = await analyzeAndGenerateFixes(reportData, applySafe, dryRun);

    console.log(`✅ Generated ${fixResults.automatedFixes?.length || 0} automated fixes`);
    console.log(`📝 Generated ${fixResults.manualFixes?.length || 0} manual fix suggestions`);

    if (!dryRun && fixResults.appliedFixes?.length > 0) {
      console.log(`💾 Applied ${fixResults.appliedFixes.length} fixes to files`);
    }

    return {
      timestamp: new Date().toISOString(),
      appliedFixes: fixResults.appliedFixes || [],
      automatedFixes: fixResults.automatedFixes || [],
      manualFixes: fixResults.manualFixes || [],
      summary: {
        totalFixes: (fixResults.automatedFixes?.length || 0) + (fixResults.manualFixes?.length || 0),
        appliedCount: fixResults.appliedFixes?.length || 0,
        safeFixes: fixResults.automatedFixes?.filter(f => f.safety === 'safe').length || 0,
        riskyFixes: fixResults.automatedFixes?.filter(f => f.safety === 'risky').length || 0,
        manualRequired: fixResults.manualFixes?.length || 0
      }
    };

  } catch (error) {
    console.error('❌ Error in auto-fix engine:', error.message);
    throw error;
  }
}

async function analyzeAndGenerateFixes(reportData, applySafe, dryRun) {
  const findings = reportData.findings || [];
  const automatedFixes = [];
  const manualFixes = [];
  const appliedFixes = [];

  console.log(`🔍 Analyzing ${findings.length} security findings...`);

  for (const finding of findings) {
    const fixes = await generateFixesForFinding(finding);

    // Categorize fixes
    fixes.forEach(fix => {
      if (fix.type === 'automated') {
        automatedFixes.push(fix);
      } else {
        manualFixes.push(fix);
      }
    });
  }

  // Apply safe automated fixes if requested
  if (applySafe && !dryRun) {
    console.log('🛠️ Applying safe automated fixes...');
    for (const fix of automatedFixes) {
      if (fix.safety === 'safe') {
        try {
          const result = await applyAutomatedFix(fix);
          if (result.success) {
            appliedFixes.push({
              ...fix,
              appliedAt: new Date().toISOString(),
              result: result
            });
          }
        } catch (error) {
          console.warn(`Failed to apply fix ${fix.id}:`, error.message);
        }
      }
    }
  }

  // Generate additional library update suggestions
  const libraryUpdates = await analyzeLibraryUpdates(findings);
  manualFixes.push(...libraryUpdates);

  return {
    automatedFixes,
    manualFixes,
    appliedFixes
  };
}

async function generateFixesForFinding(finding) {
  const fixes = [];

  // Analyze finding type and generate appropriate fixes
  switch (finding.type?.toLowerCase()) {
    case 'sql_injection':
    case 'injection':
      fixes.push(...generateSQLInjectionFixes(finding));
      break;

    case 'xss':
    case 'cross_site_scripting':
      fixes.push(...generateXSSFixes(finding));
      break;

    case 'authentication':
    case 'authorization':
      fixes.push(...generateAuthFixes(finding));
      break;

    case 'cryptography':
    case 'encryption':
      fixes.push(...generateCryptoFixes(finding));
      break;

    case 'file_upload':
    case 'path_traversal':
      fixes.push(...generateFileUploadFixes(finding));
      break;

    case 'session':
      fixes.push(...generateSessionFixes(finding));
      break;

    case 'input_validation':
      fixes.push(...generateInputValidationFixes(finding));
      break;

    default:
      fixes.push(generateGenericFix(finding));
  }

  return fixes;
}

function generateSQLInjectionFixes(finding) {
  return [
    {
      id: `sql_fix_${Date.now()}`,
      type: 'automated',
      safety: 'safe',
      title: 'Replace vulnerable SQL query with prepared statement',
      description: 'Convert dynamic SQL to prepared statements to prevent SQL injection',
      finding: finding,
      code: {
        before: `// Vulnerable code
$query = "SELECT * FROM users WHERE id = " . $_GET['id'];
$result = mysqli_query($conn, $query);`,

        after: `// Secure code
$stmt = $conn->prepare("SELECT * FROM users WHERE id = ?");
$stmt->bind_param("i", $_GET['id']);
$stmt->execute();
$result = $stmt->get_result();`
      },
      files: [finding.location || 'unknown'],
      priority: 'high'
    },
    {
      id: `sql_validation_${Date.now()}`,
      type: 'automated',
      safety: 'safe',
      title: 'Add input validation for SQL parameters',
      description: 'Validate and sanitize all user inputs before using in SQL queries',
      finding: finding,
      code: {
        before: `$id = $_GET['id'];`,

        after: `$id = filter_input(INPUT_GET, 'id', FILTER_VALIDATE_INT);
if ($id === false || $id === null) {
    die('Invalid input');
}`
      },
      files: [finding.location || 'unknown'],
      priority: 'high'
    }
  ];
}

function generateXSSFixes(finding) {
  return [
    {
      id: `xss_escape_${Date.now()}`,
      type: 'automated',
      safety: 'safe',
      title: 'Escape output to prevent XSS',
      description: 'Use htmlspecialchars() to escape HTML output',
      finding: finding,
      code: {
        before: `// Vulnerable code
echo "<div>" . $_GET['name'] . "</div>";`,

        after: `// Secure code
echo "<div>" . htmlspecialchars($_GET['name'], ENT_QUOTES, 'UTF-8') . "</div>";`
      },
      files: [finding.location || 'unknown'],
      priority: 'high'
    },
    {
      id: `xss_validation_${Date.now()}`,
      type: 'automated',
      safety: 'safe',
      title: 'Add input validation and sanitization',
      description: 'Validate and sanitize user inputs to prevent XSS',
      finding: finding,
      code: {
        before: `$name = $_GET['name'];`,

        after: `$name = filter_input(INPUT_GET, 'name', FILTER_SANITIZE_STRING);
$name = trim($name);
if (empty($name)) {
    $name = 'Anonymous';
}`
      },
      files: [finding.location || 'unknown'],
      priority: 'high'
    }
  ];
}

function generateAuthFixes(finding) {
  return [
    {
      id: `auth_session_${Date.now()}`,
      type: 'automated',
      safety: 'safe',
      title: 'Implement secure session management',
      description: 'Add proper session security settings',
      finding: finding,
      code: {
        before: `// Basic session start
session_start();`,

        after: `// Secure session configuration
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.use_only_cookies', 1);
session_start();

// Regenerate session ID periodically
if (!isset($_SESSION['created'])) {
    $_SESSION['created'] = time();
} elseif (time() - $_SESSION['created'] > 1800) { // 30 minutes
    session_regenerate_id(true);
    $_SESSION['created'] = time();
}`
      },
      files: [finding.location || 'unknown'],
      priority: 'critical'
    },
    {
      id: `auth_password_${Date.now()}`,
      type: 'manual',
      safety: 'manual',
      title: 'Upgrade to secure password hashing',
      description: 'Replace MD5/SHA1 with password_hash() and password_verify()',
      finding: finding,
      code: {
        before: `// Vulnerable hashing
$hash = md5($password);`,

        after: `// Secure hashing
$hash = password_hash($password, PASSWORD_DEFAULT);

// Verification
if (password_verify($password, $hash)) {
    // Password is correct
}`
      },
      files: [finding.location || 'unknown'],
      priority: 'high'
    }
  ];
}

function generateCryptoFixes(finding) {
  return [
    {
      id: `crypto_random_${Date.now()}`,
      type: 'automated',
      safety: 'safe',
      title: 'Replace insecure random number generation',
      description: 'Use cryptographically secure random functions',
      finding: finding,
      code: {
        before: `// Insecure random
$token = rand(100000, 999999);`,

        after: `// Secure random
$token = random_int(100000, 999999);`
      },
      files: [finding.location || 'unknown'],
      priority: 'medium'
    },
    {
      id: `crypto_encrypt_${Date.now()}`,
      type: 'manual',
      safety: 'manual',
      title: 'Upgrade to modern encryption standards',
      description: 'Replace outdated encryption methods with AES-256-GCM',
      finding: finding,
      code: {
        before: `// Outdated encryption
$encrypted = mcrypt_encrypt(MCRYPT_RIJNDAEL_128, $key, $data, MCRYPT_MODE_CBC, $iv);`,

        after: `// Modern encryption
$encrypted = openssl_encrypt($data, 'aes-256-gcm', $key, 0, $iv, $tag);`
      },
      files: [finding.location || 'unknown'],
      priority: 'high'
    }
  ];
}

function generateFileUploadFixes(finding) {
  return [
    {
      id: `upload_validation_${Date.now()}`,
      type: 'automated',
      safety: 'safe',
      title: 'Add comprehensive file upload validation',
      description: 'Validate file type, size, and content before processing',
      finding: finding,
      code: {
        before: `// Basic upload
move_uploaded_file($_FILES['file']['tmp_name'], $targetPath);`,

        after: `// Secure upload with validation
$allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
$maxSize = 5 * 1024 * 1024; // 5MB

if (!in_array($_FILES['file']['type'], $allowedTypes)) {
    die('Invalid file type');
}

if ($_FILES['file']['size'] > $maxSize) {
    die('File too large');
}

// Verify file content (not just extension)
$finfo = finfo_open(FILEINFO_MIME_TYPE);
$mimeType = finfo_file($finfo, $_FILES['file']['tmp_name']);
finfo_close($finfo);

if (!in_array($mimeType, $allowedTypes)) {
    die('File content does not match type');
}

move_uploaded_file($_FILES['file']['tmp_name'], $targetPath);`
      },
      files: [finding.location || 'unknown'],
      priority: 'high'
    }
  ];
}

function generateSessionFixes(finding) {
  return [
    {
      id: `session_secure_${Date.now()}`,
      type: 'automated',
      safety: 'safe',
      title: 'Implement secure session configuration',
      description: 'Configure sessions with security best practices',
      finding: finding,
      code: {
        before: `session_start();`,

        after: `// Secure session configuration
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_samesite', 'Strict');

session_start();

// Regenerate session ID on privilege change
session_regenerate_id(true);`
      },
      files: [finding.location || 'unknown'],
      priority: 'high'
    }
  ];
}

function generateInputValidationFixes(finding) {
  return [
    {
      id: `input_filter_${Date.now()}`,
      type: 'automated',
      safety: 'safe',
      title: 'Add comprehensive input filtering',
      description: 'Use PHP filters to validate and sanitize all user inputs',
      finding: finding,
      code: {
        before: `// Unfiltered input
$email = $_POST['email'];
$name = $_GET['name'];`,

        after: `// Filtered and validated input
$email = filter_input(INPUT_POST, 'email', FILTER_VALIDATE_EMAIL);
$name = filter_input(INPUT_GET, 'name', FILTER_SANITIZE_STRING);

if (!$email) {
    die('Invalid email address');
}

$name = trim($name);
if (empty($name)) {
    $name = 'Anonymous';
}`
      },
      files: [finding.location || 'unknown'],
      priority: 'medium'
    }
  ];
}

function generateGenericFix(finding) {
  return {
    id: `generic_fix_${Date.now()}`,
    type: 'manual',
    safety: 'manual',
    title: 'Manual security review required',
    description: `Manual review and fix required for: ${finding.title}`,
    finding: finding,
    code: {
      before: '// Original code needs manual review',
      after: '// Please review and implement appropriate security measures'
    },
    files: [finding.location || 'unknown'],
    priority: 'medium'
  };
}

async function analyzeLibraryUpdates(findings) {
  const libraryUpdates = [];

  // Check for outdated library usage patterns
  const libraryPatterns = [
    { name: 'jQuery', version: '< 3.5.0', risk: 'XSS vulnerabilities', update: '3.6.0+' },
    { name: 'OpenSSL', version: '< 1.1.1', risk: 'Multiple CVEs', update: '1.1.1+' },
    { name: 'PHP', version: '< 7.4', risk: 'Security support ended', update: '8.0+' },
    { name: 'MySQL', version: '< 8.0', risk: 'Known vulnerabilities', update: '8.0+' }
  ];

  libraryPatterns.forEach(pattern => {
    libraryUpdates.push({
      id: `lib_update_${pattern.name.toLowerCase()}_${Date.now()}`,
      type: 'manual',
      safety: 'manual',
      title: `Update ${pattern.name} library`,
      description: `${pattern.name} ${pattern.version} has ${pattern.risk}. Update to ${pattern.update}`,
      priority: 'high',
      category: 'library_update',
      library: pattern.name,
      currentVersion: pattern.version,
      recommendedVersion: pattern.update,
      risk: pattern.risk
    });
  });

  return libraryUpdates;
}

async function applyAutomatedFix(fix) {
  console.log(`🔧 Applying automated fix: ${fix.title}`);

  const fs = await import('fs');
  const path = await import('path');

  // Import AI client for generating fix commands
  const { AIClient } = await import('./ai-client.js');
  const aiClient = new AIClient();

  const results = [];

  for (const filePath of fix.files) {
    try {
      console.log(`📝 Processing file: ${filePath}`);

      // Read the file content
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  File not found: ${filePath}`);
        continue;
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');

      // Create backup
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.writeFileSync(backupPath, fileContent);
      console.log(`💾 Backup created: ${backupPath}`);

      // Generate specific fix commands using AI
      const fixCommands = await generateSpecificFixCommands(aiClient, fix, fileContent, filePath);

      if (fixCommands && fixCommands.length > 0) {
        let modifiedContent = fileContent;

        for (const command of fixCommands) {
          if (command.type === 'search_replace') {
            console.log(`🔍 Applying search/replace fix...`);

            // Apply the search and replace
            const { search, replace, description } = command;
            console.log(`   ${description}`);

            if (modifiedContent.includes(search)) {
              modifiedContent = modifiedContent.replace(search, replace);
              console.log(`   ✅ Applied fix`);
            } else {
              console.log(`   ⚠️  Search pattern not found, skipping`);
            }
          }
        }

        // Write the modified content back to file
        if (modifiedContent !== fileContent) {
          fs.writeFileSync(filePath, modifiedContent);
          console.log(`💾 File updated: ${filePath}`);

          results.push({
            file: filePath,
            success: true,
            backup: backupPath,
            changes: fixCommands.length
          });
        } else {
          console.log(`⚠️  No changes made to ${filePath}`);
          // Clean up backup if no changes
          fs.unlinkSync(backupPath);

          results.push({
            file: filePath,
            success: true,
            backup: null,
            changes: 0
          });
        }

      } else {
        console.log(`⚠️  No fix commands generated for ${filePath}`);
        // Clean up backup
        fs.unlinkSync(backupPath);

        results.push({
          file: filePath,
          success: false,
          backup: null,
          error: 'No fix commands generated'
        });
      }

    } catch (error) {
      console.error(`❌ Error processing ${filePath}:`, error.message);
      results.push({
        file: filePath,
        success: false,
        error: error.message
      });
    }
  }

  return {
    success: results.some(r => r.success),
    filesModified: results.filter(r => r.success).map(r => r.file),
    backupCreated: results.some(r => r.backup),
    timestamp: new Date().toISOString(),
    details: results
  };
}

async function generateSpecificFixCommands(aiClient, fix, fileContent, filePath) {
  const systemPrompt = `You are an expert security engineer specializing in automated code fixes.
Your task is to generate precise search and replace operations to fix security vulnerabilities.

IMPORTANT: You must provide EXACT search and replace strings that will work with string replacement.
- Include sufficient context around the code to make the search unique
- Preserve indentation and formatting
- Be extremely precise with whitespace and syntax
- Return ONLY valid JSON

Format your response as JSON:
{
  "commands": [
    {
      "type": "search_replace",
      "description": "Brief description of the fix",
      "search": "exact string to find (with context)",
      "replace": "exact replacement string"
    }
  ]
}`;

  const message = `Generate specific search and replace commands to fix this security vulnerability:

VULNERABILITY: ${fix.title}
DESCRIPTION: ${fix.finding?.description || 'No description'}
LOCATION: ${filePath}

CURRENT FILE CONTENT:
\`\`\`
${fileContent}
\`\`\`

Please provide precise search and replace operations that will:
1. Fix the security vulnerability
2. Maintain code functionality
3. Preserve formatting and indentation
4. Include enough context to uniquely identify the location

Return ONLY the JSON with the fix commands.`;

  try {
    const response = await aiClient.sendMessage(message, {
      systemPrompt,
      temperature: 0.1, // Low temperature for precision
      maxTokens: 2000
    });

    // Parse the JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const fixData = JSON.parse(jsonMatch[0]);
      return fixData.commands || [];
    }

    console.warn('⚠️  AI response was not valid JSON, attempting to extract commands...');

    // Fallback: try to extract commands from text response
    return extractCommandsFromText(response.content);

  } catch (error) {
    console.error('❌ Error generating fix commands:', error.message);
    return [];
  }
}

function extractCommandsFromText(text) {
  // Simple fallback parser for non-JSON responses
  const commands = [];

  // Look for search/replace patterns in the text
  const searchMatches = text.match(/search:[\s\S]*?(?=replace:|$)/g);
  const replaceMatches = text.match(/replace:[\s\S]*?(?=search:|$)/g);

  if (searchMatches && replaceMatches && searchMatches.length === replaceMatches.length) {
    for (let i = 0; i < searchMatches.length; i++) {
      const search = searchMatches[i].replace(/^search:\s*/, '').trim();
      const replace = replaceMatches[i].replace(/^replace:\s*/, '').trim();

      commands.push({
        type: 'search_replace',
        description: `Fix extracted from AI response ${i + 1}`,
        search: search,
        replace: replace
      });
    }
  }

  return commands;
}