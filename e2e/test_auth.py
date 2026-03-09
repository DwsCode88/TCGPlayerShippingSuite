import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL, login


@pytest.mark.auth
@pytest.mark.smoke
class TestAuth:
    def test_login_page_loads(self, driver):
        """Login page renders with the Dev Sign In button in emulator mode."""
        driver.get(f"{BASE_URL}/login")
        wait = WebDriverWait(driver, 10)
        dev_btn = wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//button[contains(text(), 'Dev Sign In')]")
            )
        )
        assert dev_btn.is_displayed()

        # Header text is visible
        header = driver.find_element(By.XPATH, "//*[contains(text(), 'TCG Shipping')]")
        assert header.is_displayed()

    def test_dev_sign_in_redirects_to_dashboard(self, driver):
        """Clicking Dev Sign In logs in and redirects to /dashboard."""
        login(driver, wait_for_dashboard=True)
        assert "/dashboard" in driver.current_url

    def test_session_cookie_set_after_login(self, driver):
        """After login, the __session cookie exists so middleware allows access."""
        login(driver)
        cookies = {c["name"]: c for c in driver.get_cookies()}
        assert "__session" in cookies
        assert len(cookies["__session"]["value"]) > 20  # JWT token

    def test_protected_route_redirects_to_login(self, driver):
        """Visiting /dashboard without auth redirects to /login."""
        # Clear cookies to simulate unauthenticated state
        driver.delete_all_cookies()
        driver.get(f"{BASE_URL}/dashboard")
        wait = WebDriverWait(driver, 10)
        wait.until(EC.url_contains("/login"))
        assert "/login" in driver.current_url

    def test_login_respects_redirect_param(self, driver):
        """After login with ?redirect=/dashboard/settings, user ends up at settings."""
        driver.delete_all_cookies()
        driver.get(f"{BASE_URL}/login?redirect=/dashboard/settings")
        wait = WebDriverWait(driver, 15)
        dev_btn = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//button[contains(text(), 'Dev Sign In')]")
            )
        )
        dev_btn.click()
        wait.until(EC.url_contains("/dashboard/settings"))
        assert "/dashboard/settings" in driver.current_url
