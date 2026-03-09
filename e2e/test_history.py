import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL


@pytest.mark.history
class TestHistory:
    def test_history_page_loads(self, logged_in_driver):
        """History page loads."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/history")
        wait = WebDriverWait(driver, 10)

        page_text = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        ).text
        assert "History" in page_text or "Batch" in page_text

    def test_empty_history_no_errors(self, logged_in_driver):
        """Fresh user sees no error states on history page."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/history")
        wait = WebDriverWait(driver, 10)

        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))

        page_text = driver.find_element(By.TAG_NAME, "body").text
        # Should not have unhandled error states
        assert "Error" not in page_text

    def test_history_has_download_report_button(self, logged_in_driver):
        """History page has a Download Full Report button."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/history")
        wait = WebDriverWait(driver, 10)

        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Download" in page_text or "Export" in page_text or "Report" in page_text
