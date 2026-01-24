# Project Name (e.g., PlayConnect)

> **AI Context**: This section helps the Agent understand the *domain* (e.g., "This is a Football Booking App").

## 🏗 Architecture & Tech Stack
**Stack**: Flutter (Dart) + Firebase
**State Management**: Provider / BLoC / Riverpod (Specify one)
**Routing**: GoRouter / Navigator 1.0

### Key Directories
- `lib/main.dart`: Entry point. Initializes Firebase and global providers.
- `lib/features/`: Contains modular feature code (Auth, Booking, Profile).
- `lib/core/`: Shared utilities, constants, and network clients.
- `lib/data/`: content repositories and API services.

---

## 🔌 External Integrations
This project relies on the following services. **If these are missing initialization, the app will crash.**
1.  **Firebase Core**: Requires `Firebase.initializeApp()` in `main.dart`.
2.  **Google Maps API**: Requires API Key in `AndroidManifest.xml`.
3.  **Stripe**: Payment processing.

---

## 🛠 Setup Instructions
1.  Run `flutter pub get`
2.  Ensure `google-services.json` is present in `android/app/`.
3.  Run `flutter run`

## 🚨 Known Issues / Troubleshooting
- **Firebase Not Initialized**: If you see "No Firebase App '[DEFAULT]'", ensure you called `WidgetsFlutterBinding.ensureInitialized()` before `Firebase.initializeApp()`.
- **Async Main**: The `main()` function *must* be `async`.

---

## 🤖 For AI Agents (Gemini/Copilot)
**Design Pattern**: We use the **Repository Pattern**. When fixing bugs:
1.  Do NOT put business logic in UI widgets.
2.  Always use `try-catch` blocks in Repository methods.
3.  Preserve existing comments marked `// NOTE:`.
