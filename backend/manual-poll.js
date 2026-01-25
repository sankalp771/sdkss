
const axios = require('axios');
require('dotenv').config();

const SENTRY_AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN;
const ORG_SLUG = "sankalp-lk";
const PROJECT_SLUG = "open-safe-box";

async function checkSentry() {
    const url = `https://sentry.io/api/0/projects/${ORG_SLUG}/${PROJECT_SLUG}/issues/?query=is:unresolved`;

    console.log(`Checking Sentry: ${url}`);
    try {
        const response = await axios.get(url, { headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` } });
        const issues = response.data;
        console.log(`Found ${issues.length} unresolved issues.`);
        issues.forEach(i => console.log(` - ${i.title} (ID: ${i.id})`));
    } catch (error) {
        if (error.response) {
            console.error(`Sentry Error: ${error.response.status} ${error.response.statusText}`);
            console.error(JSON.stringify(error.response.data, null, 2));
        } else {
            console.error(`Error: ${error.message}`);
        }
    }
}

checkSentry();
