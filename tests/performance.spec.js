// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Performance Test Suite for OJT Master
 *
 * Tests measure:
 * 1. Page load time
 * 2. Time to interactive
 * 3. Resource loading
 * 4. Memory usage
 */

test.describe('OJT Master Performance Tests', () => {

  test('1. Page Load Performance Metrics', async ({ page }) => {
    // Start performance measurement
    const startTime = Date.now();

    // Navigate and wait for network idle
    await page.goto('/', { waitUntil: 'networkidle' });

    const loadTime = Date.now() - startTime;
    console.log(`\n=== Page Load Metrics ===`);
    console.log(`Total load time: ${loadTime}ms`);

    // Get performance timing from browser
    const performanceTiming = await page.evaluate(() => {
      const timing = performance.timing;
      return {
        // Navigation timing
        navigationStart: timing.navigationStart,
        domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
        domComplete: timing.domComplete - timing.navigationStart,
        loadComplete: timing.loadEventEnd - timing.navigationStart,

        // Resource timing
        dns: timing.domainLookupEnd - timing.domainLookupStart,
        tcp: timing.connectEnd - timing.connectStart,
        ttfb: timing.responseStart - timing.navigationStart,
        download: timing.responseEnd - timing.responseStart,
        domParsing: timing.domInteractive - timing.responseEnd,
      };
    });

    console.log(`\n--- Navigation Timing ---`);
    console.log(`DOM Content Loaded: ${performanceTiming.domContentLoaded}ms`);
    console.log(`DOM Complete: ${performanceTiming.domComplete}ms`);
    console.log(`Load Complete: ${performanceTiming.loadComplete}ms`);

    console.log(`\n--- Network Timing ---`);
    console.log(`DNS Lookup: ${performanceTiming.dns}ms`);
    console.log(`TCP Connection: ${performanceTiming.tcp}ms`);
    console.log(`Time to First Byte (TTFB): ${performanceTiming.ttfb}ms`);
    console.log(`Download Time: ${performanceTiming.download}ms`);
    console.log(`DOM Parsing: ${performanceTiming.domParsing}ms`);

    // Performance assertions
    expect(performanceTiming.domContentLoaded).toBeLessThan(5000); // < 5s
    expect(performanceTiming.loadComplete).toBeLessThan(10000); // < 10s

    // Take screenshot
    await page.screenshot({ path: 'test-results/perf-01-loaded.png', fullPage: true });
  });

  test('2. Resource Loading Analysis', async ({ page }) => {
    const resources = [];

    // Intercept all requests
    page.on('request', request => {
      resources.push({
        url: request.url(),
        method: request.method(),
        type: request.resourceType(),
        startTime: Date.now()
      });
    });

    page.on('response', response => {
      const resource = resources.find(r => r.url === response.url());
      if (resource) {
        resource.status = response.status();
        resource.endTime = Date.now();
        resource.duration = resource.endTime - resource.startTime;
      }
    });

    await page.goto('/', { waitUntil: 'networkidle' });

    console.log(`\n=== Resource Loading Analysis ===`);
    console.log(`Total resources: ${resources.length}`);

    // Group by type
    const byType = resources.reduce((acc, r) => {
      acc[r.type] = acc[r.type] || [];
      acc[r.type].push(r);
      return acc;
    }, {});

    console.log(`\n--- By Resource Type ---`);
    for (const [type, items] of Object.entries(byType)) {
      const avgDuration = items.reduce((sum, r) => sum + (r.duration || 0), 0) / items.length;
      console.log(`${type}: ${items.length} files, avg ${Math.round(avgDuration)}ms`);
    }

    // Find slowest resources
    const slowest = resources
      .filter(r => r.duration)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    console.log(`\n--- Slowest Resources ---`);
    slowest.forEach((r, i) => {
      const shortUrl = r.url.length > 60 ? r.url.substring(0, 60) + '...' : r.url;
      console.log(`${i + 1}. ${r.duration}ms - ${shortUrl}`);
    });

    // CDN scripts check
    const cdnScripts = resources.filter(r =>
      r.type === 'script' && (
        r.url.includes('cdn.') ||
        r.url.includes('unpkg.') ||
        r.url.includes('jsdelivr.')
      )
    );
    console.log(`\n--- CDN Scripts (${cdnScripts.length}) ---`);
    cdnScripts.forEach(r => {
      const shortUrl = r.url.split('/').pop();
      console.log(`  ${r.duration || '?'}ms - ${shortUrl}`);
    });
  });

  test('3. React Render Performance', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Wait for React to render
    await page.waitForSelector('#root > *', { timeout: 10000 });

    // Measure React render time
    const renderMetrics = await page.evaluate(() => {
      const root = document.getElementById('root');
      const childCount = root ? root.querySelectorAll('*').length : 0;

      // Check for React DevTools (if available)
      const hasReact = typeof window.React !== 'undefined';

      return {
        hasReact,
        domNodes: childCount,
        bodyTextLength: document.body.textContent?.length || 0
      };
    });

    console.log(`\n=== React Render Metrics ===`);
    console.log(`React loaded: ${renderMetrics.hasReact}`);
    console.log(`DOM nodes in #root: ${renderMetrics.domNodes}`);
    console.log(`Body text length: ${renderMetrics.bodyTextLength}`);

    // Performance mark check
    const marks = await page.evaluate(() => {
      return performance.getEntriesByType('mark').map(m => ({
        name: m.name,
        startTime: Math.round(m.startTime)
      }));
    });

    if (marks.length > 0) {
      console.log(`\n--- Performance Marks ---`);
      marks.forEach(m => console.log(`  ${m.name}: ${m.startTime}ms`));
    }
  });

  test('4. Memory Usage Check', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' });

    // Get memory info (Chrome only)
    const memoryInfo = await page.evaluate(() => {
      // @ts-ignore
      if (performance.memory) {
        return {
          // @ts-ignore
          usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
          // @ts-ignore
          totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
          // @ts-ignore
          jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        };
      }
      return null;
    });

    console.log(`\n=== Memory Usage ===`);
    if (memoryInfo) {
      console.log(`Used JS Heap: ${memoryInfo.usedJSHeapSize} MB`);
      console.log(`Total JS Heap: ${memoryInfo.totalJSHeapSize} MB`);
      console.log(`JS Heap Limit: ${memoryInfo.jsHeapSizeLimit} MB`);
      console.log(`Usage: ${Math.round(memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit * 100)}%`);

      // Memory should be reasonable
      expect(memoryInfo.usedJSHeapSize).toBeLessThan(100); // < 100MB
    } else {
      console.log('Memory API not available (non-Chrome browser)');
    }
  });

  test('5. Core Web Vitals Simulation', async ({ page }) => {
    const startTime = Date.now();

    // Navigate
    await page.goto('/');

    // First Contentful Paint (FCP) - when first content appears
    await page.waitForSelector('#root > *');
    const fcp = Date.now() - startTime;

    // Largest Contentful Paint (LCP) - approximate
    await page.waitForLoadState('networkidle');
    const lcp = Date.now() - startTime;

    // Cumulative Layout Shift (CLS) - check for layout stability
    const layoutShifts = await page.evaluate(() => {
      return new Promise(resolve => {
        let cls = 0;
        const observer = new PerformanceObserver(list => {
          for (const entry of list.getEntries()) {
            // @ts-ignore
            if (!entry.hadRecentInput) {
              // @ts-ignore
              cls += entry.value;
            }
          }
        });

        try {
          observer.observe({ type: 'layout-shift', buffered: true });
          setTimeout(() => {
            observer.disconnect();
            resolve(cls);
          }, 1000);
        } catch (e) {
          resolve(0);
        }
      });
    });

    console.log(`\n=== Core Web Vitals (Simulated) ===`);
    console.log(`First Contentful Paint (FCP): ${fcp}ms ${fcp < 1800 ? '✅' : '⚠️'}`);
    console.log(`Largest Contentful Paint (LCP): ${lcp}ms ${lcp < 2500 ? '✅' : '⚠️'}`);
    console.log(`Cumulative Layout Shift (CLS): ${layoutShifts} ${layoutShifts < 0.1 ? '✅' : '⚠️'}`);

    console.log(`\n--- Thresholds ---`);
    console.log(`FCP: Good < 1.8s, Needs Improvement < 3s`);
    console.log(`LCP: Good < 2.5s, Needs Improvement < 4s`);
    console.log(`CLS: Good < 0.1, Needs Improvement < 0.25`);

    // Performance grade
    const grade = (fcp < 1800 && lcp < 2500) ? 'A' :
                  (fcp < 3000 && lcp < 4000) ? 'B' : 'C';
    console.log(`\nPerformance Grade: ${grade}`);
  });
});
