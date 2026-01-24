# CrashGuard API Schema - Optimized Component Tracking

## Overview
This document describes the optimized component tracking system for the CrashGuard SDK. The system tracks component health, crashes per version, errors with action context, and provides detailed analytics.

---

## Database Models

### 1. Component (Enhanced)
Tracks individual components within an application.

```prisma
model Component {
  id              String   @id @default(uuid())
  projectId       String
  identifier      String
  name            String?
  status          String   @default("active") // active, maintenance, deprecated
  fallbackMessage String?  @default("Feature unavailable.")
  crashThreshold  Int?     @default(5)
  totalCrashCount Int      @default(0) // Lifetime crash count
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

**Purpose**: Stores basic component metadata and lifetime crash count.

---

### 2. ComponentVersionStat (NEW)
Tracks version-specific metrics for each component.

```prisma
model ComponentVersionStat {
  id            String   @id @default(uuid())
  componentId   String
  appVersion    String   // e.g., "1.0.0", "2.1.3"
  crashCount    Int      @default(0)
  actionCount   Int      @default(0) // Total action calls
  lastUpdated   DateTime @updatedAt
  createdAt     DateTime @default(now())
}
```

**Purpose**: Enables per-version analytics and crash rate calculations.
**Unique Constraint**: `(componentId, appVersion)` - One record per component per version

---

### 3. ComponentError (NEW)
Detailed error logging with action and version context.

```prisma
model ComponentError {
  id              String   @id @default(uuid())
  componentId     String
  projectId       String
  actionId        String   // Reference to which action triggered the error
  appVersion      String   // App version when error occurred
  errorMessage    String
  stackTrace      String?
  errorType       String?  // e.g., "NullPointerException", "NetworkError"
  metadata        Json?    // Additional context
  isArchived      Boolean  @default(false)
  archivedAt      DateTime?
  createdAt       DateTime @default(now())
}
```

**Purpose**: Store detailed error information for analysis and debugging.
**Indexes**: componentId, projectId, appVersion, actionId, createdAt, isArchived (for archiving queries)

---

### 4. ApplicationUtil (NEW)
Stores application-level configuration and metadata.

```prisma
model ApplicationUtil {
  id                  String   @id @default(uuid())
  projectId           String
  currentAppVersion   String   // Current production version
  minSupportedVersion String   // Minimum supported app version
  metadata            Json?    // Additional app config like flags, feature toggles
  lastUpdated         DateTime @updatedAt
  createdAt           DateTime @default(now())
}
```

**Purpose**: Centralized app configuration and version management.
**Unique Constraint**: `projectId` - One record per project

---

## API Endpoints

### 1. GET /api/components
Returns detailed component status with version-specific metrics.

**Query Parameters:**
- `project_id` (required): Project UUID
- `app_version` (optional): Specific app version to filter by
- `api_key` (optional alternative): API key instead of project_id

**Response:**
```json
{
  "project": {
    "id": "project-uuid",
    "appVersion": "1.2.0",
    "minSupportedVersion": "1.0.0",
    "metadata": {
      "featureFlags": { "betaFeatures": true }
    }
  },
  "timestamp": "2025-01-25T10:30:00Z",
  "componentsCount": 3,
  "componentsByVersion": {
    "1.2.0": [
      {
        "id": "comp-uuid",
        "identifier": "payment-processor",
        "name": "Payment Processor",
        "status": "active",
        "fallbackMessage": "Payment service unavailable",
        "totalCrashCount": 12,
        "crashThreshold": 5,
        "versionMetrics": {
          "appVersion": "1.2.0",
          "crashCount": 3,
          "actionCount": 150,
          "crashRate": "2.00%",
          "lastUpdated": "2025-01-25T10:25:00Z"
        },
        "recentErrors": [
          {
            "id": "error-uuid",
            "actionId": "payment-submit-action",
            "errorMessage": "Network timeout after 30s",
            "errorType": "NetworkError",
            "timestamp": "2025-01-25T10:20:00Z",
            "appVersion": "1.2.0"
          }
        ],
        "errorCount": 5,
        "processedCrashCount": 3,
        "createdAt": "2025-01-20T12:00:00Z",
        "updatedAt": "2025-01-25T10:25:00Z"
      }
    ]
  },
  "summary": {
    "totalComponents": 3,
    "activeComponents": 2,
    "maintenanceComponents": 1,
    "deprecatedComponents": 0,
    "totalErrors": 12
  }
}
```

---

### 2. POST /api/report-error
Logs a detailed error from the SDK.

**Request Body:**
```json
{
  "project_id": "project-uuid",
  "component_id": "payment-processor",
  "action_id": "payment-submit-action",
  "app_version": "1.2.0",
  "error_message": "Connection timeout",
  "error_type": "NetworkError",
  "stack_trace": "at PaymentService.submit...",
  "metadata": {
    "attemptCount": 3,
    "timeout": 30000,
    "endpoint": "https://api.payment.com/submit"
  }
}
```

**Response:**
```json
{
  "status": "recorded",
  "error_id": "error-uuid",
  "version_stat": {
    "id": "stat-uuid",
    "componentId": "comp-uuid",
    "appVersion": "1.2.0",
    "crashCount": 4,
    "actionCount": 150,
    "lastUpdated": "2025-01-25T10:30:00Z",
    "createdAt": "2025-01-20T12:00:00Z"
  }
}
```

---

### 3. POST /api/track-action
Increments action count for version metrics (call on successful action execution).

**Request Body:**
```json
{
  "project_id": "project-uuid",
  "component_id": "payment-processor",
  "app_version": "1.2.0"
}
```

**Response:**
```json
{
  "status": "tracked",
  "version_stat": {
    "id": "stat-uuid",
    "componentId": "comp-uuid",
    "appVersion": "1.2.0",
    "crashCount": 3,
    "actionCount": 151,
    "lastUpdated": "2025-01-25T10:31:00Z",
    "createdAt": "2025-01-20T12:00:00Z"
  }
}
```

---

### 4. GET /api/app-config
Retrieves application configuration.

**Query Parameters:**
- `project_id` (required): Project UUID

**Response:**
```json
{
  "id": "config-uuid",
  "projectId": "project-uuid",
  "currentAppVersion": "1.2.0",
  "minSupportedVersion": "1.0.0",
  "metadata": {
    "featureFlags": {
      "betaFeatures": true,
      "newPaymentUI": false
    },
    "maintenanceMode": false,
    "supportedPaymentMethods": ["card", "upi", "wallet"]
  },
  "lastUpdated": "2025-01-25T09:00:00Z",
  "createdAt": "2025-01-20T12:00:00Z"
}
```

---

### 5. POST /api/app-config
Updates application configuration.

**Request Body:**
```json
{
  "project_id": "project-uuid",
  "current_app_version": "1.3.0",
  "min_supported_version": "1.0.0",
  "metadata": {
    "featureFlags": {
      "betaFeatures": true,
      "newPaymentUI": true
    },
    "maintenanceMode": false
  }
}
```

**Response:**
```json
{
  "status": "updated",
  "appUtil": {
    "id": "config-uuid",
    "projectId": "project-uuid",
    "currentAppVersion": "1.3.0",
    "minSupportedVersion": "1.0.0",
    "metadata": { ... },
    "lastUpdated": "2025-01-25T10:35:00Z",
    "createdAt": "2025-01-20T12:00:00Z"
  }
}
```

---

### 6. GET /api/error-analytics
Retrieves error analytics for a given time period.

**Query Parameters:**
- `project_id` (required): Project UUID
- `component_id` (optional): Filter by component
- `days` (optional, default=7): Time period in days

**Response:**
```json
{
  "totalErrors": 42,
  "timeRange": "7 days",
  "analytics": {
    "byVersion": {
      "1.2.0": 25,
      "1.1.0": 12,
      "1.0.0": 5
    },
    "byAction": {
      "payment-submit-action": 18,
      "payment-validate-action": 12,
      "payment-confirm-action": 5,
      "other": 7
    },
    "byErrorType": {
      "NetworkError": 20,
      "ValidationError": 15,
      "TimeoutError": 5,
      "Unknown": 2
    },
    "recentErrors": [
      {
        "id": "error-uuid-1",
        "componentId": "comp-uuid",
        "projectId": "project-uuid",
        "actionId": "payment-submit-action",
        "appVersion": "1.2.0",
        "errorMessage": "Connection timeout",
        "errorType": "NetworkError",
        "metadata": { ... },
        "isArchived": false,
        "archivedAt": null,
        "createdAt": "2025-01-25T10:15:00Z",
        "component": {
          "identifier": "payment-processor",
          "name": "Payment Processor"
        }
      }
    ]
  }
}
```

---

### 7. POST /api/archive-errors
Archives old errors (called by cron job or manually).

**Query Parameters:**
- `days` (optional, default=7): Archive errors older than N days

**Response:**
```json
{
  "status": "archived",
  "archivedCount": 156,
  "archiveDate": "2025-01-18T10:40:00Z",
  "message": "Archived 156 errors older than 7 days"
}
```

---

## Data Flow Example

### Scenario: User encounters payment processor error on v1.2.0

1. **SDK Initializes (on app launch):**
   ```
   POST /api/track-action
   - component: payment-processor
   - app_version: 1.2.0
   ```
   → Updates ComponentVersionStat: actionCount +1

2. **User Triggers Payment Action:**
   ```
   POST /api/track-action
   - component: payment-processor
   - app_version: 1.2.0
   ```
   → Updates ComponentVersionStat: actionCount +1

3. **Error Occurs:**
   ```
   POST /api/report-error
   - component: payment-processor
   - action_id: payment-submit-action
   - error_message: "Network timeout"
   - error_type: NetworkError
   ```
   → Creates ComponentError record
   → Updates ComponentVersionStat: crashCount +1
   → Updates Component: totalCrashCount +1

4. **Dashboard Queries:**
   ```
   GET /api/components?project_id=...&app_version=1.2.0
   ```
   → Shows payment-processor with:
     - crashCount: 4 (for v1.2.0)
     - actionCount: 150 (for v1.2.0)
     - crashRate: 2.67%
     - recentErrors: [NetworkError, ...]

5. **Analytics Query (Last 7 Days):**
   ```
   GET /api/error-analytics?project_id=...
   ```
   → Shows that 25 errors occurred on v1.2.0
   → 18 were payment-submit-action errors
   → 20 were NetworkError type

6. **Weekly Cleanup (Automated):**
   ```
   POST /api/archive-errors?days=7
   ```
   → Archives all errors > 7 days old
   → Marks isArchived=true, archivedAt=now()

---

## SDK Implementation Guide

### 1. Initialize & Get Component Config
```javascript
// On app startup
const response = await fetch('/api/components', {
  headers: { 'Authorization': `Bearer ${API_KEY}` }
});
const componentConfig = await response.json();

