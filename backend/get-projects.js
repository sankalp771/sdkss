const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    const projects = await prisma.project.findMany();
    console.log("Projects:", JSON.stringify(projects, null, 2));
}

check();
