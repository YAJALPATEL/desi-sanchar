import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query');

    if (!query) {
        return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const encodedQuery = encodeURIComponent(query);

    // PRIORITY LIST:
    // 1. Saavn.me (Full Song)
    // 2. Saavn.dev (Full Song)
    // 3. iTunes (Reliable 30s Fallback - Never blocks)
    const PROVIDERS = [
        {
            name: 'saavn_me',
            url: `https://saavn.me/search/songs?query=${encodedQuery}&page=1&limit=10`,
            type: 'saavn'
        },
        {
            name: 'saavn_dev',
            url: `https://saavn.dev/api/search/songs?query=${encodedQuery}&limit=10`,
            type: 'saavn'
        },
        {
            name: 'itunes',
            url: `https://itunes.apple.com/search?term=${encodedQuery}&media=music&entity=song&limit=10`,
            type: 'itunes'
        }
    ];

    for (const provider of PROVIDERS) {
        try {
            console.log(`Attempting fetch from: ${provider.name}`);

            // Add a 4-second timeout so the UI doesn't freeze if an API is slow
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);

            const res = await fetch(provider.url, {
                signal: controller.signal,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            clearTimeout(timeoutId);

            if (!res.ok) throw new Error(`Status ${res.status}`);

            // Try parsing JSON. If this fails (HTML response), it will throw an error caught below.
            const data = await res.json();

            let results = [];

            // === NORMALIZATION LOGIC ===

            // 1. Handle Saavn Structure
            if (provider.type === 'saavn') {
                const rawItems = data.data?.results || data.results || [];

                if (Array.isArray(rawItems) && rawItems.length > 0) {
                    results = rawItems.map((t: any) => ({
                        id: t.id,
                        name: t.name,
                        artist: t.primaryArtists || t.artist || "Unknown",
                        image: t.image?.[2]?.url || t.image?.[0]?.url || t.image,
                        // Try to find ANY working URL
                        url: t.downloadUrl?.[4]?.url || t.downloadUrl?.[2]?.url || t.downloadUrl?.[0]?.url || t.url || t.media_url,
                        duration: t.duration || 180
                    })).filter((t: any) => t.url); // Must have audio URL
                }
            }

            // 2. Handle iTunes Structure
            else if (provider.type === 'itunes') {
                if (data.results && data.results.length > 0) {
                    results = data.results.map((t: any) => ({
                        id: t.trackId,
                        name: t.trackName,
                        artist: t.artistName,
                        image: t.artworkUrl100.replace('100x100', '600x600'), // Upgrade quality
                        url: t.previewUrl,
                        duration: 30 // iTunes is limited to 30s
                    }));
                }
            }

            // If we got valid results, return them immediately and STOP the loop
            if (results.length > 0) {
                return NextResponse.json({ success: true, source: provider.name, results });
            }

        } catch (error: any) {
            // Just log the error and let the loop continue to the next provider
            console.warn(`Provider ${provider.name} failed:`, error.message);
        }
    }

    // If loop finishes and nothing worked
    return NextResponse.json({ success: false, error: 'All music services failed' }, { status: 200 }); // Return 200 with empty list to prevent crash
}