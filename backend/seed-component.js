const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    try {
        const component = await prisma.component.create({
            data: {
                id: "unknown_component",
                name: "Unknown Component",
                identifier: "unknown_id", // 'identifier' field
                projectId: "41ed4c1c-683d-4ccc-a526-0d8cb7a015c8"
            }
        });
        console.log("Created Component:", component);
    } catch (e) {
        // If it fails, maybe it already exists or needs other fields?
        console.error("Error creating component:", e);
    }
}

seed();
