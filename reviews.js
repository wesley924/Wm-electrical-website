// Vercel Serverless Function
// Fetches live Google reviews for the business using the Google Places API.
// The API key and Place ID are read from environment variables set in the
// Vercel dashboard (Project → Settings → Environment Variables) — they are
// never exposed to the browser.

export default async function handler(req, res) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    return res.status(500).json({
      error: 'Missing GOOGLE_PLACES_API_KEY or GOOGLE_PLACE_ID environment variable.'
    });
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,rating,user_ratings_total,reviews,url&key=${apiKey}`;
    const googleRes = await fetch(url);
    const data = await googleRes.json();

    if (data.status !== 'OK') {
      return res.status(502).json({ error: `Google API error: ${data.status}` });
    }

    const result = data.result || {};
    const reviews = (result.reviews || [])
      .slice(0, 5)
      .map((r) => ({
        author: r.author_name,
        rating: r.rating,
        text: r.text,
        relativeTime: r.relative_time_description,
        profilePhoto: r.profile_photo_url || null
      }));

    // Cache at the edge for an hour to stay well within free API quota,
    // while keeping content reasonably fresh.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

    return res.status(200).json({
      businessName: result.name,
      rating: result.rating,
      totalReviews: result.user_ratings_total,
      googleUrl: result.url,
      reviews
    });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch reviews', details: err.message });
  }
}
