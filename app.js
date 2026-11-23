(function () {
  'use strict';

  /* ---------- অবস্থা ও ছোট সহায়ক ---------- */
  const S = { data: DB.load(), view: 'home', params: {}, filter: 'all', period: 'monthly', authMode: 'login' };

  const L = () => S.data.settings.lang;
  const t = k => { const x = T[k]; return x ? (x[L()] || x.en) : k; };
  const tf = (k, v) => t(k).replace(/\{(\w+)\}/g, (_, x) => v[x]);
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dg = s => L() === 'bn' ? String(s).replace(/\d/g, d => '০১২৩৪৫৬৭৮৯'[d]) : String(s);
  const money = n => '৳ ' + dg(Math.round(Number(n) || 0).toLocaleString('en-US'));
  const pct = n => dg(Math.round(n)) + '%';
  const persist = () => DB.save(S.data);
  const U = () => S.data.store[S.data.session.id];

  const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const today = () => iso(new Date());
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };
  const monthEnd = s => iso(new Date(+s.slice(0, 4), +s.slice(5, 7), 0));
  const fmtDate = s => { const [y, m, d] = s.split('-'); return dg(`${d}/${m}/${y}`); };

  const catName = k => T['cat_' + k] ? t('cat_' + k) : k;
  const accName = a => a.builtin ? t('acc_' + a.id) : a.name;
  const accById = id => U().accounts.find(a => a.id === id);
  const accLabel = id => { const a = accById(id); return a ? accName(a) : ''; };
  const memById = id => U().members.find(m => m.id === id);
  const memName = id => { const m = memById(id); return m ? m.name : ''; };

  const recs = (type, from, to) => U().records.filter(r => r.type === type && (!from || r.date >= from) && (!to || r.date <= to));
  const sumOf = (type, from, to, cat) => recs(type, from, to).filter(r => !cat || r.category === cat).reduce((a, r) => a + Number(r.amount), 0);
  const accBal = a => (a.opening || 0) + U().records.filter(r => r.account === a.id)
    .reduce((s, r) => s + (r.type === 'income' ? Number(r.amount) : -Number(r.amount)), 0);

  function rangeOf(p) {
    const n = today();
    if (p === 'daily') return [n, n];
    if (p === 'weekly') return [addDays(n, -6), n];
    if (p === 'yearly') return [n.slice(0, 4) + '-01-01', n];
    return [n.slice(0, 8) + '01', n];
  }

  function buckets(p) {
    const n = today(), out = [];
    if (p === 'daily') return [{ l: fmtDate(n), f: n, t: n }];
    if (p === 'weekly') {
      for (let i = 6; i >= 0; i--) { const d = addDays(n, -i); out.push({ l: dg(d.slice(8)), f: d, t: d }); }
      return out;
    }
    if (p === 'monthly') {
      const y = n.slice(0, 4), m = n.slice(5, 7), last = +n.slice(8);
      for (let d = 1; d <= last; d++) {
        const s = `${y}-${m}-${String(d).padStart(2, '0')}`;
        out.push({ l: dg(d), f: s, t: s });
      }
      return out;
    }
    const y = n.slice(0, 4), cm = +n.slice(5, 7);
    for (let m = 1; m <= cm; m++) {
      const mm = String(m).padStart(2, '0');
      const f = `${y}-${mm}-01`, end = monthEnd(f);
      out.push({ l: dg(m), f, t: end < n ? end : n });
    }
    return out;
  }

  function budgetMsg(p) {
    if (p >= 100) return t('over');
    if (p >= 90) return t('warn90');
    if (p >= 75) return t('warn75');
    if (p >= 50) return t('warn50');
    return '';
  }

  function alerts() {
    if (!S.data.settings.notifications || !S.data.session) return [];
    return U().budgets.map(b => {
      const sp = sumOf('expense', b.from, b.to, b.category);
      const p = b.amount ? sp / b.amount * 100 : 0;
      const msg = budgetMsg(p);
      return msg ? { name: b.name, text: `${b.name}: ${msg}` } : null;
    }).filter(Boolean);
  }

  /* ---------- ওভারলে, টোস্ট, সেটিংস প্রয়োগ ---------- */
  function openOverlay(html) { $('#overlay-box').innerHTML = html; $('#overlay').classList.remove('hidden'); }
  function closeOverlay() { $('#overlay').classList.add('hidden'); }

  let toastTimer;
  function toast(msg, kind) {
    const el = $('#toast');
    el.textContent = msg;
    el.className = 'toast' + (kind === 'err' ? ' err' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.add('hidden'), 2200);
  }

  function applySettings() {
    const s = S.data.settings;
    document.documentElement.classList.toggle('dark', s.theme === 'dark');
    document.documentElement.lang = L() === 'bn' ? 'bn' : 'en';
    document.body.classList.toggle('no-anim', !s.animations);
  }

  function splashText() {
    $('#splash-name').textContent = t('appName');
    $('#splash-tag').textContent = t('tagline');
  }

  /* ---------- নেভিগেশন ---------- */
  function go(view, params) {
    S.view = view;
    S.params = params || {};
    closeOverlay();
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    applySettings();
    splashText();
    const views = { home: viewHome, details: viewDetails, budget: viewBudget, report: viewReport, family: viewFamily,
      other: viewOther, notifications: viewNotif, settings: viewSettings, form: viewForm, welcome: viewWelcome, auth: viewAuth };
    $('#main').innerHTML = (views[S.view] || viewHome)();
    renderNav();
  }

  function renderNav() {
    const nav = $('#bottomnav');
    const show = !!S.data.session && !['welcome', 'auth'].includes(S.view);
    nav.classList.toggle('hidden', !show);
    if (!show) { nav.innerHTML = ''; return; }
    const n = alerts().length;
    const item = (id, ico, label, badge) =>
      `<button class="${S.view === id ? 'active' : ''}" data-act="go" data-to="${id}"><span>${ico}</span><small>${t(label)}</small>${badge ? `<i class="badge">${dg(badge)}</i>` : ''}</button>`;
    nav.innerHTML = item('home', '🏠', 'navHome') + item('report', '📊', 'navReport')
      + `<button class="fab" data-act="addmenu" aria-label="add">+</button>`
      + item('notifications', '🔔', 'navNotif', n) + item('settings', '👤', 'navProfile');
  }

  function head(title) {
    return `<div class="page-head"><button class="icon-btn" data-act="go" data-to="home">←</button><h2>${title}</h2></div>`;
  }

  /* ---------- ড্যাশবোর্ড ---------- */
  function viewHome() {
    const n = today(), f30 = addDays(n, -29);
    const inc = [], exp = [];
    for (let i = 0; i < 30; i++) {
      const d = addDays(f30, i);
      inc.push(sumOf('income', d, d));
      exp.push(sumOf('expense', d, d));
    }
    const incAll = sumOf('income'), expAll = sumOf('expense'), savAll = sumOf('savings');
    const inc30 = sumOf('income', f30, n), sav30 = sumOf('savings', f30, n);
    const rate = inc30 ? sav30 / inc30 * 100 : 0;

    const mem = U().members;
    const shown = mem.length > 4 ? mem.slice(0, 2) : mem;
    const more = mem.length > 4 ? mem.length - 2 : 0;
    const avatars = shown.map(m => `<span class="av">${esc(m.name.charAt(0))}</span>`).join('')
      + (more ? `<span class="av more">+${dg(more)}</span>` : '');

    const stat = (cls, label, val) => `<div class="stat ${cls}"><small>${t(label)}</small><b>${money(val)}</b><span class="sub">${t('allTime')}</span></div>`;

    const max = Math.max(1, ...inc, ...exp);
    const W = 320, H = 130, P = 8;
    const x = i => P + i * (W - 2 * P) / 29;
    const y = v => H - P - (v / max) * (H - 2 * P);
    const pts = a => a.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const chart = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><polyline class="line-inc" points="${pts(inc)}"/><polyline class="line-exp" points="${pts(exp)}"/></svg>`;

    const tiles = [
      ['income', '💰', 'tIncome', 'income', 'form'],
      ['expense', '🛒', 'tExpense', 'expense', 'form'],
      ['savings', '🏦', 'tSavings', 'savings', 'form'],
      ['details', '📋', 'tDetails', null, 'details'],
      ['budget', '🧮', 'tBudget', null, 'budget'],
      ['report', '📊', 'tReport', null, 'report'],
      ['family', '👨‍👩‍👧', 'tFamily', null, 'family'],
      ['other', '⚙️', 'tOther', null, 'other']
    ].map(([img, emo, key, type, to]) =>
      `<button class="tile" data-act="go" data-to="${to}" ${type ? `data-type="${type}"` : ''}>
        <div class="tile-art"><span>${emo}</span><img src="assets/tiles/${img}.png" alt="" onerror="this.remove()"></div>
        <b>${t(key)}</b></button>`).join('');

    return `<section class="page">
      <div class="hero">
        <div><p>${esc(t('homeSub'))}</p><h2>${tf('welcomeHi', { name: esc(S.data.session.name) })}</h2>
          <div class="family">${avatars}<small>${dg(mem.length)} ${t('memberCount')}</small></div></div>
        <div class="hero-art">👨‍👩‍👧‍👦</div>
      </div>
      <div class="stats">
        ${stat('c-bal', 'balance', incAll - expAll)}
        ${stat('c-inc', 'totalIncome', incAll)}
        ${stat('c-exp', 'totalExpense', expAll)}
        ${stat('c-sav', 'totalSavings', savAll)}
      </div>
      <div class="card">
        <div class="legend"><b>${t('last30')}</b></div>
        <div class="legend"><span><i class="dot g"></i>${t('income')}</span><span><i class="dot r"></i>${t('expense')}</span></div>
        <div class="chart-wrap">${chart}
          <div class="rate"><small>${t('savingRate')}</small><b>${pct(rate)}</b></div>
        </div>
      </div>
      <div class="tiles">${tiles}</div>
    </section>`;
  }

  /* ---------- ফর্ম: আয়/ব্যয়/সঞ্চয় ---------- */
  function viewForm() {
    const type = S.params.type || 'income';
    const rec = S.params.id ? U().records.find(r => r.id === S.params.id) : null;
    const v = rec || { amount: '', date: today(), category: '', account: 'cash', member: '', note: '' };
    const cats = U().cats[type];
    const titleKey = { income: 'tAddIncome', expense: 'tAddExpense', savings: 'tAddSavings' }[type];
    return `<section class="page">${head(t(titleKey))}
      <form class="card form" data-form="record">
        <input type="hidden" name="type" value="${type}">
        <input type="hidden" name="id" value="${rec ? rec.id : ''}">
        <label>${t('amount')} *<input name="amount" type="number" min="1" step="any" value="${v.amount}"></label>
        <label>${t('date')}<input name="date" type="date" value="${v.date}"></label>
        <label>${t('category')}<select name="category">${cats.map(c => `<option value="${c}" ${c === v.category ? 'selected' : ''}>${esc(catName(c))}</option>`).join('')}</select></label>
        <label>${t('account')}<select name="account">${U().accounts.map(a => `<option value="${a.id}" ${a.id === v.account ? 'selected' : ''}>${esc(accName(a))}</option>`).join('')}</select></label>
        <label>${t('member')}<select name="member"><option value="">${t('none')}</option>${U().members.map(m => `<option value="${m.id}" ${m.id === v.member ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
        <label>${t('note')}<input name="note" value="${esc(v.note)}"></label>
        <button class="btn ${type} block" type="submit">${t('save')}</button>
      </form></section>`;
  }

  /* ---------- বিবরণ ---------- */
  function viewDetails() {
    const tabs = ['all', 'income', 'expense', 'savings'].map(k =>
      `<button class="chip ${S.filter === k ? 'on' : ''}" data-act="filter" data-f="${k}">${t(k)}</button>`).join('');
    const list = U().records.filter(r => S.filter === 'all' || r.type === S.filter)
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt - a.createdAt));
    const rows = list.map(r => `<div class="row">
        <div class="grow"><b>${esc(catName(r.category))}</b>
          <small>${fmtDate(r.date)} · ${esc(accLabel(r.account))}${r.member ? ' · ' + esc(memName(r.member)) : ''}</small>
          ${r.note ? `<small>${esc(r.note)}</small>` : ''}</div>
        <div class="amt ${r.type}">${money(r.amount)}</div>
        <div class="acts">
          <button class="mini" data-act="edit" data-type="${r.type}" data-id="${r.id}">✎</button>
          <button class="mini danger" data-act="del" data-kind="records" data-id="${r.id}">🗑</button>
        </div></div>`).join('');
    return `<section class="page">${head(t('tDetails'))}
      <div class="chips">${tabs}</div>
      <div class="card list">${rows || `<p class="empty">${t('emptyList')}</p>`}</div></section>`;
  }

  /* ---------- বাজেট ---------- */
  function viewBudget() {
    const n = today();
    const list = U().budgets.map(b => {
      const sp = sumOf('expense', b.from, b.to, b.category);
      const p = b.amount ? sp / b.amount * 100 : 0;
      const msg = budgetMsg(p);
      return `<div class="row col">
        <div class="between"><b>${esc(b.name)}</b>
          <button class="mini danger" data-act="del" data-kind="budgets" data-id="${b.id}">🗑</button></div>
        <small>${fmtDate(b.from)} – ${fmtDate(b.to)}${b.category ? ' · ' + esc(catName(b.category)) : ''}</small>
        <div class="bar"><i class="${p >= 100 ? 'over' : p >= 90 ? 'hi' : ''}" style="width:${Math.min(p, 100)}%"></i></div>
        <small>${t('spent')}: ${money(sp)} · ${t('remaining')}: ${money(b.amount - sp)} (${pct(p)})</small>
        ${msg ? `<small class="warn">${msg}</small>` : ''}</div>`;
    }).join('');
    const catOpts = `<option value="">${t('all')}</option>` + U().cats.expense.map(c => `<option value="${c}">${esc(catName(c))}</option>`).join('');
    return `<section class="page">${head(t('budget'))}
      <div class="card list">${list || `<p class="empty">${t('emptyBudget')}</p>`}</div>
      <div class="card"><h4>${t('add')}</h4>
        <form class="form" data-form="budget">
          <label>${t('budgetName')}<input name="name" required></label>
          <label>${t('budgetAmount')}<input name="amount" type="number" min="1" step="any" required></label>
          <div class="row-2">
            <label>${t('from')}<input name="from" type="date" value="${n.slice(0, 8)}01"></label>
            <label>${t('to')}<input name="to" type="date" value="${monthEnd(n)}"></label>
          </div>
          <label>${t('category')}<select name="category">${catOpts}</select></label>
          <button class="btn primary block" type="submit">${t('save')}</button>
        </form></div></section>`;
  }

  /* ---------- নোটিফিকেশন ---------- */
  function viewNotif() {
    const list = alerts();
    const items = list.map(a => `<div class="row"><span>⚠️</span><div class="grow"><b>${esc(a.name)}</b><small class="warn">${esc(a.text.split(': ').slice(1).join(': '))}</small></div></div>`).join('');
    return `<section class="page">${head(t('notifications'))}
      <div class="card list">${items || `<p class="empty">${t('emptyNotif')}</p>`}</div></section>`;
  }

  /* ---------- রিপোর্ট ---------- */
  function viewReport() {
    const [f, to] = rangeOf(S.period);
    const inc = sumOf('income', f, to), exp = sumOf('expense', f, to), sav = sumOf('savings', f, to);
    const bs = buckets(S.period).map(b => ({ ...b, i: sumOf('income', b.f, b.t), e: sumOf('expense', b.f, b.t) }));
    const max = Math.max(1, ...bs.map(b => Math.max(b.i, b.e)));
    const bars = bs.map(b => `<div class="col-bar" title="${money(b.i)} / ${money(b.e)}">
        <div class="pair"><i class="bi" style="height:${b.i / max * 100}%"></i><i class="be" style="height:${b.e / max * 100}%"></i></div>
        <small>${b.l}</small></div>`).join('');
    const catMap = {};
    recs('expense', f, to).forEach(r => { catMap[r.category] = (catMap[r.category] || 0) + Number(r.amount); });
    const cats = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([k, v]) =>
      `<div class="row col"><div class="between"><span>${esc(catName(k))}</span><b>${money(v)}</b></div>
       <div class="bar"><i style="width:${exp ? v / exp * 100 : 0}%"></i></div></div>`).join('');
    const per = ['daily', 'weekly', 'monthly', 'yearly'].map(p =>
      `<button class="chip ${S.period === p ? 'on' : ''}" data-act="period" data-p="${p}">${t(p)}</button>`).join('');
    return `<section class="page">${head(t('report'))}
      <div class="chips">${per}</div>
      <div class="card"><div class="summary">
        <div><small>${t('reportIncome')}</small><b class="amt income">${money(inc)}</b></div>
        <div><small>${t('reportExpense')}</small><b class="amt expense">${money(exp)}</b></div>
        <div><small>${t('reportBalance')}</small><b>${money(inc - exp)}</b></div>
        <div><small>${t('reportSavings')}</small><b class="amt savings">${money(sav)}</b></div>
      </div></div>
      <div class="card"><h4>${t('trend')}</h4>
        <div class="legend"><span><i class="dot g"></i>${t('income')}</span><span><i class="dot r"></i>${t('expense')}</span></div>
        <div class="bars">${bars}</div></div>
      <div class="card"><h4>${t('byCategory')}</h4>${cats || `<p class="empty">${t('emptyList')}</p>`}</div>
    </section>`;
  }

  /* ---------- পরিবারের সদস্য ---------- */
  function viewFamily() {
    const list = U().members.map(m => `<div class="row">
        <span class="av">${esc(m.name.charAt(0))}</span>
        <div class="grow"><b>${esc(m.name)}</b><small>${esc(m.relation || '')}</small></div>
        <button class="mini danger" data-act="del" data-kind="members" data-id="${m.id}">🗑</button></div>`).join('');
    return `<section class="page">${head(t('tFamily'))}
      <div class="card"><p><b>${dg(U().members.length)}</b> ${t('memberCount')}</p></div>
      <div class="card list">${list || `<p class="empty">${t('emptyMembers')}</p>`}</div>
      <div class="card"><h4>${t('addMember')}</h4>
        <form class="form" data-form="member">
          <label>${t('name')}<input name="name" required></label>
          <label>${t('relation')}<input name="relation"></label>
          <button class="btn primary block" type="submit">${t('save')}</button>
        </form></div></section>`;
  }

  /* ---------- অন্যান্য অপশন: অ্যাকাউন্ট, ধার-দেনা, ক্যাটাগরি ---------- */
  function viewOther() {
    const u = U();
    const accRows = u.accounts.map(a => `<div class="row">
        <div class="grow"><b>${esc(accName(a))}</b></div>
        <div class="amt">${money(accBal(a))}</div>
        ${a.builtin ? '' : `<button class="mini danger" data-act="del" data-kind="accounts" data-id="${a.id}">🗑</button>`}</div>`).join('');
    const loanRows = u.loans.map(l => {
      const rem = l.amount - l.paid;
      return `<div class="row col">
        <div class="between"><b>${esc(l.name)}</b><span class="tag ${l.type}">${t(l.type)}</span></div>
        <small>${fmtDate(l.date)}${l.due ? ' → ' + fmtDate(l.due) : ''} · ${t('paid')}: ${money(l.paid)} · ${t('loanRemaining')}: ${money(rem)}</small>
        ${rem > 0 ? `<div class="inline"><input type="number" min="1" step="any" placeholder="${t('amount')}"><button class="mini" data-act="payLoan" data-id="${l.id}">${t('payNow')}</button></div>` : ''}
        <div class="acts"><button class="mini danger" data-act="del" data-kind="loans" data-id="${l.id}">🗑</button></div></div>`;
    }).join('');
    const catSection = ['income', 'expense', 'savings'].map(ty => `<h4>${t(ty)}</h4>` +
      u.cats[ty].map(k => `<div class="row"><div class="grow">${esc(catName(k))}</div>
        ${T['cat_' + k] ? '' : `<button class="mini danger" data-act="del" data-kind="cats" data-type="${ty}" data-key="${esc(k)}">🗑</button>`}</div>`).join('')).join('');
    const typeOpts = ['income', 'expense', 'savings'].map(k => `<option value="${k}">${t(k)}</option>`).join('');
    return `<section class="page">${head(t('tOther'))}
      <div class="card"><h3>${t('accounts')}</h3><div class="list">${accRows}</div>
        <form class="form" data-form="account"><div class="row-2">
          <label>${t('name')}<input name="name" required></label>
          <label>${t('opening')}<input name="opening" type="number" step="any" value="0"></label></div>
          <button class="btn block" type="submit">${t('addAccount')}</button></form></div>
      <div class="card"><h3>${t('loans')}</h3><div class="list">${loanRows || `<p class="empty">${t('emptyList')}</p>`}</div>
        <form class="form" data-form="loan">
          <label>${t('loanType')}<select name="type"><option value="borrow">${t('borrow')}</option><option value="lend">${t('lend')}</option></select></label>
          <label>${t('loanName')}<input name="name" required></label>
          <div class="row-2">
            <label>${t('amount')}<input name="amount" type="number" min="1" step="any" required></label>
            <label>${t('date')}<input name="date" type="date" value="${today()}"></label></div>
          <label>${t('due')}<input name="due" type="date"></label>
          <button class="btn block" type="submit">${t('addLoan')}</button></form></div>
      <div class="card"><h3>${t('categories')}</h3>${catSection}
        <form class="form" data-form="category"><div class="row-2">
          <label>${t('loanType')}<select name="type">${typeOpts}</select></label>
          <label>${t('name')}<input name="name" required></label></div>
          <button class="btn block" type="submit">${t('addCategory')}</button></form></div>
    </section>`;
  }

  /* ---------- সেটিংস / প্রোফাইল ---------- */
  function viewSettings() {
    const s = S.data.settings;
    const u = S.data.users.find(x => x.id === S.data.session.id) || { name: '', email: '' };
    const profile = `<div class="card">
        <div class="profile" data-act="profileToggle">
          <span class="av">${esc(u.name.charAt(0))}</span>
          <div class="grow"><b>${esc(u.name)}</b><small>${esc(u.email)}</small></div><span>${s.profileOpen ? '▲' : '▼'}</span></div>
        ${s.profileOpen ? `<hr>
          <p><b>${t('name')}:</b> ${esc(u.name)}</p>
          <p><b>${t('email')}:</b> ${esc(u.email)}</p>
          <form class="form" data-form="profile">
            <label>${t('name')}<input name="name" value="${esc(u.name)}" required></label>
            <button class="btn primary" type="submit">${t('save')}</button>
          </form>` : ''}</div>`;
    const sw = (k, label) => `<div class="setting"><span>${t(label)}</span>
      <button class="switch ${s[k] ? 'on' : ''}" data-act="toggle" data-k="${k}" aria-label="${label}"></button></div>`;
    return `<section class="page">${head(t('profile'))}
      ${profile}
      <div class="card">
        <div class="setting"><span>${t('language')}</span>
          <div class="lang" style="margin:0">
            <button class="${L() === 'bn' ? 'on' : ''}" data-act="lang" data-l="bn">বাংলা</button>
            <button class="${L() === 'en' ? 'on' : ''}" data-act="lang" data-l="en">English</button></div></div>
        <div class="setting"><span>${t('theme')}</span>
          <button class="switch ${s.theme === 'dark' ? 'on' : ''}" data-act="theme" aria-label="${t('theme')}"></button></div>
        ${sw('animations', 'animations')}
        ${sw('notifications', 'notifyOn')}
        <div class="setting"><span>${t('syncStatus')}</span><small>${t('syncLocal')}</small></div>
      </div>
      <div class="card">
        <div class="setting"><span>${t('aboutApp')}</span><small>${t('version')} 1.0.0</small></div>
        <button class="btn block" data-act="logout" style="margin-top:10px">${t('logout')}</button>
      </div>
    </section>`;
  }

  /* ---------- ওয়েলকাম ও লগইন ---------- */
  const langSwitch = () => `<div class="lang">
      <button class="${L() === 'bn' ? 'on' : ''}" data-act="lang" data-l="bn">বাংলা</button>
      <button class="${L() === 'en' ? 'on' : ''}" data-act="lang" data-l="en">English</button></div>`;

  function viewWelcome() {
    return `<section class="auth-page">
      <div class="hero-art">🏠</div>
      <h1>${t('appName')}</h1>
      <p>${t('tagline')}</p>
      <p><small>${t('welcomeLead')}</small></p>
      <button class="btn primary" data-act="go" data-to="auth" data-m="register">${t('start')}</button>
      <button class="btn" data-act="go" data-to="auth" data-m="login">${t('login')}</button>
      ${langSwitch()}
    </section>`;
  }

  function viewAuth() {
    const isReg = S.authMode === 'register';
    const fields = isReg ? `<label>${t('name')}<input name="name" required></label>` : '';
    const confirm = isReg ? `<label>${t('confirmPassword')}<input name="confirmPassword" type="password" required></label>` : '';
    return `<section class="auth-page">
      <h2>${t('appName')}</h2>
      <form class="card form" data-form="${isReg ? 'register' : 'login'}">
        ${fields}
        <label>${t('email')}<input name="email" type="email" required></label>
        <label>${t('password')}<input name="password" type="password" required></label>
        ${confirm}
        <button class="btn primary block" type="submit">${isReg ? t('register') : t('login')}</button>
      </form>
      <button class="link" data-act="go" data-to="auth" data-m="${isReg ? 'login' : 'register'}">${isReg ? t('toLogin') : t('toRegister')}</button>
      ${langSwitch()}
    </section>`;
  }

  /* ---------- ওয়েলকাম অ্যানিমেশন (লগইনের পর) ---------- */
  function nextQuote() {
    const i = (S.data.quoteIndex + 1) % QUOTES.length;
    S.data.quoteIndex = i;
    persist();
    return QUOTES[i];
  }

  function welcomeAnim(name) {
    return new Promise(res => {
      const q = nextQuote();
      openOverlay(`<div class="wel ${S.data.settings.animations ? '' : 'still'}">
        <div class="coin">🪙</div>
        <div class="bars"><i></i><i></i><i></i><i></i></div>
        <h2>${tf('welcomeHi', { name: esc(name) })}</h2>
        <p class="quote">“${esc(q[L()] || q.en)}”</p></div>`);
      setTimeout(() => { closeOverlay(); res(); }, 2600);
    });
  }

  /* ---------- অ্যাকাউন্ট ও পাসওয়ার্ড ---------- */
  async function sha(s) {
    const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
    return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
  }

  function startSession(u) {
    S.data.session = { id: u.id, name: u.name, email: u.email };
    if (!S.data.store[u.id]) S.data.store[u.id] = DB.newBucket();
    persist();
  }

  async function login(v) {
    const email = v('email').toLowerCase(), pw = v('password');
    const user = S.data.users.find(u => u.email === email);
    if (!user || user.hash !== await sha(pw)) return toast(t('errLogin'), 'err');
    startSession(user);
    await welcomeAnim(user.name);
    go('home');
  }

  async function register(v) {
    const name = v('name'), email = v('email').toLowerCase(), pw = v('password'), c = v('confirmPassword');
    if (!name || !email || !pw) return toast(t('errRequired'), 'err');
    if (pw.length < 6) return toast(t('errPasswordShort'), 'err');
    if (pw !== c) return toast(t('errPasswordMatch'), 'err');
    if (S.data.users.some(u => u.email === email)) return toast(t('errEmailUsed'), 'err');
    const user = { id: DB.uid(), name, email, hash: await sha(pw) };
    S.data.users.push(user);
    S.data.store[user.id] = DB.newBucket();
    startSession(user);
    await welcomeAnim(name);
    go('home');
  }

  /* ---------- ফর্ম জমা ---------- */
  function saveRecord(v) {
    const amount = Number(v('amount'));
    if (!(amount > 0)) return toast(t('errAmount'), 'err');
    const id = v('id');
    const data = { type: v('type'), amount, date: v('date') || today(), category: v('category'),
      account: v('account'), member: v('member'), note: v('note'), updatedAt: Date.now() };
    if (id) Object.assign(U().records.find(r => r.id === id), data);
    else U().records.push({ id: DB.uid(), createdAt: Date.now(), ...data });
    persist();
    toast(t('saved'));
    go(id ? 'details' : 'home');
  }

  function submitForm(f) {
    const v = n => { const e = f.querySelector(`[name="${n}"]`); return e ? e.value.trim() : ''; };
    const k = f.dataset.form;
    if (k === 'login') return login(v);
    if (k === 'register') return register(v);
    if (k === 'record') return saveRecord(v);

    if (k === 'budget') {
      const amount = Number(v('amount')), from = v('from'), to = v('to');
      if (!v('name') || !(amount > 0) || !from || !to) return toast(t('errRequired'), 'err');
      U().budgets.push({ id: DB.uid(), name: v('name'), amount, from, to, category: v('category') });
    } else if (k === 'member') {
      if (!v('name')) return toast(t('errRequired'), 'err');
      U().members.push({ id: DB.uid(), name: v('name'), relation: v('relation') });
    } else if (k === 'account') {
      if (!v('name')) return toast(t('errRequired'), 'err');
      U().accounts.push({ id: DB.uid(), name: v('name'), opening: Number(v('opening')) || 0 });
    } else if (k === 'loan') {
      const amount = Number(v('amount'));
      if (!v('name') || !(amount > 0)) return toast(t('errRequired'), 'err');
      U().loans.push({ id: DB.uid(), type: v('type'), name: v('name'), amount, date: v('date') || today(), due: v('due'), paid: 0 });
    } else if (k === 'category') {
      const ty = v('type'), name = v('name');
      if (!name) return toast(t('errRequired'), 'err');
      U().cats[ty].push(name);
    } else if (k === 'profile') {
      const name = v('name');
      if (!name) return toast(t('errRequired'), 'err');
      const u = S.data.users.find(x => x.id === S.data.session.id);
      if (u) u.name = name;
      S.data.session.name = name;
    } else return;

    persist();
    toast(t('saved'));
    render();
  }

  function payLoan(id, el) {
    const inp = el.parentElement.querySelector('input');
    const amt = Number(inp.value);
    const l = U().loans.find(x => x.id === id);
    if (!l) return;
    const rem = l.amount - l.paid;
    if (!(amt > 0) || amt > rem) return toast(t('errAmount'), 'err');
    l.paid += amt;
    persist();
    toast(t('saved'));
    render();
  }

  function del(kind, id, type, key) {
    if (!confirm(t('confirmDelete'))) return;
    if (kind === 'cats') U().cats[type] = U().cats[type].filter(c => c !== key);
    else U()[kind] = U()[kind].filter(x => x.id !== id);
    persist();
    toast(t('deleted'));
    render();
  }

  /* ---------- ইভেন্ট (ডেলিগেশন) ---------- */
  function act(a, d, el) {
    switch (a) {
      case 'go':
        if (d.m) S.authMode = d.m;
        if (d.to === 'form') return go('form', { type: d.type, id: d.id });
        if (d.to === 'home' || d.to === 'report' || d.to === 'details' || d.to === 'budget' || d.to === 'family'
          || d.to === 'other' || d.to === 'notifications' || d.to === 'settings' || d.to === 'auth' || d.to === 'welcome') {
          return go(d.to, {});
        }
        break;
      case 'edit': return go('form', { type: d.type, id: d.id });
      case 'del': return del(d.kind, d.id, d.type, d.key);
      case 'filter': S.filter = d.f; return render();
      case 'period': S.period = d.p; return render();
      case 'payLoan': return payLoan(d.id, el);
      case 'lang': S.data.settings.lang = d.l; persist(); return render();
      case 'theme': S.data.settings.theme = S.data.settings.theme === 'dark' ? 'light' : 'dark'; persist(); return render();
      case 'toggle': S.data.settings[d.k] = !S.data.settings[d.k]; persist(); return render();
      case 'profileToggle': S.data.settings.profileOpen = !S.data.settings.profileOpen; persist(); return render();
      case 'logout': S.data.session = null; persist(); return go('auth');
      case 'addmenu':
        return openOverlay(`<h3>${t('add')}</h3>
          ${['income', 'expense', 'savings'].map(k => `<button class="btn ${k} block" data-act="go" data-to="form" data-type="${k}">${t(k)}</button>`).join('')}
          <button class="link" data-act="close">${t('cancel')}</button>`);
      case 'close': return closeOverlay();
    }
  }

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    act(el.dataset.act, el.dataset, el);
  });

  document.addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    if (f.dataset && f.dataset.form) submitForm(f);
  });

  /* ---------- চালু করা ---------- */
  function boot() {
    applySettings();
    splashText();
    setTimeout(() => {
      $('#splash').classList.add('gone');
      if (S.data.session && S.data.store[S.data.session.id]) go('home');
      else if (!S.data.users.length) go('welcome');
      else go('auth');
    }, 1600);
  }

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  if (S.data.session && !S.data.store[S.data.session.id]) S.data.session = null;
  CLOUD.init();
  boot();
})();
