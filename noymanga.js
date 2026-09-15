class Noymanga extends ComicSource {
  name = "NoyManga";
  key = "noymanga";
  version = "1.1.3";
  minAppVersion = "1.6.0";
  url = "https://raw.githubusercontent.com/casthan321/Venera-community-URL/main/noymanga.js";

  baseUrl = "https://noymanga.com";
  apiBaseUrl = "https://noymanga.com";
  imageBaseUrl = "https://img.noymanga.com";
  userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131 Safari/537.36 VeneraSourceForge/1.0";
  accountCacheKey = "noymanga_account_status_v1";
  signInCacheKey = "noymanga_signin_checked_v1";
  autoSignInRunning = false;
  autoSignInAttemptDate = "";
  suppressAutoSignIn = false;
  signInTask = null;
  signInTaskGeneration = -1;
  signInGeneration = 0;
  signInReadOnlyDepth = 0;
  signInSuppressionBeforeReadOnly = false;

  apiHeaders(contentType) {
    const headers = {
      "Accept": "application/json, text/plain, */*",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.5",
      "Origin": this.baseUrl,
      "User-Agent": this.userAgent,
      "Referer": this.baseUrl + "/",
    };
    if (contentType) headers["Content-Type"] = contentType;
    return headers;
  }

  imageHeaders() {
    return {
      "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.5",
      "User-Agent": this.userAgent,
      "Referer": this.baseUrl + "/",
    };
  }

  formEncode(entries) {
    return entries.map((entry) =>
      encodeURIComponent(String(entry[0])) + "=" + encodeURIComponent(String(entry[1])),
    ).join("&");
  }

  loginRequiredMessage() {
    return "尚未登录 NoyManga：请先在源设置中点“登录”（会打开网页），完成后再点“连接测试”里的“测试”。无需手动提取令牌。";
  }

  isSuccessStatus(value) {
    if (value === 200) return true;
    const status = String(value == null ? "" : value).trim().toLowerCase();
    return status === "ok" || status === "200";
  }

  isLoginStatus(value, message) {
    const status = String(value == null ? "" : value).trim().toLowerCase();
    const detail = String(message == null ? "" : message);
    return (
      status === "unauthorized" ||
      status === "nologin" ||
      status === "no_login" ||
      status === "login" ||
      /login|登入|登录|尚未登录|未登录|權限|权限/i.test(detail)
    );
  }

  readLocalData(key) {
    try {
      return typeof this.loadData === "function" ? this.loadData(key) : null;
    } catch (error) {
      return null;
    }
  }

  writeLocalData(key, value) {
    try {
      if (typeof this.saveData === "function") this.saveData(key, value);
    } catch (error) {
    }
  }

  clearLocalData(key) {
    try {
      if (typeof this.deleteData === "function") this.deleteData(key);
    } catch (error) {
    }
  }

  parseJsonResponse(response, context) {
    if (response.status === 401 || response.status === 403) throw this.loginRequiredMessage();
    if (response.status < 200 || response.status >= 400) {
      throw context + "请求失败（HTTP " + response.status + "）";
    }
    let payload;
    try {
      payload = JSON.parse(String(response.body || ""));
    } catch (error) {
      throw context + "返回的不是有效 JSON";
    }
    if (!payload || typeof payload !== "object") throw context + "返回内容为空";
    const status = payload.status;
    if (status != null && String(status).trim() !== "" && !this.isSuccessStatus(status)) {
      const message = String(payload.msg || payload.message || status);
      if (this.isLoginStatus(status, message)) throw this.loginRequiredMessage();
      throw context + "失败：" + message;
    }
    return payload;
  }

  async getJson(path, context) {
    const response = await Network.get(this.apiBaseUrl + path, this.apiHeaders(""));
    return this.parseJsonResponse(response, context);
  }

  async postForm(path, entries, context) {
    const response = await Network.post(
      this.apiBaseUrl + path,
      this.apiHeaders("application/x-www-form-urlencoded"),
      this.formEncode(entries),
    );
    return this.parseJsonResponse(response, context);
  }

  async assertLoggedIn() {
    const payload = await this.postForm("/api/v3/userinfo", [], "账号状态");
    if (!this.isSuccessStatus(payload.status) || !payload.userinfo || typeof payload.userinfo !== "object") {
      throw this.loginRequiredMessage();
    }
    const user = payload.userinfo;
    this.writeLocalData(this.accountCacheKey, {
      uid: user.Uid == null ? user.uid : user.Uid,
      username: String(user.Username || user.username || "").trim(),
    });
    return user;
  }

  accountLabel(user) {
    const name = String(user.Username || user.username || user.Name || user.name || "").trim();
    const uid = user.Uid == null ? user.uid : user.Uid;
    const integral = user.Integral == null ? user.integral : user.Integral;
    let label = name || "NoyManga 用户";
    if (uid != null && String(uid).trim()) label += "（UID " + uid + "）";
    if (integral != null && String(integral).trim()) label += "，积分 " + integral;
    return label;
  }

  async showAccountStatus() {
    try {
      const user = await this.assertLoggedIn();
      UI.showMessage("账号状态正常：" + this.accountLabel(user) + "。Cookie 已由 Venera 自动管理。");
      return "ok";
    } catch (error) {
      UI.showMessage("账号状态检查失败：" + error);
      throw error;
    }
  }

  normalizePositiveId(value, label, allowZero) {
    let text = String(value == null ? "" : value).trim();
    const mangaMatch = text.match(/\/manga\/(\d+)(?:[/?#]|$)/);
    const readerMatch = text.match(/\/reader\/\d+\/(\d+)(?:[/?#]|$)/);
    if (mangaMatch) text = mangaMatch[1];
    else if (readerMatch) text = readerMatch[1];
    if (!/^\d+$/.test(text)) throw label + "不是有效数字";
    const number = Number(text);
    if (!Number.isSafeInteger(number) || number < (allowZero ? 0 : 1)) {
      throw label + "超出有效范围";
    }
    return String(number);
  }

  imageUrl(bid, cid, page) {
    const bookId = this.normalizePositiveId(bid, "漫画 ID", false);
    const chapterId = this.normalizePositiveId(cid, "章节 ID", true);
    const pageNumber = Number(page);
    if (!Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > 20000) {
      throw "图片页码超出有效范围";
    }
    if (chapterId === "0") return this.imageBaseUrl + "/" + bookId + "/" + pageNumber + ".webp";
    return this.imageBaseUrl + "/" + bookId + "/" + chapterId + "/" + pageNumber + ".webp";
  }

  searchCover(item) {
    const source = String(item.source || "").trim();
    if (/^https?:\/\//i.test(source)) return source;
    const bid = this.normalizePositiveId(item.id, "搜索结果 ID", false);
    return this.imageBaseUrl + "/" + bid + "/m1.webp";
  }

  categoryCover(item) {
    const bid = this.normalizePositiveId(item.Bid, "分类结果 ID", false);
    return this.imageBaseUrl + "/" + bid + "/m1.webp";
  }

  parseSearchComics(payload) {
    const rows = Array.isArray(payload.data) ? payload.data : [];
    const comics = [];
    const seen = new Set();
    for (const item of rows) {
      try {
        const id = this.normalizePositiveId(item.id, "搜索结果 ID", false);
        const title = String(item.name || "").trim();
        if (!title || seen.has(id)) continue;
        seen.add(id);
        comics.push(new Comic({
          id: id,
          title: title,
          cover: this.searchCover(item),
          subtitle: String(item.author || "").trim(),
        }));
      } catch (error) {
      }
    }
    return comics;
  }

  parseCategoryComics(payload) {
    const rows = Array.isArray(payload.info)
      ? payload.info
      : (Array.isArray(payload.data) ? payload.data : []);
    const comics = [];
    const seen = new Set();
    for (const item of rows) {
      try {
        const id = this.normalizePositiveId(item.Bid, "分类结果 ID", false);
        const title = String(item.Bookname || "").trim();
        if (!title || seen.has(id)) continue;
        seen.add(id);
        comics.push(new Comic({
          id: id,
          title: title,
          cover: this.categoryCover(item),
          subtitle: String(item.Author || "").trim(),
        }));
      } catch (error) {
      }
    }
    return comics;
  }

  maxPage(total, currentPage) {
    const count = Number(total);
    const page = Math.max(1, Number(currentPage) || 1);
    if (!Number.isFinite(count) || count < 1) return page;
    return Math.max(page, Math.ceil(count / 20));
  }

  decodeCategory(value) {
    const parts = String(value || "new|").split("|");
    const allowedSorts = ["new", "views", "favorites", "rating"];
    const sort = allowedSorts.includes(parts[0]) ? parts[0] : "new";
    const finished = parts[1] === "true" || parts[1] === "false" ? parts[1] : "";
    return { sort: sort, finished: finished };
  }

  normalizeStringList(value) {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || "").trim()).filter((item) => item.length > 0);
    }
    if (typeof value === "string") {
      return value.split(/[,，、|/\s]+/).map((item) => item.trim()).filter((item) => item.length > 0);
    }
    return [];
  }

  flattenChapters(chapterPayload) {
    const result = [];
    const seen = new Set();
    const chapters = chapterPayload && typeof chapterPayload === "object" ? chapterPayload : {};
    const categories = Array.isArray(chapters.categories) ? chapters.categories : [];
    const data = chapters.data && typeof chapters.data === "object" ? chapters.data : {};
    const appendRows = (rows) => {
      if (!Array.isArray(rows)) return;
      for (const chapter of rows) {
        try {
          const id = this.normalizePositiveId(chapter.id, "章节 ID", false);
          if (seen.has(id)) continue;
          seen.add(id);
          result.push({
            id: id,
            name: String(chapter.name || ("章节 " + id)).trim(),
            sort: Number(chapter.sort) || result.length,
          });
        } catch (error) {
        }
      }
    };
    for (const category of categories) appendRows(data[String(category.id)]);
    if (result.length === 0) {
      for (const categoryId of Object.keys(data)) appendRows(data[categoryId]);
    }
    result.sort((left, right) => left.sort - right.sort);
    return result;
  }

  detailCover(info) {
    const bid = this.normalizePositiveId(info.Bid, "漫画 ID", false);
    return this.imageBaseUrl + "/" + bid + "/m1.webp";
  }

  normalizeFavoriteState(value) {
    if (value === true || value === 1) return true;
    if (value === false || value === 0 || value == null) return false;
    const text = String(value).trim().toLowerCase();
    return text === "1" || text === "true" || text === "yes" || text === "favorite" || text === "favorited";
  }

  async loadBookPayload(id, context) {
    const bid = this.normalizePositiveId(id, "漫画 ID", false);
    const payload = await this.getJson("/api/v4/book/" + bid, context || "漫画详情");
    if (!payload.book || !payload.book.info || typeof payload.book.info !== "object") {
      throw (context || "漫画详情") + "字段缺失";
    }
    return { bid: bid, payload: payload, info: payload.book.info };
  }

  localDateKey() {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return String(now.getFullYear()) + "-" + month + "-" + day;
  }

  isSignedToday(record) {
    if (!record || typeof record !== "object") return false;
    const today = record.today;
    if (today && typeof today === "object") {
      return this.normalizeFavoriteState(
        today.signed == null
          ? (today.status == null ? (today.IsSign == null ? today.isSign : today.IsSign) : today.status)
          : today.signed,
      );
    }
    return this.normalizeFavoriteState(today);
  }

  async readSignInRecord() {
    const record = await this.postForm("/api/v4/signin/record", [], "签到记录");
    if (!Object.prototype.hasOwnProperty.call(record, "today")) throw "签到记录缺少 today 字段";
    return record;
  }

  signInSummary(record, alreadySigned) {
    const continuous = record && record.continuous != null ? Number(record.continuous) : 0;
    if (alreadySigned) {
      return continuous > 0 ? "今日已签到，当前连续 " + continuous + " 天。" : "今日已经签到。";
    }
    return continuous > 0 ? "签到成功，当前连续 " + continuous + " 天。" : "签到成功。";
  }

  signInCancelledMessage() {
    return "签到任务已取消：登录状态已变化或只读自检正在运行";
  }

  signInWritesBlocked() {
    return this.suppressAutoSignIn || this.signInReadOnlyDepth > 0;
  }

  assertSignInTaskCanContinue(generation) {
    if (generation !== this.signInGeneration || this.signInWritesBlocked()) {
      throw this.signInCancelledMessage();
    }
  }

  async runDailySignInTask(generation) {
    this.assertSignInTaskCanContinue(generation);
    const before = await this.readSignInRecord();
    this.assertSignInTaskCanContinue(generation);
    if (this.isSignedToday(before)) {
      this.writeLocalData(this.signInCacheKey, this.localDateKey());
      return { alreadySigned: true, record: before };
    }

    await Promise.resolve();
    this.assertSignInTaskCanContinue(generation);
    await this.postForm("/api/v4/signin/sign", [], "每日签到");
    this.assertSignInTaskCanContinue(generation);
    const after = await this.readSignInRecord();
    this.assertSignInTaskCanContinue(generation);
    if (!this.isSignedToday(after)) throw "签到请求已提交，但服务器尚未确认今日签到状态，请稍后重试";
    this.writeLocalData(this.signInCacheKey, this.localDateKey());
    return { alreadySigned: false, record: after };
  }

  finishSignInTask(task) {
    if (this.signInTask !== task) return;
    this.signInTask = null;
    this.signInTaskGeneration = -1;
    this.autoSignInRunning = false;
  }

  ensureDailySignIn() {
    const generation = this.signInGeneration;
    this.assertSignInTaskCanContinue(generation);
    if (this.signInTask && this.signInTaskGeneration === generation) return this.signInTask;

    const task = this.runDailySignInTask(generation);
    this.signInTask = task;
    this.signInTaskGeneration = generation;
    this.autoSignInRunning = true;
    task.then(
      () => this.finishSignInTask(task),
      () => this.finishSignInTask(task),
    );
    return task;
  }

  async manualSignIn() {
    try {
      const result = await this.ensureDailySignIn();
      UI.showMessage(this.signInSummary(result.record, result.alreadySigned));
      return "ok";
    } catch (error) {
      UI.showMessage("签到失败：" + error);
      throw error;
    }
  }

  autoSignInEnabled() {
    try {
      if (typeof this.loadSetting !== "function") return false;
      const value = this.loadSetting("auto_signin");
      return value === true || value === 1 || String(value).toLowerCase() === "true";
    } catch (error) {
      return false;
    }
  }

  maybeAutoSignIn() {
    if (this.signInWritesBlocked() || !this.autoSignInEnabled()) return;
    const today = this.localDateKey();
    if (this.autoSignInAttemptDate === today || this.readLocalData(this.signInCacheKey) === today) return;
    this.autoSignInAttemptDate = today;
    try {
      const task = this.ensureDailySignIn();
      task.then(() => {}, () => {});
    } catch (error) {
    }
  }

  async beginSignInReadOnlyPhase() {
    const pending = this.signInTask;
    if (this.signInReadOnlyDepth === 0) {
      this.signInSuppressionBeforeReadOnly = this.suppressAutoSignIn;
    }
    this.signInReadOnlyDepth += 1;
    this.suppressAutoSignIn = true;
    this.signInGeneration += 1;
    this.autoSignInAttemptDate = "";
    if (pending) {
      try {
        await pending;
      } catch (error) {
      }
    }
  }

  endSignInReadOnlyPhase() {
    this.signInReadOnlyDepth = Math.max(0, this.signInReadOnlyDepth - 1);
    if (this.signInReadOnlyDepth === 0) {
      this.suppressAutoSignIn = this.signInSuppressionBeforeReadOnly;
      this.signInSuppressionBeforeReadOnly = false;
      this.autoSignInAttemptDate = "";
    }
  }

  clearAccountState() {
    this.signInGeneration += 1;
    this.autoSignInAttemptDate = "";
    this.clearLocalData(this.accountCacheKey);
    this.clearLocalData(this.signInCacheKey);
  }

  isImageBytes(value) {
    if (!value || value.byteLength < 3) return false;
    const bytes = new Uint8Array(value);
    const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const png = bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const gif = bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46;
    const webp = bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    const avif = bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70 && bytes[8] === 0x61 && bytes[9] === 0x76 && bytes[10] === 0x69 && bytes[11] === 0x66;
    return jpeg || png || gif || webp || avif;
  }

  async assertImage(config, label) {
    const response = await Network.fetchBytes(
      config.method || "GET",
      config.url,
      config.headers || {},
      config.data || new ArrayBuffer(0),
    );
    if (response.status < 200 || response.status >= 400 || !this.isImageBytes(response.body)) {
      throw label + "不是有效图片（HTTP " + response.status + "）";
    }
  }

  settings = {
    account_status: {
      title: "账号",
      type: "callback",
      buttonText: "检查",
      callback: async () => this.showAccountStatus(),
    },
    manual_signin: {
      title: "签到",
      type: "callback",
      buttonText: "签到",
      callback: async () => this.manualSignIn(),
    },
    auto_signin: {
      title: "自动签到",
      type: "switch",
      default: false,
    },
    source_self_test: {
      title: "连接测试",
      type: "callback",
      buttonText: "测试",
      callback: async () => this.runSelfTest(),
    },
  };

  async runSelfTest() {
    await this.beginSignInReadOnlyPhase();
    try {
      await this.assertLoggedIn();
      await this.readSignInRecord();
      const searchResult = await this.search.load("魔法少女", [], 1);
      if (!searchResult.comics || searchResult.comics.length === 0) throw "搜索没有返回漫画";

      const categoryResult = await this.categoryComics.load("最新", "new|", [], 1);
      if (!categoryResult.comics || categoryResult.comics.length === 0) throw "分类没有返回漫画";

      const exploreResult = await this.explore[0].load();
      if (!exploreResult || Array.isArray(exploreResult) || Object.keys(exploreResult).length < 3) throw "实际首页漫画分区少于 3 个";
      for (const title of Object.keys(exploreResult).slice(0, 3)) {
        if (!Array.isArray(exploreResult[title]) || exploreResult[title].length === 0) {
          throw "实际首页分区“" + String(title || "未知") + "”没有返回漫画";
        }
      }

      let selected = null;
      let info = null;
      let detailError = "搜索结果没有可读详情";
      for (const candidate of searchResult.comics.slice(0, 8)) {
        try {
          const candidateInfo = await this.comic.loadInfo(candidate.id);
          if (candidateInfo.title && candidateInfo.cover && candidateInfo.chapters && candidateInfo.chapters.size > 0) {
            selected = candidate;
            info = candidateInfo;
            break;
          }
        } catch (error) {
          detailError = String(error);
        }
      }
      if (!selected || !info) throw detailError;

      let pages = null;
      let epId = "";
      let chapterError = "详情中没有可读章节";
      for (const candidateEpId of Array.from(info.chapters.keys()).slice(0, 12)) {
        try {
          const candidatePages = await this.comic.loadEp(selected.id, candidateEpId);
          if (candidatePages.images && candidatePages.images.length > 0) {
            pages = candidatePages;
            epId = candidateEpId;
            break;
          }
        } catch (error) {
          chapterError = String(error);
        }
      }
      if (!pages || !pages.images || pages.images.length === 0) throw chapterError;

      await this.assertImage(this.comic.onThumbnailLoad(info.cover), "详情封面");
      await this.assertImage(this.comic.onImageLoad(pages.images[0], selected.id, epId), "正文首图");
      UI.showMessage("连接测试通过：Cookie、签到记录（只读）、搜索、首页、分类、详情、章节、封面与正文首图均可用；测试不会执行签到。");
      return "ok";
    } catch (error) {
      UI.showMessage("连接测试失败：" + error);
      throw error;
    } finally {
      this.endSignInReadOnlyPhase();
    }
  }

  account = {
    loginWithWebview: {
      url: "https://noymanga.com/login",
      checkStatus: (url, title) => {
        if (!/Noy(?:Acg|Manga)/i.test(String(title || "").trim())) return false;
        const value = String(url || "").trim().split("#")[0].split("?")[0].replace(/\/+$/, "");
        const match = value.match(/^https:\/\/noymanga\.com(?::443)?(\/.*)?$/i);
        const path = match ? (match[1] || "/") : "";
        return path === "/" || path === "/user" || path === "/favorite";
      },
      onLoginSuccess: () => {
        this.signInGeneration += 1;
        this.clearLocalData(this.accountCacheKey);
        this.clearLocalData(this.signInCacheKey);
        this.autoSignInAttemptDate = "";
        UI.showMessage("登录完成，Cookie 已自动接管；无需提取任何令牌。可回到源设置检查账号或运行连接测试。");
      },
    },
    logout: () => {
      this.clearAccountState();
      this.clearLocalData("_localStorage");
      Network.deleteCookies(this.baseUrl);
    },
    registerWebsite: null,
  };

  search = {
    load: async (keyword, options, page) => {
      this.maybeAutoSignIn();
      const pageNumber = Math.max(1, Number(page) || 1);
      const payload = await this.postForm("/api/v4/search/fetch", [
        ["value", String(keyword || "").trim()],
        ["mode", "default"],
        ["sort", ""],
        ["type", "book"],
        ["page", pageNumber],
        ["finished", ""],
      ], "搜索");
      return {
        comics: this.parseSearchComics(payload),
        maxPage: this.maxPage(payload.count, pageNumber),
      };
    },
    optionList: [],
  };

  explore = [
    {
      title: "NoyManga · 首页",
      type: "singlePageWithMultiPart",
      load: async () => {
        this.maybeAutoSignIn();
        const payload = await this.postForm("/api/home", [
          ["v", 3],
          ["stream_all", 1],
        ], "首页");
        const definitions = [
          { title: "今日阅读榜", field: "readDay" },
          { title: "今日收藏榜", field: "favDay" },
          { title: "高质榜", field: "proportion" },
          { title: "收藏推荐", field: "fs" },
        ];
        const parts = {};
        for (const definition of definitions) {
          const comics = this.parseCategoryComics({
            data: Array.isArray(payload[definition.field]) ? payload[definition.field] : [],
          }).slice(0, 10);
          if (comics.length > 0) parts[definition.title] = comics;
        }
        if (Object.keys(parts).length === 0) throw "首页 API 没有返回漫画分区";
        return parts;
      },
    },
  ];

  category = {
    title: "NoyManga · 分类",
    parts: [
      {
        name: "排序",
        type: "fixed",
        categories: [
          { label: "最新", target: { page: "category", attributes: { category: "最新", param: "new|" } } },
          { label: "最多浏览", target: { page: "category", attributes: { category: "最多浏览", param: "views|" } } },
          { label: "最多收藏", target: { page: "category", attributes: { category: "最多收藏", param: "favorites|" } } },
          { label: "最高评分", target: { page: "category", attributes: { category: "最高评分", param: "rating|" } } },
        ],
      },
      {
        name: "连载状态",
        type: "fixed",
        categories: [
          { label: "连载", target: { page: "category", attributes: { category: "连载", param: "new|false" } } },
          { label: "完结", target: { page: "category", attributes: { category: "完结", param: "new|true" } } },
        ],
      },
    ],
    enableRankingPage: false,
  };

  categoryComics = {
    load: async (category, param, options, page) => {
      this.maybeAutoSignIn();
      const pageNumber = Math.max(1, Number(page) || 1);
      const config = this.decodeCategory(param || category);
      const payload = await this.postForm("/api/b1/booklist", [
        ["page", pageNumber],
        ["sort", config.sort],
        ["finished", config.finished],
      ], "分类");
      return {
        comics: this.parseCategoryComics(payload),
        maxPage: this.maxPage(payload.len, pageNumber),
      };
    },
    optionList: [],
  };

  favorites = {
    multiFolder: false,

    addOrDelFavorite: async (comicId, folderId, isAdding) => {
      this.maybeAutoSignIn();
      const bid = this.normalizePositiveId(comicId, "漫画 ID", false);
      const desired = isAdding === true;
      const before = await this.loadBookPayload(bid, "收藏状态检查");
      if (this.normalizeFavoriteState(before.info.F) === desired) return "ok";

      await this.postForm("/api/v4/favorites/toggle", [["bid", bid]], desired ? "添加收藏" : "取消收藏");
      const after = await this.loadBookPayload(bid, "收藏状态复验");
      if (this.normalizeFavoriteState(after.info.F) !== desired) {
        throw (desired ? "添加收藏" : "取消收藏") + "后状态复验未通过，请刷新详情后重试";
      }
      return "ok";
    },

    loadComics: async (page, folder) => {
      this.maybeAutoSignIn();
      const pageNumber = Math.max(1, Number(page) || 1);
      const payload = await this.postForm("/api/v4/favorites/get", [
        ["page", pageNumber],
      ], "收藏列表");
      return {
        comics: this.parseCategoryComics(payload),
        maxPage: this.maxPage(payload.count, pageNumber),
      };
    },

    singleFolderForSingleComic: false,
    isOldToNewSort: false,
  };

  comic = {
    loadInfo: async (id) => {
      this.maybeAutoSignIn();
      const book = await this.loadBookPayload(id, "漫画详情");
      const requestedBid = book.bid;
      const payload = book.payload;
      const info = book.info;
      const bid = this.normalizePositiveId(info.Bid == null ? requestedBid : info.Bid, "漫画 ID", false);
      const title = String(info.Bookname || "").trim();
      if (!title) throw "漫画标题字段缺失";

      const flattened = this.flattenChapters(payload.chapters);
      const chapters = new Map();
      if (Number(info.Mode) === 0) {
        chapters.set("0", "全本");
      } else {
        for (const chapter of flattened) chapters.set(chapter.id, chapter.name);
      }
      if (chapters.size === 0) throw "漫画没有可读章节";

      const author = String(info.Author || "").trim();
      const tagValues = [];
      for (const value of [info.Ptag, info.Pname, info.Otag]) {
        for (const tag of this.normalizeStringList(value)) {
          if (!tagValues.includes(tag)) tagValues.push(tag);
        }
      }
      const tags = {};
      if (author) tags["作者"] = [author];
      if (tagValues.length > 0) tags["标签"] = tagValues;

      const description = String(
        info.Description || info.description || info.Introduction || info.introduction || info.Intro || "",
      ).trim();
      return new ComicDetails({
        title: title,
        cover: this.detailCover({ Bid: bid }),
        description: description,
        author: author,
        tags: tags,
        chapters: chapters,
        url: this.baseUrl + "/manga/" + bid,
        isFavorite: this.normalizeFavoriteState(info.F),
      });
    },

    loadEp: async (comicId, epId) => {
      this.maybeAutoSignIn();
      const bid = this.normalizePositiveId(comicId, "漫画 ID", false);
      const cid = this.normalizePositiveId(epId, "章节 ID", true);
      const chapter = await this.getJson("/api/v4/book/detail/" + bid + "/" + cid, "章节正文");
      const chapterInfo = chapter.chapter && typeof chapter.chapter === "object" ? chapter.chapter : {};
      const thisChapter = chapterInfo["this"] && typeof chapterInfo["this"] === "object" ? chapterInfo["this"] : {};
      const data = chapter.data && typeof chapter.data === "object" ? chapter.data : {};
      const rawCount = thisChapter.count == null ? data.count : thisChapter.count;
      const count = Number(rawCount);
      if (!Number.isSafeInteger(count) || count < 1 || count > 20000) throw "章节页数字段无效";
      const images = [];
      for (let page = 1; page <= count; page += 1) images.push(this.imageUrl(bid, cid, page));
      return { images: images };
    },

    onThumbnailLoad: (url) => ({
      url: url,
      method: "GET",
      headers: this.imageHeaders(),
    }),

    onImageLoad: (url, comicId, epId) => ({
      url: url,
      method: "GET",
      headers: this.imageHeaders(),
    }),
  };
}
