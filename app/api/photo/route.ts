import { NextRequest, NextResponse } from 'next/server'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY

export async function GET(request: NextRequest) {
  if (!API_KEY) {
    return NextResponse.json({ error: 'No API key' }, { status: 500 })
  }

  const { searchParams } = new URL(request.url)
  const ref = searchParams.get('ref')
  const maxWidth = searchParams.get('maxwidth') || '400'

  if (!ref) {
    return NextResponse.json({ error: 'Missing photo reference' }, { status: 400 })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${ref}&key=${API_KEY}`
    const res = await fetch(url)

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch photo' }, { status: 502 })
    }

    const buffer = await res.arrayBuffer()
    const contentType = res.headers.get('content-type') || 'image/jpeg'

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Photo fetch failed' }, { status: 500 })
  }
}
