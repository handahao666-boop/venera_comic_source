/**
 * MOJOIN 漫画源（Venera 兼容版 v1.0.5）
 *
 * 导入规则：顶层只保留一个 class ... extends ComicSource；
 * 不手动实例化、不手动注册 ComicSource.sources；
 * minAppVersion 必须是三段纯数字，避免 Venera compareSemVer 的 FormatException。
 * MOJOIN 正文图片使用已取证的 content[].url + content[].key 双层 AES-CBC/PKCS7 协议。
 */
class MojoinV2 extends ComicSource {
  name = "MOJOIN";
  key = "mojoin_v2";
  version = "1.0.7";
  minAppVersion = "1.0.0";
  url = "";

  baseUrl = "https://mojoin.com";
  apiBase = "https://mojoin-api.com/comics";
  defaultUuid = "84dfaa9a-f750-4b5b-8f77-e44358c77ed5";
  runtimeUuid = "";
  imageToken = "freereadingcomicstar";
  imageMarkerPrefix = "mojoin-crypt-v4:";
  ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Safari/537.36";

  categoryTypes = [
    [1, "劇情"], [2, "幽默搞笑"], [3, "愛情"], [4, "奇幻架空"],
    [5, "恐怖"], [6, "冒險動作"], [7, "歷史古裝"], [8, "推理懸疑"],
    [9, "圖文記事"], [11, "BL耽美"], [12, "科幻"], [13, "GL百合"],
    [14, "軍事"], [15, "職人"], [16, "武俠"], [17, "溫馨療癒"],
    [19, "獨家原創"], [22, "戀愛"], [23, "少年熱血"], [24, "妖怪"],
    [25, "民俗"], [26, "戰爭"], [30, "職場"], [32, "少女漫畫"],
    [37, "靈異"], [40, "災難"], [42, "武術"], [43, "治癒系"],
    [45, "四格漫畫"], [50, "學園"], [52, "動物"], [58, "運動"],
    [61, "穿越"], [68, "社會議題"], [72, "偶像"], [74, "Vtuber"],
    [77, "LGBTQIA+"], [79, "戰鬥"], [80, "特別企劃"], [81, "耽美"],
    [83, "跨界合作"], [84, "遊戲改編"], [101, "奇幻架空專區"], [102, "Global"],
    [103, "成人向"], [104, "第17屆金漫獎入圍作品專區"],
  ];

  init() {
    this.runtimeUuid = this.defaultUuid;
    this.refreshGuestUuid();
  }

  async refreshGuestUuid() {
    try {
      const response = await Network.get(
        `${this.apiBase}/guest`,
        this.apiHeaders(`${this.baseUrl}/`, true)
      );
      const payload = JSON.parse(String(response.body || "{}"));
      const value = payload && payload.data;
      if (typeof value === "string" && value.trim()) this.runtimeUuid = value.trim();
    } catch (_) {
      // 访客 UUID 刷新失败时使用已取证的默认 UUID。
    }
  }

  errorMessage(error) {
    if (error == null) return "未知错误";
    if (typeof error === "string") return error;
    if (typeof error.message === "string" && error.message.trim()) return error.message;
    try {
      const text = JSON.stringify(error);
      return text && text !== "{}" ? text : String(error);
    } catch (_) {
      return String(error);
    }
  }

