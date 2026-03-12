const API = "https://api.anilibria.top/v1";
const BASE_VIDEO = "https://cache.libria.fun";

async function search(query) {
    const res = await fetch(`${API}/catalog?search=${encodeURIComponent(query)}`);
    const data = await res.json();

    if (!data.items) return [];

    return data.items.map(a => ({
        id: a.id,
        title: a.names.ru || a.names.en || "Unknown",
        image: a.poster?.original || "",
        description: a.description || ""
    }));
}

async function details(id) {
    const res = await fetch(`${API}/anime/${id}`);
    const data = await res.json();

    return {
        id: data.id,
        title: data.names.ru || data.names.en || "Unknown",
        image: data.poster?.original || "",
        description: data.description || "",
        status: data.status
    };
}

async function episodes(id) {
    const res = await fetch(`${API}/anime/${id}`);
    const data = await res.json();

    if (!data.player?.list) return [];

    const eps = [];
    for (const epNum in data.player.list) {
        eps.push({
            id: `${id}_${epNum}`,
            title: `Episode ${epNum}`,
            number: parseInt(epNum)
        });
    }

    return eps.sort((a, b) => a.number - b.number);
}

async function stream(epId) {
    const [id, epNum] = epId.split("_");

    const res = await fetch(`${API}/anime/${id}`);
    const data = await res.json();

    if (!data.player?.list || !data.player.list[epNum]) return [];

    const file = data.player.list[epNum];
    const url = file.hls?.startsWith("http") ? file.hls : `${BASE_VIDEO}${file.hls}`;

    return [{
        quality: file.resolution || "720p",
        url
    }];
}

module.exports = {
    search,
    details,
    episodes,
    stream
};