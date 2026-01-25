/**
 * Stack Trace Parser
 * Extracts meaningful crash location from Sentry stack traces
 */

// System files to ignore (Flutter/Dart internals)
const SYSTEM_FILES = [
    'errors.dart',
    'zone.dart',
    'isolate_helper.dart',
    'future.dart',
    'binding.dart',
    'platform_dispatcher.dart',
    'pointer_binding.dart',
    'operations.dart',
    'js_allow_interop_patch.dart',
    'window.dart',
    'framework.dart',
    'component_stat.dart',
    'view.dart',
    'component_stat.dart',
    'view.dart',
    'binding_wrapper.dart',
    'frame_service.dart'
];

/**
 * Parse a stack trace and extract the primary crash location
 * @param {string} stackTrace - Full stack trace from Sentry
 * @returns {Object} { fileName, lineNumber, columnNumber, functionName, rawLine }
 */
function parseStackTrace(stackTrace) {
    if (!stackTrace || typeof stackTrace !== 'string') {
        return null;
    }

    // Split into lines
    const lines = stackTrace.split('\n').filter(line => line.trim());

    // Pattern: "file.dart in functionName at line 123:45"
    const pattern = /^(.+?\.dart)\s+in\s+(.+?)\s+at\s+line\s+(\d+):(\d+)/;

    for (const line of lines) {
        const match = line.match(pattern);
        if (!match) continue;

        const fileName = match[1].trim();
        const functionName = match[2].trim();
        const lineNumber = parseInt(match[3]);
        const columnNumber = parseInt(match[4]);

        // Skip system files
        if (SYSTEM_FILES.includes(fileName)) {
            continue;
        }

        // Found a user file!
        return {
            fileName,
            lineNumber,
            columnNumber,
            functionName: functionName.replace(/[\[\]<>]/g, ''), // Clean up brackets
            rawLine: line.trim()
        };
    }

    // Fallback: return first non-system file even without perfect match
    for (const line of lines) {
        if (line.includes('.dart') && !SYSTEM_FILES.some(sys => line.includes(sys))) {
            return {
                fileName: 'unknown',
                lineNumber: 0,
                columnNumber: 0,
                functionName: 'unknown',
                rawLine: line.trim()
            };
        }
    }

    return null;
}

/**
 * Get all relevant files from stack trace (for broader context)
 * @param {string} stackTrace 
 * @returns {Array} Array of parsed locations
 */
function getAllUserFiles(stackTrace) {
    if (!stackTrace || typeof stackTrace !== 'string') {
        return [];
    }

    const lines = stackTrace.split('\n').filter(line => line.trim());
    const pattern = /^(.+?\.dart)\s+in\s+(.+?)\s+at\s+line\s+(\d+):(\d+)/;
    const results = [];

    for (const line of lines) {
        const match = line.match(pattern);
        if (!match) continue;

        const fileName = match[1].trim();

        // Skip system files
        if (SYSTEM_FILES.includes(fileName)) {
            continue;
        }

        results.push({
            fileName,
            lineNumber: parseInt(match[3]),
            columnNumber: parseInt(match[4]),
            functionName: match[2].trim().replace(/[\[\]<>]/g, ''),
            rawLine: line.trim()
        });
    }

    return results;
}

module.exports = {
    parseStackTrace,
    getAllUserFiles,
    SYSTEM_FILES
};