  waitMs(milliseconds) {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  isTransientError(error) {
    return /unexpected.?eof|timeout|timed out|connection reset|connection closed|closed connection|peer closed|broken pipe|network error|temporary network|sendrequest|connectionaborted|\baborted\b|connection refused|socket|host lookup|dns|unreachable/i.test(this.errorMessage(error));
  }

  queryString(params) {
    const parts = [];
    Object.keys(params || {}).forEach((name) => {
      const value = params[name];
      if (value === undefined || value === null || value === "") return;
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== undefined && item !== null && item !== "") {
            parts.push(`${encodeURIComponent(String(name))}=${encodeURIComponent(String(item))}`);
          }
        });
      } else {
        parts.push(`${encodeURIComponent(String(name))}=${encodeURIComponent(String(value))}`);
      }
    });
    return parts.length > 0 ? `?${parts.join("&")}` : "";
  }

  apiHeaders(referer, withoutUuid) {
    const headers = {
      "User-Agent": this.ua,
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
      "Origin": this.baseUrl,
      "Referer": referer || `${this.baseUrl}/comics`,
      device: "web",
    };
    if (!withoutUuid) headers.uuid = this.runtimeUuid || this.defaultUuid;
    return headers;
  }

  async requestJson(path, params, referer, maxAttempts) {
    const requestedAttempts = Number(maxAttempts) || 2;
    const attemptLimit = Math.max(1, Math.min(3, requestedAttempts));
    let lastError = null;
    let lastUrl = `${this.apiBase}${path}${this.queryString(params)}`;
    let uuidRefreshed = false;
    for (let attempt = 0; attempt < attemptLimit; attempt++) {
      const url = `${this.apiBase}${path}${this.queryString(params)}`;
      lastUrl = url;
      try {
        const response = await Network.get(url, this.apiHeaders(referer));
        const status = Number(response && response.status);
        const responseError = response && response.error;
        if (responseError && this.isTransientError(responseError)) {
          if (attempt < attemptLimit - 1) {
            await this.waitMs(250);
            continue;
          }
          throw new Error(`MOJOIN 网络请求失败：${responseError}`);
        }
        if (status >= 500 && status < 600 && attempt < attemptLimit - 1) {
          await this.waitMs(250);
          continue;
        }
        if (status && (status < 200 || status >= 400)) {
          throw new Error(`MOJOIN API HTTP ${status}：${url}`);
        }
        let payload;
        try {
          payload = JSON.parse(String(response.body || ""));
        } catch (_) {
          const bodyPreview = String(response.body || "").trim().slice(0, 100);
          throw new Error(`MOJOIN API 返回的不是 JSON：${bodyPreview || (responseError ? `网络错误：${responseError}` : "空响应")}`);
        }
        if (payload && payload.code !== undefined && Number(payload.code) !== 0) {
          const message = payload.message || payload.msg || payload.error || "接口拒绝请求";
          if (Number(payload.code) === 401) {
            if (!uuidRefreshed) {
              uuidRefreshed = true;
              await this.refreshGuestUuid();
              await this.waitMs(150);
              continue;
            }
            throw new Error(`MOJOIN API 需要访客/登录授权：${message}`);
          }
          if (Number(payload.code) === 403) throw new Error(`MOJOIN API 拒绝访问：${message}`);
          throw new Error(`MOJOIN API 错误 code=${payload.code}：${message}`);
        }
        return payload;
      } catch (error) {
        lastError = error;
        if (attempt < attemptLimit - 1 && this.isTransientError(error)) {
          await this.waitMs(250);
          continue;
        }
        throw new Error(`MOJOIN 请求失败：${this.errorMessage(error)} 地址：${url}`);
      }
    }
    throw new Error(`MOJOIN 请求失败：${this.errorMessage(lastError)} 地址：${lastUrl}`);
  }

  textFromHtml(value) {
    return String(value || "").replace(/<br\s*\/?>(\s*)/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/\s+/g, " ").trim();
  }

  normalizeSearchOption(value, allowed) {
    if (Array.isArray(value)) value = value[0];
    let raw = String(value === undefined || value === null ? "" : value).trim();
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "string") raw = parsed.trim();
    } catch (_) {}
    const dash = raw.indexOf("-");
    if (dash > 0) raw = raw.slice(0, dash).trim();
    return Array.isArray(allowed) && allowed.includes(raw) ? raw : "";
  }

  absoluteUrl(value, base) {
    const raw = String(value || "").trim();
    if (!raw || raw.startsWith("data:") || raw.startsWith("blob:")) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("//")) return `https:${raw}`;
    if (raw.startsWith("/")) return `${base}${raw}`;
    return `${base}/${raw}`;
  }

  uniqueStrings(values) {
    const result = [];
    (values || []).forEach((value) => {
      const text = String(value || "").trim();
      if (text && !result.includes(text)) result.push(text);
    });
    return result;
  }

  validBookId(value) {
    const match = String(value || "").match(/(?:^|\/)(\d+)(?:[/?#]|$)/);
    return match ? match[1] : "";
  }

  validChapterNumber(value) {
    const raw = String(value || "").trim();
    const route = raw.match(/\/comics\/(\d+)\/([^/?#]+)/i);
    if (route) return decodeURIComponent(route[2]);
    const route2 = raw.match(/\/chapter\/(\d+)[/-]([^/?#]+)/i);
    if (route2) return decodeURIComponent(route2[2].replace(/\.html$/i, ""));
    return raw.replace(/^.*\//, "").replace(/\.html?$/i, "");
  }

  parseBook(item) {
    if (!item || item.id === undefined || item.id === null) return null;
    const id = String(item.id);
    const typeItems = Array.isArray(item.type) ? item.type : (Array.isArray(item.book_type) ? item.book_type : []);
    const types = typeItems.map((entry) => typeof entry === "string" ? entry : entry && (entry.name || entry.nickname)).filter(Boolean);
    const tagItems = Array.isArray(item.tag) ? item.tag : [];
    const tags = tagItems.map((entry) => typeof entry === "string" ? entry : entry && entry.name).filter(Boolean);
    const hashTagItems = Array.isArray(item.hash_tag) ? item.hash_tag : (Array.isArray(item.hashTag) ? item.hashTag : []);
    const hashTags = hashTagItems.map((entry) => typeof entry === "string" ? entry : entry && entry.name).filter(Boolean);
    return new Comic({
      id: id,
      title: String(item.name || `MOJOIN 作品 ${id}`),
      subTitle: String(item.display_author || item.author || ""),
      cover: this.absoluteUrl(item.cover || item.small_cover, this.apiBase),
      tags: this.uniqueStrings(types.concat(tags, hashTags)),
      description: this.textFromHtml(item.intro),
      language: "繁體中文/多語言",
    });
  }

  parseBookList(payload) {
    const data = payload && payload.data;
    const list = data && Array.isArray(data.data) ? data.data : [];
    const comics = [];
    list.forEach((item) => {
      const comic = this.parseBook(item);
      if (comic && !comics.some((old) => old.id === comic.id)) comics.push(comic);
    });
    return { comics: comics, maxPage: data && Number(data.last_page) > 0 ? Number(data.last_page) : 1 };
  }

  async loadBookList(page, extraParams) {
    const params = { page: Math.max(1, Number(page) || 1), rows_per_page: 20 };
    Object.keys(extraParams || {}).forEach((name) => {
      const value = extraParams[name];
      if (value !== undefined && value !== null && value !== "") params[name] = value;
    });
    return this.parseBookList(await this.requestJson("/book", params, `${this.baseUrl}/comics`));
  }

  explore = [
    {
      title: "MOJOIN 最新更新",
      type: "multiPageComicList",
      load: async (page) => this.loadBookList(page, { order_by: "updated_at:desc" }),
    },
  ];

  category = {
    title: "MOJOIN 漫画分类",
    parts: [
      {
        name: "題材與專區",
        type: "fixed",
        categories: this.categoryTypes.map((item) => item[1]),
        categoryParams: this.categoryTypes.map((item) => String(item[0])),
        itemType: "category",
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    optionList: [
      {
        type: "select",
        label: "排序",
        default: "newest",
        options: ["newest-更新日：新到舊", "oldest-更新日：舊到新", "popular-高人氣", "favorite-最喜歡"],
      },
    ],
    load: async (category, param, options, page) => {
      const params = { type: String(param || "") };
      if (Array.isArray(options) && options[0]) params.filter = String(options[0]);
      return this.loadBookList(page, params);
    },
  };

  search = {
    optionList: [
      {
        type: "select",
        label: "排序",
        default: "related",
        options: ["related-最相關", "latest-最新上架", "updated-近期更新", "newest-更新日：新到舊", "oldest-更新日：舊到新", "popular-高人氣", "favorite-最喜歡"],
      },
    ],
    enableTagsSuggestions: false,
    load: async (keyword, options, page) => {
      const allowedFilters = ["related", "latest", "updated", "newest", "oldest", "popular", "favorite"];
      let filter = "related";
      if (options !== undefined && options !== null) {
        const first = Array.isArray(options) ? options[0] : options;
        filter = this.normalizeSearchOption(first, allowedFilters) || "related";
      }
      const trimmedKeyword = String(keyword || "").trim();
      if (!trimmedKeyword) return { comics: [], maxPage: 1 };
      return this.parseBookList(await this.requestJson("/search/page", {
        keyword: trimmedKeyword,
        page: Math.max(1, Number(page) || 1),
        rows_per_page: 20,
        subtype: 1,
        filter: filter,
      }, `${this.baseUrl}/comics/search`));
    },
  };

  hexToArrayBuffer(hex) {
    const clean = String(hex || "").trim();
    if (!/^[0-9a-f]+$/i.test(clean) || clean.length % 2 !== 0) throw new Error("MOJOIN 解密 key/iv 不是有效十六进制");
    const bytes = new Uint8Array(clean.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    return bytes.buffer;
  }

  // Venera 的 Convert.decryptAesCbc 直接使用 PointyCastle CBCBlockCipher，
  // 只做块解密，不自动移除 CryptoJS/OpenSSL 风格的 PKCS#7 尾部。
  unpadPkcs7(value) {
    const source = new Uint8Array(value || new ArrayBuffer(0));
    if (source.length === 0) throw new Error("MOJOIN AES 明文为空");
    const padding = source[source.length - 1];
    if (padding < 1 || padding > 16 || padding > source.length) throw new Error("MOJOIN AES PKCS#7 填充无效");
    for (let i = source.length - padding; i < source.length; i++) {
      if (source[i] !== padding) throw new Error("MOJOIN AES PKCS#7 填充无效");
    }
    return source.slice(0, source.length - padding).buffer;
  }

  decryptImageResponse(data, encryptedKey) {
    const encryptedKeyBuffer = Convert.decodeBase64(String(encryptedKey || ""));
    const digest = Convert.hexEncode(Convert.sha512(Convert.encodeUtf8(this.imageToken)));
    const outerKey = this.hexToArrayBuffer(digest.slice(0, 64));
    const outerIv = this.hexToArrayBuffer(digest.slice(30, 62));
    const keyPlain = Convert.decryptAesCbc(encryptedKeyBuffer, outerKey, outerIv);
    const keyText = Convert.decodeUtf8(this.unpadPkcs7(keyPlain));
    const parts = String(keyText || "").trim().split(":");
    if (parts.length < 2) throw new Error("MOJOIN 图片密钥解包失败");
    const imagePlain = Convert.decryptAesCbc(data, this.hexToArrayBuffer(parts[0]), this.hexToArrayBuffer(parts[1]));
    const dataUri = Convert.decodeUtf8(this.unpadPkcs7(imagePlain)).trim();
    const comma = dataUri.indexOf(",");
    if (comma <= 0) throw new Error("MOJOIN 图片解密结果不是 data URI");
    const header = dataUri.slice(0, comma).toLowerCase();
    const body = dataUri.slice(comma + 1).trim();
    if (header.indexOf(";base64") >= 0) return Convert.decodeBase64(body);
    return Convert.encodeUtf8(decodeURIComponent(body));
  }

  encodeEncryptedImageUrl(url, key) {
    return `${this.imageMarkerPrefix}${encodeURIComponent(String(key || ""))}|${url}`;
  }

  decodeEncryptedImageUrl(value) {
    const raw = String(value || "");
    if (!raw.startsWith(this.imageMarkerPrefix)) return null;
    const separator = raw.indexOf("|");
    if (separator < 0) return null;
    try {
      return { key: decodeURIComponent(raw.slice(this.imageMarkerPrefix.length, separator)), url: raw.slice(separator + 1) };
    } catch (_) {
      return null;
    }
  }

  isMojoinChapterImage(value) {
    return /^https:\/\/mojoin-api\.com\/comics\/fs\/chapter_image\/[0-9a-f-]{20,}\/content\/(?:page|roll)\/[^\s?#]+(?:[?#].*)?$/i.test(String(value || "").trim());
  }

  validateImageResponse(data) {
    const bytes = new Uint8Array(data || new ArrayBuffer(0));
    if (bytes.length < 8) throw new Error("MOJOIN 图片响应为空或长度不足");
    let prefix = "";
    for (let i = 0; i < Math.min(bytes.length, 96); i++) {
      const value = bytes[i];
      prefix += value >= 32 && value <= 126 ? String.fromCharCode(value) : " ";
    }
    if (/^\s*(?:<!doctype\b|<html\b|<head\b|\{\s*["']?(?:code|msg|message|error)\b|\[\s*\{)/i.test(prefix)) throw new Error(`MOJOIN 图片 URL 返回错误文本：${prefix.trim().slice(0, 100)}`);
    return data;
  }

  comic = {
    loadInfo: async (id) => {
      const bookId = this.validBookId(id);
      if (!bookId) throw new Error("MOJOIN 详情缺少有效 bookId");
      const payload = await this.requestJson(`/book/info/${bookId}`, {}, `${this.baseUrl}/comics/${bookId}`);
      const book = payload && payload.data;
      if (!book || book.id === undefined) throw new Error(`MOJOIN 详情没有返回作品数据：${bookId}`);
      const chapterPayload = await this.requestJson(`/book/${bookId}/chapter`, {}, `${this.baseUrl}/comics/${bookId}#chapter`);
      const chapterData = chapterPayload && Array.isArray(chapterPayload.data) ? chapterPayload.data : [];
      const chapters = new Map();
      chapterData.forEach((chapter) => {
        if (!chapter) return;
        const number = String(chapter.customized_number || "").trim();
        if (number) chapters.set(number, String(chapter.name || number).trim() || number);
      });
      const types = Array.isArray(book.type) ? book.type.map((item) => item && item.name).filter(Boolean) : [];
      const hashTags = Array.isArray(book.hash_tag) ? book.hash_tag.map((item) => typeof item === "string" ? item : item && item.name).filter(Boolean) : [];
      const cover = this.absoluteUrl(book.cover, this.apiBase);
      return new ComicDetails({
        title: String(book.name || `MOJOIN 作品 ${bookId}`),
        subTitle: String(book.display_author || ""),
        cover: cover,
        description: this.textFromHtml(book.intro),
        tags: { 题材: this.uniqueStrings(types), 标签: this.uniqueStrings(hashTags) },
        chapters: chapters,
        isFavorite: Number(book.is_collected) === 1,
        subId: bookId,
        thumbnails: cover ? [cover] : [],
        recommend: [],
        updateTime: String(book.updated_at_str || book.chapter_newest_first_publish_at || book.display_update_at || ""),
        uploadTime: String(book.publish_at || ""),
        url: `${this.baseUrl}/comics/${bookId}`,
      });
    },

    loadEp: async (comicId, epId) => {
      const bookId = this.validBookId(comicId);
      const chapterNumber = this.validChapterNumber(epId);
      if (!bookId || !chapterNumber) throw new Error("MOJOIN 章节缺少有效 bookId 或 customized_number");
      const referer = `${this.baseUrl}/comics/${bookId}/${encodeURIComponent(chapterNumber)}`;
      const payload = await this.requestJson(`/book/${bookId}/chapter/${encodeURIComponent(chapterNumber)}`, {}, referer, 3);
      const chapter = payload && payload.data;
      if (!chapter) throw new Error(`MOJOIN 单章没有返回数据：${bookId}/${chapterNumber}`);
      if (Number(chapter.is_locked) === 1 || Number(chapter.can_view) === 0) throw new Error(`MOJOIN 章节不可直接阅读，可能需要登录或购买：${chapter.name || chapterNumber}`);
      const content = Array.isArray(chapter.content) ? chapter.content : [];
      const images = [];
      content.forEach((item) => {
        const imageUrl = item && item.url ? String(item.url).trim() : "";
        const imageKey = item && item.key ? String(item.key).trim() : "";
        if (this.isMojoinChapterImage(imageUrl) && imageKey && !images.some((value) => value.endsWith(`|${imageUrl}`))) images.push(this.encodeEncryptedImageUrl(imageUrl, imageKey));
      });
      if (images.length === 0) throw new Error(`MOJOIN 章节没有返回正文图片：${bookId}/${chapterNumber}；可能是权限、线路或接口限制`);
      return { images: images };
    },

    onImageLoad: (url, comicId, epId, sameUrlRetry) => {
      const encrypted = this.decodeEncryptedImageUrl(url);
      const imageUrl = encrypted ? encrypted.url : String(url || "").trim();
      const bookId = this.validBookId(comicId);
      const chapterNumber = this.validChapterNumber(epId);
      const referer = bookId && chapterNumber ? `${this.baseUrl}/comics/${bookId}/${encodeURIComponent(chapterNumber)}` : `${this.baseUrl}/comics`;
      const config = {
        url: imageUrl,
        method: "GET",
        headers: {
          "User-Agent": this.ua,
          "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
          "Referer": referer,
          device: "web",
          uuid: this.runtimeUuid || this.defaultUuid,
        },
        onResponse: encrypted ? (data) => this.decryptImageResponse(data, encrypted.key) : (data) => this.validateImageResponse(data),
      };
      if (!sameUrlRetry) config.onLoadFailed = () => this.comic.onImageLoad(url, comicId, epId, true);
      return config;
    },
  };

  link = {
    domains: ["mojoin.com"],
    linkToId: (url) => {
      const match = String(url || "").match(/https?:\/\/mojoin\.com\/comics\/(\d+)/i);
      return match ? match[1] : null;
    },
  };
}
