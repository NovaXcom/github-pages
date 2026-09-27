/* 期待度ハイ＆ロー（/hilo/）。左の期待度を見て、右が高いか低いかを当て続ける。
 * 自己ベストはこのブラウザの localStorage（nh-hilo-v1）にだけ残る。 */
(function () {
  "use strict";
  var root = document.getElementById("hilo");
  if (!root) return;
  var BASE = (document.querySelector('meta[name="nh-base"]') || {}).content || "";
  var SHARE_URL = root.getAttribute("data-share-url") || location.href;
  var KEY = "nh-hilo-v1";
  var board = root.querySelector("[data-board]"), over = root.querySelector("[data-over]");
  var streakEl = root.querySelector("[data-streak]"), bestEl = root.querySelector("[data-best]");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var games = [], left = null, right = null, streak = 0, busy = false;
  var best = 0;
  try { best = (JSON.parse(localStorage.getItem(KEY) || "{}").best) || 0; } catch (e) { best = 0; }
  bestEl.textContent = best;

  var TITLES = [[0, "まずは肩慣らし", "🌱"], [3, "ゲーマー", "🎮"], [6, "情報通", "📡"], [10, "予言者", "🔮"],
                [15, "新作ソムリエ", "🍷"], [20, "NEXT HYPE 編集長級", "👑"]];
  function title(n) { var t = TITLES[0]; TITLES.forEach(function (x) { if (n >= x[0]) t = x; }); return t; }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function pick(exclude) {
    var g, tries = 0;
    do { g = games[Math.floor(Math.random() * games.length)]; tries++; }
    while (exclude && tries < 200 && (g.id === exclude.id || (tries < 100 && Math.abs(g.score - exclude.score) > 40)));
    return g;
  }
  function card(g, hidden) {
    var c = el("div", "hl-card");
    var img = el("img"); img.src = g.cap || g.img; img.alt = ""; c.appendChild(img);
    var body = el("div", "hl-body");
    body.appendChild(el("span", "hl-name", g.name));
    body.appendChild(el("span", "hl-meta", g.upcoming ? (g.release ? g.release + "発売予定" : "発売日未定") : g.release + "発売"));
    var sc = el("span", "hl-num", hidden ? "?" : String(g.score)); body.appendChild(sc);
    body.appendChild(el("span", "hl-label", "期待度"));
    c.appendChild(body);
    return { el: c, num: sc };
  }
  function render() {
    board.innerHTML = "";
    var a = card(left, false), b = card(right, true);
    var mid = el("div", "hl-vs", "VS");
    var btns = el("div", "hl-buttons");
    var hi = el("button", "gc-btn hl-hi", "▲ 高い"); hi.type = "button";
    var lo = el("button", "gc-btn hl-lo", "▼ 低い"); lo.type = "button";
    hi.onclick = function () { guess(true, b, [hi, lo]); };
    lo.onclick = function () { guess(false, b, [hi, lo]); };
    btns.appendChild(hi); btns.appendChild(lo);
    b.el.appendChild(btns);
    board.appendChild(a.el); board.appendChild(mid); board.appendChild(b.el);
  }
  function countUp(elm, to, done) {
    if (reduce) { elm.textContent = to; done(); return; }
    var start = null;
    function step(t) {
      if (start === null) start = t;
      var p = Math.min(1, (t - start) / 700);
      elm.textContent = Math.round(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step); else done();
    }
    requestAnimationFrame(step);
  }
  function guess(higher, b, btns) {
    if (busy) return;
    busy = true;
    btns.forEach(function (x) { x.disabled = true; });
    countUp(b.num, right.score, function () {
      var ok = right.score === left.score || (higher ? right.score > left.score : right.score < left.score);
      b.el.classList.add(ok ? "is-ok" : "is-ng");
      setTimeout(function () {
        if (ok) {
          streak++; streakEl.textContent = streak;
          if (streak > best) { best = streak; bestEl.textContent = best; try { localStorage.setItem(KEY, JSON.stringify({ best: best })); } catch (e) { /* 保存できなくても遊べる */ } }
          left = right; right = pick(left); busy = false; render();
        } else {
          end();
        }
      }, reduce ? 50 : 700);
    });
  }
  function end() {
    var t = title(streak);
    over.hidden = false; over.innerHTML = "";
    over.appendChild(el("p", "gc-banner", streak + " 連続正解！"));
    over.appendChild(el("p", "hl-title", t[2] + " 称号：" + t[1]));
    over.appendChild(el("p", "hl-answer", "正解は『" + right.name + "』の " + right.score + " 点でした（左は " + left.score + " 点）"));
    var box = el("div", "gc-actions");
    var text = "Steam新作『期待度ハイ＆ロー』で " + streak + " 連続正解！\n称号：" + t[1] + " " + t[2] + "\n\nあなたは何連続いける？\n#NEXTHYPEハイロー";
    var share = el("a", "gc-btn gc-btn-x", "𝕏 結果をシェア");
    share.href = "https://x.com/intent/post?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(SHARE_URL);
    share.target = "_blank"; share.rel = "noopener";
    var again = el("button", "gc-btn", "もう一度"); again.type = "button"; again.onclick = start;
    var look = el("a", "gc-btn gc-btn-ghost", "『" + right.name + "』を見る →"); look.href = right.url;
    box.appendChild(share); box.appendChild(again); box.appendChild(look);
    over.appendChild(box);
    over.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
  }
  function start() {
    streak = 0; streakEl.textContent = 0; over.hidden = true; busy = false;
    left = pick(null); right = pick(left); render();
  }
  fetch(BASE + "/games.json").then(function (r) { return r.json(); }).then(function (list) {
    games = list.filter(function (g) { return (g.cap || g.img) && g.score > 0; });
    start();
  }).catch(function () { board.innerHTML = "<p class='note'>読み込めませんでした。ページを再読み込みしてください。</p>"; });
})();
