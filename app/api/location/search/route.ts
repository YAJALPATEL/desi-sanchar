import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
        return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    try {
        // Nominatim requires a valid User-Agent header
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5`;

        const res = await fetch(url, {
            headers: {
                'User-Agent': 'DesiSanchar-App/1.0 (contact@example.com)' // Required by OSM policy
            }
        });

        if (!res.ok) {
            throw new Error(`OSM API Error: ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);

    } catch (error: any) {
        console.error('Location API Error:', error);
        return NextResponse.json({ error: 'Failed to fetch location' }, { status: 500 });
    }
}