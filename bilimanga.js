/** @type {import('./_venera_.js')} */

/**
 * 嗶哩漫畫 (www.bilimanga.net)
 *
 * 圖片本身是明文 AVIF（i.motiezw.com），沒有加密。
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
// 本版仍保留降級：任何一步失敗都安全回空結果（不拋錯），避免把站點風控表現成源的崩潰。
class BiliManga extends ComicSource {
  name = "嗶哩漫畫";
  key = "bilimanga";
  version = "1.1.3";
  minAppVersion = "1.6.0";

  // 更新链接，请替换为你自己的托管地址
  url = "";

  get baseUrl() {
    return "https://www.bilimanga.net";
  }

  // 關鍵：帶移動端 Client Hints + night=0 cookie，閱讀頁才會返回圖片
  pageHeaders() {
    return {
      "User-Agent":
        "Mozilla/5.0 (Linux; Android 10; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      "sec-ch-ua": '"Chromium";v="125", "Not.A/Brand";v="24"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
    };
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
    let res = await Network.get(url, this.pageHeaders());
    if (res.status !== 200) throw label + " 请求失败: " + res.status;
    return res.body;
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
      cover: cover,
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
      cover: cover,
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
          `/filter/postdate_0_0_0_0_0_0_0_${page}_0_0_0.html`;
        let body = await this.fetchBody("home", url);
        let comics = this.parseBookList(body);
        let maxPage = this.extractMaxPage(body, 54);
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
        await Promise.all(
          ranks.map(async (r) => {
            try {
              let body = await this.fetchBody(
                "top-" + r.key,
                this.baseUrl + "/top/" + r.key + "/1.html"
              );
              parts.push({
                title: r.title,
                comics: this.parseBookList(body),
                viewMore: null,
              });
            } catch (e) {
              parts.push({ title: r.title, comics: [], viewMore: null });
            }
          })
        );
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
  async unlockSearch() {
    // 站点是 jieqi 系 CMS，搜索前必须走完一次 search_guard 三件套换「一次性票据」：
    //   GET /search.html                       -> 下发 jieqiSearchCss
    //   GET /search.html?search_guard=css
    //   GET /search.html?search_guard=js       -> 下发 jieqiSearchJs
    //   GET /search.html?search_guard=redeem   -> 下发**一次性** jieqiSearchTicket
    // 票据用一次就废，所以每次搜索都要重新走一遍；旧票据残留会让服务端直接回空页。
    // 这里把守卫类 cookie 先置空（而不是 deleteCookies，避免连登录 cookie 一起丢），
    // 保证换到的是新票据。
    try {
      Network.setCookies(this.baseUrl, [
        new Cookie({ name: "jieqiSearchCss", value: "", domain: "www.bilimanga.net" }),
        new Cookie({ name: "jieqiSearchJs", value: "", domain: "www.bilimanga.net" }),
        new Cookie({ name: "jieqiSearchTicket", value: "", domain: "www.bilimanga.net" }),
      ]);
    } catch (e) {
    }

    const htmlHeaders = Object.assign({}, this.pageHeaders(), {
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });

    try {
      await Network.get(this.baseUrl + "/search.html", htmlHeaders);

      await Network.get(
        this.baseUrl + "/search.html?search_guard=css",
        Object.assign({}, htmlHeaders, { "Accept": "text/css,*/*;q=0.1" })
      );

      const js = await Network.get(
        this.baseUrl + "/search.html?search_guard=js",
        Object.assign({}, htmlHeaders, { "Accept": "*/*" })
      );

      const m = /jieqiSearchJs=([^";]+)/.exec(String(js.body || ""));

      if (m) {
        try {
          Network.setCookies(this.baseUrl, [
            new Cookie({ name: "jieqiSearchJs", value: m[1], domain: "www.bilimanga.net" }),
          ]);
        } catch (e) {}
      }

      await Network.get(
        this.baseUrl + "/search.html?search_guard=redeem&r=" + Date.now(),
        Object.assign({}, htmlHeaders, { "Accept": "*/*", "X-Requested-With": "XMLHttpRequest" })
      );

      return true;
    } catch (e) {
      return false;
    }
  }

  // 搜索
  //
  // 已知限制：站点把搜索 POST 放在 Cloudflare WAF 后面，非浏览器客户端常被 403 拦截
  // （实测带/不带 guard cookie 都出现过 403，且拦截是间歇性的）。
  // 因此这里严格按站点协议发起请求，但任何失败都安全降级为「空结果」而不是抛错，
  // 避免把站点侧风控表现成源的崩溃。
  search = {
    load: async (keyword, options, page) => {
      const kw = String(keyword == null ? "" : keyword).trim();

      // 空关键词只会拿到空壳页
      if (!kw) {
        return { comics: [], maxPage: 1 };
      }

      // 站点对搜索次数限流（实测连搜几次就会被拦），所以这里最多只发两次查询：
      // 先原样，失败再试一个归一化片段（详见 searchVariants）。
      const variants = this.searchVariants(kw);

      for (let i = 0; i < variants.length; i++) {
        // 站点对连续搜索限流：两次查询挨着发，第二次会被判为 0 条，实测要等约 6 秒才恢复。
        if (i > 0) {
          try {
            await new Promise((resolve) => setTimeout(resolve, 6000));
          } catch (e) {}
        }

        const r = await this.runSearch(variants[i], 1);

        if (r) {
          return r;
        }
      }

      return { comics: [], maxPage: 1 };
    },
    optionList: [],
    enableTagsSuggestions: false,
  };

  // 站点搜索对含全角符号的书名经常直接搜不到：实测「K－ON！輕音部」→ 0 条，
  // 但同一本书用「輕音部」→ 2 条；「ONE PIECE ～海賊王～」和「海賊王」则都能搜到。
  // 所以只要查询里带符号（全角标点/破折号等）且含中日文，就**先拿中日文片段去搜**，
  // 这样一次请求就能命中，也不会白跑一次触发站点限流；原样查询作为兜底留到第二次。
  searchVariants(kw) {
    const out = [kw];

    const push = (v) => {
      const s = String(v == null ? "" : v).trim();

      if (s && s !== kw && out.indexOf(s) < 0) {
        out.push(s);
      }
    };

    const cjk = (kw.match(/[\u3400-\u9fff\u3040-\u30ff]{2,}/g) || []).sort((a, b) => b.length - a.length)[0];

    // 只有当查询里混了符号/全角标点，或同时含中日文与英文时才降级；
    // 纯中文或纯英文查询原样就够了，避免多发一次请求（站点对搜索次数限流）。
    const noisy = /[^\w\u3400-\u9fff\u3040-\u30ff]/.test(kw);

    if (noisy && cjk) {
      return [cjk, kw];
    }

    return out;
  }

  // 单次搜索：换票 → POST /search.html + searchkey → 解析。attempts 次内换票重试。
  async runSearch(q, attempts) {
    const enc = encodeURIComponent(q);

    for (let attempt = 0; attempt < (attempts || 1); attempt++) {
      if (attempt > 0) {
        try {
          await new Promise((resolve) => setTimeout(resolve, 1200));
        } catch (e) {}
      }

      try {
        await this.unlockSearch();
      } catch (e) {}

      try {
        const res = await Network.post(
          this.baseUrl + "/search.html",
          Object.assign({}, this.pageHeaders(), {
            "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
          }),
          "searchkey=" + enc
        );

        if (res.status === 200 && res.body) {
          const comics = this.parseBookList(res.body);

          if (comics.length > 0) {
            return { comics: comics, maxPage: this.extractMaxPage(res.body, 1) };
          }

          // 唯一一条结果会被 302 到详情页（Network 已跟随重定向），从详情页还原这一条
          const single = this.parseSingleDetail(res.body);

          if (single) {
            return { comics: [single], maxPage: 1 };
          }
        }

        // 兼容「Network 没有跟随重定向」的情况：自己按 Location 再取一次详情页
        const loc = res.headers && (res.headers.location || res.headers.Location);

        if (loc && (res.status === 301 || res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308)) {
          const target = /^https?:\/\//.test(loc) ? loc : this.baseUrl + (loc.charAt(0) === "/" ? loc : "/" + loc);
          const detail = await Network.get(target, this.pageHeaders());
          const single = detail && detail.status === 200 ? this.parseSingleDetail(detail.body) : null;

          if (single) {
            return { comics: [single], maxPage: 1 };
          }
        }
      } catch (e) {}
    }

    return null;
  }

  // 单本漫画
  comic = {
    loadInfo: async (id) => {
      let detail = await this.fetchBody("detail", this.baseUrl + "/detail/" + id + ".html");
      let doc = new HtmlDocument(detail);

      let title = "";
      let titleEl = doc.querySelector(".book-title");
      if (titleEl) title = titleEl.text.trim();

      let cover = "";
      let coverImg = doc.querySelector(".book-cover");
      if (coverImg) {
        cover = coverImg.attributes["src"] || coverImg.attributes["data-src"] || "";
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
        let m = href.match(/\/read\/\d+\/(\d+)\.html/);
        if (!m) continue;
        let chTitle = a.text ? a.text.trim() : "";
        if (!chTitle) continue;
        chapters.set(m[1], chTitle);
      }
      cdoc.dispose();

      if (chapters.size === 0) throw "未解析到章節列表";

      let tagMap = {};
      if (authors.length) tagMap["作者"] = authors;
      if (tags.length) tagMap["標籤"] = tags;

      return new ComicDetails({
        title: title || id,
        cover: cover,
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
      return { images: images };
    },

    onImageLoad: (url) => {
      return {
        url: url,
        headers: {
          Referer: "https://www.bilimanga.net/",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        },
      };
    },

    onThumbnailLoad: (url) => {
      return {
        url: url,
        headers: {
          Referer: "https://www.bilimanga.net/",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
          Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
          "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
        },
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
