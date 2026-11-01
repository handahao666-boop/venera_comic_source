
/** @type {import('./_venera_.js')} */
class WManHua extends ComicSource {
  // 显示名称
  name = "W漫画";

  // 唯一内部标识（保持稳定，勿随意修改）
  key = "wmanhua";

  version = "1.0.3";

  // 与官方 singlePageWithMultiPart 参考源保持一致的最低版本
  minAppVersion = "1.4.0";

  url = "https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/wmanhua.js";

  base = "https://www.wmanhua.com";

  headers = {
    Referer: "https://www.wmanhua.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "cache-time": "no",
    "Cache-Control": "no-cache",
  };

  async request(path, label, method = "GET") {
    const res = await Network.sendRequest(method, this.base + path, this.headers);
    if (!res || res.status !== 200 || typeof res.body !== "string" || !res.body.trim()) {
      throw new Error(`W漫画${label}请求失败（HTTP ${res ? res.status : "无响应"}），请稍后重试`);
    }
    return res.body;
  }

  // ============ 通用工具 ============

  absoluteUrl(url) {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("//")) return "https:" + url;
    if (url.startsWith("/")) return this.base + url;
    return this.base + "/" + url.replace(/^\.\//, "");
  }

  // 漫画 ID：兼容数字 (/comic/8884.html) 与字母 slug (/comic/doupocangqiong.html)
  comicIdFromHref(href) {
    if (!href) return "";
    const m = href.match(/\/comic\/([^/?#]+?)\.html(?:[?#]|$)/);
    return m ? m[1] : "";
  }

  // 章节 ID：/chapter/8884-1028112.html -> 1028112
  chapterIdFromHref(href) {
    if (!href) return "";
    const m = href.match(/\/chapter\/[^/]+-(\d+)\.html/);
    return m ? m[1] : "";
  }

  // 从详情页脚本中提取数字 contentId（加载更多 API 需要数字 ID）
  extractContentId(body) {
    if (!body) return "";
    const m = body.match(/(?:const|let|var)\s+contentId\s*=\s*['"](\d+)['"]/);
    return m ? m[1] : "";
  }

  coverFromElement(element) {
    if (!element) return "";
    const image = element.querySelector("img");
    const attr = image ? image.attributes : element.attributes;
    const src = attr["data-src"] || attr.src || "";
    if (src && !/\/resource\/image\/(?:loading|404)\./.test(src)) return this.absoluteUrl(src);
    const background = element.querySelector(".thumb, .mini, [style]") || element;
    const match = (background.attributes.style || "").match(/background-image\s*:\s*url\(\s*["']?([^"')]+)["']?\s*\)/i);
    return match ? this.absoluteUrl(match[1]) : "";
  }

  // 通用卡片解析（首页/搜索/分类/相关推荐复用同一结构）
  parseCard(item) {
    const a = this.comicIdFromHref(item.attributes.href || "") ? item : item.querySelector('a[href*="/comic/"]');
    if (!a) return null;
    const href = a.attributes.href || "";
    const id = this.comicIdFromHref(href);
    const cover = this.coverFromElement(item);
    const titleEl = item.querySelector(".cardtitle, h3");
    const title = titleEl ? titleEl.text.trim() : "";
    if (!id || !title) return null;
    const latest = item.querySelector(".comic-latest-chapter, .comic-chapter-label");
    const thumb = item.querySelector(".thumb");
    return new Comic({
      id,
      title,
      cover,
      subTitle: latest ? latest.text.trim() : (thumb ? thumb.attributes["data-title"] || "" : ""),
    });
  }

  parseCards(root) {
    const items = root.querySelectorAll(".card-content, .comic-feature, .comic-book, .comic-update, .comic-ranking li, .book, .timeline-item");
    const comics = [];
    const seen = new Set();
    for (const it of items) {
      const c = this.parseCard(it);
      if (c && !seen.has(c.id)) { seen.add(c.id); comics.push(c); }
    }
    return comics;
  }

  // 新版从页码输入框 max 取总页数，兼容旧版 .page-number。
  parseMaxPage(doc) {
    const input = doc.querySelector(".pager-input");
    if (input) {
      const max = Number(input.attributes.max);
      if (Number.isInteger(max) && max > 0) return max;
      throw new Error("W漫画分页结构无效，请重试");
    }
    const el = doc.querySelector(".page-number");
    if (el) {
      const txt = el.text || "";
      const m = txt.match(/of\s*(\d+)/i) || txt.match(/(\d+)/);
      if (m) {
        const p = parseInt(m[1], 10);
        if (p > 0) return p;
      }
    }
    return 1;
  }

  async loadList(path) {
    const doc = new HtmlDocument(await this.request(path, "列表"));
    try {
      if (!doc.querySelector(".catalog, .timeline, .card-main")) throw new Error("W漫画列表结构已变化，请更新漫画源");
      const comics = this.parseCards(doc);
      if (!comics.length && !/暂无|没有|未找到|无结果/.test((doc.querySelector("main") || doc).text || "")) {
        throw new Error("W漫画列表解析失败，请重试");
      }
      return { comics, maxPage: this.parseMaxPage(doc) };
    } finally { doc.dispose(); }
  }

  async readerChapterOrder(contentId, latestId, list) {
    const reader = new HtmlDocument(await this.request(`/chapter/${contentId}-${latestId}.html`, "目录顺序"));
    try {
      const links = reader.querySelectorAll('.drawer-list a[href*="/chapter/"]');
      const byId = new Map(list.map(ch => [String(ch.id), ch]));
      const seen = new Set();
      const ordered = [];
      for (const link of links) {
        const href = link.attributes.href || "";
        const id = this.chapterIdFromHref(href);
        const chapter = byId.get(id);
        if (!href.includes(`/chapter/${contentId}-`) || !chapter || seen.has(id)) {
          throw new Error("阅读页目录与完整接口不一致，请刷新重试");
        }
        seen.add(id);
        ordered.push(chapter);
      }
      if (ordered.length !== list.length) throw new Error("阅读页目录不完整，请刷新重试");
      return ordered;
    } finally { reader.dispose(); }
  }

  chapterImages(body) {
    const countMatch = body.match(/\b(?:var|let|const)\s+totalPages\s*=\s*(?:parseInt\(\s*["']?)?(\d+)/)
      || body.match(/\bvar\s+num\s*=\s*eval\(\s*["']?\s*(\d+)\s*["']?\s*\)/);
    const expression = body.match(/\b(?:var|let|const)\s+imgBaseUrl\s*=\s*([^;\r\n]+)/);
    let base = "";
    if (expression) {
      // 只解释官网的字符串拼接格式；不执行网页脚本或 eval。
      const values = [];
      const shape = expression[1].replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, token => {
        values.push(token.slice(1, -1).replace(/\\(u[0-9a-f]{4}|x[0-9a-f]{2}|[\s\S])/gi, (_, c) => {
          if (/^u[0-9a-f]{4}$/i.test(c)) return String.fromCharCode(parseInt(c.slice(1), 16));
          if (/^x[0-9a-f]{2}$/i.test(c)) return String.fromCharCode(parseInt(c.slice(1), 16));
          return ({ n: "\n", r: "\r", t: "\t" })[c] || c;
        }));
        return "S";
      }).replace(/\s+/g, "");
      if (shape === "S+(S||S)+S") base = values[0] + (values[1] || values[2]) + values[3];
      else if (shape === "S") base = values[0];
    } else {
      const legacy = body.match(/\bvar\s+pasd\s*=\s*["']([^"']+)["']/);
      if (legacy) base = legacy[1];
    }
    const count = countMatch ? Number(countMatch[1]) : 0;
    base = this.absoluteUrl(base);
    if (!Number.isInteger(count) || count < 1 || count > 10000 || !/^https:\/\//.test(base)) {
      throw new Error("W漫画章节图片结构无效，请更新漫画源或稍后重试");
    }
    if (!base.endsWith("/")) base += "/";
    return Array.from({ length: count }, (_, i) => base + (i + 1) + ".webp");
  }

  // ============ 探索页（首页多区块） ============
  explore = [
    {
      title: this.name,
      type: "singlePageWithMultiPart",

      /**
       * @param page {number | null}
       * @returns {Object} { 区块名: Comic[] }
       */
      load: async (page) => {
        const doc = new HtmlDocument(await this.request("/", "首页"));
        try {
        const blocks = doc.querySelectorAll(".comic-home section, .comic-home .comic-ranking, .card-main");
        const result = {};
        const covers = {};
        for (const comic of this.parseCards(doc)) { if (comic.cover) covers[comic.id] = comic.cover; }
        for (const block of blocks) {
          const titleEl = block.querySelector(".comic-heading h2, .card-title h2");
          if (!titleEl) continue;
          const title = titleEl.text.trim();
          if (!title) continue;
          const comics = this.parseCards(block);
          for (const comic of comics) { if (!comic.cover) comic.cover = covers[comic.id] || ""; }
          if (comics.length > 0) result[title] = comics;
        }
        if (!Object.keys(result).length) throw new Error("W漫画首页结构已变化或返回验证页，请更新漫画源或稍后重试");
        return result;
        } finally { doc.dispose(); }
      },
    },
  ];

  // ============ 分类页 ============
  category = {
    title: this.name,
    parts: [
      {
        name: "分类",
        type: "fixed",
        categories: [
          "全部",
          "日本漫画",
          "韩国漫画",
          "大陆漫画",
          "港台漫画",
          "漫画",
        ],
        itemType: "category",
        categoryParams: ["cat-0", "cat-1", "cat-2", "cat-3", "cat-4", "cat-5"],
      },
      {
        name: "标签",
        type: "fixed",
        categories: [
          "全部",
          "欢乐",
          "生活",
          "爱情",
          "奇幻",
          "冒险",
          "轻改",
          "魔幻",
          "重生",
          "修仙",
          "校园",
          "悬疑",
          "侦探",
          "玄幻",
          "职场",
          "搞笑",
          "格斗",
          "游戏",
          "灵异",
          "性转",
          "仙侠",
          "都市",
          "后宫",
          "穿越",
          "百合",
          "转生",
          "女主",
          "热血",
          "末世",
          "异界",
          "异能",
          "长篇",
          "宫廷",
          "萌系",
          "系统",
          "魔法",
          "科幻",
          "日常",
          "惊悚",
          "末日",
          "历史",
          "四格",
          "音乐",
          "伪娘",
          "武侠",
          "励志",
          "机战",
          "耽美",
          "复仇",
          "养成",
          "同人",
          "舰娘",
          "东方",
          "治愈",
          "美食",
          "言情",
          "逆袭",
          "竞技",
          "节操",
          "战争",
          "爆笑",
          "爱倩",
          "生存",
          "恐怖",
          "妹控",
          "战斗",
          "舞蹈",
          "诡异",
          "网游",
          "病娇",
          "推理",
          "恋爱",
          "彩色",
          "其他",
          "TL",
          "宅系",
          "FATE",
          "C103",
          "C105",
          "歡樂向",
          "愛情",
          "冒險",
          "神鬼",
          "轻小说",
          "格鬥",
          "後宮",
          "C106",
          "C107",
          "性转换",
          "AA",
        ],
        itemType: "category",
        categoryParams: [
          "tag-0",
          "tag-1",
          "tag-2",
          "tag-3",
          "tag-4",
          "tag-5",
          "tag-6",
          "tag-7",
          "tag-8",
          "tag-9",
          "tag-10",
          "tag-11",
          "tag-12",
          "tag-13",
          "tag-14",
          "tag-15",
          "tag-16",
          "tag-17",
          "tag-18",
          "tag-19",
          "tag-20",
          "tag-21",
          "tag-22",
          "tag-23",
          "tag-24",
          "tag-25",
          "tag-26",
          "tag-27",
          "tag-28",
          "tag-29",
          "tag-30",
          "tag-31",
          "tag-32",
          "tag-33",
          "tag-34",
          "tag-35",
          "tag-36",
          "tag-37",
          "tag-38",
          "tag-39",
          "tag-40",
          "tag-41",
          "tag-42",
          "tag-43",
          "tag-44",
          "tag-45",
          "tag-46",
          "tag-47",
          "tag-48",
          "tag-49",
          "tag-50",
          "tag-51",
          "tag-52",
          "tag-53",
          "tag-54",
          "tag-55",
          "tag-56",
          "tag-57",
          "tag-58",
          "tag-59",
          "tag-60",
          "tag-61",
          "tag-62",
          "tag-63",
          "tag-64",
          "tag-65",
          "tag-67",
          "tag-68",
          "tag-69",
          "tag-70",
          "tag-71",
          "tag-72",
          "tag-73",
          "tag-74",
          "tag-75",
          "tag-76",
          "tag-77",
          "tag-78",
          "tag-79",
          "tag-80",
          "tag-81",
          "tag-82",
          "tag-83",
          "tag-84",
          "tag-85",
          "tag-86",
          "tag-87",
          "tag-88",
          "tag-90",
          "tag-91",
        ],
      },
    ],
    enableRankingPage: false,
  };

  // ============ 分类漫画列表 ============
  categoryComics = {
    /**
     * @param category {string} 显示名
     * @param param {string?} categoryParam（cat-N / tag-N）
     * @param options {string[]}
     * @param page {number}
     * @returns {Promise<{comics: Comic[], maxPage: number}>}
     */
    load: async (category, param, options, page) => {
      let cat = "0";
      let tag = "0";
      if (param) {
        if (param.startsWith("cat-")) cat = param.slice(4);
        else if (param.startsWith("tag-")) tag = param.slice(4);
      }
      return this.loadList(`/sort?category=${cat}&tag=${tag}&page=${page || 1}`);
    },
  };

  // ============ 搜索 ============
  search = {
    /**
     * @param keyword {string}
     * @param options {string[]}
     * @param page {number}
     * @returns {Promise<{comics: Comic[], maxPage: number}>}
     */
    load: async (keyword, options, page) => {
      const q = encodeURIComponent(keyword);
      return this.loadList(`/search?query=${q}&page=${page || 1}`);
    },
  };

  // ============ 漫画详情与章节 ============
  comic = {
    /**
     * @param id {string}
     * @returns {Promise<ComicDetails>}
     */
    loadInfo: async (id) => {
      const url = `${this.base}/comic/${id}.html`;
      const body = await this.request(`/comic/${id}.html`, "详情");
      const doc = new HtmlDocument(body);
      try {

      const titleEl = doc.querySelector("h1");
      const title = titleEl ? titleEl.text.trim() : "";
      if (!title) throw new Error("W漫画详情结构无效，请重试");

      const cover = this.coverFromElement(doc.querySelector(".comic-profile .cover, img.cover"));

      // 作者：.author 中 "作者：xxx"
      let author = "";
      const authorEls = doc.querySelectorAll(".profile-meta p, .author");
      for (const a of authorEls) {
        const m = (a.text || "").match(/作者[：:]\s*(.+)/);
        if (m) {
          author = m[1].trim();
          break;
        }
      }

      // 状态：.status 中 "状态：连载中"
      let status = "";
      const statusEl = doc.querySelector(".profile-title span, .status");
      if (statusEl) {
        const m = (statusEl.text || "").match(/状态[：:]\s*(.+)/);
        status = m ? m[1].trim() : statusEl.text.trim();
      }

      // 标签：.author 内的 a.chaper-btn（href=/sort?tag=N）
      const tagTexts = [];
      const tagLinks = doc.querySelectorAll(".profile-tags a, .author a.chaper-btn");
      for (const tl of tagLinks) {
        const t = tl.text.trim();
        if (t) tagTexts.push(t);
      }

      // 简介
      const descEl = doc.querySelector(".profile-desc, .description");
      const description = descEl ? descEl.text.trim() : "";

      // 章节：优先通过 POST /comic/{contentId} 获取完整列表（含"加载更多"隐藏部分）
      const chapters = new Map();
      const contentId = this.extractContentId(body);
      if (!contentId) throw new Error("W漫画未取得完整目录标识，请重试");
      if (contentId) {
        try {
          const apiData = JSON.parse(await this.request(`/comic/${contentId}`, "完整目录", "POST"));
          if (
            apiData.code === 0 &&
            apiData.data &&
            Array.isArray(apiData.data.chapters) &&
            apiData.data.chapters.every(ch => ch && ch.id != null && String(ch.chapterName || "").trim())
          ) {
            let list = apiData.data.chapters.slice();
            // 旧版接口是倒序；新版总体正序但存在局部乱序，须与阅读页完整目录核对。
            const visibleIds = doc.querySelectorAll('#chaptersList a[href*="/chapter/"], .chapter-list .flex a.chaper-btn')
              .map(a => this.chapterIdFromHref(a.attributes.href || "")).filter(Boolean);
            const ids = list.map(ch => String(ch.id));
            if (new Set(ids).size !== ids.length || ids.some(ch => !/^\d+$/.test(ch))) throw new Error("目录包含无效或重复章节");
            if (list.some(ch => ch.contentId != null && String(ch.contentId) !== contentId)) throw new Error("目录作品标识不一致");
            if (visibleIds.some(ch => !ids.includes(ch))) throw new Error("完整目录缺少网页已有章节");
            if (visibleIds.length > 1 && ids.indexOf(visibleIds[0]) < ids.indexOf(visibleIds[visibleIds.length - 1])) list.reverse();
            const countEl = doc.querySelector("#chapterCount");
            const expected = countEl && countEl.text.match(/共\s*(\d+)\s*[话話章]/);
            if (expected && list.length < Number(expected[1])) throw new Error("完整目录数量不足");
            if (doc.querySelector(".comic-profile") && list.length > 1) {
              list = await this.readerChapterOrder(contentId, visibleIds[0] || String(list[list.length - 1].id), list);
            }
            for (const ch of list) {
              const chId = String(ch.id);
              const chTitle = ch.chapterName ? String(ch.chapterName).trim() : "";
              if (chId && chTitle) chapters.set(chId, chTitle);
            }
          } else {
            throw new Error("完整目录响应无效");
          }
        } catch (e) {
          throw new Error("W漫画完整目录加载失败，请重试：" + String(e));
        }
      }

      // 网页仅展示部分目录；完整接口失败时不能用可见章节覆盖完整目录。
      if (chapters.size === 0 && doc.querySelector("#chaptersList a, .chapter-list .flex a.chaper-btn")) throw new Error("W漫画目录响应与详情不一致，请重试");

      const tags = {};
      if (tagTexts.length) tags["标签"] = tagTexts;
      if (status) tags["状态"] = [status];

      return new ComicDetails({
        title,
        subTitle: author,
        cover,
        description,
        tags,
        chapters,
        updateTime: (doc.querySelector(".profile-meta time") || { text: "" }).text.trim(),
        url,
      });
      } finally {
        doc.dispose();
      }
    },

    /**
     * 新版从 totalPages / imgBaseUrl 取得官网声明的完整页数和图片目录。
     * 同时兼容旧版 num / pasd；不执行网页脚本，不固定页数。
     * @param comicId {string}
     * @param epId {string?} 章节 ID
     * @returns {Promise<{images: string[]}>}
     */
    loadEp: async (comicId, epId) => {
      if (!/^[\w-]+$/.test(String(comicId)) || !/^\d+$/.test(String(epId))) throw new Error("W漫画章节标识无效，请重新打开目录");
      const body = await this.request(`/chapter/${comicId}-${epId}.html`, "章节");
      return { images: this.chapterImages(body) };
    },

    // 防御性图片请求头：补 Referer / UA，避免 CDN 防盗链导致空白图
    onImageLoad: (url, comicId, epId) => {
      return {
        headers: {
          Referer: "https://www.wmanhua.com/",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        },
      };
    },
  };

  onThumbnailLoad = (url) => ({
    headers: { Referer: this.base + "/", "User-Agent": this.headers["User-Agent"] },
  });
}
