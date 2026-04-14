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
  ['咖啡茶飲', /茶|飲|咖啡|Coffee|Cafe|奶茶|珍珠|手搖|果汁|OOLONG|得正|可不可|五十嵐|清心|迷客夏|CoCo|都可|大苑子|鮮茶道|茶湯會|春水堂|日出茶太|鶴茶樓|一沐日|萬波|再睡5分鐘|丸作|老虎堂|伯爵茶|烏弄|COMEBUY|COME BUY|TEA'S|TEA\u2019S|TEATOP|原味茶|龜記|一芳|黑沃|路易莎|Louisa|星巴克|Starbucks|85度C|cama|伯朗|丹堤|怡客|UG |麻古|鶴所|植作|大杯|小杯|手作飲|鮮果|嚮茶|紅太陽/i],
  ['甜點', /蛋糕|甜點|冰|烘焙|麵包|Bakery|鬆餅|巧克力|Dessert/i],
  ['東南亞', /泰式|泰國|越南|河粉|Pho|咖哩|印度|馬來|新加坡|南洋/i],
  ['海鮮', /海鮮|魚|蝦|蟹|鮪魚|生魚片|海產/i],
  ['素食', /素食|蔬食|素|Vegan|Vegetarian/i],
]

// 非餐廳排除名單（超市、超商、賣場、藥妝等）
const NON_RESTAURANT_RE = /全聯|家樂福|美廉社|棉花田|全家便利|全家Fami|全家fami|FamiSuper|famisuper|統一超商|7-ELEVEN|7-eleven|聖德科斯|心樸市集|優市|Costco|costco|好市多|屈臣氏|康是美|寵物公園|大全聯|特力屋|特力家|HOLA|hola|寶雅|大潤發|愛買|小北百貨|光南|生活工場|無印良品|MUJI|IKEA|ikea|振宇五金|東京著衣|NET |淨水|水電|搬家|洗衣|修車|汽車|機車行|輪胎|油漆|裝潢|房屋|寵物醫院|動物醫院|獸醫|牙醫|診所|醫院|藥局|藥房|眼鏡|髮廊|美髮|美甲|SPA|spa|按摩|健身|瑜珈|通訊行|通訊|手機|電信|中華電信|台灣大哥大|遠傳|亞太電信|傑昇|神腦|聯強|瘋殼子|殼子|保護貼|手機殼|充電|3C|電腦|印表機|文具|書局|書店|花店|花坊|花藝|寵物店|寵物用品|寵物生活|寵物百貨|寵物館|五金|水族|園藝|種子|農藥|飼料|嬰兒|母嬰|婦嬰|玩具|桌遊|電玩|遊戲|彩券|運彩|投注站|加油站|停車場|洗車|鍍膜|包膜|貼膜|維修|影印|快遞|貨運|搬運|清潔|除蟲|消毒|乾洗|送洗|鑰匙|鎖|水塔|冷氣|家電|燈具|窗簾|地毯/i
// 垃圾名字（促銷 badge 被爬成店名）
const JUNK_NAME_RE = /^(\d+%\s*優惠|買\s*\d+\s*送\s*\d+|免運|優惠|促銷|\d+\s*折)/
// 限自取排除
const PICKUP_ONLY_RE = /限自取|僅自取|自取專用|Pickup Only/i

function isRestaurant(name: string): boolean {
  return !NON_RESTAURANT_RE.test(name) && !JUNK_NAME_RE.test(name) && !PICKUP_ONLY_RE.test(name)
}

function getCategories(name: string): string[] {
  const cats: string[] = []
  for (const [cat, regex] of CATEGORY_RULES) {
    if (regex.test(name) && !cats.includes(cat)) cats.push(cat)
  }
  return cats
}

