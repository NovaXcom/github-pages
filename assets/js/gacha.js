/* Steam新作ガチャ（/gacha/）。games.json から、期待度に応じたレア度で 1 本（または 10 本）を引く。
 * 結果は X でシェアでき、引いた作品は「図鑑」としてこのブラウザの localStorage（nh-gacha-v1）にだけ残る。 */
(function () {
  "use strict";
  var root = document.getElementById("gacha");
  if (!root) return;
  var BASE = (document.querySelector('meta[name="nh-base"]') || {}).content || "";
  var SHARE_URL = root.getAttribute("data-share-url") || location.href;
  var KEY = "nh-gacha-v1";
  var RATES = [["UR", 85, 1], ["SSR", 70, 9], ["SR", 55, 30], ["R", 40, 40], ["N", 0, 20]];
  var ORDER = { UR: 5, SSR: 4, SR: 3, R: 2, N: 1 };
  var pools = {}, total = 0, busy = false;
  var stage = root.querySelector("[data-stage]");
  var orb = root.querySelector("[data-orb]");
  var soundBtn = root.querySelector("[data-sound]");
  var dexEl = root.querySelector("[data-dex]");
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function load() { try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* 保存できなくても遊べる */ } }
  var state = load();
  state.dex = state.dex || [];
  if (state.sound === undefined) state.sound = true;

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function rarityOf(score) { for (var i = 0; i < RATES.length; i++) if (score >= RATES[i][1]) return RATES[i][0]; return "N"; }
  function paintDex() { dexEl.textContent = "図鑑 " + state.dex.length + " / " + total + " 本"; }
  function paintSound() {
    soundBtn.textContent = state.sound ? "🔊 音あり" : "🔇 音なし";
    soundBtn.setAttribute("aria-pressed", state.sound ? "true" : "false");
  }

  // ---- 効果音（WebAudio でその場で鳴らす。ファイルは使わない） ----
  var ac = null;
  function tone(freq, start, dur, type, gain) {
    if (!state.sound) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      var o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + start;
      o.type = type || "triangle"; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain || 0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + dur + 0.05);
    } catch (e) { /* 音が出せない環境では何もしない */ }
  }
  function rattle() { for (var i = 0; i < 8; i++) tone(220 + (i % 2) * 90, i * 0.09, 0.07, "square", 0.04); }
  function fanfare(r) {
    var n = ORDER[r];
    var notes = [523, 659, 784, 1047, 1319].slice(0, Math.max(2, n));
    notes.forEach(function (f, i) { tone(f, i * 0.09, 0.5, "triangle", 0.1); });
    if (n >= 4) [1568, 2093].forEach(function (f, i) { tone(f, 0.5 + i * 0.12, 0.8, "sine", 0.07); });
  }

  // ---- 抽選 ----
  function pickRarity(minRank) {
    var cands = RATES.filter(function (r) { return pools[r[0]].length && ORDER[r[0]] >= (minRank || 0); });
    var sum = cands.reduce(function (a, r) { return a + r[2]; }, 0), x = Math.random() * sum;
    for (var i = 0; i < cands.length; i++) { x -= cands[i][2]; if (x <= 0) return cands[i][0]; }
    return cands[cands.length - 1][0];
  }
  function pull(minRank) {
    var r = pickRarity(minRank), pool = pools[r];
    return { r: r, g: pool[Math.floor(Math.random() * pool.length)] };
  }
  function record(res) {
    res.forEach(function (x) {
      x.isNew = state.dex.indexOf(x.g.id) < 0;
      if (x.isNew) state.dex.push(x.g.id);
    });
    save(state); paintDex();
  }

  // ---- 表示 ----
  function card(x, small) {
    var c = el("div", "gc-card rar-bg-" + x.r + (small ? " is-small" : ""));
    var inner = el("div", "gc-card-inner");
    var back = el("div", "gc-card-back"); back.appendChild(el("span", null, "?"));
    var front = el("a", "gc-card-front");
    front.href = BASE + x.g.url.replace(BASE, "");
    var img = el("img"); img.src = x.g.cap || x.g.img; img.alt = ""; img.loading = "lazy";
    front.appendChild(img);
    var info = el("div", "gc-card-info");
    info.appendChild(el("b", "rar rar-" + x.r, x.r));
    if (x.isNew) info.appendChild(el("span", "gc-new", "NEW"));
    info.appendChild(el("span", "gc-card-name", x.g.name));
    if (!small) info.appendChild(el("span", "gc-card-meta",
      "期待度 " + x.g.score + " ・ " + (x.g.upcoming ? (x.g.release ? x.g.release + "発売予定" : "発売日未定") : (x.g.release + "発売")) + (x.g.ja ? " ・ 日本語対応" : "")));
    front.appendChild(info);
    inner.appendChild(back); inner.appendChild(front); c.appendChild(inner);
    return c;
  }
  function shareText(res) {
    if (res.length === 1) {
      var x = res[0];
      return "Steam新作ガチャを引いたら【" + x.r + "】『" + x.g.name + "』が出た🎰✨\n期待度 " + x.g.score + " 点\n\nあなたは何が出る？\n#NEXTHYPEガチャ";
    }
    var counts = {}; res.forEach(function (x) { counts[x.r] = (counts[x.r] || 0) + 1; });
    var best = res.slice().sort(function (a, b) { return ORDER[b.r] - ORDER[a.r] || b.g.score - a.g.score; })[0];
    var line = ["UR", "SSR", "SR", "R", "N"].filter(function (r) { return counts[r]; }).map(function (r) { return r + "×" + counts[r]; }).join(" ");
    return "Steam新作ガチャ 10連の結果🎰\n" + line + "\n最高レアは【" + best.r + "】『" + best.g.name + "』！\n\nあなたも引いてみて👇\n#NEXTHYPEガチャ";
  }
  function actions(res) {
    var box = el("div", "gc-actions");
    var share = el("a", "gc-btn gc-btn-x", "𝕏 結果をシェア");
    share.href = "https://x.com/intent/post?text=" + encodeURIComponent(shareText(res)) + "&url=" + encodeURIComponent(SHARE_URL);
    share.target = "_blank"; share.rel = "noopener";
    var again = el("button", "gc-btn", "もう1回"); again.type = "button"; again.onclick = function () { go(1); };
    var ten = el("button", "gc-btn", "10連"); ten.type = "button"; ten.onclick = function () { go(10); };
    box.appendChild(share); box.appendChild(again); box.appendChild(ten);
    if (res.length === 1) {
      var look = el("a", "gc-btn gc-btn-ghost", "このゲームを見る →"); look.href = res[0].g.url;
      box.appendChild(look);
    }
    return box;
  }
  function burst(target, r) {
    if (reduce || ORDER[r] < 3) return;
    var colors = r === "UR" ? ["#ff5c78", "#ffd24a", "#5cf2a0", "#5cc8ff", "#b77bff"] : r === "SSR" ? ["#ffd24a", "#fff3b0", "#ffb000"] : ["#c9d1ff", "#8b3dff", "#ffffff"];
    var n = ORDER[r] >= 4 ? 70 : 30;
    for (var i = 0; i < n; i++) {
      var p = el("i", "gc-confetti");
      p.style.left = (50 + (Math.random() - 0.5) * 20) + "%";
      p.style.background = colors[i % colors.length];
      p.style.setProperty("--dx", ((Math.random() - 0.5) * 900) + "px");
      p.style.setProperty("--dy", (-200 - Math.random() * 500) + "px");
      p.style.setProperty("--r", (Math.random() * 720) + "deg");
      p.style.animationDelay = (Math.random() * 0.15) + "s";
      target.appendChild(p);
      setTimeout(function (q) { return function () { q.remove(); }; }(p), 1800);
    }
  }

  function go(n) {
    if (busy || !total) return;
    busy = true;
    var res = [];
    for (var i = 0; i < n; i++) res.push(pull(n === 10 && i === 9 ? ORDER.SR : 0));
    if (n === 10 && !res.some(function (x) { return ORDER[x.r] >= ORDER.SR; })) res[9] = pull(ORDER.SR);
    record(res);
    var top = res.reduce(function (a, x) { return ORDER[x.r] > ORDER[a.r] ? x : a; }, res[0]);
    stage.hidden = false;
    stage.innerHTML = "";
    stage.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" });
    // 1. 玉がゆれる（最高レアの色が少し見える＝確定演出）
    orb.className = "gc-orb is-shaking hint-" + top.r;
    rattle();
    var wait = reduce ? 50 : 1300;
    setTimeout(function () {
      orb.className = "gc-orb";
      root.classList.add("is-flash");
      setTimeout(function () { root.classList.remove("is-flash"); }, reduce ? 10 : 260);
      var grid = el("div", n === 1 ? "gc-result" : "gc-result is-ten");
      if (n === 1) grid.appendChild(el("p", "gc-banner rar-text-" + top.r, top.r === "N" ? "N" : top.r + " 獲得！"));
      res.forEach(function (x) { grid.appendChild(card(x, n > 1)); });
      stage.appendChild(grid);
      var cards = grid.querySelectorAll(".gc-card");
      cards.forEach(function (c, i) {
        setTimeout(function () { c.classList.add("is-open"); }, reduce ? 0 : 150 + i * (n > 1 ? 140 : 0));
      });
      setTimeout(function () {
        fanfare(top.r);
        burst(stage, top.r);
        stage.appendChild(actions(res));
        busy = false;
      }, reduce ? 0 : 150 + (n > 1 ? cards.length * 140 : 0) + 450);
    }, wait);
  }

  soundBtn.onclick = function () { state.sound = !state.sound; save(state); paintSound(); };
  paintSound();
  fetch(BASE + "/games.json").then(function (r) { return r.json(); }).then(function (games) {
    RATES.forEach(function (r) { pools[r[0]] = []; });
    games.forEach(function (g) { if (g.cap || g.img) { pools[rarityOf(g.score || 0)].push(g); total++; } });
    paintDex();
    root.querySelectorAll("[data-pull]").forEach(function (b) {
      b.disabled = false;
      b.onclick = function () { go(+b.getAttribute("data-pull")); };
    });
  }).catch(function () { dexEl.textContent = "読み込めませんでした。ページを再読み込みしてください。"; });
})();
