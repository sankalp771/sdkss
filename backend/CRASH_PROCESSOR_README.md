# 🚀 Crash Processor - Production Guide

## 📋 Overview

The Crash Processor is an intelligent automation system that automatically extracts actionId from crashes and populates the ComponentError table.

**What it does:**
1. ✅ Monitors Sentry for new crashes (automatic)
2. ✅ Parses stack traces to find error location
3. ✅ Fetches source code from GitHub
4. ✅ Extracts **literal actionId** from code (e.g., `'checkout_submit22'`)
5. ✅ Creates/updates Component records
6. ✅ Populates ComponentError table with metadata
7. ✅ Links crashes to components

---

## 📁 Production Files

### **Core Modules:**
- `stack-parser.js` - Parses stack traces
- `github-fetcher.js` - Fetches code from GitHub
- `gemini-analyzer.js` - AI-powered actionId extraction
- `crash-processor.js` - Main orchestrator (uses AI)
- `manual-crash-processor.js` - Fallback processor (uses regex, no AI)
- `index.js` - Server (includes Sentry poller)

---

## ⚙️ Configuration

### **1. Environment Variables (.env)**

Required configuration in `.env`:

```env
# Database
DATABASE_URL="postgresql://..."

# Gemini AI (for AI-powered extraction)
GEMINI_API_KEY=AIzaSy...

# GitHub (REQUIRED - for fetching source code)
GITHUB_TOKEN=ghp_xxxxx
GITHUB_REPO_OWNER=your-username
GITHUB_REPO_NAME=your-repo
GITHUB_BRANCH=master  # or main

# Sentry
SENTRY_AUTH_TOKEN=xxx
SENTRY_POLLING_ENABLED=true
```

### **2. Verify Configuration**

Check your configuration is correct:

```bash
# Check .env file
cat .env

# Verify GitHub access (should return repo info)
curl -H "Authorization: token YOUR_GITHUB_TOKEN" https://api.github.com/repos/OWNER/REPO
```

---

## 🚀 How to Run

### **Automatic Mode (Production)**

Just start the server - crash processing happens automatically!

```bash
# Start server
node index.js

# Server will:
# 1. Poll Sentry every 30 seconds
# 2. Auto-import new crashes
# 3. Auto-extract actionIds
# 4. Auto-create Components & ComponentErrors
```

**That's it! No manual intervention needed.** ✅

---

## 🔄 Workflow

### **Automatic Processing Flow:**

```
New Sentry Crash Detected
        ↓
Sentry Poller (runs every 30s)
        ↓
Create ProcessedCrash record
        ↓
🤖 AUTO-TRIGGER: processCrash()
        ↓
┌─────────────────────────────┐
│  CRASH PROCESSOR PIPELINE   │
├─────────────────────────────┤
│ 1. Parse Stack Trace        │
│    └─> Extract: file:line   │
│                              │
│ 2. Fetch Code from GitHub   │
│    └─> Get code context     │
│                              │
│ 3. Extract ActionId          │
│    └─> Find literal value   │
│                              │
│ 4. Create/Find Component    │
│    └─> Using actionId       │
│                              │
│ 5. Create ComponentError    │
│    └─> Store all metadata   │
│                              │
│ 6. Link Crash to Component  │
│    └─> Update ProcessedCrash│
└─────────────────────────────┘
        ↓
    ✅ DONE!
```

**Output:**
- ✅ Component record (with correct actionId)
- ✅ ComponentError record (with metadata)
- ✅ ProcessedCrash linked to component

---

## 🖐️ Manual Processing

### **When to Use Manual Processing:**

- Reprocess old crashes
- When Gemini API has issues
- For debugging/testing specific crashes

### **Option 1: Manual Crash Processor (Recommended)**

Uses regex extraction - **fast, reliable, no AI dependency**

```bash
# Process a specific crash
node manual-crash-processor.js <crash-id>

# Example:
node manual-crash-processor.js 6bf6e919-2670-49e1-906d-30878229c81a
```

**Benefits:**
- ✅ No Gemini API dependency
- ✅ Fast (regex-based)
- ✅ Reliable
- ✅ Extracts literal actionId values

### **Option 2: API Endpoints**

```bash
# Process a single crash
curl -X POST http://localhost:3001/api/crashes/123/process

# Batch process all unprocessed crashes
curl -X POST http://localhost:3001/api/crashes/process-all
```

---

## 🧪 Testing

### **Test 1: Verify GitHub Access**

```bash
# Test fetching code from GitHub
node -e "const {fetchGitHubFile}=require('./github-fetcher'); fetchGitHubFile('lib/main.dart',95,15).then(r=>console.log(r?'✅ SUCCESS':'❌ FAILED'))"
```

### **Test 2: Test Stack Parser**

```bash
node -e "const {parseStackTrace}=require('./stack-parser'); console.log(parseStackTrace('main.dart in _incrementCounter at line 95:7'))"
```

### **Test 3: Process a Crash Manually**

```bash
# Find a crash ID first
node -e "require('@prisma/client').PrismaClient().then(db=>db.processedCrash.findFirst({where:{componentId:null}}).then(c=>console.log(c?.id)))"

# Then process it
node manual-crash-processor.js <crash-id>
```

### **Test 4: Check Results**

```bash
# View recent components
node -e "const p=new(require('@prisma/client').PrismaClient)();p.component.findMany({take:3,orderBy:{createdAt:'desc'}}).then(console.log).finally(()=>p.$disconnect())"

# View recent errors
node -e "const p=new(require('@prisma/client').PrismaClient)();p.componentError.findMany({take:3,orderBy:{createdAt:'desc'},include:{component:true}}).then(console.log).finally(()=>p.$disconnect())"
```

