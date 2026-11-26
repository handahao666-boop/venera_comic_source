/** @type {import('./_venera_.js')} */

/**
 * 嗶哩漫畫 (www.bilimanga.net)
 *
 * 圖片本身是明文 AVIF（i.motiezw.com），沒有加密。
 *
 * ⚠️ 本站章節圖**只有 AVIF 一種格式**（2026-10-02 真網複測：換 .jpg/.webp/.png 全 404，
 *    換桌面 UA / 老 Android UA 抓閱讀頁拿到的仍是 .avif，四種 CDN 轉碼參數全被忽略，
 *    站點自帶的 checkAVIFSupport() 也只彈提示不換圖）。
 *    所以「手機端看不了、電腦端能看」基本是**設備解碼能力差異**（Android 端解不了部分 AVIF，
 *    見 venera-app/venera#709、#798）。源能修的是網路/風控這一類失敗，解碼失敗無法在源內修。
 *    若要相容解不了 AVIF 的機型，只能自建「AVIF→JPEG/WebP」轉碼代理，填在下面的
 *    IMG_PROXY_TEMPLATE 即可（留空=直連原站）。
 * 但閱讀頁服務器會根據請求頭判斷是否為"移動端瀏覽器"：
 * 必須帶上 sec-ch-ua-mobile: ?1 等移動端 Client Hints 才會返回圖片 <img> 標籤，
 * 否則只返回"章節不支持桌面電腦端瀏覽器顯示"的佔位符。
 *
 * 頁面結構（移動版）：
 * - 首頁 "/"：多個 .book-li 卡片（a[href="/detail/{id}.html"] + img data-src + .book-title）
 * - 詳情頁 "/detail/{id}.html"：.book-title / .book-cover / .authorname / .tag-small / #bookSummary
 * - 目錄頁 "/read/{id}/catalog"：li.chapter-li a[href*="/read/"] 全部章節
 * - 閱讀頁 "/read/{mangaid}/{chapterid}.html"：#acontentz 下的 img data-src（motiezw.com）
 * - 分類 "/filter/"：標籤 tagid 1..51，分頁 /filter/lastupdate_{tagid}_0_0_0_0_0_0_{page}_0_0_0.html
 * - 搜索：POST "/search.html" + "searchkey"（站點有反爬 guard，且受 Cloudflare WAF 保護）
 */

// ==================================================
// v1.1.1 修復「搜索不能用」
// ==================================================
// 舊版做法：GET /search.html?key=<關鍵詞>，然後解析 .book-li。
//
// 真網實測結論（2026-09-27）：
//   1) 該 GET 只會回一個「殼頁」（5283 字節、0 張卡片），搜索結果從不出現在這個 HTML 裡；
//      頁面裡只有表單 <form id="searchForm" method="post" action="/search.html">，
//      輸入框 name="searchkey"。站點真正的搜索入口是 POST。
//   2) 殼頁裡有一段混淆過的內聯腳本（eval + 字符串數組打包），還原後是：
//        var base = "/search.html?search_guard=";
//        建立 <link href=base+"css" rel=stylesheet> 與 <script src=base+"js">
//      其中 ?search_guard=js 會下發 jieqiSearchJs cookie，並 XHR ?search_guard=redeem 兌換。
//      本站是 jieqi 系 CMS，這套就是它的「確認客戶端會執行 JS」校驗。
//   3) 站點在 Cloudflare 後面，非瀏覽器客戶端偶爾會被 WAF 攔截（實測出現過 403 +
//      "Sorry, you have been blocked"），攔截是間歇性的。
//
// 2026-09-27 用真實瀏覽器復測後確認搜索本身是正常的，並補上兩個關鍵細節：
//   a) guard 必須走完整三步：先 /search.html 殼頁，再 ?search_guard=css，然後 ?search_guard=js，
//      最後 ?search_guard=redeem —— 少做 css 那一步就拿不到票。
//   b) redeem 下發的是 **一次性** jieqiSearchTicket：用過一次就廢，殘留的舊票會讓服務端
//      直接回空頁。所以每次搜索前都要把 jieqiSearchCss / jieqiSearchJs / jieqiSearchTicket
//      置空後重新換票（不能 deleteCookies，會連登錄 cookie 一起丟）。
//   c) 搜索結果頁的條目用的就是 .book-li（與首頁同一個卡片組件），分頁是「第X/Y頁」，
//      已補進 extractMaxPage。
//
// 真實瀏覽器實測結果：搜「海賊」→ 2 條（ONE PIECE ～海賊王～ / 全彩版）；
// 搜「輕音」→ 2 條（K－ON！輕音部 等）；搜「戀愛」→ 30 條。
//
// 【可選】圖片轉碼代理模板，留空 = 直連原站。
// 本站章節圖只有 AVIF，部分 Android 機型解不了；若你自建了能轉碼的代理，填在這裡即可全域生效。
//   const IMG_PROXY_TEMPLATE = "https://example.com/avif2jpg?url={url}";
// 說明：{url} 會被替換成經過 URL 編碼的原始圖片地址。
const IMG_PROXY_TEMPLATE = "";

