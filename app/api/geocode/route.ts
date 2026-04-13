import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY

export async function GET(request: NextRequest) {
  const address = request.nextUrl.searchParams.get('address')?.trim()
  if (!address) {
    return NextResponse.json({ error: '需要提供地址' }, { status: 400 })
  }

  try {
    // 用 Places API (Find Place) 來取得座標，不需額外開通 Geocoding API
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(address)}&inputtype=textquery&fields=geometry,formatted_address,name&language=zh-TW&key=${API_KEY}`
    const res = await fetch(url)
    const data = await res.json()

    if (data.status === 'OK' && data.candidates?.length > 0) {
      const place = data.candidates[0]
      const loc = place.geometry.location
      return NextResponse.json({
        lat: loc.lat,
        lng: loc.lng,
        formatted: place.formatted_address || place.name || address,
      })
    }

    // 備用：用 Text Search API
    const url2 = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(address)}&language=zh-TW&key=${API_KEY}`
    const res2 = await fetch(url2)
    const data2 = await res2.json()

    if (data2.status === 'OK' && data2.results?.length > 0) {
      const place = data2.results[0]
      const loc = place.geometry.location
      return NextResponse.json({
        lat: loc.lat,
        lng: loc.lng,
        formatted: place.formatted_address || place.name || address,
      })
    }

    return NextResponse.json({ error: '找不到該地址' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: '地址查詢失敗' }, { status: 500 })
  }
}
