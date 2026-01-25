/**
 * GitHub File Fetcher
 * Fetches source code from GitHub repository
 */

const axios = require('axios');
require('dotenv').config();

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'sankalp771';
const GITHUB_REPO_NAME = process.env.GITHUB_REPO_NAME || 'app_to_test_sdk';
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';

/**
 * Fetch file content from GitHub
 * @param {string} filePath - Path to file (e.g., "lib/main.dart")
 * @param {number} targetLine - Line number to focus on
 * @param {number} contextLines - Number of lines before/after to include (default: 10)
 * @returns {Object} { content, startLine, endLine, fullContent }
 */
async function fetchGitHubFile(filePath, targetLine = null, contextLines = 10) {
    if (!GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN not configured in .env');
    }

    try {
        // Normalize file path (ensure it starts with lib/ for Flutter projects)
        // Normalize file path
        let normalizedPath = filePath;

        // Handle package: URIs (e.g., "package:my_app/main.dart" -> "lib/main.dart")
        if (normalizedPath.startsWith('package:')) {
            const parts = normalizedPath.split('/');
            // Remove 'package:name' part (index 0)
            if (parts.length > 1) {
                normalizedPath = parts.slice(1).join('/');
            }
        }

        // Ensure lib/ prefix for Dart files if missing (and not test/)
        if (!normalizedPath.startsWith('lib/') && !normalizedPath.startsWith('test/')) {
            normalizedPath = `lib/${normalizedPath}`;
        }

        const url = `https://api.github.com/repos/${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}/contents/${normalizedPath}?ref=${GITHUB_BRANCH}`;

        console.log(`📥 Fetching GitHub file: "${normalizedPath}"`);
        console.log(`   URL: ${url}`); // Debug Log

        const response = await axios.get(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        // Decode base64 content
        const fullContent = Buffer.from(response.data.content, 'base64').toString('utf-8');
        const lines = fullContent.split('\n');

        // If no target line, return full content
        if (!targetLine) {
            return {
                content: fullContent,
                startLine: 1,
                endLine: lines.length,
                fullContent,
                totalLines: lines.length
            };
        }

        // Extract context around target line
        const startLine = Math.max(1, targetLine - contextLines);
        const endLine = Math.min(lines.length, targetLine + contextLines);

        const contextContent = lines
            .slice(startLine - 1, endLine)
            .map((line, idx) => `${startLine + idx}: ${line}`)
            .join('\n');

        return {
            content: contextContent,
            startLine,
            endLine,
            fullContent,
            totalLines: lines.length,
            targetLine
        };

    } catch (error) {
        if (error.response?.status === 404) {
            console.warn(`⚠️ File not found on GitHub: ${filePath}`);
            return null;
        }
        throw error;
    }
}

/**
 * Search for files in repository
 * @param {string} fileName - File name to search for
 * @returns {Array} List of matching file paths
 */
async function searchFileInRepo(fileName) {
    if (!GITHUB_TOKEN) {
        throw new Error('GITHUB_TOKEN not configured in .env');
    }

    try {
        const query = `filename:${fileName} repo:${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;
        const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}`;

        const response = await axios.get(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        return response.data.items.map(item => item.path);
    } catch (error) {
        console.error('GitHub search error:', error.message);
        return [];
    }
}

/**
 * Search for specific code/text in repository
 * @param {string} queryText - Text to search for (e.g., function name)
 * @returns {Array} List of matching file paths
 */
async function searchCodeInRepo(queryText) {
    if (!GITHUB_TOKEN || !queryText || queryText === 'unknown') return [];

    try {
        console.log(`🔎 Searching repo for code: "${queryText}"...`);
        const query = `${queryText} repo:${GITHUB_REPO_OWNER}/${GITHUB_REPO_NAME}`;
        const url = `https://api.github.com/search/code?q=${encodeURIComponent(query)}`;

        const response = await axios.get(url, {
            headers: {
                'Authorization': `token ${GITHUB_TOKEN}`,
                'Accept': 'application/vnd.github.v3+json'
            }
        });

        // Return unique file paths
        return [...new Set(response.data.items.map(item => item.path))];
    } catch (error) {
        console.error('GitHub code search error:', error.message);
        return [];
    }
}

module.exports = {
    fetchGitHubFile,
    searchFileInRepo,
    searchCodeInRepo
};
