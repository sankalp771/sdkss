async function testSentryHook() {
    console.log("🛠️ Sending Mock Sentry Payload...");

    try {
        const res = await fetch('http://localhost:3001/api/sentry-webhook', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'created',
                data: {
                    issue: {
                        id: 'mock-sentry-123',
                        title: 'TestError: Sentry connection verified',
                        culprit: 'auth/login.js',
                        permalink: 'https://sentry.io/organizations/test/issues/123'
                    }
                }
            })
        });

        const json = await res.json();
        console.log("✅ Server Response:", json);
    } catch (err) {
        console.error("❌ Failed:", err.message);
    }
}

testSentryHook();
