// Based on venera-app/venera-configs/copy_manga.js, with this repository's compatibility fixes.
class CopyManga extends ComicSource {
    name = "拷贝漫画";
    key = "copy_manga";
    version = "1.6.7";
    minAppVersion = "1.6.0";
    url = "https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/copy_manga.js";

    static defaultApiUrl = "api.copy202601.com";
    static defaultCopyRegion = "0";
    static defaultImageQuality = "1500";
    static searchApi = "/api/kb/web/searchcl/comics";
    static category_param_dict = {
    "全部": "",
    "愛情": "aiqing",
    "歡樂向": "huanlexiang",
    "冒險": "maoxian",
    "奇幻": "qihuan",
    "百合": "baihe",
    "校园": "xiaoyuan",
    "科幻": "kehuan",
    "東方": "dongfang",
    "耽美": "danmei",
    "生活": "shenghuo",
    "格鬥": "gedou",
    "轻小说": "qingxiaoshuo",
    "悬疑": "xuanyi",
    "其他": "qita",
    "神鬼": "shengui",
    "职场": "zhichang",
    "TL": "teenslove",
    "萌系": "mengxi",
    "治愈": "zhiyu",
    "長條": "changtiao",
    "四格": "sige",
    "节操": "jiecao",
    "舰娘": "jianniang",
    "竞技": "jingji",
    "搞笑": "gaoxiao",
    "伪娘": "weiniang",
    "热血": "rexue",
    "励志": "lizhi",
    "性转换": "xingzhuanhuan",
    "彩色": "COLOR",
    "後宮": "hougong",
    "美食": "meishi",
    "侦探": "zhentan",
    "AA": "aa",
    "音乐舞蹈": "yinyuewudao",
    "魔幻": "mohuan",
    "战争": "zhanzheng",
    "历史": "lishi",
    "异世界": "yishijie",
    "惊悚": "jingsong",
    "机战": "jizhan",
    "都市": "dushi",
    "穿越": "chuanyue",
    "恐怖": "kongbu",
    "C100": "comiket100",
    "重生": "chongsheng",
    "C99": "comiket99",
    "C101": "comiket101",
    "C97": "comiket97",
    "C96": "comiket96",
    "生存": "shengcun",
    "宅系": "zhaixi",
    "武侠": "wuxia",
    "C98": "C98",
    "C95": "comiket95",
    "FATE": "fate",
    "转生": "zhuansheng",
    "無修正": "Uncensored",
    "仙侠": "xianxia",
    "LoveLive": "loveLive"
};

    author_path_word_dict = Object.create(null);
    _tail = Promise.resolve();
    _inflight = new Map();
    _pageLimits = new Map();
    _lastRequestAt = 0;
    _apiPromise = null;
    _apiAttemptAt = 0;
    _searchPromise = null;
    _searchAt = 0;
    _searchValid = false;
    _searchConfigured = "";
    _searchOrigin = "";
    _searchPath = CopyManga.searchApi;
    _rateUntil = 0;
    _restrictionEpoch = 0;
    _lastRestriction = null;
    _savedRestriction = null;
    _accountEpoch = 0;

