#!/usr/bin/env python3
"""
Foodpanda 餐廳爬蟲 — 攔截 API 取得各區域外送餐廳直連 URL
存入 data/foodpanda.json
用法:
  python scrape_foodpanda.py                        # 爬預設所有區域
  python scrape_foodpanda.py "台北市信義區" 信義區    # 爬單一地址
"""

import json, time, sys, re
from pathlib import Path
from playwright.sync_api import sync_playwright
from playwright_stealth import Stealth

DATA_DIR = Path(__file__).parent.parent / 'data'
DATA_DIR.mkdir(exist_ok=True)

DEFAULT_LOCATIONS = [
    # 台北市
    {'address': '台北市信義區信義路五段7號',   'area': '信義區',   'lat': 25.033, 'lng': 121.565},
    {'address': '台北市中山區南京東路二段1號', 'area': '中山區',   'lat': 25.052, 'lng': 121.533},
    {'address': '台北市大安區忠孝東路四段1號', 'area': '大安區',   'lat': 25.042, 'lng': 121.544},
    {'address': '台北市松山區南京東路四段1號', 'area': '松山區',   'lat': 25.051, 'lng': 121.554},
    {'address': '台北市中正區忠孝西路一段1號', 'area': '中正區',   'lat': 25.046, 'lng': 121.517},
    {'address': '台北市北投區光明路1號',       'area': '北投區',   'lat': 25.132, 'lng': 121.501},
    {'address': '台北市士林區中正路1號',       'area': '士林區',   'lat': 25.093, 'lng': 121.524},
    {'address': '台北市內湖區成功路四段1號',   'area': '內湖區',   'lat': 25.078, 'lng': 121.590},
    {'address': '台北市南港區南港路一段1號',   'area': '南港區',   'lat': 25.055, 'lng': 121.607},
    {'address': '台北市萬華區萬大路1號',       'area': '萬華區',   'lat': 25.035, 'lng': 121.499},
    {'address': '台北市文山區木柵路三段1號',   'area': '文山區',   'lat': 24.989, 'lng': 121.573},
    # 新北市
    {'address': '新北市板橋區中山路一段1號',   'area': '板橋區',   'lat': 25.014, 'lng': 121.459},
    {'address': '新北市中和區中和路1號',       'area': '中和區',   'lat': 24.999, 'lng': 121.499},
    {'address': '新北市永和區永和路一段1號',   'area': '永和區',   'lat': 25.008, 'lng': 121.514},
    {'address': '新北市三重區重新路三段1號',   'area': '三重區',   'lat': 25.063, 'lng': 121.488},
    {'address': '新北市蘆洲區中正路1號',       'area': '蘆洲區',   'lat': 25.085, 'lng': 121.473},
    {'address': '新北市新莊區中正路1號',       'area': '新莊區',   'lat': 25.036, 'lng': 121.450},
    {'address': '新北市新店區北新路三段1號',   'area': '新店區',   'lat': 24.968, 'lng': 121.542},
    {'address': '新北市汐止區大同路一段1號',   'area': '汐止區',   'lat': 25.063, 'lng': 121.641},
    {'address': '新北市土城區中央路三段1號',   'area': '土城區',   'lat': 24.972, 'lng': 121.444},
    {'address': '新北市樹林區中正路1號',       'area': '樹林區',   'lat': 24.990, 'lng': 121.420},
    # 桃園
    {'address': '桃園市中壢區中正路1號',       'area': '中壢區',   'lat': 24.957, 'lng': 121.226},
    {'address': '桃園市桃園區中正路1號',       'area': '桃園區',   'lat': 24.994, 'lng': 121.301},
    # 台中
    {'address': '台中市西屯區台灣大道三段1號', 'area': '台中西屯', 'lat': 24.164, 'lng': 120.640},
    {'address': '台中市北區三民路三段1號',     'area': '台中北區', 'lat': 24.152, 'lng': 120.685},
    # 高雄
    {'address': '高雄市前鎮區中山二路1號',     'area': '高雄前鎮', 'lat': 22.613, 'lng': 120.303},
    {'address': '高雄市左營區博愛二路1號',     'area': '高雄左營', 'lat': 22.669, 'lng': 120.296},
    # 台南
    {'address': '台南市中西區中正路1號',       'area': '台南中西', 'lat': 22.992, 'lng': 120.204},
    # 基隆
    {'address': '基隆市仁愛區愛一路1號',       'area': '基隆仁愛', 'lat': 25.128, 'lng': 121.741},
    {'address': '基隆市中正區中正路1號',       'area': '基隆中正', 'lat': 25.130, 'lng': 121.737},
]


