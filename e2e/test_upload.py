import os
import time
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL

CSV_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample_orders.csv")


@pytest.mark.upload
class TestUpload:
    def test_upload_page_loads(self, logged_in_driver):
        """Upload page renders with drop zone."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/upload")
        wait = WebDriverWait(driver, 10)

        page_text = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        ).text
        assert any(
            kw in page_text for kw in ["Drop", "Browse", "CSV", "drag", "upload"]
        ), f"Upload page missing drop zone indicators. Text: {page_text[:200]}"

    def test_csv_upload_shows_preview(self, logged_in_driver):
        """Uploading a CSV file shows the order preview table."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/upload")
        wait = WebDriverWait(driver, 10)

        file_input = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='file']"))
        )
        file_input.send_keys(os.path.abspath(CSV_PATH))

        wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//*[contains(text(), 'ORD-001')]")
            )
        )

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "ORD-001" in page_text
        assert "ORD-002" in page_text
        assert "ORD-003" in page_text

    def test_csv_upload_shows_names(self, logged_in_driver):
        """Uploaded CSV shows recipient names in preview."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/upload")
        wait = WebDriverWait(driver, 10)

        file_input = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='file']"))
        )
        file_input.send_keys(os.path.abspath(CSV_PATH))

        wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//*[contains(text(), 'John Doe')]")
            )
        )

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "John Doe" in page_text
        assert "Jane Smith" in page_text
        assert "Bob Wilson" in page_text

    def test_csv_upload_has_package_column(self, logged_in_driver):
        """Preview table has a Package column with selectable package types."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/upload")
        wait = WebDriverWait(driver, 10)

        file_input = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='file']"))
        )
        file_input.send_keys(os.path.abspath(CSV_PATH))

        wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//*[contains(text(), 'ORD-001')]")
            )
        )

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Package" in page_text

    def test_generate_button_present_after_upload(self, logged_in_driver):
        """After uploading CSV, Generate Labels button appears."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/upload")
        wait = WebDriverWait(driver, 10)

        file_input = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='file']"))
        )
        file_input.send_keys(os.path.abspath(CSV_PATH))

        wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//*[contains(text(), 'ORD-001')]")
            )
        )

        gen_btn = driver.find_element(
            By.XPATH, "//button[contains(text(), 'Generate')]"
        )
        assert gen_btn.is_displayed()

    def test_clear_draft_button(self, logged_in_driver):
        """Clear draft button removes the preview table."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/upload")
        wait = WebDriverWait(driver, 10)

        file_input = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='file']"))
        )
        file_input.send_keys(os.path.abspath(CSV_PATH))

        wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//*[contains(text(), 'ORD-001')]")
            )
        )

        clear_btn = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//button[contains(text(), 'Clear')]")
            )
        )
        clear_btn.click()

        time.sleep(1)
        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "ORD-001" not in page_text
