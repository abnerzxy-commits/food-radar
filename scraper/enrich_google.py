#!/usr/bin/env python3
"""
用 Google Places API 為 UberEats 餐廳補充評分、評論、推薦餐點
結果存入 data/enriched.json，一個月更新一次即可
"""

import json, time, os, sys, re
import requests as req_lib
from pathlib import Path
from urllib.parse import quote

DATA_DIR = Path(__file__).parent.parent / 'data'
API_KEY = os.environ.get('GOOGLE_PLACES_API_KEY', '')

# 嘗試從 .env.local 讀取
if not API_KEY:
    env_path = Path(__file__).parent.parent / '.env.local'
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith('GOOGLE_PLACES_API_KEY='):
                API_KEY = line.split('=', 1)[1].strip()


def search_place(name: str, lat: float, lng: float) -> dict | None:
    """用 Text Search 找到餐廳的 place_id"""
    try:
        resp = req_lib.get(
            'https://maps.googleapis.com/maps/api/place/textsearch/json',
            params={'query': name, 'location': f'{lat},{lng}', 'radius': 3000, 'language': 'zh-TW', 'key': API_KEY},
            timeout=10,
        )
        data = resp.json()
        if data.get('results'):
            return data['results'][0]
    except:
        pass
    return None


def get_place_details(place_id: str) -> dict | None:
    """取得餐廳詳細資訊（評論、評分）"""
    fields = 'name,rating,user_ratings_total,reviews,editorial_summary,price_level,opening_hours,photos,formatted_address,geometry'
    try:
        resp = req_lib.get(
            'https://maps.googleapis.com/maps/api/place/details/json',
            params={'place_id': place_id, 'fields': fields, 'language': 'zh-TW', 'reviews_sort': 'newest', 'key': API_KEY},
            timeout=10,
        )
        data = resp.json()
        if data.get('result'):
            return data['result']
    except:
        pass
    return None


def extract_dishes_and_highlights(reviews: list) -> tuple[list, list]:
    """從評論中提取推薦餐點和常見評價"""
    all_text = ' '.join(r.get('text', '') for r in reviews)

    # 常見正面關鍵字
    positive_keywords = [
        '好吃', '推薦', '必點', '新鮮', '份量足', '服務好', 'CP值高', '便宜',
        '美味', '讚', '超棒', '回訪', '值得', '不錯', '滿意', '快速', '準時',
    ]
    # 常見負面關鍵字
    negative_keywords = [
        '太鹹', '太油', '冷掉', '等太久', '份量少', '貴', '失望', '難吃',
        '慢', '態度差', '不新鮮',
    ]

    highlights = []
    for kw in positive_keywords:
        count = all_text.count(kw)
        if count >= 1:
            highlights.append(f"👍 {kw}")
    for kw in negative_keywords:
        count = all_text.count(kw)
        if count >= 1:
            highlights.append(f"👎 {kw}")

    # 取前 5 個最常提到的
    highlights = highlights[:5]

    # 提取餐點名稱（從「推薦」「必點」「好吃」附近的文字）
    dishes = set()
    patterns = [
        r'推薦(.{2,8})',
        r'必點(.{2,8})',
        r'(.{2,8})好吃',
        r'(.{2,8})很讚',
        r'(.{2,8})不錯',
        r'點了(.{2,8})',
    ]
    for pat in patterns:
        matches = re.findall(pat, all_text)
        for m in matches:
            # 清理
            dish = m.strip('，。！、的了和是也')
            if 2 <= len(dish) <= 10 and not any(c in dish for c in '我他她你們這那很'):
                dishes.add(dish)

    return list(dishes)[:6], highlights


def main():
    if not API_KEY:
        print("錯誤：找不到 GOOGLE_PLACES_API_KEY")
        sys.exit(1)

    # 讀取 UberEats 資料
    ue_path = DATA_DIR / 'ubereats.json'
    if not ue_path.exists():
        print("錯誤：找不到 ubereats.json，請先跑 scrape_ubereats.py")
        sys.exit(1)

    ue_data = json.loads(ue_path.read_text())
    restaurants = ue_data.get('restaurants', [])

    # 讀取現有快取
    cache_path = DATA_DIR / 'enriched.json'
    cache = {}
    if cache_path.exists():
        cache = json.loads(cache_path.read_text())

    print(f"共 {len(restaurants)} 家餐廳，已快取 {len(cache)} 家")

    updated = 0
    for i, r in enumerate(restaurants):
        slug = r['slug']

        # 跳過已快取且未過期的（30 天）
        if slug in cache:
            cached_at = cache[slug].get('cached_at', '')
            if cached_at:
                import datetime
                try:
                    cached_time = datetime.datetime.fromisoformat(cached_at)
                    if (datetime.datetime.now() - cached_time).days < 30:
                        continue
                except:
                    pass

        print(f"  [{i+1}/{len(restaurants)}] 查詢 {r['name']}...")

        # 搜尋 place
        place = search_place(r['name'], r['area_lat'], r['area_lng'])
        if not place:
            cache[slug] = {
                'cached_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
                'found': False,
            }
            time.sleep(0.3)
            continue

        # 取得詳情
        details = get_place_details(place['place_id'])
        if not details:
            cache[slug] = {
                'cached_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
                'found': False,
            }
            time.sleep(0.3)
            continue

        reviews = details.get('reviews', [])
        dishes, highlights = extract_dishes_and_highlights(reviews)

        cache[slug] = {
            'cached_at': time.strftime('%Y-%m-%dT%H:%M:%S'),
            'found': True,
            'place_id': place['place_id'],
            'rating': details.get('rating', 0),
            'review_count': details.get('user_ratings_total', 0),
            'price_level': details.get('price_level'),
            'address': details.get('formatted_address', ''),
            'photo': place.get('photos', [{}])[0].get('photo_reference', ''),
            'summary': details.get('editorial_summary', {}).get('overview', ''),
            'dishes': dishes,
            'highlights': highlights,
            'is_open': details.get('opening_hours', {}).get('open_now'),
            'lat': place['geometry']['location']['lat'],
            'lng': place['geometry']['location']['lng'],
        }

        updated += 1
        time.sleep(0.5)  # 避免 API rate limit

        # 每 50 家存一次
        if updated % 50 == 0:
            cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2))
            print(f"  已存檔（{updated} 家更新）")

    # 最終存檔
    cache_path.write_text(json.dumps(cache, ensure_ascii=False, indent=2))
    print(f"\n完成！更新 {updated} 家，共快取 {len(cache)} 家")
    print(f"儲存至 {cache_path}")


if __name__ == '__main__':
    main()
