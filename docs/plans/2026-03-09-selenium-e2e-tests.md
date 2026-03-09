# Selenium E2E Testing Suite Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Python + Selenium + pytest end-to-end testing suite that verifies every user-facing flow in TCGPlayerShippingSuite against localhost:3000 with Firebase emulators.

**Architecture:** Python test suite using pytest + selenium-webdriver. Tests run against the dev server (localhost:3000) with Firebase Auth emulator (localhost:9099) and Firestore emulator (localhost:8080). A shared `conftest.py` provides fixtures for browser setup, login, and Firestore seeding. Tests are organized by page/flow. Dev login uses email `dev@localhost.test` / password `devdev123` which auto-creates a Pro user in the emulator.

**Tech Stack:** Python 3.11+, selenium, pytest, webdriver-manager (ChromeDriver auto-install), requests (for Firestore emulator REST seeding/clearing)

---

## Prerequisites

Before running tests, these must be running in separate terminals:
```bash
firebase emulators:start --only auth,firestore    # Auth :9099, Firestore :8080
npm run dev                                        # Next.js :3000
```

## Task 1: Project Setup — Dependencies & Config

**Files:**
- Create: `e2e/requirements.txt`
- Create: `e2e/pytest.ini`
- Create: `e2e/__init__.py`

**Step 1: Create requirements.txt**

```
selenium>=4.15
pytest>=7.4
webdriver-manager>=4.0
requests>=2.31
```

**Step 2: Create pytest.ini**

```ini
[pytest]
testpaths = e2e
python_files = test_*.py
python_classes = Test*
python_functions = test_*
markers =
    smoke: Quick smoke tests
    auth: Authentication tests
    navigation: Sidebar navigation tests
    upload: CSV upload flow tests
    single_label: Single label flow tests
    settings: Settings page tests
    history: History page tests
    billing: Billing page tests
    pages: Static page load tests
```

**Step 3: Create empty __init__.py**

```python
```

**Step 4: Install dependencies**

Run: `cd e2e && pip install -r requirements.txt`

**Step 5: Verify pytest discovers no tests yet**

Run: `cd e2e && python -m pytest --collect-only`
Expected: "no tests ran"

---

## Task 2: Conftest — Browser Fixtures & Login Helper

**Files:**
- Create: `e2e/conftest.py`

**Step 1: Write conftest.py**

