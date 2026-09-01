/** @type {import('./_venera_.js')} */
class ManWaBa extends ComicSource {
  name = "漫蛙吧";
  key = "manwaba";
  version = "1.1.3";
  minAppVersion = "1.6.0"; // 提升最低版本要求以支持 AES 解密接口
  url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/manwaba.js";
  api = "https://manwali.cc/api";

  // 统一的浏览器请求头
  defaultHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Referer": "https://manwali.cc/",
  };

  init() {
    this.fetchJson = async (url, { method = "GET", params, headers, payload }) => {
      if (params) {
        let params_str = Object.keys(params)
          .filter(key => params[key] !== undefined && params[key] !== null)
          .map((key) => `${key}=${encodeURIComponent(params[key])}`)
          .join("&");
        if (params_str) {
          url += (url.includes("?") ? "&" : "?") + params_str;
        }
      }
      const mergedHeaders = { ...this.defaultHeaders, ...headers };
      let maxRetries = 2;
      let lastError;
      for (let i = 0; i <= maxRetries; i++) {
        try {
          let res = await Network.sendRequest(method, url, mergedHeaders, payload);
          if (res.status !== 200) throw `HTTP ${res.status}`;
          return JSON.parse(res.body);
        } catch (e) {
          lastError = e;
          if (i < maxRetries) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
        }
      }
      throw `请求失败: ${lastError}`;
    };
  }

  // API 返回的封面和章节图片可能使用不同的旧域名；统一到当前可用的图片域名。
  normalizeImageUrl(url) {
    let value = String(url || "").trim();
    if (!value) return "";
    if (value.startsWith("//")) value = `https:${value}`;
    return value.replace(/^(https?:\/\/)(?:www\.)?(?:mwtuyi\.cc|tu\.mhttu\.cc|mwtuyi\.cc)/i, "https://tu.mwzu.cc");
  }

  imageHeaders() {
    return {
      "User-Agent": this.defaultHeaders["User-Agent"],
      "Referer": "https://manwali.cc/",
      "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
    };
  }

  decryptImageBuffer(buffer) {
    const view = new Uint8Array(buffer);
    const isImage = (view[0] === 0xFF && view[1] === 0xD8) ||
                    (view[0] === 0x89 && view[1] === 0x50) ||
                    (view[0] === 0x47 && view[1] === 0x49) ||
                    (view[0] === 0x52 && view[1] === 0x49);
    if (isImage) return buffer;
    try {
      if (view.length <= 16) return buffer;
      const iv = buffer.slice(0, 16);
      const ciphertext = buffer.slice(16);
      const keyStr = "0B6666A0-BB59-1381-B746-a0E4C9AC";
      const key = Convert.encodeUtf8(keyStr).slice(0, 32);
      return Convert.decryptAesCbc(ciphertext, key, iv);
    } catch (e) {
      console.error("图片解密失败:", e);
      return buffer;
    }
  }

  imageLoadConfig(url) {
    return {
      url: this.normalizeImageUrl(url),
      headers: this.imageHeaders(),
      onResponse: (buffer) => this.decryptImageBuffer(buffer)
    };
  }

  // 统一解析 Comic 对象，强制注入 sourceKey 修复框架 Null check 报错
  parseComic(c) {
    return new Comic({
      id: (c.id || "").toString(),
      title: c.title || "未知标题",
      subTitle: c.author || "",
      cover: this.normalizeImageUrl(c.pic || c.cover || c.image || ""),
      tags: (c.tags || "").split(",").filter(t => t),
      sourceKey: this.key,
    });
  }

  explore = [{
    title: this.name,
    type: "singlePageWithMultiPart",
    load: async (page) => {
      const res = await this.fetchJson(`${this.api}/home`, { params: { page: 1, pageSize: 6, type: "", flag: false } });
      const data = res.data || {};
      const magnaList = {
        "热门推荐": data.comicList || [],
        "最新完整版": data.gufengList || [],
        "最新更新": data.xuanhuanList || [],
        "热门收藏": data.xiaoyuanList || []
      };
      let result = {};
      for (let key in magnaList) {
        result[key] = magnaList[key].map(c => this.parseComic(c));
      }
      return result;
    }
  }];

  category = {
    title: this.name,
    parts: [{
      name: "类型",
      type: "fixed",
      categories: ["全部", "热血", "玄幻", "恋爱", "冒险", "古风", "都市", "穿越", "奇幻", "其他", "搞笑", "少男", "战斗", "重生", "逆袭", "爆笑", "少年", "后宫", "系统", "BL", "韩漫", "完整版", "19r", "台版"],
      itemType: "category",
      categoryParams: ["", "热血", "玄幻", "恋爱", "冒险", "古风", "都市", "穿越", "奇幻", "其他", "搞笑", "少男", "战斗", "重生", "逆袭", "爆笑", "少年", "后宫", "系统", "BL", "韩漫", "完整版", "19r", "台版"]
    }],
    enableRankingPage: false
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      const pathMap = {
        "热血": "/hotblooded", "玄幻": "/xuanhuan", "恋爱": "/romance", "冒险": "/adventure", "古风": "/historical",
        "都市": "/urban", "穿越": "/transmigration", "奇幻": "/fantasy", "搞笑": "/comedy", "少男": "/shounen",
        "战斗": "/action", "重生": "/rebirth", "逆袭": "/counterattack", "爆笑": "/hilarious", "少年": "/youth",
        "系统": "/system", "BL": "/bl", "韩漫": "/manhwa", "完整版": "/fullversion", "19r": "/19plus", "台版": "/taiwanver"
      };
      const url = `${this.api}/cate${pathMap[param] || ""}`;
      const pageSize = 20;
      const payload = JSON.stringify({
        page: { page, pageSize },
        category: "comic",
        sort: parseInt(options[2] || 0),
        comic: {
          status: parseInt(options[0] == "2" ? -1 : (options[0] || -1)),
          day: parseInt(options[1] || 0),
          tag: param
        }
      });
      const res = await this.fetchJson(url, { method: "POST", payload });
      const list = res.data.list || [];
      const total = (res.data.pagination && res.data.pagination.total) ? res.data.pagination.total : 100;
      return {
        comics: list.map(c => this.parseComic(c)),
        maxPage: Math.ceil(total / pageSize)
      };
    },
    optionList: [
      { options: ["2-全部", "0-连载中", "1-已完结"] },
      { options: ["0-全部", "1-周一", "2-周二", "3-周三", "4-周四", "5-周五", "6-周六", "7-周日"] },
      { options: ["0-更新", "1-新作", "2-畅销", "3-热门", "4-收藏"] }
    ]
  };

  search = {
    load: async (keyword, options, page) => {
      const pageSize = 20;
      const res = await this.fetchJson(`${this.api}/search`, { params: { keyword, type: "mh", page, pageSize } });
      const data = res.data || {};
      return {
        comics: (data.list || []).map(item => this.parseComic(item)),
        maxPage: Math.ceil((data.total || 0) / pageSize)
      };
    }
  };

  comic = {
    loadInfo: async (id) => {
      const detail = await this.fetchJson(`${this.api}/comic/${id}`, {});
      const data = detail.data || {};
      const chapterApi = `${this.api}/comic/chapter`;
      const pageRes = await this.fetchJson(chapterApi, { params: { comicId: data.id, page: 1, pageSize: 1 } });
      const total = (pageRes.pagination && pageRes.pagination.total) ? pageRes.pagination.total : 0;
      const chapterRes = await this.fetchJson(chapterApi, { params: { comicId: data.id, page: 1, pageSize: total || 500 } });
      let chapters = new Map();
      (chapterRes.data || []).forEach(item => {
        chapters.set((item.id || "").toString(), (item.title || "未命名").toString());
      });
      
      const comicObj = this.parseComic(data);

      return new ComicDetails({
        title: (data.title || "未知").toString(),
        subTitle: (data.author || "").toString(),
        cover: this.normalizeImageUrl(data.cover || data.pic || data.image || ""),
        tags: {
          "类型": (data.tags || "").split(",").filter(t => t),
          "状态": data.status == 0 ? "连载中" : "已完结"
        },
        chapters,
        description: data.intro || "",
        updateTime: data.editTime ? new Date(data.editTime * 1000).toLocaleDateString() : "",
        sourceKey: this.key,
        comic: comicObj,
      });
    },
    loadEp: async (comicId, epId) => {
      const imgApi = `${this.api}/comic/image/${epId}`;
      const pageSize = 25;
      const firstPageRes = await this.fetchJson(imgApi, { params: { page: 1, pageSize } });
      const total = (firstPageRes.data && firstPageRes.data.pagination) ? firstPageRes.data.pagination.total : 0;
      let rawImages = (firstPageRes.data && firstPageRes.data.images) ? firstPageRes.data.images : [];
      const totalPages = Math.ceil(total / pageSize);
      if (totalPages > 1) {
        let tasks = [];
        for (let p = 2; p <= totalPages; p++) {
          tasks.push(this.fetchJson(imgApi, { params: { page: p, pageSize } }).catch(() => null));
        }
        const results = await Promise.all(tasks);
        results.forEach(r => { if (r && r.data && r.data.images) rawImages = rawImages.concat(r.data.images); });
      }

      const images = rawImages.map(item => {
        return this.normalizeImageUrl(item.url || item.pic || item.image || "");
      }).filter(url => url);
      
      return {
        images,
        headers: {
          "User-Agent": this.defaultHeaders["User-Agent"],
          "Referer": "https://manwali.cc/",
          "Accept": "image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8"
        }
      };
    },

    /**
     * 漫蛙图片统一采用 AES-CBC；同一处理既用于章节图片，也用于封面和历史缩略图。
     */
    onImageLoad: (url, comicId, epId) => this.imageLoadConfig(url),
    onThumbnailLoad: (url) => this.imageLoadConfig(url)
  };
}
