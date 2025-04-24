import aiohttp
import asyncio
from bs4 import BeautifulSoup
import logging
import re
from typing import List, Dict, Any, Optional
from urllib.parse import urljoin, urlparse
import json

from models import (
    ScanType,
    LoginForm,
    AdminPanel,
    APIKey,
    WalletKey,
    PaymentInfo,
    TreeNode,
    ScanResult
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class WebScraper:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.visited_urls = set()
        self.site_structure = TreeNode(url=base_url, title="Root")
        self.session = None
        
        # Results storage
        self.hidden_urls = []
        self.login_forms = []
        self.admin_panels = []
        self.api_keys = []
        self.wallet_keys = []
        self.payment_info = []

        # Patterns for detection
        self.api_key_patterns = [
            r'(?i)api[_-]key["\']?\s*[:=]\s*["\']([^"\']+)["\']',
            r'(?i)api[_-]secret["\']?\s*[:=]\s*["\']([^"\']+)["\']',
            r'(?i)access[_-]token["\']?\s*[:=]\s*["\']([^"\']+)["\']'
        ]
        
        self.wallet_patterns = [
            r'[13][a-km-zA-HJ-NP-Z1-9]{25,34}',  # Bitcoin address
            r'0x[a-fA-F0-9]{64}',  # Ethereum priv key address
            r'X[1-9A-HJ-NP-Za-km-z]{33}'  # Ripple address
        ]
        
        self.admin_paths = [
            '/admin', '/administrator', '/wp-admin',
            '/control', '/dashboard', '/manage', '/superuser'
        ]

    async def __aenter__(self):
        self.session = aiohttp.ClientSession()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.session:
            await self.session.close()

    async def run_scan(self, scan_options: List[ScanType]) -> ScanResult:
        """Main scanning function that orchestrates the entire scanning process"""
        try:
            async with aiohttp.ClientSession() as self.session:
                # Always check robots.txt first
                await self.analyze_robots_txt()

                if ScanType.FULL in scan_options or ScanType.URLS in scan_options:
                    await self.crawl_site()

                tasks = []
                if ScanType.FULL in scan_options or ScanType.LOGIN in scan_options:
                    tasks.append(self.find_login_forms())
                if ScanType.FULL in scan_options or ScanType.ADMIN in scan_options:
                    tasks.append(self.find_admin_panels())
                if ScanType.FULL in scan_options or ScanType.API_KEYS in scan_options:
                    tasks.append(self.find_api_keys())
                if ScanType.FULL in scan_options or ScanType.WALLET in scan_options:
                    tasks.append(self.find_wallet_keys())
                if ScanType.FULL in scan_options or ScanType.PAYMENT in scan_options:
                    tasks.append(self.find_payment_info())

                await asyncio.gather(*tasks)

                return ScanResult(
                    site_structure=self.site_structure,
                    hidden_urls=self.hidden_urls,
                    login_forms=self.login_forms,
                    admin_panels=self.admin_panels,
                    api_keys=self.api_keys,
                    wallet_keys=self.wallet_keys,
                    payment_info=self.payment_info,
                    scan_metadata={
                        "total_urls_scanned": len(self.visited_urls),
                        "scan_options": [opt.value for opt in scan_options]
                    }
                )

        except Exception as e:
            logger.error(f"Error during scan: {str(e)}")
            raise

    async def analyze_robots_txt(self):
        """Analyze robots.txt for hidden paths"""
        try:
            robots_url = urljoin(self.base_url, '/robots.txt')
            async with self.session.get(robots_url) as response:
                if response.status == 200:
                    text = await response.text()
                    disallowed_paths = re.findall(r'Disallow: (.*)', text)
                    self.hidden_urls.extend([urljoin(self.base_url, path) for path in disallowed_paths])
        except Exception as e:
            logger.warning(f"Error analyzing robots.txt: {str(e)}")

    async def crawl_site(self):
        """Crawl the website and build site structure"""
        async def crawl_page(url: str, parent_node: TreeNode):
            if url in self.visited_urls:
                return
            
            self.visited_urls.add(url)
            try:
                async with self.session.get(url) as response:
                    if response.status != 200:
                        return

                    content = await response.text()
                    soup = BeautifulSoup(content, 'lxml')
                    
                    # Create node for current page
                    current_node = TreeNode(
                        url=url,
                        title=soup.title.string if soup.title else None,
                        metadata={}
                    )
                    parent_node.children.append(current_node)

                    # Find all links
                    links = soup.find_all('a', href=True)
                    tasks = []
                    for link in links:
                        href = link.get('href')
                        absolute_url = urljoin(url, href)
                        
                        # Only crawl URLs from the same domain
                        if urlparse(absolute_url).netloc == urlparse(self.base_url).netloc:
                            tasks.append(crawl_page(absolute_url, current_node))

                    await asyncio.gather(*tasks)

            except Exception as e:
                logger.error(f"Error crawling {url}: {str(e)}")

        await crawl_page(self.base_url, self.site_structure)

    async def find_login_forms(self):
        """Find and analyze login forms"""
        for url in self.visited_urls:
            try:
                async with self.session.get(url) as response:
                    if response.status != 200:
                        continue

                    content = await response.text()
                    soup = BeautifulSoup(content, 'lxml')
                    
                    forms = soup.find_all('form')
                    for form in forms:
                        # Check if it's likely a login form
                        inputs = form.find_all('input')
                        input_types = {input.get('type', ''): input.get('name', '') for input in inputs}
                        
                        if 'password' in input_types.keys():
                            self.login_forms.append(LoginForm(
                                url=url,
                                form_action=urljoin(url, form.get('action', '')),
                                fields=input_types,
                                method=form.get('method', 'post').lower(),
                                additional_info={
                                    "has_csrf": bool(form.find('input', {'name': re.compile(r'csrf|token', re.I)}))
                                }
                            ))

            except Exception as e:
                logger.error(f"Error analyzing forms at {url}: {str(e)}")

    async def find_admin_panels(self):
        """Find potential admin panels"""
        for path in self.admin_paths:
            url = urljoin(self.base_url, path)
            try:
                async with self.session.get(url) as response:
                    if response.status != 404:  # Any response other than 404 might be interesting
                        self.admin_panels.append(AdminPanel(
                            url=url,
                            type="standard" if response.status == 200 else "potential",
                            confidence=1.0 if response.status == 200 else 0.5,
                            detection_method="direct_access",
                            additional_info={"status_code": response.status}
                        ))
            except Exception as e:
                logger.error(f"Error checking admin panel at {url}: {str(e)}")

    async def find_api_keys(self):
        """Find potential API keys in page source"""
        for url in self.visited_urls:
            try:
                async with self.session.get(url) as response:
                    if response.status != 200:
                        continue

                    content = await response.text()
                    for pattern in self.api_key_patterns:
                        matches = re.finditer(pattern, content)
                        for match in matches:
                            key = match.group(1)
                            self.api_keys.append(APIKey(
                                key=key,
                                type=self._guess_api_key_type(key),
                                location=url,
                                example_usage=self._generate_api_usage_example(key),
                                confidence=0.8,
                                context=content[max(0, match.start()-50):match.end()+50]
                            ))

            except Exception as e:
                logger.error(f"Error searching for API keys at {url}: {str(e)}")

    def _guess_api_key_type(self, key: str) -> str:
        """Guess the type of API key based on its format"""
        if key.startswith('sk_'):
            return 'Stripe'
        if key.startswith('AKIA'):
            return 'AWS'
        if len(key) == 32:
            return 'Generic-32'
        return 'Unknown'

    def _generate_api_usage_example(self, key: str) -> str:
        """Generate example usage for the API key"""
        return f'Authorization: Bearer {key}'

    async def find_wallet_keys(self):
        """Find potential cryptocurrency wallet addresses"""
        for url in self.visited_urls:
            try:
                async with self.session.get(url) as response:
                    if response.status != 200:
                        continue

                    content = await response.text()
                    for pattern in self.wallet_patterns:
                        matches = re.finditer(pattern, content)
                        for match in matches:
                            key = match.group(0)
                            self.wallet_keys.append(WalletKey(
                                key=key,
                                type=self._guess_wallet_type(key),
                                location=url,
                                currency=self._guess_wallet_currency(key),
                                confidence=0.9
                            ))

            except Exception as e:
                logger.error(f"Error searching for wallet keys at {url}: {str(e)}")

    def _guess_wallet_type(self, key: str) -> str:
        """Guess the type of wallet based on the address format"""
        if key.startswith('1') or key.startswith('3'):
            return 'Bitcoin'
        if key.startswith('0x'):
            return 'Ethereum'
        if key.startswith('X'):
            return 'Ripple'
        return 'Unknown'

    def _guess_wallet_currency(self, key: str) -> str:
        """Guess the cryptocurrency based on the wallet address"""
        if key.startswith('1') or key.startswith('3'):
            return 'BTC'
        if key.startswith('0x'):
            return 'ETH'
        if key.startswith('X'):
            return 'XRP'
        return 'Unknown'

    async def find_payment_info(self):
        """Find payment-related information"""
        payment_gateways = {
            'stripe': r'pk_live_[0-9a-zA-Z]{24}',
            'paypal': r'data-paypal|paypal-button',
            'square': r'square-payment-form',
        }

        for url in self.visited_urls:
            try:
                async with self.session.get(url) as response:
                    if response.status != 200:
                        continue

                    content = await response.text()
                    soup = BeautifulSoup(content, 'lxml')

                    # Look for payment forms
                    forms = soup.find_all('form')
                    for form in forms:
                        if any(input.get('type') == 'credit-card' for input in form.find_all('input')):
                            fields = {
                                input.get('name', ''): input.get('type', '')
                                for input in form.find_all('input')
                            }
                            
                            self.payment_info.append(PaymentInfo(
                                type='credit_card',
                                gateway='generic',
                                location=url,
                                fields=fields,
                                security_level='unknown'
                            ))

                    # Check for known payment gateways
                    for gateway, pattern in payment_gateways.items():
                        if re.search(pattern, content, re.I):
                            self.payment_info.append(PaymentInfo(
                                type='gateway',
                                gateway=gateway,
                                location=url,
                                fields={},
                                security_level='standard'
                            ))

            except Exception as e:
                logger.error(f"Error searching for payment info at {url}: {str(e)}")
