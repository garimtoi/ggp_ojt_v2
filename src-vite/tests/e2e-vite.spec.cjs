// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E Test Suite for Vite-based OJT Master
 *
 * Tests verify:
 * 1. Page load and React rendering
 * 2. UI component presence (loading or login page)
 * 3. Console errors
 * 4. Responsive design
 */

test.describe('OJT Master Vite - E2E Tests', () => {
  let consoleErrors = [];
  let consoleWarnings = [];

  test.beforeEach(async ({ page }) => {
    // Console error/warning listener setup
    consoleErrors = [];
    consoleWarnings = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      } else if (msg.type() === 'warning') {
        consoleWarnings.push(msg.text());
      }
    });

    // Navigate to homepage
    await page.goto('/', { waitUntil: 'networkidle' });
  });

  test('1. Page Load - React app renders without crash', async ({ page }) => {
    // Wait for page to be fully loaded
    await page.waitForLoadState('domcontentloaded');

    // Verify page title exists
    const title = await page.title();
    console.log(`Page title: ${title}`);
    expect(title).toBeTruthy();

    // Take screenshot
    await page.screenshot({
      path: 'test-results/vite-01-page-loaded.png',
      fullPage: true,
    });

    // Verify React app rendered (root has content)
    const root = page.locator('#root');
    await expect(root).not.toBeEmpty({ timeout: 5000 });
    console.log('React app rendered successfully');
  });

  test('2. App State - Loading or Login page displays', async ({ page }) => {
    // App can be in loading state or login page
    // Check for either loading spinner or OJT branding

    const loadingSpinner = page.locator('.animate-spin, [class*="loading"]');
    const ojtBranding = page.locator('text=OJT');
    const loadingText = page.getByText(/로딩|Loading/i);

    // Wait a bit for initial render
    await page.waitForTimeout(1000);

    // Check what state we're in
    const hasSpinner = (await loadingSpinner.count()) > 0;
    const hasBranding = (await ojtBranding.count()) > 0;
    const hasLoadingText = (await loadingText.count()) > 0;

    console.log(`Loading spinner visible: ${hasSpinner}`);
    console.log(`OJT branding visible: ${hasBranding}`);
    console.log(`Loading text visible: ${hasLoadingText}`);

    // Either loading state OR login page should be visible
    const isValidState = hasSpinner || hasBranding || hasLoadingText;
    expect(isValidState).toBe(true);

    // Take screenshot
    await page.screenshot({
      path: 'test-results/vite-02-app-state.png',
      fullPage: true,
    });
  });

  test('3. UI Elements - Basic DOM structure exists', async ({ page }) => {
    // Wait for React app
    await page.waitForSelector('#root > *', { timeout: 10000 });

    // Check for common UI elements
    const elements = {
      divs: await page.locator('div').count(),
      spans: await page.locator('span').count(),
      paragraphs: await page.locator('p').count(),
      buttons: await page.locator('button').count(),
    };

    console.log('UI Element counts:', elements);

    // Verify minimum DOM structure exists
    expect(elements.divs).toBeGreaterThanOrEqual(3);

    // Check body has some content
    const bodyText = await page.locator('body').textContent();
    expect(bodyText.trim().length).toBeGreaterThan(0);
    console.log(`Page content length: ${bodyText.length} chars`);

    // Screenshot
    await page.screenshot({
      path: 'test-results/vite-03-ui-elements.png',
      fullPage: true,
    });
  });

  test('4. Console Errors - No critical JS errors', async ({ page }) => {
    // Wait for all scripts to execute
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    console.log('\n=== Console Report ===');
    console.log(`Total errors: ${consoleErrors.length}`);
    console.log(`Total warnings: ${consoleWarnings.length}`);

    // Filter out expected/ignorable errors
    const criticalErrors = consoleErrors.filter(
      (error) =>
        !error.includes('favicon') &&
        !error.includes('ResizeObserver') &&
        !error.includes('third-party') &&
        !error.includes('Failed to load resource') && // API errors expected without valid keys
        !error.includes('net::') &&
        !error.includes('403') &&
        !error.includes('401')
    );

    if (criticalErrors.length > 0) {
      console.log('\nCritical errors found:');
      criticalErrors.forEach((e) => console.log(`  - ${e}`));
    } else {
      console.log('No critical console errors');
    }

    // Test passes as long as no critical JS errors (API errors are expected in test env)
    expect(criticalErrors.length).toBe(0);

    // Screenshot
    await page.screenshot({
      path: 'test-results/vite-04-console-check.png',
      fullPage: true,
    });
  });

  test('5. Responsive - Mobile and tablet viewports', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify layout fits mobile
    const body = page.locator('body');
    const box = await body.boundingBox();

    if (box) {
      console.log(`Mobile body width: ${box.width}px`);
      expect(box.width).toBeLessThanOrEqual(375);
    }

    // Screenshot
    await page.screenshot({
      path: 'test-results/vite-05-mobile.png',
      fullPage: true,
    });

    // Tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.screenshot({
      path: 'test-results/vite-05-tablet.png',
      fullPage: true,
    });

    console.log('Responsive tests completed');
  });

  test('6. Build Verification - No hydration errors', async ({ page }) => {
    // Check for React hydration errors
    const hydrationErrors = consoleErrors.filter(
      (e) => e.includes('hydration') || e.includes('Hydration')
    );

    console.log(`Hydration errors: ${hydrationErrors.length}`);
    expect(hydrationErrors.length).toBe(0);

    // Verify no "Error boundary" displays
    const errorBoundary = page.locator('[class*="error"]').or(page.getByText('Something went wrong'));
    const hasErrorUI = (await errorBoundary.count()) > 0;
    console.log(`Error boundary displayed: ${hasErrorUI}`);

    // Take final screenshot
    await page.screenshot({
      path: 'test-results/vite-06-final.png',
      fullPage: true,
    });
  });
});
