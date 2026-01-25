require('dotenv').config();
const { fetchGitHubFile, searchFileInRepo } = require('./github-fetcher');

async function test() {
    console.log('🔍 Testing GitHub Fetcher...');
    console.log(`Repo: ${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}`);
    console.log(`Branch: ${process.env.GITHUB_BRANCH}`);
    console.log(`Token Present: ${!!process.env.GITHUB_TOKEN}`); // Don't log the token!

    try {
        // Test 1: Fetch specific file
        console.log('\n--- Test 1: Fetch lib/main.dart ---');
        const file = 'lib/main.dart';
        const result = await fetchGitHubFile(file, 95, 5);

        if (result) {
            console.log('✅ Success!');
            console.log(`Fetched lines ${result.startLine}-${result.endLine}`);
            console.log('Content preview:', result.content.substring(0, 50) + '...');
        } else {
            console.log('❌ Failed to fetch file directly.');
        }

        // Test 2: Search for file (if direct fetch fails)
        console.log('\n--- Test 2: Search for main.dart ---');
        const search = await searchFileInRepo('main.dart');
        console.log('Search results:', search);

    } catch (error) {
        console.error('❌ Error during test:', error);
    }
}

test();
