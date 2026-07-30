import { projectId, publicAnonKey } from '/utils/supabase/info';

export const getCoordinatesFromUrl = (url: string) => {
  if (!url) return null;
  
  // 1. Format umum: @lat,lng
  // Contoh: google.com/maps/.../@-6.123,106.123,15z
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  }
  
  // 2. Format Query: q=lat,lng
  // Contoh: maps.google.com/?q=-6.123,106.123
  const qMatch = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (qMatch) {
    return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  }

  // 3. Format Protobuf (Hidden Data): !3d...!4d
  // Sering muncul di link "Share Place" jika format @ tidak ada
  // Contoh: .../data=!3m1!4b1!4m6!3m5!1s0x...!8m2!3d-6.12345!4d106.12345
  const dataMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (dataMatch) {
    return { lat: parseFloat(dataMatch[1]), lng: parseFloat(dataMatch[2]) };
  }

  // 4. Format Search Query: query=lat,lng
  const queryMatch = url.match(/[?&]query=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (queryMatch) {
    return { lat: parseFloat(queryMatch[1]), lng: parseFloat(queryMatch[2]) };
  }

  // 5. Format LL (LatLong): ll=lat,lng
  const llMatch = url.match(/[?&]ll=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (llMatch) {
    return { lat: parseFloat(llMatch[1]), lng: parseFloat(llMatch[2]) };
  }

  // 6. Format Place Path (Nama Tempat): /place/Nama+Tempat/@lat,lng
  // Ini paling sering terjadi di redirect mobile
  if (url.includes('/place/')) {
       // Cek apakah ada koordinat setelah @ (prioritas utama)
       const atInPlace = url.match(/\/place\/[^/]+\/@(-?\d+\.\d+),(-?\d+\.\d+)/);
       if (atInPlace) {
           return { lat: parseFloat(atInPlace[1]), lng: parseFloat(atInPlace[2]) };
       }
       
       // Cek format /place/lat,lng (jarang, tapi ada)
       const plainPlace = url.match(/\/place\/(-?\d+\.\d+),(-?\d+\.\d+)/);
       if (plainPlace) {
           return { lat: parseFloat(plainPlace[1]), lng: parseFloat(plainPlace[2]) };
       }
  }

  // 7. Format Directions: saddr=lat,lng or daddr=lat,lng
  const addrMatch = url.match(/[?&][sd]addr=(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (addrMatch) {
      return { lat: parseFloat(addrMatch[1]), lng: parseFloat(addrMatch[2]) };
  }

  // 8. Format Search: /search/lat,lng
  const searchMatch = url.match(/\/search\/(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (searchMatch) {
      return { lat: parseFloat(searchMatch[1]), lng: parseFloat(searchMatch[2]) };
  }
  
  // 9. Last Resort: Coba cari pola angka float berurutan di mana saja di URL (sangat loose)
  // Hanya gunakan jika url mengandung google maps
  if (url.includes('google') && url.includes('maps')) {
      // Cari pola !3d-6.123!4d106.123
      const protoMatch = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
      if (protoMatch) return { lat: parseFloat(protoMatch[1]), lng: parseFloat(protoMatch[2]) };
  }

  return null;
};

export const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
};

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export const expandShortUrl = async (url: string) => {
    // Gunakan server-side proxy untuk menghindari CORS dan mendapatkan lokasi redirect
    if (!projectId || !publicAnonKey) return url;

    try {
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-f781cd00/expand-url`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${publicAnonKey}`
            },
            body: JSON.stringify({ url })
        });

        if (!response.ok) {
            // console.warn("Failed to expand URL via server, returning original.");
            return url;
        }

        const data = await response.json();
        return data.expandedUrl || url;
    } catch (e) {
        // Silent fail for network errors to avoid console noise
        // console.warn("Error expanding URL:", e);
        return url;
    }
}
