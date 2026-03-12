export default {
  async test() {
    console.log('[Anilibria TEST] Extension loaded successfully');
    return true;
  },

  async single() { console.log('[Anilibria] single called'); return []; },
  async batch()  { return []; },
  async movie()  { return []; },
  async query() { return undefined; }
};