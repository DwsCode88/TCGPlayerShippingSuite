import time
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL


@pytest.mark.settings
class TestSettings:
    def _go_to_settings(self, driver):
        driver.get(f"{BASE_URL}/dashboard/settings")
        wait = WebDriverWait(driver, 10)
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        return wait

    def test_settings_page_loads(self, logged_in_driver):
        """Settings page renders with accordion sections."""
        driver = logged_in_driver
        self._go_to_settings(driver)

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "EasyPost" in page_text or "API Key" in page_text
        assert "From Address" in page_text or "Address" in page_text

    def test_accordion_sections_exist(self, logged_in_driver):
        """All settings accordion sections are present."""
        driver = logged_in_driver
        self._go_to_settings(driver)

        page_text = driver.find_element(By.TAG_NAME, "body").text

        expected_sections = [
            "EasyPost",
            "Address",
            "Cost",
            "Threshold",
            "Package",
            "Logo",
        ]
        for section in expected_sections:
            assert section.lower() in page_text.lower(), (
                f"Settings section containing '{section}' not found"
            )

    def test_easypost_key_input_exists(self, logged_in_driver):
        """EasyPost API Key section has an input field."""
        driver = logged_in_driver
        self._go_to_settings(driver)

        # Click on EasyPost accordion trigger to expand
        triggers = driver.find_elements(By.CSS_SELECTOR, "[data-trigger]")
        for trigger in triggers:
            if "easypost" in trigger.text.lower() or "api" in trigger.text.lower():
                trigger.click()
                break

        time.sleep(0.5)

        inputs = driver.find_elements(By.TAG_NAME, "input")
        key_input = None
        for inp in inputs:
            placeholder = (inp.get_attribute("placeholder") or "").lower()
            if "key" in placeholder or "easypost" in placeholder or "ezak" in placeholder:
                key_input = inp
                break

        assert key_input is not None, "EasyPost API key input not found"

    def test_from_address_fields_exist(self, logged_in_driver):
        """From Address section has name, street, city, state, zip fields."""
        driver = logged_in_driver
        self._go_to_settings(driver)

        triggers = driver.find_elements(By.CSS_SELECTOR, "[data-trigger]")
        for trigger in triggers:
            if "address" in trigger.text.lower():
                trigger.click()
                break

        time.sleep(0.5)

        page_text = driver.find_element(By.TAG_NAME, "body").text
        for field in ["Name", "Street", "City", "State", "ZIP"]:
            assert field in page_text, f"From Address field '{field}' not found"

    def test_save_button_exists(self, logged_in_driver):
        """Settings page has at least one Save button."""
        driver = logged_in_driver
        self._go_to_settings(driver)

        save_btns = driver.find_elements(
            By.XPATH, "//button[contains(text(), 'Save')]"
        )
        assert len(save_btns) > 0, "No Save button found on settings page"

    def test_show_hide_api_key(self, logged_in_driver):
        """API key field has a show/hide toggle."""
        driver = logged_in_driver
        self._go_to_settings(driver)

        triggers = driver.find_elements(By.CSS_SELECTOR, "[data-trigger]")
        for trigger in triggers:
            if "easypost" in trigger.text.lower() or "api" in trigger.text.lower():
                trigger.click()
                break

        time.sleep(0.5)

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Show" in page_text or "Hide" in page_text, "Show/Hide toggle not found"
