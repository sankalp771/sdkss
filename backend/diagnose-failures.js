const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function diagnose() {
    console.log('--- DIAGNOSTIC CHECK ---');

    // 1. Check Projects
    const projects = await prisma.project.findMany();
    console.log(`\n1. Projects found: ${projects.length}`);
    projects.forEach(p => console.log(`   - ID: ${p.id}, Name: ${p.name}`));

    // 2. Check Recent ProcessedCrashes
    const recentCrashes = await prisma.processedCrash.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
            component: true
        }
    });

    console.log(`\n2. Recent Crashes (${recentCrashes.length}):`);
    recentCrashes.forEach(c => {
        console.log(`\n   Crash ID: ${c.id}`);
        console.log(`   Project Used: ${c.projectId}`);
        console.log(`   Message: ${c.errorMessage.substring(0, 50)}...`);
        console.log(`   Component Linked: ${c.componentId ? '✅ ' + c.component.name : '❌ NULL'}`);
        console.log(`   Analysis JSON: ${JSON.stringify(c.geminiAnalysis, null, 2)}`);
    });

    await prisma.$disconnect();
}

diagnose().catch(console.error);
