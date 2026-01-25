const { PrismaClient } = require('@prisma/client');
const { fetchGitHubFile } = require('./github-fetcher');
const { parseStackTrace } = require('./stack-parser');
const prisma = new PrismaClient();

async function diagnose() {
    console.log('--- RE-DIAGNOSIS ---');
    const crash = await prisma.processedCrash.findFirst({
        orderBy: { createdAt: 'desc' },
        take: 1
    });

    if (!crash) {
        console.log('No crashes found.');
        return;
    }

    console.log(`Crash ID: ${crash.id}`);
    console.log(`Original DB File: ${crash.fileName}`);

    // Test Re-parsing
    console.log('\nTesting Stack Parser (Updates just applied):');
    const parsed = parseStackTrace(crash.stackTrace);

    if (!parsed) {
        console.log('❌ Parse failed (returned null)');
        return;
    }

    console.log(`✅ Parsed Result:`);
    console.log(`   File: ${parsed.fileName}`);
    console.log(`   Line: ${parsed.lineNumber}`);

    if (parsed.fileName === 'main.dart' || parsed.fileName.endsWith('/main.dart')) {
        console.log('🎉 SUCCESS! Parser skipped internal files and found main.dart');
    } else {
        console.log('⚠️ Warning: Parser still found:', parsed.fileName);
    }

    // Now try fetching
    console.log(`\nAttempting fetch for: ${parsed.fileName}`);
    try {
        const fetchResult = await fetchGitHubFile(parsed.fileName, parsed.lineNumber);
        if (fetchResult) {
            console.log('✅ Fetch SUCCESS!');
            console.log('Content Start:', fetchResult.content.substring(0, 50).replace(/\n/g, ' '));
        } else {
            console.log('❌ Fetch FAILED (null result)');
        }
    } catch (e) {
        console.log(`❌ Fetch THREW: ${e.message}`);
    }

    await prisma.$disconnect();
}

diagnose();