class BiliManga extends ComicSource {
  name = "嗶哩漫畫";
  key = "bilimanga";
  version = "1.2.3";
  minAppVersion = "1.6.0";
  searchQueue = Promise.resolve();
  searchHttpClient = "";

  url = "https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/bilimanga.js";

  get baseUrl() {
    return "https://www.bilimanga.net";
  }

  // 統一的手機 UA（Chrome 131 / Android 14）。
  // 舊版寫的是 "Android 10; Pixel 5"，Pixel 5 出廠就是 Android 11，UA 自相矛盾，
  // Cloudflare WAF 會把這種不自洽的 UA 當成機器人；這裡改成自洽的一組。
  mobileUA() {
    return "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
  }

  // 圖片請求頭檔位（依序輪換重試）。真網實測圖片 CDN 的 WAF 對請求頭很敏感：
  //   帶 Accept-Language（其它隨意） -> 200 image/avif
  //   不帶 Accept-Language           -> 403（5486 字節 Cloudflare 攔截頁）
  // 所以第一檔用完整的移動端瀏覽器指紋，後面幾檔逐步降級，避免被同一條規則反覆攔。
  imageHeaderProfiles(referer) {
    const ua = this.mobileUA();
    const accept = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";
    const lang = "zh-TW,zh;q=0.9,en;q=0.8";
    return [
      // 1) 完整移動端瀏覽器（含 Client Hints + Sec-Fetch-*）
      {
        "User-Agent": ua,
        "Accept": accept,
        "Accept-Language": lang,
        "Referer": referer,
        "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "same-site",
      },
      // 2) 精簡版（只保留實測必需的 UA/Accept/Accept-Language/Referer）
      {
        "User-Agent": ua,
        "Accept": accept,
        "Accept-Language": lang,
        "Referer": referer,
      },
      // 3) iOS Safari（換一套指紋，繞開針對 Chrome 的規則）
      {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
        "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9",
        "Referer": referer,
      },
      // 4) 不帶 Referer（實測不帶 Referer 也可能 200，多一個組合多一分成功率）
      {
        "User-Agent": ua,
        "Accept": accept,
        "Accept-Language": lang,
      },
    ];
  }

  // 關鍵：帶移動端 Client Hints + night=0 cookie，閱讀頁才會返回圖片
  pageHeaders() {
    return {
      "User-Agent": this.mobileUA(),
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
    };
  }

  // 圖片字節校驗：確認真的是圖片再交給 Venera 寫緩存。
  // Venera 的圖片下載（lib/network/images.dart）拿到什麼都直接寫緩存，
  // 一旦把 Cloudflare 的 403 攔截頁 HTML 存進去，就會一直報
  // `Exception: Could not decompress image.`，重開章節也沒用。
  static validateImageBytes(buffer) {
    let b = null;
    try {
      b = new Uint8Array(buffer);
    } catch (e) {
      throw "圖片響應不是有效字節";
    }
    if (b.length < 12) throw "圖片響應為空或不完整";
    // 首字節是 '<' 說明是 HTML（Cloudflare 攔截頁）
    if (b.length > 0 && b[0] === 0x3c) {
      throw "圖片響應是 HTML（被站點風控攔截）";
    }
    if (b.length >= 12) {
      const ftyp = b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70; // AVIF/HEIF 'ftyp'
      const jpeg = b[0] === 0xff && b[1] === 0xd8;
      const png = b[0] === 0x89 && b[1] === 0x50;
      const riff = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46; // WebP(RIFF)
      const gif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
      if (!ftyp && !jpeg && !png && !riff && !gif) {
        throw "圖片響應不是圖片格式（很可能被站點風控攔截）";
      }
      if (jpeg && (b[b.length - 2] !== 0xff || b[b.length - 1] !== 0xd9)) throw "圖片傳輸不完整，請重試";
      if (ftyp) {
        // AVIF 有文件头也可能只下载到半张；逐个检查顶层 BMFF box 的长度。
        let offset = 0;
        const uint32 = i => b[i] * 16777216 + b[i + 1] * 65536 + b[i + 2] * 256 + b[i + 3];
        while (offset < b.length) {
          if (offset + 8 > b.length) throw "AVIF 圖片傳輸不完整";
          let size = uint32(offset);
          let headerSize = 8;
          if (size === 1) {
            if (offset + 16 > b.length) throw "AVIF 圖片傳輸不完整";
            size = uint32(offset + 8) * 4294967296 + uint32(offset + 12);
            headerSize = 16;
          }
          if (size === 0) size = b.length - offset;
          if (size < headerSize || offset + size > b.length) throw "AVIF 圖片傳輸不完整";
          offset += size;
        }
      }
    }
    return buffer;
  }

  init() {
    // 阅读页必须带 night=0 cookie 才返回图片；通过引擎 cookie 罐保存，
    // 避免手动 Cookie 头覆盖后续 WebView 登录产生的登录 cookie。
    try {
      Network.setCookies(this.baseUrl, [
        new Cookie({ name: "night", value: "0", domain: "www.bilimanga.net" }),
      ]);
    } catch (e) {}
  }

