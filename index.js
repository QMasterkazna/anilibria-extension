// Hayase Anilibria Extension v1.1 (улучшенный поиск)
// 2026 версия — поиск по всем названиям + русский приоритет

export default {
  async test() {
    try {
      const res = await fetch('https://api.anilibria.tv/v3/title/random');
      return res.ok;
    } catch (err) {
      throw new Error('Не удалось подключиться к Anilibria API');
    }
  },

  async single(query) { return await searchTorrents(query, false); },
  async batch(query)  { return await searchTorrents(query, true);  },
  async movie(query)  { return await searchTorrents(query, false); },

  async query() { return undefined; }
};

async function searchTorrents(query, isBatch = false) {
  const fetch = query.fetch;

  if (!query.titles || query.titles.length === 0) {
    console.log('[Anilibria] Нет названий в query');
    return [];
  }

  console.log('[Anilibria] Полученные названия:', query.titles);
  console.log('[Anilibria] Ищем эпизод:', query.episode || 'не указан');

  // Пробуем все названия по очереди, приоритет — с кириллицей
  const titleCandidates = [
    ...query.titles.filter(t => /[\u0400-\u04FF]/.test(t)), // русские первыми
    ...query.titles
  ];

  let anime = null;
  let usedSearchTerm = '';

  for (const term of titleCandidates) {
    if (!term.trim()) continue;

    try {
      console.log('[Anilibria] Пробуем поиск по:', term);

      const res = await fetch(
        `https://api.anilibria.tv/v3/title/search?search=${encodeURIComponent(term)}&limit=6&filter=id,names,code,player,torrents`
      );

      if (!res.ok) continue;

      const data = await res.json();
      if (!data?.list?.length) continue;

      // Берём первый подходящий тайтл
      anime = data.list[0];
      usedSearchTerm = term;
      console.log('[Anilibria] Нашёл тайтл:', anime.names?.ru || anime.names?.en || anime.code);
      break;
    } catch (e) {
      console.log('[Anilibria] Ошибка при поиске по "' + term + '":', e.message);
    }
  }

  // Последний fallback — если ничего не нашлось, берём первое слово из первого названия
  if (!anime && query.titles[0]) {
    const fallbackTerm = query.titles[0].split(' ')[0];
    console.log('[Anilibria] Fallback поиск по:', fallbackTerm);

    try {
      const res = await fetch(
        `https://api.anilibria.tv/v3/title/search?search=${encodeURIComponent(fallbackTerm)}&limit=3&filter=id,names,code,torrents`
      );
      const data = await res.json();
      if (data?.list?.length) {
        anime = data.list[0];
        usedSearchTerm = fallbackTerm;
      }
    } catch {}
  }

  if (!anime || !anime.torrents?.list?.length) {
    console.log('[Anilibria] Не нашёл тайтл или торренты');
    return [];
  }

  const results = [];
  const targetEp = query.episode || 1;

  for (const tor of anime.torrents.list) {
    const eps = tor.episodes || {};
    const epFrom = eps.first ?? 0;
    const epTo   = eps.last  ?? epFrom;
    const epStr  = eps.string || '';

    // Более мягкая проверка эпизода
    const matches = 
      (targetEp >= epFrom && targetEp <= epTo) ||
      epStr.includes(targetEp.toString()) ||
      epStr.includes(`${targetEp}`) ||
      (isBatch && (epTo - epFrom > 1 || epStr.includes('-')));

    if (matches || !query.episode) {  // если эпизод не указан — берём все
      const magnet = tor.magnet;
      const torrentUrl = tor.url ? `https://api.anilibria.tv${tor.url}` : null;
      const link = magnet || torrentUrl;

      if (!link) continue;

      results.push({
        title: `${anime.names?.ru || anime.names?.en || anime.code} | ${tor.quality?.string || 'unknown'} | ${epStr || tor.series || '—'}`,
        link: link,
        id: tor.torrent_id || tor.hash,
        seeders: tor.seeders || 0,
        leechers: tor.leechers || 0,
        downloads: tor.downloads || 0,
        accuracy: 'medium',
        hash: tor.hash,
        size: tor.total_size || tor.size_bytes || 0,
        date: tor.uploaded_timestamp ? new Date(tor.uploaded_timestamp * 1000) : null,
        type: isBatch ? 'batch' : ''
      });
    }
  }

  console.log('[Anilibria] Найдено торрентов:', results.length);
  return results;
}