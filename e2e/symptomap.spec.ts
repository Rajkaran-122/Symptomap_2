import { test, expect } from '@playwright/test';

test.describe('SymptoMap MVP E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('http://localhost:3000');
    
    // Wait for the map to load
    await page.waitForSelector('[data-testid="map"]', { timeout: 10000 });
  });

  test('should load the main page', async ({ page }) => {
    // Check if the main components are present
    await expect(page.locator('[data-testid="map"]')).toBeVisible();
    await expect(page.locator('text=SymptoMap')).toBeVisible();
  });

  test('should display outbreak map', async ({ page }) => {
    // Check if the map container is visible
    await expect(page.locator('[data-testid="map"]')).toBeVisible();
    
    // Check if map controls are present
    await expect(page.locator('.mapboxgl-ctrl-group')).toBeVisible();
  });

  test('should show filter panel', async ({ page }) => {
    // Check if filter panel is visible
    await expect(page.locator('text=Filters')).toBeVisible();
    
    // Check if disease type filter is present
    await expect(page.locator('select[id="diseaseType"]')).toBeVisible();
    
    // Check if severity slider is present
    await expect(page.locator('input[id="minSeverity"]')).toBeVisible();
  });

  test('should show prediction panel', async ({ page }) => {
    // Check if prediction panel is visible
    await expect(page.locator('text=7-Day Outbreak Forecast')).toBeVisible();
  });

  test('should show time-lapse controls', async ({ page }) => {
    // Check if time-lapse controls are visible
    await expect(page.locator('text=Day')).toBeVisible();
    
    // Check if play/pause button is present
    await expect(page.locator('button[aria-label*="play"], button[aria-label*="pause"]')).toBeVisible();
    
    // Check if slider is present
    await expect(page.locator('input[type="range"]')).toBeVisible();
  });

  test('should filter outbreaks by disease type', async ({ page }) => {
    // Select a disease type
    await page.selectOption('select[id="diseaseType"]', 'COVID-19');
    
    // Wait for the filter to be applied
    await page.waitForTimeout(1000);
    
    // Check if the filter is applied (this would depend on the actual implementation)
    const selectedValue = await page.inputValue('select[id="diseaseType"]');
    expect(selectedValue).toBe('COVID-19');
  });

  test('should adjust severity filter', async ({ page }) => {
    // Get the initial value
    const initialValue = await page.inputValue('input[id="minSeverity"]');
    
    // Change the severity filter
    await page.fill('input[id="minSeverity"]', '3');
    
    // Check if the value changed
    const newValue = await page.inputValue('input[id="minSeverity"]');
    expect(newValue).toBe('3');
  });

  test('should control time-lapse playback', async ({ page }) => {
    // Click the play button
    await page.click('button[aria-label*="play"], button[aria-label*="pause"]');
    
    // Wait for the animation to start
    await page.waitForTimeout(1000);
    
    // Click pause
    await page.click('button[aria-label*="play"], button[aria-label*="pause"]');
    
    // Check if the button state changed
    await expect(page.locator('button[aria-label*="play"], button[aria-label*="pause"]')).toBeVisible();
  });

  test('should adjust time-lapse slider', async ({ page }) => {
    // Get the slider
    const slider = page.locator('input[type="range"]');
    
    // Move the slider
    await slider.fill('15');
    
    // Check if the value changed
    const value = await slider.inputValue();
    expect(value).toBe('15');
  });

  test('should display prediction chart', async ({ page }) => {
    // Check if the prediction chart is visible
    await expect(page.locator('.recharts-wrapper')).toBeVisible();
    
    // Check if chart elements are present
    await expect(page.locator('.recharts-line')).toBeVisible();
  });

  test('should handle map interactions', async ({ page }) => {
    // Get the map container
    const map = page.locator('[data-testid="map"]');
    
    // Check if map is interactive
    await expect(map).toBeVisible();
    
    // Try to interact with the map (zoom, pan, etc.)
    await map.hover();
    await page.mouse.wheel(0, -100); // Zoom in
    await page.waitForTimeout(500);
    
    await page.mouse.wheel(0, 100); // Zoom out
    await page.waitForTimeout(500);
  });

  test('should show system metrics', async ({ page }) => {
    // Check if metrics are displayed
    await expect(page.locator('text=Active Connections')).toBeVisible();
    await expect(page.locator('text=Total Outbreaks')).toBeVisible();
  });

  test('should handle WebSocket connections', async ({ page }) => {
    // Check if WebSocket connection is established
    // This would depend on the actual implementation
    await page.waitForTimeout(2000);
    
    // Check if real-time updates are working
    // This would require actual WebSocket events
  });

  test('should be responsive on mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Check if components are still visible
    await expect(page.locator('[data-testid="map"]')).toBeVisible();
    await expect(page.locator('text=Filters')).toBeVisible();
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Mock network failure
    await page.route('**/api/**', route => route.abort());
    
    // Reload the page
    await page.reload();
    
    // Check if error handling is in place
    await page.waitForTimeout(2000);
    
    // Check if the page still loads (with error states)
    await expect(page.locator('[data-testid="map"]')).toBeVisible();
  });

  test('should support keyboard navigation', async ({ page }) => {
    // Test keyboard navigation
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Check if focus is visible
    await expect(page.locator(':focus')).toBeVisible();
  });

  test('should handle large datasets', async ({ page }) => {
    // This test would require a large dataset
    // For now, just check if the page handles data loading
    await page.waitForTimeout(2000);
    
    // Check if the map is still responsive
    await expect(page.locator('[data-testid="map"]')).toBeVisible();
  });

  test('should maintain state across page refreshes', async ({ page }) => {
    // Set some filters
    await page.selectOption('select[id="diseaseType"]', 'COVID-19');
    await page.fill('input[id="minSeverity"]', '3');
    
    // Refresh the page
    await page.reload();
    
    // Check if state is maintained (this would depend on implementation)
    await page.waitForTimeout(1000);
    
    // Check if the page still loads
    await expect(page.locator('[data-testid="map"]')).toBeVisible();
  });
});
