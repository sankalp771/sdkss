const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Update crash statistics for a single component
 * Sums up eventCount from all related ComponentErrors and updates totalCrashCount
 * @param {string} componentId 
 */
async function updateComponentStats(componentId) {
    try {
        // 1. Get all errors for this component
        const errors = await prisma.componentError.findMany({
            where: { componentId: componentId },
            select: { eventCount: true }
        });

        // 2. Calculate total crash count
        const totalCrashes = errors.reduce((sum, error) => sum + (error.eventCount || 1), 0);

        // 3. Update Component record
        const updatedComponent = await prisma.component.update({
            where: { id: componentId },
            data: {
                totalCrashCount: totalCrashes,
                updatedAt: new Date()
            }
        });

        console.log(`✅ Updated Component ${updatedComponent.name} (${componentId})`);
        console.log(`   - Errors found: ${errors.length}`);
        console.log(`   - Total crash count: ${totalCrashes}`);

        return updatedComponent;

    } catch (error) {
        console.error(`❌ Failed to update component stats for ${componentId}:`, error);
        throw error;
    }
}

/**
 * Update stats for ALL components in the system
 */
async function updateAllComponentsStats() {
    try {
        const components = await prisma.component.findMany({
            select: { id: true, name: true }
        });

        console.log(`🔄 Updating stats for ${components.length} components...`);

        const results = [];
        for (const comp of components) {
            try {
                const result = await updateComponentStats(comp.id);
                results.push({
                    id: comp.id,
                    name: comp.name,
                    success: true,
                    totalCrashCount: result.totalCrashCount
                });
            } catch (err) {
                results.push({
                    id: comp.id,
                    name: comp.name,
                    success: false,
                    error: err.message
                });
            }
        }

        return results;

    } catch (error) {
        console.error('❌ Failed to update all components:', error);
        throw error;
    }
}

module.exports = {
    updateComponentStats,
    updateAllComponentsStats
};
