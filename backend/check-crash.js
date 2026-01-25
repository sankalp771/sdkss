
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const c = await prisma.processedCrash.findFirst({
        where: { errorMessage: { contains: "Assertion failed" } }
    });
    console.log(c ? "Found it" : "Gone");
}

check();
