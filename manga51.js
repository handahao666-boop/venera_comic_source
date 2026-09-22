// 51漫画 (m.51manga.com) Venera 漫画源
// 版本: 1.2.0
// 基线: meaninglesslyy/venera-config 的 normal_comic/51manga.js v1.1.0
//       保留原 key `manga51`，用户已有设置/收藏/历史不失效。
// 证据基准: 2026-09-22 真网取证（详见 manga51_development_log.md）
//
// 已实测的站点结构：
//   首页     GET https://m.51manga.com/                     200，5 个 .panel、24 张 .comic-item
//   分类     GET /category[/{param}][/page/{n}]             200，容器 id="comic-list"，分页 <cite>当前/总数</cite>
//   最新更新 GET /custom/update                             200，容器 id="content-container"，无分页控件
//   搜索     GET /search?key={kw}（第 1 页） / /search/{kw}/{n}（第 n>1 页）
//   详情     GET /mh/{id}                                   200，.comic_cover / .comic_name h1.name / .metas-desc > p / .chapter-list
//   章节     GET /show/{epId}.html                          200，图片列表在 AES-128-CBC 加密的 params 变量里
//   图片     img1.baipiaoguai.org，必须带 51manga 域名的 Referer（实测无 Referer -> 403）
//
// 章节图片载荷：AES-128-CBC，key 固定，IV = 密文 base64 解码后的前 16 字节，其余为密文，PKCS#7 填充。
// 优先调用 Venera 官方 Convert.decryptAesCbc（官方 ccc.js 同款做法），不可用时回退到内置纯 JS 实现。

// ---------------------------------------------------------------- 纯 JS AES-128-CBC 回退实现
// S-box 由 GF(2^8) 求逆 + 仿射变换运行时生成，避免硬编码 256 字节表带来的抄写风险。
const AES_SBOX = (function () {
  const rotl8 = (x, n) => ((x << n) | (x >> (8 - n))) & 0xff;
  const xtime = (a) => ((a << 1) ^ ((a & 0x80) ? 0x1b : 0)) & 0xff;
  const mul = (a, b) => {
    let r = 0;
    while (b) {
      if (b & 1) r ^= a;
      a = xtime(a);
      b >>= 1;
    }
    return r & 0xff;
  };
  const pow = (a, n) => {
    let r = 1;
    while (n) {
      if (n & 1) r = mul(r, a);
      a = mul(a, a);
      n >>= 1;
    }
    return r;
  };
  const inv = new Uint8Array(256);
  const sbox = new Uint8Array(256);
  for (let i = 1; i < 256; i++) inv[i] = pow(i, 254);
  for (let i = 0; i < 256; i++) {
    const x = inv[i];
    sbox[i] = (rotl8(x, 0) ^ rotl8(x, 1) ^ rotl8(x, 2) ^ rotl8(x, 3) ^ rotl8(x, 4) ^ 0x63) & 0xff;
  }
  return sbox;
})();

const AES_RSBOX = (function () {
  const r = new Uint8Array(256);
  for (let i = 0; i < 256; i++) r[AES_SBOX[i]] = i;
  return r;
})();

const AES_RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

function aesKeyExpansion(key) {
  const Nk = 4, Nb = 4, Nr = 10;
  const w = new Uint8Array(Nb * (Nr + 1) * 4);
  for (let i = 0; i < 4 * Nk; i++) w[i] = key[i];
  const t = new Uint8Array(4);
  for (let i = Nk; i < Nb * (Nr + 1); i++) {
    for (let j = 0; j < 4; j++) t[j] = w[(i - 1) * 4 + j];
    if (i % Nk === 0) {
      const t0 = t[0];
      t[0] = AES_SBOX[t[1]] ^ AES_RCON[i / Nk];
      t[1] = AES_SBOX[t[2]];
      t[2] = AES_SBOX[t[3]];
      t[3] = AES_SBOX[t0];
    }
    for (let j = 0; j < 4; j++) w[i * 4 + j] = w[(i - Nk) * 4 + j] ^ t[j];
  }
  return w;
}

function gmul(a, b) {
  let p = 0;
  for (let i = 0; i < 8; i++) {
    if (b & 1) p ^= a;
    const hi = a & 0x80;
    a = (a << 1) & 0xff;
    if (hi) a ^= 0x1b;
    b >>= 1;
  }
  return p & 0xff;
}