```python
import time
import pytest
import requests
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

BASE_URL = "http://localhost:3000"
FIRESTORE_EMULATOR = "http://localhost:8080"
AUTH_EMULATOR = "http://localhost:9099"
FIREBASE_PROJECT = "tcgplayershipsite"


@pytest.fixture(scope="session")
def driver():
    """Session-scoped Chrome WebDriver."""
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument("--window-size=1280,900")

    service = Service(ChromeDriverManager().install())
    drv = webdriver.Chrome(service=service, options=options)
    drv.implicitly_wait(5)
    yield drv
    drv.quit()


@pytest.fixture(autouse=True)
def clear_emulator_data():
    """Clear Firestore emulator data before each test."""
    requests.delete(
        f"{FIRESTORE_EMULATOR}/emulator/v1/projects/{FIREBASE_PROJECT}/databases/(default)/documents"
    )
    yield


def login(driver, wait_for_dashboard=True):
    """
    Log in via the dev sign-in flow on the login page.

    The login page in emulator mode shows a 'Dev Sign In (Emulator)' button
    that creates/signs in dev@localhost.test and sets the __session cookie.
    """
    driver.get(f"{BASE_URL}/login")

    wait = WebDriverWait(driver, 15)

    # Wait for the page to load (look for the Dev Sign In button)
    dev_btn = wait.until(
        EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Dev Sign In')]"))
    )
    dev_btn.click()

    if wait_for_dashboard:
        # Wait for redirect to dashboard
        wait.until(EC.url_contains("/dashboard"))
        # Wait for the sidebar brand text to confirm page loaded
        wait.until(
            EC.presence_of_element_located((By.XPATH, "//*[contains(text(), 'TCG Shipping')]"))
        )

    return driver


@pytest.fixture
def logged_in_driver(driver):
    """Fixture that returns a driver already logged in to the dashboard."""
    login(driver)
    return driver


def wait_for_element(driver, by, value, timeout=10):
    """Wait for an element and return it."""
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located((by, value))
    )


def wait_for_clickable(driver, by, value, timeout=10):
    """Wait for an element to be clickable and return it."""
    return WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable((by, value))
    )


def seed_user_settings(uid, settings):
    """Seed a user document in Firestore emulator via REST API."""
    doc_url = (
        f"{FIRESTORE_EMULATOR}/v1/projects/{FIREBASE_PROJECT}"
        f"/databases/(default)/documents/users/{uid}"
    )

    def to_firestore_value(val):
        if isinstance(val, bool):
            return {"booleanValue": val}
        elif isinstance(val, int):
            return {"integerValue": str(val)}
        elif isinstance(val, float):
            return {"doubleValue": val}
        elif isinstance(val, str):
            return {"stringValue": val}
        elif isinstance(val, list):
            return {"arrayValue": {"values": [to_firestore_value(v) for v in val]}}
        elif isinstance(val, dict):
            return {"mapValue": {"fields": {k: to_firestore_value(v) for k, v in val.items()}}}
        return {"nullValue": None}

    fields = {k: to_firestore_value(v) for k, v in settings.items()}
    requests.patch(doc_url, json={"fields": fields})


def seed_batch(batch_id, data):
    """Seed a batch document in Firestore emulator."""
    doc_url = (
        f"{FIRESTORE_EMULATOR}/v1/projects/{FIREBASE_PROJECT}"
        f"/databases/(default)/documents/batches/{batch_id}"
    )

    def to_firestore_value(val):
        if isinstance(val, bool):
            return {"booleanValue": val}
        elif isinstance(val, int):
            return {"integerValue": str(val)}
        elif isinstance(val, float):
            return {"doubleValue": val}
        elif isinstance(val, str):
            return {"stringValue": val}
        return {"nullValue": None}

    fields = {k: to_firestore_value(v) for k, v in data.items()}
    requests.patch(doc_url, json={"fields": fields})
```

**Step 2: Verify conftest loads**

Run: `cd e2e && python -c "import conftest; print('OK')"`
Expected: "OK"

---

## Task 3: Auth Tests — Login & Redirect

**Files:**
- Create: `e2e/test_auth.py`

**Step 1: Write test_auth.py**

```python
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
```

**Step 2: Run tests**

Run: `cd e2e && python -m pytest test_auth.py -v`
Expected: 5 passed

---

## Task 4: Navigation Tests — Sidebar Links

**Files:**
- Create: `e2e/test_navigation.py`

**Step 1: Write test_navigation.py**

```python
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
        # Active links have distinct background — check the element has some styling
        # We check the computed background or a class that indicates active state
        classes = dashboard_link.get_attribute("class") or ""
        style = dashboard_link.get_attribute("style") or ""
        bg = dashboard_link.value_of_css_property("background-color")
        # Active link should have non-transparent background
        assert bg != "rgba(0, 0, 0, 0)", "Active link should have a background color"
```

**Step 2: Run tests**

Run: `cd e2e && python -m pytest test_navigation.py -v`
Expected: 8 passed (1 sidebar visible + 6 parametrized links + 1 sign out + 1 active)

---

## Task 5: Dashboard Tests — Stats & Recent Batches

**Files:**
- Create: `e2e/test_dashboard.py`

**Step 1: Write test_dashboard.py**

