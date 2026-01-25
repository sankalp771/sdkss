const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const crashes = await prisma.processedCrash.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            fileName: true,
            errorLine: true,
            errorMessage: true
        }
    });

    console.log(JSON.stringify(crashes, null, 2));
    await prisma.$disconnect();
}

check();
