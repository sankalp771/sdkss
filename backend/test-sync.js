async function testSync() {
    try {
        console.log("📡 Testing Firebase Crashlytics Sync (BigQuery)...");
        const response = await fetch('http://localhost:3001/api/sync-crashes', {
            method: 'POST'
        });

        const data = await response.json();

        console.log("✅ Response Status:", response.status);
        console.log("📦 Data:", JSON.stringify(data, null, 2));
    } catch (error) {
        console.error("❌ Sync Failed:", error.message);
    }
}

testSync();
