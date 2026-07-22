// scripts/fetch-spotify.js
// Fetches current/recent Spotify activity and writes it to listening.json
// Run by a GitHub Action on a schedule. Secrets come from env vars.

const fs = require('fs');

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.SPOTIFY_REFRESH_TOKEN;

async function getAccessToken() {
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: REFRESH_TOKEN
    })
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function getCurrentlyPlaying(token) {
  const res = await fetch('https://api.spotify.com/v1/me/player/currently-playing', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 204) return null; // nothing currently playing
  if (!res.ok) throw new Error(`Currently-playing request failed: ${res.status}`);
  return res.json();
}

async function getRecentlyPlayed(token) {
  const res = await fetch('https://api.spotify.com/v1/me/player/recently-played?limit=1', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) throw new Error(`Recently-played request failed: ${res.status}`);
  return res.json();
}

(async () => {
  try {
    const token = await getAccessToken();
    const current = await getCurrentlyPlaying(token);

    let output;

    if (current && current.is_playing && current.item) {
      output = {
        isPlaying: true,
        song: current.item.name,
        artist: current.item.artists.map(a => a.name).join(', '),
        album: current.item.album.name,
        albumArt: current.item.album.images[0]?.url || null,
        url: current.item.external_urls.spotify,
        updatedAt: new Date().toISOString()
      };
    } else {
      const recent = await getRecentlyPlayed(token);
      const last = recent.items[0];
      output = {
        isPlaying: false,
        song: last.track.name,
        artist: last.track.artists.map(a => a.name).join(', '),
        album: last.track.album.name,
        albumArt: last.track.album.images[0]?.url || null,
        url: last.track.external_urls.spotify,
        updatedAt: new Date().toISOString()
      };
    }

    fs.writeFileSync('listening.json', JSON.stringify(output, null, 2));
    console.log('Wrote listening.json:', output);
  } catch (err) {
    console.error('Failed to fetch Spotify data:', err);
    process.exit(1);
  }
})();