// FP cuisine 名稱 → 系統分類對應
const FP_CUISINE_MAP: Record<string, string> = {
  '飲料': '咖啡茶飲', '咖啡': '咖啡茶飲', '茶': '咖啡茶飲',
  '甜點': '甜點', '蛋糕': '甜點', '烘焙': '甜點', '麵包': '甜點',
  '日本': '日式', '壽司': '日式', '拉麵': '日式',
  '韓式': '韓式', '韓國': '韓式',
  '泰式': '東南亞', '越南': '東南亞', '印度': '東南亞', '南洋': '東南亞',
  '火鍋': '鍋物',
  '素食': '素食', '蔬食': '素食',
  '海鮮': '海鮮',
  '速食': '速食', '漢堡': '速食',
  '披薩': 'Pizza', 'Pizza': 'Pizza',
  '義式': '西式', '歐美': '西式', '法式': '西式',
  '中式': '中式', '台灣': '中式', '便當': '中式', '小吃': '中式', '熱炒': '中式',
}

function fpCuisinesToCats(cuisines?: { name: string }[]): string[] {
  if (!cuisines) return []
  const cats = new Set<string>()
  for (const c of cuisines) {
    const mapped = FP_CUISINE_MAP[c.name]
    if (mapped) cats.add(mapped)
  }
  return Array.from(cats)
}

