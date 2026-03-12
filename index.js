// Hayase Anilibria Extension v2.3 — поиск релиза → торренты по /release/{id}

export default {
  async test() {
    try {
      const res = await fetch('https://anilibria.top/api/v1/app/search/releases?query=test');
      return res.ok;
    } catch {
      return false;
    }
  },

  async single(query) { return await searchTorrents(query, false); },
  async batch(query)  { return await searchTorrents(query, true); },
  async movie(query)  { return await searchTorrents(query, false); },

  async query() { return undefined; }
};

async function searchTorrents(query, isBatch = false) {
  const fetch = query.fetch;

  if (!query.titles?.length) {
    console.log('[Anilibria] Нет названий для поиска');
    return [];
  }

  console.log('[Anilibria] Названия из Hayase:', query.titles);
  console.log('[Anilibria] Эпизод:', query.episode ?? 'не указан');

  // Предпочитаем русское название → английское/ромадзи
  const candidates = [
    ...query.titles.filter(t => /[\u0400-\u04FFёЁ]/.test(t)),
    ...query.titles
  ];

  let releaseId = null;
  let releaseName = '';
  let releaseAlias = '';

  // Ищем релиз по одному из названий
  for (const term of candidates) {
    if (!term?.trim()) continue;

    const clean = term.trim().replace(/[:?!\.,]/g, '');
    console.log('[Anilibria] Пробуем поиск релиза по:', clean);

    try {
      const url = `https://anilibria.top/api/v1/app/search/releases?query=${encodeURIComponent(clean)}`;
      const res = await fetch(url);
      if (!res.ok) continue;

      const data = await res.json();
      if (data?.length > 0) {
        const rel = data[0];
        releaseId = rel.id;
        releaseName = rel.name?.main || rel.name?.english || rel.alias || clean;
        releaseAlias = rel.alias || '';
        console.log('[Anilibria] Нашёл релиз → id:', releaseId, 'alias:', releaseAlias, 'name:', releaseName);
        break;
      }
    } catch (err) {
      console.log('[Anilibria] Ошибка при поиске по "' + clean + '":', err.message);
    }
  }

  if (!releaseId) {
    console.log('[Anilibria] Ни один релиз не найден');
    return [];
  }

  // Получаем торренты именно этого релиза
  const results = [];

  try {
    const torrentsUrl = `https://anilibria.top/api/v1/anime/torrents/release/${releaseId}`;
    const res = await fetch(torrentsUrl);
    if (!res.ok) {
      console.log('[Anilibria] Торренты не получены, статус:', res.status);
      return [];
    }

    const torrentsData = await res.json();
    const torrents = torrentsData || [];  // массив объектов

    console.log('[Anilibria] Получено торрентов для релиза:', torrents.length);

    const targetEp = Number(query.episode) || 1;

    for (const tor of torrents) {
      const epDesc = tor.description || tor.series || '—';

      // Проверка эпизода (мягкая)
      let matchesEp = !query.episode; // если эпизод не указан — берём все
      if (query.episode) {
        if (epDesc.includes(targetEp.toString()) ||
            epDesc.includes(`-${targetEp}`) ||
            epDesc.includes(`${targetEp}-`) ||
            epDesc.includes(`[${targetEp}]`)) {
          matchesEp = true;
        } else if (epDesc.includes('-')) {
          const [start, end] = epDesc.split('-').map(n => parseInt(n.trim(), 10));
          if (!isNaN(start) && !isNaN(end) && targetEp >= start && targetEp <= end) {
            matchesEp = true;
          }
        }
      }

      if (matchesEp) {
        const magnet = tor.magnet;
        if (!magnet || !magnet.startsWith('magnet:?')) continue;

        results.push({
          title: `${releaseName} | ${tor.quality?.value || tor.type?.description || '?'} | ${epDesc} (seeders: ${tor.seeders || 0})`,
          link: magnet,
          id: tor.id || tor.hash,
          seeders: tor.seeders || 0,
          leechers: tor.leechers || 0,
          downloads: tor.completed_times || 0,
          accuracy: 'high',
          hash: tor.hash,
          size: tor.size || 0,
          date: tor.created_at ? new Date(tor.created_at) : null,
          type: isBatch ? 'batch' : ''
        });
      }
    }
  } catch (err) {
    console.error('[Anilibria] Ошибка при получении торрентов по id:', err.message);
  }

  // Сортировка по seeders descending
  results.sort((a, b) => b.seeders - a.seeders);

  console.log('[Anilibria] Итого подходящих торрентов:', results.length);
  if (results.length > 0) {
    console.log('[Anilibria] Список:\n' + results.map(r => r.title).join('\n'));
  }

  return results;
}