const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    console.log("🌱 Starting Seed...");

    // 1. Create a Dummy Project
    const project = await prisma.project.upsert({
        where: { apiKey: 'demo-key' },
        update: {},
        create: {
            name: 'CrashGuard Demo App',
            apiKey: 'demo-key',
            firebaseProjectId: 'betterfit-8877e',
        },
    });
    console.log(`✅ Created Project: ${project.name} (${project.id})`);

    // 2. Create Dummy Components
    const componentsData = [
        { identifier: 'payment-module', name: 'Payment Gateway', status: 'active' },
        { identifier: 'header-nav', name: 'Main Navigation', status: 'active' },
        { identifier: 'checkout-btn', name: 'Checkout Button', status: 'maintenance', fallbackMessage: 'Checkout is currently offline for upgrades.' }
    ];

    for (const comp of componentsData) {
        const record = await prisma.component.upsert({
            where: {
                projectId_identifier: {
                    projectId: project.id,
                    identifier: comp.identifier
                }
            },
            update: {
                status: comp.status,
                fallbackMessage: comp.fallbackMessage
            },
            create: {
                projectId: project.id,
                identifier: comp.identifier,
                name: comp.name,
                status: comp.status,
                fallbackMessage: comp.fallbackMessage
            }
        });
        console.log(`   - upserted component: ${record.identifier}`);
    }

    console.log("🌱 Seeding Finished!");
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