---

## 📊 Database Schema

### **Component Table**
```
- id: UUID (PK)
- projectId: UUID (FK)
- identifier: String (actionId - e.g., "checkout_submit22")
- name: String
- status: String (active/maintenance/deprecated)
- crashThreshold: Int
```

### **ComponentError Table**
```
- id: UUID (PK)
- componentId: UUID (FK)
- projectId: UUID (FK)
- actionId: String (literal value from code)
- appVersion: String (e.g., "1.0.0 (1)")
- errorMessage: String
- errorType: String
- stackTrace: Text
- metadata: JSON
  - fileName: String
  - lineNumber: Int
  - functionName: String
  - confidence: String (high/medium/low)
  - pattern: String (how it was found)
  - reasoning: String
  - codeContext: String (optional)
```

### **ProcessedCrash Table (Updated)**
```
- componentId: UUID (FK) - Links to Component
- geminiAnalysis: JSON
  - actionId: String
  - componentName: String
  - confidence: String
  - automated: Boolean
```

---

## 🎯 ActionId Extraction

### **What Gets Extracted:**

The system looks for **literal string values** in the code:

✅ **CORRECT Extraction:**
```dart
FloatingActionButton(
  onPressed: ActionGuard.guard(
    actionId: 'checkout_submit22',  // ← Extracts "checkout_submit22"
    action: _incrementCounter,
  ),
)
```

❌ **What It DOESN'T Do:**
- Generate actionIds from function names (`_incrementCounter`)
- Use widget names (`FloatingActionButton`)
- Infer or guess actionIds

### **Supported Patterns:**

1. `ActionGuard.guard(actionId: 'xxx', ...)`
2. `ActionGuard.run(actionId: 'xxx', ...)`
3. `SafeAction(actionId: 'xxx', ...)`
4. Direct: `actionId: 'xxx'`

---

## 🔍 Monitoring

### **Check Logs:**

```bash
# View server logs
tail -f <your-log-file>

# Or just check console output from node index.js
```

**What to look for:**
```
🔥 New Sentry Issue Found: <error>
🔄 Auto-processing crash <id>...
📍 Found: main.dart:95 in _incrementCounter
✅ Fetched code from GitHub
🎯 ActionId: "checkout_submit22"
✅ Crash processing complete!
```

### **Check Database:**

```bash
# Open Prisma Studio
npx prisma studio

# Navigate to:
# - Component table
# - ComponentError table
# - ProcessedCrash table
```

---

## 🐛 Troubleshooting

### **Issue: GitHub 404 Errors**

**Solution:**
```bash
# 1. Check token has repo access
# 2. Verify repo owner/name in .env
# 3. Check branch name (master vs main)

# Test:
curl -H "Authorization: token YOUR_TOKEN" \
  https://api.github.com/repos/OWNER/REPO/contents/lib/main.dart?ref=master
```

### **Issue: Gemini API Errors**

**Solution:**
Use manual processor instead:
```bash
node manual-crash-processor.js <crash-id>
```

### **Issue: No ActionId Found**

**Possible reasons:**
1. Code doesn't have ActionGuard wrapper
2. File path incorrect
3. Branch outdated

**Check:**
```bash
# Verify code actually has actionId:
curl -H "Authorization: token YOUR_TOKEN" \
  "https://api.github.com/repos/OWNER/REPO/contents/lib/main.dart?ref=master" \
  | jq -r '.content' | base64 -d | grep -i actionId
```

---

## 🎓 Example Usage

### **Complete Example:**

1. **Start Server:**
```bash
node index.js
```

2. **Crash Happens in Your App**

3. **Sentry Detects It** (automatic)

4. **System Processes It** (automatic):
```
📥 ProcessedCrash created
🔄 Auto-processing...
📍 Location: main.dart:95
📥 Fetched code from GitHub
✅ Found actionId: "checkout_submit22"
➕ Created Component: checkout_submit22
💾 Created ComponentError
🔗 Linked crash to component
✅ Done!
```

5. **Results in Database:**
   - Component: `identifier="checkout_submit22"`
   - ComponentError: `actionId="checkout_submit22"`, metadata with full details
   - ProcessedCrash: `componentId=<component-id>`

6. **View in Prisma Studio:**
   - Open `http://localhost:5555`
   - Browse tables to see data

---

## 🚨 Important Notes

1. **GitHub Token**: Must have `repo` access
2. **Branch Name**: Use correct branch (master/main)
3. **ActionId Format**: System extracts **literal values only**
4. **Rate Limits**: GitHub API has rate limits (60/hour without auth, 5000/hour with auth)
5. **Automatic**: No manual intervention needed once running

---

## 📞 Quick Reference

| Task | Command |
|------|---------|
| Start server | `node index.js` |
| Process specific crash | `node manual-crash-processor.js <id>` |
| View database | `npx prisma studio` |
| Check logs | Console output from `node index.js` |
| Test GitHub | `node -e "require('./github-fetcher').fetchGitHubFile('lib/main.dart',1).then(console.log)"` |

---

## ✅ Success Criteria

You know it's working when:

1. ✅ Sentry crashes auto-import to ProcessedCrash
2. ✅ ActionIds are automatically extracted
3. ✅ Components are created with correct identifiers
4. ✅ ComponentErrors have full metadata
5. ✅ Crashes are linked to components
6. ✅ Console shows "✅ Crash processing complete!"

---

**Need help? Check the code comments or reach out!** 🚀
