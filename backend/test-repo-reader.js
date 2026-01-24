const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" });

// Recursive function to get all code files
function getFiles(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
                getFiles(filePath, fileList);
            }
        } else {
            if (file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.css')) {
                fileList.push(filePath);
            }
        }
    });
    return fileList;
}

async function testRepoContext() {
    console.log("📂 Scanning Demo App Repo...");

    const demoAppPath = path.resolve(__dirname, '../demo-app/src');
    const files = getFiles(demoAppPath);

    console.log(`   - Found ${files.length} source files.`);

    let fullContext = "";
    files.forEach(f => {
        const content = fs.readFileSync(f, 'utf8');
        const relativeName = path.relative(demoAppPath, f);
        fullContext += `\n--- FILE: ${relativeName} ---\n${content}\n`;
    });

    console.log(`   - Total Context Size: ${fullContext.length} characters.`);
    console.log("🧠 Sending to Gemini 1.5 Flash (1M Context Window)...");

    try {
        const prompt = `
      You are analysing a Codebase.
      Here is the entire source code of the project:
      
      ${fullContext}
      
      QUESTION:
      1. What does this app do?
      2. List the components involved in the checkout flow.
      3. Is there any "CrashGuard" protection implemented? Where?
      `;

        const result = await model.generateContent(prompt);
        console.log("\n🤖 GEMINI ANALYSIS:\n");
        console.log(result.response.text());

    } catch (e) {
        console.error("Gemini Error:", e.message);
    }
}

testRepoContext();
