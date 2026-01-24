const Sentry = require("@sentry/node");

// INITIALIZE SENTRY (Replace DSN with yours from Settings -> Client Keys)
Sentry.init({
    dsn: "https://e9317382ae6f6f9bd9a784045d6a32f3@o4510766072528896.ingest.us.sentry.io/4510766195933184",
    environment: "production",
});

async function triggerFakeCrashes() {
    console.log("💣 Firing fake crashes to Sentry...");

    try {
        // Crash 1: Payment Error
        console.log("   - Sending: PaymentGatewayError");
        Sentry.captureException(new Error("PaymentGatewayError: 504 Gateway Timeout while processing transaction ID #9988"));

        // Crash 2: UI Render Fail
        console.log("   - Sending: Invariant Violation");
        Sentry.captureException(new Error("Invariant Violation: Minified React error #301; visit https://reactjs.org/docs/error-decoder.html?invariant=301"));

        // Crash 3: Null Pointer
        console.log("   - Sending: TypeError (cannot read propery 'user')");
        Sentry.captureException(new TypeError("Cannot read properties of undefined (reading 'user') at HeaderComponent.js:42"));

    } catch (e) {
        console.error("Failed to send to Sentry:", e);
    } finally {
        console.log("✅ Sent! Check your Sentry Dashboard in 10-20 seconds.");
        // Sentry sends in background, wait a bit before exiting
        await Sentry.flush(2000);
    }
}

triggerFakeCrashes();
