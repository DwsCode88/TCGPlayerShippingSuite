import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL


@pytest.mark.pages
class TestPublicPages:
    def test_landing_page_loads(self, driver):
        """Landing page (/) loads with branding and CTA."""
        driver.get(BASE_URL)
        wait = WebDriverWait(driver, 10)

        page_text = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        ).text
        assert any(
            kw in page_text for kw in ["TCG", "Shipping", "shipping"]
        ), f"Landing page missing branding. Text: {page_text[:200]}"

    def test_landing_has_get_started(self, driver):
        """Landing page has a Get Started / Sign Up CTA."""
        driver.get(BASE_URL)
        wait = WebDriverWait(driver, 10)

        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert any(
            kw in page_text
            for kw in ["Get Started", "Sign Up", "Start", "Login", "Sign In"]
        ), f"CTA not found. Text: {page_text[:200]}"

    def test_landing_cta_navigates_to_login(self, driver):
        """Clicking CTA on landing page navigates to login."""
        driver.get(BASE_URL)
        wait = WebDriverWait(driver, 10)

        cta = None
        for text in ["Get Started", "Sign Up", "Start Free", "Login"]:
            try:
                cta = driver.find_element(
                    By.XPATH,
                    f"//a[contains(text(), '{text}')] | //button[contains(text(), '{text}')]",
                )
                if cta.is_displayed():
                    break
            except Exception:
                continue

        assert cta is not None, "No CTA found on landing page"
        cta.click()
        wait.until(
            lambda d: "/login" in d.current_url or "/dashboard" in d.current_url
        )

    def test_demo_page_loads(self, driver):
        """Demo page (/demo) loads with content."""
        driver.get(f"{BASE_URL}/demo")
        wait = WebDriverWait(driver, 10)

        page_text = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        ).text
        assert len(page_text) > 50, f"Demo page appears empty. Text: {page_text[:100]}"

    def test_login_page_has_email_password_fields(self, driver):
        """Login page has email and password inputs."""
        driver.get(f"{BASE_URL}/login")
        wait = WebDriverWait(driver, 10)

        email_input = wait.until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "input[type='email']")
            )
        )
        password_input = driver.find_element(
            By.CSS_SELECTOR, "input[type='password']"
        )
        assert email_input.is_displayed()
        assert password_input.is_displayed()

    def test_login_page_has_sign_up_toggle(self, driver):
        """Login page has a toggle to switch between sign in and sign up."""
        driver.get(f"{BASE_URL}/login")
        wait = WebDriverWait(driver, 10)

        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert (
            "Sign up" in page_text
            or "Create" in page_text
            or "sign up" in page_text.lower()
        )