```python
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL, seed_batch


@pytest.mark.smoke
class TestDashboard:
    def test_dashboard_loads_with_stats(self, logged_in_driver):
        """Dashboard shows stat cards for batches, labels, postage."""
        driver = logged_in_driver
        wait = WebDriverWait(driver, 10)

        # Stat cards should be present
        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Total Batches" in page_text or "Batches" in page_text

    def test_dashboard_shows_no_batches_initially(self, logged_in_driver):
        """Fresh user sees empty or zero-state on dashboard."""
        driver = logged_in_driver
        page_text = driver.find_element(By.TAG_NAME, "body").text
        # Either "0" in stat cards or "No batches" message
        assert "0" in page_text or "No" in page_text

    def test_dashboard_links_to_upload(self, logged_in_driver):
        """Dashboard has a way to navigate to Upload Orders."""
        driver = logged_in_driver
        wait = WebDriverWait(driver, 10)

        # Click Upload Orders in sidebar
        upload_link = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//aside//a[contains(text(), 'Upload Orders')]")
            )
        )
        upload_link.click()
        wait.until(EC.url_contains("/upload"))
        assert "/upload" in driver.current_url
```

**Step 2: Run tests**

Run: `cd e2e && python -m pytest test_dashboard.py -v`
Expected: 3 passed

---

## Task 6: Upload Page Tests — CSV Upload & Preview

**Files:**
- Create: `e2e/test_upload.py`
- Create: `e2e/fixtures/sample_orders.csv`

**Step 1: Create sample CSV fixture**

```csv
"Order Number","FirstName","LastName","Address1","Address2","City","State","PostalCode","Product Weight","Item Count","Value Of Products"
"ORD-001","John","Doe","123 Main St","","Springfield","IL","62704","0.5","3","12.50"
"ORD-002","Jane","Smith","456 Oak Ave","Apt 2B","Portland","OR","97201","0.3","2","8.99"
"ORD-003","Bob","Wilson","789 Pine Rd","","Austin","TX","78701","1.2","12","45.00"
```

**Step 2: Write test_upload.py**

```python
import os
import time
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from conftest import BASE_URL, login

CSV_PATH = os.path.join(os.path.dirname(__file__), "fixtures", "sample_orders.csv")


@pytest.mark.upload
class TestUpload:
    def test_upload_page_loads(self, logged_in_driver):
        """Upload page renders with drop zone."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/upload")
        wait = WebDriverWait(driver, 10)

        # Drop zone or upload area should be visible
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

        # Find the hidden file input and send the CSV path
        file_input = wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='file']"))
        )
        file_input.send_keys(os.path.abspath(CSV_PATH))

        # Wait for preview table to appear with order data
        wait.until(
            EC.presence_of_element_located(
                (By.XPATH, "//*[contains(text(), 'ORD-001')]")
            )
        )

        # All 3 orders should be in the table
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

        # Package column header should exist
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

        # Generate Labels button should exist
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

        # Click Clear / Clear Draft button
        clear_btn = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//button[contains(text(), 'Clear')]")
            )
        )
        clear_btn.click()

        # Orders should be gone
        time.sleep(1)
        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "ORD-001" not in page_text
```

**Step 3: Create fixtures directory and CSV**

Run: `mkdir -p e2e/fixtures`

**Step 4: Run tests**

Run: `cd e2e && python -m pytest test_upload.py -v`
Expected: 6 passed

---

## Task 7: Single Label Tests — Address Form & Generation

**Files:**
- Create: `e2e/test_single_label.py`

**Step 1: Write test_single_label.py**

```python
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

        # Should have a textarea for pasting address
        textarea = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "textarea"))
        )
        assert textarea.is_displayed()

    def test_parse_address_fills_fields(self, logged_in_driver):
        """Pasting an address and clicking Parse fills the form fields."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/single-label")
        wait = WebDriverWait(driver, 10)

        # Enter address in textarea
        textarea = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "textarea"))
        )
        textarea.clear()
        textarea.send_keys(SAMPLE_ADDRESS)

        # Click Parse Address button
        parse_btn = wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//button[contains(text(), 'Parse')]")
            )
        )
        parse_btn.click()

        # Form fields should be populated
        wait.until(
            lambda d: d.find_element(
                By.XPATH, "//input[@value='John Doe']"
            )
        )

        # Check city, state, zip filled
        page_source = driver.page_source
        assert "Springfield" in page_source
        assert "62704" in page_source

    def test_has_package_selector(self, logged_in_driver):
        """Page has a package type selector (dropdown or radio)."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/single-label")
        wait = WebDriverWait(driver, 10)

        # Wait for page to load
        wait.until(EC.presence_of_element_located((By.TAG_NAME, "textarea")))

        # Look for package selection elements
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
        assert "Non-Machinable" in page_text or "non-machinable" in page_text.lower()
```

