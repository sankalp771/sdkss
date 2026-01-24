const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const crashes = await prisma.processedCrash.findMany({
        orderBy: { createdAt: 'desc' },
        take: 3
    });
    console.log(JSON.stringify(crashes, null, 2));
}

check();
