// ==============================================================================
// サンデーうぇぶり (Sunday Webry / https://www.sunday-webry.com/) Venera 漫画源
// 版本: 1.0.0
// 规范参照: 《Venera 漫画源开发日志（统一合并版 v3）》与 Venera 官方规范
// 特性支持:
//   1. 首页探索 (TODAY 今日更新 / 人気ランキング / 話題の作品)
//   2. 连载分类 (月~日曜日 / その他 / 読切 / 夜サンデー)
//   3. 站内搜索 (支持作品名与作者搜索)
//   4. 详情与目录 (通过 Atom feed 自动提取全量公开免费章节，按序排列)
//   5. 图像阅读与解码 (自动识别 GigaViewer baku 混淆算法并进行 4x4 逆置换还原)
// ==============================================================================

class SundayWebry extends ComicSource {
  name = "サンデーうぇぶり";
  key = "sunday_webry";
  version = "1.0.0";
  minAppVersion = "1.0.0";
  url = "https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/sunday_webry.js";

  static BASE_URL = "https://www.sunday-webry.com";
  static USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

  static WEEKDAYS = [
    ["月曜日", "monday"],
    ["火曜日", "tuesday"],
    ["水曜日", "wednesday"],
    ["木曜日", "thursday"],
    ["金曜日", "friday"],
    ["土曜日", "saturday"],
    ["日曜日", "sunday"],
    ["その他", "others"],
    ["読切", "oneshot"],
    ["夜サンデー", "yoru-sunday"]
  ];

  get headers() {
    return {
      "User-Agent": SundayWebry.USER_AGENT,
      "Referer": "https://www.sunday-webry.com/"
    };
  }

  async request(url) {
    const fullUrl = url.startsWith("http") ? url : `${SundayWebry.BASE_URL}${url.startsWith("/") ? "" : "/"}${url}`;
    const res = await Network.get(fullUrl, this.headers);
    if (res.status >= 400) {
      throw `网络请求失败 [${res.status}]: ${fullUrl}`;
    }
    return res.body;
  }

  decodeEntities(str) {
    if (!str) return "";
    return str
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
  }

  // ---------------- 探索页 ----------------
  explore = [
    {
      title: "サンデーうぇぶり",
      type: "singlePageWithMultiPart",
      load: async () => {
        const html = await this.request("/");
        const result = {};

        // 1. TODAY（今日更新）
        const todayMatch = html.match(/<section class="top-today">([\s\S]*?)<\/section>/i);
        if (todayMatch) {
          const todayComics = this.parseItemList(todayMatch[1]);
          if (todayComics.length > 0) {
            result["TODAY（今日更新）"] = todayComics;
          }
        }

        // 2. 人気ランキング
        const rankingMatch = html.match(/<section class="top-ranking">([\s\S]*?)<\/section>/i);
        if (rankingMatch) {
          const rankingComics = this.parseItemList(rankingMatch[1]);
          if (rankingComics.length > 0) {
            result["ランキング（人気作品）"] = rankingComics;
          }
        }

        // 3. 話題の作品 (BUZZ)
        const buzzMatch = html.match(/<section class="top-buzz">([\s\S]*?)<\/section>/i);
        if (buzzMatch) {
          const buzzComics = this.parseItemList(buzzMatch[1]);
          if (buzzComics.length > 0) {
            result["話題の作品"] = buzzComics;
          }
        }

        return result;
      }
    }
  ];

