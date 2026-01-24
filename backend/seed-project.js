const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function seed() {
    try {
        const project = await prisma.project.create({
            data: {
                id: "41ed4c1c-683d-4ccc-a526-0d8cb7a015c8", // Use the hardcoded ID to match index.js
                name: "Sentry Integration",
                apiKey: "project_api_key_12345"
            }
        });
        console.log("Created Project:", project);
    } catch (e) {
        console.error("Error creating project:", e);
    }
}

seed();