// Store locally for offline access
localStorage.setItem('components', JSON.stringify(componentConfig));
```

### 2. Track Every Action Call
```javascript
// Before executing any component action
await fetch('/api/track-action', {
  method: 'POST',
  body: JSON.stringify({
    project_id: PROJECT_ID,
    component_id: 'payment-processor',
    app_version: APP_VERSION
  })
});

// Execute action...
try {
  const result = await executePaymentAction();
} catch (error) {
  // 3. Report Error
  await fetch('/api/report-error', {
    method: 'POST',
    body: JSON.stringify({
      project_id: PROJECT_ID,
      component_id: 'payment-processor',
      action_id: 'payment-submit-action',
      app_version: APP_VERSION,
      error_message: error.message,
      error_type: error.constructor.name,
      stack_trace: error.stack,
      metadata: { attemptCount: 3 }
    })
  });
}
```

### 3. Check Component Health Before Action
```javascript
const components = JSON.parse(localStorage.getItem('components'));
const componentStatus = components.componentsByVersion[APP_VERSION]
  .find(c => c.identifier === 'payment-processor');

if (componentStatus.status === 'maintenance') {
  showFallback(componentStatus.fallbackMessage);
} else if (componentStatus.versionMetrics.crashRate > 0.05) {
  // 5%+ crash rate
  showWarning('Payment service may be unstable');
}
```

---

## Archiving Strategy

### Weekly Automated Archiving
- **Trigger**: Cron job runs every Monday at 2 AM UTC
- **Action**: Archives errors > 7 days old
- **Command**: `POST /api/archive-errors?days=7`
- **Benefits**: 
  - Keeps active database fast
  - Maintains data for analytics
  - Can restore from backups if needed

### Monthly Backup
- **Trigger**: First of every month
- **Action**: Export archived errors to cold storage (S3/GCS)
- **Retention**: 1 year of archived data

---

## Performance Optimization

### Indexes
- `Component.projectId` - Fast project lookups
- `ComponentVersionStat.componentId` - Fast version stats
- `ComponentError.createdAt` - Fast archiving queries
- `ComponentError.isArchived` - Fast active error queries
- `ApplicationUtil.projectId` - Unique & fast config lookups

### Query Patterns
```sql
-- Get all errors for last 7 days (for dashboard)
SELECT * FROM "ComponentError"
WHERE "projectId" = $1 
AND "isArchived" = false
AND "createdAt" > NOW() - INTERVAL '7 days'
ORDER BY "createdAt" DESC;

-- Archive old errors (weekly job)
UPDATE "ComponentError"
SET "isArchived" = true, "archivedAt" = NOW()
WHERE "createdAt" < NOW() - INTERVAL '7 days'
AND "isArchived" = false;
```

---

## Future Enhancements

1. **Machine Learning**: Predict component failures based on crash rate trends
2. **Alert System**: Send notifications when crash rate exceeds threshold
3. **Auto-Rollback**: Automatically disable component if crash rate > 10%
4. **A/B Testing**: Track errors by feature branch
5. **User Segments**: Track errors per user segment/cohort
