import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY

// 從評論中提取推薦餐點
function extractDishes(reviews: { text: string; rating: number }[]): string[] {
  const allText = reviews.map(r => r.text).join(' ')
  const dishSet = new Set<string>()

  // 常見的推薦模式
  const patterns = [
    // "XX好吃" "XX很好吃" "XX超好吃"
    /([\u4e00-\u9fff]{2,6})(很|超|非常|真的)?(好吃|美味|讚|推|必點|必吃)/g,
    // "推薦XX" "必點XX" "必吃XX"
    /(推薦|必點|必吃|大推|激推|首推)(的)?([\u4e00-\u9fff]{2,6})/g,
    // "點了XX" "吃了XX" "試了XX"
    /(點了|吃了|試了|嚐了|來份)([\u4e00-\u9fff]{2,6})/g,
    // "他們的XX" "他們家XX" "店裡的XX"
    /(他們的|他們家|店裡的|這裡的|這家的)([\u4e00-\u9fff]{2,6})/g,
  ]

  // 排除非餐點的詞
  const excludeWords = new Set([
    '服務', '態度', '環境', '裝潢', '氣氛', '價格', '份量', '品質',
    '老闆', '店員', '位子', '座位', '停車', '地方', '時間', '感覺',
    '朋友', '家人', '小孩', '口味', '味道', '東西', '餐廳', '店家',
    '生意', '排隊', '等待', '外送', '包裝', '推薦給', '值得',
  ])

  patterns.forEach(pattern => {
    let match
    while ((match = pattern.exec(allText)) !== null) {
      // 根據不同 pattern 取不同 group
      const dish = match[3] || match[2] || match[1]
      if (dish && dish.length >= 2 && dish.length <= 6 && !excludeWords.has(dish)) {
        dishSet.add(dish)
      }
    }
  })

  return Array.from(dishSet).slice(0, 8)
}

// 提取評論重點
function extractReviewHighlights(reviews: { text: string; rating: number }[]): string[] {
  const positiveKeywords = [
    '好吃', '美味', '新鮮', '份量大', '份量足', 'CP值高', 'CP值',
    '服務好', '環境好', '乾淨', '快速', '平價', '道地', '正宗',
    '排隊', '推薦', '回訪', '必吃', '值得', '驚艷',
  ]
  const negativeKeywords = [
    '難吃', '貴', '慢', '態度差', '不新鮮', '失望', '普通',
    '油膩', '太鹹', '太甜', '環境差', '等很久', '份量少',
  ]

  const allText = reviews.map(r => r.text).join(' ')
  const highlights: { text: string; type: 'positive' | 'negative'; count: number }[] = []

  positiveKeywords.forEach(kw => {
    const count = (allText.match(new RegExp(kw, 'g')) || []).length
    if (count > 0) highlights.push({ text: kw, type: 'positive', count })
  })
  negativeKeywords.forEach(kw => {
    const count = (allText.match(new RegExp(kw, 'g')) || []).length
    if (count > 0) highlights.push({ text: kw, type: 'negative', count })
  })

  highlights.sort((a, b) => b.count - a.count)
  return highlights.slice(0, 10).map(h =>
    `${h.type === 'positive' ? '👍' : '👎'} ${h.text}（${h.count}次提到）`
  )
}

export async function GET(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: '尚未設定 Google Places API Key' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const placeId = searchParams.get('id')

  if (!placeId) {
    return NextResponse.json({ error: '需要提供 place_id' }, { status: 400 })
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    url.searchParams.set('place_id', placeId)
    url.searchParams.set('fields', 'name,rating,user_ratings_total,reviews,photos,opening_hours,formatted_address,geometry,price_level,website,formatted_phone_number,url,editorial_summary,types')
    url.searchParams.set('language', 'zh-TW')
    url.searchParams.set('reviews_sort', 'newest')
    url.searchParams.set('key', API_KEY)

    const res = await fetch(url.toString(), { next: { revalidate: 600 } })
    const data = await res.json()

    if (data.status !== 'OK') {
      return NextResponse.json({ error: `Google API 錯誤: ${data.status}` }, { status: 502 })
    }

    const place = data.result
    const reviews = (place.reviews || []).map((r: {
      author_name: string
      rating: number
      text: string
      relative_time_description: string
      time: number
      profile_photo_url?: string
    }) => ({
      author: r.author_name,
      rating: r.rating,
      text: r.text,
      time: r.relative_time_description,
      timestamp: r.time,
      avatar: r.profile_photo_url || null,
    }))

    const recommendedDishes = extractDishes(reviews)
    const reviewHighlights = extractReviewHighlights(reviews)

    // 營業時間
    const openingHours = place.opening_hours ? {
      isOpen: place.opening_hours.open_now ?? null,
      weekday: place.opening_hours.weekday_text || [],
    } : null

    // 照片 references
    const photos = (place.photos || []).slice(0, 6).map((p: { photo_reference: string }) => p.photo_reference)

    return NextResponse.json({
      id: placeId,
      name: place.name,
      rating: place.rating || 0,
      reviewCount: place.user_ratings_total || 0,
      address: place.formatted_address || '',
      phone: place.formatted_phone_number || null,
      website: place.website || null,
      googleMapsUrl: place.url || null,
      priceLevel: place.price_level ?? null,
      summary: place.editorial_summary?.overview || null,
      openingHours,
      photos,
      reviews,
      recommendedDishes,
      reviewHighlights,
    })
  } catch (err) {
    console.error('取得餐廳詳情失敗:', err)
    return NextResponse.json({ error: '取得詳情失敗，請稍後再試' }, { status: 500 })
  }
}
