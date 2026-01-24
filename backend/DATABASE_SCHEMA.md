# CrashGuard Database Schema Documentation

This document details the PostgreSQL schema designed for CrashGuard. It is implemented using Prisma ORM.

## 1. Table: `Project`
**Description:** Represents one "App" or "Client" (Tenant) using the CrashGuard SDK.

| Field Name | Data Type | Purpose & Description |
| :--- | :--- | :--- |
| **`id`** | `String (UUID)` | **Primary Key**. A unique ID for the project (e.g., `550e8400-e29b...`). |
| **`name`** | `String` | The human-readable name of the app (e.g., "FoodDelivery App"). |
| **`apiKey`** | `String` | **Secret Key**. The SDK uses this in headers to authenticate with the backend. Must be unique. |
| **`firebaseProjectId`** | `String?` | *Optional*. The ID of the Firebase project where raw crashes are sent (e.g., `my-app-8877e`). Used for BigQuery linking. |
| **`bigqueryDatasetName`**| `String?` | *Optional*. The specific dataset inside BigQuery where Crashlytics exports data. |
| **`createdAt`** | `DateTime` | Auto-generated timestamp of when this project was created. |
| **`components`** | `Relation` | Links to all the `Component` rows that belong to this project. |
| **`processedCrashes`** | `Relation` | Links to all the `ProcessedCrash` rows for this project. |

---

## 2. Table: `Component`
**Description:** Represent the specific parts of the app wrapped in the CrashGuard `<Guard>` component.

| Field Name | Data Type | Purpose & Description |
| :--- | :--- | :--- |
| **`id`** | `String (UUID)` | **Primary Key**. Unique ID for this database record. |
| **`projectId`** | `String` | **Foreign Key**. Links this component to a parent `Project`. |
| **`identifier`** | `String` | **The "Tag"**. This matches the `id` prop in the SDK (e.g., `<Guard id="payment_btn">`). |
| **`name`** | `String?` | *Optional*. A friendly name for the admin dashboard (e.g., "Main Payment Button"). |
| **`status`** | `String` | **The Circuit Breaker**. Can be:<br>• `"active"` (Normal)<br>• `"maintenance"` (Locked/Blocked)<br>• `"deprecated"` (No longer used) |
| **`fallbackMessage`** | `String?` | Custom text shown to the user when locked (e.g., *"Payments are down for maintenance"*). |
| **`crashThreshold`** | `Int?` | **Config**. How many crashes are allowed before the system **auto-locks** this component. Default is `5`. |
| **`createdAt`** | `DateTime` | Timestamp of when this component was first registered. |
| **`locks`** | `Relation` | History of every time this component was locked. |

> **Constraint:** `@@unique([projectId, identifier])` means you cannot have two components with the same identifier in the *same* project.

---

## 3. Table: `ProcessedCrash`
**Description:** Stores crash events *after* they have been fetched from Firebase/BigQuery and analyzed.

| Field Name | Data Type | Purpose & Description |
| :--- | :--- | :--- |
| **`id`** | `String (UUID)` | **Primary Key**. Internal ID for this crash record. |
| **`projectId`** | `String` | **Foreign Key**. Which project had this crash. |
| **`componentId`** | `String?` | **Foreign Key**. Links to the specific `Component` that failed. (Null if it was a global app crash). |
| **`firebaseEventId`** | `String?` | The exact ID from Firebase. Prevents processing the exact same crash twice. |
| **`issueId`** | `String?` | Firebase groups crashes into "Issues". We store this to group them accurately. |
| **`errorMessage`** | `String?` | The actual error text (e.g., `TypeError: cannot read property 'map' of undefined`). |
| **`stackTrace`** | `String?` | The detailed stack trace showing exactly which lines of code failed. |
| **`geminiAnalysis`** | **`Json?`** | **The AI Brain**. Stores Gemini's output structure: `{ root_cause: "...", suggested_fix: "..." }`. |
| **`analysisStatus`** | `String` | Workflow state: `"pending"` -> `"analyzing"` -> `"completed"` (or `"failed"`). |
| **`createdAt`** | `DateTime` | When this crash happened/was recorded. |

---

## 4. Table: `ComponentLock`
**Description:** An audit log for security and history. Tracks *Why* and *When* a component was locked.

| Field Name | Data Type | Purpose & Description |
| :--- | :--- | :--- |
| **`id`** | `String (UUID)` | **Primary Key**. |
| **`componentId`** | `String` | **Foreign Key**. Which component was locked. |
| **`lockedBy`** | `String` | Who initiated the lock?<br>• `"system"` = Auto-lock (Threshold exceeded).<br>• `"admin"` = Manual lock via dashboard. |
| **`reason`** | `String?` | Text explanation (e.g., *"Error rate spiked to 15% in 1 minute"*). |
| **`isActive`** | `Boolean` | `True` means this is the *current* reason the component is down. |
| **`createdAt`** | `DateTime` | When the lock happened. |
