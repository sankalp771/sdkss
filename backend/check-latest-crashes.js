
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkLatestCrashes() {
    try {
        const crashes = await prisma.processedCrash.findMany({
            orderBy: { createdAt: 'desc' },
            take: 5
        });

        console.log(`\n🔍 Found ${crashes.length} recent crashes:\n`);
        crashes.forEach(crash => {
            console.log(`[${crash.id}] ${crash.createdAt.toISOString()}`);
            console.log(`   Error: ${crash.errorMessage}`);
            console.log(`   Status: ${crash.analysisStatus}`);
            console.log(`   Component: ${crash.componentId}`);
            if (crash.geminiAnalysis) {
                console.log(`   ✨ Analysis: Present`);
            }
            console.log('---------------------------------------------------');
        });

        if (crashes.length === 0) {
            console.log("No crashes found in the database yet.");
        }
    } catch (error) {
        console.error("Error checking crashes:", error);
    } finally {
        await prisma.$disconnect();
    }
}

checkLatestCrashes();
