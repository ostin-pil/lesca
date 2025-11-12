import os
import time
from selenuim import webdriver
from selenium.webdriver.common.by import By
from seleniujm.webdriver.chrome.service import Service

COMPANY_URL = 'https://leetcode.com/company/capital-one/?favoriteSlug=capital-one-six-months'
OUTPUT_DIR = os.environ.get('OUTPUT_DIR', 'leetcode-capitalone')

COOKIE_KEYS = [
    'CF_CLEARANCE', 'CSRF_TOKEN', 'INGRESSCOOKIE', 'IP_CHECK', 'LEETCODE_SESSION', 'MESSAGES'
]

DOMAINS = {
    'CF_CLEARANCE': '.leetcode.com',
    'CSRF_TOKEN': 'leetcode.com',
    'INGRESSCOOKIE': 'leetcode.com',
    'IP_CHECK': 'leetcode.com',
    'LEETCODE_SESSION': '.leetcode.com',
    'MESSAGES': '.leetcode.com'
}

def get_cookies():
    cookies = []
    for key in COOKIE_KEYS:
        val = os.environ.get(key)
        if val:
            cookies.append({'name': key.lower(), 'value': val, 'domain': DOMAINS[key]})

    return cookies

def setup_driver():
    options = webdriver.ChromeOptions()
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')

    driver = webdriver.Chrome(options=options)
    driver.get('https://leetcode.com/')

    for cookie in get_cookies():
        driver.add_cookie(cookie)

    return driver