def scrape_area(browser, stealth_obj, address: str, area: str, lat: float, lng: float) -> list:
    """攔截 Foodpanda 的 API 回應來取得餐廳資料"""
    ctx = browser.new_context(
        locale='zh-TW',
        timezone_id='Asia/Taipei',
        viewport={'width': 1280, 'height': 900},
        geolocation={'latitude': lat, 'longitude': lng},
        permissions=['geolocation'],
        user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    )
    stealth_obj.apply_stealth_sync(ctx)
    page = ctx.new_page()
    results = []
    api_restaurants = []

    # 攔截 API 回應
    def handle_response(response):
        url = response.url
        # Foodpanda 用這些 API 端點載入餐廳
        if any(p in url for p in ['/api/v5/vendors', '/api/v5/dynamic', '/vendors', '/feed', '/search/vendors']):
            try:
                body = response.json()
                vendors = []
                # 不同 API 端點有不同的結構
                if isinstance(body, dict):
                    if 'data' in body and isinstance(body['data'], dict):
                        items = body['data'].get('items', [])
                        for item in items:
                            if isinstance(item, dict):
                                vendor = item.get('vendor') or item
                                if vendor.get('name'):
                                    vendors.append(vendor)
                    if 'data' in body and isinstance(body['data'], list):
                        for item in body['data']:
                            if isinstance(item, dict) and item.get('name'):
                                vendors.append(item)
                    # 直接是 vendors 陣列
                    for key in ['vendors', 'restaurants', 'items']:
                        if key in body and isinstance(body[key], list):
                            for v in body[key]:
                                if isinstance(v, dict) and v.get('name'):
                                    vendors.append(v)

                for v in vendors:
                    name = v.get('name', '').strip()
                    code = v.get('code', '')
                    slug_url = v.get('redirection_url', '') or v.get('web_path', '') or ''

                    if not name or len(name) < 2:
                        continue

                    # 組合 URL
                    if slug_url and '/restaurant/' in slug_url:
                        url_path = slug_url
                    elif code:
                        # 用 code + name 的 slug 組合
                        name_slug = re.sub(r'[^a-zA-Z0-9\u4e00-\u9fff]', '-', name.lower()).strip('-')
                        url_path = f"/restaurant/{code}/{name_slug}"
                    else:
                        continue

                    # 確保是完整 URL
                    if url_path.startswith('/'):
                        full_url = f"https://www.foodpanda.com.tw{url_path}"
                    elif url_path.startswith('http'):
                        full_url = url_path
                    else:
                        full_url = f"https://www.foodpanda.com.tw/{url_path}"

                    slug = re.search(r'/restaurant/(.+?)(?:\?|$)', full_url)
                    slug_str = slug.group(1) if slug else code

                    api_restaurants.append({
                        'name': name,
                        'slug': f"fp-{slug_str}",
                        'url': full_url,
                        'platform': 'foodpanda',
                        'area': area,
                        'area_lat': lat,
                        'area_lng': lng,
                    })
            except:
                pass

    page.on('response', handle_response)

    try:
        # 方式一：直接帶座標訪問餐廳列表
        url = f'https://www.foodpanda.com.tw/restaurants/new?lat={lat}&lng={lng}&vertical=restaurants'
        print(f"  [{area}] 前往列表頁...")
        page.goto(url, wait_until='networkidle', timeout=45000)
        time.sleep(5)

        # 嘗試關閉彈窗
        for sel in ['[data-testid="close-button"]', 'button[aria-label="close"]', 'button[aria-label="關閉"]', '.close-btn']:
            try:
                btn = page.query_selector(sel)
                if btn and btn.is_visible():
                    btn.click()
                    time.sleep(0.5)
            except:
                pass

        # 滾動載入更多
        prev_count = 0
        stale_rounds = 0
        for _ in range(25):
            page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
            time.sleep(2)
            curr = len(api_restaurants)
            if curr == prev_count:
                stale_rounds += 1
                if stale_rounds >= 4:
                    break
            else:
                stale_rounds = 0
                prev_count = curr

        print(f"  [{area}] API 攔截到 {len(api_restaurants)} 家")

        # 如果 API 攔截沒東西，嘗試從 DOM 抓
        if len(api_restaurants) == 0:
            links = page.query_selector_all('a[href*="/restaurant/"]')
            seen = set()
            for link in links:
                try:
                    href = link.get_attribute('href') or ''
                    match = re.search(r'/restaurant/([^/]+/[^/?#]+)', href)
                    if not match:
                        continue
                    slug = match.group(1)
                    if slug in seen:
                        continue
                    seen.add(slug)
                    text = link.inner_text().strip()
                    lines = [l.strip() for l in text.split('\n') if l.strip()]
                    name = lines[0] if lines else slug.split('/')[-1]
                    if not name or len(name) < 2:
                        continue
                    api_restaurants.append({
                        'name': name,
                        'slug': f"fp-{slug}",
                        'url': f"https://www.foodpanda.com.tw/restaurant/{slug}",
                        'platform': 'foodpanda',
                        'area': area,
                        'area_lat': lat,
                        'area_lng': lng,
                    })
                except:
                    pass
            print(f"  [{area}] DOM 補充後共 {len(api_restaurants)} 家")

        # 方式二：如果還是空的，嘗試首頁 + 地址
        if len(api_restaurants) == 0:
            print(f"  [{area}] 嘗試首頁方式...")
            page.goto('https://www.foodpanda.com.tw/', wait_until='networkidle', timeout=30000)
            time.sleep(5)

            all_inputs = page.query_selector_all('input')
            for inp in all_inputs:
                ph = (inp.get_attribute('placeholder') or '').lower()
                if any(k in ph for k in ['地址', '搜尋', 'address', 'deliver', '輸入']):
                    inp.click()
                    time.sleep(1)
                    inp.fill(address)
                    time.sleep(3)
                    for s in ['[role="option"]', 'li[data-testid]', '.autocomplete-suggestion']:
                        sug = page.query_selector(s)
                        if sug and sug.is_visible():
                            sug.click()
                            break
                    else:
                        page.keyboard.press('Enter')
                    time.sleep(8)
                    break

            for _ in range(15):
                page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
                time.sleep(2)

            print(f"  [{area}] 首頁方式共 {len(api_restaurants)} 家")

        results = api_restaurants

    except Exception as e:
        print(f"  [{area}] 錯誤: {e}")
    finally:
        ctx.close()

    # 去重
    seen = set()
    unique = []
    for r in results:
        if r['slug'] not in seen:
            seen.add(r['slug'])
            unique.append(r)

    return unique


