/**
 * 古风漫画（gfmh.app）Venera 漫画源
 *
 * v1.3.0：补全 ComicDetails 的 subtitle、subId、url、isFavorite 和 thumbnails，降低客户端阅读器/已读状态对可选空字段的兼容风险；保留 v1.2.0 的封面代理、搜索和 params 修复。
 *
 * 已验证：
 * - 首页 div.comic_box / li / a.pic / a.txt / .author
 * - 分类 .c_list .catagory-list > li / a.img.autoHeight / a.txt / span.info
 * - 分类分页 /category/.../page/N，页面文本可给出 maxPage
 * - 详情 .infocomic .infobox、.info p.tage、.chapterbox .listbox ul.list
 * - 当前阅读页 params 的 AES-CBC/JSON 解密，已从实时样本恢复 70 张图片
 * - 旧式阅读页 #manga-imgs img.lazy-read 的 src/data-src 直链兼容分支
 * - 搜索页 .u_list > li 独立结果结构
 * - cover1.baozimh.org 封面改用 s2.325784.xyz Base64 图片代理
 * - 已删除详情页的“漫画不存在或章节已被删除”错误边界
 */

class Gfmh extends ComicSource {
  name = "古风漫画";
  key = "GfmhApp";
  version = "1.3.0";
  minAppVersion = "1.6.0";
  url = "https://gfmh.app/";

