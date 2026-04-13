import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import path from 'path'

interface UberEatsEntry {
  name: string
  slug: string
  url: string
  area: string
  area_lat: number
  area_lng: number
}

interface EnrichedData {
  found: boolean
  place_id?: string
  rating?: number
  review_count?: number
  price_level?: number | null
  address?: string
  photo?: string
  summary?: string
  dishes?: string[]
  highlights?: string[]
  is_open?: boolean | null
  lat?: number
  lng?: number
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const CATEGORY_RULES: [string, RegExp][] = [
  ['速食', /麥當勞|肯德基|KFC|McDonald|MOS|摩斯|漢堡|Burger|頂呱呱|丹丹|達美樂|Domino|必勝客|Pizza Hut|Subway/i],
  ['鍋物', /火鍋|鍋|涮涮|石鍋|麻辣|鼎王|海底撈|鬼椒|湯底/i],
  ['日式', /日式|壽司|拉麵|丼|定食|居酒屋|串燒|天婦羅|豬排|日本|烏龍麵|味噌|和食|靜岡|DON/i],
  ['韓式', /韓式|韓國|烤肉|石鍋拌飯|部隊鍋|韓|辣炒/i],
  ['中式', /中式|中華|滷肉|雞肉飯|便當|牛肉麵|小籠包|水餃|炒飯|熱炒|台菜|客家|燒臘|港式|粵菜|川菜|包子|排骨|雞腿|燒鵝|鴨莊|龍記/i],
  ['西式', /義大利|義式|西餐|排餐|牛排|Steak|Pasta|燉飯|法式|Bistro/i],
  ['Pizza', /比薩|披薩|Pizza|Domino|達美樂|必勝客/i],
  ['咖啡茶飲', /茶|飲|咖啡|Coffee|Cafe|奶茶|珍珠|手搖|果汁|OOLONG|得正|可不可|五十嵐|清心|迷客夏/i],
  ['甜點', /蛋糕|甜點|冰|烘焙|麵包|Bakery|鬆餅|巧克力|Dessert/i],
  ['東南亞', /泰式|泰國|越南|河粉|Pho|咖哩|印度|馬來|新加坡|南洋/i],
  ['海鮮', /海鮮|魚|蝦|蟹|鮪魚|生魚片|海產/i],
  ['素食', /素食|蔬食|素|Vegan|Vegetarian/i],
]

// 非餐廳排除名單（超市、超商、賣場、藥妝等）
const NON_RESTAURANT_RE = /全聯|家樂福|美廉社|棉花田|全家便利|全家Fami|全家fami|FamiSuper|famisuper|統一超商|7-ELEVEN|7-eleven|聖德科斯|心樸市集|優市|Costco|costco|好市多|屈臣氏|康是美|寵物公園|大全聯|特力屋|特力家|HOLA|hola|寶雅|大潤發|愛買|小北百貨|光南|生活工場|無印良品|MUJI|IKEA|ikea|振宇五金|東京著衣|NET |淨水|水電|搬家|洗衣|修車|汽車|機車行|輪胎|油漆|裝潢|房屋|寵物醫院|動物醫院|獸醫|牙醫|診所|醫院|藥局|藥房|眼鏡|髮廊|美髮|美甲|SPA|spa|按摩|健身|瑜珈/i
// 垃圾名字（促銷 badge 被爬成店名）
const JUNK_NAME_RE = /^(\d+%\s*優惠|買\s*\d+\s*送\s*\d+|免運|優惠|促銷|\d+\s*折)/

function isRestaurant(name: string): boolean {
  return !NON_RESTAURANT_RE.test(name) && !JUNK_NAME_RE.test(name)
}

function getCategories(name: string): string[] {
  const cats: string[] = []
  for (const [cat, regex] of CATEGORY_RULES) {
    if (regex.test(name) && !cats.includes(cat)) cats.push(cat)
  }
  return cats
}

interface RestaurantEntry {
  name: string
  slug: string
  url: string
  platform: string
  area: string
  area_lat: number
  area_lng: number
}

interface WarningEntry {
  match: string
  match_type: string
  tag: string
  reason: string
  source: string
}

let allCache: RestaurantEntry[] | null = null
let enrichedCache: Record<string, EnrichedData> | null = null
let warningsCache: WarningEntry[] | null = null

async function loadAllRestaurants(): Promise<RestaurantEntry[]> {
  if (allCache) return allCache

  const dataDir = path.join(process.cwd(), 'data')
  const entries: RestaurantEntry[] = []

  // 載入 UberEats
  try {
    const raw = await fs.readFile(path.join(dataDir, 'ubereats.json'), 'utf-8')
    const data = JSON.parse(raw)
    for (const r of (data.restaurants || [])) {
      entries.push({ ...r, platform: 'ubereats' })
    }
  } catch {}

  // 載入 Foodpanda
  try {
    const raw = await fs.readFile(path.join(dataDir, 'foodpanda.json'), 'utf-8')
    const data = JSON.parse(raw)
    for (const r of (data.restaurants || [])) {
      entries.push({ ...r, platform: 'foodpanda' })
    }
  } catch {}

  // 合併同名餐廳，標記在哪些平台上有
  const merged = new Map<string, RestaurantEntry & { platforms: string[], urls: Record<string, string> }>()
  for (const r of entries) {
    const key = r.name.trim()
    if (merged.has(key)) {
      const existing = merged.get(key)!
      if (!existing.platforms.includes(r.platform)) {
        existing.platforms.push(r.platform)
        existing.urls[r.platform] = r.url
      }
    } else {
      merged.set(key, {
        ...r,
        platforms: [r.platform],
        urls: { [r.platform]: r.url },
      })
    }
  }

  allCache = Array.from(merged.values())
  return allCache
}

async function loadEnriched(): Promise<Record<string, EnrichedData>> {
  if (enrichedCache) return enrichedCache
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'data', 'enriched.json'), 'utf-8')
    enrichedCache = JSON.parse(raw)
  } catch { enrichedCache = {} }
  return enrichedCache!
}

