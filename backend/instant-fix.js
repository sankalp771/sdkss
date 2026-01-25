const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { randomUUID } = require('crypto');
const { manualProcessCrash } = require('./manual-crash-processor');

async function instantFix() {
    console.log('🚀 Receiving new crash from Sentry (Simulated)...');

    // 1. Create the crash (simulating Sentry polling)
    const newCrashId = randomUUID();
    const crash = await prisma.processedCrash.create({
        data: {
            id: newCrashId,
            projectId: "3a40c689-e89f-441c-976d-086e63cc0fc6",
            errorMessage: "FormatException: FormatException: Sentry Test: Manual crash at counter 5",
            stackTrace: "FormatException: Crash at 5\nlib/main.dart in _incrementCounter at line 95:7",
            eventCount: 1,
            appVersion: "1.0.0",
            analysisStatus: "pending"
        }
    });
    console.log(`✅ Crash Logged in DB: ${newCrashId}`);
    console.log(`   Message: ${crash.errorMessage}`);

    // 2. Process it IMMEDIATELY via our robust pipeline
    console.log('\n⚙️ Processing immediately...');
    const result = await manualProcessCrash(newCrashId);

    if (result.success) {
        console.log('\n🎉 SUCCESS! Crash moved to ComponentErrors table.');
        console.log(`   ActionId: ${result.actionId}`);
        console.log(`   ComponentError ID: ${result.componentErrorId}`);
    } else {
        console.log(`\n❌ Failed: ${result.error}`);
    }

    await prisma.$disconnect();
}

instantFix();
