/**
 * Manual Crash Processor - Bypasses Gemini AI, uses regex extraction
 */

const { PrismaClient } = require('@prisma/client');
const { parseStackTrace } = require('./stack-parser');
const { fetchGitHubFile } = require('./github-fetcher');

const prisma = new PrismaClient();

/**
 * Extract actionId directly from code using regex
 */
function extractActionIdFromCode(code) {
    // Pattern 1: ActionGuard.guard(actionId: 'xxx', ...)
    const pattern1 = /ActionGuard\.(guard|run)\s*\([^)]*actionId:\s*['"]([^'"]+)['"]/s;
    const match1 = code.match(pattern1);
    if (match1) {
        return {
            actionId: match1[2],
            confidence: 'high',
            pattern: 'ActionGuard.guard/run'
        };
    }

    // Pattern 2: Direct actionId: 'xxx'
    const pattern2 = /actionId:\s*['"]([^'"]+)['"]/;
    const match2 = code.match(pattern2);
    if (match2) {
        return {
            actionId: match2[1],
            confidence: 'medium',
            pattern: 'direct actionId'
        };
    }

    return null;
}

/**
 * Manually process crash (no AI dependency)
 */
async function manualProcessCrash(crashId) {
    try {
        console.log(`\n🔧 Manually Processing Crash: ${crashId}\n`);

        // 1. Get crash
        const crash = await prisma.processedCrash.findUnique({
            where: { id: crashId }
        });

        if (!crash) {
            throw new Error('Crash not found');
        }

        console.log(`Error: ${crash.errorMessage}`);

        // 2. Parse stack trace
        const crashLocation = parseStackTrace(crash.stackTrace);
        if (!crashLocation) {
            throw new Error('Could not parse stack trace');
        }

        console.log(`Location: ${crashLocation.fileName}:${crashLocation.lineNumber}`);

        // 3. Fetch code from GitHub
        const codeData = await fetchGitHubFile(crashLocation.fileName, null); // Full file
        if (!codeData) {
            throw new Error('Could not fetch code');
        }

        console.log(`Fetched ${codeData.totalLines} lines of code`);

        // 4. Extract actionId using regex
        const extraction = extractActionIdFromCode(codeData.fullContent);

        if (!extraction) {
            console.log('❌ No actionId found in code');
            return { success: false, reason: 'No actionId in code' };
        }

        console.log(`✅ Found actionId: "${extraction.actionId}" (${extraction.confidence} confidence)`);
        console.log(`   Pattern: ${extraction.pattern}`);

        // 5. Find or create component
        let component = await prisma.component.findFirst({
            where: {
                projectId: crash.projectId,
                identifier: extraction.actionId
            }
        });

        if (!component) {
            console.log(`\n➕ Creating component: ${extraction.actionId}`);
            component = await prisma.component.create({
                data: {
                    projectId: crash.projectId,
                    identifier: extraction.actionId,
                    name: extraction.actionId,
                    status: 'active',
                    crashThreshold: 3
                }
            });
        } else {
            console.log(`\n✅ Found existing component: ${component.name}`);
        }

        // 6. Create or update ComponentError
        console.log('💾 Creating ComponentError...');

        // Check if error already exists
        const existingError = await prisma.componentError.findFirst({
            where: {
                componentId: component.id,
                errorMessage: crash.errorMessage
            }
        });

        let componentError;
        if (existingError) {
            console.log('   Updating existing ComponentError');
            componentError = await prisma.componentError.update({
                where: { id: existingError.id },
                data: {
                    actionId: extraction.actionId,
                    appVersion: crash.appVersion || 'unknown',
                    metadata: {
                        fileName: crashLocation.fileName,
                        lineNumber: crashLocation.lineNumber,
                        functionName: crashLocation.functionName,
                        confidence: extraction.confidence,
                        pattern: extraction.pattern,
                        reasoning: `Extracted via regex: ${extraction.pattern}`,
                        automated: true,
                        method: 'manual_regex'
                    }
                }
            });
        } else {
            componentError = await prisma.componentError.create({
                data: {
                    componentId: component.id,
                    projectId: crash.projectId,
                    actionId: extraction.actionId,
                    appVersion: crash.appVersion || 'unknown',
                    errorMessage: crash.errorMessage,
                    errorType: 'runtime_error',
                    stackTrace: crash.stackTrace,
                    metadata: {
                        fileName: crashLocation.fileName,
                        lineNumber: crashLocation.lineNumber,
                        functionName: crashLocation.functionName,
                        confidence: extraction.confidence,
                        pattern: extraction.pattern,
                        reasoning: `Extracted via regex: ${extraction.pattern}`,
                        automated: true,
                        method: 'manual_regex'
                    }
                }
            });
        }

        // 7. Update crash
        console.log('🔗 Linking crash to component...');
        await prisma.processedCrash.update({
            where: { id: crashId },
            data: {
                componentId: component.id,
                geminiAnalysis: {
                    ...crash.geminiAnalysis,
                    actionId: extraction.actionId,
                    componentName: component.name,
                    confidence: extraction.confidence,
                    method: 'manual_regex',
                    automated: true
                }
            }
        });

        console.log('\n✅ SUCCESS!\n');
        console.log(`Component: ${component.name} (ID: ${component.id})`);
        console.log(`ActionId: ${extraction.actionId}`);
        console.log(`ComponentError ID: ${componentError.id}`);

        return {
            success: true,
            componentId: component.id,
            actionId: extraction.actionId,
            componentErrorId: componentError.id
        };

    } catch (error) {
        console.error(`\n❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    } finally {
        await prisma.$disconnect();
    }
}

// Run if called directly
if (require.main === module) {
    const crashId = process.argv[2] || '6bf6e919-2670-49e1-906d-30878229c81a';
    manualProcessCrash(crashId);
}

module.exports = { manualProcessCrash, extractActionIdFromCode };
