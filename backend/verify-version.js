const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verify() {
    const error = await prisma.componentError.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    console.log('\n✅ Latest ComponentError:');
    console.log(`   AppVersion: "${error.appVersion}"`);
    console.log(`   ActionId: ${error.actionId}`);

    const crash = await prisma.processedCrash.findFirst({
        orderBy: { createdAt: 'desc' }
    });

    console.log('\n✅ Latest ProcessedCrash:');
    console.log(`   AppVersion: "${crash.appVersion}"`);

    await prisma.$disconnect();
}

verify().catch(console.error);
