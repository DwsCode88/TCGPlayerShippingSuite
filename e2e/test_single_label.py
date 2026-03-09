import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL

SAMPLE_ADDRESS = """John Doe
123 Main St
Springfield, IL 62704
US"""


@pytest.mark.single_label
class TestSingleLabel:
    def test_page_loads(self, logged_in_driver):
        """Single Label page loads with address input area."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/single-label")
        wait = WebDriverWait(driver, 10)

        textarea = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "textarea"))
        )
        assert textarea.is_displayed()

    def test_parse_address_fills_fields(self, logged_in_driver):
        """Pasting an address and clicking Parse fills the form fields."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/single-label")
        wait = WebDriverWait(driver, 10)

        textarea = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "textarea"))
        )
        textarea.clear()
        textarea.send_keys(SAMPLE_ADDRESS)

        parse_btn = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//button[contains(text(), 'Parse')]")
            )
        )
        parse_btn.click()

        wait.until(
            lambda d: d.find_element(
                By.XPATH, "//input[@value='John Doe']"
            )
        )

        page_source = driver.page_source
        assert "Springfield" in page_source
        assert "62704" in page_source

    def test_has_package_selector(self, logged_in_driver):
        """Page has a package type selector."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/single-label")
        wait = WebDriverWait(driver, 10)

        wait.until(EC.presence_of_element_located((By.TAG_NAME, "textarea")))

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert any(
            kw in page_text for kw in ["Package", "Envelope", "package"]
        ), "Package selector not found"

    def test_generate_button_exists(self, logged_in_driver):
        """Generate Label button is present on the page."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/single-label")
        wait = WebDriverWait(driver, 10)

        wait.until(EC.presence_of_element_located((By.TAG_NAME, "textarea")))

        gen_btn = driver.find_element(
            By.XPATH, "//button[contains(text(), 'Generate')]"
        )
        assert gen_btn.is_displayed()

    def test_non_machinable_checkbox_exists(self, logged_in_driver):
        """Non-machinable checkbox is available."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/single-label")
        wait = WebDriverWait(driver, 10)

        wait.until(EC.presence_of_element_located((By.TAG_NAME, "textarea")))

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "non-machinable" in page_text.lower() or "non machinable" in page_text.lower()