  // ---------------- 分类页 ----------------
  category = {
    title: "連載一覧",
    parts: [
      {
        name: "連載",
        type: "fixed",
        categories: SundayWebry.WEEKDAYS.map(w => w[0]),
        categoryParams: SundayWebry.WEEKDAYS.map(w => w[1]),
        itemType: "category"
      }
    ],
    enableRankingPage: false
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const p = String(param || "monday");
      if (p === "oneshot") {
        const html = await this.request("/series/oneshot");
        const comics = this.parseItemList(html);
        return { comics: comics, maxPage: 1 };
      }
      if (p === "yoru-sunday") {
        const html = await this.request("/series/yoru-sunday");
        const comics = this.parseItemList(html);
        return { comics: comics, maxPage: 1 };
      }

      // 曜日別连载
      const html = await this.request("/series");
      const sectionRegex = new RegExp(`id=["']series-${p}["'][\\s\\S]*?<\\/ul>`, "i");
      const match = html.match(sectionRegex);
      if (match) {
        const comics = this.parseItemList(match[0]);
        return { comics: comics, maxPage: 1 };
      }

      return { comics: [], maxPage: 1 };
    }
  };

  // ---------------- 搜索 ----------------
  search = {
    load: async (keyword, options, page) => {
      const kw = String(keyword || "").trim();
      if (!kw) return { comics: [], maxPage: 1 };

      const html = await this.request(`/search?q=${encodeURIComponent(kw)}`);
      const listMatch = html.match(/<ul class="series-list">([\s\S]*?)<\/ul>/i);
      if (!listMatch) {
        return { comics: [], maxPage: 1 };
      }

      const comics = [];
      const lis = [...listMatch[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
      for (const li of lis) {
        const itemHtml = li[1];
        const linkMatch = itemHtml.match(/href="([^"]+)"/);
        const titleMatch = itemHtml.match(/class="series-title"[^>]*>([\s\S]*?)<\/p>/i) || itemHtml.match(/data-title="([^"]+)"/i);
        const authorMatch = itemHtml.match(/class="author"[^>]*>([\s\S]*?)<\/p>/i);
        const imgMatch = itemHtml.match(/src="(https:\/\/[^"]+)"/i);

        if (linkMatch && titleMatch) {
          const href = linkMatch[1];
          const id = href.replace(/https?:\/\/[^\/]+/i, "");
          const title = this.decodeEntities(titleMatch[1].replace(/<[^>]+>/g, "").trim());
          const cover = imgMatch ? imgMatch[1] : "";
          const author = authorMatch ? this.decodeEntities(authorMatch[1].replace(/<[^>]+>/g, "").trim()) : "";

          comics.push(new Comic({
            id: id,
            title: title,
            cover: cover,
            subTitle: author
          }));
        }
      }

      return {
        comics: comics,
        maxPage: 1
      };
    }
  };

  // ---------------- 通用列表解析 ----------------
  parseItemList(htmlChunk) {
    const comics = [];
    const lis = [...htmlChunk.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)];
    for (const li of lis) {
      const itemHtml = li[1];
      const linkMatch = itemHtml.match(/href="([^"]+)"/);
      const titleMatch = itemHtml.match(/class="[^"]*series-title[^"]*"[^>]*>([\s\S]*?)<\/h[1-6]>/i) ||
                         itemHtml.match(/class="series-title"[^>]*>([\s\S]*?)<\/p>/i) ||
                         itemHtml.match(/alt="([^"]+)"/i);
      const authorMatch = itemHtml.match(/class="author"[^>]*>([\s\S]*?)<\/p>/i);
      const descMatch = itemHtml.match(/class="series-short-description"[^>]*>([\s\S]*?)<\/p>/i);
      const imgMatch = itemHtml.match(/data-src="([^"]+)"/i) || itemHtml.match(/src="(https:\/\/[^"]+)"/i);

      if (linkMatch && titleMatch) {
        const href = linkMatch[1];
        const id = href.replace(/https?:\/\/[^\/]+/i, "");
        const title = this.decodeEntities(titleMatch[1].replace(/<[^>]+>/g, "").trim());
        const cover = imgMatch ? imgMatch[1] : "";
        const author = authorMatch ? this.decodeEntities(authorMatch[1].replace(/<[^>]+>/g, "").trim()) : "";
        const desc = descMatch ? this.decodeEntities(descMatch[1].replace(/<[^>]+>/g, "").trim()) : "";

        comics.push(new Comic({
          id: id,
          title: title,
          cover: cover,
          subTitle: author,
          description: desc
        }));
      }
    }
    return comics;
  }

  // ---------------- 详情 / 章节 / 阅读 ----------------
  comic = {
    loadInfo: async (id) => {
      let normId = String(id || "");
      if (!normId.startsWith("http") && !normId.startsWith("/")) {
        normId = normId.startsWith("episode/") ? `/${normId}` : `/episode/${normId}`;
      }

      const epHtml = await this.request(normId);

      // 从页面中提取 Atom feed 地址
      const atomMatch = epHtml.match(/<link[^>]*type="application\/atom\+xml"[^>]*href="([^"]+)"/i);
      let atomUrl = atomMatch ? atomMatch[1] : "";

      let title = "";
      let cover = "";
      let description = "";
      let author = "";
      const tags = {};
      const chapters = new Map();

      // 提取 og 元信息兜底
      const ogTitleMatch = epHtml.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
      if (ogTitleMatch) title = this.decodeEntities(ogTitleMatch[1]);
      const ogImgMatch = epHtml.match(/<meta[^>]*property="og:image"[^>]*content="([^"]+)"/i);
      if (ogImgMatch) cover = ogImgMatch[1];
      const ogDescMatch = epHtml.match(/<meta[^>]*property="og:description"[^>]*content="([^"]+)"/i);
      if (ogDescMatch) description = this.decodeEntities(ogDescMatch[1]);

      if (atomUrl) {
        try {
          const atomXml = await this.request(atomUrl);
          const feedTitleMatch = atomXml.match(/<title>サンデーうぇぶり（([\s\S]*?)）<\/title>/i) ||
                                 atomXml.match(/<title>([\s\S]*?)<\/title>/i);
          if (feedTitleMatch) title = this.decodeEntities(feedTitleMatch[1].trim());

          const feedDescMatch = atomXml.match(/<subtitle>([\s\S]*?)<\/subtitle>/i);
          if (feedDescMatch) description = this.decodeEntities(feedDescMatch[1].trim());

          const feedAuthorMatch = atomXml.match(/<author>\s*<name>([\s\S]*?)<\/name>/i);
          if (feedAuthorMatch) {
            author = this.decodeEntities(feedAuthorMatch[1].trim());
            tags["作者"] = [author];
          }

          const entries = [...atomXml.matchAll(/<entry>([\s\S]*?)<\/entry>/gi)];
          const epList = [];
          for (const entry of entries) {
            const entryXml = entry[1];
            const eTitle = entryXml.match(/<title>([\s\S]*?)<\/title>/i);
            const eLink = entryXml.match(/<link[^>]*href="([^"]+)"/i);
            const eThumb = entryXml.match(/<link[^>]*rel="enclosure"[^>]*href="([^"]+)"/i);
            if (eTitle && eLink) {
              const epHref = eLink[1];
              const epId = epHref.replace(/https?:\/\/[^\/]+/i, "");
              const epTitle = this.decodeEntities(eTitle[1].trim());
              epList.push({ id: epId, title: epTitle });
              if (!cover && eThumb) {
                cover = eThumb[1];
              }
            }
          }

          // 保持升序排列（第1话排在前面）
          epList.reverse();
          for (const ep of epList) {
            chapters.set(ep.id, ep.title);
          }
        } catch (e) {
          // Atom feed 获取失败时保持网页兜底
        }
      }

      // 若未从 Atom 提取到章节，则以当前页面作为单章兜底
      if (chapters.size === 0) {
        chapters.set(normId, title || "第1話");
      }

      return new ComicDetails({
        title: title || "サンデーうぇぶり作品",
        subtitle: author,
        cover: cover,
        description: description,
        tags: tags,
        chapters: chapters
      });
    },

    loadEp: async (comicId, epId) => {
      let normEpId = String(epId || "");
      if (!normEpId.startsWith("http") && !normEpId.startsWith("/")) {
        normEpId = normEpId.startsWith("episode/") ? `/${normEpId}` : `/episode/${normEpId}`;
      }

      const epHtml = await this.request(normEpId);
      const jsonMatch = epHtml.match(/id=['"]episode-json['"][^>]*data-value=['"]([\s\S]*?)['"]/i);
      if (!jsonMatch) {
        throw "无法解析阅读器数据：未找到 episode-json。";
      }

      const rawJson = this.decodeEntities(jsonMatch[1]);
      let data;
      try {
        data = JSON.parse(rawJson);
      } catch (err) {
        throw "解析 episode-json 失败: " + err;
      }

      const prod = data.readableProduct || {};
      if (!prod.isPublic && !prod.hasPurchased) {
        throw "该章节需要在 サンデーうぇぶり App 内购买阅读。";
      }

      const structure = prod.pageStructure || {};
      const isBaku = structure.choJuGiga === "baku";
      const pages = structure.pages || [];
      const mainPages = pages.filter(p => p.type === "main");

      if (mainPages.length === 0) {
        throw "该章节未包含可阅读的主内容页面。";
      }

      const images = mainPages.map(p => {
        const src = p.src;
        if (!src) return "";
        return isBaku ? `${src}#scramble=baku` : src;
      }).filter(Boolean);

      return {
        images: images
      };
    },

    onImageLoad: (url) => {
      const isBaku = url.indexOf("#scramble=baku") !== -1 || url.indexOf("_baku=1") !== -1;
      const cleanUrl = url.replace(/#scramble=baku/g, "").replace(/[?&]_baku=1/g, "");
      const headers = {
        "Referer": "https://www.sunday-webry.com/",
        "User-Agent": SundayWebry.USER_AGENT
      };

      if (isBaku) {
        // GigaViewer baku 4x4 逆置换还原算法
        const modifyScript = `
function modifyImage(image) {
  const width = image.width;
  const height = image.height;
  const DIVIDE_NUM = 4;
  const MULTIPLE = 8;
  const cell_width = Math.floor(width / (DIVIDE_NUM * MULTIPLE)) * MULTIPLE;
  const cell_height = Math.floor(height / (DIVIDE_NUM * MULTIPLE)) * MULTIPLE;
  const copy = image.copyRange(0, 0, width, height);
  for (let e = 0; e < DIVIDE_NUM * DIVIDE_NUM; e++) {
    const t = Math.floor(e / DIVIDE_NUM) * cell_height;
    const n = (e % DIVIDE_NUM) * cell_width;
    const r = Math.floor(e / DIVIDE_NUM);
    const i = (e % DIVIDE_NUM) * DIVIDE_NUM + r;
    const o = (i % DIVIDE_NUM) * cell_width;
    const s = Math.floor(i / DIVIDE_NUM) * cell_height;
    image.fillImageRangeAt(o, s, copy, n, t, cell_width, cell_height);
  }
  return image;
}
`;
        return {
          url: cleanUrl,
          headers: headers,
          modifyImage: modifyScript
        };
      }

      return {
        url: cleanUrl,
        headers: headers
      };
    },

    onThumbnailLoad: (url) => {
      return {
        headers: {
          "Referer": "https://www.sunday-webry.com/",
          "User-Agent": SundayWebry.USER_AGENT
        }
      };
    },

    onClickTag: (namespace, tag) => {
      return {
        action: "search",
        keyword: tag,
        param: null
      };
    }
  };
}
