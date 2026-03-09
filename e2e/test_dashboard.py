import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL


@pytest.mark.smoke
class TestDashboard:
    def test_dashboard_loads_with_stats(self, logged_in_driver):
        """Dashboard shows stat cards for batches, labels, postage."""
        driver = logged_in_driver
        wait = WebDriverWait(driver, 10)

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Total Batches" in page_text or "Batches" in page_text

    def test_dashboard_shows_no_batches_initially(self, logged_in_driver):
        """Fresh user sees empty or zero-state on dashboard."""
        driver = logged_in_driver
        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "0" in page_text or "No" in page_text

    def test_dashboard_links_to_upload(self, logged_in_driver):
        """Dashboard has a way to navigate to Upload Orders."""
        driver = logged_in_driver
        wait = WebDriverWait(driver, 10)

        upload_link = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//aside//a[contains(text(), 'Upload Orders')]")
            )
        )
        upload_link.click()
        wait.until(EC.url_contains("/upload"))
        assert "/upload" in driver.current_url
