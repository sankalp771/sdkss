const axios = require('axios');
const fs = require('fs');

const SENTRY_AUTH_TOKEN = "018d1a0ddcdc56b902fbdf1e12463c1df15d45a000291708f8210034cfce04eb";
// ISSUE_ID is dynamically fetched below

async function debugSentry() {
    console.log(`fetching list of issues...`);
    try {
        // 1. Get List
        const listUrl = `https://sentry.io/api/0/projects/sankalp-lk/open-safe-box/issues/`;
        const listRes = await axios.get(listUrl, {
            headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` }
        });

        if (listRes.data.length === 0) {
            console.log("No issues found.");
            return;
        }

        const firstIssue = listRes.data[0];
        console.log(`Found Issue ID: ${firstIssue.id} (${firstIssue.title})`);

        // 2. Get Detail
        const url = `https://sentry.io/api/0/issues/${firstIssue.id}/events/latest/`;
        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${SENTRY_AUTH_TOKEN}` }
        });

        fs.writeFileSync('sentry_response.json', JSON.stringify(res.data, null, 2));
        console.log("Saved event to sentry_response.json");

        // --- Extraction Logic ---
        const eventData = res.data;
        let fullStackTrace = "No Stack Trace Found";

        try {
            let values = [];
            if (eventData.exception && eventData.exception.values) {
                values = eventData.exception.values;
            } else if (eventData.entries) {
                const excEntry = eventData.entries.find(e => e.type === 'exception');
                if (excEntry && excEntry.data && excEntry.data.values) {
                    values = excEntry.data.values;
                }
            }

            if (values.length > 0) {
                fullStackTrace = values.map(val => {
                    const header = `${val.type}: ${val.value}\n`;
                    const frames = (val.stacktrace && val.stacktrace.frames)
                        ? val.stacktrace.frames.map(f => {
                            const func = f.function || '<anonymous>';
                            const file = f.filename || 'unknown';
                            const pkg = f.package ? ` within ${f.package}` : '';
                            // Match Sentry UI format: "main.dart in <fn> at line 113:12 within app_to_test_sdk"
                            return `${file} in ${func} at line ${f.lineNo}:${f.colNo}${pkg}`;
                        }).reverse().join('\n')
                        : '  (No frames available)';
                    return header + frames;
                }).join('\n\n');
            }
        } catch (err) {
            fullStackTrace = `Extraction Error: ${err.message}`;
        }

        fs.writeFileSync('extracted_stack.txt', fullStackTrace);
        console.log("✅ Extracted stack trace saved to 'extracted_stack.txt'");

    } catch (e) {
        console.error("Error:", e.message);
        if (e.response) console.error(e.response.data);
    }
}

debugSentry();
