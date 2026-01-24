# 📁 Crash Processor - Production Files

## Core System Files (Keep These!)

### **Main Modules:**
1. `stack-parser.js` - Parses stack traces from Sentry
2. `github-fetcher.js` - Fetches source code from GitHub
3. `gemini-analyzer.js` - AI-powered actionId extraction (optional)
4. `crash-processor.js` - Main orchestrator (uses AI)
5. `manual-crash-processor.js` - Fallback processor (regex-based, no AI)

### **Server:**
6. `index.js` - Main server with Sentry polling

### **Documentation:**
7. `CRASH_PROCESSOR_README.md` - Complete guide

### **Configuration:**
8. `.env` - Environment variables

---

## Quick Start

```bash
# 1. Ensure .env is configured
cat .env  # Check GITHUB_TOKEN, GITHUB_REPO_OWNER, etc.

# 2. Start server
node index.js

# 3. System auto-processes all new Sentry crashes!
```

---

## File Responsibilities

| File | Purpose | When Used |
|------|---------|-----------|
| `stack-parser.js` | Extract file:line from stack trace | Every crash |
| `github-fetcher.js` | Fetch code from GitHub | Every crash |
| `gemini-analyzer.js` | AI extraction (if working) | Automatic |
| `crash-processor.js` | Main orchestrator | Automatic (from index.js) |
| `manual-crash-processor.js` | Manual processing | When needed |
| `index.js` | Server + Sentry poller | Always running |

---

## When to Use Each:

**Normal Operation:**
- Just run `index.js` - everything else is automatic!

**Manual Reprocessing:**
```bash
node manual-crash-processor.js <crash-id>
```

**Read Full Guide:**
- See `CRASH_PROCESSOR_README.md`

---

✅ **All test files deleted. Production system is ready!**
