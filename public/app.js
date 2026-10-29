(function () {
  "use strict";
  var CAP = 35;
  var state = { shows: [], openAt: 0, offset: 0, loaded: false, failed: false };
  var mine = null; // {code, show, name, phone}
  var confirmCancel = false, cancelBusy = false, lookupErr = "", lookupBusy = false;
  var dlg = null, lastFocus = null;
  var STORE = "buffer-ticket";

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function now() { return Date.now() + state.offset; }
  function isOpen() { return state.loaded && now() >= state.openAt; }
  function showById(id) { return state.shows.filter(function (s) { return s.id === id; })[0]; }
  function say(m) { $("live").textContent = m; }
  function maskPhone(p) { var d = String(p).replace(/\D/g, ""); return d.length >= 8 ? d.slice(0, 3) + "-****-" + d.slice(-4) : d; }
  function fmtPhone(v) {
    var d = v.replace(/\D/g, "").slice(0, 11);
    if (d.length > 7) return d.slice(0, 3) + "-" + d.slice(3, d.length - 4) + "-" + d.slice(-4);
    if (d.length > 3) return d.slice(0, 3) + "-" + d.slice(3);
    return d;
  }
  function saveMine() { try { if (mine) localStorage.setItem(STORE, JSON.stringify({ code: mine.code, phone: mine.phone })); else localStorage.removeItem(STORE); } catch (e) {} }

  async function post(url, body) {
    var r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    var data = {}; try { data = await r.json(); } catch (e) {}
    if (!r.ok) { var err = new Error(data.message || "요청을 처리하지 못했습니다."); err.code = data.error; err.status = r.status; throw err; }
    return data;
  }

  /* ---- tempo: nine lines ---- */
  (function () {
    var hs = [100, 58, 82, 38, 100, 52, 74, 92, 46], ts = [3.2, 5.1, 4.0, 6.4, 2.8, 5.6, 3.6, 4.7, 6.0];
    var box = $("tempo");
    hs.forEach(function (h, i) {
      var ln = el("div", "ln");
      ln.style.setProperty("--h", h + "%"); ln.style.setProperty("--h-px", Math.round(200 * h / 100) + "px"); ln.style.setProperty("--t", ts[i] + "s");
      ln.appendChild(el("i")); box.appendChild(ln);
    });
  })();

  /* ---- countdown ---- */
  var wasOpen = false;
  function tick() {
    var big = $("big"), pill = $("pill");
    if (!state.loaded) { big.textContent = "—"; pill.textContent = "—"; pill.className = "pill"; return; }
    var diff = state.openAt - now();
    if (diff > 0) {
      var s = Math.floor(diff / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
      big.textContent = "D-" + d + "  " + pad(h) + ":" + pad(m) + ":" + pad(x);
      pill.textContent = "오픈 전"; pill.className = "pill";
    } else {
      big.textContent = "예매 진행 중"; pill.textContent = "OPEN"; pill.className = "pill on";
    }
    var o = isOpen(); if (o !== wasOpen) { wasOpen = o; render(); }
  }
  setInterval(tick, 1000);

  /* ---- data ---- */
  async function refresh() {
    try {
      var r = await fetch("/api/shows", { cache: "no-store" });
      if (!r.ok) throw new Error("bad status");
      var d = await r.json();
      state.shows = d.shows; state.openAt = new Date(d.openAt).getTime(); state.offset = new Date(d.now).getTime() - Date.now();
      state.loaded = true; state.failed = false;
    } catch (e) { state.failed = true; }
    tick(); render();
  }
  setInterval(function () { if (!document.hidden && !dlg) refresh(); }, 8000);

  /* ---- render ---- */
  function btnState(s) {
    if (state.failed && !state.loaded) return { label: "연결 확인 중", off: true };
    if (!state.loaded) return { label: "불러오는 중", off: true };
    if (mine) return { label: mine.show === s.id ? "예매 완료" : "1인 1매 · 예매함", off: true };
    if (!isOpen()) return { label: "11.04 20:00 오픈", off: true };
    if (s.remaining <= 0) return { label: "매진", off: true };
    return { label: "예매하기", off: false };
  }
  function render() {
    var bn = $("banner");
    bn.hidden = !state.failed;
    bn.textContent = state.failed ? "서버에 연결하지 못했습니다. 잠시 후 자동으로 다시 시도합니다." : "";
    var box = $("shows"); box.textContent = "";
    var list = state.shows.length ? state.shows : [
      { id: "A", date: "11.14", dow: "SAT", dowKo: "토", time: "3PM", remaining: CAP }, { id: "B", date: "11.14", dow: "SAT", dowKo: "토", time: "7PM", remaining: CAP },
      { id: "C", date: "11.15", dow: "SUN", dowKo: "일", time: "3PM", remaining: CAP }, { id: "D", date: "11.15", dow: "SUN", dowKo: "일", time: "7PM", remaining: CAP }];
    list.forEach(function (s) {
      var row = el("div", "row");
      var date = el("div", "date", s.date); date.appendChild(el("small", null, s.dow + " · " + s.dowKo + "요일"));
      var time = el("div", "time", s.time);
      var av = el("div", "avail"), dots = el("div", "dots"); dots.setAttribute("aria-hidden", "true");
      var tk = CAP - s.remaining;
      for (var i = 0; i < CAP; i++) dots.appendChild(el("span", i < tk ? "t" : ""));
      var rem = el("div", "rem"); rem.appendChild(el("b", null, state.loaded ? String(s.remaining) : "–")); rem.appendChild(document.createTextNode("/ " + CAP + " 잔여"));
      av.appendChild(dots); av.appendChild(rem);
      var st = btnState(s);
      var btn = el("button", "btn" + (st.off ? "" : " solid"), st.label); btn.type = "button"; btn.disabled = st.off;
      btn.setAttribute("aria-label", s.date + " " + s.dowKo + "요일 " + s.time + " " + st.label);
      btn.addEventListener("click", function () { openDialog(s); });
      row.appendChild(date); row.appendChild(time); row.appendChild(av); row.appendChild(btn);
      box.appendChild(row);
    });
    renderMine();
  }

  function renderMine() {
    var z = $("mineZone"), box = $("mine"); z.hidden = false; box.textContent = "";
    if (!mine) {
      var f = el("form"); f.style.marginTop = "14px"; f.style.maxWidth = "420px"; f.noValidate = true;
      f.appendChild(el("p", "notice", "이미 예매하셨다면 예매번호와 전화번호로 내역을 확인하거나 취소할 수 있습니다."));
      function field(id, lab, ph, mode) { var l = el("label", "field"); l.htmlFor = id; l.appendChild(el("span", null, lab)); var i = el("input"); i.id = id; i.type = "text"; i.placeholder = ph; if (mode) i.inputMode = mode; l.appendChild(i); f.appendChild(l); return i; }
      var c = field("l-code", "예매번호", "BUF-A-01"); c.autocapitalize = "characters"; c.maxLength = 10;
      var p = field("l-phone", "전화번호", "010-0000-0000", "numeric"); p.maxLength = 13;
      p.addEventListener("input", function () { p.value = fmtPhone(p.value); });
      var err = el("div", "err", lookupErr); err.setAttribute("role", "alert"); f.appendChild(err);
      var go = el("button", "btn", lookupBusy ? "확인 중" : "예매 확인"); go.type = "submit"; go.disabled = lookupBusy; go.style.marginTop = "6px";
      f.appendChild(go);
      f.addEventListener("submit", async function (e) {
        e.preventDefault(); if (lookupBusy) return;
        lookupBusy = true; lookupErr = ""; go.disabled = true; go.textContent = "확인 중";
        try {
          var r = await post("/api/lookup", { code: c.value, phone: p.value });
          mine = { code: r.code, show: r.show, name: r.name, phone: r.phone }; saveMine();
        } catch (ex) { lookupErr = ex.message; }
        lookupBusy = false; render();
      });
      box.appendChild(f); return;
    }
    var s = showById(mine.show) || { date: "", dowKo: "", time: "" };
    var stub = el("div", "stub"), a = el("div"), side = el("div", "side");
    a.appendChild(el("div", "label", "TICKET"));
    a.appendChild(el("div", "code", mine.code));
    var meta = el("div", "meta");
    meta.appendChild(el("span", null, s.date + " (" + s.dowKo + ") " + s.time + " · 자유석 1매"));
    meta.appendChild(el("span", null, mine.name + " · " + maskPhone(mine.phone)));
    a.appendChild(meta);
    if (!confirmCancel) {
      var cb = el("button", "link warn", "예매 취소"); cb.type = "button";
      cb.addEventListener("click", function () { confirmCancel = true; renderMine(); });
      side.appendChild(cb);
    } else {
      side.appendChild(el("span", null, "예매를 취소할까요? 취소하면 자리가 반환됩니다."));
      var y = el("button", "btn solid", cancelBusy ? "처리 중" : "취소 확정"); y.type = "button"; y.disabled = cancelBusy;
      y.addEventListener("click", cancelBooking);
      var n = el("button", "link", "돌아가기"); n.type = "button"; n.disabled = cancelBusy;
      n.addEventListener("click", function () { confirmCancel = false; renderMine(); });
      side.appendChild(y); side.appendChild(n);
    }
    stub.appendChild(a); stub.appendChild(side); box.appendChild(stub);
  }

  async function cancelBooking() {
    if (!mine || cancelBusy) return;
    cancelBusy = true; renderMine();
    try {
      await post("/api/cancel", { code: mine.code, phone: mine.phone });
      mine = null; saveMine(); confirmCancel = false; say("예매가 취소되었습니다.");
    } catch (e) { say("취소하지 못했습니다. 잠시 후 다시 시도해주세요."); }
    cancelBusy = false; await refresh();
  }

  /* ---- dialog ---- */
  function openDialog(s) { lastFocus = document.activeElement; dlg = { show: s, step: 1, busy: false, error: "", code: "" }; renderDlg(); }
  function closeDlg() { var done = dlg && dlg.step === 3; dlg = null; $("overlay").textContent = ""; if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus(); refresh(); }
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && dlg && !dlg.busy) closeDlg(); });

  function renderDlg() {
    var root = $("overlay"); root.textContent = "";
    if (!dlg) return;
    var s = dlg.show;
    var veil = el("div", "veil"), box = el("div", "dlg");
    box.setAttribute("role", "dialog"); box.setAttribute("aria-modal", "true"); box.setAttribute("aria-labelledby", "dt");
    veil.addEventListener("mousedown", function (e) { if (e.target === veil && !dlg.busy) closeDlg(); });
    var h = el("h2", null, ""); h.id = "dt"; h.tabIndex = -1;
    var which = el("div", "which", s.date + " (" + s.dowKo + ") " + s.time + " · 자유석 1매");
    var focusEl = null;

    if (dlg.step === 1) {
      h.textContent = "아카이빙 공지"; box.appendChild(h); box.appendChild(which);
      box.appendChild(el("p", null, "11.14(토) 7PM / 11.15(일) 7PM 공연 중 사진 및 영상 촬영이 예정되어 있습니다. 관객의 얼굴이 포함될 수 있으며 추후 SNS 및 보도자료에 활용될 예정이오니 예매에 참고 바랍니다. 티켓 예매 시 본 아카이빙 안내사항에 동의한 것으로 간주됩니다."));
      var act = el("div", "actions");
      var no = el("button", "btn", "닫기"); no.type = "button"; no.addEventListener("click", closeDlg);
      var ok = el("button", "btn solid", "동의하고 계속"); ok.type = "button"; ok.addEventListener("click", function () { dlg.step = 2; renderDlg(); });
      act.appendChild(no); act.appendChild(ok); box.appendChild(act); focusEl = ok;
    } else if (dlg.step === 2) {
      h.textContent = "예매 정보 입력"; box.appendChild(h); box.appendChild(which);
      var f = el("form"); f.noValidate = true;
      function field(id, lab, type, ph, ro) { var l = el("label", "field"); l.htmlFor = id; l.appendChild(el("span", null, lab)); var i = el("input"); i.id = id; i.type = type; if (ph) i.placeholder = ph; if (ro) { i.readOnly = true; i.value = ro; } l.appendChild(i); f.appendChild(l); return i; }
      var nm = field("f-name", "이름", "text", "이름"); nm.autocomplete = "name"; nm.maxLength = 30;
      var ph = field("f-phone", "전화번호", "tel", "010-0000-0000"); ph.autocomplete = "tel"; ph.inputMode = "numeric"; ph.maxLength = 13;
      field("f-qty", "매수", "text", null, "1매 (인당 1매 고정)");
      var err = el("div", "err", dlg.error); err.setAttribute("role", "alert"); f.appendChild(err);
      var act2 = el("div", "actions");
      var back = el("button", "btn", "닫기"); back.type = "button"; back.disabled = dlg.busy; back.addEventListener("click", closeDlg);
      var go = el("button", "btn solid", dlg.busy ? "처리 중" : "예매 확정"); go.type = "submit"; go.disabled = dlg.busy;
      act2.appendChild(back); act2.appendChild(go); f.appendChild(act2);
      ph.addEventListener("input", function () { ph.value = fmtPhone(ph.value); });
      f.addEventListener("submit", async function (e) {
        e.preventDefault(); if (dlg.busy) return;
        var name = nm.value.trim(), digits = ph.value.replace(/\D/g, "");
        if (!name) { err.textContent = "이름을 입력해주세요."; nm.focus(); return; }
        if (!/^01[016789]\d{7,8}$/.test(digits)) { err.textContent = "휴대전화 번호를 010-0000-0000 형식으로 입력해주세요."; ph.focus(); return; }
        dlg.busy = true; dlg.error = ""; err.textContent = ""; go.disabled = true; back.disabled = true; go.textContent = "처리 중";
        try {
          var r = await post("/api/book", { show: s.id, name: name, phone: digits, consent: true });
          mine = { code: r.code, show: s.id, name: name, phone: digits }; saveMine();
          dlg.busy = false; dlg.step = 3; dlg.code = r.code; say("예매가 완료되었습니다."); renderDlg();
        } catch (ex) {
          dlg.busy = false; dlg.error = ex.status ? ex.message : "연결에 실패했습니다. 잠시 후 다시 시도해주세요."; renderDlg();
        }
      });
      box.appendChild(f); focusEl = nm;
    } else {
      h.textContent = "예매가 완료되었습니다"; box.appendChild(h); box.appendChild(which);
      box.appendChild(el("div", "big-code", dlg.code));
      box.appendChild(el("p", null, "예매번호를 꼭 기억해주세요. 취소나 확인 시 예매번호와 전화번호가 필요합니다. 자유석이므로 입장 순서대로 착석합니다."));
      var act3 = el("div", "actions"); var done = el("button", "btn solid", "확인"); done.type = "button"; done.addEventListener("click", closeDlg);
      act3.appendChild(done); box.appendChild(act3); focusEl = done;
    }
    veil.appendChild(box); root.appendChild(veil);
    if (focusEl) focusEl.focus(); else h.focus();
  }

  /* ---- boot ---- */
  render(); tick();
  (async function () {
    try {
      var saved = JSON.parse(localStorage.getItem(STORE) || "null");
      if (saved && saved.code && saved.phone) {
        try { var r = await post("/api/lookup", saved); mine = { code: r.code, show: r.show, name: r.name, phone: r.phone }; }
        catch (e) { if (e.status === 404) { mine = null; saveMine(); } }
      }
    } catch (e) {}
    refresh();
  })();
})();
