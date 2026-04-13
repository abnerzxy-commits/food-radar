#!/usr/bin/env python3
"""
UberEats 餐廳爬蟲 — 爬取各區域外送餐廳，存入 data/ubereats.json
用法:
  python scrape_ubereats.py                     # 爬預設所有區域
  python scrape_ubereats.py "台北市信義區" 信義區  # 爬單一地址
"""

import json, time, sys
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
    ctx = browser.new_context(
        locale='zh-TW',
        timezone_id='Asia/Taipei',
        viewport={'width': 1280, 'height': 800},
    )
    stealth_obj.apply_stealth_sync(ctx)
    page = ctx.new_page()
    results = []

    try:
        page.goto('https://www.ubereats.com/tw', wait_until='domcontentloaded', timeout=30000)
        time.sleep(3)

        # 填入地址
        addr_input = None
        for inp in page.query_selector_all('input'):
            ph = (inp.get_attribute('placeholder') or '').lower()
            if '地址' in ph or '外送' in ph or 'deliver' in ph or 'address' in ph:
                addr_input = inp
                break

        if not addr_input:
            print(f"  [{area}] 找不到地址輸入框，跳過")
            ctx.close()
            return []

        addr_input.click()
        time.sleep(0.5)
        addr_input.fill(address)
        time.sleep(3)

        suggestion = page.query_selector('[data-testid="google-suggestion"], [role="option"]')
        if suggestion:
            suggestion.click()
        else:
            page.keyboard.press('Enter')

        time.sleep(8)

        # 滾動載入更多餐廳
        for _ in range(10):
            page.evaluate('window.scrollTo(0, document.body.scrollHeight)')
            time.sleep(1.5)

        # 抓取餐廳連結
        cards = page.query_selector_all('a[href*="/tw/store/"]')
        seen = set()

        for card in cards:
            try:
                href = card.get_attribute('href') or ''
                if '/tw/store/' not in href:
                    continue

                slug = href.rstrip('/').split('/')[-1]
                if slug in seen:
                    continue
                seen.add(slug)

                # 取得名稱（連結的第一行文字通常是店名）
                text = card.inner_text().strip()
                lines = [l.strip() for l in text.split('\n') if l.strip()]
                name = lines[0] if lines else slug

                results.append({
                    'name': name,
                    'slug': slug,
                    'url': f"https://www.ubereats.com{href}" if href.startswith('/') else href,
                    'platform': 'ubereats',
                    'area': area,
                    'area_lat': lat,
                    'area_lng': lng,
                })
            except:
                pass

        print(f"  [{area}] {len(results)} 家餐廳")

    except Exception as e:
        print(f"  [{area}] 錯誤: {e}")
    finally:
        ctx.close()

    return results


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
            print(f"[{i+1}/{len(locations)}] 爬取 {loc['area']}...")
            results = scrape_area(browser, stealth_obj, loc['address'], loc['area'], loc['lat'], loc['lng'])
            all_restaurants.extend(results)
            if i < len(locations) - 1:
                time.sleep(8)  # 區域間暫停

        browser.close()

    # 載入現有資料並合併（避免覆蓋）
    out_path = DATA_DIR / 'ubereats.json'
    existing = []
    if out_path.exists():
        try:
            data = json.loads(out_path.read_text())
            existing = data.get('restaurants', [])
            print(f"載入現有 {len(existing)} 家餐廳")
        except:
            pass

    # 合併：新資料優先（同 slug 用新的）
    seen = set()
    unique = []
    for r in all_restaurants:
        key = r['slug']
        if key not in seen:
            seen.add(key)
            unique.append(r)
    for r in existing:
        key = r['slug']
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
