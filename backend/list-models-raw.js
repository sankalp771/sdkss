const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;

async function listModelsRaw() {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;
        const response = await axios.get(url);
        console.log("Available Models:");
        response.data.models.forEach(m => {
            if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes("generateContent")) {
                console.log(` - ${m.name}`);
            }
        });
    } catch (error) {
        console.error("List Error:", error.response ? error.response.data : error.message);
    }
}

listModelsRaw();