    error(code, message, retryable = false) {
        const e = new Error((code ? code + "：" : "") + message);
        e.code = code;
        e.retryable = retryable;
        return e;
    }
    delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
    number(value, fallback = 0) {
        const n = Number(value);
        return Number.isFinite(n) && n >= 0 ? n : fallback;
    }
    page(value) { return Math.max(1, Math.floor(this.number(value, 1))); }
    encode(data) {
        return Object.keys(data).filter(k => data[k] !== undefined && data[k] !== null)
            .map(k => encodeURIComponent(k) + "=" + encodeURIComponent(String(data[k]))).join("&");
    }
    host(value) {
        const s = String(value || "").trim().replace(/^https?:\/\//i, "").replace(/\/$/, "");
        return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i.test(s) ? s.toLowerCase() : "";
    }
    get automaticApi() {
        const value = this.host(this.loadSetting("base_url"));
        return !value || value === "api.copy2000.online" || value === CopyManga.defaultApiUrl || value === this.host(this.settings?.base_url?.default);
    }
    get apiUrl() {
        const configured = this.host(this.loadSetting("base_url"));
        if (!this.automaticApi) return "https://" + configured;
        return "https://" + (this.host(this.loadData("_discovered_api")) || CopyManga.defaultApiUrl);
    }
    get webUrl() { return "https://" + (this.host(this.loadSetting("web_host")) || "www.copy4000.com"); }
    get copyRegion() { return this.loadSetting("region") === "1" ? "1" : "0"; }
    get imageQuality() {
        const q = String(this.loadSetting("image_quality") || CopyManga.defaultImageQuality);
        return ["800", "1200", "1500"].includes(q) ? q : CopyManga.defaultImageQuality;
    }
    get imageFormat() { return this.loadSetting("image_format") === "webp" ? "webp" : "original"; }
    get usePublicWeb() { return this.loadSetting("reader_entry") !== "app"; }
    get token() { const t = this.loadData("token"); return typeof t === "string" ? t.trim() : ""; }
    randomDigits(n) { return Array.from({length: n}, () => Math.floor(Math.random() * 10)).join(""); }
    get deviceinfo() {
        let value = this.loadData("_deviceinfo");
        if (!value) { value = String(1000000 + Math.floor(Math.random() * 9000000)) + "V-" + String(1000 + Math.floor(Math.random() * 9000)); this.saveData("_deviceinfo", value); }
        return value;
    }
    get device() {
        let value = this.loadData("_device");
        if (!value) {
            const letter = () => String.fromCharCode(65 + Math.floor(Math.random() * 26));
            value = letter() + letter() + this.randomDigits(1) + letter() + "." + this.randomDigits(6) + "." + this.randomDigits(3);
            this.saveData("_device", value);
        }
        return value;
    }
    get pseudoid() {
        let value = this.loadData("_pseudoid");
        if (!value) {
            const chars = "abcdef0123456789";
            value = Array.from({length: 16}, () => chars[Math.floor(Math.random() * chars.length)]).join("");
            this.saveData("_pseudoid", value);
        }
        return value;
    }
    get headers() {
        const now = new Date(), ts = String(Math.floor(now.getTime() / 1000));
        const signature = Convert.hmacString(Convert.decodeBase64("M2FmMDg1OTAzMTEwMzJlZmUwNjYwNTUwYTA1NjNhNTM="), Convert.encodeUtf8(ts), "sha256");
        const h = {
            "User-Agent": "COPY/3.0.9", source: "copyApp", deviceinfo: this.deviceinfo,
            dt: now.getFullYear() + "." + String(now.getMonth() + 1).padStart(2, "0") + "." + String(now.getDate()).padStart(2, "0"),
            platform: "3", referer: "com.copymanga.app-3.0.9", version: "3.0.9", versionCode: "83",
            device: this.device, pseudoid: this.pseudoid, Accept: "application/json", region: this.copyRegion,
            authorization: this.token ? "Token " + this.token : "Token", umstring: "b4c89ca4104ea9a97750314d791520ac",
            "x-auth-timestamp": ts, "x-auth-signature": signature, "cache-time": "no"
        };
        return h;
    }
    get webHeaders() {
        return {"User-Agent": "Mozilla/5.0", Accept: "application/json", Referer: this.webUrl + "/", "cache-time": "no"};
    }
    imageLoadingConfig(url) {
        // Only configure the observed CopyManga image CDN. Never forward account,
        // device or API-signature headers to image hosts.
        if (!/^https?:\/\/(?:[a-z0-9-]+\.)*mangafunb\.fun(?::\d+)?(?:\/|$)/i.test(String(url))) return {};
        if (this.usePublicWeb) {
            this.checkPublicWebRestriction();
            return {headers: {"User-Agent": this.publicWebHeaders["User-Agent"], Referer: this.webUrl + "/"}};
        }
        this.checkRestriction();
        return {headers: {"User-Agent": "COPY/3.0.9", Referer: "com.copymanga.app-3.0.9"}};
    }
    get publicWebHeaders() {
        return {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", Referer: this.webUrl + "/", Accept: "text/html,application/json;q=0.9,*/*;q=0.8", "cache-time": "no"};
    }
    currentPublicWebRestriction() {
        const record = this.loadData("_public_web_restriction_v1");
        return record && [210, 429].includes(record.code) && Number.isSafeInteger(record.until) && record.until > Date.now() ? record : null;
    }
    checkPublicWebRestriction() {
        const record = this.currentPublicWebRestriction();
        if (record) throw this.restrictionError(record);
    }
    async publicWebRequest(path, referer = null, extraHeaders = {}) {
        if (!/^\/(?:$|comic\/|comicdetail\/|comics(?:\?|$)|rank(?:\?|$)|search(?:\?|$)|api\/kb\/web\/)/.test(path)) throw this.error(0, "不支持的官网网页路径");
        const url = this.webUrl + path, key = "PUBLIC_WEB " + url + " " + (extraHeaders.dnts || "");
        if (this._inflight.has(key)) return this._inflight.get(key);
        const pending = this.enqueue(async () => {
            this.checkPublicWebRestriction();
            const headers = {...this.publicWebHeaders};
            if (referer) headers.Referer = referer;
            if (extraHeaders.dnts !== undefined) headers.dnts = String(extraHeaders.dnts);
            let response;
            try { response = await Network.sendRequest("GET", url, headers, null, {}); }
            catch (e) { throw this.error(0, "官网网页连接失败：" + String(e?.message || e).slice(0, 200)); }
            let payload; try { payload = JSON.parse(String(response.body || "")); } catch (_) {}
            const issue = this.classifyResponse(response, payload);
            if (issue) {
                const wait = this.restrictionWaitMs(issue);
                if (wait > 0 && Number.isSafeInteger(Date.now() + wait)) {
                    const record = {code: issue.code, type: issue.type, message: issue.message, recordedAt: Date.now(), until: Date.now() + wait};
                    this.saveData("_public_web_restriction_v1", record);
                    throw this.restrictionError(record);
                }
                throw this.error(issue.code, "官网网页拒绝访问：" + issue.message);
            }
            if (Number(response.status) !== 200) throw this.error(Number(response.status), "官网网页返回 HTTP " + response.status + "，请在官网确认访问状态");
            if (payload && payload.code !== undefined && Number(payload.code) !== 200) throw this.error(Number(payload.code) || 0, String(payload.message || "官网接口返回异常"));
            return String(response.body || "");
        });
        this._inflight.set(key, pending);
        try { return await pending; } finally { if (this._inflight.get(key) === pending) this._inflight.delete(key); }
    }
    decodePublicJSON(value, key) {
        if (typeof value !== "string" || value.length <= 16 || Convert.encodeUtf8(key).byteLength !== 16 || !/^(?:[a-f0-9]{32})+$/i.test(value.slice(16))) throw this.error(0, "官网数据编码已变化");
        const hex = value.slice(16), bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
        const plain = new Uint8Array(Convert.decryptAesCbc(bytes.buffer, Convert.encodeUtf8(key), Convert.encodeUtf8(value.slice(0, 16))));
        const padding = plain[plain.length - 1];
        if (!(padding >= 1 && padding <= 16) || !plain.slice(-padding).every(x => x === padding)) throw this.error(0, "官网数据校验失败");
        try { return JSON.parse(Convert.decodeUtf8(plain.slice(0, -padding).buffer)); }
        catch (_) { throw this.error(0, "官网未返回有效章节数据"); }
    }
    publicScriptString(html, name) {
        const match = String(html).match(new RegExp("\\b(?:var|let|const)\\s+" + name + "\\s*=\\s*(['\"])([^'\"]+)\\1"));
        if (!match) throw this.error(0, "官网页面缺少 " + name + "，可能需要官网验证或页面结构已更新");
        return match[2];
    }
    parsePublicLiteral(text) {
        // The public list attribute is a Python/JS data literal. Parse only data;
        // do not evaluate website-provided code as the website itself does.
        text = String(text); if (text.length > 2000000) throw this.error(0, "官网列表数据过大");
        let i = 0;
        const space = () => { while (/\s/.test(text[i] || "") && i < text.length) i++; };
        const string = () => {
            const quote = text[i++]; let out = "";
            while (i < text.length) {
                const c = text[i++]; if (c === quote) return out;
                if (c !== "\\") { out += c; continue; }
                const e = text[i++];
                if (e === "u" || e === "x") {
                    const count = e === "u" ? 4 : 2, hex = text.slice(i, i + count);
                    if (!new RegExp("^[a-f0-9]{" + count + "}$", "i").test(hex)) throw Error("Invalid string escape");
                    out += String.fromCharCode(parseInt(hex, 16)); i += count;
                } else { const escapes = {n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "\\": "\\", "'": "'", '"': '"', "/": "/"}; if (!(e in escapes)) throw Error("Invalid string escape"); out += escapes[e]; }
            }
            throw Error("Unclosed string");
        };
        const read = depth => {
            if (depth > 40) throw Error("Data nesting too deep"); space(); const c = text[i];
            if (c === "'" || c === '"') return string();
            if (c === "[" || c === "{") {
                const array = c === "[", end = array ? "]" : "}", result = array ? [] : Object.create(null); i++; space();
                if (text[i] === end) { i++; return result; }
                while (i < text.length) {
                    if (array) result.push(read(depth + 1));
                    else { space(); if (!['"', "'"].includes(text[i])) throw Error("Expected quoted key"); const key = string(); space(); if (text[i++] !== ":") throw Error("Expected colon"); result[key] = read(depth + 1); }
                    space(); if (text[i] === end) { i++; return result; } if (text[i++] !== ",") throw Error("Expected comma"); space(); if (text[i] === end) { i++; return result; }
                }
                throw Error("Unclosed data");
            }
            const token = text.slice(i).match(/^(?:None|True|False|null|true|false)\b|^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/);
            if (!token) throw Error("Unsupported data token"); i += token[0].length;
            const values = {None: null, True: true, False: false, null: null, true: true, false: false};
            return token[0] in values ? values[token[0]] : Number(token[0]);
        };
        try { const value = read(0); space(); if (i !== text.length) throw Error("Trailing expression"); return value; }
        catch (_) { throw this.error(0, "官网列表格式已变化，未执行页面代码"); }
    }
    publicCards(root) {
        const names = Object.create(null), result = [], seen = new Set();
        const anchors = root.querySelectorAll('a[href^="/comic/"]');
        for (const a of anchors) { const id = String(a.attributes.href || "").match(/^\/comic\/([^/?#]+)\/?$/)?.[1], title = a.text.trim().replace(/\s+/g, " "); if (id && title && !names[id]) names[id] = title; }
        for (const a of anchors) {
            const id = String(a.attributes.href || "").match(/^\/comic\/([^/?#]+)\/?$/)?.[1], img = a.querySelector("img");
            if (!id || !img || seen.has(id)) continue;
            const cover = img.attributes["data-src"] || img.attributes.src || "", title = names[id] || img.attributes.alt || id;
            if (!/^https?:\/\//.test(cover)) continue;
            result.push({id: decodeURIComponent(id), title, cover, subTitle: "", tags: []}); seen.add(id);
        }
        return result;
    }
    async publicWebHome() {
        const html = await this.publicWebRequest("/"), doc = new HtmlDocument(html), result = {};
        try { for (const section of doc.querySelectorAll("main .container")) { const title = section.querySelector(".index-all-icon-left-txt")?.text.trim(); if (title) { const cards = this.publicCards(section); if (cards.length) result[title] = cards; } } }
        finally { doc.dispose(); }
        const latest = await this.publicWebBrowse("全部", "", [], 1);
        if (latest.comics.length) result["最近更新"] = latest.comics.slice(0, 12);
        if (!Object.keys(result).length) throw this.error(0, "官网首页未获得漫画列表");
        return result;
    }
    async publicWebBrowse(category, param, options, page) {
        const o = Array.isArray(options) ? options : [], limit = 50, current = this.page(page);
        const ordering = String(o[1] || "-datetime_updated").replace("*", "-");
        const query = {theme: CopyManga.category_param_dict[category] || param || "", ordering: ["datetime_updated", "-datetime_updated", "popular", "-popular"].includes(ordering) ? ordering : "-datetime_updated", offset: (current - 1) * limit, limit};
        if (["japan", "korea", "west"].includes(o[0])) query.region = {japan: 0, korea: 1, west: 2}[o[0]];
        if (o[0] === "finish") query.status = 1;
        const html = await this.publicWebRequest("/comics?" + this.encode(query)), doc = new HtmlDocument(html);
        try {
            const box = doc.querySelector(".exemptComic-box"), raw = box?.attributes.list;
            if (raw === undefined) throw this.error(0, "官网分类结构已变化或需要官网验证");
            const list = this.parsePublicLiteral(raw); if (!Array.isArray(list)) throw this.error(0, "官网分类列表无效");
            return {comics: list.map(c => this.parseComic(c)).filter(c => c.id), maxPage: this.maxPage(this.number(box.attributes.total, list.length), limit)};
        } finally { doc.dispose(); }
    }
    async publicWebRank(options, page) {
        if (this.page(page) > 1) return {comics: [], maxPage: 1};
        const o = Array.isArray(options) ? options : [], audiences = o[0] === "1" ? ["male"] : o[0] === "2" ? ["female"] : ["male", "female"], date = ["day", "week", "month"].includes(o[1]) ? o[1] : "day";
        const comics = [], seen = new Set();
        for (const type of audiences) {
            const html = await this.publicWebRequest("/rank?" + this.encode({type, table: date})), doc = new HtmlDocument(html);
            try { for (const comic of this.publicCards(doc)) if (!seen.has(comic.id)) { comic.tags = [type === "male" ? "男频" : "女频"]; comics.push(comic); seen.add(comic.id); } }
            finally { doc.dispose(); }
        }
        return {comics, maxPage: 1};
    }
    async publicWebSearch(keyword, page) {
        const current = this.page(page), limit = 12, original = String(keyword || "").trim();
        if (!original) return {comics: [], maxPage: 1};
        const author = /^(?:作者|author)[:：]/i.test(original), q = author ? original.replace(/^(?:作者|author)[:：]\s*/i, "") : original;
        if (!this._publicSearchPath || this._publicSearchOrigin !== this.webUrl) {
            const html = await this.publicWebRequest("/search?q=" + encodeURIComponent(q));
            const match = html.match(/(?:const|let|var)\s+countApi\s*=\s*["'](\/api\/kb\/web\/[a-z0-9_/]+)["']/i);
            if (!match) throw this.error(0, "官网搜索接口结构已变化"); this._publicSearchPath = match[1]; this._publicSearchOrigin = this.webUrl;
        }
        const data = JSON.parse(await this.publicWebRequest(this._publicSearchPath + "?" + this.encode({offset: (current - 1) * limit, platform: 2, limit, q, q_type: author ? "author" : ""}))).results;
        if (!Array.isArray(data?.list)) throw this.error(0, "官网搜索未返回有效列表");
        return {comics: data.list.map(c => this.parseComic(c)).filter(c => c.id), maxPage: this.maxPage(data.total, limit)};
    }
    async publicWebInfo(id) {
        const path = "/comic/" + encodeURIComponent(id), html = await this.publicWebRequest(path), doc = new HtmlDocument(html);
        let title, cover, description, authors, themes, updated, dnt;
        try {
            title = doc.querySelector(".comicParticulars-title-right h6")?.text.trim();
            const img = doc.querySelector(".comicParticulars-left-img img"); cover = img?.attributes["data-src"] || img?.attributes.src || "";
            description = doc.querySelector(".intro")?.text.trim() || "";
            authors = doc.querySelectorAll('.comicParticulars-title-right a[href^="/author/"]').map(e => e.text.trim()).filter(Boolean);
            themes = doc.querySelectorAll(".comicParticulars-tag a").map(e => e.text.trim().replace(/^#/, "")).filter(Boolean);
            updated = doc.querySelector(".comicParticulars-title-right")?.text.match(/\d{4}-\d{2}-\d{2}/)?.[0] || "";
            dnt = doc.getElementById("dnt")?.attributes.value;
        } finally { doc.dispose(); }
        if (!title || dnt === undefined) throw this.error(0, "官网详情不完整，可能需要官网验证或登录");
        const key = this.publicScriptString(html, "ccz"), response = JSON.parse(await this.publicWebRequest("/comicdetail/" + encodeURIComponent(id) + "/chapters", this.webUrl + path, {dnts: dnt}));
        const directory = this.decodePublicJSON(response.results, key), chapters = new Map();
        if (!directory.groups || typeof directory.groups !== "object") throw this.error(0, "官网目录结构异常");
        for (const [word, group] of Object.entries(directory.groups)) {
            if (!Array.isArray(group.chapters) || !group.chapters.length) continue;
            const entries = new Map();
            for (const chapter of group.chapters) { if (!chapter.id || !chapter.name || entries.has(String(chapter.id))) throw this.error(0, "官网章节标识异常"); entries.set(String(chapter.id), String(chapter.name)); }
            chapters.set(word === "default" ? "默认" : String(group.name || word), entries);
        }
        if (!chapters.size) throw this.error(0, "官网未返回公开章节目录");
        return {title, cover, description, chapters, tags: {"作者": authors, "标签": themes, "更新": updated ? [updated] : []}, url: this.webUrl + path, subId: String(id), isFavorite: null};
    }
    async publicWebChapter(id, epId) {
        if (!epId) throw this.error(0, "缺少章节ID");
        const html = await this.publicWebRequest("/comic/" + encodeURIComponent(id) + "/chapter/" + encodeURIComponent(epId)), key = this.publicScriptString(html, "cct"), encrypted = this.publicScriptString(html, "contentKey"), rows = this.decodePublicJSON(encrypted, key);
        if (!Array.isArray(rows) || !rows.length) throw this.error(0, "官网未返回公开图片");
        const images = rows.map(row => {
            let url = String(row?.url || ""); if (!/^https?:\/\//i.test(url)) throw this.error(0, "官网图片地址无效");
            if (!/[?#]/.test(url)) url = url.replace(/([./])c\d+x\.([a-zA-Z]+)$/, (_, separator, format) => separator + "c" + this.imageQuality + "x." + (this.imageFormat === "webp" ? "webp" : format));
            return url;
        });
        if (new Set(images).size !== images.length) throw this.error(0, "官网图片出现重复，请核对原站章节");
        if (images.length <= 5) UI.showMessage("官网此章仅返回 " + images.length + " 张，请确认是否为短篇或试看");
        return {images};
    }


    // One source HTTP request at a time; headers/signatures are constructed at dispatch.
    enqueue(task) {
        const run = this._tail.catch(() => {}).then(async () => {
            const interval = Math.max(600, Math.min(3000, this.number(this.loadSetting("request_interval"), 1000)));
            const wait = interval - (Date.now() - this._lastRequestAt);
            if (wait > 0) await this.delay(wait);
            this._lastRequestAt = Date.now();
            return task();
        });
        this._tail = run.then(() => {}, () => {});
        return run;
    }
    classifyResponse(res, payload) {
        if (!payload) { try { payload = JSON.parse(String(res.body || "")); } catch (_) {} }
        const status = Number(res.status), code = Number(payload?.code);
        const message = String(payload?.message || payload?.msg || payload?.results?.detail || "").slice(0, 400);
        const retry = String(res.headers?.["retry-after"] || res.headers?.["Retry-After"] || "");
        if (status === 429 || code === 429) return {type: "rate", code: 429, message, retry};
        if (status !== 210 && code !== 210) return null;
        if (/破解|身邊|身边/.test(message)) return {type: "environment", code: 210, message, retry};
        if (/不是有效|invalid.{0,20}(choice|parameter)|參數|参数/i.test(message)) return {type: "parameter", code: 210, message, retry};
        if (/Expected available|頻繁|频繁|throttl|too many/i.test(message)) return {type: "rate", code: 210, message, retry};
        if (/升級|升级|更新.{0,10}APP|最新.{0,10}APP/i.test(message)) return {type: "client", code: 210, message, retry};
        return {type: "unknown", code: 210, message, retry};
    }
    restrictionWaitMs(issue) {
        let headerSeconds = 0;
        if (/^\d+$/.test(issue.retry || "")) headerSeconds = Number(issue.retry);
        else if (issue.retry) headerSeconds = Math.max(0, (Date.parse(issue.retry) - Date.now()) / 1000);
        let messageSeconds = 0;
        const message = String(issue.message || "");
        const expected = message.match(/Expected available in\s+(\d+)\s*seconds/i);
        if (expected) messageSeconds = Number(expected[1]);
        const wait = message.match(/(?:等待|等候|wait(?:\s+for)?|retry\s+in)\s*(\d+(?:\.\d+)?|一|半)\s*(小時|小时|分鐘|分钟|秒鐘|秒钟|秒|hours?|minutes?|seconds?)/i);
        if (wait) {
            const value = wait[1] === "一" ? 1 : wait[1] === "半" ? 0.5 : Number(wait[1]);
            const scale = /小時|小时|hour/i.test(wait[2]) ? 3600 : /分鐘|分钟|minute/i.test(wait[2]) ? 60 : 1;
            messageSeconds = Math.max(messageSeconds, value * scale);
        }
        const seconds = Math.max(Number.isFinite(headerSeconds) ? headerSeconds : 0, messageSeconds);
        return Number.isSafeInteger(Math.ceil(seconds * 1000)) && seconds > 0 ? Math.ceil(seconds * 1000) : 0;
    }
    currentRestriction() {
        const stored = this.loadData("_server_restriction_v1");
        const valid = r => r && typeof r === "object" && [210, 429].includes(r.code) && Number.isSafeInteger(r.until) && r.until > Date.now();
        const choices = [stored, this._savedRestriction].filter(valid).sort((a, b) => b.until - a.until);
        if (choices.length) return choices[0];
        this._savedRestriction = null;
        if (stored !== null && stored !== undefined) {
            try { this.deleteData("_server_restriction_v1"); } catch (_) {}
        }
        return null;
    }
    restrictionError(record) {
        const seconds = Math.max(1, Math.ceil((record.until - Date.now()) / 1000));
        const remaining = Math.floor(seconds / 60) + "分" + seconds % 60 + "秒";
        return this.error(record.code, "原站限制仍在等待中（剩余约 " + remaining + "），到期后重新加载；等待结束不代表服务器已确认恢复。" + (record.message ? "原站提示：" + String(record.message).slice(0, 400) : ""));
    }
    checkRestriction() {
        const record = this.currentRestriction();
        if (record) throw this.restrictionError(record);
    }
    restriction(issue) {
        const reasons = {environment: "服务器限制当前客户端或网络环境，不能仅凭此响应确定为纯IP封禁", parameter: "接口参数被拒绝", rate: "访问频率受限，请按原站提示等待", client: "服务器要求更新客户端", unknown: "服务器拒绝当前请求"};
        let e = this.error(issue.code, reasons[issue.type] + (issue.message ? "。原站提示：" + issue.message : "") + (issue.retry ? "（Retry-After: " + issue.retry + "）" : ""));
        const wait = this.restrictionWaitMs(issue);
        if (wait > 0 && Number.isSafeInteger(Date.now() + wait)) {
            const record = {code: issue.code, type: issue.type, message: issue.message, recordedAt: Date.now(), until: Date.now() + wait};
            const existing = this.currentRestriction();
            this._savedRestriction = existing && existing.until > record.until ? existing : record;
            try { this.saveData("_server_restriction_v1", this._savedRestriction); }
            catch (_) { console.log("原站等待时间仅保留在本次会话，保存失败"); }
            if (issue.type === "rate") this._rateUntil = this._savedRestriction.until;
            e = this.restrictionError(this._savedRestriction);
        }
        this._restrictionEpoch++; this._lastRestriction = e;
        return e;
    }
    async request(method, url, body = null, options = {}) {
        this.checkRestriction();
        const accountEpoch = this._accountEpoch, epoch = this._restrictionEpoch;
        const key = method + " " + url + " " + (options.public ? "public" : this.token) + " " + this.copyRegion;
        if (method === "GET" && this._inflight.has(key)) return this._inflight.get(key);
        const execute = async () => {
            const attempts = method === "GET" && options.retry !== false ? 2 : 1;
            for (let attempt = 0; attempt < attempts; attempt++) {
                try {
                    return await this.enqueue(async () => {
                        this.checkRestriction();
                        if (epoch !== this._restrictionEpoch && this._lastRestriction) throw this._lastRestriction;
                        if (Date.now() < this._rateUntil) throw this.error(429, "请等待原站限流时间结束后重试（剩余约 " + Math.ceil((this._rateUntil - Date.now()) / 1000) + " 秒）");
                        if (!options.public && accountEpoch !== this._accountEpoch) throw this.error(401, "登录状态已变化，请重新加载");
                        const headers = options.web ? {...this.webHeaders} : {...this.headers};
                        if (options.webOrigin) headers.Referer = options.webOrigin + "/";
                        if (options.public) delete headers.authorization;
                        if (method !== "GET") headers["Content-Type"] = "application/x-www-form-urlencoded;charset=utf-8";
                        let res;
                        try {
                            res = await Network.sendRequest(method, url, headers, body, {
                                maskHeadersInLog: ["authorization", "deviceinfo", "device", "pseudoid", "x-auth-signature"],
                                maskDataInLog: method !== "GET"
                            });
                        } catch (e) {
                            const message = String(e?.message || e).slice(0, 250);
                            throw this.error(0, "App 接口连接失败。公开漫画可在源设置的「访问入口」选择官网桌面网页。原始错误：" + message, true);
                        }
                        let payload; try { payload = JSON.parse(String(res.body || "")); } catch (_) {}
                        const issue = this.classifyResponse(res, payload);
                        if (issue) throw this.restriction(issue);
                        const status = Number(res.status), code = Number(payload?.code);
                        const message = String(payload?.message || payload?.msg || "").slice(0, 400);
                        if (status === 401 || code === 401) throw this.error(401, "登录已失效或该内容需要登录" + (message ? "。" + message : ""));
                        if (status === 403 || code === 403) throw this.error(403, "服务器拒绝访问" + (message ? "。" + message : ""));
                        if (status < 200 || status >= 300) throw this.error(status, message || "网络请求失败", [500, 502, 503, 504].includes(status));
                        if (options.text) return String(res.body || "");
                        if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw this.error(0, "接口未返回有效 JSON 数据", true);
                        if (payload.code !== undefined && code !== 200) throw this.error(code || 0, message || "接口业务请求失败", [500, 502, 503, 504].includes(code));
                        if (options.results !== false && (payload.results === null || payload.results === undefined)) throw this.error(0, "接口返回空数据，请稍后重试", true);
                        return payload;
                    });
                } catch (e) {
                    if (!e?.retryable || attempt + 1 >= attempts) throw e;
                    await this.delay(1000);
                }
            }
        };
        const pending = execute();
        if (method === "GET") this._inflight.set(key, pending);
        try { return await pending; }
        finally { if (this._inflight.get(key) === pending) this._inflight.delete(key); }
    }
    async api(method, path, params = {}, body = null, options = {}) {
        await this.refreshAppApi();
        const query = this.encode(method === "GET" ? {...params, _update: true} : params);
        const url = this.apiUrl + path + (query ? "?" + query : "");
        return this.request(method, url, body === null ? null : this.encode(body), options);
    }
    async init() {
        if (this.usePublicWeb) return;
        // Venera 1.6.3 invokes init without awaiting its returned Promise.
        // Each business request also waits for discovery, so startup errors are handled here.
        try { await this.refreshAppApi(); }
        catch (e) { console.log("拷贝线路发现：" + String(e?.message || e)); }
    }
    async refreshAppApi(force = false) {
        if (!force && !this.automaticApi) return false;
        if (this._apiPromise) return this._apiPromise;
        const now = Date.now(), saved = this.number(this.loadData("_api_discovered_at"));
        if (!force && this.host(this.loadData("_discovered_api")) && now >= saved && now - saved < 6 * 3600000) return true;
        if (!force && this._apiAttemptAt && now - this._apiAttemptAt < 30000) return false;
        this._apiAttemptAt = now;
        const run = async () => {
            for (const origin of ["https://api.manga-copy.com", "https://api.copy-manga.com"]) {
                try {
                    const d = await this.request("GET", origin + "/api/v3/system/network2?platform=3", null, {public: true, retry: false});
                    const groups = d.results?.api;
                    const hosts = Array.isArray(groups?.[0]) ? groups[0] : [];
                    const host = hosts.map(h => this.host(h)).find(Boolean);
                    if (!host) continue;
                    this.settings.base_url.default = host;
                    this.saveData("_discovered_api", host); this.saveData("_api_discovered_at", Date.now());
                    return true;
                } catch (e) {
                    if ([210, 429, 401, 403].includes(e?.code)) throw e;
                    if (/127\.0\.0\.1|ConnectionRefused|connection refused/i.test(String(e?.message || e))) break;
                }
            }
            return false;
        };
        this._apiPromise = run();
        try { return await this._apiPromise; } finally { this._apiPromise = null; }
    }
    async refreshSearchApi(force = false) {
        if (this._searchPromise) return this._searchPromise;
        if (!force && this._searchConfigured === this.webUrl && Date.now() - this._searchAt < (this._searchValid ? 30 * 60000 : 30000)) return this._searchValid;
        this._searchConfigured = this.webUrl; this._searchAt = Date.now();
        const run = async () => {
            for (const origin of [...new Set([this.webUrl, "https://www.copy4000.com", "https://www.copy5000.com"])]) {
                try {
                    const text = await this.request("GET", origin + "/search", null, {web: true, webOrigin: origin, public: true, text: true, retry: false});
                    const match = text.match(/(?:const|let|var)\s+countApi\s*=\s*["'](\/api\/kb\/web\/[a-z0-9_/]+)["']/i);
                    if (match) { this._searchPath = match[1]; this._searchOrigin = origin; this._searchValid = true; return true; }
                } catch (e) { if ([210, 429, 401, 403].includes(e?.code)) throw e; }
            }
            this._searchOrigin = this.webUrl; this._searchPath = CopyManga.searchApi; this._searchValid = false;
            return false;
        };
        this._searchPromise = run();
        try { return await this._searchPromise; } finally { this._searchPromise = null; }
    }
    async getReqID() {
        if (this.copyRegion === "0") return "";
        try {
            const d = await this.request("GET", "https://marketing.aiacgn.com/api/v2/adopr/query3/?format=json&ident=200100001", null, {public: true, retry: false});
            return typeof d.results?.request_id === "string" ? d.results.request_id : "";
        } catch (e) {
            if ([210, 429, 401, 403].includes(e?.code)) throw e;
            // Preserve the old fallback for an unavailable ancillary service; never fabricate a request ID.
            return "";
        }
    }

    maxPage(total, limit) { return Math.max(1, Math.ceil(this.number(total) / Math.max(1, limit))); }
    parseComic(value) {
        const meta = value || {}, comic = meta.comic || meta;
        const authors = Array.isArray(comic.author) ? comic.author : [];
        const latest = comic.last_chapter?.name || "";
        const updated = comic.datetime_updated || "";
        const ranking = meta.sort !== undefined ? String(meta.sort) + (meta.rise_sort > 0 ? " ▲" : meta.rise_sort < 0 ? " ▽" : "") : "";
        return {
            id: String(comic.path_word || ""), title: String(comic.name || ""), cover: String(comic.cover || ""),
            subTitle: authors[0]?.name || null,
            tags: Array.isArray(comic.theme) ? comic.theme.map(t => t?.name).filter(Boolean) : [],
            description: [ranking, latest, updated].filter(Boolean).join(" · ")
        };
    }
    async listData(path, params, page, options = {}) {
        page = this.page(page);
        const key = this.apiUrl + path + "?" + this.encode(params) + " " + (options.web ? "web" : this.token);
        let limit = this._pageLimits.get(key) || options.limit || 30;
        const fetchPage = async size => {
            const query = {...params, limit: size, offset: (page - 1) * size};
            if (!options.web) return this.api("GET", path, query);
            const url = (this._searchOrigin || this.webUrl) + this._searchPath + "?" + this.encode(query);
            return this.request("GET", url, null, {web: true, public: true, webOrigin: this._searchOrigin || this.webUrl});
        };
        let d = await fetchPage(limit), result = d.results;
        if (!result || !Array.isArray(result.list)) throw this.error(0, "列表数据结构异常");
        const reported = Math.floor(this.number(result.limit));
        if (reported > 0 && reported <= 1000 && reported !== limit) {
            limit = reported;
            if (page > 1) { d = await fetchPage(limit); result = d.results; }
        }
        if (!result || !Array.isArray(result.list)) throw this.error(0, "列表数据结构异常");
        if (!Number.isInteger(Number(result.total)) || Number(result.total) < 0) throw this.error(0, "列表缺少有效总数");
        const actualLimit = Math.floor(this.number(result.limit));
        if (actualLimit > 0 && actualLimit !== limit) throw this.error(0, "接口分页大小发生变化，请重新加载");
        this._pageLimits.set(key, limit);
        if (this._pageLimits.size > 100) this._pageLimits.delete(this._pageLimits.keys().next().value);
        return {result, maxPage: this.maxPage(result.total, limit)};
    }
    async list(path, params, page, options = {}) {
        const data = await this.listData(path, params, page, options);
        return {comics: data.result.list.map(c => this.parseComic(c)).filter(c => c.id), maxPage: data.maxPage};
    }

    account = {
        login: async (account, pwd) => {
            if (!String(account || "").trim() || !String(pwd || "")) throw this.error(0, "请输入账号和密码");
            const epoch = ++this._accountEpoch, salt = 1000 + Math.floor(Math.random() * 9000);
            const password = Convert.encodeBase64(Convert.encodeUtf8(String(pwd) + "-" + salt));
            const d = await this.api("POST", "/api/v3/login", {}, {username: String(account).trim(), password, salt, authorization: "Token "}, {public: true, results: false});
            if (epoch !== this._accountEpoch) throw this.error(401, "登录操作已取消，请重新登录");
            const token = d.results?.token;
            if (typeof token !== "string" || !token.trim()) throw this.error(401, "登录响应未包含有效凭据，请核对账号后重试");
            this.saveData("token", token.trim()); return "ok";
        },
        logout: () => { this._accountEpoch++; this.deleteData("token"); this._pageLimits.clear(); },
        registerWebsite: "https://www.copy4000.com/login"
    };
    explore = [{
        title: "拷贝漫画", type: "singlePageWithMultiPart",
        load: async () => {
            if (this.usePublicWeb) return this.publicWebHome();
            const d = await this.api("GET", "/api/v3/h5/homeIndex");
            const r = d.results, output = {};
            const parts = [["推荐", "recComics"], ["热门", "hotComics"], ["最新", "newComics"], ["完结", "finishComics"], ["今日排行", "rankDayComics"], ["本周排行", "rankWeekComics"], ["本月排行", "rankMonthComics"]];
            for (const [title, key] of parts) {
                const list = Array.isArray(r?.[key]) ? r[key] : r?.[key]?.list;
                if (Array.isArray(list)) output[title] = list.map(c => this.parseComic(c)).filter(c => c.id);
            }
            if (!Object.keys(output).length) throw this.error(0, "首页结构已变化，未获得漫画列表");
            return output;
        }
    }];
    category = {
        title: "拷贝漫画",
        parts: [
            {name: "拷贝漫画", type: "fixed", categories: ["排行"], categoryParams: ["ranking"], itemType: "category"},
            {name: "主题", type: "fixed", categories: Object.keys(CopyManga.category_param_dict), categoryParams: Object.values(CopyManga.category_param_dict), itemType: "category"}
        ]
    };
    categoryComics = {
        load: async (category, param, options, page) => {
            if (this.usePublicWeb) return category === "排行" || param === "ranking" ? this.publicWebRank(options, page) : this.publicWebBrowse(category, param, options, page);
            const o = Array.isArray(options) ? options : [];
            if (category === "排行" || param === "ranking") {
                const audience = {"1": "male", "2": "female", male: "male", female: "female"}[o[0]];
                return this.list("/api/v3/ranks", {type: 1, date_type: ["day", "week", "month"].includes(o[1]) ? o[1] : "day", audience_type: audience}, page);
            }
            const ordering = String(o[1] || "-datetime_updated").replace("*", "-");
            return this.list("/api/v3/comics", {
                theme: CopyManga.category_param_dict[category] || param || "",
                top: ["japan", "korea", "west", "finish"].includes(o[0]) ? o[0] : "",
                ordering: ["datetime_updated", "-datetime_updated", "popular", "-popular"].includes(ordering) ? ordering : "-datetime_updated"
            }, page);
        },
        optionList: [
    {
        "options": [
            "-全部",
            "japan-日漫",
            "korea-韩漫",
            "west-美漫",
            "finish-已完结"
        ],
        "notShowWhen": null,
        "showWhen": [
            "全部",
            "愛情",
            "歡樂向",
            "冒險",
            "奇幻",
            "百合",
            "校园",
            "科幻",
            "東方",
            "耽美",
            "生活",
            "格鬥",
            "轻小说",
            "悬疑",
            "其他",
            "神鬼",
            "职场",
            "TL",
            "萌系",
            "治愈",
            "長條",
            "四格",
            "节操",
            "舰娘",
            "竞技",
            "搞笑",
            "伪娘",
            "热血",
            "励志",
            "性转换",
            "彩色",
            "後宮",
            "美食",
            "侦探",
            "AA",
            "音乐舞蹈",
            "魔幻",
            "战争",
            "历史",
            "异世界",
            "惊悚",
            "机战",
            "都市",
            "穿越",
            "恐怖",
            "C100",
            "重生",
            "C99",
            "C101",
            "C97",
            "C96",
            "生存",
            "宅系",
            "武侠",
            "C98",
            "C95",
            "FATE",
            "转生",
            "無修正",
            "仙侠",
            "LoveLive"
        ]
    },
    {
        "options": [
            "*datetime_updated-时间倒序",
            "datetime_updated-时间正序",
            "*popular-热度倒序",
            "popular-热度正序"
        ],
        "notShowWhen": null,
        "showWhen": [
            "全部",
            "愛情",
            "歡樂向",
            "冒險",
            "奇幻",
            "百合",
            "校园",
            "科幻",
            "東方",
            "耽美",
            "生活",
            "格鬥",
            "轻小说",
            "悬疑",
            "其他",
            "神鬼",
            "职场",
            "TL",
            "萌系",
            "治愈",
            "長條",
            "四格",
            "节操",
            "舰娘",
            "竞技",
            "搞笑",
            "伪娘",
            "热血",
            "励志",
            "性转换",
            "彩色",
            "後宮",
            "美食",
            "侦探",
            "AA",
            "音乐舞蹈",
            "魔幻",
            "战争",
            "历史",
            "异世界",
            "惊悚",
            "机战",
            "都市",
            "穿越",
            "恐怖",
            "C100",
            "重生",
            "C99",
            "C101",
            "C97",
            "C96",
            "生存",
            "宅系",
            "武侠",
            "C98",
            "C95",
            "FATE",
            "转生",
            "無修正",
            "仙侠",
            "LoveLive"
        ]
    },
    {
        "options": [
            "0-全部",
            "1-男性向",
            "2-女性向"
        ],
        "notShowWhen": null,
        "showWhen": [
            "排行"
        ]
    },
    {
        "options": [
            "day-日榜",
            "week-周榜",
            "month-月榜"
        ],
        "notShowWhen": null,
        "showWhen": [
            "排行"
        ]
    }
]
    };
    search = {
        load: async (keyword, options, page) => {
            if (this.usePublicWeb) return this.publicWebSearch(keyword, page);
            keyword = String(keyword || "").trim();
            const author = keyword.startsWith("作者:") ? keyword.substring(3).trim() : "";
            if (author && this.author_path_word_dict[author]) return this.list("/api/v3/comics", {author: this.author_path_word_dict[author], ordering: "-datetime_updated"}, page);
            const q = {q: keyword, q_type: ["name", "author", "local"].includes(options?.[0]) ? options[0] : ""};
            if (this.loadSetting("search_api") !== "webAPI") return this.list("/api/v3/search/comic", q, page);
            await this.refreshSearchApi();
            try { return await this.list(this._searchPath, q, page, {web: true}); }
            catch (e) {
                if (e?.code !== 404) throw e;
                await this.refreshSearchApi(true);
                return this.list(this._searchPath, q, page, {web: true});
            }
        },
        optionList: [{type: "select", options: ["-全部", "name-名称", "author-作者", "local-汉化组"], label: "搜索选项"}]
    };
    favorites = {
        multiFolder: false,
        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            if (!this.token) throw this.error(401, "请先登录");
            const reqId = await this.getReqID();
            const d = await this.api("GET", "/api/v3/comic2/" + encodeURIComponent(comicId), {in_mainland: true, request_id: reqId, platform: 3});
            const uuid = d.results?.comic?.uuid;
            if (!uuid) throw this.error(0, "漫画信息不完整，无法更改收藏");
            await this.api("POST", "/api/v3/member/collect/comic", {}, {comic_id: uuid, is_collect: isAdding ? 1 : 0, authorization: "Token " + this.token}, {results: false});
            return "ok";
        },
        loadComics: async page => {
            if (!this.token) throw this.error(401, "请先登录");
            const ordering = this.loadSetting("favorites_ordering");
            return this.list("/api/v3/member/collect/comics", {free_type: 1, ordering: ["-datetime_updated", "-datetime_modifier", "-datetime_browse"].includes(ordering) ? ordering : "-datetime_updated"}, page);
        }
    };
    async favoriteStatus(id) {
        if (!this.token) return false;
        try {
            const d = await this.api("GET", "/api/v3/comic2/" + encodeURIComponent(id) + "/query", {}, null, {retry: false});
            if (!d.results || typeof d.results !== "object" || Array.isArray(d.results)) throw this.error(0, "收藏状态数据异常");
            const value = d.results.collect;
            return typeof value === "boolean" ? value : value !== null && value !== undefined && value !== 0;
        } catch (e) {
            if ([210, 429].includes(e?.code)) throw e;
            return null;
        }
    }
    async chapters(id, groups) {
        if (!groups || typeof groups !== "object" || Array.isArray(groups)) throw this.error(0, "漫画目录分组数据异常");
        const output = new Map();
        for (const key of Object.keys(groups)) {
            const group = groups[key], word = group?.path_word;
            if (!word) throw this.error(0, "漫画目录分组缺少标识");
            const entries = new Map(); let offset = 0, limit = 100, total = null;
            for (let pages = 0; ; pages++) {
                if (pages >= 1000) throw this.error(0, "目录分页超过处理上限，请反馈作品名称");
                const requestId = await this.getReqID();
                const d = await this.api("GET", "/api/v3/comic/" + encodeURIComponent(id) + "/group/" + encodeURIComponent(word) + "/chapters", {limit, offset, in_mainland: true, request_id: requestId});
                const r = d.results;
                if (!r || !Array.isArray(r.list) || !Number.isFinite(Number(r.total)) || Number(r.total) < 0) throw this.error(0, "目录分页数据不完整");
                total = Number(r.total);
                if (!r.list.length) {
                    if (offset < total) throw this.error(0, "目录分页为空，尚有 " + (total - offset) + " 章未取得，请重新加载");
                    break;
                }
                const before = entries.size;
                for (const ep of r.list) {
                    if (!ep?.uuid) throw this.error(0, "目录中有章节缺少 UUID");
                    if (!entries.has(String(ep.uuid))) entries.set(String(ep.uuid), ep);
                }
                if (entries.size === before) throw this.error(0, "目录重复返回同一页，已停止以避免漏章");
                offset += r.list.length;
                const reported = Math.floor(this.number(r.limit));
                if (reported > 0 && reported <= 100) limit = reported;
                if (offset >= total) break;
            }
            if (entries.size !== total) throw this.error(0, "目录未完整同步：取得 " + entries.size + " / " + total + " 章，请刷新重试");
            const list = [...entries.values()];
            if (list.every(ep => ep.index !== null && ep.index !== undefined && Number.isFinite(Number(ep.index)))) list.sort((a, b) => Number(a.index) - Number(b.index));
            let title = String(group.name || key);
            if (output.has(title)) title += "（" + key + "）";
            output.set(title, new Map(list.map(ep => [String(ep.uuid), String(ep.name || "未命名章节")])));
        }
        return output;
    }
    chapterImages(result) {
        const chapter = result?.chapter, content = chapter?.contents, words = chapter?.words;
        if (!chapter || !Array.isArray(content)) throw this.error(0, "章节未返回图片列表");
        const size = chapter.size === null || chapter.size === undefined ? NaN : Number(chapter.size);
        if (result.show_app === true && (!Number.isFinite(size) || content.length < size)) throw this.error(403, "原站仅返回 " + content.length + " 张预览图，章节共 " + (Number.isFinite(size) ? size : "未知数量") + " 张；请检查入口及原站阅读权限");
        if (!content.length) throw this.error(result.is_lock ? 403 : 0, result.is_lock ? "该章节受原站阅读权限限制" : "该章节暂未返回可阅读图片");
        if (Number.isFinite(size) && size >= 0 && size !== content.length) throw this.error(0, "章节图片不完整：取得 " + content.length + " / " + size + " 张，请重新加载");
        if (!Array.isArray(words) || words.length !== content.length) throw this.error(0, "章节图片排序数据不完整");
        const images = new Array(content.length), seen = new Set();
        for (let i = 0; i < content.length; i++) {
            const index = Number(words[i]);
            const validType = typeof words[i] === "number" || (typeof words[i] === "string" && /^\d+$/.test(words[i]));
            if (!validType || !Number.isInteger(index) || index < 0 || index >= content.length || seen.has(index)) throw this.error(0, "章节图片排序异常，已停止以避免空白或错页");
            let url = String(content[i]?.url || "");
            if (url.startsWith("//")) url = "https:" + url;
            if (!/^https?:\/\/[^\s/]+\/[^\s]*$/i.test(url) || /[\u0000-\u0020\u007f]/.test(url)) throw this.error(0, "章节包含无效图片地址");
            if (!/[?#]/.test(url)) url = url.replace(/([./])c\d+x\.([a-zA-Z]+)$/, (_, separator, format) => separator + "c" + this.imageQuality + "x." + (this.imageFormat === "webp" ? "webp" : format));
            images[index] = url; seen.add(index);
        }
        return images;
    }
    comic = {
        onImageLoad: url => this.imageLoadingConfig(url),
        onThumbnailLoad: url => this.imageLoadingConfig(url),
        loadInfo: async id => {
            if (this.usePublicWeb) return this.publicWebInfo(id);
            const requestId = await this.getReqID();
            const d = await this.api("GET", "/api/v3/comic2/" + encodeURIComponent(id), {in_mainland: true, request_id: requestId, platform: 3});
            const c = d.results?.comic;
            if (!c?.uuid || !c?.name) throw this.error(0, "漫画详情数据不完整");
            const [chapters, isFavorite] = await Promise.all([this.chapters(id, d.results.groups), this.favoriteStatus(id)]);
            const author = Array.isArray(c.author) ? c.author : [];
            if (Object.keys(this.author_path_word_dict).length > 100) this.author_path_word_dict = Object.create(null);
            for (const a of author) if (a?.name && a?.path_word) this.author_path_word_dict[a.name] = a.path_word;
            return {
                title: c.name, cover: c.cover || "", description: c.brief || "",
                tags: {"作者": author.map(a => a.name).filter(Boolean), "更新": c.datetime_updated ? [c.datetime_updated] : [], "标签": Array.isArray(c.theme) ? c.theme.map(t => t?.name).filter(Boolean) : [], "状态": c.status?.display ? [c.status.display] : []},
                chapters, isFavorite, url: this.webUrl + "/comic/" + encodeURIComponent(id), subId: c.uuid
            };
        },
        loadEp: async (comicId, epId) => {
            if (this.usePublicWeb) return this.publicWebChapter(comicId, epId);
            const requestId = await this.getReqID();
            const d = await this.api("GET", "/api/v3/comic/" + encodeURIComponent(comicId) + "/chapter2/" + encodeURIComponent(epId), {in_mainland: true, request_id: requestId});
            return {images: this.chapterImages(d.results)};
        },
        loadComments: async (comicId, subId, page, replyTo) => this.comments("/api/v3/comments", {comic_id: subId, reply_id: replyTo || undefined}, page, !!replyTo),
        loadChapterComments: async (comicId, epId, page) => this.comments("/api/v3/roasts", {chapter_id: epId}, page, false, true),
        sendComment: async (comicId, subId, content, replyTo) => this.sendComment("/api/v3/member/comment", {comic_id: subId, comment: content, reply_id: replyTo || ""}),
        sendChapterComment: async (comicId, epId, content) => this.sendComment("/api/v3/member/roast", {chapter_id: epId, roast: content}),
        onClickTag: (namespace, tag) => {
            if (namespace === "标签") return {action: "category", keyword: String(tag), param: CopyManga.category_param_dict[tag] || null};
            if (namespace === "作者") return {action: "search", keyword: "作者:" + tag, param: null};
            throw this.error(0, "未支持此类标签检索");
        }
    };
    async comments(path, params, page, reply = false, roast = false) {
        if (this.usePublicWeb) throw this.error(0, "官网网页入口暂不提供评论，请切换App接口入口");
        const data = await this.listData(path, params, page, {limit: 20});
        const r = data.result;
        if (!Array.isArray(r?.list)) throw this.error(0, "评论列表结构异常");
        return {
            comments: r.list.map(c => ({userName: reply ? (c.user_name || "") + "  👉  " + (c.parent_user_name || "") : c.user_name || "", avatar: c.user_avatar || "", content: c.comment || "", time: c.create_at, replyCount: roast ? null : this.number(c.count), id: roast ? null : c.id})),
            maxPage: data.maxPage
        };
    }
    async sendComment(path, body) {
        if (!this.token) throw this.error(401, "请先登录");
        const content = body.comment !== undefined ? body.comment : body.roast;
        if (!String(content || "").trim()) throw this.error(0, "评论内容不能为空");
        await this.api("POST", path, {}, body, {results: false}); return "ok";
    }
    isAppVersionAfter(target) {
        const a = String(APP.version).split("."), b = String(target).split(".");
        for (let i = 0; i < 3; i++) { const x = parseInt(a[i] || "0"), y = parseInt(b[i] || "0"); if (x !== y) return x > y; }
        return true;
    }
    settings = {
        reader_entry: {title: "访问入口", type: "select", options: [{value: "web", text: "官网桌面网页（公开内容）"}, {value: "app", text: "App接口（保留账号功能）"}], default: "web"},
        favorites_ordering: {title: "收藏排序方式", type: "select", options: [{value: "-datetime_updated", text: "更新时间"}, {value: "-datetime_modifier", text: "收藏时间"}, {value: "-datetime_browse", text: "阅读时间"}], default: "-datetime_updated"},
        region: {title: "CDN线路", type: "select", options: [{value: "0", text: "海外图片线路"}, {value: "1", text: "大陆线路"}], default: "0"},
        image_quality: {title: "图片质量", type: "select", options: [{value: "800", text: "低 (800)"}, {value: "1200", text: "中 (1200)"}, {value: "1500", text: "高 (1500)"}], default: "1500"},
        image_format: {title: "图片格式", type: "select", options: [{value: "original", text: "保留原站格式（推荐）"}, {value: "webp", text: "WebP（旧版兼容）"}], default: "original"},
        search_api: {title: "搜索方式", type: "select", options: [{value: "baseAPI", text: "基础API"}, {value: "webAPI", text: "网页端API"}], default: "baseAPI"},
        web_host: {title: "官网网页域名", type: "select", options: [{value: "www.copy4000.com"}, {value: "www.copy5000.com"}, {value: "www.copy20.com"}], default: "www.copy4000.com"},
        base_url: {title: "API地址（默认自动发现，其他域名作为自定义地址）", type: "input", validator: "^(?:https?://)?(?:[a-zA-Z0-9-]+\\.)+[a-zA-Z]{2,}/?$", default: CopyManga.defaultApiUrl},
        request_interval: {title: "接口请求最小间隔", type: "select", options: [{value: "600", text: "600 毫秒"}, {value: "1000", text: "1 秒（推荐）"}, {value: "1500", text: "1.5 秒"}], default: "1000"},
        refresh_api: {title: "重新发现官方API线路", type: "callback", buttonText: "刷新线路", callback: async () => {
            try {
                const ok = await this.refreshAppApi(true);
                UI.showMessage(ok ? (this.automaticApi ? "已更新官方线路" : "已更新备用线路，保留当前自定义API地址") : "线路发现暂不可用，保留已有地址");
            } catch (e) { UI.showMessage(String(e?.message || e)); }
        }},
        restriction_status: {title: "原站限制与剩余等待", type: "callback", buttonText: "查看", callback: () => {
            if (this.usePublicWeb) {
                const web = this.currentPublicWebRestriction();
                UI.showMessage(web ? this.restrictionError(web).message : "官网网页入口当前未记录等待；App接口的等待记录仍保留");
                return;
            }
            const record = this.currentRestriction();
            UI.showMessage(record ? this.restrictionError(record).message : "当前未记录原站等待时间，可正常加载；是否可用仍以原站响应为准");
        }}
    };
}
