const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkSync() {
    console.log('🔍 Checking if "counter 6" reached the tables...');

    // 1. Find the error
    const error = await prisma.componentError.findFirst({
        where: {
            errorMessage: { contains: "counter 6" }
        },
        include: {
            component: true
        }
    });

    if (error) {
        console.log(`✅ FOUND in ComponentError (ID: ${error.id})`);
        console.log(`📡 Linked to COMPONENT: ${error.component.name} (Identifier: ${error.component.identifier})`);
        console.log(`🏥 Component Status: ${error.component.status}`);
    } else {
        console.log('❌ NOT FOUND in ComponentError. Triggering manual process...');
    }

    await prisma.$disconnect();
}

checkSync();
