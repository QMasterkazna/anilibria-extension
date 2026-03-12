// == Hayase Anilibria Extension ==
// Версия: 1.0.0

export default {
  async test() {
    try {
      const res = await fetch('https://api.anilibria.tv/v3/title/random');
      return res.ok;
    } catch (err) {
      throw new Error('Не удалось подключиться к Anilibria API. Проверь интернет или попробуй позже.');
    }
  },

  async single(query, options) {
    return await searchTorrents(query, false);
  },

  async batch(query, options) {
    return await searchTorrents(query, true);
  },

  async movie(query, options) {
    return await searchTorrents(query, false);
  },

  // Для NZB не нужно
  async query() {
    return undefined;
  }
};

async function searchTorrents(query, isBatch) {
  const fetch = query.fetch; // обязательный fetch от Hayase (CORS)

  // Берём первое название (обычно самое точное)
  let searchTerm = query.titles[0] || '';
  if (!searchTerm) return [];

  try {
    // Ищем тайтл
    const searchRes = await fetch(
      `https://api.anilibria.tv/v3/title/search?search=${encodeURIComponent(searchTerm)}&limit=5&filter=id,names,torrents`
    );
    const data = await searchRes.json();

    if (!data || !data.list || data.list.length === 0) {
      return [];
    }

    // Берём самый подходящий тайтл (по совпадению названий)
    let anime = data.list[0];
    for (const item of data.list) {
      const ruName = item.names?.ru || '';
      const enName = item.names?.en || '';
      if (query.titles.some(t => ruName.includes(t) || enName.includes(t))) {
        anime = item;
        break;
      }
    }

    const torrentsList = anime.torrents?.list || [];
    const results = [];
    const targetEp = query.episode || 1;

    for (const tor of torrentsList) {
      const eps = tor.episodes || {};
      const epString = eps.string || '';

      // Проверяем, подходит ли эпизод (для single/batch/movie)
      const matchesEpisode = !isBatch
        ? (eps.first <= targetEp && targetEp <= eps.last) || epString.includes(targetEp)
        : (eps.first !== eps.last); // batch — только многоэпизодные

      if (matchesEpisode) {
        const link = tor.magnet || `https://api.anilibria.tv${tor.url}`;

        results.push({
          title: `${anime.names.ru || anime.names.en} — ${tor.quality?.string || ''} ${epString}`,
          link: link,
          id: tor.torrent_id,
          seeders: tor.seeders || 0,
          leechers: tor.leechers || 0,
          downloads: tor.downloads || 0,
          accuracy: 'medium',
          hash: tor.hash,
          size: tor.total_size || 0,
          date: new Date((tor.uploaded_timestamp || 0) * 1000),
          type: isBatch ? 'batch' : ''
        });
      }
    }

    return results;
  } catch (err) {
    throw new Error(`Ошибка поиска в Anilibria: ${err.message}. Возможно, тайтл не найден или API недоступен.`);
  }
}