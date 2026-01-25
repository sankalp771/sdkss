const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function findCrash() {
    const crash = await prisma.processedCrash.findFirst({
        where: {
            errorMessage: {
                contains: "counter 5"
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    if (crash) {
        console.log(`FOUND_ID:${crash.id}`);
        console.log(`MSG:${crash.errorMessage}`);
    } else {
        console.log("NOT_FOUND");
    }

    await prisma.$disconnect();
}

findCrash();
