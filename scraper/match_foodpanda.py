#!/usr/bin/env python3
"""
嚴格比對 UberEats 餐廳 → Foodpanda URL
1. 品牌名拼音必須是 slug 前綴
2. 連鎖店必須同分店（比對區域/分店名拼音）
3. 相似度門檻 0.80+
"""

import json, re
from pathlib import Path
from difflib import SequenceMatcher
from pypinyin import lazy_pinyin, Style

DATA_DIR = Path(__file__).parent.parent / 'data'


def to_pinyin(text: str) -> str:
    parts = lazy_pinyin(text, style=Style.NORMAL, errors='default')
    return ''.join(parts).lower()


def norm(s: str) -> str:
    return re.sub(r'[^a-z0-9]', '', s.lower())


def sim(a: str, b: str) -> float:
    if not a or not b:
        return 0
    return SequenceMatcher(None, a, b).ratio()


# 連鎖品牌清單（這些品牌有很多分店，必須嚴格比對分店）
CHAINS = [
    '麥當勞', 'McDonald', '肯德基', 'KFC', '漢堡王', 'Burger King',
    '摩斯漢堡', 'MOS', '達美樂', 'Domino', '必勝客', 'Pizza Hut',
    'Subway', '頂呱呱', '拿坡里', '丹丹漢堡', '八方雲集', '爭鮮',
    '壽司郎', '藏壽司', '鼎泰豐', '胖老爹', '繼光香香雞', '豆府',
    '50嵐', '清心福全', '迷客夏', '可不可', '得正', 'CoCo',
    '鮮茶道', '大苑子', '茶湯會', '春水堂', '日出茶太',
    '千葉火鍋', '築間', '海底撈', '涮乃葉', '石二鍋',
    '饗食天堂', '漢來海港', '饗饗', '王品', '西堤', '陶板屋',
    '鬍鬚張', '三商巧福', '福勝亭', '定食8', '吉野家',
    '路易莎', 'Louisa', '星巴克', 'Starbucks', '85度C',
    '全聯', '家樂福', '7-ELEVEN', '全家',
    '初瓦', '嚮辣', '1010湘', '瓦城',
]


def is_chain(name: str) -> bool:
    for c in CHAINS:
        if c.lower() in name.lower():
            return True
    return False


def extract_branch(name: str) -> str:
    """抽取分店名"""
    # 常見模式：品牌名 + 分店名
    m = re.search(r'([\u4e00-\u9fff]{2,}[分總旗]?店|[A-Za-z]+店)$', name)
    if m:
        return m.group(0)
    # 或者最後一個空格後的部分
    parts = name.rsplit(None, 1)
    if len(parts) > 1 and len(parts[-1]) >= 2:
        return parts[-1]
    return ''


def main():
    ue_data = json.loads((DATA_DIR / 'ubereats.json').read_text())
    ue_list = ue_data.get('restaurants', [])
    print(f"UberEats: {len(ue_list)} 家")

    fp_data = json.loads((DATA_DIR / 'foodpanda.json').read_text())
    fp_list = fp_data.get('restaurants', [])
    print(f"Foodpanda: {len(fp_list)} 家")

    # 建索引
    fp_entries = []
    for r in fp_list:
        url = r.get('url', '')
        if '/restaurant/' not in url:
            continue
        full_slug = url.split('/restaurant/')[-1]
        parts = full_slug.split('/', 1)
        if len(parts) < 2:
            continue
        fp_entries.append({
            **r,
            '_code': parts[0],
            '_slug_norm': norm(parts[1]),
            '_slug_raw': parts[1],
        })

    print(f"Foodpanda 索引: {len(fp_entries)} 家")

    # 依品牌拼音前綴分組（加速查找）
    from collections import defaultdict
    prefix_map = defaultdict(list)  # prefix6 -> [entries]
    for fp in fp_entries:
        for plen in [6, 8, 10, 12]:
            prefix_map[fp['_slug_norm'][:plen]].append(fp)

    matched = []
    stats = {'exact': 0, 'high': 0, 'chain_ok': 0, 'chain_skip': 0, 'low': 0}

    for ue in ue_list:
        name = ue['name'].strip()
        full_py = norm(to_pinyin(name))
        chain = is_chain(name)

        # 先找前綴候選
        candidates = set()
        for plen in [12, 10, 8, 6]:
            prefix = full_py[:plen]
            if prefix in prefix_map:
                for fp in prefix_map[prefix]:
                    candidates.add(id(fp))

        if not candidates:
            continue

        # 評分
        best = None
        best_score = 0

        for fp in fp_entries:
            if id(fp) not in candidates:
                continue
            s = sim(full_py, fp['_slug_norm'])
            if s > best_score:
                best_score = s
                best = fp

        if not best:
            continue

        # 門檻判斷
        if best_score >= 0.95:
            # 幾乎完美，直接接受
            stats['exact'] += 1
        elif best_score >= 0.80:
            # 有分店名的都要驗證分店吻合
            branch = extract_branch(name)
            area = ue.get('area', '')
            has_branch = bool(branch) or bool(re.search(r'[\u4e00-\u9fff]{2,}店', name))

            if has_branch or chain:
                branch_py = norm(to_pinyin(branch)) if branch else ''
                area_py = norm(to_pinyin(area)) if area else ''
                slug = best['_slug_norm']
                branch_ok = (branch_py and len(branch_py) >= 4 and branch_py in slug) or \
                            (area_py and len(area_py) >= 4 and area_py in slug)

                if not branch_ok:
                    stats['chain_skip'] += 1
                    continue
                stats['chain_ok'] += 1
            else:
                stats['high'] += 1
        else:
            stats['low'] += 1
            continue

        matched.append({
            'name': name,
            'slug': best['slug'] if best.get('slug', '').startswith('fp-') else f"fp-{best['_code']}/{best['_slug_raw']}",
            'url': best['url'],
            'platform': 'foodpanda',
            'area': ue.get('area', ''),
            'area_lat': ue.get('area_lat', 25.033),
            'area_lng': ue.get('area_lng', 121.565),
        })

    total = len(ue_list)
    print(f"\n配對結果: {len(matched)}/{total} ({len(matched)*100//total}%)")
    print(f"  完美匹配: {stats['exact']}")
    print(f"  高分匹配: {stats['high']}")
    print(f"  連鎖店-分店吻合: {stats['chain_ok']}")
    print(f"  連鎖店-分店不符(跳過): {stats['chain_skip']}")
    print(f"  低分跳過: {stats['low']}")

    # 顯示範例
    print("\n=== 配對範例 ===")
    for r in matched[:15]:
        print(f"  {r['name'][:35]:35s} → {r['url'][-55:]}")

    # 合併
    existing_named = [r for r in fp_list if any(ord(c) > 0x4e00 for c in r.get('name', ''))]

    seen = set()
    final = []
    for r in matched:
        if r['url'] not in seen:
            seen.add(r['url'])
            final.append(r)
    for r in existing_named:
        if r['url'] not in seen:
            seen.add(r['url'])
            final.append(r)

    output = {
        'scraped_at': fp_data.get('scraped_at', ''),
        'total': len(final),
        'restaurants': final,
    }

    with open(DATA_DIR / 'foodpanda.json', 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n儲存 {len(final)} 家至 foodpanda.json")


if __name__ == '__main__':
    main()
