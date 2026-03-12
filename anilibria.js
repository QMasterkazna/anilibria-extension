// anilibria-hayase-extension.js
// Версия: 2026-03
// Hayase extension для Anilibria.tv (прямые ссылки без торрентов)

const BASE_URL = "https://api.anilibria.tv/v1";
const PLAYER_BASE = "https://vk.com/video_ext.php?oid=-"; // часто используется, но лучше брать из API

export default {
  name: "Anilibria",
  description: "Прямой просмотр аниме с Anilibria.tv через официальное API",
  version: "1.0.1",
  author: "anonymous helper",
  icon: "https://anilibria.tv/favicon.ico",
  language: "ru",
  nsfw: false,

  // Поиск аниме
  async search(query, page = 1) {
    try {
      const limit = 20;
      const offset = (page - 1) * limit;

      const params = new URLSearchParams({
        search: query,
        limit,
        offset,
        include: "names,description,player,playlist",
      });

      const res = await fetch(`${BASE_URL}/title?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      return {
        results: data.list.map(item => ({
          id: item.id.toString(),
          title: item.names?.ru || item.names?.en || "Без названия",
          altTitles: [
            item.names?.en,
            item.names?.alternative,
            item.names?.pretty
          ].filter(Boolean),
          poster: item.player?.playlist?.[0]?.preview || item.player?.playlist?.[0]?.screenshot || "",
          type: item.type?.full_string || item.type?.code || "TV",
          year: item.year || null,
          status: item.status?.string || null,
          episodes: item.player?.playlist?.length || item.player?.series?.length || 0,
          description: item.description || "",
          genres: item.genres || [],
          rating: item.favorite?.rating || null,
          url: `https://anilibria.tv/release/${item.code}.html`,
        })),
        hasMore: data.pagination?.has_next || data.list.length === limit,
      };
    } catch (e) {
      console.error("Anilibria search error:", e);
      return { results: [], hasMore: false, error: e.message };
    }
  },

  // Получить полную информацию об аниме
  async getAnimeInfo(id) {
    try {
      const res = await fetch(`${BASE_URL}/title?id=${id}&include=playlist,player,names,description,genres,year,status`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const title = data.list?.[0] || data;

      if (!title?.id) throw new Error("Аниме не найдено");

      const episodes = (title.player?.playlist || []).map((ep, index) => {
        const epNum = ep.episode || (index + 1);
        return {
          id: `${title.id}-${epNum}`,
          number: epNum,
          title: ep.episode_name || `Серия ${epNum}`,
          url: null, // заполним в getEpisodeSources
          preview: ep.preview || ep.screenshot || title.player?.playlist?.[0]?.preview,
        };
      });

      return {
        id: title.id.toString(),
        title: title.names?.ru || title.names?.en || "Без названия",
        poster: title.player?.playlist?.[0]?.preview || "",
        banner: title.player?.playlist?.[0]?.screenshot || "",
        description: title.description || "Описание отсутствует",
        year: title.year,
        type: title.type?.full_string || title.type?.code,
        status: title.status?.string || title.status?.code,
        episodesCount: episodes.length,
        episodes,
        genres: title.genres || [],
        voices: title.player?.playlist?.[0]?.host ? [title.player.playlist[0].host] : [],
        url: `https://anilibria.tv/release/${title.code}.html`,
      };
    } catch (e) {
      console.error("Anilibria getInfo error:", e);
      return { error: e.message };
    }
  },

  // Получить источники для серии (видеопоток)
  async getEpisodeSources(animeId, episodeId) {
    try {
      // episodeId обычно в формате "animeId-epNumber"
      const [, episodeNum] = episodeId.split("-").map(Number);
      if (!episodeNum) throw new Error("Неверный episodeId");

      const res = await fetch(`${BASE_URL}/title?id=${animeId}&include=playlist`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const title = data.list?.[0] || data;

      const playlist = title.player?.playlist || [];
      const episode = playlist.find(ep => 
        Number(ep.episode) === episodeNum ||
        ep.episode === episodeNum.toString()
      );

      if (!episode) throw new Error(`Серия ${episodeNum} не найдена`);

      // Anilibria отдаёт разные качества в объекте series
      const sources = [];

      // Самое частое — это hls в playlist или series
      if (episode.hls) {
        sources.push({
          url: episode.hls,
          quality: "Auto (HLS)",
          type: "hls",
          isM3U8: true,
        });
      }

      // Прямые mp4 ссылки по качеству
      ["fhd", "hd", "sd", "fullhd"].forEach(q => {
        if (episode.series?.[q]) {
          sources.push({
            url: episode.series[q],
            quality: q.toUpperCase(),
            type: "mp4",
          });
        }
      });

      // Если ничего нет — берём самый первый доступный файл
      if (sources.length === 0 && episode.url) {
        sources.push({
          url: episode.url,
          quality: "Auto",
          type: episode.url.includes(".m3u8") ? "hls" : "mp4",
        });
      }

      if (sources.length === 0) {
        throw new Error("Не удалось найти видеопоток");
      }

      return {
        sources,
        subtitles: [], // Anilibria обычно вшивает субтитры
        intro: null,
        preferred: 0, // можно выбрать лучший по качеству
      };
    } catch (e) {
      console.error("Anilibria sources error:", e);
      return { sources: [], error: e.message };
    }
  },

  // Опционально — можно добавить getPopular, getLatest и т.д.
  async getPopular(page = 1) {
    // Можно использовать /title?sort=1 (популярность) или /title/random
    // Для простоты оставим заглушку
    return { results: [], hasMore: false };
  },

  // Hayase может ожидать этот метод
  async getLatest() {
    return this.getPopular();
  }
};