# PreToolUse guard: block Edit/Write on sensitive files
# Reads Claude hook JSON from stdin, extracts file_path, checks against blocklist

$input = $null
try { $input = [Console]::In.ReadToEnd() | ConvertFrom-Json } catch { exit 0 }

$filePath = $input.tool_input.file_path
if (-not $filePath) { exit 0 }

$fileName = [System.IO.Path]::GetFileName($filePath)
$fileExt  = [System.IO.Path]::GetExtension($filePath).ToLower()

# --- Exact filename blocks ---
$blockedNames = @(
    '.env', '.env.local', '.env.development', '.env.production', '.env.staging', '.env.test',
    '.env.example',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb',
    'credentials.json', 'serviceAccountKey.json',
    'id_rsa', 'id_ed25519', 'id_ecdsa',
    '.npmrc', '.pypirc'
)

if ($blockedNames -contains $fileName) {
    Write-Output "BLOCKED: Cannot modify protected file: $fileName"
    exit 2
}

# --- Extension blocks ---
$blockedExts = @('.pem', '.key', '.p12', '.pfx', '.jks', '.keystore')

if ($blockedExts -contains $fileExt) {
    Write-Output "BLOCKED: Cannot modify file with sensitive extension: $fileExt"
    exit 2
}

# --- Pattern blocks (regex on full path) ---
$blockedPatterns = @(
    '\.env(\.[a-zA-Z0-9_-]+)?$',   # any .env variant
    '[\\/]secrets[\\/]',             # secrets/ directory
    '[\\/]\.ssh[\\/]',              # .ssh/ directory
    'secret[_-]?key',               # files with secret/key in name
    'private[_-]?key',
    'api[_-]?key.*\.(json|yaml|yml|toml|txt)$'
)

foreach ($pattern in $blockedPatterns) {
    if ($filePath -match $pattern) {
        Write-Output "BLOCKED: Path matches sensitive pattern: $filePath"
        exit 2
    }
}

exit 0
