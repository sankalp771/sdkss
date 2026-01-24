# SafeBox Details API Documentation

## Endpoint

```
GET /api/safeBoxDetails
```

## Purpose
Lightweight endpoint for SDK to fetch only **problematic/faulty components** that should trigger fallback mechanisms. Returns components grouped by app version.

---

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `project_id` | string (UUID) | Yes* | Project identifier |
| `api_key` | string | Yes* | API key (alternative to project_id) |
| `app_version` | string | No | Filter by specific app version (e.g., "1.2.0") |

*Either `project_id` or `api_key` is required

---

## Filtering Logic

Components are included in response if:
- Status is **NOT** `'active'` (i.e., `maintenance` or `deprecated`), **OR**
- **Crash count > 2** (direct count from database, no ratio calculation)

---

## Response Schema

```json
{
  "project_id": "string (UUID)",
  "currentAppVersion": "string (global current version)",
  "timestamp": "string (ISO 8601)",
  "summary": {
    "totalFaultyComponents": "number",
    "versionsWithIssues": "number"
  },
  "safeBoxesByVersion": {
    "[appVersion]": [
      {
        "id": "string (UUID)",
        "identifier": "string (component_id)",
        "status": "string (maintenance|deprecated|active)",
        "fallbackMessage": "string",
        "crashCount": "number (crashes in this version)",
        "totalCrashCount": "number (lifetime crashes)"
      }
    ]
  }
}
```

---

## Example Requests & Responses

### Request 1: Get all faulty components (all versions)

```http
GET /api/safeBoxDetails?project_id=test-project-123
```

### Response 1:

```json
{
  "project_id": "test-project-123",
  "currentAppVersion": "1.2.0",
  "timestamp": "2026-01-25T15:45:30.123Z",
  "summary": {
    "totalFaultyComponents": 5,
    "versionsWithIssues": 2
  },
  "safeBoxesByVersion": {
    "1.2.0": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "identifier": "payment-processor",
        "status": "active",
        "fallbackMessage": "Payment service temporarily unavailable. Please try again later.",
        "crashCount": 5,
        "totalCrashCount": 12
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "identifier": "auth-service",
        "status": "maintenance",
        "fallbackMessage": "Authentication service under maintenance. Please check back shortly.",
        "crashCount": 0,
        "totalCrashCount": 3
      }
    ],
    "1.1.0": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "identifier": "notification-service",
        "status": "active",
        "fallbackMessage": "Notifications temporarily disabled",
        "crashCount": 4,
        "totalCrashCount": 8
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440003",
        "identifier": "legacy-upload",
        "status": "deprecated",
        "fallbackMessage": "This feature has been retired. Please use the new upload feature.",
        "crashCount": 0,
        "totalCrashCount": 15
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440004",
        "identifier": "sync-service",
        "status": "active",
        "fallbackMessage": "Sync service unavailable",
        "crashCount": 3,
        "totalCrashCount": 9
      }
    ]
  }
}
```

---

### Request 2: Get faulty components for specific version

```http
GET /api/safeBoxDetails?project_id=test-project-123&app_version=1.2.0
```

### Response 2:

```json
{
  "project_id": "test-project-123",
  "currentAppVersion": "1.2.0",
  "timestamp": "2026-01-25T15:45:30.123Z",
  "summary": {
    "totalFaultyComponents": 2,
    "versionsWithIssues": 1
  },
  "safeBoxesByVersion": {
    "1.2.0": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "identifier": "payment-processor",
        "status": "active",
        "fallbackMessage": "Payment service temporarily unavailable. Please try again later.",
        "crashCount": 5,
        "totalCrashCount": 12
      },
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "identifier": "auth-service",
        "status": "maintenance",
        "fallbackMessage": "Authentication service under maintenance. Please check back shortly.",
        "crashCount": 0,
        "totalCrashCount": 3
      }
    ]
  }
}
```

---

### Request 3: Get faulty components using API key

```http
GET /api/safeBoxDetails?api_key=your-secret-api-key&app_version=1.2.0
```

### Response 3: Same as Request 2

---

### Request 4: No faulty components (healthy version)

```http
GET /api/safeBoxDetails?project_id=test-project-123&app_version=1.0.0
```

### Response 4:

```json
{
  "project_id": "test-project-123",
  "currentAppVersion": "1.2.0",
  "timestamp": "2026-01-25T15:45:30.123Z",
  "summary": {
    "totalFaultyComponents": 0,
    "versionsWithIssues": 0
  },
  "safeBoxesByVersion": {}
}
```

---

## Error Responses

### Missing project_id and api_key

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "Missing project_id or api_key"
}
```

### Project not found

```http
HTTP/1.1 404 Not Found
Content-Type: application/json

{
  "error": "Project not found"
}
```

### Server error

```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": "SafeBox Details Error: [error message]"
}
```

---

## SDK Integration Example

```javascript
// Fetch faulty components for current app version
const response = await fetch(
  `http://localhost:3001/api/safeBoxDetails?project_id=test-project-123&app_version=${APP_VERSION}`
);

const safeBoxDetails = await response.json();

// For each version with issues
Object.entries(safeBoxDetails.safeBoxesByVersion).forEach(([version, components]) => {
  components.forEach(component => {
    if (component.status !== 'active') {
      // Disable component or show warning
      console.warn(`Component ${component.identifier} is ${component.status}`);
      showFallback(component.fallbackMessage);
    } else if (parseFloat(component.crashRate) > 5) {
      // High crash rate - consider disabling
      console.warn(`High crash rate on ${component.identifier}: ${component.crashRate}`);
      showWarning(component.fallbackMessage);
    }
  });
});
```

---

## Component Status Values

| Status | Meaning | Action |
|--------|---------|--------|
| `active` | Running normally (or high crash rate > 5%) | Show fallback/warning |
| `maintenance` | Under maintenance | Show fallback message |
| `deprecated` | Retired/deprecated | Show fallback message |

---

## Performance Notes

- Endpoint returns only **faulty components** (filtered response)
- Minimal data payload (no crash history or detailed errors)
- Suitable for SDK polling
- Recommended poll interval: Every 5-10 minutes or on app startup

---

## Related Endpoints

- `GET /api/components` - Detailed component info with full metrics
- `POST /api/track-action` - Track action execution
- `POST /api/report-error` - Report component errors
- `GET /api/error-analytics` - Detailed error analytics
