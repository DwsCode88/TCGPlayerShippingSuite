import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL


SIDEBAR_LINKS = [
    ("Dashboard", "/dashboard"),
    ("Upload Orders", "/upload"),
    ("Single Label", "/dashboard/single-label"),
    ("History", "/dashboard/history"),
    ("Settings", "/dashboard/settings"),
    ("Billing", "/dashboard/billing"),
]


@pytest.mark.navigation
class TestNavigation:
    def test_sidebar_visible_on_dashboard(self, logged_in_driver):
        """Sidebar is visible and contains all navigation links."""
        driver = logged_in_driver
        for label, _ in SIDEBAR_LINKS:
            link = driver.find_element(By.XPATH, f"//aside//a[contains(text(), '{label}')]")
            assert link.is_displayed(), f"Sidebar link '{label}' not visible"

    @pytest.mark.parametrize("label,path", SIDEBAR_LINKS)
    def test_sidebar_link_navigates(self, logged_in_driver, label, path):
        """Each sidebar link navigates to the correct page."""
        driver = logged_in_driver
        wait = WebDriverWait(driver, 10)

        link = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, f"//aside//a[contains(text(), '{label}')]")
            )
        )
        link.click()
        wait.until(EC.url_contains(path))
        assert path in driver.current_url

    def test_sign_out_redirects_to_landing(self, logged_in_driver):
        """Clicking Sign Out in sidebar redirects to landing page."""
        driver = logged_in_driver
        wait = WebDriverWait(driver, 10)

        sign_out_btn = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//aside//button[contains(text(), 'Sign Out')]")
            )
        )
        sign_out_btn.click()
        wait.until(lambda d: d.current_url.rstrip("/") == BASE_URL or "/login" in d.current_url)

    def test_active_link_highlighted(self, logged_in_driver):
        """The current page's sidebar link has active styling."""
        driver = logged_in_driver
        # On /dashboard, the Dashboard link should be active
        dashboard_link = driver.find_element(
            By.XPATH, "//aside//a[contains(text(), 'Dashboard')]"
        )
        bg = dashboard_link.value_of_css_property("background-color")
        # Active link should have non-transparent background
        assert bg != "rgba(0, 0, 0, 0)", "Active link should have a background color"
