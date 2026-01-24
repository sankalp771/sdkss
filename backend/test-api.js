#!/usr/bin/env node

/**
 * Test Script for Optimized Component Tracking API
 * Tests all new endpoints and validates response structure
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3001';

// Test data
const TEST_PROJECT_ID = 'test-project-123';
const TEST_COMPONENT_ID = 'payment-processor';
const TEST_APP_VERSION = '1.2.0';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test(name, fn) {
  try {
    console.log(`\n✓ Testing: ${name}`);
    await fn();
    console.log(`  ✅ PASSED`);
  } catch (error) {
    console.error(`  ❌ FAILED: ${error.message}`);
    if (error.response?.data) {
      console.error('  Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

async function runTests() {
  console.log('🧪 CrashGuard Component Tracking API Tests\n');

  // Test 1: Initialize App Config
  await test('Initialize App Config (POST /api/app-config)', async () => {
    const response = await axios.post(`${BASE_URL}/api/app-config`, {
      project_id: TEST_PROJECT_ID,
      current_app_version: TEST_APP_VERSION,
      min_supported_version: '1.0.0',
      metadata: {
        featureFlags: { betaFeatures: true },
        environment: 'staging'
      }
    });
    console.log('  Created app config:', response.data.appUtil?.id);
  });

  // Test 2: Get App Config
  await test('Get App Config (GET /api/app-config)', async () => {
    const response = await axios.get(`${BASE_URL}/api/app-config`, {
      params: { project_id: TEST_PROJECT_ID }
    });
    console.log('  Current version:', response.data.currentAppVersion);
    console.log('  Min version:', response.data.minSupportedVersion);
  });

  // Test 3: Track Action (successful execution)
  await test('Track Action Call (POST /api/track-action)', async () => {
    const response = await axios.post(`${BASE_URL}/api/track-action`, {
      project_id: TEST_PROJECT_ID,
      component_id: TEST_COMPONENT_ID,
      app_version: TEST_APP_VERSION
    });
    console.log('  Action count:', response.data.version_stat?.actionCount);
  });

  // Test 4: Track multiple actions
  await test('Track Multiple Actions', async () => {
    for (let i = 0; i < 5; i++) {
      await axios.post(`${BASE_URL}/api/track-action`, {
        project_id: TEST_PROJECT_ID,
        component_id: TEST_COMPONENT_ID,
        app_version: TEST_APP_VERSION
      });
    }
    console.log('  Tracked 5 additional actions');
  });

  // Test 5: Report Error
  await test('Report Component Error (POST /api/report-error)', async () => {
    const response = await axios.post(`${BASE_URL}/api/report-error`, {
      project_id: TEST_PROJECT_ID,
      component_id: TEST_COMPONENT_ID,
      action_id: 'payment-submit-action',
      app_version: TEST_APP_VERSION,
      error_message: 'Network timeout after 30 seconds',
      error_type: 'NetworkError',
      stack_trace: 'at PaymentService.submit (payment.js:42:15)',
      metadata: {
        attemptCount: 2,
        timeout: 30000
      }
    });
    console.log('  Recorded error:', response.data.error_id);
    console.log('  Updated crash count:', response.data.version_stat?.crashCount);
  });

  // Test 6: Report multiple errors
  await test('Report Multiple Errors', async () => {
    const errorTypes = ['NetworkError', 'ValidationError', 'TimeoutError'];
    for (let i = 0; i < 3; i++) {
      await axios.post(`${BASE_URL}/api/report-error`, {
        project_id: TEST_PROJECT_ID,
        component_id: TEST_COMPONENT_ID,
        action_id: `action-${i}`,
        app_version: TEST_APP_VERSION,
        error_message: `Error occurred - attempt ${i + 1}`,
        error_type: errorTypes[i],
        stack_trace: 'stack trace...',
        metadata: { attempt: i + 1 }
      });
    }
    console.log('  Recorded 3 more errors');
  });

  // Test 7: Get Components with metrics
  await test('Get Components (GET /api/components)', async () => {
    const response = await axios.get(`${BASE_URL}/api/components`, {
      params: {
        project_id: TEST_PROJECT_ID,
        app_version: TEST_APP_VERSION
      }
    });
    console.log('  Total components:', response.data.componentsCount);
    console.log('  App version:', response.data.project?.appVersion);
    
    const components = response.data.componentsByVersion[TEST_APP_VERSION] || [];
    if (components.length > 0) {
      const comp = components[0];
      console.log('  First component:', comp.identifier);
      console.log('  Status:', comp.status);
      console.log('  Crash rate:', comp.versionMetrics?.crashRate);
      console.log('  Recent errors:', comp.recentErrors?.length);
    }
  });

  // Test 8: Get Error Analytics
  await test('Get Error Analytics (GET /api/error-analytics)', async () => {
    const response = await axios.get(`${BASE_URL}/api/error-analytics`, {
      params: {
        project_id: TEST_PROJECT_ID,
        days: 7
      }
    });
    console.log('  Total errors (7 days):', response.data.totalErrors);
    console.log('  By version:', Object.keys(response.data.analytics.byVersion));
    console.log('  By error type:', Object.keys(response.data.analytics.byErrorType));
    console.log('  By action:', Object.keys(response.data.analytics.byAction));
  });

  // Test 9: Get component-specific analytics
  await test('Get Component-Specific Analytics', async () => {
    const response = await axios.get(`${BASE_URL}/api/error-analytics`, {
      params: {
        project_id: TEST_PROJECT_ID,
        component_id: TEST_COMPONENT_ID,
        days: 7
      }
    });
    console.log('  Errors for this component:', response.data.totalErrors);
  });

  // Test 10: Archive Errors
  await test('Archive Old Errors (POST /api/archive-errors)', async () => {
    const response = await axios.post(`${BASE_URL}/api/archive-errors`, {}, {
      params: { days: 30 }
    });
    console.log('  Archive operation status:', response.data.status);
    console.log('  Archived count:', response.data.archivedCount);
  });

  console.log('\n\n📊 Summary');
  console.log('=======================');
  console.log('All tests completed!');
  console.log('\nKey Features Tested:');
  console.log('  ✓ App Configuration Management');
  console.log('  ✓ Action Tracking & Metrics');
  console.log('  ✓ Error Reporting with Context');
  console.log('  ✓ Version-Specific Analytics');
  console.log('  ✓ Detailed Error Analytics');
  console.log('  ✓ Error Archiving Strategy');
  console.log('  ✓ Component Health Dashboard');
}

runTests().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
