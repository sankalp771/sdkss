/**
 * Crash Processor - Main Orchestrator
 * Ties together stack parsing, GitHub fetching, AI analysis, and database updates
 */

const { PrismaClient } = require('@prisma/client');
const { parseStackTrace, getAllUserFiles } = require('./stack-parser');
const { fetchGitHubFile, searchFileInRepo } = require('./github-fetcher');
const { analyzeCodeForActionId } = require('./gemini-analyzer');

const prisma = new PrismaClient();

/**
 * Process a crash and extract component information
 * @param {number} crashId - ProcessedCrash ID
 * @returns {Object} Processing result
 */
async function processCrash(crashId) {
    try {
        console.log(`\n🔍 Processing Crash ID: ${crashId}`);

        // 1. Get crash from database
        const crash = await prisma.processedCrash.findUnique({
            where: { id: crashId }
        });

        if (!crash) {
            throw new Error(`Crash ${crashId} not found`);
        }

        if (!crash.stackTrace) {
            console.log('⚠️ No stack trace available, skipping');
            return { success: false, reason: 'No stack trace' };
        }

        // 2. Parse stack trace
        console.log('📋 Parsing stack trace...');
        const crashLocation = parseStackTrace(crash.stackTrace);

        if (!crashLocation) {
            console.log('⚠️ Could not parse stack trace');
            return { success: false, reason: 'Stack trace parsing failed' };
        }

        console.log(`   📍 Found: ${crashLocation.fileName}:${crashLocation.lineNumber} in ${crashLocation.functionName}`);

        // 3. Fetch code from GitHub
        console.log('📥 Fetching code from GitHub...');
        let codeData = await fetchGitHubFile(crashLocation.fileName, crashLocation.lineNumber, 15);

        // If not found, try searching for the file
        if (!codeData) {
            console.log('   🔎 File not found at default path, searching...');
            const searchResults = await searchFileInRepo(crashLocation.fileName);

            if (searchResults.length > 0) {
                console.log(`   ✅ Found file at: ${searchResults[0]}`);
                codeData = await fetchGitHubFile(searchResults[0], crashLocation.lineNumber, 15);
            }
        }

        if (!codeData) {
            console.log('⚠️ Could not fetch code from GitHub');
            return { success: false, reason: 'GitHub fetch failed' };
        }

        console.log(`   ✅ Fetched ${codeData.endLine - codeData.startLine + 1} lines`);

        // 4. Analyze with Gemini AI
        console.log('🤖 Analyzing code with Gemini AI...');
        const analysis = await analyzeCodeForActionId(
            crashLocation.fileName,
            crashLocation.lineNumber,
            codeData.content,
            crashLocation.functionName
        );

        console.log(`   🎯 ActionId: ${analysis.actionId ? `"${analysis.actionId}"` : 'NOT FOUND'} (confidence: ${analysis.confidence})`);
        console.log(`   💡 Reasoning: ${analysis.reasoning}`);

        // Check if actionId was actually found
        if (!analysis.actionId || analysis.confidence === 'none') {
            console.log('⚠️ No actionId found in code - skipping component creation');

            // Update crash with analysis metadata only
            await prisma.processedCrash.update({
                where: { id: crashId },
                data: {
                    geminiAnalysis: {
                        ...crash.geminiAnalysis,
                        actionId: null,
                        confidence: analysis.confidence,
                        reasoning: analysis.reasoning,
                        fileName: crashLocation.fileName,
                        lineNumber: crashLocation.lineNumber,
                        automated: true,
                        noActionIdFound: true
                    }
                }
            });

            return {
                success: false,
                reason: 'No actionId found in code',
                crashId,
                analysis
            };
        }

        // 5. Find or create Component (only if actionId exists)
        console.log('🔧 Finding/creating component...');
        let component = await prisma.component.findFirst({
            where: {
                projectId: crash.projectId,
                identifier: analysis.actionId
            }
        });

        if (!component) {
            console.log(`   ➕ Creating new component: ${analysis.actionId}`);
            component = await prisma.component.create({
                data: {
                    projectId: crash.projectId,
                    identifier: analysis.actionId,
                    name: analysis.componentId || analysis.actionId,
                    status: 'active',
                    crashThreshold: 3
                }
            });
        } else {
            console.log(`   ✅ Found existing component: ${component.name}`);
        }

        // 6. Create ComponentError record
        console.log('💾 Creating ComponentError record...');
        const componentError = await prisma.componentError.create({
            data: {
                componentId: component.id,
                projectId: crash.projectId,
                actionId: analysis.actionId,
                appVersion: crash.appVersion || 'unknown',
                errorMessage: crash.errorMessage,
                errorType: 'runtime_error',
                stackTrace: crash.stackTrace,
                metadata: {
                    fileName: crashLocation.fileName,
                    lineNumber: crashLocation.lineNumber,
                    functionName: crashLocation.functionName,
                    confidence: analysis.confidence,
                    reasoning: analysis.reasoning,
                    foundAtLine: analysis.foundAtLine,
                    suggestedFix: analysis.suggestedFix,
                    codeContext: codeData.content
                }
            }
        });

        // 7. Update ProcessedCrash with componentId link
        console.log('🔗 Linking crash to component...');
        await prisma.processedCrash.update({
            where: { id: crashId },
            data: {
                componentId: component.id,
                geminiAnalysis: {
                    ...crash.geminiAnalysis,
                    actionId: analysis.actionId,
                    componentName: component.name,
                    confidence: analysis.confidence,
                    foundAtLine: analysis.foundAtLine,
                    automated: true
                }
            }
        });

        console.log('✅ Crash processing complete!\n');

        return {
            success: true,
            crashId,
            componentId: component.id,
            actionId: analysis.actionId,
            componentErrorId: componentError.id,
            analysis
        };

    } catch (error) {
        console.error(`❌ Error processing crash ${crashId}:`, error.message);
        return {
            success: false,
            crashId,
            error: error.message
        };
    }
}

/**
 * Process all unprocessed crashes
 * @returns {Array} Array of processing results
 */
async function processAllUnprocessedCrashes() {
    try {
        // Find crashes without componentId
        const unprocessedCrashes = await prisma.processedCrash.findMany({
            where: {
                componentId: null,
                stackTrace: { not: null }
            },
            orderBy: { createdAt: 'desc' },
            take: 10 // Process in batches
        });

        console.log(`\n🎯 Found ${unprocessedCrashes.length} unprocessed crashes`);

        const results = [];
        for (const crash of unprocessedCrashes) {
            const result = await processCrash(crash.id);
            results.push(result);

            // Small delay to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        return results;

    } catch (error) {
        console.error('Batch processing error:', error);
        return [];
    }
}

module.exports = {
    processCrash,
    processAllUnprocessedCrashes
};
