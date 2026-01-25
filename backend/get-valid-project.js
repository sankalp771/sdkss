
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function getProjects() {
    try {
        const projects = await prisma.project.findMany();
        console.log(`Found ${projects.length} projects.`);
        if (projects.length > 0) {
            projects.forEach(p => console.log(` - ID: ${p.id}, Name: ${p.name}, API Key: ${p.apiKey}`));
        } else {
            console.log("No projects found. Creating default...");
            const newProject = await prisma.project.create({
                data: {
                    name: "Open Safe Box",
                    apiKey: "demo-api-key-" + Date.now()
                }
            });
            console.log(`Created Project: ${newProject.id}`);
        }
    } catch (error) {
        console.error("Error:", error);
    } finally {
        await prisma.$disconnect();
    }
}

getProjects();
