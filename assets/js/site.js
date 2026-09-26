/* NEXT HYPE — 気になるリスト・ぴったり診断
 * サーバーは使わず、ブラウザの localStorage にだけ保存する（ほかの人やサイト運営者には送られない）。
 * データは /games.json。表示はすべて textContent で入れる（HTML として解釈しない）。
 */
(function () {
  "use strict";

  var BASE = (document.querySelector('meta[name="nh-base"]') || {}).content || "";
  var KEY = "nh-watch-v1";
  var RANKS = [[85, "S", "今いちばん熱い"], [70, "A", "かなり注目"], [55, "B", "話題上昇中"], [40, "C", "知る人ぞ知る"], [0, "D", "これから"]];

  // ---------- 保存 ----------
  function load() {
    try {
      var v = JSON.parse(localStorage.getItem(KEY) || "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch (e) { return {}; }
  }
  function save(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 保存できない環境では何もしない */ }
  }
  function snapshot(g) {
    return { s: g ? g.score : null, d: g ? g.discount : 0, r: g ? g.release : "", t: today() };
  }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2);
  }

  // ---------- 小物 ----------
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function rank(score) {
    for (var i = 0; i < RANKS.length; i++) if (score >= RANKS[i][0]) return RANKS[i];
    return RANKS[RANKS.length - 1];
  }
  function daysUntil(iso) {
    if (!iso) return null;
    var p = iso.split("-");
    var t = new Date(+p[0], +p[1] - 1, +p[2]);
    var n = new Date(); n = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((t - n) / 86400000);
  }
  function whenText(g) {
    var d = daysUntil(g.release_iso);
    if (d != null && d > 0) return "発売まで " + d + " 日";
    if (d === 0) return "本日発売";
    if (g.upcoming) return g.release ? g.release + "発売予定" : "発売日未定";
    return g.release ? g.release + "発売" : "発売済み";
  }
  var gamesPromise = null;
  function games() {
    if (!gamesPromise) {
      gamesPromise = fetch(BASE + "/games.json", { credentials: "omit" })
        .then(function (r) { return r.ok ? r.json() : []; })
        .catch(function () { return []; });
    }
    return gamesPromise;
  }
  function toast(msg) {
    var t = document.querySelector(".nh-toast") || document.body.appendChild(el("div", "nh-toast"));
    t.setAttribute("role", "status");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  // ---------- 変化の検出 ----------
  function changes(g, snap) {
    var out = [];
    if (!g || !snap) return out;
    if (snap.s != null && g.score !== snap.s) {
      var diff = g.score - snap.s;
      out.push({ cls: diff > 0 ? "up" : "down", text: "期待度 " + (diff > 0 ? "↑" : "↓") + Math.abs(diff) });
    }
    if (g.sale && g.discount > 0 && g.discount !== snap.d) out.push({ cls: "sale", text: g.discount + "%オフのセール開始" });
    if (g.release && g.release !== snap.r) out.push({ cls: "date", text: snap.r ? "発売日が変更: " + g.release : "発売日が決定: " + g.release });
    var d = daysUntil(g.release_iso);
    if (d === 0) out.push({ cls: "date", text: "本日発売！" });
    return out;
  }

  // ---------- ☆ ボタン ----------
  function paintButtons() {
    var list = load();
    var buttons = document.querySelectorAll("[data-watch]");
    for (var i = 0; i < buttons.length; i++) {
      var on = !!list[buttons[i].getAttribute("data-watch")];
      buttons[i].setAttribute("aria-pressed", on ? "true" : "false");
      var label = buttons[i].querySelector(".watch-label");
      if (label) label.textContent = on ? "気になる済み" : "気になる";
    }
  }
  function paintCount() {
    var list = load();
    var ids = Object.keys(list);
    var counters = document.querySelectorAll("[data-watch-count]");
    for (var i = 0; i < counters.length; i++) {
      counters[i].textContent = ids.length ? String(ids.length) : "";
      counters[i].hidden = !ids.length;
    }
    if (!ids.length) return;
    games().then(function (all) {
      var changed = all.some(function (g) { return list[g.id] && changes(g, list[g.id]).length; });
      var links = document.querySelectorAll(".watch-link");
      for (var j = 0; j < links.length; j++) links[j].classList.toggle("has-news", changed);
    });
  }
  document.addEventListener("click", function (ev) {
    var btn = ev.target.closest && ev.target.closest("[data-watch]");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    var id = btn.getAttribute("data-watch");
    var list = load();
    if (list[id]) {
      delete list[id];
      save(list);
      toast("気になるリストから外しました");
      paintButtons(); paintCount();
    } else {
      games().then(function (all) {
        var g = all.filter(function (x) { return String(x.id) === id; })[0];
        list = load();
        list[id] = snapshot(g);
        save(list);
        toast("気になるリストに追加しました ☆");
        paintButtons(); paintCount();
      });
    }
  });

  // ---------- 気になるリストのページ ----------
  function renderWatchlist(root) {
    games().then(function (all) {
      var list = load();
      var items = all.filter(function (g) { return list[g.id]; });
      root.textContent = "";
      if (!items.length) {
        var empty = el("div", "wl-empty");
        empty.appendChild(el("p", "wl-empty-title", "まだ何も入っていません"));
        empty.appendChild(el("p", null, "ゲームの ☆ ボタンを押すと、ここに集まります。期待度の変化・セール・発売日の決定を、次に来たときにお知らせします。"));
        var a1 = el("a", "btn btn-dark", "ゲーム一覧から探す"); a1.href = BASE + "/games/";
        var a2 = el("a", "btn", "ぴったり診断をする"); a2.href = BASE + "/finder/";
        var b = el("div", "buttons"); b.appendChild(a1); b.appendChild(a2); empty.appendChild(b);
        root.appendChild(empty);
        return;
      }
      items.sort(function (a, b) {
        return changes(b, list[b.id]).length - changes(a, list[a.id]).length || b.score - a.score;
      });
      var news = 0;
      var ul = el("ul", "wl-list");
      items.forEach(function (g) {
        var ch = changes(g, list[g.id]);
        if (ch.length) news++;
        var li = el("li", "wl-item" + (ch.length ? " wl-changed" : ""));
        var a = el("a", "wl-link"); a.href = g.url;
        if (g.img) { var img = el("img"); img.src = g.img; img.alt = ""; img.loading = "lazy"; img.width = 460; img.height = 215; a.appendChild(img); }
        var body = el("span", "wl-body");
        body.appendChild(el("span", "wl-name", g.name));
        body.appendChild(el("span", "wl-when", whenText(g) + (g.ja ? " ・ 日本語対応" : "")));
        if (g.sale && g.discount > 0) body.appendChild(el("span", "sale-off", g.discount + "%オフ " + (g.sale_price || "")));
        a.appendChild(body);
        var r = rank(g.score);
        var sc = el("span", "wl-score");
        var rk = el("span", "rank rank-" + r[1]); rk.appendChild(el("b", null, r[1])); rk.title = "期待度ランク " + r[1] + "：" + r[2]; sc.appendChild(rk);
        sc.appendChild(el("strong", null, String(g.score)));
        a.appendChild(sc);
        li.appendChild(a);
        if (ch.length) {
          var cl = el("div", "wl-changes");
          ch.forEach(function (c) { cl.appendChild(el("span", "wl-chip wl-" + c.cls, c.text)); });
          li.appendChild(cl);
        }
        var rm = el("button", "wl-remove", "外す");
        rm.type = "button";
        rm.setAttribute("aria-label", g.name + " を気になるリストから外す");
        rm.addEventListener("click", function () {
          var l = load(); delete l[g.id]; save(l); renderWatchlist(root); paintCount();
        });
        li.appendChild(rm);
        ul.appendChild(li);
      });
      var head = el("div", "wl-head");
      head.appendChild(el("p", "wl-summary", items.length + " 本を追いかけ中" + (news ? " ・ " + news + " 本に動きがありました" : " ・ 前回から変化なし")));
      if (news) {
        var ok = el("button", "btn", "確認済みにする");
        ok.type = "button";
        ok.addEventListener("click", function () {
          var l = load();
          items.forEach(function (g) { if (l[g.id]) l[g.id] = snapshot(g); });
          save(l); renderWatchlist(root); paintCount();
          toast("最新の状態を記録しました");
        });
        head.appendChild(ok);
      }
      root.appendChild(head);
      root.appendChild(ul);
    });
  }

  // ---------- ぴったり診断 ----------
  var QUESTIONS = [
    { key: "who", q: "誰と遊ぶ？", opts: [["solo", "ひとりでじっくり"], ["friends", "友達とワイワイ"], ["any", "どっちも"]] },
    { key: "pc", q: "あなたの PC は？", opts: [["1", "ノート PC・数年前の PC"], ["2", "ふつうのゲーミング PC"], ["4", "最近のゲーミング PC"], ["5", "ハイエンド PC"]] },
    { key: "ja", q: "日本語は？", opts: [["must", "日本語じゃないと無理"], ["any", "英語でも平気"]] },
    { key: "when", q: "いつ遊びたい？", opts: [["now", "今すぐ遊びたい"], ["wait", "発売を待つのも楽しみ"], ["any", "どちらでも"]] }
  ];
  var FRIENDS = ["友達と協力プレイ", "1 台で一緒に遊べる", "対戦が熱い", "大人数でオンライン"];

  function matchGame(g, a) {
    var pts = 0, why = [], tags = g.tags || [];
    // 誰と
    var solo = tags.indexOf("ひとりでじっくり") >= 0;
    var multi = tags.some(function (t) { return FRIENDS.indexOf(t) >= 0; });
    if (a.who === "any") pts += 25;
    else if (a.who === "solo" && solo) { pts += 25; why.push("ひとりでじっくり遊べる"); }
    else if (a.who === "friends" && multi) { pts += 25; why.push(tags.filter(function (t) { return FRIENDS.indexOf(t) >= 0; })[0]); }
    else if (!tags.length) pts += 10;
    // PC
    var cap = +a.pc;
    if (g.pc && g.pc <= cap) { pts += 20; why.push(g.pc <= 1 ? "軽い PC でも動く目安" : "あなたの PC で動く目安"); }
    else if (!g.pc) pts += 12;
    else if (g.pc === cap + 1) pts += 4;
    // 日本語
    if (a.ja === "must") { if (!g.ja) return null; pts += 10; why.push("日本語対応"); } else pts += 10;
    // いつ
    if (a.when === "now") { if (g.upcoming) return null; pts += 15; why.push(g.sale ? g.discount + "%オフのセール中" : "もう遊べる"); }
    else if (a.when === "wait") { if (!g.upcoming) pts += 4; else { pts += 15; why.push(whenText(g)); } }
    else pts += 15;
    // 期待度（最大 30 点）
    pts += Math.round(g.score * 0.3);
    return { g: g, pct: Math.min(99, pts), why: why };
  }

  function renderFinder(root) {
    var answers = {}, step = 0;
    var box = el("div", "fd-card");
    root.textContent = "";
    root.appendChild(box);

    function progress() {
      var p = el("div", "fd-progress");
      for (var i = 0; i < QUESTIONS.length; i++) p.appendChild(el("span", i < step ? "done" : i === step ? "now" : ""));
      return p;
    }
    function ask() {
      var q = QUESTIONS[step];
      box.textContent = "";
      box.appendChild(progress());
      box.appendChild(el("p", "fd-step", "Q" + (step + 1) + " / " + QUESTIONS.length));
      box.appendChild(el("h2", "fd-q", q.q));
      var opts = el("div", "fd-opts");
      q.opts.forEach(function (o) {
        var b = el("button", "fd-opt", o[1]);
        b.type = "button";
        b.addEventListener("click", function () {
          answers[q.key] = o[0];
          step++;
          if (step < QUESTIONS.length) ask(); else result();
        });
        opts.appendChild(b);
      });
      box.appendChild(opts);
      if (step > 0) {
        var back = el("button", "fd-back", "← ひとつ戻る");
        back.type = "button";
        back.addEventListener("click", function () { step--; ask(); });
        box.appendChild(back);
      }
      var first = opts.querySelector("button"); if (first && step > 0) first.focus();
    }
    function result() {
      box.textContent = "";
      box.appendChild(el("p", "fd-step", "診断中…"));
      games().then(function (all) {
        var res = all.map(function (g) { return matchGame(g, answers); })
          .filter(Boolean)
          .sort(function (a, b) { return b.pct - a.pct || b.g.score - a.g.score; })
          .slice(0, 3);
        box.textContent = "";
        box.appendChild(el("p", "fd-step", "RESULT"));
        if (!res.length) {
          box.appendChild(el("h2", "fd-q", "条件に合うゲームが見つかりませんでした"));
          box.appendChild(el("p", null, "「いつ遊びたい？」を「どちらでも」にすると見つかるかもしれません。"));
        } else {
          box.appendChild(el("h2", "fd-q", "あなたにぴったりの一本は…"));
          res.forEach(function (r, i) {
            var a = el("a", "fd-result" + (i === 0 ? " fd-best" : "")); a.href = r.g.url;
            if (r.g.img) { var img = el("img"); img.src = r.g.img; img.alt = ""; img.width = 460; img.height = 215; a.appendChild(img); }
            var b = el("span", "fd-body");
            b.appendChild(el("span", "fd-pct", "相性 " + r.pct + "%"));
            b.appendChild(el("span", "fd-name", r.g.name));
            var why = el("span", "fd-why");
            r.why.slice(0, 3).forEach(function (w) { why.appendChild(el("span", "fd-chip", w)); });
            b.appendChild(why);
            a.appendChild(b);
            var w = el("button", "watch-btn watch-mini");
            w.type = "button"; w.setAttribute("data-watch", String(r.g.id)); w.setAttribute("aria-label", "気になるリストに追加");
            w.appendChild(el("span", "watch-star", "★"));
            var wrap = el("div", "fd-result-wrap"); wrap.appendChild(a); wrap.appendChild(w);
            box.appendChild(wrap);
          });
          var best = res[0];
          var text = "NEXT HYPE のぴったり診断、私に合う Steam 新作は『" + best.g.name + "』（相性 " + best.pct + "%）でした";
          var share = el("a", "btn btn-x", "結果を X でシェア");
          share.href = "https://x.com/intent/post?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(location.origin + BASE + "/finder/") + "&hashtags=NEXTHYPE";
          share.target = "_blank"; share.rel = "noopener";
          var again = el("button", "btn", "もう一度診断する"); again.type = "button";
          again.addEventListener("click", function () { answers = {}; step = 0; ask(); });
          var btns = el("div", "buttons"); btns.appendChild(share); btns.appendChild(again);
          box.appendChild(btns);
        }
        paintButtons();
      });
    }
    ask();
  }


  // ---------- ゲームを探す（絞り込み・並べ替え） ----------
  var PLAY = {
    solo: ["ひとりでじっくり"],
    coop: ["友達と協力プレイ", "1 台で一緒に遊べる"],
    pvp: ["対戦が熱い", "大人数でオンライン"]
  };
  function initFilter(bar) {
    var grid = document.getElementById("game-results");
    var empty = document.getElementById("game-empty");
    if (!grid) return;
    var cards = Array.prototype.slice.call(grid.querySelectorAll(".game-tile-wrap"));
    var q = bar.querySelector("input[name=q]");
    var sort = bar.querySelector("select[name=sort]");
    var genre = bar.querySelector("select[name=genre]");
    var count = bar.querySelector(".fb-count");
    var reset = bar.querySelector(".fb-reset");
    var state = { q: "", status: "", sort: "score", genre: "", flags: {}, play: {} };

    // ジャンルの選択肢はカードから作る（多い順）
    var gcount = {};
    cards.forEach(function (c) {
      (c.getAttribute("data-genres") || "").split("|").forEach(function (g) { if (g) gcount[g] = (gcount[g] || 0) + 1; });
    });
    Object.keys(gcount).sort(function (a, b) { return gcount[b] - gcount[a]; }).forEach(function (g) {
      var o = el("option", null, g + "（" + gcount[g] + "）"); o.value = g; genre.appendChild(o);
    });

    // URL の条件を読む（?status=upcoming&ja=1 など。共有したリンクで同じ結果になる）
    try {
      var sp = new URLSearchParams(location.search);
      state.q = sp.get("q") || "";
      state.status = sp.get("status") || "";
      state.sort = sp.get("sort") || "score";
      state.genre = sp.get("genre") || "";
      ["ja", "sale", "free", "light"].forEach(function (k) { if (sp.get(k) === "1") state.flags[k] = true; });
      (sp.get("play") || "").split(",").forEach(function (k) { if (PLAY[k]) state.play[k] = true; });
    } catch (e) { /* 古いブラウザでは URL の条件を使わない */ }

    function data(c, k) { return c.getAttribute("data-" + k) || ""; }
    function norm(t) {   // 全角・半角、大文字・小文字の違いを無視して探す
      t = String(t || "");
      try { t = t.normalize("NFKC"); } catch (e) { /* 古いブラウザ */ }
      return t.toLowerCase().replace(/\s+/g, "");
    }
    function match(c) {
      if (state.q && norm(data(c, "name")).indexOf(norm(state.q)) < 0) return false;
      if (state.status && data(c, "status") !== state.status) return false;
      if (state.flags.ja && data(c, "ja") !== "true") return false;
      if (state.flags.sale && data(c, "sale") !== "true") return false;
      if (state.flags.free && data(c, "free") !== "true") return false;
      if (state.flags.light) { var pc = +data(c, "pc"); if (!pc || pc > 2) return false; }
      if (state.genre && data(c, "genres").split("|").indexOf(state.genre) < 0) return false;
      var tags = data(c, "play").split("|");
      for (var k in state.play) {
        if (state.play[k] && !PLAY[k].some(function (t) { return tags.indexOf(t) >= 0; })) return false;
      }
      return true;
    }
    function cmp(a, b) {
      var s = +data(b, "score") - +data(a, "score");
      if (state.sort === "release") {
        // 発売予定を発売が近い順に → そのあと発売済みを新しい順に
        var ua = data(a, "status") === "upcoming", ub = data(b, "status") === "upcoming";
        if (ua !== ub) return ua ? -1 : 1;
        var ra = data(a, "release"), rb = data(b, "release");
        if (ra === rb) return s;
        return (ra < rb ? -1 : 1) * (ua ? 1 : -1);
      }
      if (state.sort === "new") return data(a, "first") < data(b, "first") ? 1 : data(a, "first") > data(b, "first") ? -1 : s;
      if (state.sort === "discount") return (+data(b, "discount") - +data(a, "discount")) || s;
      return s;
    }
    function active() {
      return !!(state.q || state.status || state.genre || state.sort !== "score" ||
        Object.keys(state.flags).some(function (k) { return state.flags[k]; }) ||
        Object.keys(state.play).some(function (k) { return state.play[k]; }));
    }
    function syncUrl() {
      try {
        var sp = new URLSearchParams();
        if (state.q) sp.set("q", state.q);
        if (state.status) sp.set("status", state.status);
        if (state.sort !== "score") sp.set("sort", state.sort);
        if (state.genre) sp.set("genre", state.genre);
        Object.keys(state.flags).forEach(function (k) { if (state.flags[k]) sp.set(k, "1"); });
        var pl = Object.keys(state.play).filter(function (k) { return state.play[k]; });
        if (pl.length) sp.set("play", pl.join(","));
        var qs = sp.toString();
        history.replaceState(null, "", location.pathname + (qs ? "?" + qs : ""));
      } catch (e) { /* 何もしない */ }
    }
    function paint() {
      q.value = state.q;
      sort.value = state.sort;
      genre.value = state.genre;
      bar.querySelectorAll("[data-status]").forEach(function (b) {
        b.setAttribute("aria-pressed", b.getAttribute("data-status") === state.status ? "true" : "false");
      });
      bar.querySelectorAll("[data-flag]").forEach(function (b) {
        b.setAttribute("aria-pressed", state.flags[b.getAttribute("data-flag")] ? "true" : "false");
      });
      bar.querySelectorAll("[data-play]").forEach(function (b) {
        b.setAttribute("aria-pressed", state.play[b.getAttribute("data-play")] ? "true" : "false");
      });
      var shown = 0;
      cards.slice().sort(cmp).forEach(function (c) {
        var ok = match(c);
        c.hidden = !ok;
        if (ok) shown++;
        grid.appendChild(c);   // 並べ替え
      });
      count.textContent = "";
      count.appendChild(el("strong", null, String(shown)));
      count.appendChild(document.createTextNode(" 本 / 全 " + cards.length + " 本"));
      reset.hidden = !active();
      if (empty) empty.hidden = shown > 0;
      syncUrl();
    }

    var timer;
    q.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.q = q.value.trim(); paint(); }, 120);
    });
    sort.addEventListener("change", function () { state.sort = sort.value; paint(); });
    genre.addEventListener("change", function () { state.genre = genre.value; paint(); });
    bar.addEventListener("click", function (ev) {
      var b = ev.target.closest("button");
      if (!b || !bar.contains(b)) return;
      if (b.hasAttribute("data-status")) state.status = b.getAttribute("data-status");
      else if (b.hasAttribute("data-flag")) { var f = b.getAttribute("data-flag"); state.flags[f] = !state.flags[f]; }
      else if (b.hasAttribute("data-play")) { var k = b.getAttribute("data-play"); state.play[k] = !state.play[k]; }
      else if (b.classList.contains("fb-reset")) state = { q: "", status: "", sort: "score", genre: "", flags: {}, play: {} };
      else return;
      paint();
    });
    bar.hidden = false;
    paint();
  }


  // ---------- 動画・スクリーンショットのビューア ----------
  var hlsPromise = null;
  function loadHls() {   // HLS を自前で再生できないブラウザ用。必要になったときだけ読み込む
    if (window.Hls) return Promise.resolve(window.Hls);
    if (!hlsPromise) {
      hlsPromise = new Promise(function (ok, ng) {
        var sc = document.createElement("script");
        sc.src = BASE + "/assets/js/vendor/hls.light.min.js";
        sc.onload = function () { window.Hls ? ok(window.Hls) : ng(new Error("hls")); };
        sc.onerror = ng;
        document.head.appendChild(sc);
      });
    }
    return hlsPromise;
  }
  function initMedia(root) {
    var stage = root.querySelector("[data-stage]");
    var thumbs = Array.prototype.slice.call(root.querySelectorAll(".media-thumb"));
    var counter = root.querySelector("[data-count]");
    var store = root.getAttribute("data-store") || "";
    var current = 0, hls = null;
    if (!thumbs.length) {   // 1 件だけ：最初の動画の再生だけ有効にする
      var only = stage.querySelector("[data-play]");
      if (only) only.addEventListener("click", function (ev) { ev.preventDefault(); play(null, only); });
      return;
    }

    function backdrop(src) {   // タイトル画像の後ろに敷く、ぼかした同じ画像
      var b = el("span", "media-backdrop");
      b.style.backgroundImage = "url(\"" + String(src).replace(/["\\]/g, "") + "\")";
      return b;
    }
    function clearStage() {
      if (hls) { try { hls.destroy(); } catch (e) { /* 何もしない */ } hls = null; }
      Array.prototype.slice.call(stage.children).forEach(function (c) {
        if (!c.classList.contains("media-nav") && !c.hasAttribute("data-count")) stage.removeChild(c);
      });
    }
    function fallback(msg) {
      clearStage();
      var box = el("div", "media-fallback");
      box.appendChild(el("p", null, msg));
      var a = el("a", "btn btn-light", "Steam ストアで見る ↗"); a.href = store + "#game_highlights"; a.target = "_blank"; a.rel = "noopener";
      box.appendChild(a);
      stage.insertBefore(box, stage.firstChild);
    }
    function play(t, poster) {
      var mp4 = t ? t.getAttribute("data-mp4") : "", src = t ? t.getAttribute("data-hls") : "";
      if (!t) { var first = root.querySelector(".media-thumb.is-video"); mp4 = first ? first.getAttribute("data-mp4") : ""; src = first ? first.getAttribute("data-hls") : ""; }
      var v = document.createElement("video");
      v.className = "media-video";
      v.controls = true; v.playsInline = true; v.preload = "auto";
      var img = poster && poster.querySelector("img");
      if (img) v.poster = img.src;
      clearStage();
      stage.insertBefore(v, stage.firstChild);
      var start = function () { var p = v.play(); if (p && p.catch) p.catch(function () { /* 自動再生が止められても操作で再生できる */ }); };
      if (mp4) { v.src = mp4; start(); return; }
      if (!src) { fallback("この動画はここでは再生できません。"); return; }
      if (v.canPlayType("application/vnd.apple.mpegurl")) { v.src = src; start(); return; }
      loadHls().then(function (Hls) {
        if (!Hls.isSupported()) { fallback("このブラウザでは動画を再生できません。"); return; }
        hls = new Hls({ capLevelToPlayerSize: true });
        hls.on(Hls.Events.ERROR, function (e, data) {
          if (data && data.fatal) fallback("動画を読み込めませんでした。Steam ストアでご覧ください。");
        });
        hls.loadSource(src);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, start);
      }).catch(function () { fallback("動画を読み込めませんでした。Steam ストアでご覧ください。"); });
    }
    function show(i, autoplay) {
      current = (i + thumbs.length) % thumbs.length;
      var t = thumbs[current];
      thumbs.forEach(function (x, j) { if (j === current) x.setAttribute("aria-current", "true"); else x.removeAttribute("aria-current"); });
      clearStage();
      if (t.getAttribute("data-type") === "video") {
        var a = el("button", "media-poster"); a.type = "button";
        var img = el("img"); img.src = t.getAttribute("data-poster") || ""; img.alt = t.getAttribute("data-label") || "";
        if (t.hasAttribute("data-title")) { a.classList.add("has-title"); a.appendChild(backdrop(img.src)); }
        a.appendChild(img);
        var btn = el("span", "mp-btn"); btn.setAttribute("aria-hidden", "true");
        btn.innerHTML = '<svg viewBox="0 0 24 24" width="28" height="28"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg>';   // 固定の図形のみ
        a.appendChild(btn);
        var meta = el("span", "mp-meta");
        meta.appendChild(el("span", "mp-label", t.getAttribute("data-label")));
        if (t.getAttribute("data-name")) meta.appendChild(el("span", "mp-name", t.getAttribute("data-name")));
        a.appendChild(meta);
        a.setAttribute("aria-label", (t.getAttribute("data-label") || "動画") + "を再生");
        a.addEventListener("click", function () { play(t, a); });
        stage.insertBefore(a, stage.firstChild);
        if (autoplay) play(t, a);
      } else {
        var im = el("img", "media-img"); im.src = t.getAttribute("data-full"); im.alt = t.getAttribute("aria-label") || "";
        if (t.hasAttribute("data-title")) im.classList.add("is-title");
        stage.insertBefore(im, stage.firstChild);
        if (t.hasAttribute("data-title")) stage.insertBefore(backdrop(im.src), stage.firstChild);
      }
      if (counter) counter.textContent = (current + 1) + " / " + thumbs.length;
      t.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
    // 最初から表示されているポスター（サーバーで作ったもの）の再生
    var poster0 = stage.querySelector("[data-play]");
    if (poster0) poster0.addEventListener("click", function (ev) { ev.preventDefault(); play(thumbs[0], poster0); });
    thumbs.forEach(function (t, i) { t.addEventListener("click", function () { show(i, false); }); });
    root.querySelectorAll("[data-step]").forEach(function (b) {
      b.hidden = false;
      b.addEventListener("click", function () { show(current + (+b.getAttribute("data-step")), false); });
    });
    root.addEventListener("keydown", function (ev) {
      if (ev.target.tagName === "VIDEO") return;
      if (ev.key === "ArrowRight") { show(current + 1, false); thumbs[current].focus(); ev.preventDefault(); }
      if (ev.key === "ArrowLeft") { show(current - 1, false); thumbs[current].focus(); ev.preventDefault(); }
    });
    // スワイプで切り替え（スマホ）
    var sx = null;
    stage.addEventListener("touchstart", function (ev) { sx = ev.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", function (ev) {
      if (sx == null || stage.querySelector("video")) return;
      var dx = ev.changedTouches[0].clientX - sx; sx = null;
      if (Math.abs(dx) > 40) show(current + (dx < 0 ? 1 : -1), false);
    });
  }

  // ---------- 表示の明るさ（ライト／ダーク） ----------
  // 何も選んでいないときは端末の設定に合わせる。ボタンで選んだら localStorage（nh-theme）に覚える。
  function initTheme() {
    var root = document.documentElement;
    var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
    function isDark() {
      var t = root.getAttribute("data-theme");
      return t ? t === "dark" : !!(mq && mq.matches);
    }
    function label() {
      document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
        b.setAttribute("aria-label", isDark() ? "ライトモードに切り替え" : "ダークモードに切り替え");
      });
    }
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) {
      b.addEventListener("click", function () {
        var next = isDark() ? "light" : "dark";
        root.setAttribute("data-theme", next);
        try { localStorage.setItem("nh-theme", next); } catch (e) { /* 保存できない環境では今回だけ切り替える */ }
        label();
      });
    });
    if (mq && mq.addEventListener) mq.addEventListener("change", label);
    label();
  }

  // ---------- 起動 ----------
  function init() {
    initTheme();
    paintButtons();
    paintCount();
    var wl = document.getElementById("watchlist");
    if (wl) renderWatchlist(wl);
    var fd = document.getElementById("finder");
    if (fd) renderFinder(fd);
    var gf = document.getElementById("game-filter");
    if (gf) initFilter(gf);
    document.querySelectorAll("[data-media]").forEach(initMedia);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