def main():
    if len(sys.argv) > 1:
        locations = [{
            'address': sys.argv[1],
            'area': sys.argv[2] if len(sys.argv) > 2 else sys.argv[1],
            'lat': float(sys.argv[3]) if len(sys.argv) > 3 else 25.033,
            'lng': float(sys.argv[4]) if len(sys.argv) > 4 else 121.565,
        }]
    else:
        locations = DEFAULT_LOCATIONS

    stealth_obj = Stealth()
    all_restaurants = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        for i, loc in enumerate(locations):
            print(f"\n[{i+1}/{len(locations)}] 爬取 {loc['area']}...")
            results = scrape_area(browser, stealth_obj, loc['address'], loc['area'], loc['lat'], loc['lng'])
            all_restaurants.extend(results)
            if i < len(locations) - 1:
                time.sleep(10)

        browser.close()

    # 載入現有資料並合併
    out_path = DATA_DIR / 'foodpanda.json'
    existing = []
    if out_path.exists():
        try:
            data = json.loads(out_path.read_text())
            existing = data.get('restaurants', [])
            print(f"\n載入現有 {len(existing)} 家餐廳")
        except:
            pass

    # 合併：新資料優先
    seen = set()
    unique = []
    for r in all_restaurants:
        key = r['slug']
        if key not in seen:
            seen.add(key)
            unique.append(r)
    for r in existing:
        key = r.get('slug', r.get('name', ''))
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

    print(f"\n完成！新爬 {len(all_restaurants)} 家，合併後共 {len(unique)} 家，儲存至 {out_path}")


if __name__ == '__main__':
    main()
