const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function showLatest() {
    const crashes = await prisma.processedCrash.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: { id: true, errorMessage: true, componentId: true, analysisStatus: true }
    });
    console.log(JSON.stringify(crashes, null, 2));
    await prisma.$disconnect();
}
showLatest();
