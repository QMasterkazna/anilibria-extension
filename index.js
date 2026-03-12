// Hayase Anilibria Extension v1.2 — 2026, новая API база anilibria.top/v1

export default {
  async test() {
    try {
      const res = await fetch('https://api.anilibria.top/v1/title/random');
      return res.ok;
    } catch (err) {
      throw new Error('Anilibria API недоступен (проверь https://api.anilibria.top/v1)');
    }
  },

  async single(query) { return await searchTorrents(query, false); },
  async batch(query)  { return await searchTorrents(query, true);  },
  async movie(query)  { return await searchTorrents(query, false); },

  async query() { return undefined; }
};

async function searchTorrents(query, isBatch = false) {
  const fetch = query.fetch;

  if (!query.titles?.length) {
    console.log('[Anilibria] Нет названий для поиска');
    return [];
  }

  console.log('[Anilibria v1] Названия из Hayase:', query.titles);
  console.log('[Anilibria v1] Эпизод:', query.episode ?? 'не указан');

  // Русские названия первыми, потом все остальные
  const candidates = [
    ...query.titles.filter(t => /[\u0400-\u04FFёЁ]/.test(t)),
    ...query.titles
  ];

  let foundAnime = null;
  let usedTerm = '';

  for (const term of candidates) {
    if (!term?.trim()) continue;

    console.log('[Anilibria v1] Поиск по термину:', term);

    try {
      const url = `https://api.anilibria.top/v1/title/search?search=${encodeURIComponent(term)}&limit=5`;
      const res = await fetch(url);

      if (!res.ok) {
        console.log('[Anilibria v1] Ответ не OK:', res.status, await res.text().catch(() => ''));
        continue;
      }

      const data = await res.json();

      if (data?.list?.length > 0) {
        foundAnime = data.list[0];
        usedTerm = term;
        console.log('[Anilibria v1] Нашёл тайтл:', foundAnime?.names?.ru || foundAnime?.names?.en || foundAnime?.code);
        break;
      }
    } catch (err) {
      console.log('[Anilibria v1] Ошибка поиска по "' + term + '":', err.message);
    }
  }

  // Если ничего — fallback на первое слово
  if (!foundAnime && query.titles[0]) {
    const fbTerm = query.titles[0].split(/[ ,:;()]+/)[0];
    console.log('[Anilibria v1] Fallback по слову:', fbTerm);
    try {
      const res = await fetch(`https://api.anilibria.top/v1/title/search?search=${encodeURIComponent(fbTerm)}&limit=3`);
      const data = await res.json();
      if (data?.list?.length) {
        foundAnime = data.list[0];
        usedTerm = fbTerm;
      }
    } catch {}
  }

  if (!foundAnime || !foundAnime.torrents?.list?.length) {
    console.log('[Anilibria v1] Торренты не найдены для тайтла', foundAnime?.code || '—');
    return [];
  }

  const results = [];
  const targetEp = Number(query.episode) || 1;

  for (const tor of foundAnime.torrents.list || []) {
    // Поля могут быть series / episodes / string / range — берём что есть
    const epInfo = tor.series || tor.episodes?.string || tor.episodes_range || '';
    const epFrom = tor.episodes?.first ?? 0;
    const epTo   = tor.episodes?.last ?? epFrom;

    const matchesEp = !query.episode || 
      (targetEp >= epFrom && targetEp <= epTo) ||
      epInfo.includes(targetEp.toString()) ||
      epInfo.includes(` ${targetEp} `) ||
      epInfo.includes(`[${targetEp}]`) ||
      (isBatch && (epTo > epFrom + 1 || epInfo.includes('-') || epInfo.includes('–')));

    if (matchesEp) {
      const link = tor.magnet || (tor.url ? `https://api.anilibria.top${tor.url}` : null);

      if (link) {
        results.push({
          title: `${foundAnime.names?.ru || foundAnime.names?.en || foundAnime.code} | ${tor.quality?.string || tor.quality || '?'} | ${epInfo || tor.series || tor.episodes?.string || '—'}`,
          link,
          id: tor.id || tor.hash || tor.torrent_id,
          seeders: tor.seeders || 0,
          leechers: tor.leechers || 0,
          downloads: tor.downloads || 0,
          accuracy: 'medium',
          hash: tor.hash,
          size: tor.total_size || tor.size || 0,
          date: tor.time ? new Date(tor.time * 1000) : null,
          type: isBatch ? 'batch' : ''
        });
      }
    }
  }

  console.log('[Anilibria v1] Результатов:', results.length);
  return results;
}