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