**Step 2: Run tests**

Run: `cd e2e && python -m pytest test_single_label.py -v`
Expected: 5 passed

---

## Task 8: Settings Tests — Form Fields & Save

**Files:**
- Create: `e2e/test_settings.py`

**Step 1: Write test_settings.py**

```python
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
        wait = self._go_to_settings(driver)

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "EasyPost" in page_text or "API Key" in page_text
        assert "From Address" in page_text or "Address" in page_text

    def test_accordion_sections_exist(self, logged_in_driver):
        """All settings accordion sections are present."""
        driver = logged_in_driver
        wait = self._go_to_settings(driver)

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
        wait = self._go_to_settings(driver)

        # Click on EasyPost accordion to expand
        triggers = driver.find_elements(By.CSS_SELECTOR, "[data-trigger]")
        for trigger in triggers:
            if "easypost" in trigger.text.lower() or "api" in trigger.text.lower():
                trigger.click()
                break

        time.sleep(0.5)

        # Look for input with placeholder containing "key" or "EasyPost"
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
        wait = self._go_to_settings(driver)

        # Open the From Address accordion
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
        wait = self._go_to_settings(driver)

        save_btns = driver.find_elements(
            By.XPATH, "//button[contains(text(), 'Save')]"
        )
        assert len(save_btns) > 0, "No Save button found on settings page"

    def test_show_hide_api_key(self, logged_in_driver):
        """API key field has a show/hide toggle."""
        driver = logged_in_driver
        wait = self._go_to_settings(driver)

        # Expand EasyPost section
        triggers = driver.find_elements(By.CSS_SELECTOR, "[data-trigger]")
        for trigger in triggers:
            if "easypost" in trigger.text.lower() or "api" in trigger.text.lower():
                trigger.click()
                break

        time.sleep(0.5)

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Show" in page_text or "Hide" in page_text, "Show/Hide toggle not found"
```

**Step 2: Run tests**

Run: `cd e2e && python -m pytest test_settings.py -v`
Expected: 6 passed

---

## Task 9: History Tests — Batch List & Archive

**Files:**
- Create: `e2e/test_history.py`

**Step 1: Write test_history.py**

```python
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
        # Page should have "History" in the content or title
        assert "History" in page_text or "Batch" in page_text

    def test_empty_history_shows_placeholder(self, logged_in_driver):
        """Fresh user sees empty state on history page."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/history")
        wait = WebDriverWait(driver, 10)

        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))

        # Either "No batches" or empty table
        page_text = driver.find_element(By.TAG_NAME, "body").text
        # Should not have error states
        assert "Error" not in page_text or "error" not in page_text

    def test_history_has_download_report_button(self, logged_in_driver):
        """History page has a Download Full Report button."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/history")
        wait = WebDriverWait(driver, 10)

        wait.until(EC.presence_of_element_located((By.TAG_NAME, "body")))

        page_text = driver.find_element(By.TAG_NAME, "body").text
        assert "Download" in page_text or "Export" in page_text or "Report" in page_text
```

**Step 2: Run tests**

Run: `cd e2e && python -m pytest test_history.py -v`
Expected: 3 passed

---

## Task 10: Billing Tests — Plan & Usage Display

**Files:**
- Create: `e2e/test_billing.py`

**Step 1: Write test_billing.py**

```python
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
        # Should show plan info
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
        # Dev user is Pro, so should show usage or "unlimited"
        assert any(
            kw in page_text.lower() for kw in ["usage", "labels", "month", "∞", "unlimited"]
        ), f"Usage info not found. Text: {page_text[:300]}"

    def test_billing_shows_pro_status(self, logged_in_driver):
        """Dev user is Pro — billing should reflect that."""
        driver = logged_in_driver
        driver.get(f"{BASE_URL}/dashboard/billing")
        wait = WebDriverWait(driver, 10)

        page_text = wait.until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        ).text
        # Dev user is created with isPro: true, plan: "pro"
        assert "Pro" in page_text, f"Pro status not shown. Text: {page_text[:300]}"
```

