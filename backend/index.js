const express = require('express');
const { BigQuery } = require('@google-cloud/bigquery');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const BIGQUERY_PROJECT_ID = process.env.BIGQUERY_PROJECT_ID;
const BIGQUERY_DATASET = process.env.BIGQUERY_DATASET || 'firebase_crashlytics';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// --- Database Connections ---

// 1. Prisma (Application State)
const prisma = new PrismaClient();

// 2. Gemini AI (The Brain)
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// --- Routes ---

// Health Check
app.get('/', (req, res) => {
  res.send('CrashGuard Backend is Active 🟢 (Simulation Mode)');
});

/**
 * 1. Report Crash (Direct from SDK)
 * Since we cannot pull from Crashlytics without BigQuery, the SDK sends the crash
 * directly to us at the same time it sends to Firebase.
 */
app.post('/api/report-crash', async (req, res) => {
  const { project_id, component_id, error_message, stack_trace, metadata } = req.body;

  try {
    console.log(`🚨 Received Crash Report for Component: ${component_id}`);

    // Validate Project
    // const project = await prisma.project.findFirst({ where: { id: project_id } }); 
    // if (!project) return res.status(404).json({ error: "Invalid Project" });

    // Find Component (optional validation)
    const comp = await prisma.component.findUnique({
      where: { projectId_identifier: { projectId: project_id, identifier: component_id } }
    });

    const crashData = {
      projectId: project_id,
      componentId: comp ? comp.id : null,
      firebaseEventId: `direct-${Date.now()}`, // Generated locally since it's direct
      errorMessage: error_message,
      stackTrace: stack_trace,
      analysisStatus: 'pending',
      geminiAnalysis: {}
    };

    // 1. Store in DB
    const newCrash = await prisma.processedCrash.create({ data: crashData });

    // 2. Trigger Gemini Analysis immediately
    // We do this asynchronously so we don't block the client response
    analyzeCrashInternal(error_message, stack_trace, component_id).then(async (analysis) => {
      await prisma.processedCrash.update({
        where: { id: newCrash.id },
        data: {
          analysisStatus: 'completed',
          geminiAnalysis: analysis
        }
      });
      console.log(`✨ Analysis Complete for crash ${newCrash.id}`);
    });

    res.json({ status: 'recorded', crash_id: newCrash.id });

  } catch (error) {
    console.error('Report Crash Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper Function for Internal Analysis
async function analyzeCrashInternal(msg, stack, context) {
  try {
    const prompt = `
        Analyze this crash:
        Error: ${msg}
        Stack: ${stack}
        Context: ${context}
        Return JSON: { "root_cause": "...", "suggested_fix": "..." }
        `;
    const result = await model.generateContent(prompt);
    const text = result.response.text().replace(/```json/g, '').replace(/```/g, '');
    return JSON.parse(text);
  } catch (e) {
    return { root_cause: "Analysis Failed", suggested_fix: "Check logs" };
  }
}


/**
 * 2. Sentry Webhook Receiver
 * Listens for 'issue.created' events from Sentry.
 */
app.post('/api/sentry-webhook', async (req, res) => {
  try {
    const event = req.body;

    // We only care about specific triggers, e.g., a new issue is created
    // Sentry payload structure depends on the triggers selected in the integration
    // Usually: { action: 'created', data: { issue: { ... } } }

    // Log raw hook for debugging (remove in prod)
    // console.log("Sentry Hook:", JSON.stringify(event, null, 2));

    const issue = event.data?.issue || event.issue; // Handle different payload shapes
    if (!issue) {
      return res.status(200).send("No issue data found, ignoring.");
    }

    const error_message = issue.title; // e.g. "TypeError: Payment failed"
    const stack_trace = issue.culprit; // e.g. "ui/payments.js in checkout"
    const sentry_url = issue.permalink;

    // We might not have 'component_id' directly from Sentry unless sent as a tag.
    // Hackathon Fix: We try to regex match the component name from the stack trace
    // OR we default to a 'General' component or try to look up tags.
    // For now, let's look for tags if available, or fallback.

    // const componentTag = event.data.event.tags.find(t => t.key === 'componentId');
    // const component_id = componentTag ? componentTag.value : 'unknown_component';

    // For MVP Demo: Just store it as 'External Sentry Issue'
    console.log(`🚨 Sentry Alert: ${error_message}`);

    const crashData = {
      projectId: "41ed4c1c-683d-4ccc-a526-0d8cb7a015c8", // Default to Demo Project
      componentId: null, // Sentry doesn't map 1:1 to our DB components easily without tags
      firebaseEventId: `sentry-${issue.id}`,
      errorMessage: error_message,
      stackTrace: stack_trace || "View Sentry Link for Stack",
      analysisStatus: 'pending',
      geminiAnalysis: { note: "Imported from Sentry", link: sentry_url }
    };

    // 1. Store in DB
    const newCrash = await prisma.processedCrash.create({ data: crashData });

    // 2. Trigger Gemini Analysis 
    analyzeCrashInternal(error_message, stack_trace, "Sentry Context").then(async (analysis) => {
      await prisma.processedCrash.update({
        where: { id: newCrash.id },
        data: {
          analysisStatus: 'completed',
          geminiAnalysis: { ...analysis, sentryLink: sentry_url }
        }
      });
      console.log(`✨ Sentry Issue Analyzed: ${newCrash.id}`);
    });

    res.status(200).json({ status: 'received' });

  } catch (error) {
    console.error('Sentry Hook Error:', error);
    // Always return 200 to Sentry or they will retry spam you
    res.status(200).json({ error: error.message });
  }
});

/**
 * 2. Analyze a Specific Crash with Gemini
 */
app.post('/api/analyze-crash', async (req, res) => {
  const { error_message, stack_trace, component_context } = req.body;

  if (!error_message) return res.status(400).json({ error: 'Missing error_message' });

  try {
    const prompt = `
      You are an expert React Native and Web Debugging Assistant.
      Analyze the following crash report and suggest a fix.
      
      Context: ${component_context || 'Unknown Component'}
      Error: ${error_message}
      Stack Trace:
      ${stack_trace}

      Provide your response in JSON format:
      {
        "root_cause": "Brief explanation",
        "suggested_fix": "Code snippet or logic change",
        "severity": "High/Medium/Low",
        "safe_to_render_fallback": true/false
      }
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const cleanJson = text.replace(/```json/g, '').replace(/```/g, '');

    res.json(JSON.parse(cleanJson));

  } catch (error) {
    console.error('Gemini Analysis Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 3. Component Status (SDK Polling Endpoint)
 */
app.get('/api/component-status', async (req, res) => {
  const { project_id, component_ids } = req.query; // Expect comma-separated IDs

  if (!project_id || !component_ids) {
    return res.status(400).json({ error: 'Missing params' });
  }

  const ids = component_ids.split(',');

  try {
    // 1. Fetch current status from DB
    const components = await prisma.component.findMany({
      where: {
        projectId: project_id,
        identifier: { in: ids }
      },
      select: {
        identifier: true,
        status: true,
        fallbackMessage: true
      }
    });

    // Default to 'active' if not found
    ids.forEach(id => {
      const found = components.find(c => c.identifier === id);
      responseData[id] = {
        status: found ? found.status : 'active',
        fallback_message: found ? found.fallbackMessage : null
      };
    });

    res.json(responseData);

  } catch (error) {
    console.warn("⚠️ DB Unreachable, serving Default 'Active' Status:", error.message);
    // Fallback: All active
    const fallbackData = {};
    if (ids) {
      ids.forEach(id => {
        fallbackData[id] = { status: 'active', fallback_message: null };
      });
    }
    res.json(fallbackData);
  }
});

/**
 * 4. List All Components (Admin & Debug) - OPTIMIZED
 * GET /api/components?project_id=...&app_version=...
 * Returns detailed component status with version-specific metrics
 */
app.get('/api/components', async (req, res) => {
  const { project_id, api_key, app_version } = req.query;

  try {
    let projectId = project_id;
    
    if (api_key && !project_id) {
      // Look up project by key
      const project = await prisma.project.findUnique({ where: { apiKey: api_key } });
      if (!project) return res.status(404).json({ error: "Project not found" });
      projectId = project.id;
    }

    if (!projectId) {
      return res.status(400).json({ error: "Missing project_id or api_key" });
    }

    // Fetch all components for this project with their stats
    const components = await prisma.component.findMany({
      where: { projectId },
      include: {
        versionStats: true,
        componentErrors: {
          where: { isArchived: false },
          orderBy: { createdAt: 'desc' },
          take: 5 // Last 5 errors
        },
        _count: {
          select: { processedCrashes: true, componentErrors: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Fetch app config
    const appUtil = await prisma.applicationUtil.findUnique({
      where: { projectId }
    });

    // Build optimized response
    const componentsByVersion = {};
    
    components.forEach(comp => {
      const versionStats = app_version 
        ? comp.versionStats.find(v => v.appVersion === app_version)
        : comp.versionStats[0]; // Default to latest
      
      const safeVersion = app_version || appUtil?.currentAppVersion || 'unknown';
      
      if (!componentsByVersion[safeVersion]) {
        componentsByVersion[safeVersion] = [];
      }

      componentsByVersion[safeVersion].push({
        id: comp.id,
        identifier: comp.identifier,
        name: comp.name,
        status: comp.status,
        fallbackMessage: comp.fallbackMessage,
        totalCrashCount: comp.totalCrashCount,
        crashThreshold: comp.crashThreshold,
        versionMetrics: versionStats ? {
          appVersion: versionStats.appVersion,
          crashCount: versionStats.crashCount,
          actionCount: versionStats.actionCount,
          crashRate: versionStats.actionCount > 0 
            ? ((versionStats.crashCount / versionStats.actionCount) * 100).toFixed(2) + '%'
            : '0%',
          lastUpdated: versionStats.lastUpdated
        } : {
          appVersion: safeVersion,
          crashCount: 0,
          actionCount: 0,
          crashRate: '0%',
          lastUpdated: comp.updatedAt
        },
        recentErrors: comp.componentErrors.map(err => ({
          id: err.id,
          actionId: err.actionId,
          errorMessage: err.errorMessage,
          errorType: err.errorType,
          timestamp: err.createdAt,
          appVersion: err.appVersion
        })),
        errorCount: comp._count.componentErrors,
        processedCrashCount: comp._count.processedCrashes,
        createdAt: comp.createdAt,
        updatedAt: comp.updatedAt
      });
    });

    // Final response structure
    const response = {
      project: {
        id: projectId,
        appVersion: app_version || appUtil?.currentAppVersion || 'unknown',
        minSupportedVersion: appUtil?.minSupportedVersion || 'unknown',
        metadata: appUtil?.metadata || {}
      },
      timestamp: new Date().toISOString(),
      componentsCount: components.length,
      componentsByVersion,
      summary: {
        totalComponents: components.length,
        activeComponents: components.filter(c => c.status === 'active').length,
        maintenanceComponents: components.filter(c => c.status === 'maintenance').length,
        deprecatedComponents: components.filter(c => c.status === 'deprecated').length,
        totalErrors: components.reduce((sum, c) => sum + c._count.componentErrors, 0)
      }
    };

    res.json(response);
  } catch (error) {
    console.error("Fetch Components Error:", error);
    res.status(500).json({ error: error.message });
  }
});


/**
 * SafeBox Details API - Lightweight endpoint for SDK
 * GET /api/safeBoxDetails?project_id=...&app_version=...
 * Returns ONLY non-active (faulty) components grouped by version
 * Filters: status != 'active' OR crashRate > 5%
 */
app.get('/api/safeBoxDetails', async (req, res) => {
  const { project_id, api_key, app_version } = req.query;

  try {
    let projectId = project_id;
    
    if (api_key && !project_id) {
      const project = await prisma.project.findUnique({ where: { apiKey: api_key } });
      if (!project) return res.status(404).json({ error: "Project not found" });
      projectId = project.id;
    }

    if (!projectId) {
      return res.status(400).json({ error: "Missing project_id or api_key" });
    }

    // Get all components for this project
    const components = await prisma.component.findMany({
      where: { projectId },
      include: {
        versionStats: true
      }
    });

    // Get current app version
    const appUtil = await prisma.applicationUtil.findUnique({
      where: { projectId }
    });

    const currentAppVersion = appUtil?.currentAppVersion || 'unknown';

    // Group faulty safeboxes by version
    const safeBoxesByVersion = {};

    // Process each component and version combination
    components.forEach(comp => {
      // Get all versions for this component
      const versionsToProcess = app_version 
        ? comp.versionStats.filter(v => v.appVersion === app_version)
        : comp.versionStats;

      versionsToProcess.forEach(versionStat => {
        const version = versionStat.appVersion;
        
        // Use crash count directly from DB (threshold: > 2 crashes)
        const crashCount = versionStat.crashCount;
        const hasHighCrashCount = crashCount > 2;

        // Only include if status is NOT 'active' OR crashCount > 2
        const isNotActive = comp.status !== 'active';
        
        if (isNotActive || hasHighCrashCount) {
          if (!safeBoxesByVersion[version]) {
            safeBoxesByVersion[version] = [];
          }

          safeBoxesByVersion[version].push({
            id: comp.id,
            identifier: comp.identifier,
            status: comp.status,
            fallbackMessage: comp.fallbackMessage,
            crashCount: crashCount,
            totalCrashCount: comp.totalCrashCount
          });
        }
      });
    });

    // Calculate summary statistics
    const summary = {
      totalFaultyComponents: Object.values(safeBoxesByVersion).reduce((sum, arr) => sum + arr.length, 0),
      versionsWithIssues: Object.keys(safeBoxesByVersion).length
    };

    res.json({
      project_id: projectId,
      currentAppVersion: currentAppVersion,
      timestamp: new Date().toISOString(),
      summary,
      safeBoxesByVersion: Object.keys(safeBoxesByVersion).length > 0 
        ? safeBoxesByVersion 
        : {}
    });
  } catch (error) {
    console.error("SafeBox Details Error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 4. Register Component (SDK Initialization)
 */
app.post('/api/register-component', async (req, res) => {
  const { project_id, identifier, name } = req.body;

  try {
    const component = await prisma.component.upsert({
      where: {
        projectId_identifier: {
          projectId: project_id,
          identifier: identifier
        }
      },
      update: { name },
      create: {
        projectId: project_id,
        identifier,
        name
      }
    });
    res.json(component);
  } catch (error) {
    console.error("Register Error:", error);
    res.status(500).json({ error: error.message });
  }
});


/**
 * 5. Report Component Error (SDK)
 * POST /api/report-error
 * Logs detailed error with action context
 */
app.post('/api/report-error', async (req, res) => {
  const { project_id, component_id, action_id, app_version, error_message, error_type, stack_trace, metadata } = req.body;

  try {
    // Find component
    const component = await prisma.component.findUnique({
      where: { projectId_identifier: { projectId: project_id, identifier: component_id } }
    });

    if (!component) {
      return res.status(404).json({ error: "Component not found" });
    }

    // Create error record
    const error = await prisma.componentError.create({
      data: {
        componentId: component.id,
        projectId: project_id,
        actionId: action_id,
        appVersion: app_version,
        errorMessage: error_message,
        errorType: error_type,
        stackTrace: stack_trace,
        metadata: metadata || {}
      }
    });

    // Update component's total crash count
    await prisma.component.update({
      where: { id: component.id },
      data: { totalCrashCount: { increment: 1 } }
    });

    // Update version-specific stats
    const versionStat = await prisma.componentVersionStat.upsert({
      where: { componentId_appVersion: { componentId: component.id, appVersion } },
      update: { crashCount: { increment: 1 } },
      create: {
        componentId: component.id,
        appVersion,
        crashCount: 1,
        actionCount: 0
      }
    });

    res.json({ 
      status: 'recorded', 
      error_id: error.id,
      version_stat: versionStat
    });
  } catch (error) {
    console.error('Report Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 6. Track Action Call (SDK)
 * POST /api/track-action
 * Increments action count for version metrics
 */
app.post('/api/track-action', async (req, res) => {
  const { project_id, component_id, app_version } = req.body;

  try {
    const component = await prisma.component.findUnique({
      where: { projectId_identifier: { projectId: project_id, identifier: component_id } }
    });

    if (!component) {
      return res.status(404).json({ error: "Component not found" });
    }

    const versionStat = await prisma.componentVersionStat.upsert({
      where: { componentId_appVersion: { componentId: component.id, appVersion } },
      update: { actionCount: { increment: 1 } },
      create: {
        componentId: component.id,
        appVersion,
        crashCount: 0,
        actionCount: 1
      }
    });

    res.json({ status: 'tracked', version_stat: versionStat });
  } catch (error) {
    console.error('Track Action Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 7. Get App Config (ApplicationUtil)
 * GET /api/app-config?project_id=...
 */
app.get('/api/app-config', async (req, res) => {
  const { project_id } = req.query;

  try {
    if (!project_id) {
      return res.status(400).json({ error: "Missing project_id" });
    }

    const appUtil = await prisma.applicationUtil.findUnique({
      where: { projectId: project_id }
    });

    if (!appUtil) {
      return res.status(404).json({ error: "App config not found" });
    }

    res.json(appUtil);
  } catch (error) {
    console.error('Fetch App Config Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 8. Update App Config
 * POST /api/app-config
 */
app.post('/api/app-config', async (req, res) => {
  const { project_id, current_app_version, min_supported_version, metadata } = req.body;

  try {
    if (!project_id) {
      return res.status(400).json({ error: "Missing project_id" });
    }

    const appUtil = await prisma.applicationUtil.upsert({
      where: { projectId: project_id },
      update: {
        currentAppVersion: current_app_version,
        minSupportedVersion: min_supported_version,
        metadata: metadata || {}
      },
      create: {
        projectId: project_id,
        currentAppVersion: current_app_version,
        minSupportedVersion: min_supported_version,
        metadata: metadata || {}
      }
    });

    res.json({ status: 'updated', appUtil });
  } catch (error) {
    console.error('Update App Config Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 9. Get Error Analytics
 * GET /api/error-analytics?project_id=...&days=7&component_id=...
 */
app.get('/api/error-analytics', async (req, res) => {
  const { project_id, component_id, days = 7 } = req.query;

  try {
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));

    let whereClause = { projectId: project_id, createdAt: { gte: daysAgo } };
    if (component_id) {
      whereClause.componentId = component_id;
    }

    const errors = await prisma.componentError.findMany({
      where: whereClause,
      include: { component: { select: { identifier: true, name: true } } }
    });

    // Group by version and action
    const byVersion = {};
    const byAction = {};
    const byType = {};

    errors.forEach(err => {
      // By version
      if (!byVersion[err.appVersion]) {
        byVersion[err.appVersion] = 0;
      }
      byVersion[err.appVersion]++;

      // By action
      if (!byAction[err.actionId]) {
        byAction[err.actionId] = 0;
      }
      byAction[err.actionId]++;

      // By error type
      if (!byType[err.errorType || 'Unknown']) {
        byType[err.errorType || 'Unknown'] = 0;
      }
      byType[err.errorType || 'Unknown']++;
    });

    res.json({
      totalErrors: errors.length,
      timeRange: `${days} days`,
      analytics: {
        byVersion,
        byAction,
        byErrorType: byType,
        recentErrors: errors.slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Error Analytics Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 10. Archive Old Errors (Weekly Cleanup)
 * POST /api/archive-errors?days=7
 * Called by cron job or manually
 */
app.post('/api/archive-errors', async (req, res) => {
  const { days = 7 } = req.query;

  try {
    const archiveDate = new Date();
    archiveDate.setDate(archiveDate.getDate() - parseInt(days));

    const result = await prisma.componentError.updateMany({
      where: {
        createdAt: { lt: archiveDate },
        isArchived: false
      },
      data: {
        isArchived: true,
        archivedAt: new Date()
      }
    });

    res.json({
      status: 'archived',
      archivedCount: result.count,
      archiveDate,
      message: `Archived ${result.count} errors older than ${days} days`
    });
  } catch (error) {
    console.error('Archive Errors Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * 5. Static Config Endpoint (Requested)
 * Useful for simple feature flag / blocking checks
 */
app.get('/api/config', (req, res) => {
  res.json({
    "version": 2,
    "globalMessage": "Feature temporarily unavailable",
    "blockedActions": {
      "checkout_submit": {
        "message": "Checkout under maintenance"
      }
    }
  });
});

// --- Sentry Polling Service (Bypasses Ngrok) ---
// DISABLED BY DEFAULT - Enable only if you have a valid project in the database
const SENTRY_ENABLED = process.env.SENTRY_POLLING_ENABLED === 'true'; // Set to true in .env to enable
const SENTRY_AUTH_TOKEN = "018d1a0ddcdc56b902fbdf1e12463c1df15d45a000291708f8210034cfce04eb";
const ORG_SLUG = "sankalp-lk"; // Deduced from your screenshots
const PROJECT_SLUG = "open-safe-box"; // Default Flutter project name seen in screenshot

async function pollSentryIssues() {
  if (!SENTRY_ENABLED) {
    return; // Polling disabled
  }

  try {
    // console.log("🕵️ Polling Sentry for new issues...");
    const url = `https://sentry.io/api/0/projects/${ORG_SLUG}/${PROJECT_SLUG}/issues/?query=is:unresolved`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` }
    });

    const issues = response.data;
    // console.log(`   - Found ${issues.length} unresolved issues.`);

    for (const issue of issues) {
      try {
        // Check if we already have this crash
        const exists = await prisma.processedCrash.findFirst({
          where: { firebaseEventId: `sentry-${issue.id}` }
        });

        if (!exists) {
          console.log(`🔥 New Sentry Issue Found: ${issue.title}`);

          // Verify project exists
          const project = await prisma.project.findUnique({
            where: { id: "41ed4c1c-683d-4ccc-a526-0d8cb7a015c8" }
          });

          if (project) {
            // Import into DB
            const newCrash = await prisma.processedCrash.create({
              data: {
                projectId: "41ed4c1c-683d-4ccc-a526-0d8cb7a015c8",
                componentId: null,
                firebaseEventId: `sentry-${issue.id}`,
                errorMessage: issue.title,
                stackTrace: issue.culprit, // Sentry provides partial stack in list view
                analysisStatus: 'pending',
                geminiAnalysis: { source: "Sentry Poller", link: issue.permalink }
              }
            });

            // Analyze
            analyzeCrashInternal(issue.title, issue.culprit, "Sentry Imported").then(async (analysis) => {
              await prisma.processedCrash.update({
                where: { id: newCrash.id },
                data: { analysisStatus: 'completed', geminiAnalysis: analysis }
              });
              console.log(`   ✅ Analyzed & Saved (ID: ${newCrash.id})`);
            }).catch(err => console.error("Analysis error:", err.message));
          }
        }
      } catch (issueError) {
        console.error(`Error processing Sentry issue ${issue.id}:`, issueError.message);
      }
    }

  } catch (error) {
    if (error.response?.status === 404) {
      console.warn("⚠️ Sentry Polling 404: Check Organization/Project Slugs!");
    } else if (error.message.includes('ECONNREFUSED')) {
      console.warn("⚠️ Sentry service unreachable");
    } else {
      console.error("⚠️ Sentry Polling Error:", error.message);
    }
  }
}

// Start Polling Loop (Every 30 Seconds) - only if enabled
if (SENTRY_ENABLED) {
  setInterval(pollSentryIssues, 30 * 1000);
  pollSentryIssues(); // Run immediately on start
}

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`   - Sentry Poller: ${SENTRY_ENABLED ? '🟢 Active' : '🔴 Disabled (enable in .env with SENTRY_POLLING_ENABLED=true)'}`);
});
