from playwright.sync_api import sync_playwright, expect

def verify_dashboard():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # Go to the local preview server
        page.goto("http://localhost:4173")

        # 1. Verify Header Elements
        expect(page.get_by_text("Crawlith")).to_be_visible()
        expect(page.get_by_role("heading", name="example.com")).to_be_visible()

        # 2. Verify Primary Metrics
        expect(page.get_by_text("Health Score")).to_be_visible()
        # Be precise with Critical Issues - it appears in heading and button
        expect(page.get_by_role("heading", name="Critical Issues")).to_be_visible()
        expect(page.get_by_text("Indexability Risk")).to_be_visible()

        # 3. Verify Issues Table
        expect(page.get_by_text("Issues Detected")).to_be_visible()
        # Use first() because URL appears in both Issues Table and PageRank Table
        expect(page.get_by_role("columnheader", name="URL").first).to_be_visible()

        # 4. Verify Critical Panel
        expect(page.get_by_text("Critical Attention")).to_be_visible()

        # 5. Verify Graph Intelligence Section
        expect(page.get_by_text("Top Pages by PageRank")).to_be_visible()

        # 6. Test Interactive Elements (Drawer)
        page.wait_for_selector("tbody tr")
        first_issue_row = page.locator("tbody tr").first
        first_issue_row.click()

        # Expect Drawer to appear
        expect(page.get_by_text("Affected URL")).to_be_visible()

        # Close Drawer
        page.get_by_role("button", name="Close").click()

        # 7. Screenshot
        page.screenshot(path="dashboard_verification.png", full_page=True)

        browser.close()

if __name__ == "__main__":
    verify_dashboard()
