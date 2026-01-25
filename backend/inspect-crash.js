const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkCrash() {
    const id = "1275a410-cc40-4b4a-afc0-896089c5f2c6";
    const crash = await prisma.processedCrash.findUnique({
        where: { id: id }
    });

    if (crash) {
        console.log('--- Crash Details ---');
        console.log(`ID: ${crash.id}`);
        console.log(`Error: ${crash.errorMessage}`);
        console.log(`StackTrace Raw: "${crash.stackTrace}"`);
    } else {
        console.log('Crash NOT FOUND');
    }

    await prisma.$disconnect();
}

checkCrash();
