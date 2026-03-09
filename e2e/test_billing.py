import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL


@pytest.mark.billing
class TestBilling:
    def test_billing_page_loads(self, logged_in_driver):
        """Billing page renders with plan information."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/billing")
        wait = WebDriverWait(driver, 10)

        page_text = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        ).text
        assert any(
            kw in page_text for kw in ["Plan", "Pro", "Free", "Billing"]
        ), f"Billing page missing plan info. Text: {page_text[:200]}"

    def test_billing_shows_usage(self, logged_in_driver):
        """Billing page shows label usage count."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/billing")
        wait = WebDriverWait(driver, 10)

        page_text = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        ).text
        assert any(
            kw in page_text.lower()
            for kw in ["usage", "labels", "month", "\u221e", "unlimited"]
        ), f"Usage info not found. Text: {page_text[:300]}"

    def test_billing_shows_pro_status(self, logged_in_driver):
        """Dev user is Pro - billing should reflect that."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/billing")
        wait = WebDriverWait(driver, 10)

        page_text = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        ).text
        assert "Pro" in page_text, f"Pro status not shown. Text: {page_text[:300]}"
