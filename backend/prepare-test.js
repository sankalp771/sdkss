const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { randomUUID } = require('crypto');

async function resetAndTest() {
    console.log('🧹 Cleaning up garbage crashes...');

    // 1. Delete crashes that failed parsing or fetching (Garbage)
    await prisma.processedCrash.deleteMany({
        where: {
            OR: [
                { fileName: 'frame_service.dart' },
                { fileName: 'unknown' },
                { fileName: null }
            ]
        }
    });

    // 2. Insert a FRESH, VALID test crash
    const projectId = "3a40c689-e89f-441c-976d-086e63cc0fc6"; // Your project
    const newCrashId = randomUUID();

    console.log('🌱 Creating NEW valid test crash...');
    await prisma.processedCrash.create({
        data: {
            id: newCrashId,
            projectId: projectId,
            errorMessage: "Sentry Test: Automatic API Flow Crash",
            // Valid stack trace pointing to line 95 of main.dart
            stackTrace: "FormatException: Test Crash\nlib/main.dart in _incrementCounter at line 95:7",
            eventCount: 1,
            appVersion: "1.0.0",
            analysisStatus: "pending"
        }
    });

    console.log(`✅ Ready! Created Crash ID: ${newCrashId}`);
    console.log('👉 NOW Go to Postman and POST /api/crashes/process-all');
    console.log('   It should find 1 crash and SUCCEED.');

    await prisma.$disconnect();
}

resetAndTest();
