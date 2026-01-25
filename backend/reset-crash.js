
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetCrash() {
    try {
        // Delete the crash related to window.dart assertion so it gets re-processed
        const result = await prisma.processedCrash.deleteMany({
            where: {
                errorMessage: { contains: "Assertion failed" }
            }
        });

        console.log(`Deleted ${result.count} crashes. Sentry poller should pick them up again.`);
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

resetCrash();
