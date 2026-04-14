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
const NON_RESTAURANT_RE = /全聯|家樂福|美廉社|棉花田|全家便利|全家Fami|全家fami|FamiSuper|famisuper|統一超商|7-ELEVEN|7-eleven|聖德科斯|心樸市集|優市|Costco|costco|好市多|屈臣氏|康是美|寵物公園|大全聯|特力屋|特力家|HOLA|hola|寶雅|大潤發|愛買|小北百貨|光南|生活工場|無印良品|MUJI|IKEA|ikea|振宇五金|東京著衣|NET |淨水|水電|搬家|洗衣|修車|汽車|機車行|輪胎|油漆|裝潢|房屋|寵物醫院|動物醫院|獸醫|牙醫|診所|醫院|藥局|藥房|眼鏡|髮廊|美髮|美甲|SPA|spa|按摩|健身|瑜珈|通訊行|手機|電信|中華電信|台灣大哥大|遠傳|亞太電信|傑昇|神腦|聯強|3C|電腦|印表機|文具|書局|書店|花店|花坊|花藝|寵物店|寵物用品|五金|水族|園藝|種子|農藥|飼料|嬰兒|母嬰|婦嬰|玩具|桌遊|電玩|遊戲|彩券|運彩|投注站|加油站|停車場|洗車|鍍膜|包膜|貼膜|維修|影印|快遞|貨運|搬運|清潔|除蟲|消毒/i
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

interface FoodpandaVendor {
  code: string
  name: string
  latitude: number
  longitude: number
  rating: number
  hero_image?: string
  address?: string
  cuisines?: { name: string }[]
  redirection_url?: string
  metadata?: { is_delivery_available?: boolean; is_temporary_closed?: boolean }
  minimum_delivery_time?: number
}

// Foodpanda 即時附近餐廳快取（每座標 5 分鐘）
const fpNearbyCache = new Map<string, { ts: number; vendors: FoodpandaVendor[] }>()

async function fetchFoodpandaNearby(lat: number, lng: number): Promise<FoodpandaVendor[]> {
  const cacheKey = `${lat.toFixed(3)},${lng.toFixed(3)}`
  const cached = fpNearbyCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < 5 * 60 * 1000) return cached.vendors

  const allVendors: FoodpandaVendor[] = []
  try {
    // Fetch up to 200 nearby vendors
    for (let offset = 0; offset < 200; offset += 50) {
      const url = `https://disco.deliveryhero.io/listing/api/v1/pandora/vendors?latitude=${lat}&longitude=${lng}&language_id=6&include=characteristics&dynamic_pricing=0&configuration=Variant1&country=tw&customer_type=regular&limit=50&offset=${offset}&sort=distance_asc`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'x-disco-client-id': 'web' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) break
      const data = await res.json()
      const items = data?.data?.items || []
      if (items.length === 0) break
      allVendors.push(...items)
    }
  } catch { /* timeout or error — use whatever we got */ }

  fpNearbyCache.set(cacheKey, { ts: Date.now(), vendors: allVendors })
  return allVendors
}

// Google Places 查詢快取（FP 獨有餐廳用）
const GAPI_KEY = process.env.GOOGLE_PLACES_API_KEY || ''
const fpGoogleCache = new Map<string, { rating: number; review_count: number; place_id: string; address: string; photo: string | null; lat: number; lng: number } | null>()

