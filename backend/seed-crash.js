const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { randomUUID } = require('crypto');

async function seed() {
    console.log('🌱 Seeding 1 Pending Crash...');

    // Create valid crash for main.dart
    const id = randomUUID();
    await prisma.processedCrash.create({
        data: {
            id: id,
            projectId: "3a40c689-e89f-441c-976d-086e63cc0fc6",
            errorMessage: "Sentry Test: API Trigger Verification",
            stackTrace: "FormatException: API Test\nlib/main.dart in _incrementCounter at line 95:7",
            eventCount: 1,
            appVersion: "1.0.0",
            analysisStatus: "pending",
            // componentId is NULL (Pending)
        }
    });

    console.log(`✅ Seeded Crash ID: ${id}`);
    console.log('👉 It is now PENDING. Go to Postman and hit the API to process it!');
    await prisma.$disconnect();
}

seed();
