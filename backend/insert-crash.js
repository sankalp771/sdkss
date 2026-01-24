const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

const PROJECT_ID = "41ed4c1c-683d-4ccc-a526-0d8cb7a015c8"; // Default seed project

async function insertCrash() {
    try {
        console.log("📂 Reading crash data...");

        // 1. Read Stack Trace
        let stackTrace = "";
        try {
            stackTrace = fs.readFileSync('extracted_stack.txt', 'utf8');
        } catch (e) {
            console.warn("⚠️ Could not read extracted_stack.txt, using placeholder.");
            stackTrace = "No stack trace available.";
        }

        // 2. Read Sentry JSON (for metadata)
        let eventData = {};
        try {
            const jsonRaw = fs.readFileSync('sentry_response.json', 'utf8');
            eventData = JSON.parse(jsonRaw);
        } catch (e) {
            console.warn("⚠️ Could not read sentry_response.json");
        }

        const title = eventData.title || "Unknown Crash";
        const issueId = eventData.groupID || "unknown_issue";
        const sentryEventId = eventData.eventID || "unknown_event";

        // Extract Sentry User ID (if available)
        const sentryUser = eventData.user || {};
        const userId = sentryUser.id || sentryUser.ip_address || "anonymous";

        // 3. Determine Component (Action ID)
        // We look for actionId in tags or componentId in our logic
        // For now, defaulting to 'unknown_component' which we seeded.
        let componentId = "unknown_component";

        console.log(`👤 Processing for User ID: ${userId}`);

        // 4. Insert into DB
        const result = await prisma.processedCrash.create({
            data: {
                projectId: PROJECT_ID,
                componentId: componentId,
                firebaseEventId: sentryEventId,
                issueId: issueId,
                errorMessage: title,
                stackTrace: stackTrace,
                analysisStatus: 'pending',
                geminiAnalysis: {
                    source: "Standard Push",
                    sentryUser: sentryUser,
                    manualPush: true
                }
            }
        });

        console.log(`✅ Crash Inserted Successfully!`);
        console.log(`   ID: ${result.id}`);
        console.log(`   Project: ${result.projectId}`);
        console.log(`   Stack Length: ${result.stackTrace.length} chars`);

    } catch (e) {
        console.error("❌ Insertion Failed:", e);
    } finally {
        await prisma.$disconnect();
    }
}

insertCrash();