  baseUrl = "https://gfmh.app";
  requestHeaders = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36",
    "Referer": "https://gfmh.app/",
  };

  // 由当前 pic.js 的 decryptParams 静态还原并用实时 params 样本验证。
  paramKey = "9S8$vJnU2ANeSRoF";
  _chapterMeta = {};

  absoluteUrl(value) {
    if (!value) return "";
    if (/^https?:\/\//i.test(value)) return value;
    return `${this.baseUrl}${value.startsWith("/") ? "" : "/"}${value}`;
  }

  // cover1.baozimh.org 在 Venera RHTTP 中反复出现 TLS EOF；站点自己的 s2 代理可稳定返回 WebP。
  coverUrl(value) {
    const absolute = this.absoluteUrl(value);
    if (!absolute || !/^https:\/\/cover1\.baozimh\.org\//i.test(absolute)) return absolute;
    try {
      const encoded = Convert.encodeBase64(Convert.encodeUtf8(absolute));
      const base64 = typeof encoded === "string" ? encoded : Convert.decodeUtf8(encoded);
      if (base64) return `https://s2.325784.xyz/${String(base64).replace(/=+$/, "")}`;
    } catch (error) {
      console.warn("gfmh cover proxy encode failed", error);
    }
    return absolute;
  }

  comicIdFromHref(href) {
    if (!href) return null;
    const match = href.match(/\/([0-9]+)\.html(?:[?#].*)?$/);
    return match ? match[1] : null;
  }

  chapterIdFromHref(href) {
    if (!href) return null;
    const match = href.match(/\/([0-9]+)\/([0-9]+)\.html(?:[?#].*)?$/);
    return match ? match[2] : null;
  }

  extractChapterRaw(value) {
    if (value == null) return "";
    if (typeof value === "object") {
      return String(
        value.epId ?? value.chapterId ?? value.id ?? value.key ?? value.url ?? value.href ?? value.value ?? ""
      ).trim();
    }
    return String(value).trim();
  }

  normalizeChapter(comicId, epId) {
    const comic = String(comicId ?? "").match(/^\d+$/)?.[0] || null;
    let raw = this.extractChapterRaw(epId);
    try {
      raw = decodeURIComponent(raw);
    } catch (_) {
      // Keep the original value if a client supplies a partially encoded history ID.
    }
    if (raw.includes("|")) raw = raw.split("|").pop().trim();

    let chapter = null;
    let embeddedComic = null;
    let match = raw.match(/(?:^|\/)(\d+)\/(\d+)\.html(?:[?#].*)?$/i);
    if (match) {
      embeddedComic = match[1];
      chapter = match[2];
    }
    if (!chapter) {
      match = raw.match(/(?:^|[:/,])([0-9]+)[:/,]([0-9]+)(?:$|[?#])/);
      if (match) {
        embeddedComic = match[1];
        chapter = match[2];
      }
    }
    if (!chapter && /^\d+$/.test(raw)) chapter = raw;

    if (!comic || !chapter || (embeddedComic && embeddedComic !== comic)) return null;
    return {
      comic,
      chapter,
      key: `${comic}|${chapter}`,
      url: `${this.baseUrl}/${comic}/${chapter}.html`,
    };
  }

  extractParams(body) {
    const match = String(body || "").match(/\bparams\s*=\s*(['"])([^'"]+)\1/);
    return match ? match[2] : null;
  }

  decodeChapterParams(value) {
    if (!value) return null;
    try {
      let encoded = String(value).replace(/\s/g, "");
      encoded += "=".repeat((4 - (encoded.length % 4)) % 4);
      const encrypted = Convert.decodeBase64(encoded);
      const bytes = new Uint8Array(encrypted);
      if (bytes.length <= 16) return null;

      const iv = encrypted.slice(0, 16);
      const ciphertext = encrypted.slice(16);
      const plaintext = Convert.decryptAesCbc(
        ciphertext,
        Convert.encodeUtf8(this.paramKey),
        iv
      );
      const text = Convert.decodeUtf8(plaintext).trim();
      const start = text.indexOf("{");
      const end = text.lastIndexOf("}");
      if (start < 0 || end < start) return null;
      const data = JSON.parse(text.slice(start, end + 1));
      const host = String(data.host || "").toLowerCase().replace(/^www\./, "");
      if (host && host !== "gfmh.app") return null;
      if (!Array.isArray(data.images)) return null;
      return data;
    } catch (error) {
      console.warn("gfmh params decode failed", error);
      return null;
    }
  }

  rememberChapterMeta(context, data) {
    if (!context || !data) return;
    this._chapterMeta[context.key] = {
      sourceId: String(data.source_id ?? ""),
      host: String(data.host ?? "gfmh.app"),
    };
  }

  async getDocument(url) {
    const res = await Network.get(url, this.requestHeaders);
    if (res.status !== 200) {
      throw `Invalid status code: ${res.status}`;
    }
    if (/漫画不存在或章节已被删除/.test(String(res.body || ""))) {
      throw "Comic not found";
    }
    return new HtmlDocument(res.body);
  }

  parseHomeItem(item) {
    const link = item.querySelector("a.pic") || item.querySelector("a.txt");
    const titleElement = item.querySelector("a.txt");
    const imageElement = item.querySelector("a.pic img") || item.querySelector("img");
    if (!link || !titleElement || !imageElement) return null;

    const id = this.comicIdFromHref(link.attributes.href || titleElement.attributes.href);
    const title = titleElement.text.trim();
    const cover = this.coverUrl(imageElement.attributes.src || imageElement.attributes["data-src"]);
    if (!id || !title || !cover) return null;

    const author = item.querySelector(".author")?.text.trim() || "";
    return new Comic({
      id,
      title,
      cover,
      subTitle: author,
    });
  }

  parseListItem(item) {
    const coverLink = item.querySelector("a.img.autoHeight") || item.querySelector("a.pic");
    const titleElement = item.querySelector("a.txt");
    const imageElement = coverLink?.querySelector("img") || item.querySelector("img");
    if (!coverLink || !titleElement || !imageElement) return null;

    const id = this.comicIdFromHref(coverLink.attributes.href || titleElement.attributes.href);
    const title = titleElement.text.trim();
    const cover = this.coverUrl(
      imageElement.attributes.src ||
      imageElement.attributes["data-src"] ||
      imageElement.attributes["data-original"]
    );
    if (!id || !title || !cover) return null;

    const info = item.querySelector("span.info")?.text.trim() || "";
    return new Comic({
      id,
      title,
      cover,
      subTitle: info,
    });
  }

  parseSearchItem(item) {
    const titleElement = item.querySelector("a.name") || item.querySelector("a.txt");
    const detailLink = titleElement || Array.from(item.querySelectorAll("a[href]")).find((link) => this.comicIdFromHref(link.attributes.href));
    const imageElement = item.querySelector(".pic img") || item.querySelector("img");
    if (!detailLink || !imageElement) return null;

    const href = detailLink.attributes.href || "";
    const id = this.comicIdFromHref(href);
    const title = titleElement?.text.trim() || detailLink.text.trim();
    const cover = this.coverUrl(
      imageElement.attributes.src ||
      imageElement.attributes["data-src"] ||
      imageElement.attributes["data-original"]
    );
    if (!id || !title || !cover) return null;

    const author = item.querySelector(".neirong .tage")?.text.trim() || item.querySelector(".author")?.text.trim() || "";
    return new Comic({ id, title, cover, subTitle: author });
  }

  parseMaxPage(document, page) {
    let maxPage = page;
    const blocks = document.querySelectorAll(".pagebox");
    for (const block of blocks) {
      const text = block.text || "";
      const match = text.match(/共\s*\d+本\s*\/\s*共\s*(\d+)页/);
      if (match) maxPage = Math.max(maxPage, parseInt(match[1]));
    }
    for (const link of document.querySelectorAll(".pagebox a")) {
      const href = link.attributes.href || "";
      const match = href.match(/\/page\/(\d+)(?:[/?#]|$)/);
      if (match) maxPage = Math.max(maxPage, parseInt(match[1]));
    }
    return Math.max(1, maxPage || 1);
  }

  parseCategoryPath(category, param, page) {
    const safePage = Math.max(1, parseInt(page) || 1);
    let path = "/category/";
    if (category === "all" || !category) {
      path = "/category/";
    } else if (category === "update") {
      path = "/custom/update";
    } else if (category === "hot") {
      path = "/custom/hot";
    } else if (category === "end") {
      path = "/custom/end";
    } else if (category === "quality" && param) {
      path = `/category/quality/${encodeURIComponent(param)}`;
    } else if (["list", "finish", "city", "tags"].includes(category) && param) {
      path = `/category/${category}/${encodeURIComponent(param)}`;
    } else {
      return null;
    }
    if (safePage > 1) path += `/page/${safePage}`;
    return `${this.baseUrl}${path}`;
  }

  async loadListPage(url, page) {
    let document = null;
    try {
      document = await this.getDocument(url);
      const nodes = document.querySelectorAll(".c_list .catagory-list > li");
      const comics = [];
      for (const node of nodes) {
        const comic = this.parseListItem(node);
        if (comic) comics.push(comic);
      }
      return {
        comics,
        maxPage: this.parseMaxPage(document, page),
      };
    } finally {
      document?.dispose();
    }
  }

  explore = [
    {
      title: "古风漫画",
      type: "multiPartPage",
      load: async () => {
        let document = null;
        try {
          document = await this.getDocument(this.baseUrl + "/");
          const result = [];
          for (const section of document.querySelectorAll("div.comic_box")) {
            const title = section.querySelector(".title .h2")?.text.trim() || "古风漫画";
            const comics = [];
            for (const item of section.querySelectorAll("ul > li")) {
              const comic = this.parseHomeItem(item);
              if (comic) comics.push(comic);
            }
            if (comics.length > 0) {
              result.push({
                title,
                comics,
                viewMore: {
                  page: "category",
                  attributes: {
                    category: title === "新作尝鲜" ? "update" : "all",
                    param: null,
                  },
                },
              });
            }
          }
          return result;
        } finally {
          document?.dispose();
        }
      },
    },
  ];

  category = {
    title: "古风漫画",
    parts: [
      {
        name: "地区",
        type: "fixed",
        categories: [
          { label: "全部", target: { page: "category", attributes: { category: "all", param: null } } },
          { label: "国产漫画", target: { page: "category", attributes: { category: "list", param: "1" } } },
          { label: "日本漫画", target: { page: "category", attributes: { category: "list", param: "2" } } },
          { label: "韩国漫画", target: { page: "category", attributes: { category: "list", param: "3" } } },
          { label: "欧美漫画", target: { page: "category", attributes: { category: "list", param: "4" } } },
          { label: "连载", target: { page: "category", attributes: { category: "finish", param: "1" } } },
          { label: "完结", target: { page: "category", attributes: { category: "finish", param: "2" } } },
          { label: "内地", target: { page: "category", attributes: { category: "city", param: "42" } } },
          { label: "港台", target: { page: "category", attributes: { category: "city", param: "43" } } },
          { label: "韩国地区", target: { page: "category", attributes: { category: "city", param: "44" } } },
          { label: "日本地区", target: { page: "category", attributes: { category: "city", param: "45" } } },
          { label: "欧美地区", target: { page: "category", attributes: { category: "city", param: "134" } } },
        ],
      },
      {
        name: "题材标签",
        type: "fixed",
        categories: [
          "韩国", "咚漫", "原创", "异形", "偶像", "歌舞", "宅斗", "宅向", "青春", "西幻", "冒险", "恋爱", "都市", "其它", "战斗", "其他", "灵异", "科幻", "纯爱", "现代", "总裁", "推理", "职场", "剧情",
        ].map((label, index) => ({
          label,
          target: { page: "category", attributes: { category: "tags", param: String([528, 529, 531, 532, 533, 534, 536, 538, 539, 540, 541, 542, 543, 544, 545, 546, 547, 548, 549, 550, 551, 552, 553, 554][index]) } },
        })),
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const url = this.parseCategoryPath(category, param, page);
      if (!url) return { comics: [], maxPage: page };
      try {
        return await this.loadListPage(url, page);
      } catch (error) {
        console.warn("gfmh category load failed", error);
        return { comics: [], maxPage: page };
      }
    },
    optionList: [],
  };

  search = {
    load: async (keyword, options, page) => {
      const safePage = Math.max(1, parseInt(page) || 1);
      const query = encodeURIComponent(keyword || "");
      const url = `${this.baseUrl}/index.php/search?key=${query}${safePage > 1 ? `&page=${safePage}` : ""}`;
      let document = null;
      try {
        const res = await Network.get(url, this.requestHeaders);
        if (res.status !== 200) return { comics: [], maxPage: safePage };
        document = new HtmlDocument(res.body);
        const nodes = document.querySelectorAll(".u_list > li");
        const comics = [];
        for (const node of nodes) {
          const comic = this.parseSearchItem(node);
          if (comic) comics.push(comic);
        }
        return { comics, maxPage: this.parseMaxPage(document, safePage) };
      } catch (error) {
        console.warn("gfmh search load failed", error);
        return { comics: [], maxPage: safePage };
      } finally {
        document?.dispose();
      }
    },
    optionList: [],
    enableTagsSuggestions: false,
  };

  comic = {
    loadInfo: async (id) => {
      const comicId = String(id || "").match(/^\d+$/)?.[0];
      if (!comicId) throw "Invalid comic id";
      let document = null;
      try {
        document = await this.getDocument(`${this.baseUrl}/${comicId}.html`);
        const box = document.querySelector(".infocomic .infobox");
        const titleElement = document.querySelector(".infobox .title");
        const imageElement = document.querySelector(".infobox .info .img img");
        if (!box || !titleElement || !imageElement) throw "Comic not found";

        const title = titleElement.text.trim();
        const cover = this.coverUrl(imageElement.attributes.src || imageElement.attributes["data-src"]);
        const tags = {};
        const metaNodes = document.querySelectorAll(".infobox .info p.tage");
        for (const node of metaNodes) {
          const text = node.text.trim();
          if (text.startsWith("作者：")) tags["作者"] = [text.replace("作者：", "").trim()];
          if (text.startsWith("类型：")) tags["类型"] = node.querySelectorAll("a").map((e) => e.text.trim()).filter((e) => e);
        }
        const updateNode = Array.from(metaNodes).find((node) => node.text.trim().startsWith("更新于："));
        const updateTime = updateNode ? updateNode.text.trim().replace("更新于：", "").trim() : "";
        const description = document.querySelector(".infocomic .text")?.text.trim() || "";

        const chapters = new Map();
        for (const node of document.querySelectorAll(".chapterbox .listbox ul.list li a")) {
          const chapterId = this.chapterIdFromHref(node.attributes.href);
          const chapterTitle = node.text.trim();
          if (chapterId && chapterTitle) chapters.set(chapterId, chapterTitle);
        }
        if (chapters.size === 0) throw "No chapters found";

        const author = tags["作者"]?.[0] || "";
        return new ComicDetails({
          title: title || comicId,
          subtitle: author,
          subTitle: author,
          cover: cover || "",
          description: description || "",
          tags,
          chapters,
          isFavorite: false,
          subId: comicId,
          thumbnails: cover ? [cover] : [],
          recommend: [],
          updateTime: updateTime || "",
          url: `${this.baseUrl}/${comicId}.html`,
        });
      } finally {
        document?.dispose();
      }
    },

    loadThumbnails: async (id, next) => {
      if (next != null) return { thumbnails: [], next: null };
      try {
        const details = await this.comic.loadInfo(id);
        return { thumbnails: details.cover ? [details.cover] : [], next: null };
      } catch (error) {
        return { thumbnails: [], next: null };
      }
    },

    loadEp: async (comicId, epId) => {
      const context = this.normalizeChapter(comicId, epId);
      if (!context) return { images: [] };

      let document = null;
      try {
        const res = await Network.get(context.url, {
          ...this.requestHeaders,
          Referer: context.url,
        });
        if (res.status !== 200) return { images: [] };

        // 当前站点不把图片写入静态 HTML，而是把完整 params 放在内联脚本中。
        const encodedParams = this.extractParams(res.body);
        if (encodedParams) {
          const data = this.decodeChapterParams(encodedParams);
          if (!data) return { images: [] };
          this.rememberChapterMeta(context, data);
          const images = data.images
            .map((value) => this.absoluteUrl(String(value || "")))
            .filter((value, index, array) => /^https?:\/\//i.test(value) && array.indexOf(value) === index);
          return { images };
        }

        // 兼容历史上直接包含 img.lazy-read 的阅读页。
        document = new HtmlDocument(res.body);
        const images = [];
        const nodes = document.querySelectorAll("#manga-imgs img.lazy-read, #manga-imgs img");
        for (const node of nodes) {
          const value = node.attributes["data-src"] || node.attributes.src || "";
          const imageUrl = this.absoluteUrl(value);
          if (!/^https?:\/\//i.test(imageUrl)) continue;
          if (/lazy-read\.gif/i.test(imageUrl)) continue;
          if (!images.includes(imageUrl)) images.push(imageUrl);
        }
        return { images };
      } catch (error) {
        console.warn("gfmh chapter load failed", error);
        return { images: [] };
      } finally {
        document?.dispose();
      }
    },

    onImageLoad: (url, comicId, epId) => {
      const context = this.normalizeChapter(comicId, epId);
      return {
        headers: {
          ...this.requestHeaders,
          Referer: context?.url || this.requestHeaders.Referer,
        },
      };
    },

    onThumbnailLoad: (url) => ({
      headers: this.requestHeaders,
    }),

    idMatch: "^\\d+$",
    link: {
      domains: ["gfmh.app", "www.gfmh.app"],
      linkToId: (url) => {
        const match = String(url || "").match(/^https?:\/\/(?:www\.)?gfmh\.app\/(\d+)\.html(?:[?#].*)?$/i);
        return match ? match[1] : null;
      },
    },
  };
}
