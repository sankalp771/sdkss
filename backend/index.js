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
 * 4. List All Components (Admin & Debug)
 * GET /api/components?project_id=...
 */
app.get('/api/components', async (req, res) => {
  const { project_id, api_key } = req.query;

  try {
    let whereClause = {};
    if (project_id) {
      whereClause.projectId = project_id;
    } else if (api_key) {
      // Look up project by key
      const project = await prisma.project.findUnique({ where: { apiKey: api_key } });
      if (!project) return res.status(404).json({ error: "Project not found" });
      whereClause.projectId = project.id;
    } else {
      // For hackathon simplicity, if no param, just return EVERYTHING (or limiting to first project)
      // return res.status(400).json({ error: "Missing project_id or api_key" });
    }

    const components = await prisma.component.findMany({
      where: whereClause,
      include: {
        _count: {
          select: { processedCrashes: true }
        }
      }
    });

    res.json(components);
  } catch (error) {
    console.error("Fetch Components Error:", error);
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
const SENTRY_AUTH_TOKEN = "018d1a0ddcdc56b902fbdf1e12463c1df15d45a000291708f8210034cfce04eb";
const ORG_SLUG = "sankalp-lk"; // Deduced from your screenshots
const PROJECT_SLUG = "open-safe-box"; // Default Flutter project name seen in screenshot

async function pollSentryIssues() {
  try {
    // console.log("🕵️ Polling Sentry for new issues...");
    const url = `https://sentry.io/api/0/projects/${ORG_SLUG}/${PROJECT_SLUG}/issues/?query=is:unresolved`;

    const response = await axios.get(url, {
      headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` }
    });

    const issues = response.data;
    // console.log(`   - Found ${issues.length} unresolved issues.`);

    for (const issue of issues) {
      // Check if we already have this crash
      const exists = await prisma.processedCrash.findFirst({
        where: { firebaseEventId: `sentry-${issue.id}` }
      });

      if (!exists) {
        console.log(`🔥 New Sentry Issue Found: ${issue.title}`);

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
        });
      }
    }

  } catch (error) {
    if (error.response?.status === 404) {
      console.warn("⚠️ Sentry Polling 404: Check Organization/Project Slugs!");
    } else {
      console.error("⚠️ Sentry Polling Error:", error.message);
    }
  }
}

// Start Polling Loop (Every 30 Seconds)
setInterval(pollSentryIssues, 30 * 1000);
pollSentryIssues(); // Run immediately on start

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`   - Sentry Poller Active 🟢`);
});
