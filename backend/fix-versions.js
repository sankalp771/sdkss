const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixVersions() {
    // Get all crashes with appVersion containing brackets
    const crashes = await prisma.processedCrash.findMany({
        where: {
            appVersion: { contains: '(' }
        }
    });

    console.log(`Found ${crashes.length} crashes with bracketed versions\n`);

    for (const crash of crashes) {
        const oldVersion = crash.appVersion;
        let newVersion = oldVersion;

        // Remove package prefix if present
        if (newVersion.includes('@')) {
            newVersion = newVersion.split('@')[1];
        }

        // Remove build number (everything after +)
        if (newVersion.includes('+')) {
            newVersion = newVersion.split('+')[0];
        }

        // Remove brackets format " (1)" -> ""
        if (newVersion.includes(' (')) {
            newVersion = newVersion.split(' (')[0];
        }

        console.log(`Updating: "${oldVersion}" -> "${newVersion}"`);

        await prisma.processedCrash.update({
            where: { id: crash.id },
            data: { appVersion: newVersion }
        });
    }

    // Also fix ComponentErrors
    const errors = await prisma.componentError.findMany({
        where: {
            appVersion: { contains: '(' }
        }
    });

    console.log(`\nFound ${errors.length} component errors with bracketed versions\n`);

    for (const error of errors) {
        const oldVersion = error.appVersion;
        let newVersion = oldVersion;

        if (newVersion.includes('@')) {
            newVersion = newVersion.split('@')[1];
        }
        if (newVersion.includes('+')) {
            newVersion = newVersion.split('+')[0];
        }
        if (newVersion.includes(' (')) {
            newVersion = newVersion.split(' (')[0];
        }

        console.log(`Updating Error: "${oldVersion}" -> "${newVersion}"`);

        await prisma.componentError.update({
            where: { id: error.id },
            data: { appVersion: newVersion }
        });
    }

    console.log('\n✅ All versions updated!');
    await prisma.$disconnect();
}

fixVersions().catch(console.error);