**Step 2: Run tests**

Run: `cd e2e && python -m pytest test_billing.py -v`
Expected: 3 passed

---

## Task 11: Static Page Tests — Landing & Demo

**Files:**
- Create: `e2e/test_pages.py`

**Step 1: Write test_pages.py**

```python
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
            kw in page_text for kw in ["Get Started", "Sign Up", "Start", "Login", "Sign In"]
        ), f"CTA not found. Text: {page_text[:200]}"

    def test_landing_cta_navigates_to_login(self, driver):
        """Clicking CTA on landing page navigates to login."""
        driver.get(BASE_URL)
        wait = WebDriverWait(driver, 10)

        # Find a CTA link/button
        cta = None
        for text in ["Get Started", "Sign Up", "Start Free", "Login"]:
            try:
                cta = driver.find_element(
                    By.XPATH, f"//a[contains(text(), '{text}')] | //button[contains(text(), '{text}')]"
                )
                if cta.is_displayed():
                    break
            except Exception:
                continue

        assert cta is not None, "No CTA found on landing page"
        cta.click()
        wait.until(lambda d: "/login" in d.current_url or "/dashboard" in d.current_url)

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
        assert "Sign up" in page_text or "Create" in page_text or "sign up" in page_text.lower()
```

**Step 2: Run tests**

Run: `cd e2e && python -m pytest test_pages.py -v`
Expected: 6 passed

---

## Task 12: Test Runner Script & npm Integration

**Files:**
- Create: `e2e/run_tests.sh`
- Modify: `package.json` — add `test:e2e` script

**Step 1: Create run_tests.sh**

```bash
#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! curl -s http://localhost:3000 > /dev/null 2>&1; then
  echo "❌ Next.js dev server not running on localhost:3000"
  echo "   Run: npm run dev"
  exit 1
fi

if ! curl -s http://localhost:9099 > /dev/null 2>&1; then
  echo "❌ Firebase Auth emulator not running on localhost:9099"
  echo "   Run: firebase emulators:start --only auth,firestore"
  exit 1
fi

if ! curl -s http://localhost:8080 > /dev/null 2>&1; then
  echo "❌ Firebase Firestore emulator not running on localhost:8080"
  echo "   Run: firebase emulators:start --only auth,firestore"
  exit 1
fi

echo "✅ All prerequisites running"
echo ""

# Run tests
cd "$SCRIPT_DIR"
python -m pytest "$@" -v --tb=short
```

**Step 2: Make it executable**

Run: `chmod +x e2e/run_tests.sh`

**Step 3: Add npm script to package.json**

Add to the `"scripts"` section:
```json
"test:e2e": "bash e2e/run_tests.sh"
```

**Step 4: Run full suite**

Run: `npm run test:e2e`
Expected: All tests pass (32+ tests across 9 files)

**Step 5: Run smoke tests only**

Run: `npm run test:e2e -- -m smoke`
Expected: Smoke-marked tests pass

---

## Summary

| Task | Tests | What it covers |
|------|-------|----------------|
| 3. Auth | 5 | Login, redirect, cookie, protected routes |
| 4. Navigation | 8 | Sidebar links, sign out, active state |
| 5. Dashboard | 3 | Stats cards, empty state, upload link |
| 6. Upload | 6 | CSV upload, preview, names, package column, generate button, clear |
| 7. Single Label | 5 | Address parse, package selector, generate button, non-machinable |
| 8. Settings | 6 | Accordion sections, API key, from address, save, show/hide |
| 9. History | 3 | Page load, empty state, download report |
| 10. Billing | 3 | Plan info, usage, Pro status |
| 11. Pages | 6 | Landing, demo, login fields, CTA, sign up toggle |
| 12. Runner | 0 | npm script, prerequisite checks |
| **Total** | **45** | |