function getCategoriesWithFpCuisines(name: string, cuisines?: { name: string }[]): string[] {
  const cats = getCategories(name)
  for (const c of fpCuisinesToCats(cuisines)) {
    if (!cats.includes(c)) cats.push(c)
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

interface FpGoogleData {
  rating: number
  review_count: number
  place_id: string
  address: string
  photo: string | null
  lat: number
  lng: number
  summary: string
  dishes: string[]
  highlights: string[]
}

const fpGoogleCache = new Map<string, FpGoogleData | null>()

function extractDishesFromReviews(reviews: { text: string }[]): string[] {
  const allText = reviews.map(r => r.text).join(' ')
  const dishSet = new Set<string>()
  const patterns = [
    /([\u4e00-\u9fff]{2,6})(很|超|非常|真的)?(好吃|美味|讚|推|必點|必吃)/g,
    /(推薦|必點|必吃|大推|激推|首推)(的)?([\u4e00-\u9fff]{2,6})/g,
    /(點了|吃了|試了|嚐了|來份)([\u4e00-\u9fff]{2,6})/g,
  ]
  const exclude = new Set(['服務','態度','環境','裝潢','氣氛','價格','份量','品質','老闆','店員','位子','座位','停車','地方','時間','感覺','朋友','家人','口味','味道','東西','餐廳','店家','生意','排隊','等待','外送','包裝'])
  for (const pat of patterns) {
    let m
    while ((m = pat.exec(allText)) !== null) {
      const d = m[3] || m[2] || m[1]
      if (d && d.length >= 2 && d.length <= 6 && !exclude.has(d)) dishSet.add(d)
    }
  }
  return Array.from(dishSet).slice(0, 5)
}

function extractHighlightsFromReviews(reviews: { text: string }[]): string[] {
  const allText = reviews.map(r => r.text).join(' ')
  const keywords = ['好吃','美味','新鮮','份量大','CP值高','服務好','乾淨','快速','平價','道地','推薦','必吃']
  const hl: string[] = []
  for (const kw of keywords) {
    if (allText.includes(kw)) hl.push(kw)
  }
  return hl.slice(0, 5)
}

async function lookupGooglePlace(name: string, lat: number, lng: number): Promise<FpGoogleData | null> {
  const key = name.trim()
  if (fpGoogleCache.has(key)) return fpGoogleCache.get(key)!

  try {
    // Step 1: Find Place to get place_id
    const findUrl = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(key)}&inputtype=textquery&locationbias=circle:3000@${lat},${lng}&fields=place_id&language=zh-TW&key=${GAPI_KEY}`
    const findRes = await fetch(findUrl, { signal: AbortSignal.timeout(5000) })
    const findData = await findRes.json()
    if (findData.status !== 'OK' || !findData.candidates?.[0]?.place_id) {
      fpGoogleCache.set(key, null)
      return null
    }
    const placeId = findData.candidates[0].place_id

    // Step 2: Place Details for full info
    const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,formatted_address,geometry,photos,reviews,editorial_summary&language=zh-TW&reviews_sort=newest&key=${GAPI_KEY}`
    const detailRes = await fetch(detailUrl, { signal: AbortSignal.timeout(5000) })
    const detailData = await detailRes.json()
    if (detailData.status !== 'OK' || !detailData.result) {
      fpGoogleCache.set(key, null)
      return null
    }

    const p = detailData.result
    const reviews = (p.reviews || []).map((r: any) => ({ text: r.text || '' }))
    const result: FpGoogleData = {
      rating: p.rating || 0,
      review_count: p.user_ratings_total || 0,
      place_id: placeId,
      address: p.formatted_address || '',
      photo: p.photos?.[0]?.photo_reference || null,
      lat: p.geometry?.location?.lat || lat,
      lng: p.geometry?.location?.lng || lng,
      summary: p.editorial_summary?.overview || '',
      dishes: extractDishesFromReviews(reviews),
      highlights: extractHighlightsFromReviews(reviews),
    }
    fpGoogleCache.set(key, result)
    return result
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
  const sortBy = searchParams.get('sort') || 'distance' // 'distance' | 'rating'
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

  // 排除非餐廳、Google Maps 找不到的、超出外送範圍的（5km）
  list = list.filter((r: any) => isRestaurant(r.name) && r.found !== false && r.rating > 0 && r.distKm <= 5)

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
    if (v.metadata?.is_delivery_available === false) continue // 限自取，跳過
    // 沒有餐飲分類的是非食物商店（寵物店、五金、通訊行等）
    if (!v.cuisines || v.cuisines.length === 0) continue
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
      // 用 FP cuisines 補充分類
      const fpCats = fpCuisinesToCats(v.cuisines)
      for (const c of fpCats) {
        if (!existing.categories.includes(c)) existing.categories.push(c)
      }
    } else {
      const distKm = haversineKm(lat, lng, v.latitude, v.longitude)
      if (distKm <= 5) fpOnlyVendors.push(v)
    }
  }

  // FP 獨有餐廳：距離 5km 內，有 keyword 時只查符合的，無 keyword 時查前 50 家近的
  const nearbyFpOnly = fpOnlyVendors
    .map(v => ({ ...v, _dist: haversineKm(lat, lng, v.latitude, v.longitude) }))
    .filter(v => v._dist <= 5)
    .sort((a, b) => a._dist - b._dist)
  const fpToCheck = keyword
    ? nearbyFpOnly.filter(v => v.name!.trim().toLowerCase().includes(keyword))
    : nearbyFpOnly.slice(0, 50)
  const toLookup = fpToCheck.filter(v => !fpGoogleCache.has(v.name?.trim() || ''))
  // 批次查 Google，每批 10 家並行
  for (let i = 0; i < toLookup.length; i += 10) {
    await Promise.all(toLookup.slice(i, i + 10).map(v => lookupGooglePlace(v.name!.trim(), v.latitude, v.longitude)))
  }

  for (const v of fpToCheck) {
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
      summary: gData.summary,
      dishes: gData.dishes,
      highlights: gData.highlights,
      is_open: v.metadata?.is_delivery_available ?? null,
      lat: gData.lat,
      lng: gData.lng,
      rLat: gData.lat,
      rLng: gData.lng,
      distKm,
      categories: getCategoriesWithFpCuisines(name, v.cuisines),
      found: true,
    })
  }

  // 排序
  list.sort((a, b) => {
    if (sortBy === 'rating') {
      const rDiff = (b.rating || 0) - (a.rating || 0)
      if (Math.abs(rDiff) > 0.1) return rDiff     // 評分優先
      return a.distKm - b.distKm                   // 同評分依距離
    }
    // 預設：距離排序
    const distDiff = a.distKm - b.distKm
    if (Math.abs(distDiff) > 0.3) return distDiff
    return (b.rating || 0) - (a.rating || 0)
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
