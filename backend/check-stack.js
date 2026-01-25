
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkStack() {
    const crash = await prisma.processedCrash.findFirst({
        where: { errorMessage: { contains: "Assertion failed" } },
        orderBy: { createdAt: 'desc' }
    });
    if (crash) {
        console.log(crash.stackTrace);
    }
}

checkStack();
