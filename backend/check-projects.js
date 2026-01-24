const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProjects() {
    const projects = await prisma.project.findMany();
    console.log('Projects in database:');
    console.log(JSON.stringify(projects, null, 2));

    if (projects.length === 0) {
        console.log('\n⚠️ No projects found! You need to create a project first.');
    }

    await prisma.$disconnect();
}

checkProjects().catch(console.error);
