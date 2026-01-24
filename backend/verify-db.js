const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Attempting to connect to the Database and pull data...");

    try {
        // 1. Try to fetch all Projects
        console.log("1️⃣  Fetching Projects...");
        const projects = await prisma.project.findMany();
        console.log(`   ✅ Success! Found ${projects.length} projects.`);
        console.table(projects);

        // 2. Try to fetch all Components
        console.log("\n2️⃣  Fetching Components...");
        const components = await prisma.component.findMany();
        console.log(`   ✅ Success! Found ${components.length} components.`);
        console.table(components);

    } catch (error) {
        console.error("\n❌ Error pulling data from DB:");
        console.error(error.message);
        console.log("\n💡 TIP: Check your DATABASE_URL in the .env file!");
    } finally {
        await prisma.$disconnect();
    }
}

main();