// AES 状态按列主序存放：state[r][c] 对应输入字节 state[i%4][floor(i/4)]，
// 轮密钥 w 的下标为 round*16 + 4*c + r。布局写错会得到全错的明文，务必与向量对齐。
function aesDecryptBlock(input, w) {
  const Nr = 10;
  const s = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
  for (let i = 0; i < 16; i++) s[i % 4][Math.floor(i / 4)] = input[i];
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) s[r][c] ^= w[Nr * 16 + c * 4 + r];
  for (let round = Nr - 1; round >= 1; round--) {
    for (let r = 1; r < 4; r++) {
      const row = s[r].slice();
      for (let c = 0; c < 4; c++) s[r][c] = row[(c - r + 4) % 4];
    }
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) s[r][c] = AES_RSBOX[s[r][c]];
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) s[r][c] ^= w[round * 16 + c * 4 + r];
    for (let c = 0; c < 4; c++) {
      const a0 = s[0][c], a1 = s[1][c], a2 = s[2][c], a3 = s[3][c];
      s[0][c] = gmul(a0, 0x0e) ^ gmul(a1, 0x0b) ^ gmul(a2, 0x0d) ^ gmul(a3, 0x09);
      s[1][c] = gmul(a0, 0x09) ^ gmul(a1, 0x0e) ^ gmul(a2, 0x0b) ^ gmul(a3, 0x0d);
      s[2][c] = gmul(a0, 0x0d) ^ gmul(a1, 0x09) ^ gmul(a2, 0x0e) ^ gmul(a3, 0x0b);
      s[3][c] = gmul(a0, 0x0b) ^ gmul(a1, 0x0d) ^ gmul(a2, 0x09) ^ gmul(a3, 0x0e);
    }
  }
  for (let r = 1; r < 4; r++) {
    const row = s[r].slice();
    for (let c = 0; c < 4; c++) s[r][c] = row[(c - r + 4) % 4];
  }
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) s[r][c] = AES_RSBOX[s[r][c]];
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) s[r][c] ^= w[c * 4 + r];
  const out = new Uint8Array(16);
  for (let i = 0; i < 16; i++) out[i] = s[i % 4][Math.floor(i / 4)];
  return out;
}

function aes128CbcDecrypt(cipher, key, iv) {
  const w = aesKeyExpansion(key);
  const out = new Uint8Array(cipher.length);
  let prev = iv;
  for (let off = 0; off < cipher.length; off += 16) {
    const block = cipher.subarray(off, off + 16);
    const dec = aesDecryptBlock(block, w);
    for (let i = 0; i < 16; i++) out[off + i] = dec[i] ^ prev[i];
    prev = block;
  }
  return out;
}

// PKCS#7 去填充；填充非法时原样返回（避免把正常数据截断）。
// 注意必须返回新的数组：subarray 会共享底层 buffer，转交给 Convert.decodeUtf8 时会带上填充字节。
function stripPkcs7(bytes) {
  if (!bytes || bytes.length === 0) return bytes;
  const pad = bytes[bytes.length - 1];
  if (pad < 1 || pad > 16 || pad > bytes.length) return bytes;
  for (let i = bytes.length - pad; i < bytes.length; i++) if (bytes[i] !== pad) return bytes;
  return bytes.slice(0, bytes.length - pad);
}

