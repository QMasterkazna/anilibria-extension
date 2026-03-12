// Hayase Anilibria Extension v1.4 — 2026, используем /anime/torrents + клиентский поиск

export default {
  async test() {
    try {
      const res = await fetch('https://anilibria.top/api/v1/anime/torrents');
      console.log('[Anilibria TEST] Status:', res.status);
      return res.ok;
    } catch (err) {
      console.error('[Anilibria TEST] Ошибка:', err.message);
      throw err;
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
    console.log('[Anilibria] Нет названий');
    return [];
  }

  console.log('[Anilibria] Названия из Hayase:', query.titles);
  console.log('[Anilibria] Эпизод:', query.episode ?? 'не указан');

  // Предпочитаем русское название
  const preferredTitle = query.titles.find(t => /[\u0400-\u04FFёЁ]/.test(t)) || query.titles[0] || '';
  const searchLower = preferredTitle.toLowerCase().trim();

  console.log('[Anilibria] Фильтруем по (русскому, lowercase):', searchLower);

  try {
    // Берём первую страницу (25 элементов) — для теста достаточно, можно потом пагинацию добавить
    const url = 'https://anilibria.top/api/v1/anime/torrents?page=1';
    const res = await fetch(url);

    if (!res.ok) {
      console.log('[Anilibria] Статус не OK:', res.status);
      return [];
    }

    const data = await res.json();
    console.log('[Anilibria] Получено элементов:', data?.data?.length || 0);

    if (!data?.data?.length) {
      console.log('[Anilibria] data пустая');
      return [];
    }

    const results = [];

    for (const item of data.data) {
      const release = item.release || {};
      const names = release.name || {};
      const mainName = (names.main || '').toLowerCase();
      const engName = (names.english || '').toLowerCase();
      const alias = (release.alias || '').toLowerCase();

      // Проверяем совпадение по названию или alias
      const matchesName = mainName.includes(searchLower) ||
                          engName.includes(searchLower) ||
                          alias.includes(searchLower.replace(/ /g, '-')) ||
                          searchLower.includes(alias);

      if (!matchesName) continue;

      console.log('[Anilibria] Совпадение:', mainName || engName || alias);

      const targetEp = Number(query.episode) || 1;
      const epDesc = item.description || ''; // "1-9" или "12"

      // Мягкая проверка эпизода
      const matchesEp = !query.episode ||
        epDesc.includes(targetEp.toString()) ||
        epDesc.includes(`-${targetEp}`) ||
        epDesc.includes(`${targetEp}-`) ||
        (isBatch && epDesc.includes('-') && epDesc.split('-').length > 1);

      if (matchesEp) {
        const magnet = item.magnet;
        const link = magnet || null; // torrent-файл не всегда есть, но magnet надёжнее

        if (!link) continue;

        results.push({
          title: `${names.main || names.english || release.alias || '—'} | ${item.quality?.value || '?'} | ${epDesc || item.series || '—'}`,
          link,
          id: item.id || item.hash,
          seeders: item.seeders || 0,
          leechers: item.leechers || 0,
          downloads: item.completed_times || 0,
          accuracy: 'medium',
          hash: item.hash,
          size: item.size || 0,
          date: item.created_at ? new Date(item.created_at) : null,
          type: isBatch ? 'batch' : ''
        });
      }
    }

    console.log('[Anilibria] Найдено подходящих торрентов:', results.length);
    return results;

  } catch (err) {
    console.error('[Anilibria] Ошибка:', err.name, err.message);
    return [];
  }
}