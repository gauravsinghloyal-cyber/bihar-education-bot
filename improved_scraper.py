import requests
from bs4 import BeautifulSoup
import json
import time
from datetime import datetime
import logging
import re
import urllib3
from urllib.parse import urljoin

# Disable SSL warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger(__name__)

class BiharEducationScraper:
    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })
        self.session.verify = False
        
        # List of working websites (tested and confirmed)
        self.working_websites = [
            'biharboardonline.bihar.gov.in',
            'biharboardonline.com', 
            'patnauniversity.ac.in',
            'magadhuniversity.ac.in',
            'akubihar.ac.in',
            'brabu.net',
            'nou.ac.in',
            'purneauniversity.ac.in',
            'mungeruniversity.ac.in',
            'results.biharboardonline.com',
            'freejobalert.com',
            'careerpower.in'
        ]
        
        # List of problematic websites to skip
        self.skip_websites = [
            'ppup.ac.in',
            'ksdsu.edu.in',
            'mmhapu.ac.in',
            'cnlu.ac.in',
            'education.bih.nic.in',
            'beu-bihar.org',
            'lnmu.ac.in',
            'jpv.ac.in',
            'tmbuniv.ac.in',
            'vksu.ac.in',
            'bnmu.ac.in'
        ]

    def load_websites(self):
        try:
            with open('websites.json', 'r', encoding='utf-8') as f:
                websites = json.load(f)['websites']
                
                # Filter only working websites
                filtered_websites = []
                for website in websites:
                    domain = website['url'].split('//')[-1].split('/')[0]
                    if any(working in domain for working in self.working_websites):
                        filtered_websites.append(website)
                    elif any(skip in domain for skip in self.skip_websites):
                        logger.info(f"Skipping problematic website: {website['name']}")
                    else:
                        # Try unknown websites
                        filtered_websites.append(website)
                
                return filtered_websites
                
        except Exception as e:
            logger.error(f"Error loading websites: {e}")
            return []

    def scrape_website(self, website):
        try:
            domain = website['url'].split('//')[-1].split('/')[0]
            
            # Skip problematic websites
            if any(skip in domain for skip in self.skip_websites):
                logger.info(f"Skipping {website['name']} - known issues")
                return []
                
            logger.info(f"Scraping {website['name']}...")
            
            # Special handling for Bihar government websites
            response = self.session.get(website['url'], timeout=30, verify=False)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            updates = []
            
            # Try multiple selectors
            selectors = website['selector'].split(', ')
            for selector in selectors:
                try:
                    items = soup.select(selector)
                    if items:
                        updates.extend(self.extract_updates(items, website))
                        break
                except Exception as e:
                    continue
            
            logger.info(f"Found {len(updates)} updates from {website['name']}")
            return updates
            
        except requests.exceptions.SSLError:
            logger.warning(f"SSL error for {website['name']} - trying alternative approach")
            return self.fallback_scrape(website)
        except requests.exceptions.ConnectionError:
            logger.warning(f"Connection error for {website['name']} - skipping")
            return []
        except requests.exceptions.Timeout:
            logger.warning(f"Timeout for {website['name']} - skipping")
            return []
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 403:
                logger.warning(f"403 Forbidden for {website['name']} - skipping")
            return []
        except Exception as e:
            logger.error(f"Error scraping {website['name']}: {e}")
            return []

    def fallback_scrape(self, website):
        """Alternative scraping method for SSL issues"""
        try:
            # Try without session for SSL issues
            response = requests.get(website['url'], timeout=30, verify=False)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            updates = []
            
            # Common selectors for fallback
            common_selectors = [
                'a[href*="news"]', 'a[href*="notice"]', 'a[href*="update"]',
                'a[href*="alert"]', '.content', 'marquee', 'table tr'
            ]
            
            for selector in common_selectors:
                try:
                    items = soup.select(selector)
                    if items:
                        updates.extend(self.extract_updates(items, website))
                        if updates:
                            break
                except:
                    continue
            
            return updates
            
        except Exception as e:
            logger.warning(f"Fallback also failed for {website['name']}: {e}")
            return []

    def extract_updates(self, items, website):
        updates = []
        for item in items[:5]:
            try:
                text = item.get_text(strip=True)
                if not text or len(text) < 20:
                    continue
                
                link = item.find('a')
                href = link['href'] if link and link.get('href') else website['url']
                
                text = self.clean_text(text)
                date = self.extract_date(text) or datetime.now().strftime('%d-%m-%Y')
                
                updates.append({
                    'title': text[:200],
                    'link': self.normalize_url(href, website['url']),
                    'date': date,
                    'website': website['name'],
                    'category': website['category']
                })
            except Exception as e:
                continue
        
        return updates

    def clean_text(self, text):
        text = re.sub(r'\s+', ' ', text)
        text = re.sub(r'^(News|Notice|Update|Alert):?\s*', '', text, flags=re.I)
        return text.strip()

    def extract_date(self, text):
        date_patterns = [
            r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
            r'(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})',
        ]
        
        for pattern in date_patterns:
            match = re.search(pattern, text, re.I)
            if match:
                return match.group(1)
        return None

    def normalize_url(self, url, base_url):
        if url.startswith('http'):
            return url
        elif url.startswith('/'):
            return urljoin(base_url, url)
        else:
            return base_url + '/' + url.lstrip('/')

    def check_for_new_updates(self):
        all_updates = []
        websites = self.load_websites()
        
        logger.info(f"Checking {len(websites)} working websites...")
        
        for website in websites:
            try:
                updates = self.scrape_website(website)
                all_updates.extend(updates)
                time.sleep(1)
            except Exception as e:
                logger.error(f"Failed to check {website['name']}: {e}")
                continue
        
        # Remove duplicates
        unique_updates = []
        seen_titles = set()
        for update in all_updates:
            if update['title'] not in seen_titles:
                seen_titles.add(update['title'])
                unique_updates.append(update)
        
        logger.info(f"Total unique updates found: {len(unique_updates)}")
        return unique_updates