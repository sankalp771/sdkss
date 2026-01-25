/**
 * Crash Processor - Main Orchestrator
 * Ties together stack parsing, GitHub fetching, AI analysis, and database updates
 */

const { PrismaClient } = require('@prisma/client');
const { parseStackTrace, getAllUserFiles } = require('./stack-parser');
const { fetchGitHubFile, searchFileInRepo, searchCodeInRepo } = require('./github-fetcher');
const { analyzeCodeForActionId } = require('./gemini-analyzer');
const { extractActionIdFromCode } = require('./manual-crash-processor'); // ✅ Import proven logic

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

        // 2. Parse stack trace (Always re-parse to ensure latest parser logic is used)
        console.log('📋 Parsing stack trace...');
        // Force re-parse instead of relying on DB to fix legacy junk (like frame_service.dart)
        let crashLocation = parseStackTrace(crash.stackTrace);

        // FALLBACK: If parsing failed (e.g. stack is "/"), try to infer from Error Message
        if (!crashLocation) {
            console.log('⚠️ Stack trace parsing failed. Attempting fallback strategy...');

            // 1. Search for unique string in error message (e.g. "Manual crash")
            // Strip "Exception:" prefixes and grab a chunk
            const cleanMsg = crash.errorMessage.split(':')[1]?.trim() || crash.errorMessage;
            const query = cleanMsg.substring(0, 30); // Search first 30 chars

            if (query.length > 5) {
                console.log(`   🔎 Searching repo for error text: "${query}"...`);
                const files = await searchCodeInRepo(query);
                if (files && files.length > 0) {
                    console.log(`   ✅ Found file matching error message: ${files[0]}`);
                    crashLocation = {
                        fileName: files[0],
                        lineNumber: 1,
                        functionName: 'unknown'
                    };
                }
            }

            // 2. Hard fallback for "Sentry Test" or if nothing found
            if (!crashLocation && crash.errorMessage.includes('Sentry Test')) {
                console.log('   ⚠️ Detected Sentry Test - defaulting to lib/main.dart');
                crashLocation = { fileName: 'lib/main.dart', lineNumber: 1, functionName: 'test' };
            }
        }

        if (!crashLocation) {
            console.log('⚠️ Could not parse stack trace (or all files were ignored)');
            return { success: false, reason: 'Stack trace parsing failed' };
        }

        console.log(`   📍 Found: ${crashLocation.fileName}:${crashLocation.lineNumber} in ${crashLocation.functionName}`);

        // Update ProcessedCrash with file info immediately
        await prisma.processedCrash.update({
            where: { id: crashId },
            data: {
                fileName: crashLocation.fileName,
                errorLine: crashLocation.lineNumber
            }
        });

        // 3. Fetch code from GitHub
        console.log(`📥 Fetching code from GitHub (${crashLocation.fileName})...`);
        let codeData = await fetchGitHubFile(crashLocation.fileName, crashLocation.lineNumber, 15);

        // If not found, try searching for the file
        if (!codeData) {
            console.log('   🔎 File fetch failed. Attempting intelligent search...');

            // Strategy 1: Search by filename
            let searchResults = await searchFileInRepo(crashLocation.fileName);

            // Strategy 2: If filename failed, search by FUNCTION NAME
            if ((!searchResults || searchResults.length === 0) && crashLocation.functionName && crashLocation.functionName !== 'unknown') {
                console.log(`   🔎 Searching for function: "${crashLocation.functionName}"...`);
                searchResults = await searchCodeInRepo(crashLocation.functionName);
            }

            if (searchResults && searchResults.length > 0) {
                console.log(`   ✅ Found file via search: ${searchResults[0]}`);
                // Use the new filename
                crashLocation.fileName = searchResults[0];
                // We don't know the exact line anymore, so fetch Context or Top of file
                codeData = await fetchGitHubFile(searchResults[0], crashLocation.lineNumber || 1, 30);
            }
        }

        if (!codeData) {
            console.log('⚠️ Could not fetch code from GitHub');
            return { success: false, reason: 'GitHub fetch failed' };
        }

        console.log(`   ✅ Fetched ${codeData.totalLines} lines (Full content size: ${codeData.fullContent.length} chars)`);

        // 4. Analyze Code (Try Direct Regex First - Using Proven Manual Logic)
        console.log('🤖 Analyzing code...');

        let analysis = {
            actionId: null,
            confidence: 'none',
            reasoning: '',
            method: 'none',
            foundAtLine: null,
            suggestedFix: null
        };

        // Attempt 1: Manual Regex
        const regexHack = extractActionIdFromCode(codeData.fullContent || codeData.content);

        if (regexHack) {
            analysis = {
                actionId: regexHack.actionId,
                confidence: regexHack.confidence, // 'high'/'medium'
                reasoning: `Extracted directly via regex: ${regexHack.pattern}`,
                method: 'manual_regex_imported', // Mark as using the imported logic
                foundAtLine: null,
                suggestedFix: null
            };
            console.log(`   ✅ Direct match found: "${analysis.actionId}"`);
        }

        // Attempt 2: Gemini AI (Fallback if regex failed)
        if (!analysis.actionId) {
            console.log('   ⚠️ No regex match, trying Gemini AI...');
            try {
                const aiAnalysis = await analyzeCodeForActionId(
                    crashLocation.fileName,
                    crashLocation.lineNumber,
                    codeData.content,
                    crashLocation.functionName
                );
                analysis = { ...aiAnalysis, method: 'gemini_ai' };
            } catch (err) {
                console.error(`   ❌ Gemini analysis failed: ${err.message}`);
                analysis.reasoning = `Analysis failed: ${err.message}`;
            }
        }

        console.log(`   🎯 ActionId: ${analysis.actionId ? `"${analysis.actionId}"` : 'NOT FOUND'} (confidence: ${analysis.confidence})`);

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
                    crashThreshold: 3,
                    appVersion: crash.appVersion
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
                eventCount: crash.eventCount || 1,
                isRecorded: true,
                recordedTime: new Date(),
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
                    codeContext: codeData.content,
                    method: analysis.method
                }
            }
        });

        // 7. Update ProcessedCrash with componentId link
        console.log('🔗 Linking crash to component...');
        await prisma.processedCrash.update({
            where: { id: crashId },
            data: {
                componentId: component.id,
                isRecorded: true,           // Mark as recorded
                recordedAt: new Date(),      // Timestamp
                geminiAnalysis: {
                    ...crash.geminiAnalysis,
                    actionId: analysis.actionId,
                    componentName: component.name,
                    confidence: analysis.confidence,
                    foundAtLine: analysis.foundAtLine,
                    automated: true,
                    method: analysis.method
                }
            }
        });

        // 8. Update Component Status/Metadata (Final Sync)
        console.log('📊 Syncing Component health status and crash count...');
        const allErrors = await prisma.componentError.findMany({
            where: { componentId: component.id }
        });

        const totalCrashes = allErrors.reduce((sum, err) => sum + (err.eventCount || 1), 0);

        await prisma.component.update({
            where: { id: component.id },
            data: {
                totalCrashCount: totalCrashes,
                status: totalCrashes >= 3 ? 'maintenance' : 'active'
            }
        });

        console.log(`✅ Crash processing complete! Total Crashes: ${totalCrashes}\n`);

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