  // 账号登录（登录页有 Cloudflare 人机验证，必须走 WebView 真实浏览器）
  account = {
    loginWithWebview: {
      url: "https://www.bilimanga.net/login.php",
      checkStatus: (url, title) => {
        return (
          url.indexOf("bilimanga.net") !== -1 &&
          url.indexOf("/login.php") === -1
        );
      },
    },
    logout: () => {
      Network.deleteCookies("https://www.bilimanga.net/");
      try {
        Network.setCookies("https://www.bilimanga.net/", [
          new Cookie({ name: "night", value: "0", domain: "www.bilimanga.net" }),
        ]);
      } catch (e) {}
    },
    registerWebsite: "https://www.bilimanga.net/register.php",
  };

  async fetchBody(label, url) {
    let failure = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const headers = Object.assign({}, this.pageHeaders(), {"Referer": this.baseUrl + "/"});
        const res = await Network.get(url, headers);
        if (res.status !== 200) {
          if (![403, 408, 429, 500, 502, 503, 504].includes(res.status)) throw {permanent: true, message: "HTTP " + res.status};
          throw new Error("HTTP " + res.status);
        }
        const body = String(res.body || "");
        if (!body.trim() || /<title[^>]*>\s*(?:Just a moment|Attention Required)/i.test(body)) throw new Error("网站返回验证页或空响应");
        if (!/<\/html\s*>/i.test(body)) throw new Error("网页传输不完整");
        if (label === "home" || label === "categoryComics" || label.startsWith("top-")) this.checkedBookList(body);
        return body;
      } catch (e) {
        failure = e?.message || String(e);
        if (e?.permanent) break;
      }
    }
    throw new Error(label + " 加载失败（已有限重试）: " + failure + "；" + url);
  }

  coverKey(value) {
    let url = String(value || "").trim();
    if (!url) return "";
    if (url.startsWith("//")) url = "https:" + url;
    else if (url.startsWith("/")) url = this.baseUrl + url;
    return url + (url.includes("?") ? "&" : "?") + "venera_bl=119";
  }

  // 解析 .book-li 漫画卡片
  parseBookLi(el) {
    let a = el.querySelector('a[href*="/detail/"]');
    if (!a) return null;
    let href = a.attributes["href"] || "";
    let m = href.match(/\/detail\/(\d+)\.html/);
    if (!m) return null;
    let id = m[1];

    let img = el.querySelector("img");
    let cover = img
      ? img.attributes["data-src"] || img.attributes["src"] || ""
      : "";
    let title = img
      ? img.attributes["alt"] || ""
      : "";
    if (!title) {
      let titleEl = el.querySelector(".book-title");
      if (titleEl) title = titleEl.text.trim();
    }
    if (!title) title = id;

    let subTitle = "";
    let authorEl = el.querySelector(".book-author");
    if (authorEl) subTitle = authorEl.text.trim();

    return new Comic({
      id: id,
      title: title,
      subTitle: subTitle,
      cover: this.coverKey(cover),
    });
  }

  // 解析页面上所有 .book-li
  parseBookList(html) {
    let doc = new HtmlDocument(html);
    let seen = {};
    let comics = [];
    for (let el of doc.querySelectorAll(".book-li")) {
      let c = this.parseBookLi(el);
      if (!c || seen[c.id]) continue;
      seen[c.id] = true;
      comics.push(c);
    }
    doc.dispose();
    return comics;
  }

  checkedBookList(html) {
    const comics = this.parseBookList(html);
    if (comics.length) return comics;
    const doc = new HtmlDocument(html);
    try {
      const text = String(doc.querySelector("body")?.text || "");
      if (doc.querySelector(".book-ol") && /(?:沒有|没有|未找到|查無|查无|暫無|暂无).{0,20}(?:漫畫|漫画|結果|结果|作品)/.test(text)) return [];
      throw new Error("列表未返回有效漫画，可能是错误页或网页结构已变化");
    } finally { doc.dispose(); }
  }

  // 站点搜索命中**唯一一条**时会直接 302 跳到详情页
  // （实测：搜「廢天使加百列」→ 302 /detail/857.html，搜「ELDEN RING 黃金樹之路」→ 302 /detail/1601.html），
  // 而 Venera 的 Network 会自动跟随重定向，于是拿到的不是结果列表而是详情页。
  // 这里从详情页把这个唯一的条目还原出来，否则用户会觉得「搜具体书名搜不到」。
  parseSingleDetail(body) {
    const html = String(body || "");

    // 详情页有 <img class="book-cover" …>（结果列表页里 book-cover 是 div 而不是 img），
    // 用它把详情页和「没有结果」的空页区分开。
    if (!/<img[^>]*class="book-cover"(?:\s|>|")[^>]*>/.test(html)) {
      return null;
    }

    // id：优先取分享链接里的（share.linovelib.net/857-0），其次目录链接 /read/857/catalog
    let id = "";
    const share = /id="shareurl"[^>]*value="([^"]+)"/.exec(html);

    if (share) {
      const m = /(\d+)-/.exec(share[1]);

      if (m) {
        id = m[1];
      }
    }

    if (!id) {
      const m = /\/read\/(\d+)\/catalog/.exec(html);

      if (m) {
        id = m[1];
      }
    }

    if (!id) {
      const m = /\/detail\/(\d+)\.html/.exec(html);

      if (m) {
        id = m[1];
      }
    }

    if (!id) {
      return null;
    }

    let title = "";
    const h1 = /<h1[^>]*>([\s\S]{1,120}?)<\/h1>/.exec(html);

    if (h1) {
      title = h1[1].replace(/<[^>]+>/g, "").trim();
    }

    if (!title) {
      const bt = /<h4[^>]*class="book-title"[^>]*>([\s\S]{1,120}?)<\/h4>/.exec(html);

      if (bt) {
        title = bt[1].replace(/<[^>]+>/g, "").trim();
      }
    }

    let cover = "";
    const cv =
      /<img[^>]*class="book-cover"[^>]*src="([^"]+)"/.exec(html) ||
      /<img[^>]*src="([^"]+)"[^>]*class="book-cover"/.exec(html);

    if (cv) {
      cover = cv[1];
    }

    return new Comic({
      id: id,
      title: title || id,
      cover: this.coverKey(cover),
      subTitle: "",
    });
  }

  // 从分页链接中提取最大页数
  extractMaxPage(html, fallback) {
    // 搜索结果页的分页是 <div class="pagelink">…第1/1页…</div>
    const pager = /第\s*\d+\s*\/\s*(\d+)\s*页/.exec(String(html || ""));

    if (pager) {
      const n = parseInt(pager[1]);

      if (!isNaN(n) && n >= 1) {
        return n;
      }
    }

    let doc = new HtmlDocument(html);
    let max = 1;
    for (let a of doc.querySelectorAll("a")) {
      let href = a.attributes["href"] || "";
      let text = a.text ? a.text.trim() : "";
      if (href.indexOf("/filter/") !== -1 && /^\d+$/.test(text)) {
        let n = parseInt(text);
        if (n > max) max = n;
      }
    }
    doc.dispose();
    return max > 1 ? max : fallback;
  }

  // 发现页
  explore = [
    {
      title: "嗶哩漫畫-最近更新",
      type: "multiPageComicList",
      load: async (page) => {
        let url =
          this.baseUrl +
          `/filter/lastupdate_0_0_0_0_0_0_0_${page}_0_0_0.html`;
        let body = await this.fetchBody("home", url);
        let comics = this.parseBookList(body);
        let maxPage = this.extractMaxPage(body, 1);
        if (maxPage < 1) maxPage = 1;
        return { comics: comics, maxPage: maxPage };
      },
    },
    {
      title: "嗶哩漫畫-排行榜",
      type: "mixed",
      load: async (page) => {
        let ranks = [
          { key: "monthvisit", title: "月點擊榜" },
          { key: "weekvisit", title: "週點擊榜" },
          { key: "monthvote", title: "月推薦榜" },
          { key: "weekvote", title: "週推薦榜" },
          { key: "monthflower", title: "月鮮花榜" },
          { key: "weekflower", title: "週鮮花榜" },
          { key: "monthegg", title: "月雞蛋榜" },
          { key: "weekegg", title: "週雞蛋榜" },
          { key: "lastupdate", title: "最近更新" },
          { key: "postdate", title: "最新入庫" },
          { key: "goodnum", title: "收藏榜" },
          { key: "newhot", title: "新書榜" },
        ];
        let parts = [];
        // 原来同时发出12个排行榜请求，弱网下会挤占首页和图片连接。
        let next = 0;
        await Promise.all(Array.from({length: 3}, async () => {
          while (next < ranks.length) {
            const index = next++;
            const r = ranks[index];
            try {
              let body = await this.fetchBody(
                "top-" + r.key,
                this.baseUrl + "/top/" + r.key + "/1.html"
              );
              parts[index] = {
                title: r.title,
                comics: this.parseBookList(body),
                viewMore: null,
              };
            } catch (e) { parts[index] = { error: String(e) }; }
          }
        }));
        const failed = parts.find(part => part.error);
        if (failed) throw new Error("排行榜未完整加载: " + failed.error);
        return { data: parts, maxPage: 1 };
      },
    },
  ];

  // 分类页
  category = {
    title: "嗶哩漫畫",
    parts: [
      {
        name: "主題",
        type: "fixed",
        itemType: "category",
        categories: [
          "奇幻", "冒險", "異世界", "龍傲天", "魔法", "仙俠", "戰爭", "熱血",
          "戰鬥", "競技", "懸疑", "驚悚", "獵奇", "神鬼", "偵探", "校園",
          "日常", "JK", "JC", "青梅竹馬", "妹妹", "大小姐", "女兒", "戀愛",
          "耽美", "百合", "NTR", "後宮", "職場", "經營", "犯罪", "旅行",
          "群像", "女性視角", "歷史", "武俠", "東方", "勵志", "宅系", "科幻",
          "機戰", "遊戲", "異能", "腦洞", "病嬌", "人外", "復仇", "鬥智",
          "惡役", "間諜", "治癒",
        ],
        categoryParams: [
          "1", "2", "3", "4", "5", "6", "7", "8",
          "9", "10", "11", "12", "13", "14", "15", "16",
          "17", "18", "19", "20", "21", "22", "23", "24",
          "25", "26", "27", "28", "29", "30", "31", "32",
          "33", "34", "35", "36", "37", "38", "39", "40",
          "41", "42", "43", "44", "45", "46", "47", "48",
          "49", "50", "51",
        ],
      },
    ],
    enableRankingPage: false,
  };

  // 分类漫画加载
  categoryComics = {
    load: async (category, param, options, page) => {
      let tagid = param || "0";
      let url =
        this.baseUrl +
        `/filter/lastupdate_${tagid}_0_0_0_0_0_0_${page}_0_0_0.html`;

      let body = await this.fetchBody("categoryComics", url);
      let comics = this.parseBookList(body);
      let maxPage = this.extractMaxPage(body, comics.length > 0 ? page : 1);
      if (maxPage < 1) maxPage = 1;

      return { comics: comics, maxPage: maxPage };
    },
    optionList: [],
  };

  // 站点搜索必须在同一次会话里先过 search_guard 挑战，再用 POST + searchkey 提交表单。
  // 实测直接 GET /search.html?key=xxx 只会拿到一个没有结果的壳页（5283 字节、0 张卡片），
  // 页面里那段混淆内联脚本做的事就是：加载 ?search_guard=js 拿到 jieqiSearchJs cookie，
  // 再 XHR ?search_guard=redeem 兑换，之后才有资格提交搜索。
  async unlockSearch(headers) {
    // 站点是 jieqi 系 CMS，搜索前必须走完一次 search_guard 三件套换「一次性票据」：
    //   GET /search.html                       -> 下发 jieqiSearchCss
    //   GET /search.html?search_guard=css
    //   GET /search.html?search_guard=js       -> 下发 jieqiSearchJs
    //   GET /search.html?search_guard=redeem   -> 下发**一次性** jieqiSearchTicket
    // 票据用一次就废，所以每次搜索都要重新走一遍；旧票据残留会让服务端直接回空页。
    // 这里把守卫类 cookie 先置空（而不是 deleteCookies，避免连登录 cookie 一起丢），
    // 保证换到的是新票据。
    Network.setCookies(this.baseUrl, [
      new Cookie({ name: "jieqiSearchCss", value: "", domain: "www.bilimanga.net" }),
      new Cookie({ name: "jieqiSearchJs", value: "", domain: "www.bilimanga.net" }),
      new Cookie({ name: "jieqiSearchTicket", value: "", domain: "www.bilimanga.net" }),
    ]);

    const htmlHeaders = Object.assign({}, headers, {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });

    const url = this.baseUrl + "/search.html";
    this.checkSearchResponse(await Network.get(url, htmlHeaders), "搜索页面");
    this.checkSearchResponse(await Network.get(url + "?search_guard=css", {
      ...htmlHeaders, Accept: "text/css,*/*;q=0.1",
    }), "搜索准备");

    const js = await Network.get(url + "?search_guard=js", { ...htmlHeaders, Accept: "*/*" });
    this.checkSearchResponse(js, "搜索准备");
    const m = /jieqiSearchJs=([^";]+)/.exec(String(js.body || ""));
    if (m) {
      Network.setCookies(this.baseUrl, [
        new Cookie({ name: "jieqiSearchJs", value: m[1], domain: "www.bilimanga.net" }),
      ]);
    }

    const result = await Network.get(url + "?search_guard=redeem&r=" + Date.now(), {
      ...htmlHeaders, Accept: "*/*", "X-Requested-With": "XMLHttpRequest",
    });
    this.checkSearchResponse(result, "搜索准备");
  }

  checkSearchResponse(response, label) {
    const body = String(response.body || "");
    if (response.status === 403 ||
        /<title[^>]*>\s*(?:Just a moment|Attention Required)/i.test(body)) {
      throw new Error(label + "需要原站验证，请在浏览器打开哔哩漫画搜索页确认");
    }
    if (response.status === 429) throw new Error(label + "过于频繁，请稍后重试");
    if (response.status !== 200) throw new Error(label + "返回 HTTP " + response.status);
    return body;
  }

  isSearchChallenge(body) {
    return /<title[^>]*>\s*(?:搜尋|搜索|搜寻)\s*(?:驗證|验证)\s*<\/title>/i.test(String(body || ""));
  }

  async submitSearchCode(body, url, headers, retry) {
    const doc = new HtmlDocument(body);
    let imagePath;
    let fields;
    try {
      const form = doc.querySelector('form[method="post"]');
      const action = form?.attributes.action?.trim();
      if (!form || (action && action !== url && this.baseUrl + action !== url) ||
          !form.querySelector('input[name="search_code"]')) {
        throw new Error("原站验证码表单无法识别");
      }
      imagePath = form.querySelector("#search-captcha")?.attributes.src;
      fields = ["searchkey", "searchtype", "search_challenge"].map(name => {
        const value = form.querySelector('input[type="hidden"][name="' + name + '"]')?.attributes.value;
        if (!value) throw new Error("原站验证码表单缺少必要字段");
        return name + "=" + encodeURIComponent(value);
      });
    } finally {
      doc.dispose();
    }
    if (!/^\/checkcode\.php\?[^#\s]+$/.test(imagePath || "")) {
      throw new Error("原站验证码图片地址无效");
    }
    if (retry) imagePath += "&refresh=" + Date.now();
    const image = await Network.fetchBytes("GET", this.baseUrl + imagePath, {
      ...headers, Referer: url, Accept: "image/*", "cache-time": "no",
    });
    if (image.status !== 200) throw new Error("验证码图片加载失败，HTTP " + image.status);
    BiliManga.validateImageBytes(image.body);

    const title = retry ? "验证未通过，请输入新图片上的验证码" : "请输入哔哩漫画的图片验证码";
    const code = await UI.showInputDialog(title, value =>
      /^[A-Za-z0-9]{4}$/.test(value.trim()) ? null : "请输入图片中的 4 位字母或数字", image.body);
    if (code == null) throw new Error("已取消搜索验证");
    fields.push("search_code=" + encodeURIComponent(code.trim()));
    return Network.post(url, { ...headers, Referer: url,
      "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
    }, fields.join("&"));
  }

  search = {
    loadNext: async (keyword, options, next) => {
      const kw = String(keyword == null ? "" : keyword).trim();
      if (!kw) return { comics: [], next: null };
      const nextUrl = next == null ? null : this.searchUrl(next, false);
      if (next != null && !nextUrl) {
        throw new Error("原站搜索分页链接无效");
      }

      // 搜索表单的会话 cookie 由同一源共用，准备和提交须按顺序执行。
      const task = this.searchQueue.then(async () => {
        if (nextUrl) return this.runSearch(kw, nextUrl);
        const variants = this.searchVariants(kw);
        const first = await this.runSearch(variants[0], null);
        if (first.comics.length || variants.length === 1) return first;
        await new Promise(resolve => setTimeout(resolve, 6000));
        return this.runSearch(variants[1], null);
      });
      this.searchQueue = task.catch(() => {});
      return task;
    },
    optionList: [],
    enableTagsSuggestions: false,
  };

  // 站点搜索对含全角符号的书名经常直接搜不到：实测「K－ON！輕音部」→ 0 条，
  // 但同一本书用「輕音部」→ 2 条；「ONE PIECE ～海賊王～」和「海賊王」则都能搜到。
  // 所以只要查询里带符号（全角标点/破折号等）且含中日文，就**先拿中日文片段去搜**，
  // 这样一次请求就能命中，也不会白跑一次触发站点限流；原样查询作为兜底留到第二次。
  searchVariants(kw) {
    const cjk = (kw.match(/[\u3400-\u9fff\u3040-\u30ff]{2,}/g) || []).sort((a, b) => b.length - a.length)[0];

    // 只有当查询里混了符号/全角标点，或同时含中日文与英文时才降级；
    // 纯中文或纯英文查询原样就够了，避免多发一次请求（站点对搜索次数限流）。
    const noisy = /[^\w\u3400-\u9fff\u3040-\u30ff]/.test(kw);

    if (noisy && cjk) {
      return [cjk, kw];
    }

    return [kw];
  }

  searchUrl(href, detail) {
    let path = String(href || "").trim();
    if (path.startsWith("?") && !detail) path = "/search.html" + path;
    if (path.startsWith("https://") || path.startsWith("//")) {
      const absolute = path.startsWith("//") ? "https:" + path : path;
      if (!absolute.startsWith(this.baseUrl + "/")) return null;
      path = absolute.slice(this.baseUrl.length);
    } else if (!path.startsWith("/")) {
      path = "/" + path;
    }
    const valid = detail
      ? /^\/detail\/\d+\.html(?:\?[^#]*)?$/.test(path)
      : /^\/search\.html\?[^#]+$/.test(path) ||
        /^\/search\/[^\s/?#\\]+_[1-9]\d*\.html$/.test(path);
    return valid ? this.baseUrl + path : null;
  }

  async runSearch(keyword, next) {
    let httpClient = this.searchHttpClient;
    const appVersion = typeof APP === "undefined" ? "" : String(APP.version || "");
    const [major, minor, patch] = appVersion.split(".").map(part => parseInt(part, 10));
    const canSwitchClient = major > 1 || (major === 1 && (minor > 6 || (minor === 6 && patch >= 3)));
    for (let attempt = 0; ; attempt++) {
      const url = this.baseUrl + "/search.html";
      const headers = { ...this.pageHeaders(), Referer: url };
      if (httpClient) headers.http_client = httpClient;
      try {
        let response;
        let responseUrl = next || url;
        if (next == null) {
          await this.unlockSearch(headers);
          response = await Network.post(url, {
            ...headers, "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
          }, "searchkey=" + encodeURIComponent(keyword));
        } else {
          response = await Network.get(next, { ...headers, "cache-time": "no" });
        }

        for (let verification = 0; ; verification++) {
          if ([301, 302, 303, 307, 308].includes(response.status)) {
            const loc = response.headers?.location || response.headers?.Location;
            const target = this.searchUrl(loc, true) || this.searchUrl(loc, false);
            if (target) {
              response = await Network.get(target, { ...headers, "cache-time": "no" });
              responseUrl = target;
            }
          }
          if (!this.isSearchChallenge(response.body)) break;
          if (verification === 2) throw new Error("原站连续两次未通过验证码，请重试搜索");
          response = await this.submitSearchCode(response.body, responseUrl, headers, verification > 0);
        }

        const body = this.checkSearchResponse(response, "搜索请求");
        if (!/<\/html\s*>/i.test(body)) throw new Error("搜索网页传输不完整");
        const result = this.parseSearchResults(body, next);
        this.searchHttpClient = httpClient;
        return result;
      } catch (error) {
        const message = error?.message || String(error);
        const transportFailure = /tls handshake|HandshakeException|terminated during handshake|UnexpectedEof|connection reset|ECONNRESET/i.test(message)
          && !/certificat|证书/i.test(message);
        if (attempt !== 0 || !canSwitchClient || !transportFailure) {
          if (transportFailure) throw new Error("搜索连接在 HTTPS 握手阶段中断，请检查当前网络后重试");
          throw new Error("搜索加载失败，" + message);
        }
        httpClient = httpClient ? "" : "dart:io";
      }
    }
  }

  parseSearchResults(body, currentPage) {
    const doc = new HtmlDocument(body);
    try {
      const title = doc.querySelector("head title")?.text || "";
      if (!/(?:搜索|搜尋|搜寻)[\s　]*(?:結果|结果)/.test(title)) {
        const single = this.parseSingleDetail(body);
        if (single) return { comics: [single], next: null };
        throw new Error("原站未返回搜索结果页，请稍后重试");
      }
      const comics = this.checkedBookList(body);
      const href = doc.querySelector(".pagelink a.next")?.attributes.href;
      const next = this.searchUrl(href, false);
      return { comics, next: comics.length && next !== currentPage ? next : null };
    } finally {
      doc.dispose();
    }
  }

  // 单本漫画
  comic = {
    loadInfo: async (id) => {
      let detail = await this.fetchBody("detail", this.baseUrl + "/detail/" + id + ".html");
      let doc = new HtmlDocument(detail);

      let title = "";
      let titleEl = doc.querySelector(".book-title");
      if (titleEl) title = titleEl.text.trim();
      if (!title) { doc.dispose(); throw new Error("详情页未返回有效漫画标题，请检查原站或重试"); }

      let cover = "";
      let coverImg = doc.querySelector(".book-cover");
      if (coverImg) {
        cover = coverImg.attributes["data-src"] || coverImg.attributes["src"] || "";
      }

      let authors = [];
      for (let a of doc.querySelectorAll(".authorname a, .illname a")) {
        let t = a.text ? a.text.trim() : "";
        if (t && authors.indexOf(t) === -1) authors.push(t);
      }

      let tags = [];
      for (let a of doc.querySelectorAll(".tag-small-group.origin-left a.tag-small")) {
        let t = a.text ? a.text.trim() : "";
        if (t) tags.push(t);
      }

      let description = "";
      let summary = doc.querySelector("#bookSummary content");
      if (summary) description = summary.text.trim();
      doc.dispose();

      // 章節目錄
      let chapters = new Map();
      let catalog = await this.fetchBody(
        "catalog",
        this.baseUrl + "/read/" + id + "/catalog"
      );
      let cdoc = new HtmlDocument(catalog);
      for (let a of cdoc.querySelectorAll('li.chapter-li a[href*="/read/"]')) {
        let href = a.attributes["href"] || "";
        let m = href.match(/\/read\/(\d+)\/(\d+)\.html/);
        if (!m || m[1] !== String(id)) continue;
        let chTitle = a.text ? a.text.trim() : "";
        if (!chTitle) continue;
        chapters.set(m[2], chTitle);
      }
      cdoc.dispose();

      if (chapters.size === 0) throw "未解析到章節列表";

      let tagMap = {};
      if (authors.length) tagMap["作者"] = authors;
      if (tags.length) tagMap["標籤"] = tags;

      return new ComicDetails({
        title: title || id,
        cover: this.coverKey(cover),
        description: description,
        tags: tagMap,
        chapters: chapters,
      });
    },

    loadEp: async (comicId, epId) => {
      let body = await this.fetchBody(
        "ep",
        this.baseUrl + "/read/" + comicId + "/" + epId + ".html"
      );
      let doc = new HtmlDocument(body);
      let images = [];
      let content = doc.querySelector("#acontentz") || doc;
      for (let img of content.querySelectorAll("img")) {
        let src =
          img.attributes["data-src"] || img.attributes["src"] || "";
        if (!src) continue;
        if (src.indexOf("motiezw.com") === -1) continue;
        if (images.indexOf(src) === -1) images.push(src);
      }
      doc.dispose();
      if (images.length === 0) {
        throw "未解析到圖片（可能需要移動端環境，或章節為 VIP）";
      }
      // v1.1.7 【關鍵】給每個圖片地址帶上緩存版本號，用來**繞開已被污染的舊圖片緩存**。
      //
      // 原因：Venera 的圖片緩存 key 就是圖片 URL。只要歷史上某一次拿到 Cloudflare 的 403
      // 攔截頁並被寫進緩存，閱讀器再打開時會**優先使用緩存裡的字节**
      // （lib/foundation/image_provider/reader_image.dart 的 load() 拿到第一個
      //   imageBytes 就直接 break，网络重新下载的结果根本不会被用上），
      // 于是永遠報 `Exception: Could not decompress image.`，點重試、重開章節都沒用，
      // 只有「清緩存」或「換 URL」能解。
      // 這裡統一加 ?v=<版本>，改一次版本號就等於給全部章節圖換一個 cache key，
      // 老用戶不用手動清緩存也能自動恢復。（真網已驗證：帶查詢參數仍返回同一份 200 AVIF。）
      const CACHE_BUST = "v=119";
      let busted = [];
      for (let src of images) {
        busted.push(
          src + (src.indexOf("?") === -1 ? "?" : "&") + CACHE_BUST
        );
      }
      return { images: busted };
    },

    // v1.1.7 图片加载加固
    //
    // 真網複測（2026-10-02）糾正了 v1.1.4 的判斷：
    //   1) 「圖片 CDN 強制校驗 Referer」是**誤判**。同一組請求頭，帶 Referer 和不帶 Referer
    //      都能 200；真正決定性的是 **Accept-Language**：缺了必 403（5486 字節 CF 攔截頁）。
    //   2) 攔截頁一旦被 Venera 寫進圖片緩存（lib/network/images.dart 拿到什麼存什麼），
    //      就會一直報 `Exception: Could not decompress image.`。所以下面用 onResponse 做文件頭校驗，
    //      不是圖片就拋錯，讓 Venera 走 onLoadFailed 重試而不是把攔截頁存下來。
    //   3) Venera 只在**返回的配置裡帶 onLoadFailed** 時才會繼續重試，所以每次重試都重新給一個新的
    //      onLoadFailed；同時注意 onResponse/onLoadFailed 在 Dart 側是「獨立調用」的，
    //      裡面的 this 不是 comic，全部用閉包捕獲。
    //   4) 重試會輪換 4 檔請求頭（見 imageHeaderProfiles），Cover 用同一套。
    onImageLoad: (url, comicId, epId) => {
      // 用章节页当 Referer，比首页更贴近浏览器真实行为
      const referer =
        comicId && epId
          ? this.baseUrl + "/read/" + comicId + "/" + epId + ".html"
          : this.baseUrl + "/";
      const profiles = this.imageHeaderProfiles(referer);
      // 可選：走自建轉碼代理（見文件頭 IMG_PROXY_TEMPLATE）
      const targetUrl = IMG_PROXY_TEMPLATE
        ? IMG_PROXY_TEMPLATE.split("{url}").join(encodeURIComponent(url))
        : url;

      // 文件頭校驗：不是圖片就拋錯（閉包捕獲，避免依賴 this）
      const validate = (buffer) => BiliManga.validateImageBytes(buffer);

      // 每次重試都返回一個全新的配置 + 全新的 onLoadFailed，Venera 才會繼續往下重試
      const build = (i) => {
        const headers = profiles[i < profiles.length ? i : profiles.length - 1];
        return {
          url: targetUrl,
          method: "GET",
          headers: headers,
          // 注意：Dart 側每次用完都會 free 掉這個 JS 回調，
          // 所以每次重試都給一個新的函數對象，避免共享同一個 invokable 被提前釋放。
          onResponse: (buffer) => validate(buffer),
          onLoadFailed: () => i + 1 < profiles.length ? build(i + 1) : null,
        };
      };
      return build(0);
    },

    onThumbnailLoad: (url) => {
      const target = String(url || "").replace(/([?&])venera_bl=119(&|$)/, (m, prefix, suffix) => suffix ? prefix : "").replace(/[?&]$/, "");
      const headers = this.imageHeaderProfiles("https://www.bilimanga.net/")[0];
      return {
        url: IMG_PROXY_TEMPLATE
          ? IMG_PROXY_TEMPLATE.split("{url}").join(encodeURIComponent(target))
          : target,
        headers: headers,
        onResponse: (buffer) => BiliManga.validateImageBytes(buffer),
      };
    },

    // 从外部链接识别漫画 id，如 https://www.bilimanga.net/detail/1601.html
    link: {
      domains: ["bilimanga.net", "www.bilimanga.net"],
      linkToId: (url) => {
        let m = url.match(/\/detail\/(\d+)\.html/);
        return m ? m[1] : null;
      },
    },
  };
}
