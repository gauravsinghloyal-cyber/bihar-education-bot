import requests
from bs4 import BeautifulSoup
import json
import time
from datetime import datetime
import logging
import re
import urllib3
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

logger = logging.getLogger(__name__)
urllib3.disable_warnings()
class BiharEducationScraper:
    def __init__(self):
        self.session = requests.Session()
        retry_strategy = Retry(total=3,
                               backoff_factor=1,
                               status_forcelist=[429, 500, 502, 503, 504])
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        })         
        self.session.verify = False
    
    def load_websites(self):
        try:
            with open('websites.json', 'r', encoding='utf-8') as f:
                return json.load(f)['websites']
        except Exception as e:
            logger.error(f"Error loading websites: {e}")
            return []
    
    def scrape_website(self, website):
        try:
            logger.info(f"Scraping {website['name']}...")
            response = self.session.get(website['url'], timeout=30, verify=False)
            response.raise_for_status()
            
            soup = BeautifulSoup(response.content, 'html.parser')
            updates = []
            
            # Try multiple selectors for better compatibility
            selectors = website['selector'].split(', ')
            for selector in selectors:
                try:
                    items = soup.select(selector)
                    if items:
                        updates.extend(self.extract_updates(items, website))
                        break
                except Exception as e:
                    logger.debug(f"Selector {selector} failed: {e}")
                    continue
            
            # Fallback to common patterns if no selectors work
            if not updates:
                updates = self.fallback_scraping(soup, website)
            
            logger.info(f"Found {len(updates)} updates from {website['name']}")
            return updates
            
        except Exception as e:
            logger.error(f"Error scraping {website['name']}: {e}")
            return []
    
    def extract_updates(self, items, website):
        updates = []
        for item in items[:10]:
            try:
                text = item.get_text(strip=True)
                if not text or len(text) < 20:
                    continue
                
                # Find link
                link = item.find('a')
                href = link['href'] if link and link.get('href') else website['url']
                
                # Clean text
                text = self.clean_text(text)
                
                # Extract date if possible
                date = self.extract_date(text) or datetime.now().strftime('%d-%m-%Y')
                
                updates.append({
                    'title': text[:200],
                    'link': self.normalize_url(href, website['url']),
                    'date': date,
                    'website': website['name'],
                    'category': website['category']
                })
            except Exception as e:
                logger.debug(f"Error processing item: {e}")
                continue
        
        return updates
    
    def fallback_scraping(self, soup, website):
        updates = []
        # Try common patterns
        patterns = [
            soup.find_all(['div', 'tr', 'li'], class_=re.compile(r'news|notice|update|alert', re.I)),
            soup.find_all(['div', 'tr', 'li'], id=re.compile(r'news|notice|update|alert', re.I)),
            soup.find_all('marquee'),
            soup.find_all('a', href=re.compile(r'news|notice|update|alert', re.I))
        ]
        
        for pattern in patterns:
            for item in pattern[:5]:
                try:
                    text = item.get_text(strip=True)
                    if text and len(text) > 20:
                        link = item.find('a')
                        href = link['href'] if link else website['url']
                        
                        updates.append({
                            'title': text[:200],
                            'link': self.normalize_url(href, website['url']),
                            'date': datetime.now().strftime('%d-%m-%Y'),
                            'website': website['name'],
                            'category': website['category']
                        })
                except:
                    continue
        
        return updates
    
    def clean_text(self, text):
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove common prefixes
        text = re.sub(r'^(News|Notice|Update|Alert):?\s*', '', text, flags=re.I)
        return text.strip()
    
    def extract_date(self, text):
        # Simple date extraction
        date_patterns = [
            r'(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})',
            r'(\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{2,4})',
            r'(\d{1,2}\s+\d{1,2}\s+\d{2,4})'
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
            from urllib.parse import urljoin
            return urljoin(base_url, url)
        else:
            return base_url + '/' + url.lstrip('/')
    
    def check_for_new_updates(self):
        all_updates = []
        websites = self.load_websites()
        
        for website in websites:
            try:
                updates = self.scrape_website(website)
                all_updates.extend(updates)
                time.sleep(2)
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