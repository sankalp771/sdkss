/**
 * Gemini AI Code Analyzer
 * Uses AI to extract actionId and component info from code
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Get Gemini model instance
 */
function getModel() {
    return genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
}

/**
 * Analyze code to find actionId
 * @param {string} fileName - Name of the file
 * @param {number} lineNumber - Error line number
 * @param {string} codeContext - Code snippet around the error
 * @param {string} functionName - Function where error occurred
 * @returns {Object} { actionId, componentId, confidence, reasoning }
 */
async function analyzeCodeForActionId(fileName, lineNumber, codeContext, functionName = '') {
    try {
        const model = getModel();
        const prompt = `You are analyzing a crash in a Flutter/Dart application to identify the EXACT actionId that caused it.

FILE: ${fileName}
ERROR LINE: ${lineNumber}
FUNCTION: ${functionName}

CODE CONTEXT:
\`\`\`dart
${codeContext}
\`\`\`

CRITICAL INSTRUCTIONS:
The application uses an ActionGuard SDK that wraps risky operations with a unique actionId parameter.

YOUR TASK: Find the LITERAL STRING VALUE of the actionId parameter in the code.

LOOK FOR THESE PATTERNS:
1. ActionGuard.guard(actionId: 'some_action_id', ...)
2. ActionGuard.run(actionId: 'some_action_id', ...)
3. SafeAction(actionId: 'some_action_id', ...)
4. Component identifiers like componentId: 'button_id'

EXAMPLES:

✅ CORRECT:
Code: FloatingActionButton(onPressed: ActionGuard.guard(actionId: 'checkout_submit22', action: _incrementCounter))
Your Answer: { "actionId": "checkout_submit22", "confidence": "high" }

❌ WRONG:
Code: FloatingActionButton(onPressed: ActionGuard.guard(actionId: 'checkout_submit22', action: _incrementCounter))
Your Answer: { "actionId": "FloatingActionButton", "confidence": "medium" }  ← WRONG! Don't use widget/method names!

RULES:
- Extract the EXACT string literal value from the actionId parameter
- DO NOT use function names, widget names, or class names
- DO NOT generate or infer actionIds - only extract what exists in the code
- If you can't find an explicit actionId, set confidence to "none" and leave actionId empty
- Look within 20 lines of the error line (line ${lineNumber})

RESPOND ONLY WITH VALID JSON:
{
  "actionId": "exact_string_from_code_or_empty",
  "componentId": "component_name_if_found_or_null",
  "confidence": "high|medium|low|none",
  "reasoning": "explain where you found it or why you couldn't find it",
  "foundAtLine": number_or_null
}`;

        const result = await model.generateContent(prompt);
        const text = result.response.text().trim();

        // Clean up JSON response
        const jsonText = text
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();


        const analysis = JSON.parse(jsonText);

        // Validate - only return actionId if actually found (not empty)
        const hasActionId = analysis.actionId && analysis.actionId.trim() !== '' && analysis.actionId !== 'exact_string_from_code_or_empty';

        return {
            actionId: hasActionId ? analysis.actionId.trim() : null,
            componentId: analysis.componentId || null,
            confidence: analysis.confidence || 'none',
            reasoning: analysis.reasoning || 'AI extraction',
            foundAtLine: analysis.foundAtLine || null,
            suggestedFix: analysis.suggestedFix || null
        };

    } catch (error) {
        console.error('Gemini analysis error:', error.message);

        // Fallback: Return null actionId (no generation)
        return {
            actionId: null,
            componentId: null,
            confidence: 'none',
            reasoning: `Analysis failed: ${error.message}`,
            foundAtLine: null,
            suggestedFix: null
        };
    }
}

/**
 * Batch analyze multiple crash locations
 * @param {Array} locations - Array of {fileName, lineNumber, codeContext, functionName}
 * @returns {Array} Array of analysis results
 */
async function batchAnalyze(locations) {
    const results = [];

    for (const loc of locations) {
        const analysis = await analyzeCodeForActionId(
            loc.fileName,
            loc.lineNumber,
            loc.codeContext,
            loc.functionName
        );
        results.push({ ...loc, analysis });
    }

    return results;
}

module.exports = {
    analyzeCodeForActionId,
    batchAnalyze
};
