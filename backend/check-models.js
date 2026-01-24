const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

// Access your API key as an environment variable (see "Set up your API key" above)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function listModels() {
    try {
        // For Node SDK, unfortunately there isn't a direct listModels() exposed easily in the main class
        // But we can try the most standard model: "gemini-1.0-pro"
        console.log("Trying gemini-1.5-flash-latest...");
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const result = await model.generateContent("Hello");
        console.log("Success with gemini-1.5-flash-latest!");
    } catch (e) {
        console.log("Failed 1.5-flash-latest:", e.message);
    }

    try {
        console.log("Trying gemini-1.0-pro...");
        const model2 = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
        const result2 = await model2.generateContent("Hello");
        console.log("Success with gemini-1.0-pro!");
    } catch (e) {
        console.log("Failed 1.0-pro: " + e.message);
    }
}

listModels();