async function lookupGooglePlace(name: string, lat: number, lng: number): Promise<typeof fpGoogleCache extends Map<string, infer V> ? V : never> {
  const key = name.trim()
  if (fpGoogleCache.has(key)) return fpGoogleCache.get(key)!

  try {
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(key)}&inputtype=textquery&locationbias=circle:3000@${lat},${lng}&fields=place_id,name,rating,user_ratings_total,formatted_address,geometry,photos&language=zh-TW&key=${GAPI_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    const data = await res.json()
    if (data.status === 'OK' && data.candidates?.[0]) {
      const p = data.candidates[0]
      const result = {
        rating: p.rating || 0,
        review_count: p.user_ratings_total || 0,
        place_id: p.place_id || '',
        address: p.formatted_address || '',
        photo: p.photos?.[0]?.photo_reference || null,
        lat: p.geometry?.location?.lat || lat,
        lng: p.geometry?.location?.lng || lng,
      }
      fpGoogleCache.set(key, result)
      return result
    }
  } catch { /* timeout */ }
  fpGoogleCache.set(key, null)
  return null
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

  const [allData, enriched, warnings, fpVendors] = await Promise.all([
    loadAllRestaurants(), loadEnriched(), loadWarnings(),
    fetchFoodpandaNearby(lat, lng),
  ])

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

  // 正規化名稱：去掉括號分店名、多餘空格，用於模糊比對
  function normName(n: string): string {
    return n.replace(/\s*[\(（].*?[\)）]\s*/g, '').replace(/\s+/g, ' ').trim()
  }

  // 建立已有餐廳的正規化名稱索引
  const existingNormMap = new Map<string, any>()
  for (const r of list) {
    existingNormMap.set(normName(r.name), r)
  }

  // 用 Foodpanda 即時 API 幫現有餐廳補上 Foodpanda 直連 URL，並收集 FP 獨有餐廳
  const fpOnlyVendors: FoodpandaVendor[] = []
  for (const v of fpVendors) {
    const name = v.name?.trim()
    if (!name || !isRestaurant(name)) continue
    if (v.metadata?.is_temporary_closed) continue
    const fpUrl = v.redirection_url || `https://www.foodpanda.com.tw/restaurant/${v.code}/`

    // 模糊比對：正規化名稱 or 包含關係
    const vNorm = normName(name)
    let existing = existingNormMap.get(vNorm) || null
    if (!existing) {
      // 嘗試包含比對（FP 名稱包含 UberEats 名稱，或反過來）
      for (const r of list) {
        const rNorm = normName(r.name)
        if (rNorm.length >= 3 && vNorm.length >= 3 && (vNorm.includes(rNorm) || rNorm.includes(vNorm))) {
          existing = r
          break
        }
      }
    }

    if (existing) {
      if (!existing.platforms.includes('foodpanda')) {
        existing.platforms.push('foodpanda')
        existing.urls.foodpanda = fpUrl
      }
    } else {
      const distKm = haversineKm(lat, lng, v.latitude, v.longitude)
      if (distKm <= 8) fpOnlyVendors.push(v)
    }
  }

  // FP 獨有餐廳：查 Google Maps 取得評分（每次最多查 30 家，結果永久快取）
  const toLookup = fpOnlyVendors.filter(v => !fpGoogleCache.has(v.name?.trim() || '')).slice(0, 30)
  await Promise.all(toLookup.map(v => lookupGooglePlace(v.name!.trim(), v.latitude, v.longitude)))

  for (const v of fpOnlyVendors) {
    const name = v.name!.trim()
    const gData = fpGoogleCache.get(name)
    if (!gData || gData.rating <= 0) continue
    const distKm = haversineKm(lat, lng, gData.lat, gData.lng)
    const fpUrl = v.redirection_url || `https://www.foodpanda.com.tw/restaurant/${v.code}/`
    list.push({
      name,
      slug: `fp-${v.code}`,
      platform: 'foodpanda',
      platforms: ['foodpanda'],
      urls: { foodpanda: fpUrl },
      place_id: gData.place_id,
      rating: gData.rating,
      review_count: gData.review_count,
      address: gData.address,
      photo: gData.photo,
      is_open: v.metadata?.is_delivery_available ?? null,
      lat: gData.lat,
      lng: gData.lng,
      rLat: gData.lat,
      rLng: gData.lng,
      distKm,
      categories: getCategories(name),
      found: true,
    })
  }

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
      fpHeroImage: r.fpHeroImage || null,
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
