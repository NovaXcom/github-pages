/* ゲーマータイプ診断（/type/）。6 問の答えから 8 タイプのどれかを出し、タイプに合う注目作を games.json から 1 本選ぶ。 */
(function () {
  "use strict";
  var root = document.getElementById("gtype");
  if (!root) return;
  var BASE = (document.querySelector('meta[name="nh-base"]') || {}).content || "";
  var SHARE_URL = root.getAttribute("data-share-url") || location.href;
  var box = root.querySelector("[data-box]");
  var TYPES = {
    tsumi: { name: "積みゲー錬金術師", emoji: "🧪", color: ["#ffb000", "#ff5c78"],
      text: "セールのたびにライブラリが増えていく錬金術師。遊んだ本数より買った本数が多いのは、いつか遊ぶための投資。",
      match: function (g) { return g.sale || !g.upcoming; } },
    dayone: { name: "発売日ダッシュ勢", emoji: "🏃", color: ["#2f4bff", "#5cc8ff"],
      text: "発売日の 0 時にはもうダウンロード済み。ネタバレより早く遊ぶのがポリシー。カレンダーは発売日で埋まっている。",
      match: function (g) { return g.upcoming && g.release_iso; } },
    coop: { name: "協力プレイ番長", emoji: "🤝", color: ["#28aa82", "#5cf2a0"],
      text: "「これ一緒にやろうぜ」が口ぐせ。ゲームは友達と遊んでこそ。通話をつなぐとつい朝になる。",
      match: function (g) { return (g.tags || []).indexOf("友達と協力プレイ") >= 0; } },
    bard: { name: "ひとり旅の吟遊詩人", emoji: "📖", color: ["#8b3dff", "#c9a6ff"],
      text: "物語と世界観にどっぷり浸かりたい派。エンディングの余韻で 1 日動けなくなることがある。",
      match: function (g) { return (g.tags || []).indexOf("ひとりでじっくり") >= 0 && (g.genres || []).some(function (x) { return /RPG|アドベンチャー/.test(x); }); } },
    indie: { name: "インディー発掘家", emoji: "💎", color: ["#e0a26b", "#ffd24a"],
      text: "まだ誰も知らない名作を見つけるのが生きがい。「それ、発売前から知ってた」と言える瞬間が最高。",
      match: function (g) { return (g.genres || []).indexOf("インディー") >= 0; } },
    spec: { name: "スペック至上主義者", emoji: "🖥️", color: ["#16161a", "#2f4bff"],
      text: "最新の大作を最高画質で。グラフィックボードの話になると早口になる。フレームレートは命。",
      match: function (g) { return (g.genres || []).indexOf("インディー") < 0 && g.score >= 65; } },
    cozy: { name: "まったりスローライフ民", emoji: "🌿", color: ["#28aa82", "#b8f0a0"],
      text: "畑を耕し、家具を並べ、村の人とおしゃべり。勝ち負けより、心がほどける時間が大事。",
      match: function (g) { return (g.genres || []).some(function (x) { return /シミュレーション|カジュアル/.test(x); }); } },
    hard: { name: "高難易度マゾゲーマー", emoji: "💀", color: ["#b3261e", "#ff5c78"],
      text: "死んで覚えるのが楽しい。100 回負けても、101 回目に勝てばすべて報われる。「ヌルゲー」は褒め言葉じゃない。",
      match: function (g) { return (g.genres || []).indexOf("アクション") >= 0; } }
  };
  var QS = [
    ["Steam のセール、どうしてる？", [["気になるものを片っ端から買う", { tsumi: 3 }], ["本命だけ買う", { dayone: 1, bard: 1 }], ["セールは見ない、発売日に買う", { dayone: 3 }], ["無料配布だけもらう", { indie: 1, cozy: 1 }]]],
    ["ゲームは誰と遊ぶことが多い？", [["いつも友達と通話しながら", { coop: 3 }], ["ひとりで集中して", { bard: 2, hard: 1 }], ["気分しだい", { tsumi: 1, cozy: 1 }], ["配信や動画を見ながら", { dayone: 1, spec: 1 }]]],
    ["好きなゲームの雰囲気は？", [["泣ける物語", { bard: 3 }], ["まったり癒やし", { cozy: 3 }], ["歯ごたえのある難しさ", { hard: 3 }], ["圧倒的なグラフィック", { spec: 3 }]]],
    ["ゲームを選ぶ決め手は？", [["誰も知らない面白そうなもの", { indie: 3 }], ["話題の大作", { spec: 2, dayone: 1 }], ["安くなっていること", { tsumi: 2 }], ["友達がやってること", { coop: 2 }]]],
    ["ゲームオーバーになったら？", [["燃える、すぐリトライ", { hard: 3 }], ["一旦休憩してお茶", { cozy: 2 }], ["攻略を調べる", { bard: 1, spec: 1 }], ["別のゲームを起動する", { tsumi: 2, indie: 1 }]]],
    ["理想の休日の遊び方は？", [["新作を朝から晩まで", { dayone: 2, hard: 1 }], ["友達と夜通し協力プレイ", { coop: 2 }], ["小さなインディーを何本も", { indie: 2 }], ["のんびり箱庭づくり", { cozy: 2 }]]]
  ];
  var games = [], score = {}, qi = 0;
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function startQuiz() { score = {}; Object.keys(TYPES).forEach(function (k) { score[k] = 0; }); qi = 0; ask(); }
  function ask() {
    box.innerHTML = "";
    var q = QS[qi];
    box.appendChild(el("p", "gt-progress", "Q" + (qi + 1) + " / " + QS.length));
    var bar = el("div", "gt-bar"); var fill = el("span"); fill.style.width = (qi / QS.length * 100) + "%"; bar.appendChild(fill); box.appendChild(bar);
    box.appendChild(el("h2", "gt-q", q[0]));
    var list = el("div", "gt-options");
    q[1].forEach(function (o) {
      var b = el("button", "gt-option", o[0]); b.type = "button";
      b.onclick = function () {
        Object.keys(o[1]).forEach(function (k) { score[k] += o[1][k]; });
        qi++; if (qi < QS.length) ask(); else result();
      };
      list.appendChild(b);
    });
    box.appendChild(list);
  }
  function result() {
    var keys = Object.keys(TYPES);
    var top = Math.max.apply(null, keys.map(function (k) { return score[k]; }));
    var winners = keys.filter(function (k) { return score[k] === top; });
    var key = winners[Math.floor(Math.random() * winners.length)], t = TYPES[key];
    var cands = games.filter(t.match).sort(function (a, b) { return b.score - a.score; }).slice(0, 5);
    var rec = cands.length ? cands[Math.floor(Math.random() * cands.length)] : games[0];
    box.innerHTML = "";
    var card = el("div", "gt-result");
    card.style.setProperty("--c1", t.color[0]); card.style.setProperty("--c2", t.color[1]);
    card.appendChild(el("p", "gt-you", "あなたのゲーマータイプは…"));
    card.appendChild(el("div", "gt-emoji", t.emoji));
    card.appendChild(el("h2", "gt-name", t.name));
    card.appendChild(el("p", "gt-text", t.text));
    box.appendChild(card);
    if (rec) {
      box.appendChild(el("p", "gt-rec-head", "そんなあなたにおすすめの注目新作"));
      var a = el("a", "gt-rec"); a.href = rec.url;
      var img = el("img"); img.src = rec.cap || rec.img; img.alt = ""; a.appendChild(img);
      var body = el("span", "gt-rec-body");
      body.appendChild(el("b", null, rec.name));
      body.appendChild(el("span", null, "期待度 " + rec.score + " ・ " + (rec.upcoming ? (rec.release ? rec.release + "発売予定" : "発売日未定") : rec.release + "発売") + (rec.ja ? " ・ 日本語対応" : "")));
      a.appendChild(body);
      box.appendChild(a);
    }
    var acts = el("div", "gc-actions");
    var text = "私のゲーマータイプは【" + t.name + "】" + t.emoji + "でした！\n" + (rec ? "おすすめの新作は『" + rec.name + "』\n" : "") + "\nあなたは何タイプ？\n#NEXTHYPE診断";
    var share = el("a", "gc-btn gc-btn-x", "𝕏 結果をシェア");
    share.href = "https://x.com/intent/post?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(SHARE_URL);
    share.target = "_blank"; share.rel = "noopener";
    var again = el("button", "gc-btn", "もう一度"); again.type = "button"; again.onclick = startQuiz;
    var gacha = el("a", "gc-btn gc-btn-ghost", "ガチャも引く →"); gacha.href = BASE + "/gacha/";
    acts.appendChild(share); acts.appendChild(again); acts.appendChild(gacha);
    box.appendChild(acts);
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  fetch(BASE + "/games.json").then(function (r) { return r.json(); }).then(function (list) {
    games = list.filter(function (g) { return g.cap || g.img; });
    box.innerHTML = "";
    var b = el("button", "gc-btn gc-btn-main", "診断スタート"); b.type = "button"; b.onclick = startQuiz;
    box.appendChild(b);
  }).catch(function () { box.innerHTML = "<p class='note'>読み込めませんでした。ページを再読み込みしてください。</p>"; });
})();
