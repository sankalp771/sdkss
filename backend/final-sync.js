const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function finishLine() {
    console.log('🏁 Final Sync: Mapping Errors ➔ Components...');

    // Get all components
    const components = await prisma.component.findMany();

    for (const comp of components) {
        // Find all errors for this component
        const errors = await prisma.componentError.findMany({
            where: { componentId: comp.id }
        });

        const errorCount = errors.length;
        const totalCrashes = errors.reduce((sum, err) => sum + (err.eventCount || 1), 0);

        console.log(`📡 Component: ${comp.name} | Errors: ${errorCount} | Total Crashes: ${totalCrashes}`);

        // Update status and crash count
        await prisma.component.update({
            where: { id: comp.id },
            data: {
                totalCrashCount: totalCrashes,
                status: totalCrashes > 0 ? (totalCrashes >= 3 ? 'maintenance' : 'active') : 'active'
            }
        });
    }

    console.log('\n✅ READY! All components are fully synchronized with their errors.');
    console.log('Everything is 100% complete.');
    await prisma.$disconnect();
}

finishLine();