async function loadWarnings(): Promise<WarningEntry[]> {
  if (warningsCache) return warningsCache
  try {
    const raw = await fs.readFile(path.join(process.cwd(), 'data', 'warnings.json'), 'utf-8')
    warningsCache = JSON.parse(raw).entries || []
  } catch { warningsCache = [] }
  return warningsCache!
}

function getWarning(name: string, warnings: WarningEntry[]): { tag: string; reason: string } | null {
  for (const w of warnings) {
    if (w.match_type === 'name_contains' && name.includes(w.match)) {
      return { tag: w.tag, reason: w.reason }
    }
  }
  return null
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const lat = parseFloat(searchParams.get('lat') || '0')
  const lng = parseFloat(searchParams.get('lng') || '0')
  const keyword = (searchParams.get('keyword') || '').toLowerCase()
  const includeStr = searchParams.get('include') || ''  // 要的分類，逗號分隔
  const excludeStr = searchParams.get('exclude') || ''  // 不要的分類，逗號分隔
  const includeCats = includeStr ? includeStr.split(',') : []
  const excludeCats = excludeStr ? excludeStr.split(',') : []
  const openOnly = searchParams.get('openOnly') === '1'
  const offset = parseInt(searchParams.get('offset') || '0')
  const limit = parseInt(searchParams.get('limit') || '30')

  if (!lat || !lng) {
    return NextResponse.json({ error: '需要提供經緯度' }, { status: 400 })
  }

  const [allData, enriched, warnings] = await Promise.all([loadAllRestaurants(), loadEnriched(), loadWarnings()])

  // 合併資料，計算距離
  let list = allData.map((r: any) => {
    const e = enriched[r.slug] || {}
    const rLat = e.lat || r.area_lat
    const rLng = e.lng || r.area_lng
    const distKm = haversineKm(lat, lng, rLat, rLng)
    const cats = getCategories(r.name)
    const platforms: string[] = r.platforms || [r.platform]
    const urls: Record<string, string> = r.urls || { [r.platform]: r.url }
    return {
      ...r, ...e, distKm, categories: cats, platforms, urls,
      rLat, rLng,
    }
  })

  // 排除非餐廳（超市、超商、賣場等）和 Google Maps 上找不到的店家
  list = list.filter((r: any) => isRestaurant(r.name) && r.found !== false && r.rating > 0)

  // 排序：先距離、同距離再照星等高到低
  list.sort((a, b) => {
    const distDiff = a.distKm - b.distKm
    if (Math.abs(distDiff) > 0.3) return distDiff // 距離差超過 300m 就依距離
    return (b.rating || 0) - (a.rating || 0)      // 距離接近就依星等
  })

  // 關鍵字
  if (keyword) {
    list = list.filter((r: any) => r.name.toLowerCase().includes(keyword))
  }

  // 要的分類（任一符合就保留）
  if (includeCats.length > 0) {
    list = list.filter((r: any) => r.categories.some((c: string) => includeCats.includes(c)))
  }

  // 不要的分類（任一符合就排除）
  if (excludeCats.length > 0) {
    list = list.filter((r: any) => !r.categories.some((c: string) => excludeCats.includes(c)))
  }

  // 僅顯示營業中
  if (openOnly) {
    list = list.filter((r: any) => r.is_open === true)
  }

  const total = list.length
  const paged = list.slice(offset, offset + limit)

  const allCats = new Set<string>()
  list.forEach((r: any) => r.categories.forEach((c: string) => allCats.add(c)))

  const restaurants = paged.map((r: any) => {
    const encodedName = encodeURIComponent(r.name)
    const platforms: string[] = r.platforms || []
    const urls: Record<string, string> = r.urls || {}
    const warning = getWarning(r.name, warnings)

    return {
      id: r.place_id || r.slug,
      name: r.name,
      rating: r.rating || 0,
      reviewCount: r.review_count || 0,
      distance: Math.round(r.distKm * 1000),
      distanceKm: Math.round(r.distKm * 10) / 10,
      isOpen: r.is_open ?? null,
      priceLevel: r.price_level ?? null,
      address: r.address || r.area,
      photo: r.photo || null,
      score: 0,
      categories: r.categories,
      dishes: r.dishes || [],
      highlights: r.highlights || [],
      summary: r.summary || '',
      platforms,
      ubereatsUrl: urls.ubereats || `https://www.ubereats.com/tw/search?q=${encodedName}`,
      foodpandaUrl: urls.foodpanda || `https://www.foodpanda.com.tw/restaurants/new?q=${encodedName}`,
      warning: warning ? { tag: warning.tag, reason: warning.reason } : null,
    }
  })

  return NextResponse.json({
    restaurants,
    total,
    hasMore: offset + limit < total,
    categories: Array.from(allCats).sort(),
    source: 'ubereats+cache',
  })
}
