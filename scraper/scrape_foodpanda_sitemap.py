#!/usr/bin/env python3
"""
Foodpanda 餐廳爬蟲 — 從 sitemap 抓取全台餐廳直連 URL
存入 data/foodpanda.json
"""

import json, time, re, sys
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / 'data'
DATA_DIR.mkdir(exist_ok=True)

# 各區域中心座標（用來判斷餐廳在哪區）
AREA_COORDS = [
    {'area': '信義區',   'lat': 25.033, 'lng': 121.565},
    {'area': '中山區',   'lat': 25.052, 'lng': 121.533},
    {'area': '大安區',   'lat': 25.042, 'lng': 121.544},
    {'area': '松山區',   'lat': 25.051, 'lng': 121.554},
    {'area': '中正區',   'lat': 25.046, 'lng': 121.517},
    {'area': '北投區',   'lat': 25.132, 'lng': 121.501},
    {'area': '士林區',   'lat': 25.093, 'lng': 121.524},
    {'area': '內湖區',   'lat': 25.078, 'lng': 121.590},
    {'area': '南港區',   'lat': 25.055, 'lng': 121.607},
    {'area': '萬華區',   'lat': 25.035, 'lng': 121.499},
    {'area': '文山區',   'lat': 24.989, 'lng': 121.573},
    {'area': '板橋區',   'lat': 25.014, 'lng': 121.459},
    {'area': '中和區',   'lat': 24.999, 'lng': 121.499},
    {'area': '永和區',   'lat': 25.008, 'lng': 121.514},
    {'area': '三重區',   'lat': 25.063, 'lng': 121.488},
    {'area': '蘆洲區',   'lat': 25.085, 'lng': 121.473},
    {'area': '新莊區',   'lat': 25.036, 'lng': 121.450},
    {'area': '新店區',   'lat': 24.968, 'lng': 121.542},
    {'area': '汐止區',   'lat': 25.063, 'lng': 121.641},
    {'area': '土城區',   'lat': 24.972, 'lng': 121.444},
    {'area': '樹林區',   'lat': 24.990, 'lng': 121.420},
    {'area': '中壢區',   'lat': 24.957, 'lng': 121.226},
    {'area': '桃園區',   'lat': 24.994, 'lng': 121.301},
    {'area': '台中西屯', 'lat': 24.164, 'lng': 120.640},
    {'area': '台中北區', 'lat': 24.152, 'lng': 120.685},
    {'area': '高雄前鎮', 'lat': 22.613, 'lng': 120.303},
    {'area': '高雄左營', 'lat': 22.669, 'lng': 120.296},
    {'area': '台南中西', 'lat': 22.992, 'lng': 120.204},
    {'area': '基隆仁愛', 'lat': 25.128, 'lng': 121.741},
    {'area': '基隆中正', 'lat': 25.130, 'lng': 121.737},
]

SITEMAP_URLS = [
    'https://www.foodpanda.com.tw/adventure-map/adventure-map-restaurant-0.xml',
    'https://www.foodpanda.com.tw/adventure-map/adventure-map-restaurant-1.xml',
]


def fetch_xml(url: str) -> str:
    """下載 XML 內容"""
    import ssl
    ssl_ctx = ssl.create_default_context()
    ssl_ctx.check_hostname = False
    ssl_ctx.verify_mode = ssl.CERT_NONE
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
        'Accept': 'text/xml,application/xml',
    })
    with urllib.request.urlopen(req, timeout=120, context=ssl_ctx) as resp:
        return resp.read().decode('utf-8')


def parse_sitemap(xml_text: str) -> list[str]:
    """從 sitemap XML 抽取所有 <loc> URL"""
    urls = []
    # 移除 namespace 來簡化解析
    xml_text = re.sub(r'\s+xmlns\s*=\s*"[^"]*"', '', xml_text, count=1)
    try:
        root = ET.fromstring(xml_text)
        for loc in root.iter('loc'):
            if loc.text:
                urls.append(loc.text.strip())
    except ET.ParseError:
        # 備用：regex
        for m in re.finditer(r'<loc>(https?://[^<]+)</loc>', xml_text):
            urls.append(m.group(1))
    return urls


def url_to_restaurant(url: str) -> dict | None:
    """將 Foodpanda 餐廳 URL 轉成資料物件"""
    # URL 格式: https://www.foodpanda.com.tw/restaurant/{code}/{slug}
    match = re.search(r'foodpanda\.com\.tw/restaurant/([^/]+)/([^/?#]+)', url)
    if not match:
        return None

    code = match.group(1)
    slug = match.group(2)

    # 從 slug 猜測中文名稱（slug 通常是拼音）
    # 我們不需要名稱，因為之後會跟 enriched.json 比對
    # 但需要一個識別用的名稱
    name_from_slug = slug.replace('-', ' ').strip()

    return {
        'code': code,
        'slug_path': f"{code}/{slug}",
        'url': url,
        'name_raw': name_from_slug,
    }


def main():
    print("=== Foodpanda Sitemap 餐廳爬蟲 ===\n")

    all_urls = []

    for sitemap_url in SITEMAP_URLS:
        print(f"下載 {sitemap_url}...")
        try:
            xml_text = fetch_xml(sitemap_url)
            urls = parse_sitemap(xml_text)
            restaurant_urls = [u for u in urls if '/restaurant/' in u]
            print(f"  找到 {len(restaurant_urls)} 個餐廳 URL")
            all_urls.extend(restaurant_urls)
        except Exception as e:
            print(f"  錯誤: {e}")

    print(f"\n共 {len(all_urls)} 個餐廳 URL")

    # 去重
    unique_urls = list(set(all_urls))
    print(f"去重後 {len(unique_urls)} 個")

    # 轉成餐廳資料
    restaurants = []
    for url in unique_urls:
        data = url_to_restaurant(url)
        if data:
            restaurants.append({
                'name': data['name_raw'],
                'slug': f"fp-{data['slug_path']}",
                'url': data['url'],
                'platform': 'foodpanda',
                'area': '全台',
                'area_lat': 25.033,
                'area_lng': 121.565,
            })

    print(f"解析出 {len(restaurants)} 家餐廳")

    # 載入現有資料
    out_path = DATA_DIR / 'foodpanda.json'
    existing = []
    if out_path.exists():
        try:
            data = json.loads(out_path.read_text())
            existing = data.get('restaurants', [])
            print(f"載入現有 {len(existing)} 家餐廳")
        except:
            pass

    # 合併：新資料優先
    seen = set()
    unique = []
    # 先放新的
    for r in restaurants:
        key = r['slug']
        if key not in seen:
            seen.add(key)
            unique.append(r)
    # 再放舊的（舊的可能有更好的名稱和區域）
    for r in existing:
        key = r.get('slug', '')
        if key not in seen:
            seen.add(key)
            unique.append(r)

    output = {
        'scraped_at': time.strftime('%Y-%m-%dT%H:%M:%S+08:00'),
        'total': len(unique),
        'restaurants': unique,
    }

    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n完成！合併後共 {len(unique)} 家，儲存至 {out_path}")

    # 接下來需要用 enrichment 去取得餐廳中文名稱
    # 因為 sitemap slug 只有拼音
    print("\n⚠️  Sitemap 只有拼音 slug，需要取得中文名稱。")
    print("   下一步：跑 enrich_foodpanda_names.py 從各餐廳頁面抓中文名稱")


if __name__ == '__main__':
    main()
