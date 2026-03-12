// Hayase Anilibria Extension v2.6 — максимально простой и логированный вариант

export default {
  async test() {
    try {
      const res = await fetch('https://anilibria.top/api/v1/app/search/releases?query=test');
      console.log('[Anilibria TEST] Тест API:', res.status, res.ok ? 'OK' : 'FAIL');
      return res.ok;
    } catch (err) {
      console.error('[Anilibria TEST] Ошибка теста:', err.message);
      return false;
    }
  },

  async single(query) { 
    console.log('[Anilibria] single вызван');
    return await searchTorrents(query, false); 
  },
  async batch(query)  { return await searchTorrents(query, true);  },
  async movie(query)  { return await searchTorrents(query, false); },

  async query() { return undefined; }
};

async function searchTorrents(query, isBatch = false) {
  const fetch = query.fetch;

  if (!query.titles?.length) {
    console.log('[Anilibria] Нет названий в query');
    return [];
  }

  console.log('[Anilibria] Полученные названия:', query.titles);
  console.log('[Anilibria] Запрашиваемый эпизод:', query.episode ?? 'любой');

  // Кандидаты поиска
  const candidates = [
    ...query.titles,
    'Клинок, рассекающий демонов', 'Kimetsu no Yaiba' // принудительный fallback
  ];

  let releaseId = null;
  let releaseName = 'Неизвестно';

  // Поиск релиза
  for (const term of candidates) {
    if (!term?.trim()) continue;

    const cleanTerm = term.trim().replace(/[:?!\.,]/g, '');
    console.log('[Anilibria] Пробуем поиск релиза по:', cleanTerm);

    try {
      const url = `https://anilibria.top/api/v1/app/search/releases?query=${encodeURIComponent(cleanTerm)}`;
      const res = await fetch(url);

      console.log('[Anilibria] Статус поиска:', res.status);

      if (!res.ok) continue;

      const data = await res.json();
      console.log('[Anilibria] Результат поиска (длина):', data?.length ?? 0);

      if (data?.length > 0) {
        const rel = data[0];
        releaseId = rel.id;
        releaseName = rel.name?.main || rel.name?.english || rel.alias || cleanTerm;
        console.log('[Anilibria] Успех! Нашёл релиз ID:', releaseId, 'Название:', releaseName);
        break;
      }
    } catch (err) {
      console.error('[Anilibria] Ошибка поиска по "' + cleanTerm + '":', err.message);
    }
  }

  if (!releaseId) {
    console.log('[Anilibria] Не удалось найти релиз ни по одному названию');
    return [];
  }

  // Получаем торренты
  const results = [];

  try {
    const url = `https://anilibria.top/api/v1/anime/torrents/release/${releaseId}`;
    console.log('[Anilibria] Запрос торрентов по ID:', releaseId);

    const res = await fetch(url);
    console.log('[Anilibria] Статус торрентов:', res.status);

    if (!res.ok) {
      console.log('[Anilibria] Торренты не получены (статус не 200)');
      return [];
    }

    const torrents = await res.json() || [];
    console.log('[Anilibria] Получено торрентов:', torrents.length);

    for (const tor of torrents) {
      const epDesc = tor.description || tor.series || '—';
      const magnet = tor.magnet;

      if (!magnet || !magnet.startsWith('magnet:?')) {
        console.log('[Anilibria] Пропущен торрент без magnet:', epDesc);
        continue;
      }

      results.push({
        title: `${releaseName} | ${tor.quality?.value || 'Неизвестно'} | ${epDesc} (seeders: ${tor.seeders || 0})`,
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
  } catch (err) {
    console.error('[Anilibria] Ошибка при получении торрентов:', err.message);
  }

  console.log('[Anilibria] Итого найдено торрентов:', results.length);
  if (results.length > 0) {
    console.log('[Anilibria] Список торрентов:\n' + results.map(r => r.title).join('\n'));
  } else {
    console.log('[Anilibria] Торренты найдены, но не прошли фильтр (проверь magnet или пустой массив)');
  }

  return results;
}