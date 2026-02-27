import asyncio
from playwright.async_api import async_playwright, expect

async def verify_dashboard():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1280, "height": 800})

        # Navigate to the dashboard
        await page.goto("http://localhost:5000")

        # Wait for dashboard to load (look for "Health Score" or similar key element)
        await page.wait_for_selector("text=Health Score", timeout=10000)

        # Verify domain is correct
        domain_heading = page.locator("h1")
        await expect(domain_heading).to_have_text("example.com")

        # Verify snapshot ID is present in header
        snapshot_button = page.locator("button:has-text('Snapshot #1')")
        await expect(snapshot_button).to_be_visible()

        # Take a full page screenshot
        await page.screenshot(path="verification/dashboard_verification.png", full_page=True)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_dashboard())
