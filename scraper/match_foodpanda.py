#!/usr/bin/env python3
"""
比對 UberEats 餐廳名稱 → Foodpanda sitemap URL
用拼音前綴比對，把匹配的 Foodpanda 直連 URL 寫回 foodpanda.json
"""

import json, re
from pathlib import Path
from pypinyin import lazy_pinyin, Style

DATA_DIR = Path(__file__).parent.parent / 'data'


def chinese_to_pinyin(name: str) -> str:
    """中文名 → 純拼音字串（無分隔）"""
    # 移除英文和特殊字元，只轉中文
    parts = lazy_pinyin(name, style=Style.NORMAL, errors='default')
    return ''.join(parts).lower()


def normalize(s: str) -> str:
    """正規化：只保留 a-z 0-9"""
    return re.sub(r'[^a-z0-9]', '', s.lower())


def extract_name_parts(name: str) -> list[str]:
    """從餐廳名稱抽取可比對的部分（全名 + 去掉分店名）"""
    name = name.strip()
    parts = [name]

    # 去掉常見分店後綴
    for pattern in [
        r'\s*[\(（].*?[\)）]$',  # (XX店)
        r'\s*-\s*\S+店$',       # - XX店
        r'\s+\S{2,4}店$',       # XX店
        r'\s+S\d+$',            # S217
    ]:
        shorter = re.sub(pattern, '', name)
        if shorter != name and len(shorter) > 1:
            parts.append(shorter)

    # 去掉英文部分（如 "McDonald's S217"）
    cn_only = re.sub(r'[a-zA-Z0-9\s\']+', '', name).strip()
    if cn_only and len(cn_only) >= 2 and cn_only != name:
        parts.append(cn_only)

    # 去掉中文部分（如 "KFC 肯德基" -> "KFC"）
    en_only = re.sub(r'[\u4e00-\u9fff]+', '', name).strip()
    if en_only and len(en_only) >= 2 and en_only != name:
        parts.append(en_only)

    return parts


def main():
    # 載入 UberEats
    ue_path = DATA_DIR / 'ubereats.json'
    ue_data = json.loads(ue_path.read_text())
    ue_restaurants = ue_data.get('restaurants', [])
    print(f"UberEats: {len(ue_restaurants)} 家")

    # 載入 Foodpanda
    fp_path = DATA_DIR / 'foodpanda.json'
    fp_data = json.loads(fp_path.read_text())
    fp_restaurants = fp_data.get('restaurants', [])
    print(f"Foodpanda: {len(fp_restaurants)} 家")

    # 建立 Foodpanda 索引：用 slug 的拼音部分（去掉 code/ 前綴）
    fp_by_norm_slug = {}  # normalized slug part -> [entries]
    for r in fp_restaurants:
        url = r['url']
        if '/restaurant/' not in url:
            continue
        # slug 格式: {code}/{pinyin-slug}
        full_slug = url.split('/restaurant/')[-1]
        parts = full_slug.split('/', 1)
        if len(parts) < 2:
            continue
        pinyin_slug = parts[1]  # 拼音部分
        norm = normalize(pinyin_slug)
        if norm not in fp_by_norm_slug:
            fp_by_norm_slug[norm] = r
        # 也存前綴用的索引
        for prefix_len in [6, 8, 10, 12, 15, 20]:
            prefix = norm[:prefix_len]
            key = f"pfx_{prefix_len}_{prefix}"
            if key not in fp_by_norm_slug:
                fp_by_norm_slug[key] = r

    print(f"建立 {len(fp_by_norm_slug)} 個索引鍵")

    # 比對
    matched = 0
    matched_list = []

    for ue in ue_restaurants:
        name = ue['name'].strip()
        name_parts = extract_name_parts(name)
        found = None

        for part in name_parts:
            pinyin = chinese_to_pinyin(part)
            norm = normalize(pinyin)

            if not norm or len(norm) < 3:
                continue

            # 1. 完整匹配
            if norm in fp_by_norm_slug:
                found = fp_by_norm_slug[norm]
                break

            # 2. Foodpanda slug 以我們的拼音開頭
            for prefix_len in [20, 15, 12, 10, 8]:
                key = f"pfx_{prefix_len}_{norm[:prefix_len]}"
                if key in fp_by_norm_slug and len(norm) >= prefix_len:
                    found = fp_by_norm_slug[key]
                    break
            if found:
                break

            # 3. 反向：我們的拼音以 Foodpanda slug 開頭
            # （適合短名餐廳）
            if len(norm) >= 6:
                for fp_norm, fp_r in fp_by_norm_slug.items():
                    if not fp_norm.startswith('pfx_') and fp_norm.startswith(norm) and len(fp_norm) - len(norm) < 30:
                        found = fp_r
                        break
            if found:
                break

        if found:
            matched += 1
            matched_list.append({
                'name': name,
                'slug': found['slug'] if found['slug'].startswith('fp-') else f"fp-{found['slug']}",
                'url': found['url'],
                'platform': 'foodpanda',
                'area': ue.get('area', ''),
                'area_lat': ue.get('area_lat', 25.033),
                'area_lng': ue.get('area_lng', 121.565),
            })

    print(f"\n配對成功: {matched} 家 / {len(ue_restaurants)} 家 ({matched*100//len(ue_restaurants)}%)")

    # 保留原有中文名的 + 新配對的
    existing_named = [r for r in fp_restaurants
                      if any(ord(c) > 0x4e00 for c in r.get('name', ''))]

    seen_urls = set()
    final = []
    for r in matched_list:
        if r['url'] not in seen_urls:
            seen_urls.add(r['url'])
            final.append(r)
    for r in existing_named:
        if r['url'] not in seen_urls:
            seen_urls.add(r['url'])
            final.append(r)

    output = {
        'scraped_at': fp_data.get('scraped_at', ''),
        'total': len(final),
        'restaurants': final,
    }

    with open(fp_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"儲存 {len(final)} 家有中文名+直連 URL 的餐廳至 {fp_path}")

    # 顯示部分配對結果
    print("\n=== 配對範例 ===")
    for r in matched_list[:15]:
        print(f"  {r['name'][:30]:30s} → {r['url'][-50:]}")


if __name__ == '__main__':
    main()