// UTF-8 解码（手写，不使用已废弃的 escape/unescape）
function decodeUtf8(bytes) {
  let out = "";
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i];
    if (b1 < 0x80) { out += String.fromCharCode(b1); i += 1; }
    else if (b1 >= 0xc0 && b1 < 0xe0) {
      out += String.fromCharCode(((b1 & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2;
    } else if (b1 >= 0xe0 && b1 < 0xf0) {
      out += String.fromCharCode(((b1 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3;
    } else {
      const cp = ((b1 & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f);
      const v = cp - 0x10000;
      out += String.fromCharCode(0xd800 + (v >> 10)) + String.fromCharCode(0xdc00 + (v & 0x3ff));
      i += 4;
    }
  }
  return out;
}

// base64 -> Uint8Array（兼容 base64url 与缺失的结尾填充）
function base64ToBytes(b64) {
  const CH = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const s = String(b64 == null ? "" : b64).replace(/-/g, "+").replace(/_/g, "/").replace(/=+$/, "");
  const out = new Uint8Array((s.length * 3) >> 2);
  let o = 0, buf = 0, bits = 0;
  for (let i = 0; i < s.length; i++) {
    const idx = CH.indexOf(s.charAt(i));
    if (idx < 0) continue;
    buf = (buf << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (buf >> bits) & 0xff;
    }
  }
  return out.subarray(0, o);
}

// ---------------------------------------------------------------- 源定义

class Manga51 extends ComicSource {
  name = "51漫画";
  // 沿用上游 key，升级后用户设置、收藏与历史不会失效
  key = "manga51";
  version = "1.2.0";
  minAppVersion = "1.6.0";
  url = "";

  // 移动站结构最简（.panel / .comic-item / .chapter-list），列表、详情、章节都走它
  static host = "https://m.51manga.com";
  // PC 站仅用于图片 Referer（实测 m / www 均可，固定一个更稳）
  static webHost = "https://www.51manga.com";
  static imgReferer = "https://www.51manga.com/";
  static imgCdn = "https://img1.baipiaoguai.org";
  static aesKey = "9S8$vJnU2ANeSRoF";
  static ua = "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

  // 地区：/category/list/{1..4}（已实测标题依次为 国产/日本/韩国/欧美漫画）
  static regions = [
    ["全部", ""],
    ["国产漫画", "list/1"],
    ["日本漫画", "list/2"],
    ["韩国漫画", "list/3"],
    ["欧美漫画", "list/4"]
  ];
  // 题材：/category/tags/{867..877}（分类页筛选区实测全量 11 个；站点自身 872/873 同名“恋爱”）
  static tags = [
    ["全部", ""],
    ["科幻", "tags/867"],
    ["后宫", "tags/868"],
    ["机甲", "tags/869"],
    ["都市", "tags/870"],
    ["恋爱生活", "tags/871"],
    ["恋爱", "tags/872"],
    ["恋爱（2）", "tags/873"],
    ["其他", "tags/874"],
    ["推理悬疑", "tags/875"],
    ["魔法", "tags/876"],
    ["奇幻", "tags/877"]
  ];
  // 进度：/category/finish/{1,2}（实测 finish/1 标题为“连载”，finish/2 为“完结”）
  static statuses = [
    ["全部", ""],
    ["连载中", "finish/1"],
    ["已完结", "finish/2"]
  ];

  get headers() {
    return {
      "User-Agent": Manga51.ua,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9",
      "Referer": Manga51.webHost + "/"
    };
  }

  // 图片 CDN 强制校验 Referer：实测不带 Referer 与以图片域名为 Referer 都返回 403
  get imageHeaders() {
    return {
      "User-Agent": Manga51.ua,
      "Referer": Manga51.imgReferer,
      "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9"
    };
  }

  // ---------- 通用工具 ----------

  trim(v) { return String(v == null ? "" : v).trim(); }

  isPlaceholderImage(u) {
    const s = this.trim(u).toLowerCase();
    if (!s) return true;
    if (s.indexOf("data:image/") === 0) return true;
    if (s.indexOf("placeholder") >= 0) return true;
    if (/\.svg($|\?)/.test(s)) return true;
    return false;
  }

  absolutize(u, base) {
    const s = this.trim(u);
    if (!s) return "";
    if (s.indexOf("//") === 0) return "https:" + s;
    if (s.indexOf("http://") === 0 || s.indexOf("https://") === 0) return s;
    return (base || Manga51.host) + (s.charAt(0) === "/" ? s : "/" + s);
  }

  // 站点是 layui 懒加载模板：lay-src / data-src 才是真实图，src 可能是占位图，所以后取 src
  imageFromEl(el) {
    if (!el || !el.attributes) return "";
    const a = el.attributes;
    const order = [a["lay-src"], a["data-src"], a["data-original"], a["data-echo"], a["src"]];
    for (const c of order) {
      const s = this.trim(c);
      if (!s || this.isPlaceholderImage(s)) continue;
      return this.absolutize(s, Manga51.host);
    }
    return "";
  }

  comicIdFromHref(href) {
    const m = /\/mh\/([A-Za-z0-9]+)/.exec(this.trim(href));
    return m ? m[1] : "";
  }

  // 漫画 ID 规范化：接受裸 id 或完整 /mh/ 链接
  normalizeComicId(input) {
    const s = this.trim(input);
    if (!s) return "";
    const m = /\/mh\/([A-Za-z0-9]+)/.exec(s);
    if (m) return m[1];
    return /^[A-Za-z0-9]{4,32}$/.test(s) ? s : "";
  }

  // 章节 ID 规范化。站点只认 /show/{裸id}.html：
  // 实测 /show/{id} 与 /show/{id}.html.html 都是 404，所以历史里存过完整 URL／带扩展名的值必须先剥掉。
  normalizeEpId(input) {
    const s = this.trim(input);
    if (!s) return "";
    const m = /\/show\/([A-Za-z0-9]+)/.exec(s);
    if (m) return m[1];
    const bare = s.replace(/\.html?$/i, "");
    return /^[A-Za-z0-9]{4,32}$/.test(bare) ? bare : "";
  }

  // ---------- 卡片解析 ----------

  parseComic(a) {
    if (!a || !a.attributes) return null;
    const id = this.comicIdFromHref(a.attributes.href);
    if (!id) return null;
    const img = a.querySelector("img");
    let title = "";
    const t = a.querySelector(".title");
    if (t) title = t.text.trim();
    if (!title && img && img.attributes) title = this.trim(img.attributes.alt);
    if (!title) title = this.trim(a.attributes.title);
    if (!title) title = id;
    const sub = a.querySelector(".txt");
    return new Comic({
      id: id,
      title: title,
      cover: this.imageFromEl(img),
      subTitle: sub ? sub.text.trim() : ""
    });
  }

  parseComicList(html) {
    const doc = new HtmlDocument(html);
    try {
      const comics = [];
      const seen = {};
      for (const a of doc.querySelectorAll('a[href*="/mh/"]')) {
        const c = this.parseComic(a);
        if (!c || seen[c.id]) continue;
        seen[c.id] = true;
        comics.push(c);
      }
      return comics;
    } finally {
      doc.dispose();
    }
  }

  parsePanelList(panel) {
    const comics = [];
    const seen = {};
    for (const item of panel.querySelectorAll(".comic-item")) {
      const c = this.parseComic(item.querySelector('a[href*="/mh/"]'));
      if (!c || seen[c.id]) continue;
      seen[c.id] = true;
      comics.push(c);
    }
    return comics;
  }

  // ---------- 分页状态 ----------

  // 站点在页码越界时不会返回空页，而是回落成首页：页面出现 5 个 .panel、容器 id 变成
  // comic-list-1，且完全没有 <cite>。实测 /category/page/51 与 /search/爱/11 都是这样。
  // 若不识别，会把首页 24 张无关漫画当成搜索结果，并把 maxPage 当成当前页从而无限翻页。
  isHomeFallback(html) {
    return html.indexOf('id="comic-list-1"') >= 0 && html.indexOf('id="comic-list"') < 0;
  }

  // 统一用 <cite>当前页/总页数</cite> 判定；返回 { end, maxPage }
  pageState(html, page, fallbackMaxPage) {
    const m = /<cite>\s*(\d+)\s*\/\s*(\d+)\s*<\/cite>/.exec(html);
    if (m) {
      const cur = parseInt(m[1], 10);
      const total = parseInt(m[2], 10);
      if (!isNaN(cur) && !isNaN(total)) {
        const max = total > 0 ? total : 1;
        // 实测 /category/tags/867/page/32 -> <cite>32/31</cite> 且列表为空：越界时 cur > total
        return { end: cur > total, maxPage: max };
      }
    }
    if (this.isHomeFallback(html)) return { end: true, maxPage: page > 1 ? page - 1 : 1 };
    return { end: false, maxPage: fallbackMaxPage };
  }

  // ---------- 探索页 ----------

  explore = [
    {
      title: "51漫画",
      type: "multiPartPage",
      load: async () => {
        const res = await Network.get(Manga51.host + "/", this.headers);
        if (res.status !== 200) throw `Invalid status code: ${res.status}`;
        const doc = new HtmlDocument(res.body);
        const parts = [];
        try {
          // 首页 .panel 标题 -> 对应地区分类参数（实测 4 个地区区块 + 1 个友情链接区块）
          const regionMap = {
            "国产漫画": "list/1",
            "日本漫画": "list/2",
            "韩国漫画": "list/3",
            "欧美漫画": "list/4"
          };
          for (const panel of doc.querySelectorAll(".panel")) {
            const heading = panel.querySelector(".panel-heading h2");
            if (!heading) continue;
            const title = heading.text.trim();
            const comics = this.parsePanelList(panel);
            if (comics.length === 0) continue;
            const part = { title: title, comics: comics };
            const param = regionMap[title];
            if (param) {
              part.viewMore = {
                page: "category",
                attributes: { category: title, param: param }
              };
            }
            parts.push(part);
          }
        } finally {
          doc.dispose();
        }
        if (parts.length === 0) throw "首页未解析到任何推荐区块，站点结构可能已变更";
        return parts;
      }
    },
    {
      title: "最近更新",
      type: "multiPageComicList",
      load: async (page) => {
        const p = page && page > 0 ? page : 1;
        // 已实测 /custom/update 没有分页控件，且 /custom/update/page/2 与第 1 页内容逐条相同
        if (p > 1) return { comics: [], maxPage: 1 };
        const res = await Network.get(Manga51.host + "/custom/update", this.headers);
        if (res.status !== 200) throw `Invalid status code: ${res.status}`;
        return { comics: this.parseComicList(res.body), maxPage: 1 };
      }
    }
  ];

  // ---------- 分类 ----------

  category = {
    title: "51漫画",
    parts: [
      {
        name: "地区",
        type: "fixed",
        itemType: "category",
        categories: Manga51.regions.map((e) => e[0]),
        categoryParams: Manga51.regions.map((e) => e[1])
      },
      {
        name: "题材",
        type: "fixed",
        itemType: "category",
        categories: Manga51.tags.map((e) => e[0]),
        categoryParams: Manga51.tags.map((e) => e[1])
      },
      {
        name: "进度",
        type: "fixed",
        itemType: "category",
        categories: Manga51.statuses.map((e) => e[0]),
        categoryParams: Manga51.statuses.map((e) => e[1])
      }
    ],
    enableRankingPage: false
  };

  categoryComics = {
    // 站点支持组合筛选（实测 /category/list/1/tags/867 与 /category/list/1/finish/1 均有效），
    // 而 Venera 的多个 part 是互斥入口，所以这里再用 optionList 提供“地区之外的另一个维度”。
    optionList: [
      { options: ["-全部"].concat(Manga51.tags.filter((e) => e[1]).map((e) => e[1] + "-" + e[0])) },
      { options: ["-全部"].concat(Manga51.statuses.filter((e) => e[1]).map((e) => e[1] + "-" + e[0])) }
    ],
    load: async (category, param, options, page) => {
      const p = page && page > 0 ? page : 1;
      const segs = [];
      const push = (v) => {
        const s = this.trim(v);
        if (!s) return;
        const kind = s.split("/")[0];
        for (const x of segs) if (x.split("/")[0] === kind) return; // 同一维度只取第一个
        segs.push(s);
      };
      push(param);
      for (const o of options || []) push(o);
      let path = "/category";
      for (const s of segs) path += "/" + s;
      if (p > 1) path += "/page/" + p;
      const res = await Network.get(Manga51.host + path, this.headers);
      if (res.status !== 200) throw `Invalid status code: ${res.status}`;
      const html = res.body || "";
      const st = this.pageState(html, p, p);
      if (st.end) return { comics: [], maxPage: st.maxPage };
      return { comics: this.parseComicList(html), maxPage: st.maxPage };
    }
  };

  // ---------- 搜索 ----------

  search = {
    load: async (keyword, options, page) => {
      const p = page && page > 0 ? page : 1;
      const kw = this.trim(keyword);
      // 站点对空关键词返回一张没有任何结果的空页，这里直接短路，避免无谓请求
      if (!kw) return { comics: [], maxPage: p };
      const enc = encodeURIComponent(kw);
      const url = p <= 1 ? `${Manga51.host}/search?key=${enc}` : `${Manga51.host}/search/${enc}/${p}`;
      let res = null;
      try {
        res = await Network.get(url, this.headers);
      } catch (e) {
        // 站点对越界搜索页会直接 500，视为没有更多结果
        return { comics: [], maxPage: p > 1 ? p - 1 : 1 };
      }
      // 实测 /search/斗罗/2（该关键词只有 1 页）返回 500 Database Error
      if (res.status >= 500) return { comics: [], maxPage: p > 1 ? p - 1 : 1 };
      if (res.status === 404 || res.status === 410) return { comics: [], maxPage: p > 1 ? p - 1 : 1 };
      if (res.status !== 200) throw `Invalid status code: ${res.status}`;
      const html = res.body || "";
      const st = this.pageState(html, p, 1);
      if (st.end) return { comics: [], maxPage: st.maxPage };
      const comics = this.parseComicList(html);
      if (comics.length === 0) return { comics: [], maxPage: p > 1 ? p - 1 : 1 };
      return { comics: comics, maxPage: st.maxPage };
    },
    optionList: [],
    enableTagsSuggestions: false
  };

  // ---------- 详情 / 章节 ----------

  // 实测 8 本漫画、16 话样本的图片全部是 img1.baipiaoguai.org 的绝对地址（source_id 均为 12）。
  // 保留相对路径的兜底拼接，避免站点改回相对路径时整话空白。
  // 注意：这类辅助函数必须是类方法或箭头函数属性；写成 comic 对象里的普通方法会拿到
  // 对象自身作为 this（没有 trim/decryptParams），调用即抛错，很容易被 catch 吞成“0 张图片”。
  imageUrl(src) {
    const s = this.trim(src);
    if (!s) return "";
    if (s.indexOf("//") === 0) return "https:" + s;
    if (s.indexOf("http://") === 0 || s.indexOf("https://") === 0) return s;
    return Manga51.imgCdn + (s.charAt(0) === "/" ? s : "/" + s);
  }

  // 章节载荷：base64 解码后前 16 字节为 IV，其余为 AES-128-CBC 密文，明文是 PKCS#7 填充的 JSON。
  // 优先用 Venera 官方 Convert.decryptAesCbc（官方 ccc.js 同款），不可用时回退到内置纯 JS 实现。
  decryptParams(b64) {
    const all = base64ToBytes(b64);
    if (all.length <= 32 || all.length % 16 !== 0) throw new Error("载荷长度异常");
    const iv = all.slice(0, 16);
    const ct = all.slice(16);
    const key = new Uint8Array(16);
    for (let i = 0; i < 16; i++) key[i] = Manga51.aesKey.charCodeAt(i);
    let text = null;
    if (typeof Convert !== "undefined" && Convert && typeof Convert.decryptAesCbc === "function") {
      try {
        const plain = new Uint8Array(Convert.decryptAesCbc(ct.buffer, key.buffer, iv.buffer));
        text = Convert.decodeUtf8(stripPkcs7(plain).buffer);
      } catch (e) {
        text = null;
      }
    }
    if (text == null) text = decodeUtf8(stripPkcs7(aes128CbcDecrypt(ct, key, iv)));
    return JSON.parse(text);
  }

  comic = {
    // 用户直接把 51漫画 的漫画 id 粘进输入框时用；URL 形态由下面 comic.link 处理
    idMatch: "^[A-Za-z0-9]{4,32}$",

    loadInfo: async (id) => {
      const cid = this.normalizeComicId(id);
      if (!cid) throw "无法解析漫画 ID，请从探索、搜索或分类页重新打开这部作品";
      const res = await Network.get(`${Manga51.host}/mh/${cid}`, this.headers);
      if (res.status !== 200) throw `Invalid status code: ${res.status}`;
      const html = res.body || "";
      const doc = new HtmlDocument(html);
      let title = "";
      let description = "";
      let author = "";
      let updateTime = "";
      const tagList = [];
      const chapters = new Map();
      try {
        const h1 = doc.querySelector(".comic_name h1.name") || doc.querySelector("h1.name") || doc.querySelector("h1");
        if (h1) title = h1.text.trim();
        if (!title) {
          const h2 = doc.querySelector(".title h2");
          if (h2) title = h2.text.trim();
        }
        // .metas-desc 下第一个直接子 p 才是简介，内部 .download-app 里的 p 是 App 推广文案
        const desc = doc.querySelector(".metas-desc > p");
        if (desc) description = desc.text.trim();
        const hot = doc.querySelector(".comic_hot");
        if (hot) author = hot.text.trim();
        const time = doc.querySelector(".zuixin time");
        if (time) updateTime = time.text.trim();
        for (const a of doc.querySelectorAll('a[href*="/category/tags/"]')) {
          const t = this.trim(a.text);
          if (t && tagList.indexOf(t) < 0) tagList.push(t);
        }
        // 章节列表：优先 .chapter-list；个别页面结构不同时退回全页 /show/ 链接
        let links = doc.querySelectorAll('.chapter-list a[href*="/show/"]');
        if (links.length === 0) links = doc.querySelectorAll('a[href*="/show/"]');
        for (const a of links) {
          const ep = this.normalizeEpId(a.attributes && a.attributes.href);
          if (!ep) continue;
          const t = a.text ? this.trim(a.text) : "";
          chapters.set(ep, t || ep);
        }
      } finally {
        doc.dispose();
      }
      if (!title) throw "详情页解析失败，站点结构可能已变更";

      // 封面：.comic_cover 的 background-image（实测 328x422，可正常进入历史封面网格）
      let cover = "";
      const cov = /class="comic_cover"[^>]*style="[^"]*background-image:\s*url\(['"]?([^'")]+)['"]?\)/.exec(html);
      if (cov) cover = this.absolutize(cov[1], Manga51.host);
      if (!cover) {
        // 兜底：详情头部区块内第一张图
        const at = html.indexOf('class="comic-info"');
        if (at >= 0) {
          const seg = html.slice(at, at + 2500);
          const im = /<img[^>]*(?:lay-src|data-src|src)="([^"]+)"/.exec(seg);
          if (im && !this.isPlaceholderImage(im[1])) cover = this.absolutize(im[1], Manga51.host);
        }
      }

      const tags = {};
      if (tagList.length > 0) tags["标签"] = tagList;
      if (author) tags["作者"] = [author];

      return new ComicDetails({
        title: title,
        subtitle: author,
        subTitle: author,
        cover: cover,
        description: description,
        tags: tags,
        chapters: chapters,
        updateTime: updateTime,
        url: `${Manga51.webHost}/mh/${cid}`
      });
    },

    loadEp: async (comicId, epId) => {
      const ep = this.normalizeEpId(epId);
      if (!ep) return { images: [] };
      const res = await Network.get(`${Manga51.host}/show/${ep}.html`, this.headers);
      if (res.status === 404 || res.status === 410) return { images: [] };
      if (res.status !== 200) throw `Invalid status code: ${res.status}`;
      const html = res.body || "";
      const m = /params\s*=\s*(['"])([\s\S]*?)\1/.exec(html);
      if (!m) return { images: [] };
      let data = null;
      try {
        data = this.decryptParams(m[2]);
      } catch (e) {
        return { images: [] };
      }
      const raw = data && Array.isArray(data.images) ? data.images : [];
      const images = [];
      const seen = {};
      for (const x of raw) {
        if (typeof x !== "string" || !x) continue;
        const u = this.imageUrl(x);
        if (!u || seen[u]) continue;
        seen[u] = true;
        images.push(u);
      }
      return { images: images };
    },

    // 实测 8 本漫画、16 话样本的图片全部是 img1.baipiaoguai.org 的绝对地址（source_id 均为 12）。
    // 这里保留相对路径的兜底拼接，避免站点改回相对路径时整话空白。
    // 图片 CDN 强制校验 Referer（实测无 Referer -> 403）。固定用站点域名做 Referer，
    // 不再依赖“最近一次章节页 URL”这种模块级可变状态，避免并发/历史进入时串值。
    onImageLoad: (url) => {
      return { url: url, headers: this.imageHeaders };
    },

    onThumbnailLoad: (url) => {
      return { url: url, headers: this.imageHeaders };
    },

    // link 必须放在 comic 里（官方 _venera_ 模板：link 属于 Comic Details 段）
    link: {
      domains: ["51manga.com"],
      linkToId: (url) => {
        const m = /\/mh\/([A-Za-z0-9]+)/.exec(String(url == null ? "" : url));
        return m ? m[1] : null;
      }
    }
  };
}
