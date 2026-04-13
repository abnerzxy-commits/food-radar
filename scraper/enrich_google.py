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

    # 常見正面關鍵字（按重要性排序，計算次數）
    positive_keywords = [
        '好吃', '推薦', '必點', '新鮮', '份量足', '服務好', 'CP值高', '便宜',
        '美味', '讚', '超棒', '回訪', '值得', '不錯', '滿意', '快速', '準時',
    ]
    negative_keywords = [
        '太鹹', '太油', '冷掉', '等太久', '份量少', '貴', '失望', '難吃',
        '慢', '態度差', '不新鮮',
    ]

    highlight_scores = []
    for kw in positive_keywords:
        count = all_text.count(kw)
        if count >= 2:
            highlight_scores.append((f"👍 {kw}", count))
    for kw in negative_keywords:
        count = all_text.count(kw)
        if count >= 2:
            highlight_scores.append((f"👎 {kw}", count))

    highlight_scores.sort(key=lambda x: -x[1])
    highlights = [h[0] for h in highlight_scores[:5]]

    # 提取推薦餐點 — 用更精確的模式
    # 食物相關字（餐點名稱通常包含這些字）
    food_chars = '飯麵粥湯鍋肉雞鴨魚蝦蟹豬牛羊排骨腿翅蛋豆腐皮卷捲餅包子餃燒烤炸煎蒸滷拌炒丼壽司披薩漢堡薯條奶茶咖啡冰粿糕酥派塔鬆餅可頌吐司沙拉串天婦羅烏龍蕎麥咖哩便當定食腸粉河粉蓋飯拉麵'

    dishes = {}  # dish -> count

    # 策略1: 「的X很好吃」「X必點」等明確推薦句式
    patterns_strict = [
        r'(?:推薦|必點|必吃|招牌)\s*[的是]?\s*([\u4e00-\u9fff]{2,6})',
        r'([\u4e00-\u9fff]{2,6})\s*(?:必點|必吃|很好吃|超好吃|好吃到|最推|大推)',
        r'點了\s*([\u4e00-\u9fff]{2,6})',
        r'([\u4e00-\u9fff]{2,6})\s*(?:很推|很讚|超讚|非常好吃)',
    ]
    for pat in patterns_strict:
        for m in re.finditer(pat, all_text):
            dish = m.group(1).strip()
            # 清理前後的助詞
            dish = re.sub(r'^[的了和是也在]+', '', dish)
            dish = re.sub(r'[的了和是也在]+$', '', dish)
            if len(dish) < 2 or len(dish) > 6:
                continue
            # 必須包含至少一個食物相關字
            if not any(c in food_chars for c in dish):
                continue
            # 排除非食物詞
            if re.search(r'(環境|服務|態度|位置|價格|店面|老闆|空間|裝潢|氣氛|停車)', dish):
                continue
            dishes[dish] = dishes.get(dish, 0) + 1

    # 策略2: 頓號/逗號分隔的列舉（常見於「點了X、Y、Z」）
    enum_pat = r'(?:點了|吃了|叫了|選了)\s*([\u4e00-\u9fff]{2,6}(?:[、，,]\s*[\u4e00-\u9fff]{2,6})+)'
    for m in re.finditer(enum_pat, all_text):
        items = re.split(r'[、，,]\s*', m.group(1))
        for item in items:
            item = item.strip()
            if 2 <= len(item) <= 6 and any(c in food_chars for c in item):
                dishes[item] = dishes.get(item, 0) + 1

    # 按出現次數排序，取前 6 個
    sorted_dishes = sorted(dishes.items(), key=lambda x: -x[1])
    return [d[0] for d in sorted_dishes[:6]], highlights


def main():
    if not API_KEY:
        print("錯誤：找不到 GOOGLE_PLACES_API_KEY")
        sys.exit(1)

    # 讀取所有平台的餐廳資料
    restaurants = []
    for fname in ['ubereats.json', 'foodpanda.json']:
        fpath = DATA_DIR / fname
        if fpath.exists():
            data = json.loads(fpath.read_text())
            restaurants.extend(data.get('restaurants', []))

    if not restaurants:
        print("錯誤：找不到任何餐廳資料")
        sys.exit(1)

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
