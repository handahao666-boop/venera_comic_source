// 少年ジャンプ＋：官网公开网页入口。保留源 key；不依赖 App 匿名令牌接口。
class ShonenJumpPlus extends ComicSource {
  name = "少年ジャンプ＋";
  key = "shonen_jump_plus";
  version = "1.2.0";
  minAppVersion = "1.6.0";
  url = "https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/shonen_jump_plus.js";
  baseUrl = "https://shonenjumpplus.com";
  _requests = new Map();

  get headers() {
    return {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
      "Referer": this.baseUrl + "/", "Accept-Language": "ja,en;q=0.7", "cache-time": "no"};
  }

  clean(value) { return String(value || "").replace(/\s+/g, " ").trim(); }
  imageUrl(image) { return image?.attributes["data-src"] || image?.attributes.src || ""; }
  episodeId(value) {
    const text = String(value || "");
    const match = text.match(/(?:^|\/)episode\/(\d+)(?:[/?#]|$)/);
    return match ? match[1] : /^\d{12,25}$/.test(text) ? text : "";
  }

  async request(path, json = false) {
    if (!/^\/(?:$|episode\/\d+(?:[?#]|$)|series(?:[/?]|$)|search(?:[?]|$)|api\/viewer\/(?:readable_product_pagination_information|pagination_readable_products(?:_custom_tabs)?)\?)/.test(path)) {
      throw new Error("少年 Jump+：无效的官网读取地址");
    }
    if (this._requests.has(path)) return await this._requests.get(path);
    const task = (async () => {
      const response = await Network.get(this.baseUrl + path, {...this.headers, "Accept": json ? "application/json" : "text/html"});
      if (response.status !== 200) throw new Error("少年 Jump+ 官网 HTTP " + response.status + "，请稍后重试或检查官网连接");
      const body = String(response.body || "");
      if (!body.trim()) throw new Error("少年 Jump+ 官网返回空内容");
      if (json) {
        if (!/^[\s]*[\[{]/.test(body)) throw new Error("少年 Jump+ 目录接口返回了网页，无法读取目录");
        let value;
        try { value = JSON.parse(body); } catch (_) { throw new Error("少年 Jump+ 目录数据不完整，请刷新重试"); }
        if (value?.error) throw new Error("少年 Jump+ 目录请求失败");
        return value;
      }
      if (!/<\/html\s*>/i.test(body)) throw new Error("少年 Jump+ 网页传输不完整，请重试");
      return body;
    })();
    this._requests.set(path, task);
    try { return await task; } finally { if (this._requests.get(path) === task) this._requests.delete(path); }
  }

  parseCard(item) {
    const link = item.querySelector("a[href*='/episode/']");
    const image = item.querySelector("img.daily-series-thumb-square, img[data-src], img");
    const entry = this.episodeId(link?.attributes.href);
    let cover = this.imageUrl(image);
    if (!entry || !cover || /spacer\.png/.test(cover)) return null;
    let seriesId = item.attributes["data-series-id"] || "";
    if (!seriesId) {
      let decoded = cover;
      try { decoded = decodeURIComponent(cover); } catch (_) {}
      seriesId = decoded.match(/\/series-(?:sub-thumbnail[^/]*|thumbnail)\/(\d+)-/)?.[1] || "";
    }
    if (!/^\d{12,25}$/.test(seriesId)) return null;
    const title = this.clean(item.querySelector(".daily-series-title, .series-list-title, .series-title, .ranking-title, .title")?.text || item.attributes["data-title"] || image?.attributes.alt);
    if (!title) return null;
    const author = this.clean(item.querySelector(".daily-series-author, .series-list-author, .author")?.text);
    return new Comic({id: "web:" + seriesId, title, cover, subTitle: author});
  }

  cards(container, selector) {
    const result = [], seen = new Set();
    for (const item of container.querySelectorAll(selector)) {
      const comic = this.parseCard(item);
      if (comic && !seen.has(comic.id)) { seen.add(comic.id); result.push(comic); }
    }
    return result;
  }

  product(doc) {
    const value = doc.querySelector("#episode-json")?.attributes["data-value"];
    if (!value) throw new Error("少年 Jump+ 未返回章节数据，可能需要登录或网页已变化");
    try {
      const data = JSON.parse(value)?.readableProduct;
      if (!data || !this.episodeId(data.id)) throw new Error("invalid");
      return data;
    } catch (_) { throw new Error("少年 Jump+ 章节数据不完整或格式已变化"); }
  }

  async catalog(seriesId) {
    const query = "type=episode&aggregate_id=" + encodeURIComponent(seriesId);
    const info = await this.request("/api/viewer/readable_product_pagination_information?" + query, true);
    const total = Number(info.readable_products_count), perPage = Number(info.per_page || 50);
    if (!Number.isInteger(total) || total < 1 || total > 20000 || !Number.isInteger(perPage) || perPage < 1 || perPage > 200) throw new Error("少年 Jump+ 目录分页数据无效");
    const result = new Map();
    const add = items => {
      if (!Array.isArray(items) || !items.length) throw new Error("少年 Jump+ 目录分页为空，请刷新重试");
      for (const item of items) {
        const id = this.episodeId(item.readable_product_id || this.episodeId(item.viewer_uri));
        if (!id || !item.title) throw new Error("少年 Jump+ 目录条目不完整");
        const locked = item.purchase_info?.can_read === false;
        result.set(id, {title: this.clean(item.title) + (locked ? "【官网需权限】" : ""), locked});
      }
    };
    if (!info.type || info.type === "number") {
      if (Math.ceil(total / perPage) > 200) throw new Error("少年 Jump+ 目录页数过多，请在官网查看");
      for (let offset = 0; offset < total; offset += perPage) {
        const items = await this.request("/api/viewer/pagination_readable_products?" + query + "&offset=" + offset + "&limit=" + perPage + "&sort_order=asc&is_guest=1", true);
        add(items);
        if (items.length !== Math.min(perPage, total - offset)) throw new Error("少年 Jump+ 目录分页不完整，请刷新重试");
      }
    } else if (info.type === "custom_tabs" && Array.isArray(info.tabs) && info.tabs.length <= 200) {
      for (const tab of info.tabs) {
        if (tab.key == null) throw new Error("少年 Jump+ 目录分组缺少标识");
        add(await this.request("/api/viewer/pagination_readable_products_custom_tabs?" + query + "&custom_tab_key=" + encodeURIComponent(tab.key) + "&sort_order=asc&is_guest=1", true));
      }
    } else { throw new Error("少年 Jump+ 目录类型已变化，请更新漫画源"); }
    if (result.size !== total) throw new Error("少年 Jump+ 目录未完整取得（" + result.size + "/" + total + "），请刷新重试");
    return result;
  }

  explore = [{title: "少年ジャンプ＋", type: "singlePageWithMultiPart", load: async () => {
    const doc = new HtmlDocument(await this.request("/"));
    try {
      const result = {};
      for (const section of doc.querySelectorAll("section.daily")) {
        const comics = this.cards(section, "li.daily-series-item");
        const heading = this.clean(section.querySelector(".date")?.text).replace(/のランキング$/, "");
        if (comics.length) result[heading || "今日更新"] = comics;
      }
      if (!Object.keys(result).length) throw new Error("少年 Jump+ 首页未取得作品，网页结构可能已变化");
      return result;
    } finally { doc.dispose(); }
  }}];

  category = {title: "少年ジャンプ＋", parts: [{name: "官网分类", type: "fixed", categories: ["连载作品", "短篇作品", "完结作品"], categoryParams: ["", "oneshot", "finished"], itemType: "category"}], enableRankingPage: false};
  categoryComics = {load: async (category, param, options, page) => {
    const number = Math.max(1, parseInt(page || 1, 10));
    if (!param && number > 1) return {comics: [], maxPage: 1};
    if (!["", "oneshot", "finished"].includes(String(param || ""))) throw new Error("未知的少年 Jump+ 分类");
    const doc = new HtmlDocument(await this.request("/series" + (param ? "/" + param : "")));
    try {
      if (param) {
        // The website puts thousands of entries in one HTML document. Parse only
        // this Venera display page to avoid building thousands of UI cards at once.
        const rows = Array.from(doc.querySelectorAll("li.series-list-item"));
        if (!rows.length) throw new Error("少年 Jump+ 分类未取得作品，请检查官网");
        const maxPage = Math.ceil(rows.length / 50), comics = [], seen = new Set();
        for (const row of rows.slice((number - 1) * 50, number * 50)) {
          const comic = this.parseCard(row);
          if (comic && !seen.has(comic.id)) { seen.add(comic.id); comics.push(comic); }
        }
        if (number <= maxPage && !comics.length) throw new Error("少年 Jump+ 分类卡片格式已变化");
        return {comics, maxPage};
      }
      const comics = this.cards(doc, "li.series-list-item");
      if (!comics.length) throw new Error("少年 Jump+ 分类未取得作品，请检查官网");
      return {comics, maxPage: 1};
    } finally { doc.dispose(); }
  }};

  search = {load: async (keyword, options, page) => {
    const number = Math.max(1, parseInt(page || 1, 10));
    const doc = new HtmlDocument(await this.request("/search?q=" + encodeURIComponent(String(keyword || "").trim()) + (number > 1 ? "&page=" + number : "")));
    try {
      if (!doc.querySelector(".search-series-list")) {
        if (doc.querySelector(".list-empty") && /作品が見つかりませんでした/.test(doc.querySelector(".list-empty").text)) return {comics: [], maxPage: 1};
        throw new Error("少年 Jump+ 搜索页格式已变化或请求失败");
      }
      const comics = this.cards(doc, ".search-series-list > li");
      let maxPage = 1;
      for (const link of doc.querySelectorAll("a[href*='page=']")) {
        const match = String(link.attributes.href || "").match(/[?&]page=(\d+)/);
        if (match) maxPage = Math.max(maxPage, Number(match[1]));
      }
      return {comics, maxPage};
    } finally { doc.dispose(); }
  }};

  comic = {
    loadInfo: async id => {
      let seriesId = String(id || "").match(/^web:(\d{12,25})$/)?.[1];
      if (!seriesId && /^ew\d+$/.test(String(id))) {
        const legacy = new HtmlDocument(await this.request("/series/" + id + "/latest_free_episode"));
        try { seriesId = String(this.product(legacy).series?.id || ""); } finally { legacy.dispose(); }
      }
      if (!/^\d{12,25}$/.test(seriesId || "")) throw new Error("旧版 App 收藏标识无法直接转换，请重新搜索作品并收藏官网版本");
      const entries = await this.catalog(seriesId), firstId = entries.keys().next().value;
      const doc = new HtmlDocument(await this.request("/episode/" + firstId));
      try {
        const data = this.product(doc);
        if (String(data.series?.id) !== seriesId) throw new Error("少年 Jump+ 作品目录与详情不匹配");
        const chapters = new Map();
        for (const [chapterId, item] of entries) chapters.set(chapterId, item.title);
        const title = this.clean(doc.querySelector(".series-header-title")?.text || data.series.title);
        if (!title) throw new Error("少年 Jump+ 作品标题缺失");
        const author = this.clean(doc.querySelector(".series-header-author")?.text);
        return new ComicDetails({title, cover: this.imageUrl(doc.querySelector(".series-header-image")) || data.series.thumbnailUri || "",
          subtitle: author, description: this.clean(doc.querySelector(".series-header-description")?.text),
          tags: author ? {"作者": [author]} : {}, chapters, url: this.baseUrl + "/episode/" + firstId});
      } finally { doc.dispose(); }
    },
    loadEp: async (comicId, epId) => {
      const id = this.episodeId(epId);
      if (!id) throw new Error("旧版 App 章节标识不可用，请重新打开作品详情更新目录");
      const doc = new HtmlDocument(await this.request("/episode/" + id));
      try {
        const data = this.product(doc), expected = String(comicId).match(/^web:(\d+)$/)?.[1];
        if (String(data.id) !== id || (expected && String(data.series?.id) !== expected)) throw new Error("少年 Jump+ 返回的章节与当前作品不一致");
        if (data.isPublic !== true) throw new Error("本章在官网需要登录、购买或阅读权限；请前往官网处理");
        const pages = data.pageStructure?.pages;
        if (!Array.isArray(pages)) throw new Error("少年 Jump+ 尚未提供本章正文图片");
        const images = pages.filter(p => p.type === "main").map(p => {
          if (!/^https:\/\/cdn-[a-z-]*img\.shonenjumpplus\.com\/public\/page\//.test(p.src || "")) throw new Error("少年 Jump+ 正文图片地址缺失或格式已变化");
          return p.src + "#sjp_web_puzzle_120";
        });
        if (!images.length) throw new Error("少年 Jump+ 本章没有可读取的正文图片");
        return {images};
      } finally { doc.dispose(); }
    },
    onImageLoad: url => ({url: String(url).replace(/#sjp_web_puzzle_120$/, ""), headers: {"User-Agent": "Mozilla/5.0", "Referer": this.baseUrl + "/"},
      modifyImage: String(url).endsWith("#sjp_web_puzzle_120") ? this.restorePageScript : undefined}),
    onThumbnailLoad: url => ({url, headers: {"User-Agent": "Mozilla/5.0", "Referer": this.baseUrl + "/"}}),
    onClickTag: (namespace, tag) => ({action: "search", keyword: tag, param: null})
  };

  // Same 4x4 cell transpose used by the official public web viewer; copy margins unchanged.
  restorePageScript = `function modifyImage(image) {
    const width = image.width, height = image.height;
    const cellWidth = Math.floor(width / 32) * 8, cellHeight = Math.floor(height / 32) * 8;
    if (cellWidth < 1 || cellHeight < 1) return image;
    const output = Image.empty(width, height);
    output.fillImageAt(0, 0, image);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      output.fillImageRangeAt(row * cellWidth, col * cellHeight, image, col * cellWidth, row * cellHeight, cellWidth, cellHeight);
    }
    return output;
  }`;
}
