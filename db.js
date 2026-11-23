/* লোকাল ডেটা (অফলাইন)। প্রতিটি ব্যবহারকারীর ডেটা তার নিজের আইডির অধীনে আলাদা থাকে। */
const DB = {
  KEY: 'amar_poribar_v1',

  defaults() {
    return {
      users: [],          // {id, name, email, hash}
      session: null,      // {id, name, email}
      store: {},          // {userId: bucket}
      quoteIndex: -1,
      settings: { lang: 'bn', theme: 'light', animations: true, notifications: true, profileOpen: false }
    };
  },

  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return this.defaults();
      const d = JSON.parse(raw);
      const base = this.defaults();
      return Object.assign(base, d, { settings: Object.assign(base.settings, d.settings || {}) });
    } catch (e) {
      return this.defaults();
    }
  },

  save(d) {
    try { localStorage.setItem(this.KEY, JSON.stringify(d)); }
    catch (e) { console.warn('সংরক্ষণ ব্যর্থ', e); }
  },

  uid() {
    return (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  newBucket() {
    return {
      records: [],   // {id,type,amount,date,category,account,member,note,createdAt,updatedAt}
      budgets: [],   // {id,name,amount,from,to,category}
      members: [],   // {id,name,relation}
      loans: [],     // {id,type,name,amount,date,due,note,paid}
      accounts: [
        { id: 'cash', builtin: true }, { id: 'bkash', builtin: true }, { id: 'nagad', builtin: true },
        { id: 'rocket', builtin: true }, { id: 'bank', builtin: true }
      ],               // কাস্টম অ্যাকাউন্টে {id,name,opening}
      cats: {
        income: ['sal', 'biz', 'bonus', 'oth_inc'],
        expense: ['market', 'rent', 'transport', 'food', 'medical', 'edu', 'electricity', 'mobile', 'oth_exp'],
        savings: ['sv_future', 'sv_medical', 'sv_edu', 'sv_home', 'sv_emergency']
      }
    };
  }
};
