
/** @type {import('./_venera_.js')} */
class WManHua extends ComicSource {
  // 显示名称
  name = "W漫画";

  // 唯一内部标识（保持稳定，勿随意修改）
  key = "wmanhua";

  version = "1.0.1";

  // 与官方 singlePageWithMultiPart 参考源保持一致的最低版本
  minAppVersion = "1.4.0";

  // 无托管更新地址，显式留空（不要把漫画网站页面误当更新地址）
  url = "";

  base = "https://www.wmanhua.com";

  // ============ 通用工具 ============

  absoluteUrl(url) {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("//")) return "https:" + url;
    if (url.startsWith("/")) return this.base + url;
    return url;
  }

  // 漫画 ID：兼容数字 (/comic/8884.html) 与字母 slug (/comic/doupocangqiong.html)
  comicIdFromHref(href) {
    if (!href) return "";
    const m = href.match(/\/comic\/([^/]+?)\.html/);
    return m ? m[1] : href;
  }

  // 章节 ID：/chapter/8884-1028112.html -> 1028112
  chapterIdFromHref(href) {
    if (!href) return "";
    const m = href.match(/\/chapter\/[^/]+-(\d+)\.html/);
    return m ? m[1] : "";
  }

  // 将字符串转为 ArrayBuffer，用于 Network.post 的 body 参数
  stringToArrayBuffer(str) {
    const buf = new ArrayBuffer(str.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < str.length; i++) {
      view[i] = str.charCodeAt(i);
    }
    return buf;
  }

  // 从详情页脚本中提取数字 contentId（加载更多 API 需要数字 ID）
  extractContentId(body) {
    if (!body) return "";
    const m = body.match(/const\s+contentId\s*=\s*['"](\d+)['"]/);
    return m ? m[1] : "";
  }

  // 通用卡片解析（首页/搜索/分类/相关推荐复用同一结构）
  parseCard(item) {
    const a = item.querySelector("a");
    if (!a) return null;
    const href = a.attributes.href || "";
    const id = this.comicIdFromHref(href);
    const img = item.querySelector("img.lazy") || item.querySelector("img");
    let cover = "";
    if (img) {
      cover = img.attributes["data-src"] || img.attributes.src || "";
    }
    const titleEl = item.querySelector(".cardtitle");
    const title = titleEl ? titleEl.text.trim() : "";
    if (!id || !title) return null;
    return new Comic({
      id,
      title,
      cover: this.absoluteUrl(cover),
    });
  }

  parseCards(root) {
    const items = root.querySelectorAll(".card-content");
    const comics = [];
    for (const it of items) {
      const c = this.parseCard(it);
      if (c) comics.push(c);
    }
    return comics;
  }

  // 从 .page-number（"1 of 476"）解析最大页码
  parseMaxPage(doc) {
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
        const res = await Network.get(`${this.base}/`);
        const doc = new HtmlDocument(res.body);
        const blocks = doc.querySelectorAll(".card-main");
        const result = {};
        for (const block of blocks) {
          const titleEl = block.querySelector(".card-title h2");
          if (!titleEl) continue;
          const title = titleEl.text.trim();
          if (!title) continue;
          const comics = this.parseCards(block);
          if (comics.length > 0) result[title] = comics;
        }
        doc.dispose();
        return result;
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
      const url = `${this.base}/sort?category=${cat}&tag=${tag}&page=${page}`;
      const res = await Network.get(url);
      const doc = new HtmlDocument(res.body);
      const comics = this.parseCards(doc);
      const maxPage = this.parseMaxPage(doc);
      doc.dispose();
      return { comics, maxPage };
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
      const url = `${this.base}/search?query=${q}&page=${page}`;
      const res = await Network.get(url);
      const doc = new HtmlDocument(res.body);
      const comics = this.parseCards(doc);
      const maxPage = this.parseMaxPage(doc);
      doc.dispose();
      return { comics, maxPage };
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
      const res = await Network.get(url);
      const doc = new HtmlDocument(res.body);

      const titleEl = doc.querySelector("h1");
      const title = titleEl ? titleEl.text.trim() : "";

      const coverEl = doc.querySelector("img.cover");
      let cover = "";
      if (coverEl) {
        cover = coverEl.attributes["data-src"] || coverEl.attributes.src || "";
      }
      cover = this.absoluteUrl(cover);

      // 作者：.author 中 "作者：xxx"
      let author = "";
      const authorEls = doc.querySelectorAll(".author");
      for (const a of authorEls) {
        const m = (a.text || "").match(/作者[：:]\s*(.+)/);
        if (m) {
          author = m[1].trim();
          break;
        }
      }

      // 状态：.status 中 "状态：连载中"
      let status = "";
      const statusEl = doc.querySelector(".status");
      if (statusEl) {
        const m = (statusEl.text || "").match(/状态[：:]\s*(.+)/);
        if (m) status = m[1].trim();
      }

      // 标签：.author 内的 a.chaper-btn（href=/sort?tag=N）
      const tagTexts = [];
      const tagLinks = doc.querySelectorAll(".author a.chaper-btn");
      for (const tl of tagLinks) {
        const t = tl.text.trim();
        if (t) tagTexts.push(t);
      }

      // 简介
      const descEl = doc.querySelector(".description");
      const description = descEl ? descEl.text.trim() : "";

      // 章节：优先通过 POST /comic/{contentId} 获取完整列表（含"加载更多"隐藏部分）
      let chapters = {};
      const contentId = this.extractContentId(res.body);
      if (contentId) {
        try {
          const apiBody = this.stringToArrayBuffer(JSON.stringify({}));
          const apiRes = await Network.post(
            `${this.base}/comic/${contentId}`,
            {
              "Content-Type": "application/json",
              Referer: `${this.base}/comic/${id}.html`,
            },
            apiBody
          );
          const apiData = JSON.parse(apiRes.body || "{}");
          if (
            apiData.code === 0 &&
            apiData.data &&
            Array.isArray(apiData.data.chapters) &&
            apiData.data.chapters.length > 0
          ) {
            // API 默认按最新话在前倒序返回，这里反转为正序（第1话在前）以符合阅读顺序
            const list = apiData.data.chapters.slice().reverse();
            for (const ch of list) {
              const chId = String(ch.id);
              const chTitle = ch.chapterName ? String(ch.chapterName).trim() : "";
              if (chId && chTitle) chapters[chId] = chTitle;
            }
          }
        } catch (e) {
          // API 失败时回退到 HTML 解析
          chapters = {};
        }
      }

      // 兜底：如果 API 没有返回章节，则解析当前 HTML 中可见的章节
      if (Object.keys(chapters).length === 0) {
        const chapterLinks = doc.querySelectorAll(
          ".chapter-list .flex a.chaper-btn"
        );
        for (const cl of chapterLinks) {
          const chId = this.chapterIdFromHref(cl.attributes.href || "");
          const chTitle = cl.text.trim();
          if (chId && chTitle) chapters[chId] = chTitle;
        }
      }

      doc.dispose();

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
      });
    },

    /**
     * 加载章节图片。图片由章节页内联脚本生成：
     *   var num = eval("36");                       // 图片数量
     *   var pasd = "https://image?.wmanhua.com/.../"; // 图片目录
     *   图片 = pasd + i + ".webp"  (i = 1..num)
     * 经验证为明文 URL，无加密、无 AES/XOR/Base64。
     * @param comicId {string}
     * @param epId {string?} 章节 ID
     * @returns {Promise<{images: string[]}>}
     */
    loadEp: async (comicId, epId) => {
      const url = `${this.base}/chapter/${comicId}-${epId}.html`;
      const res = await Network.get(url);
      const body = res.body || "";
      const numMatch = body.match(
        /var\s+num\s*=\s*eval\(\s*["']?\s*(\d+)\s*["']?\s*\)/
      );
      const pasdMatch = body.match(/var\s+pasd\s*=\s*["']([^"']+)["']/);
      const images = [];
      if (numMatch && pasdMatch) {
        const num = parseInt(numMatch[1], 10);
        let pasd = pasdMatch[1];
        if (!pasd.endsWith("/")) pasd += "/";
        for (let i = 1; i <= num; i++) {
          images.push(`${pasd}${i}.webp`);
        }
      }
      return { images };
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
}
