// Derived read-only Tencent chapter comments. Original source functions preserved.
/** @type {import('./_venera_.js')} */

/**
 * 栗子漫画 (lizimh) 源 v1.2.3（基于 2.33.30 修复版）
 * API requests use the official path + Unix timestamp signature.
 * Public metadata endpoints do not need an account token. Chapter v3 uses
 * the user's authToken and remains subject to server account restrictions.
 */

class Lizimh extends ComicSource {
    constructor() { super(); this.installRepair(); }
    name = "栗子漫画";
    key = "lizimh";
    version = "1.2.3";
    minAppVersion = "1.2.2";
    url = "https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/lizimh.js";

    // v2.32.0：回到最保守的寫法（App 的 QuickJS 引擎對 class 靜態 getter /
    // 複雜靜態欄位支援不佳，會導致整個源 init 失敗）。
    // 主域名 + 備援域名，失敗時逐一重試，成功的那台記在 _apiOk 裡。
    static api = "http://ai.xajtl.com";
    static apiFallback = "http://ai.qsmm.fun";
    static _useFallback = false;

    // Application protocol constant, NOT a user's login credential.
    static signPrefix = "q2sIObYXCp2uBZgCNBlY93J3z67hK0wS";

    static apiHeaders(extra) {
        return Object.assign({
            "Accept": "application/json",
            "User-Agent": "Dart/3.5 (dart:io)",
        }, extra || {});
    }

    static signedPath(target, timestamp) {
        const parts = String(target).split("?");
        const path = parts[0];
        const query = (parts.slice(1).join("?") || "").split("&").filter((entry) => {
            if (!entry) return false;
            const key = entry.split("=")[0];
            return key !== "lzsign" && key !== "t";
        });
        const addDefault = (key, value) => {
            if (!query.some((entry) => entry.split("=")[0] === key)) {
                query.push(key + "=" + encodeURIComponent(value));
            }
        };
        if (path === "/app/api/home/data" || path === "/app/api/configv2") {
            addDefault("packname", "com.jy.zyds");
            addDefault("appsign256", "");
        }
        if (path === "/app/api/configv2") addDefault("platform", "ios");
        const t = timestamp === undefined ? String(Math.floor(Date.now() / 1000)) : String(timestamp);
        if (!/^\d{10}$/.test(t)) throw new Error("Invalid API timestamp");
        const signature = Convert.hexEncode(Convert.md5(
            Convert.encodeUtf8(Lizimh.signPrefix + path + t))).toLowerCase();
        query.push("lzsign=" + signature, "t=" + t);
        return path + "?" + query.join("&");
    }


    // 圖片線路 (初始化時從 configv2 的 generators 覆蓋)
    // 每條線路: {name, url, proxy?, src?}  proxy=true 表示 url 是代理前綴, 真實圖床是 src
    static lines = [
        { name: "线路1 (CF优选海外)", url: "https://cdn.lzimg.xyz" },
        { name: "线路3 (i.lzimg)", url: "https://i.lzimg.xyz" },
        { name: "备用 (cf-1.imgio.club)", url: "https://cf-1.imgio.club" },
    ];
    static fallbackTags = ["热血","格斗","武侠","魔幻","魔法","冒险","爱情","搞笑","校园","科幻","后宫","励志","职场","美食","社会","黑道","战争","历史","悬疑","竞技","体育","恐怖","推理","生活","伪娘","治愈","神鬼","四格","百合","耽美","舞蹈","侦探","宅男","音乐","萌系","古风","恋爱","都市","穿越","游戏","其他","日常","腹黑","仙侠","修仙","纯爱","唯美","青春","彩虹","权谋","宅斗","装逼","浪漫","偶像","大女主","复仇","虐心","灵异","逆袭","妖怪","架空","动作","宫斗","脑洞","战斗","怪物","系统","智斗","机甲","高甜","异能","末日","奇幻","正能量","宫廷","亲情","剧情","轻小说","暗黑","长条","玄幻","霸总","其它","节操","欧风","女神","转生","异形","反套路","重生","性转"];
    static fallbackClasses = [["国漫",1],["日漫",2],["韩漫",3],["美漫",4],["精选推荐",5]];

    settings = {
        commentProviderV2: {title: "评论接口（新版路由）", type: "select", options: [{value:"auto",text:"自动：腾讯优先，无评论区时青漫"},{value:"tencent",text:"始终腾讯"},{value:"qingman",text:"始终青漫"}], default:"auto", description:"升级后默认自动；旧版接口偏好不继承。需要固定青漫/腾讯请在此重新选择。不会修改旧设置或账号。"},
        qingmanCommentsEnabled: {title:"青漫只读评论",type:"select",options:[{value:"on",text:"开启"},{value:"off",text:"关闭"}],default:"on"},
        manualqingmanbinding: {title:"青漫显式作品/章节绑定 JSON",type:"input",default:"{}",description:'格式 {"栗子作品ID":{"comicId":"青漫作品ID","title":"完整书名","chapters":{"栗子章节ID":{"chapterId":"青漫章节ID","title":"完整章节名"}}}}；可选消歧；未绑定自动搜索完整书名并核对真实目录，不按章节序号猜测。'},
        tencentCommentsEnabled: {
            title: "腾讯评论（作品讨论/章节评论）", type: "select",
            options: [{value: "on", text: "开启"}, {value: "off", text: "关闭"}], default: "on",
        },
        tencentCommentSort: {
            title: "腾讯章节评论排序", type: "select",
            options: [{value: "new", text: "新评"}, {value: "hot", text: "热评"}, {value: "wonderful", text: "精彩评论"}], default: "new",
        },
        tencentCommentBindings: {
            title: "腾讯作品绑定（可选 JSON）", type: "input", default: "{}",
            description: '自动匹配不确定时，填 {"栗子作品ID":"腾讯作品ID"}；章节仍按标题核对，不按目录位置猜测。',
        },

        imageLine: {
            title: "图片线路 (auto=自动测速)",
            type: "select",
            options: [
                { value: "auto", text: "自动测速 (推荐)" },
                { value: "0", text: "线路1 (CF优选海外)" },
                { value: "1", text: "线路2 (mechat)" },
                { value: "2", text: "线路3 (i.lzimg)" },
                { value: "3", text: "备用 (cf-1.imgio.club)" },
            ],
            default: "auto",
        },
        speedTest: {
            title: "API 节点延迟（验证有效响应）",
            type: "callback", buttonText: "开始测速",
            callback: async () => this.runDiagnosticTest(false),
        },
        imageSpeedTest: {
            title: "图片下载测速（会消耗流量）",
            type: "callback", buttonText: "开始测速",
            callback: async () => this.runDiagnosticTest(true),
        },
        communityCheck: {
            title: "接口自檢（社區／首頁）",
            type: "callback",
            buttonText: "開始檢查",
            callback: async () => {
                const lines = [];
                const check = async (label, path) => {
                    try {
                        const data = await Lizimh.getJson(path);
                        const n = data && data.list ? data.list.length : "-";
                        lines.push(label + "：OK，項目數 " + n);
                    } catch (e) {
                        let msg = String(e);
                        const http = msg.match(/HTTP \d{3}/);
                        const code = msg.match(/API code \d+/);
                        lines.push(label + "：" + (http ? http[0] : code ? code[0] : "失敗"));
                    }
                };
                await check("健康檢查", "/app/api/health");
                await check("社區帖子", "/app/api/community/posts?page_size=10&sort_type=0");
                await check("首頁", "/app/api/home/data");
                const text = "栗子接口自檢：\n" + lines.join("\n");
                if (typeof UI.showDialog === "function") {
                    UI.showDialog("接口自檢", text, [
                        {text: "關閉", callback: () => {}},
                        {text: "重新檢查", callback: () => this.loadSetting("communityCheck")},
                    ]);
                } else {
                    UI.showMessage(text);
                }
            },
        },
        authToken: {
            title: "官方登录凭证 (JWT，选填)",
            type: "input",
            default: "",
            description: "贴上栗子官方 App 的 authorization 值（抓包取得）。填了之后，章节图片会使用官方顺序（解决个别章节图片乱序），不填则用文件名顺序。",
        },
        maxPages: {
            title: "单章最大页数 (探测上限)",
            type: "select",
            options: [
                { value: "150", text: "150 页" },
                { value: "300", text: "300 页 (默认)" },
                { value: "600", text: "600 页" },
            ],
            default: "300",
        },
    };

    category = {
        title: "栗子漫画",
        parts: [
            { name: "推荐", type: "fixed", categories: ["热门排行"], categoryParams: ["rank"], itemType: "category" },
            { name: "题材", type: "fixed", categories: Lizimh.fallbackTags, categoryParams: Lizimh.fallbackTags.map((t) => "tag:" + t), itemType: "category" },
            { name: "地区", type: "fixed", categories: Lizimh.fallbackClasses.map((c) => c[0]), categoryParams: Lizimh.fallbackClasses.map((c) => "class:" + c[1]), itemType: "category" },
            { name: "状态", type: "fixed", categories: ["连载", "完结"], categoryParams: ["isend:0", "isend:1"], itemType: "category" },
        ],
    };

    explore = [
        {
            title: "栗子漫画",
            type: "multiPartPage",
            load: async (page) => {
                let parts = [];
                const errors = [];
                const recordError = (e) => {
                    const safe = String(e).replace(/https?:\/\/[^\s;()]+/g, "[API]");
                    if (errors.indexOf(safe) < 0) errors.push(safe);
                    return null;
                };
                // v2.24.0 提速：所有請求同時發射（Promise 並行），總耗時
                // ≈ 最慢的一個請求，而不是十幾個請求排隊相加。
                // home/data 只抓一次，推荐池與周期更新共用同一個 Promise。
                let homeP = Lizimh.getJson("/app/api/home/data").catch(recordError);
                let tagP = ["系统", "穿越", "玄幻"].map((tag) =>
                    Lizimh.getJson("/app/api/search/full?q=" + encodeURIComponent(tag) + "&page=1")
                        .then((res) => ({ tag: tag, res: res }))
                        .catch(recordError)
                );
                let rankP = Lizimh.getJson("/app/api/rank/list").catch(recordError);
                let catP = [];
                for (let p = 1; p <= 6; p++) {
                    catP.push(Lizimh.getJson("/app/api/category/list?page=" + p).catch(recordError));
                }

                // ① 首页推荐：精選國漫 + 系統/穿越/玄幻 三種題材，合成一個大池子。
                // 宿主首頁只顯示 6 本，「换一换」從整個池子裡抽 → 種類才夠多。
                try {
                    let pool = [];
                    let seen = {};
                    let add = (c) => {
                        let id = String(c.id || "");
                        if (!id || seen[id]) return;
                        seen[id] = 1;
                        pool.push(c);
                    };
                    let home = await homeP;
                    if (home) {
                        for (let g of home.home_content_list || []) {
                            let t = String(g.title || "");
                            if (t.indexOf("国漫") >= 0) {
                                for (let c of g.comic_list || []) add(c);
                            }
                        }
                    }
                    // 注意：search/full 是「全文搜尋」，不是標籤篩選 ——
                    // 搜「系统」會撈回一堆只是內文提到系統、標籤完全不是系統的作品，
                    // 所以這裡必須再用 tags 精確比對，否則推薦池會混進一堆無關標籤。
                    for (let r of await Promise.all(tagP)) {
                        if (!r) continue;
                        for (let c of r.res.search_full || []) {
                            let tags = String(c.tags || "").split(",").map((t) => t.trim());
                            let name = String(c.name || "");
                            // 標籤命中，或作品名直接帶該關鍵詞，才算這個題材
                            if (tags.indexOf(r.tag) >= 0 || name.indexOf(r.tag) >= 0) add(c);
                        }
                    }
                    if (pool.length) {
                        parts.push({
                            title: "首页推荐",
                            comics: pool.map((c) => this.parseComic(c, "desc")),
                        });
                    }
                } catch (e) {}
                // ② 周期更新：按 updatedAt 算出「星期几更新」，分到周一~周日
                try {
                    let pool = [];
                    let home = await homeP;      // 同一 Promise，不會重複發請求
                    if (home) {
                        for (let g of home.home_content_list || []) {
                            pool.push(...(g.comic_list || []));
                        }
                    }
                    let rank = await rankP;
                    if (rank) {
                        for (let g of rank.rank_list || []) {
                            pool.push(...(g.comic_list || []));
                        }
                    }
                    for (let data of await Promise.all(catP)) {
                        if (!data) continue;
                        pool.push(...(data.category_list || []));
                    }
                    let names = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
                    let buckets = [[], [], [], [], [], [], []];
                    let seen = {};
                    for (let c of pool) {
                        if (!c || !c.updatedAt) continue;
                        let id = String(c.id);
                        if (seen[id]) continue;
                        seen[id] = 1;
                        let w = new Date(Number(c.updatedAt) * 1000).getDay();
                        if (isNaN(w)) continue;
                        // v2.25.0：不再封頂 12 本 —— 池裡有多少給多少，
                        // App「查看更多」會全部列出
                        buckets[w].push(this.parseComic(c, "chapter"));
                    }
                    for (let i of [1, 2, 3, 4, 5, 6, 0]) {
                        if (buckets[i].length) {
                            parts.push({ title: names[i], comics: buckets[i] });
                        }
                    }
                } catch (e) {}
                if (!parts.length) throw new Error("探索页加载失败" + (errors.length ? ": " + errors.slice(0, 2).join("; ") : ""));
                return parts;
            },
        },
    ];


    // 圖片 URL -> 線路索引 / 原始路徑, 供失敗換線使用
    _imgLine = {};
    _imgPath = {};
    _lineOrder = null;   // 測速後的線路優先順序 (索引數組)

    _diagnosticBusy = false;

    async diagnosticTimeout(task, ms) {
        // The host supplies setTimeout without a timer ID or clearTimeout.
        // Ignore the eventual callback after resolution instead of cancelling it.
        return new Promise((resolve, reject) => {
            let settled = false;
            setTimeout(() => {
                if (settled) return;
                settled = true;
                reject(new Error("超时"));
            }, ms);
            Promise.resolve(task).then((value) => {
                if (settled) return;
                settled = true;
                resolve(value);
            }, (error) => {
                if (settled) return;
                settled = true;
                reject(error);
            });
        });
    }

    async diagnosticApi(base) {
        const start = Date.now();
        const r = await this.diagnosticTimeout(
            Network.get(base + Lizimh.signedPath("/app/api/v2/detail/57229"), Lizimh.apiHeaders()), 6000);
        if (r.status !== 200) throw new Error("HTTP " + r.status);
        const j = JSON.parse(r.body);
        if (j.code !== 201 || !j.data || !Array.isArray(j.data.chapters)) {
            throw new Error("非有效漫画接口响应");
        }
        return {ms: Date.now() - start, data: j.data};
    }

    async runDiagnosticTest(images) {
        if (this._diagnosticBusy) { UI.showMessage("测速仍在进行，请稍候"); return; }
        this._diagnosticBusy = true;
        let message;
        try {
            UI.showMessage(images ? "正在准备同一张样本图片，各线路并行下载…" : "正在并行验证 API 节点…");
            const bases = [Lizimh.api, Lizimh.apiFallback].filter((v,i,a) => a.indexOf(v) === i);
            const api = await Promise.all(bases.map(async base => {
                try { return {base, ok: true, ...await this.diagnosticApi(base)}; }
                catch (e) { return {base, ok: false, error: String(e)}; }
            }));
            api.sort((a,b) => Number(b.ok)-Number(a.ok) || (a.ms||0)-(b.ms||0));
            if (!images) {
                const shortError = (error) => {
                    const text = String(error || "");
                    if (/ENOTFOUND|DNS|lookup address/i.test(text)) return "DNS 不可用";
                    if (/timeout|超时/i.test(text)) return "连接超时";
                    const http = text.match(/HTTP \d{3}/);
                    return http ? http[0] : "连接失败";
                };
                message = api.map((r,i) => r.base + "\n" + (r.ok ? r.ms + "ms" + (i===0 ? " ★ 最快" : "") : shortError(r.error))).join("\n\n");
            } else {
                const available = api.find(r => r.ok);
                if (!available) throw new Error("API 均不可用，无法取得测试图片；未执行图片测速");
                const sample = available.data.chapters.find(c => typeof c.cover === "string" && /^\/(?!\/)/.test(c.cover));
                if (!sample) throw new Error("没有可用的相对路径图片样本");
                const results = await Promise.all(Lizimh.lines.map(async (line,i) => {
                    const start = Date.now();
                    try {
                        const n = await this.diagnosticTimeout((async () => {
                            const r = await fetch(this.lineAbs(sample.cover,i), {headers: {"User-Agent": "Mozilla/5.0", "Cache-Control": "no-cache"}});
                            if (r.status !== 200) throw new Error("HTTP " + r.status);
                            const bytes = new Uint8Array(await r.arrayBuffer());
                            const jpg = bytes[0]===255 && bytes[1]===216;
                            const png = bytes[0]===137 && bytes[1]===80 && bytes[2]===78 && bytes[3]===71;
                            const webp = bytes[0]===82 && bytes[1]===73 && bytes[8]===87 && bytes[9]===69;
                            if (bytes.length < 1024 || !(jpg || png || webp)) throw new Error("响应非有效测试图片");
                            return bytes.length;
                        })(), 8000);
                        const ms = Math.max(1,Date.now()-start);
                        return {i, name:line.name, ok:true, n, ms, rate:n*1000/ms};
                    } catch (e) { return {i,name:line.name,ok:false,error:String(e)}; }
                }));
                results.sort((a,b) => Number(b.ok)-Number(a.ok) || (b.rate||0)-(a.rate||0));
                message = results.map((r,k) => r.name + "\n" + (r.ok ? (r.rate/1024).toFixed(1) + " KB/s · " + r.ms + "ms · " + (r.n/1024).toFixed(1) + " KB" + (k===0 ? " ★ 最快" : "") : /timeout|超时/i.test(String(r.error)) ? "连接超时" : "连接失败")).join("\n\n");
                message += "\n\n同一张图片的有效下载速度，含连接耗时；受缓存及并行竞争影响，不代表带宽上限。超时仅停止等待，宿主请求可能仍在完成。";
            }
            message += "\n\n仅报告结果，不自动切换线路。";
        } catch (e) { message = "测速失败：" + String(e); }
        finally { this._diagnosticBusy = false; }
        const title = images ? "图片下载测速" : "API 节点延迟";
        if (typeof UI.showDialog === "function") {
            UI.showDialog(title, message, [
                {text: "关闭", callback: () => {}},
                {text: "重新测试", callback: () => this.runDiagnosticTest(images)},
            ]);
        } else { UI.showMessage(message); }
    }

    // 當前使用哪條線 (auto 時用測速結果第一條)
    currentLine() {
        let setting = "auto";
        try { setting = this.loadSetting("imageLine") || "auto"; } catch (e) {}
        if (setting !== "auto") {
            let i = parseInt(setting);
            if (!isNaN(i) && i >= 0 && i < Lizimh.lines.length) return i;
        }
        if (this._lineOrder && this._lineOrder.length) return this._lineOrder[0];
        return 0;
    }

    lineUrl(idx) {
        let i = (idx === undefined || idx === null) ? this.currentLine() : idx;
        if (i < 0 || i >= Lizimh.lines.length) i = 0;
        return Lizimh.lines[i].url;
    }

    // Official JWT lists contain generator markers. Keep their order but use
    // the configured plain-image CDN; the marker-specific host serves binary data.
    // Persist paths, not a selected CDN URL. Also repair pre-fix absolute caches.
    officialImagePath(value) {
        const text = String(value || "");
        const marker = text.match(/\$jp\$(?:cf)?/);
        if (marker) return text.slice(marker.index + marker[0].length);
        for (const line of Lizimh.lines) {
            if (line.proxy && line.src && text.startsWith(line.url)) {
                try {
                    const src = decodeURIComponent(text.slice(line.url.length));
                    if (src.startsWith(line.src + "/")) return src.slice(line.src.length);
                } catch (_) {}
            }
        }
        const m = text.match(/^https?:\/\/([^/]+)(\/.*)$/);
        if (m) {
            const host = m[1].toLowerCase();
            if (host === "pic.lizimh.net" || host === "img2.mechat.fun") return m[2];
            const known = ["cdn.lzimg.xyz", "i.lzimg.xyz", "cf-1.imgio.club", "media.imgo.buzz", "img.mechat.fun"];
            if (known.indexOf(host) >= 0 || Lizimh.lines.some(x => !x.proxy && text.startsWith(x.url + "/"))) return m[2];
        }
        return text;
    }

    officialImageUrls(values) {
        const line = this.currentLine();
        return values.map(value => {
            const path = this.officialImagePath(value);
            const url = this.abs(path);
            this._imgLine[url] = line;
            this._imgPath[url] = path;
            return url;
        });
    }

    // 由相對路徑構造絕對 URL (供探測與換線使用)
    lineAbs(path, idx) {
        path = this.officialImagePath(path);
        let i = (idx === undefined || idx === null) ? this.currentLine() : idx;
        if (i < 0 || i >= Lizimh.lines.length) i = 0;
        let line = Lizimh.lines[i];
        if (line.proxy && line.src) {
            return line.url + encodeURIComponent(line.src + path);
        }
        return line.url + path;
    }

    // 解析服務端下發的線路 JS (img_generator.code), 跳過加密線路
    static parseGenerators(code, generators) {
        let text = "";
        try {
            text = Convert.decodeUtf8(Convert.decodeBase64(code));
        } catch (e) {
            text = "";
        }
        let out = [];
        for (let gen of generators || []) {
            if (gen.encrypt === true) continue;      // 加密線路: 插件無法解碼, 直接跳過
            let fn = gen.func || "";
            let host = gen.url || "";
            let proxy = false, srcHost = "";
            if (fn && text) {
                let re = new RegExp("function\\s+" + fn + "\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}");
                let m = text.match(re);
                if (m) {
                    let body = m[1];
                    if (body.indexOf("encodeURIComponent") >= 0) {
                        proxy = true;
                        let pm = body.match(/return\s+"([^"]+)"\s*\+\s*encodeURIComponent/);
                        if (pm) host = pm[1];
                        let sm = body.match(/var\s+t\s*=\s*"([^"]+)"/);
                        if (sm) srcHost = sm[1];
                    } else {
                        let dm = body.match(/return\s+"([^"]*)"\s*\+\s*u/);
                        if (dm && dm[1]) host = dm[1];
                    }
                }
            }
            if (!host || !/^https?:\/\//.test(host)) continue;
            host = host.replace(/\/$/, "");
            if (srcHost) srcHost = srcHost.replace(/\/$/, "");
            out.push({
                name: gen.name || fn || ("线路" + (out.length + 1)),
                url: host,
                proxy: proxy,
                src: srcHost,
            });
        }
        return out;
    }

    abs(path) {
        if (!path) return "";
        path = this.officialImagePath(path);
        if (path.startsWith("http")) return path;
        let line = Lizimh.lines[this.currentLine()] || Lizimh.lines[0];
        if (line.proxy && line.src) {
            return line.url + encodeURIComponent(line.src + path);
        }
        return line.url + path;
    }

    // 測速: 對每條線發一次 HEAD, 按延遲排序 (auto 模式使用)
    async speedTest() {
        // 只對直連線路測速（代理型線路單獨排到最後，避免探測繞代理而變慢）
        let direct = [], proxy = [];
        for (let i = 0; i < Lizimh.lines.length; i++) {
            (Lizimh.lines[i].proxy ? proxy : direct).push(i);
        }
        if (direct.length) {
            // v2.30.1：改成【並行】測速 + 短超時（原本逐條等 2.5 秒，
            // 有斷線線路時光是測速就要好幾秒 → 使用者感覺「載入慢成狗」）
            let measured = await Promise.all(direct.map(async (i) => {
                let t0 = Date.now();
                let ok = false;
                try {
                    let res = await Promise.race([
                        Network.sendRequest("HEAD", Lizimh.lines[i].url + "/", {}),
                        this.sleep(800).then(() => null),
                    ]);
                    ok = res && res.status && res.status < 500;
                } catch (e) { ok = false; }
                let dt = Date.now() - t0;
                return { i: i, ms: ok ? dt : 999999 };
            }));
            measured.sort((a, b) => a.ms - b.ms);
            this._lineMs = {};
            for (let m of measured) this._lineMs[m.i] = m.ms;
            this._lineOrder = measured.map((r) => r.i).concat(proxy);
            let best = Lizimh.lines[this._lineOrder[0]];
            console.log("[lizimh] 线路测速(仅直连): " + measured.map((r) =>
                Lizimh.lines[r.i].name + "=" + (r.ms > 900000 ? "超时" : r.ms + "ms")).join(", ")
                + " → 选用 " + best.name);
            return;
        }
        let results = [];
        for (let i = 0; i < Lizimh.lines.length; i++) {
            let t0 = Date.now();
            let ok = false;
            try {
                let res = await Promise.race([
                    Network.sendRequest("HEAD", Lizimh.lines[i].url + "/", {}),
                    this.sleep(2500).then(() => null),
                ]);
                ok = res && res.status && res.status < 500;
            } catch (e) { ok = false; }
            let dt = Date.now() - t0;
            results.push({ i: i, ms: ok ? dt : 999999 });
            await this.sleep(60);
        }
        results.sort((a, b) => a.ms - b.ms);
        this._lineOrder = results.map((r) => r.i);
        let best = Lizimh.lines[this._lineOrder[0]];
        console.log("[lizimh] 线路测速: " + results.map((r) =>
            Lizimh.lines[r.i].name + "=" + (r.ms > 900000 ? "超时" : r.ms + "ms")).join(", ")
            + " → 选用 " + best.name);
    }

    // 圖片加載失敗時, 換下一條線重試同一張圖
    nextLineUrl(url) {
        let path = this._imgPath[url];
        if (!path) {
            let m = String(url).match(/^https?:\/\/[^/]+(\/.*)$/);
            path = m ? m[1] : null;
        }
        if (!path) return null;
        let cur = this._imgLine[url];
        if (cur === undefined) cur = this.currentLine();
        let order = this._lineOrder || Lizimh.lines.map((_, i) => i);
        let pos = order.indexOf(cur);
        for (let k = 1; k <= order.length; k++) {
            let nxt = order[(pos + k) % order.length];
            if (nxt === cur) continue;
            let nu = this.lineAbs(path, nxt);
            this._imgLine[nu] = nxt;
            this._imgPath[nu] = path;
            return nu;
        }
        return null;
    }

    // mode: undefined -> 用作者當副標題; "desc" -> 用簡介; "chapter" -> 用「第N话」
    parseComic(c, mode) {
        let sub = c.author || "";
        if (mode === "desc") {
            let t = String(c.content || "").replace(/\s+/g, " ").trim();
            sub = t.length > 22 ? t.substring(0, 22) + "…" : t;
        } else if (mode === "chapter") {
            let n = Number(c.nums);
            sub = n > 0 ? "第" + n + "话" : (Number(c.isend) === 1 ? "已完结" : "连载中");
        }
        return new Comic({
            id: String(c.id),
            title: c.name || "",
            subTitle: sub,
            cover: this.abs(c.picY || c.picX || c.cover),
            tags: (c.tags || "").split(",").filter((t) => t),
            description: c.content || "",
        });
    }

    // The app calls this (via the JS bridge) to use the source's own request
    // path, which this host accepts where the app's client is rejected.
    // body == null  -> GET; otherwise POST with the user's token (writes need
    // the same authorization the official client sends).
    apiFetch = async (path, body) => {
        const hasBody = body !== undefined && body !== null && String(body) !== "";
        if (!hasBody) {
            // Must match the {code,data} envelope the app parses; getJson
            // already unwrapped it, so wrap it back.
            return JSON.stringify({ code: 201, data: await Lizimh.getJson(path) });
        }
        let token = "";
        try { token = String(this.loadSetting("authToken") || "").trim(); } catch (e) {}
        token = token.replace(/^jwt:\s*/i, "").replace(/^Bearer\s+/i, "").trim();
        // Writes always try the primary host first; the fallback host's DNS
        // has been dead, and a stale _useFallback flag used to send every POST
        // straight at it.
        const bases = [Lizimh.api, Lizimh.apiFallback];
        let last = "請求失敗";
        for (const base of bases) {
            try {
                const headers = {
                    "Accept": "application/json",
                    "Content-Type": "application/json; charset=utf-8",
                    "User-Agent": "Dart/3.5 (dart:io)",
                };
                if (token) headers["authorization"] = token;
                // Without a bound a stalled POST leaves the app waiting forever
                // with no error, which looks like a dead button.
                // The host serialises objects itself; sending a raw string made
                // the server answer 400 "请求参数解析失败".
                let payload = body;
                try { payload = JSON.parse(String(body)); } catch (e) {}
                const send = (data, extraHeaders) => Promise.race([
                    Network.sendRequest(
                        "POST",
                        base + Lizimh.signedPath(path),
                        Object.assign({}, headers, extraHeaders || {}),
                        data,
                    ),
                    new Promise((resolve) => setTimeout(
                        () => resolve({ status: 0, body: "" }), 15000)),
                ]);
                let res = await send(payload);
                if (res && res.status === 400 && payload && typeof payload === "object") {
                    // The server may expect a form body; retry once that way.
                    const form = Object.keys(payload).map((k) =>
                        encodeURIComponent(k) + "=" +
                        encodeURIComponent(String(payload[k]))).join("&");
                    const retry = await send(form, {
                        "Content-Type": "application/x-www-form-urlencoded",
                    });
                    if (retry && retry.status === 200) res = retry;
                }
                if (!res || res.status !== 200) {
                    let detail = "";
                    try {
                        const parsed = JSON.parse(res && res.body ? res.body : "");
                        if (parsed && parsed.msg) detail = "：" + parsed.msg;
                    } catch (e) {}
                    last = res && res.status === 0
                        ? "請求超時"
                        : ("HTTP " + (res ? res.status : "?") + detail);
                    continue;
                }
                const parsed = JSON.parse(res.body);
                if (parsed.code !== 201 && parsed.code !== 200) {
                    throw new Error(parsed.msg || ("API code " + parsed.code));
                }
                Lizimh._useFallback = base === Lizimh.apiFallback;
                return JSON.stringify({ code: 201, data: parsed.data || {} });
            } catch (e) {
                last = String(e && e.message ? e.message : e);
            }
        }
        throw new Error(last);
    };

    static async getJson(path) {
        const bases = Lizimh._useFallback
            ? [Lizimh.apiFallback, Lizimh.api]
            : [Lizimh.api, Lizimh.apiFallback];
        const failures = [];
        // DNS and TLS failures on this host are intermittent; retry each host
        // once with a short delay before reporting a network error.
        const wait = (ms) => new Promise((r) => setTimeout(() => r(null), ms));
        for (const base of bases) {
            try {
                const res = await Network.get(base + Lizimh.signedPath(path), Lizimh.apiHeaders());
                if (res.status !== 200) throw new Error("HTTP " + res.status);
                const json = JSON.parse(res.body);
                if (json.code !== 201) {
                    throw new Error("API code " + json.code + ": " + (json.msg || ""));
                }
                Lizimh._useFallback = base === Lizimh.apiFallback;
                return json.data;
            } catch (e) {
                // Keep credentials and signed query strings out of our errors.
                let message = String(e);
                const http = message.match(/HTTP \d{3}/);
                if (!http) {
                    await wait(600);
                    try {
                        const retry = await Network.get(
                            base + Lizimh.signedPath(path), Lizimh.apiHeaders());
                        if (retry.status === 200) {
                            const json2 = JSON.parse(retry.body);
                            if (json2.code === 201) {
                                Lizimh._useFallback = base === Lizimh.apiFallback;
                                return json2.data;
                            }
                        }
                        message = message + " (retry failed)";
                    } catch (e2) {
                        message = message + " (retry failed)";
                    }
                }
                failures.push(base + ": " + (http ? http[0] : "网络或响应格式错误"));
            }
        }
        throw new Error("栗子接口请求失败 " + String(path).split("?")[0] + " (" + failures.join("; ") + ")");
    }

    static fmtDate(iso) { return iso ? String(iso).substring(0, 10) : ""; }

    static statusByLastUpdate(iso) {
        if (!iso) return "未知";
        let days = (Date.now() - Date.parse(iso)) / 86400000;
        if (isNaN(days)) return "未知";
        if (days > 365) return "完结";
        if (days > 45) return "暂时完结";
        return "连载中";
    }

    async init() {
        this.loadPersistedPages();
        this.loadPersistedVerified();
        try {
            let data = await Lizimh.getJson("/app/api/configv2");
            let g = data.cfg_general || {};
            let tags = (g.category_tabs && g.category_tabs.length) ? g.category_tabs : Lizimh.fallbackTags;
            let cls = data.cfg_comic_class || [];
            let classes = cls.length ? cls.map((c) => [c.name, c.id]) : Lizimh.fallbackClasses;
            // 图片线路: 解析服务端下发的 JS, 跳过加密线路
            let ig = g.img_generator || {};
            let gens = ig.generators || [];
            let lines = Lizimh.parseGenerators(ig.code || "", gens);
            if (!lines.length) {
                // 退回: 只取非加密且非百度代理的直连线路
                for (let gen of gens) {
                    if (gen.encrypt === true) continue;
                    if (gen.url && /^https?:\/\//.test(gen.url) && !/baidu\.com/.test(gen.url)) {
                        lines.push({ name: gen.name || gen.func, url: gen.url.replace(/\/$/, "") });
                    }
                }
            }
            lines.push({ name: "备用 (cf-1.imgio.club)", url: "https://cf-1.imgio.club" });
            if (lines.length) Lizimh.lines = lines;
            // 依服務端線路重建設置項 (保留 auto)
            let opts = [{ value: "auto", text: "自动测速 (推荐)" }];
            for (let i = 0; i < Lizimh.lines.length; i++) {
                opts.push({ value: String(i), text: Lizimh.lines[i].name });
            }
            try {
                this.settings.imageLine.options = opts;
            } catch (e) {}
            // auto 模式: 測速選最快
            let mode = "auto";
            try { mode = this.loadSetting("imageLine") || "auto"; } catch (e) {}
            if (mode === "auto") {
                try { await this.speedTest(); } catch (e) {}
            }
            this.category = {
                title: "栗子漫画",
                parts: [
                    { name: "推荐", type: "fixed", categories: ["热门排行"], categoryParams: ["rank"], itemType: "category" },
                    { name: "题材", type: "fixed", categories: tags, categoryParams: tags.map((t) => "tag:" + t), itemType: "category" },
                    { name: "地区", type: "fixed", categories: classes.map((c) => c[0]), categoryParams: classes.map((c) => "class:" + c[1]), itemType: "category" },
                    { name: "状态", type: "fixed", categories: ["连载", "完结"], categoryParams: ["isend:0", "isend:1"], itemType: "category" },
                ],
            };
        } catch (e) {
            // 配置拉取失败用内置清单
        }
    }

    search = {
        load: async (keyword, options, page) => {
            let q = encodeURIComponent(keyword);
            let data = await Lizimh.getJson(`/app/api/search/full?q=${q}`);
            let list = data.search_full || [];
            return { comics: list.map((c) => this.parseComic(c)), maxPage: 1 };
        },
    };

    categoryComics = {
        load: async (category, param, options, page) => {
            let comics = [];
            let p = page || 1;
            if (param === "rank") {
                let data = await Lizimh.getJson("/app/api/rank/list");
                for (let g of data.rank_list || []) {
                    comics.push(...(g.comic_list || []).map((c) => this.parseComic(c)));
                }
            } else {
                // v2.25.0：支援組合篩選 "tag:格斗|class:3|isend:0" + 分頁，
                // 供 App 分類頁（篩選 chips + 即時網格）多條件查詢使用。
                let qsParts = [];
                for (let seg of String(param || "").split("|")) {
                    if (seg.startsWith("tag:")) qsParts.push("tag=" + encodeURIComponent(seg.substring(4)));
                    else if (seg.startsWith("class:")) qsParts.push("class=" + seg.substring(6));
                    else if (seg.startsWith("isend:")) qsParts.push("isend=" + seg.substring(6));
                }
                if (qsParts.length) {
                    let data = await Lizimh.getJson(`/app/api/category/list?${qsParts.join("&")}&page=${p}`);
                    comics = (data.category_list || []).map((c) => this.parseComic(c));
                } else {
                    // v2.25.1：「全部」（沒有任何篩選條件）= 未篩選的分類總列表
                    let data = await Lizimh.getJson(`/app/api/category/list?page=${p}`);
                    comics = (data.category_list || []).map((c) => this.parseComic(c));
                }
            }
            let seen = new Set();
            comics = comics.filter((c) => !seen.has(c.id) && seen.add(c.id));
            // 非空就允許繼續翻頁（抓回空頁即到底）
            return { comics: comics, maxPage: comics.length ? p + 1 : p };
        },
        // Structured filter adapter used by the app category page. The API
        // already supports repeated tag/class/isend parameters; keep the
        // source-native values and let the server apply all selected rows.
        loadWithFilters: async (request) => {
            const filters = Array.isArray(request && request.filters)
                ? request.filters : [];
            const options = Array.isArray(request && request.options)
                ? request.options : [];
            const page = Number(request && request.page) || 1;
            const params = filters
                .map((f) => String(f.param || ''))
                .filter((p) => p && p !== 'rank');
            return await this.categoryComics.load(
                filters.length ? String(filters[0].category || '分類') : '分類',
                params.join('|'), options, page);
        },
    };

    // v2.28.0：供 App「清除本漫畫快取」按鈕呼叫 ——
    // 清掉這部漫畫的頁數快取/已驗證頁清單/封面快取，並持久化
    resetComicCache(comicId) {
        let id = String(comicId || "");
        if (!id) return false;
        let hit = 0;
        // v2.29.2 修正：快取 key 是【圖片目錄】（例 /Manual/jARSPL8b/mcf4HZLK），
        // 目錄名裡沒有漫畫 id → 舊版用 id 匹配永遠清不到。
        // 正確做法：由這部漫畫每章的封面路徑推導出目錄，再逐一清除。
        let covers = this._coverCache[id] || null;
        if (covers) {
            for (let cid in covers) {
                let dir = String(covers[cid]).replace(/\/[^\/]+$/, "");
                if (this._pageCache[dir] !== undefined) {
                    delete this._pageCache[dir];
                    hit++;
                }
                delete this._verified[dir];
                // 官方順序快取（記憶體 + 持久化）
                delete this._officialCache[cid];
                try { this.saveData("officialPics_" + cid, ""); } catch (e) {}
            }
        }
        try { delete this._coverCache[id]; delete this._orderCache[id]; delete this._epMap[id]; delete this._coverById[id]; } catch (e) {}
        // 保險：任何路徑剛好含此 id 的也清掉
        for (let dir in this._pageCache) {
            if (dir.indexOf(id) >= 0) {
                delete this._pageCache[dir];
                delete this._verified[dir];
                hit++;
            }
        }
        this.persistPages();
        return hit;
    }

    // 官方順序快取: chapterId -> [url]
    _officialCache = {};

    // 章節封面快取: comicId -> {chapterId: coverPath}
    _coverCache = {};
    // 章節順序: comicId -> [章節序號 key...]
    _orderCache = {};
    // 章節序號 key -> 真正章節 id（v2.33.4：key 改用序號，見 loadInfo 註解）
    _epMap = {};
    // One source-instance seed for chapter names and Lizi created_at dates.
    // Tencent likes are deliberately kept outside this cache.
    _chapterInfoCache = {};
    _chapterInfoFlights = {};
    // 真正章節 id -> 封面路徑（舊資料 / 舊 epId 回退用）
    _coverById = {};
    // 章節頁數快取: dir -> pageCount (記憶體)
    _pageCache = {};

    // 已逐頁校驗過的章節: dir -> [有效頁碼]（下載/二次閱讀用，避免缺頁導致 404）
    _verified = {};

    // 持久化快取 (跨啟動), 用宿主的 saveData/loadData
    persistPages() {
        try {
            let obj = {};
            let n = 0;
            for (let k in this._pageCache) { obj[k] = this._pageCache[k]; n++; if (n > 800) break; }
            this.saveData("pageCounts", JSON.stringify(obj));
        } catch (e) {}
    }
    loadPersistedVerified() {
        try {
            let raw = this.loadData("verifiedPages");
            if (raw) {
                let obj = JSON.parse(raw);
                for (let k in obj) this._verified[k] = obj[k];
            }
        } catch (e) {}
    }

    loadPersistedPages() {
        try {
            let raw = this.loadData("pageCounts");
            if (raw) {
                let obj = JSON.parse(raw);
                for (let k in obj) this._pageCache[k] = obj[k];
            }
        } catch (e) {}
    }

    // v2.29.0：取官方章節圖片順序（需要登入憑證）
    // 有些章節是人工上傳、檔名編號與閱讀順序不一致（例：第153话 官方順序是
    // 1..12, 49, 13, 14...），只有官方接口回的 pics 才是正確順序。
    async officialPics(chapterId) {
        // 沒有章節 id 就不要發請求（日誌曾出現 chapter/v3/null）
        if (chapterId === null || chapterId === undefined || String(chapterId) === "") return null;
        let token = "";
        try { token = String(this.loadSetting("authToken") || "").trim(); } catch (e) {}
        token = token.replace(/^jwt:\s*/i, "").replace(/^Bearer\s+/i, "").trim();
        if (!token) return null;
        let key = "officialPics_" + String(chapterId);
        // 失敗冷卻：接口掛掉/限流時不要每開一章都卡一次
        try {
            let until = parseInt(this.loadData("officialPicsSignedCooldown") || "0", 10) || 0;
            if (Date.now() < until) return null;
        } catch (e) {}
        if (this._officialCache[String(chapterId)]) {
            return this.officialImageUrls(this._officialCache[String(chapterId)]);
        }
        // 持久化快取：官方順序不會變，抓過一次就存起來
        //（這個接口會消耗帳號的閱讀額度，別重複抓）
        try {
            let saved = this.loadData(key);
            if (saved) {
                let arr = JSON.parse(saved);
                if (arr && arr.length) {
                    arr = arr.map(x => this.officialImagePath(x));
                    this._officialCache[String(chapterId)] = arr;
                    try { this.saveData(key, JSON.stringify(arr)); } catch (_) {}
                    return this.officialImageUrls(arr);
                }
            }
        } catch (e) {}
        try {
            let res = null;
            const bases = [Lizimh._useFallback ? Lizimh.apiFallback : Lizimh.api,
                           Lizimh._useFallback ? Lizimh.api : Lizimh.apiFallback];
            for (let bi = 0; bi < bases.length && (!res || res.status !== 200); bi++) {
                try {
                    res = await Network.get(
                        bases[bi] + Lizimh.signedPath("/app/api/chapter/v3/" + chapterId),
                        Lizimh.apiHeaders({ "authorization": token }));
                    if (res && res.status === 200) Lizimh._useFallback = bases[bi] === Lizimh.apiFallback;
                } catch (e) {
                    res = null;
                }
            }
            if (!res || res.status !== 200) {
                try { this.saveData("officialPicsSignedCooldown", String(Date.now() + 10 * 60 * 1000)); } catch (e) {}
                return null;
            }
            if (!res || res.status !== 200) return null;
            let data = JSON.parse(res.body);
            let pics = (data && data.data && data.data.pics) || [];
            if (!pics.length) return null;
            let out = pics.map((x) => this.officialImagePath(x));
            this._officialCache[String(chapterId)] = out;
            try { this.saveData(key, JSON.stringify(out)); } catch (e) {}
            return this.officialImageUrls(out);
        } catch (e) {
            return null;
        }
    }

    // v2.33.4：epId（章節序號 key）→ 真正章節 id。
    // 舊資料（歷史紀錄／下載佇列裡存的是章節 id）沒有對應就原樣返回，
    // 這樣舊書籤照樣能載入，只是顯示位置按序號算。
    resolveEp(comicId, epId) {
        const m = this._epMap[String(comicId)];
        const k = String(epId);
        return (m && m[k]) ? m[k] : k;
    }

    // v2.33.2：背景預取「下一話」——讀者切下一話時就不用現場探測/等接口。
    // （官方 App 也是這樣做，所以它切話幾乎秒開。）
    async warmNext(comicId, epId) {
        try {
            let order = this._orderCache[String(comicId)];
            if (!order || !order.length) {
                await this.chapterCovers(comicId);
                order = this._orderCache[String(comicId)];
            }
            if (!order || !order.length) return;
            let idx = order.indexOf(String(epId));
            if (idx < 0 || idx + 1 >= order.length) return;
            let nextId = order[idx + 1];
            // ① 有 JWT → 先抓官方順序（最準且不用探測）
            let ok = false;
            try {
                let official = await this.officialPics(this.resolveEp(comicId, nextId));
                ok = !!(official && official.length);
            } catch (e) {}
            if (ok) return;
            // ② 沒官方 → 至少把頁數快取預熱（背景探測，不阻塞當前章節）
            let covers = this._coverCache[String(comicId)] || null;
            let cover = covers ? covers[nextId] : null;
            if (!cover) return;
            let m = String(cover).match(/^(.*)\/(\d+)\.([A-Za-z0-9]+)$/);
            if (!m) return;
            let dir = m[1], coverPage = parseInt(m[2]) || 1, ext = m[3];
            let maxPages = 300;
            try { maxPages = parseInt(this.loadSetting("maxPages") || "300"); } catch (e) {}
            if (this._verified[m[1]]) return;
            await this.probePages(dir, ext, maxPages, coverPage);
        } catch (e) {}
    }

    async chapterCovers(comicId) {
        if (this._coverCache[comicId]) return this._coverCache[comicId];
        let data = await Lizimh.getJson(`/app/api/v2/detail/${comicId}`);
        let map = {};
        const epMap = this._epMap[String(comicId)] || null;
        const rev = {};
        if (epMap) for (let k in epMap) rev[epMap[k]] = k;
        for (let ch of data.chapters || []) {
            if (ch.cover) {
                const cid = String(ch.id);
                map[rev[cid] || cid] = ch.cover;
            }
        }
        this._coverCache[comicId] = map;
        return map;
    }

    // 由 cover 路徑推導同目錄下的全部頁面
    //  優化要點 (實測):
    //   1. GET + Range: 單次 ~116ms, 遠快於 HEAD 的 ~560ms
    //   2. 並行上限 6 (HTTP/1.1 每主機連接數): 超過會排隊反而變慢
    //   3. 先按 1,2,4,8,16,32 跨度並行探一次夾出區間, 再在區間內並行細分
    async probePages(dir, ext, maxPages, coverPage) {
        const url = (i) => this.lineAbs(dir + "/" + i + "." + ext);
        const headers = {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
            "Range": "bytes=0-0",
        };
        const LIMIT = 6;
        // 單頁存在性: GET + Range, 200/206 = 存在, 404 = 不存在
        // 關鍵：CDN 對「不存在的頁」會回 HTTP 200 + 82 字節占位圖，
        // 所以必須用尺寸判斷，否則探測出的總頁數會虛高（下載就會 404）
        const isReal = (res) => {
            if (res.status === 206) return true;          // Range 命中 = 真圖
            if (res.status !== 200) return false;
            let len = 0;
            try {
                let h = res.headers || {};
                let cl = h["content-length"] || h["Content-Length"] || h["Content-length"];
                if (cl !== undefined) len = parseInt(cl, 10) || 0;
            } catch (e) {}
            if (!len && res.body) len = res.body.length;
            return len >= 1024;
        };
        const exists = async (i) => {
            for (let attempt = 0; attempt < 3; attempt++) {
                try {
                    let res = await Network.sendRequest("GET", url(i), headers);
                    if (res.status === 404 || res.status === 403 || res.status === 400) return false;
                    if (res.status === 429 || res.status === 503) { await this.sleep(200 * (attempt + 1)); continue; }
                    return isReal(res);
                } catch (e) { await this.sleep(100 * (attempt + 1)); }
            }
            return null;
        };
        // 分批並行 (最多 LIMIT 個同時)
        const probeAll = async (idxs) => {
            let out = [];
            for (let i = 0; i < idxs.length; i += LIMIT) {
                let chunk = idxs.slice(i, i + LIMIT);
                let r = await Promise.all(chunk.map((x) => exists(x)));
                out = out.concat(r);
                if (r.some((x) => x === false)) break;   // 已找到邊界, 不必再掃
            }
            return out;
        };
        const build = (n) => { let o = []; for (let i = 1; i <= n; i++) o.push(url(i)); return o; };

        if (this._verified[dir] && this._verified[dir].length) {
            return this._verified[dir].slice();
        }
        if (this._pageCache[dir] && !this._verified[dir]) {
            // 快取只當「起點」，回傳前一定要驗證：
            // 舊版探測曾把 CDN 的 82 字節佔位圖當成真圖，偏大的頁數已被
            // 持久化 → 直接回傳就會給出「超出真實結尾」的頁面 → 下載 404
            // （閱讀器有 fallback 能忍，下載器一錯就整條失敗）。
            const cached = this._pageCache[dir];
            const lastOk = await exists(cached);
            if (lastOk === true) {
                const nextGone = await exists(cached + 1);
                // 只有「下一頁也連續不存在」才相信快取；否則丟掉重探
                //（單頁缺失可能只是抖動，重探會給出正確的完整清單）
                const nextGone2 = nextGone === false ? await exists(cached + 2) : null;
                if (nextGone === false && nextGone2 === false) {
                    this._verified[dir] = build(cached);
                    this._pageCache[dir] = cached;
                    return this._verified[dir].slice();
                }
            }
            // 校驗不通過：丟掉舊快取，走完整探測
            delete this._pageCache[dir];
        }

        // v2.31.2（用戶要求）：每一章都當成全新章節 → 一律從第 1 頁開始探測。
        // 舊版會拿「本章封面圖的頁碼」當起點（例：封面是第 68 頁就從 68 開始），
        // 但封面頁碼可能大於實際總頁數（人工上傳的章節很常見）→ 探測起點錯誤
        // 就會找不到真正的末頁。改成一律從 1 開始，只往後推。
        // 封面頁碼（coverPage）不使用；每章一律從第 1 頁重新探測

        // v2.33.0（用戶建議的優化）：
        // 第一輪：一次並行探 1,25,50,75,…,maxPages（步長 25，最多十幾個請求）
        //         → 找出最後一個「存在」的頁碼 lastOk
        // 第二輪：在 (lastOk, lastOk+25) 這個小區間內【一次全部並行】探完
        // 兩輪就定位到真實末頁，比舊版「多輪二分」快好幾倍。
        const stride = 25;
        const grid = [];
        for (let n = 1; n <= maxPages; n += stride) grid.push(n);
        if (grid[grid.length - 1] !== maxPages) grid.push(maxPages);
        const gridRes = await Promise.all(grid.map((n) => exists(n)));
        let lastOk = 0;
        for (let k = 0; k < grid.length; k++) {
            if (gridRes[k] === true) {
                lastOk = grid[k];
            } else if (gridRes[k] === false && lastOk > 0) {
                break;   // 已經明確越過末頁，不必再往後看
            }
        }
        if (lastOk < 1) lastOk = 1;
        const hiBase = Math.min(lastOk + stride, maxPages + 1);
        const inner = [];
        for (let n = lastOk + 1; n < hiBase; n++) inner.push(n);
        if (inner.length) {
            const innerRes = await Promise.all(inner.map((n) => exists(n)));
            for (let k = 0; k < innerRes.length; k++) {
                if (innerRes[k] === true) lastOk = inner[k];
            }
        }
        let lo = lastOk;
        if (lo < 1) lo = 1;

        // ===== v2.27.0 修正：頁數寧可多算，絕不少算 =====
        // 舊版會把「探測失敗的頁」從清單中刪掉 —— 但探測失敗多半只是 CDN
        // 抖動（或 429 限流），刪一頁會讓它之後的所有頁整章錯位（用戶反饋：
        // 第153話之後圖片順序完全混亂）。現在改成：
        //   1) 二分之後再向後多探 5 頁，確認真的到底；
        //   2) 只有【連續兩頁】都明確不存在，才承認 lo 是最後一頁；
        //   3) 任何探測失敗都不再刪頁（個別頁真的壞了，由 resolvePageUrl
        //      逐頁換線路/換擴展名處理，或閱讀器重試）。
        let scan = lo;
        for (let k = 0; k < 5; k++) {
            let e = await exists(scan + 1);
            if (e === true) { scan = scan + 1; continue; }
            break;
        }
        {
            const e1 = await exists(scan + 1);
            const e2 = e1 === false ? await exists(scan + 2) : null;
            if (e1 === true || (e1 === null && e2 === true)) {
                // 真的還有 → 逐步往後推到邊界
                let cursor = scan + 1;
                for (let k = 0; k < 10; k++) {
                    let e = await exists(cursor);
                    if (e === true) { cursor = cursor + 1; continue; }
                    break;
                }
                scan = Math.max(scan, cursor - 1);
            } else if (e1 === false && e2 === false) {
                // 連續兩頁缺失 → 確認到底
            } else if (e1 === false && e2 !== false) {
                // 第一頁缺失但下一頁還在（可疑）→ 保守多算一頁
                scan = scan + 1;
            }
        }
        lo = scan;
        // v2.33.3：有些章節的頁碼不是從 1 開始（實測某日漫第1~4頁是 404，
        // 第 5 頁才開始）→ 舊版固定從 1 開始，第一張圖就 404，閱讀器卡死。
        // 這裡往前探 1~10 頁，找出第一張真正存在的頁當起點。
        let firstOk = 1;
        {
            const head = [];
            const headMax = Math.min(10, lo);
            for (let n = 1; n <= headMax; n++) head.push(n);
            const headRes = await Promise.all(head.map((n) => exists(n)));
            let found = 0;
            for (let k = 0; k < headRes.length; k++) {
                if (headRes[k] === true) { found = head[k]; break; }
            }
            if (found > 0) firstOk = found;
        }
        let valid = [];
        for (let i = firstOk; i <= lo; i++) valid.push(i);
        this._pageCache[dir] = lo;
        this.persistPages();
        this.scheduleVerify(dir, ext, lo);
        // 背景預取下一話（fire-and-forget，不阻塞本次回傳）
        try { this.warmNext(comicId, epId); } catch (e) {}
        let imgs = [];
        for (let i of valid) imgs.push(url(i));
        return imgs;
    // 背景預取下一話（fire-and-forget，不影響本次回傳）
    // 放在這裡而不是 loadEp 開頭，是為了讓「當前章節」優先拿到結果。
    }

    scheduleVerify(dir, ext, total) {
        if (this._verified[dir]) return;
        let self = this;
        try {
            setTimeout(() => {
                self.verifyAllPages(dir, ext, total);
            }, 700);
        } catch (e) {}
    }

    // 逐頁解析：找出「這一頁」真實可用的 URL（哪條線路 + 哪個擴展名）
    // 目的：不因某條 CDN 缺頁就丟掉該頁，改為到其他線路/擴展名上找到它
    async resolvePageUrl(dir, ext, i) {
        const exts = [];
        for (let e of [ext, "jpg", "webp", "jpeg", "png"]) {
            if (e && exts.indexOf(e) < 0) exts.push(e);
        }
        const headers = {
            "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
            "Range": "bytes=0-0",
        };
        const ok = async (u) => {
            try {
                let r = await Network.sendRequest("GET", u, headers);
                if (r.status === 206) return true;         // Range 命中 = 真圖
                if (r.status !== 200) return false;
                // 200：可能是占位小圖，用長度判斷（<1KB 視為無效）
                let len = 0;
                try {
                    let h = r.headers || {};
                    let raw = h["content-length"] || h["Content-Length"] ||
                              (h["Content-Length"] === undefined ? undefined : h["Content-Length"]);
                    if (raw !== undefined) len = parseInt(raw, 10) || 0;
                } catch (e) {}
                if (!len && r.body) len = r.body.length;
                return len >= 1024;
            } catch (e) {
                return false;
            }
        };
        // 先直連線路 × 各擴展名
        for (let li = 0; li < Lizimh.lines.length; li++) {
            if (Lizimh.lines[li].proxy) continue;
            for (let e of exts) {
                let u = this.lineAbs(dir + "/" + i + "." + e, li);
                if (await ok(u)) return u;
            }
        }
        // 再用代理線路兜底
        for (let li = 0; li < Lizimh.lines.length; li++) {
            if (!Lizimh.lines[li].proxy) continue;
            for (let e of exts) {
                let u = this.lineAbs(dir + "/" + i + "." + e, li);
                if (await ok(u)) return u;
            }
        }
        return null;
    }

    // 逐頁解析全章（6 並行），得到「每頁都能用」的完整 URL 清單並持久化
    async verifyAllPages(dir, ext, total) {
        try {
            let urls = [];
            let missing = [];
            const B = 6;
            for (let start = 1; start <= total; start += B) {
                const chunk = [];
                for (let i = start; i < start + B && i <= total; i++) chunk.push(i);
                const res = await Promise.all(
                    chunk.map((i) => this.resolvePageUrl(dir, ext, i))
                );
                for (let k = 0; k < chunk.length; k++) {
                    if (res[k]) urls.push(res[k]);
                    else missing.push(chunk[k]);
                }
                await this.sleep(40);
            }
            this._verified[dir] = urls;
            this.persistVerified();
            if (missing.length) {
                console.log("[lizimh] " + dir + " 有 " + missing.length +
                    " 頁在所有線路都找不到: " + missing.slice(0, 12).join(","));
            } else {
                console.log("[lizimh] " + dir + " 全 " + urls.length + " 頁解析完成（無缺頁）");
            }
        } catch (e) {}
    }

    persistVerified() {
        try {
            let n = 0, obj = {};
            for (let k in this._verified) { obj[k] = this._verified[k]; if (++n > 60) break; }
            this.saveData("verifiedPages", JSON.stringify(obj));
        } catch (e) {}
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    comic = {
        commentProviderSetting: 'commentProviderV2',
        chapterCommentCapabilities: (() => {
            const s=this, caps={};
            for (const k of ['sorts','defaultSort','canLoadReplies','canSend','canLike','enabled']) Object.defineProperty(caps,k,{enumerable:true,get(){if (!s._commentProviders) s._commentProviders=new LiziCommentProviders(s); return s._commentProviders.capabilities(false)[k];}});
            return caps;
        })(),
        commentCapabilities: (() => {
            const s=this, caps={};
            for (const k of ['sorts','defaultSort','canLoadReplies','canSend','canLike','enabled']) Object.defineProperty(caps,k,{enumerable:true,get(){if (!s._commentProviders) s._commentProviders=new LiziCommentProviders(s); return s._commentProviders.capabilities(true)[k];}});
            return caps;
        })(),
        loadCommentsWithOptions: async (comicId,subId,page,replyTo,options) => {
            if (!this._commentProviders) this._commentProviders=new LiziCommentProviders(this);
            return this._commentProviders.load(true,comicId,subId,page,replyTo,options);
        },
        loadChapterCommentsWithOptions: async (comicId,epId,page,replyTo,options) => {
            if (!this._commentProviders) this._commentProviders=new LiziCommentProviders(this);
            return this._commentProviders.load(false,comicId,epId,page,replyTo,options);
        },
        loadComments: async (comicId,subId,page,replyTo) => this.comic.loadCommentsWithOptions(comicId,subId,page,replyTo,null),
        loadChapterComments: async (comicId,epId,page,replyTo) => this.comic.loadChapterCommentsWithOptions(comicId,epId,page,replyTo,null),

        loadChapterMetadata: async (comicId, chapterIds) => {
            if (!this._chapterMetadataProvider) this._chapterMetadataProvider = new LiziChapterMetadata(this);
            return this._chapterMetadataProvider.load(comicId, chapterIds);
        },

        loadInfo: async (id) => {
            id = String(id);
            if (this._chapterInfoFlights[id]) return this._chapterInfoFlights[id];
            const infoFlight = (async () => {
            let data = await Lizimh.getJson(`/app/api/v2/detail/${id}`);
            let chapters = {};
            let covers = {};
            let chapterCovers = {};
            let chapterMetadata = {};
            // v2.33.4 關鍵修正：章節 key 必須是「章節序號」，不能是章節 id。
            // ECMAScript 規定物件 key 只要是整數字串，列舉時一律按【數值升序】，
            // 插入順序完全無效 —— 用章節 id 當 key 時，後期補上/重傳的章節
            // （id 比前後都大）會被自動搬到後面，造成章節清單亂序。
            // 實測「魔皇大管家」：原順序 72,73,74… 變成 72,74,…,85,
            // 《通知》,89,91,[73,83,86,87,88,90],92…（正是使用者看到的樣子）
            const numOf = (ch) => {
                let o = parseInt(ch.order);
                if (isFinite(o) && o > 0) return o;
                const m = String(ch.name || "").match(/第\s*(\d+)\s*[话話]/);
                return m ? parseInt(m[1]) : 0;
            };
            let raw = (data.chapters || []).slice();
            raw.sort((a, b) => (numOf(a) || 1e9) - (numOf(b) || 1e9));
            let order = [];
            let epMap = {};
            let coverById = {};
            let prevOrder = 0;
            // 章節封面：源站每個章節都帶一張「該章內頁」路徑（如 /2/58342/2202527/25.jpg），
            // 直接拿它當封面（就是漫畫裡的一張圖）。沒有 cover 的章節沿用最近一張，
            // 這樣「無論如何都有封面」而不是空白 —— 但載入內頁用的 covers 只放真正屬於
            // 該章的路徑，避免探測到別章的目錄。
            let lastCover = "";
            for (let ch of raw) {
                let o = numOf(ch);
                if (!o || o <= prevOrder) o = prevOrder + 1; // key 唯一且嚴格遞增
                prevOrder = o;
                let key = String(o);
                let chId = String(ch.id);
                epMap[key] = chId;
                coverById[chId] = ch.cover || "";
                chapters[key] = ch.name || `第${o}话`;
                // Lizi chapter creation/ingestion date, not Tencent publication date.
                if (typeof ch.created_at === "string" && ch.created_at) {
                    chapterMetadata[key] = { updateTime: ch.created_at, dateSource: "lizi" };
                }
                if (ch.cover) {
                    covers[key] = ch.cover;
                    lastCover = ch.cover;
                }
                if (lastCover) chapterCovers[key] = this.abs(lastCover);
                order.push(key);
            }
            this._epMap[String(id)] = epMap;
            this._coverById[String(id)] = coverById;
            this._coverCache[String(id)] = covers;
            this._orderCache[String(id)] = order;
            let lastIso = raw.length ? raw[raw.length - 1].created_at : "";
            let tags = {
                "作者": (data.author || "").split(",").filter((t) => t),
                "标签": (data.tags || "").split(",").filter((t) => t),
                "状态": [Lizimh.statusByLastUpdate(lastIso)],
            };
            if (data.score && Number(data.score) > 0) tags["评分"] = ["评分" + data.score];

            const details = new ComicDetails({
                title: data.name || "",
                cover: this.abs(data.picY || data.picX),
                description: data.content || "",
                tags: tags,
                chapters: chapters,
                chapterCovers: chapterCovers,
                chapterMetadata: chapterMetadata,
                stars: data.score ? Number(data.score) : null,
                updateTime: lastIso ? Lizimh.fmtDate(lastIso) : null,
            });
            this._chapterInfoCache[id] = details;
            return details;
            })();
            this._chapterInfoFlights[id] = infoFlight;
            infoFlight.then(() => { if (this._chapterInfoFlights[id] === infoFlight) delete this._chapterInfoFlights[id]; }, () => { delete this._chapterInfoFlights[id]; });
            return infoFlight;
        },

        loadEp: async (comicId, epId) => {
            // A restored reader may load a chapter before loadInfo has run in
            // this source instance. Rebuild the mapping before resolving it.
            if (!this._epMap[String(comicId)]) {
                await this.comic.loadInfo(comicId);
            }
            // v2.33.4：epId 現在是章節序號，先換回真正章節 id
            const chId = this.resolveEp(comicId, epId);
            // v2.29.0：設定了官方憑證 → 直接用官方順序（最準，解決亂序章節）
            try {
                const official = await this.officialPics(chId);
                if (official && official.length) {
                    try { this.warmNext(comicId, epId); } catch (e) {}
                    return { images: official };
                }
            } catch (e) {}
            let covers = await this.chapterCovers(comicId);
            let cover = covers[String(epId)];
            if (!cover) {
                const byId = this._coverById[String(comicId)] || {};
                cover = byId[chId] || null; // 舊 epId（章節 id）的回退
            }
            if (!cover) throw new Error("找不到该章节的图片路径");
            // 形如 /102/58342/2fd5.../6c4b.../97.webp 或 /2/59726/2770805/16.jpg
            let m = String(cover).match(/^(.*)\/(\d+)\.([A-Za-z0-9]+)$/);
            if (!m) throw new Error("章节路径格式异常: " + cover);
            let dir = m[1], ext = m[3], coverPage = parseInt(m[2]) || 1;
            let maxPages = 300;
            try { maxPages = parseInt(this.loadSetting("maxPages") || "300"); } catch (e) {}
            let images = await this.probePages(dir, ext, maxPages, coverPage);
            if (!images.length) throw new Error("该章节图片探测失败");
            let line = this.currentLine();
            for (let u of images) {
                this._imgLine[u] = line;
                this._imgPath[u] = u.substring(Lizimh.lines[line].url.length);
            }
            return { images: images };
        },

        onImageLoad: (url, comicId, epId) => {
            let self = this;
            return {
                headers: {
                    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
                },
                onLoadFailed: () => {
                    let alt = self.nextLineUrl(url);
                    if (!alt) return undefined;
                    return { url: alt };
                },
            };
        },
        onThumbnailLoad: (url) => { return {}; },
    };
}

// Offline generated; authorized fixed public-app protocol material, not account credentials.
// Original SHA256: c2a91505f9b4b8071c0039edb1b096d6542a74dc6e77384f189f85c264778ea3; Unicode 15.0.0 Cc/Cf.
const TencentChapterCrypto = (() => {
const MATERIAL = {"suffix": "4jo2YHMm0d2VGt59tVYndX9P7eFcw8TvRv5lMqFP1TT", "responseKey": [52, 50, 101, 48, 100, 53, 56, 55, 100, 53, 98, 100, 97, 52, 49, 51, 50, 54, 99, 50, 48, 48, 48, 100], "metadata": {"DEVICETYPE": "iphone", "MODEL": "unknow", "NETWORK": "*g"}};
const CONTROLS = [[0, 31], [127, 159], [173, 173], [1536, 1541], [1564, 1564], [1757, 1757], [1807, 1807], [2192, 2193], [2274, 2274], [6158, 6158], [8203, 8207], [8234, 8238], [8288, 8292], [8294, 8303], [65279, 65279], [65529, 65531], [69821, 69821], [69837, 69837], [78896, 78911], [113824, 113827], [119155, 119162], [917505, 917505], [917536, 917631]];
// Original implementation of the public DES standard (FIPS 46-3), MIT license.
const IP=[58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
const FP=[40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26,33,1,41,9,49,17,57,25];
const E=[32,1,2,3,4,5,4,5,6,7,8,9,8,9,10,11,12,13,12,13,14,15,16,17,16,17,18,19,20,21,20,21,22,23,24,25,24,25,26,27,28,29,28,29,30,31,32,1];
const P=[16,7,20,21,29,12,28,17,1,15,23,26,5,18,31,10,2,8,24,14,32,27,3,9,19,13,30,6,22,11,4,25];
const PC1=[57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,63,55,47,39,31,23,15,7,62,54,46,38,30,22,14,6,61,53,45,37,29,21,13,5,28,20,12,4];
const PC2=[14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
const SHIFTS=[1,1,2,2,2,2,2,2,1,2,2,2,2,2,2,1];
const S=[
[14,4,13,1,2,15,11,8,3,10,6,12,5,9,0,7,0,15,7,4,14,2,13,1,10,6,12,11,9,5,3,8,4,1,14,8,13,6,2,11,15,12,9,7,3,10,5,0,15,12,8,2,4,9,1,7,5,11,3,14,10,0,6,13],
[15,1,8,14,6,11,3,4,9,7,2,13,12,0,5,10,3,13,4,7,15,2,8,14,12,0,1,10,6,9,11,5,0,14,7,11,10,4,13,1,5,8,12,6,9,3,2,15,13,8,10,1,3,15,4,2,11,6,7,12,0,5,14,9],
[10,0,9,14,6,3,15,5,1,13,12,7,11,4,2,8,13,7,0,9,3,4,6,10,2,8,5,14,12,11,15,1,13,6,4,9,8,15,3,0,11,1,2,12,5,10,14,7,1,10,13,0,6,9,8,7,4,15,14,3,11,5,2,12],
[7,13,14,3,0,6,9,10,1,2,8,5,11,12,4,15,13,8,11,5,6,15,0,3,4,7,2,12,1,10,14,9,10,6,9,0,12,11,7,13,15,1,3,14,5,2,8,4,3,15,0,6,10,1,13,8,9,4,5,11,12,7,2,14],
[2,12,4,1,7,10,11,6,8,5,3,15,13,0,14,9,14,11,2,12,4,7,13,1,5,0,15,10,3,9,8,6,4,2,1,11,10,13,7,8,15,9,12,5,6,3,0,14,11,8,12,7,1,14,2,13,6,15,0,9,10,4,5,3],
[12,1,10,15,9,2,6,8,0,13,3,4,14,7,5,11,10,15,4,2,7,12,9,5,6,1,13,14,0,11,3,8,9,14,15,5,2,8,12,3,7,0,4,10,1,13,11,6,4,3,2,12,9,5,15,10,11,14,1,7,6,0,8,13],
[4,11,2,14,15,0,8,13,3,12,9,7,5,10,6,1,13,0,11,7,4,9,1,10,14,3,5,12,2,15,8,6,1,4,11,13,12,3,7,14,10,15,6,8,0,5,9,2,6,11,13,8,1,4,10,7,9,5,0,15,14,2,3,12],
[13,2,8,4,6,15,11,1,10,9,3,14,5,0,12,7,1,15,13,8,10,3,7,4,12,5,6,11,0,14,9,2,7,11,4,1,9,12,14,2,0,6,10,13,15,3,5,8,2,1,14,7,4,10,8,13,15,12,9,0,3,5,6,11]
];
function fail(code) { throw new Error('TencentChapterCrypto:' + code); }
function perm(a,t) { return t.map(i => a[i-1]); }
function bits(bytes) { const r=[]; for(const b of bytes) for(let i=7;i>=0;i--) r.push((b>>i)&1); return r; }
function schedule(key) {
 let k=perm(bits(key),PC1),c=k.slice(0,28),d=k.slice(28),r=[];
 for(const n of SHIFTS) { c=c.slice(n).concat(c.slice(0,n)); d=d.slice(n).concat(d.slice(0,n)); r.push(perm(c.concat(d),PC2)); }
 return r;
}
// Byte permutation and combined S/P tables are private and built once.
function permutationTables(table) {
 const out=[];
 for(let byte=0;byte<8;byte++) {
  const hi=new Int32Array(256),lo=new Int32Array(256);
  for(let value=0;value<256;value++) for(let bit=0;bit<64;bit++) {
   const input=table[bit]-1;
   if((input>>3)===byte && ((value>>(7-(input&7)))&1)) {
    if(bit<32) hi[value]|=1<<(31-bit);else lo[value]|=1<<(63-bit);
   }
  }
  out.push(hi,lo);
 }
 return out;
}
const IPT=permutationTables(IP),FPT=permutationTables(FP),SP=[];
for(let box=0;box<8;box++) {
 const t=new Int32Array(64);
 for(let six=0;six<64;six++) {
  const row=((six&32)>>4)|(six&1),column=(six>>1)&15;
  const v=S[box][row*16+column]<<(28-box*4);
  for(let bit=0;bit<32;bit++) if((v>>>(32-P[bit]))&1) t[six]|=1<<(31-bit);
 }
 SP.push(t);
}
function compact(keys) {return keys.map(bits=>{const out=[];for(let i=0;i<48;i+=6){let v=0;for(let j=0;j<6;j++)v=v*2+bits[i+j];out.push(v);}return out;});}
const schedules=[compact(schedule(MATERIAL.responseKey.slice(16,24)).reverse()),compact(schedule(MATERIAL.responseKey.slice(8,16))),compact(schedule(MATERIAL.responseKey.slice(0,8)).reverse())];
function decryptRange(ct,out,start,end) {
 for(let p=start;p<end;p+=8) {
  let l=0,r=0;
  for(let b=0;b<8;b++){l^=IPT[b*2][ct[p+b]];r^=IPT[b*2+1][ct[p+b]];}
  for(let stage=0;stage<3;stage++) {
   const keys=schedules[stage];
   for(let round=0;round<16;round++) {
    const k=keys[round];
    const f=SP[0][((r>>>27)|(r<<5))&63^k[0]] ^ SP[1][(r>>>23)&63^k[1]] ^
     SP[2][(r>>>19)&63^k[2]] ^ SP[3][(r>>>15)&63^k[3]] ^
     SP[4][(r>>>11)&63^k[4]] ^ SP[5][(r>>>7)&63^k[5]] ^
     SP[6][(r>>>3)&63^k[6]] ^ SP[7][((r<<1)|(r>>>31))&63^k[7]];
    const next=l^f;l=r;r=next;
   }
   const swap=l;l=r;r=swap;
  }
  let hi=0,lo=0;
  for(let b=0;b<8;b++) {const value=b<4?(l>>>(24-b*8))&255:(r>>>(56-b*8))&255;hi^=FPT[b*2][value];lo^=FPT[b*2+1][value];}
  for(let b=0;b<4;b++){out[p+b]=(hi>>>(24-b*8))&255;out[p+4+b]=(lo>>>(24-b*8))&255;}
 }
}
function unpad(out) {
 const n=out[out.length-1];if(n<1||n>8||n>out.length) fail('padding');
 for(let i=out.length-n;i<out.length;i++) if(out[i]!==n) fail('padding');
 return out.subarray(0,out.length-n);
}
function base64(s) {
 if(typeof s!=='string') fail('base64');
 if(s.length>2*1024*1024) fail('size');
 s=s.replace(/[\x09-\x0d\x20]/g,'');
 if(!s.length||s.length%4||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(s)) fail('base64');
 const alpha='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/',padding=s.endsWith('==')?2:s.endsWith('=')?1:0;
 if(padding===2&&(alpha.indexOf(s[s.length-3])&15)) fail('base64');
 if(padding===1&&(alpha.indexOf(s[s.length-2])&3)) fail('base64');
 const out=new Uint8Array(s.length/4*3-padding);let p=0;
 for(let i=0;i<s.length;i+=4) { const n=(alpha.indexOf(s[i])<<18)|(alpha.indexOf(s[i+1])<<12)|((s[i+2]==='='?0:alpha.indexOf(s[i+2]))<<6)|(s[i+3]==='='?0:alpha.indexOf(s[i+3])); for(let j=16;j>=0&&p<out.length;j-=8) out[p++]=(n>>j)&255; }
 if(!out.length||out.length%8) fail('block'); return out;
}
function utf8(bytes) {
 const chunks=[];let piece='';
 for(let i=0;i<bytes.length;) {
  const a=bytes[i++];let cp=a,n=0,min=0;
  if(a>=0xc2&&a<=0xdf) {cp=a&31;n=1;min=0x80;}
  else if(a>=0xe0&&a<=0xef) {cp=a&15;n=2;min=0x800;}
  else if(a>=0xf0&&a<=0xf4) {cp=a&7;n=3;min=0x10000;}
  else if(a>0x7f) fail('utf8');
  if(i+n>bytes.length) fail('utf8');
  for(let j=0;j<n;j++) {const b=bytes[i++];if((b&0xc0)!==0x80) fail('utf8');cp=(cp<<6)|(b&63);}
  if(cp<min||cp>0x10ffff||(cp>=0xd800&&cp<=0xdfff)) fail('utf8');
  let control=false;for(const pair of CONTROLS) {if(cp<pair[0]) break;if(cp<=pair[1]) {control=true;break;}}
  if(!control) piece+=String.fromCodePoint(cp);
  if(piece.length>=4096) {chunks.push(piece);piece='';}
 }
 chunks.push(piece);return chunks.join('');
}
function checkString(s) {
 if(typeof s!=='string') fail('sign_input');
 for(let i=0;i<s.length;i++) {const c=s.charCodeAt(i);if(c>=0xd800&&c<=0xdbff) {const d=s.charCodeAt(++i);if(!(d>=0xdc00&&d<=0xdfff)) fail('sign_input');} else if(c>=0xdc00&&c<=0xdfff) fail('sign_input');}
}
class TencentChapterCrypto {
 static metadata() { return Object.assign({}, MATERIAL.metadata); }
 // Strings are signed verbatim: no re-encoding, case folding, time formatting, or defaults.
 static sign(path,host,fakeduin,qimei,localtime) {
  for(const v of [path,host,fakeduin,qimei,localtime]) checkString(v);
  try {
   const hash=Convert.hexEncode(Convert.md5(Convert.encodeUtf8(path+host+fakeduin+qimei+localtime+MATERIAL.suffix)));
   if(typeof hash!=='string'||!/^[0-9a-fA-F]{32}$/.test(hash)) fail('md5_host');
   return hash.toLowerCase();
  } catch(_) { fail('md5_host'); }
 }
 static decode(wire) {
  const ct=base64(wire),out=new Uint8Array(ct.length);decryptRange(ct,out,0,ct.length);
  const text=utf8(unpad(out));
  try {return JSON.parse(text);} catch(_) { fail('json'); }
 }
 static async decodeAsync(wire) {
  if(typeof wire!=='string') fail('base64');
  if(wire.length>100000) fail('size');
  const wireParts=[];
  for(let p=0;p<wire.length;p+=128) {
   wireParts.push(wire.slice(p,p+128).replace(/[\x09-\x0d\x20]/g,''));
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  wire=wireParts.join('');
  if(!wire.length||wire.length%4) fail('base64');
  const parts=[];let length=0;
  for(let p=0;p<wire.length;p+=128) {
   const end=Math.min(p+128,wire.length),part=wire.slice(p,end);
   if(end<wire.length&&part.indexOf('=')!==-1) fail('base64');
   const bytes=base64(part);parts.push(bytes);length+=bytes.length;
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(length>65536) fail('size');
  const ct=new Uint8Array(length);let offset=0;for(const part of parts){ct.set(part,offset);offset+=part.length;}
  const out=new Uint8Array(ct.length);
  // Eight blocks per turn; bounded work without thousands of per-block host timers.
  for(let p=0;p<ct.length;p+=64) {
   decryptRange(ct,out,p,Math.min(p+64,ct.length));
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  const bytes=unpad(out),pieces=[];
  // UTF-8 chunks end at code-point boundaries, with controls removed per chunk.
  for(let p=0;p<bytes.length;) {
   let end=Math.min(p+64,bytes.length);
   while(end<bytes.length&&(bytes[end]&0xc0)===0x80) end++;
   pieces.push(utf8(bytes.subarray(p,end)));p=end;
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  try {return JSON.parse(pieces.join(''));} catch(_) { fail('json'); }
 }
 // Independent bounded catalog path: larger payload, cooperative chunks.
 static async decodeCatalogAsync(wire) {
  if(typeof wire!=='string') fail('base64');
  if(wire.length>2097152) fail('size');
  const wireParts=[];
  for(let p=0;p<wire.length;p+=4096) {
   wireParts.push(wire.slice(p,p+4096).replace(/[\x09-\x0d\x20]/g,''));
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  wire=wireParts.join('');
  if(!wire.length||wire.length%4) fail('base64');
  const parts=[];let length=0;
  for(let p=0;p<wire.length;p+=4096) {
   const end=Math.min(p+4096,wire.length),part=wire.slice(p,end);
   if(end<wire.length&&part.indexOf('=')!==-1) fail('base64');
   const bytes=base64(part);parts.push(bytes);length+=bytes.length;
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  if(length>1572864) fail('size');
  const ct=new Uint8Array(length);let offset=0;for(const part of parts){ct.set(part,offset);offset+=part.length;}
  const out=new Uint8Array(ct.length);
  // Eight blocks per turn; bounded work without thousands of per-block host timers.
  for(let p=0;p<ct.length;p+=512) {
   decryptRange(ct,out,p,Math.min(p+512,ct.length));
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  const bytes=unpad(out),pieces=[];
  // UTF-8 chunks end at code-point boundaries, with controls removed per chunk.
  for(let p=0;p<bytes.length;) {
   let end=Math.min(p+2048,bytes.length);
   while(end<bytes.length&&(bytes[end]&0xc0)===0x80) end++;
   pieces.push(utf8(bytes.subarray(p,end)));p=end;
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  try {return JSON.parse(pieces.join(''));} catch(_) { fail('json'); }
 }
}

return TencentChapterCrypto;
})();

/* Vendored opencc-js 1.0.5 dist/umd/t2cn.js. UMD shell replaced with private IIFE.
MIT License

Copyright (c) 2020-2021 The nk2028 Project

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const LiziCommentTitleConverter = (() => {
 const exports = {};


  /**
   * 字典，範例："a alpha|b beta" 或 [["a", "alpha"], ["b", "beta"]]
   * @typedef {string|string[][]} DictLike
   */

  /**
   * 字典群組
   * @typedef {DictLike[]} DictGroup
   */

  /**
   * 地區設定資料
   * @typedef {object} LocalePreset
   * @property {object.<string, DictGroup>} from
   * @property {object.<string, DictGroup>} to
   */

  /**
   * Trie 樹。
   */
   class Trie {
    // 使用 Map 實作 Trie 樹
    // Trie 的每個節點為一個 Map 物件
    // key 為 code point，value 為子節點（也是一個 Map）。
    // 如果 Map 物件有 trie_val 屬性，則該屬性為值字串，代表替換的字詞。

    constructor() {
      this.map = new Map();
    }

    /**
     * 將一項資料加入字典樹
     * @param {string} s 要匹配的字串
     * @param {string} v 若匹配成功，則替換為此字串
     */
    addWord(s, v) {
      let { map } = this;
      for (const c of s) {
        const cp = c.codePointAt(0);
        const nextMap = map.get(cp);
        if (nextMap == null) {
          const tmp = new Map();
          map.set(cp, tmp);
          map = tmp;
        } else {
          map = nextMap;
        }
      }
      map.trie_val = v;
    }

    /**
       * 讀取字典資料
       * @param {DictLike} d 字典
       */
    loadDict(d) {
      if (typeof d === 'string') {
        d = d.split('|');
        for (const line of d) {
          const [l, r] = line.split(' ');
          this.addWord(l, r);
        }
      } else {
        for (let arr of d) {
          const [l, r] = arr;
          this.addWord(l, r);
        }
      }
    }

    /**
     * 讀取多個字典資料
     * @param {DictLike[]} arr 字典
     */
    loadDictGroup(arr) {
      arr.forEach(d => {
        this.loadDict(d);
      });
    }

    /**
     * 根據字典樹中的資料轉換字串。
     * @param {string} s 要轉換的字串
     */
    convert(s) {
      const t = this.map;
      const n = s.length, arr = [];
      let orig_i;
      for (let i = 0; i < n;) {
        let t_curr = t, k = 0, v;
        for (let j = i; j < n;) {
          const x = s.codePointAt(j);
          j += x > 0xffff ? 2 : 1;

          const t_next = t_curr.get(x);
          if (typeof t_next === 'undefined') {
            break;
          }
          t_curr = t_next;

          const v_curr = t_curr.trie_val;
          if (typeof v_curr !== 'undefined') {
            k = j;
            v = v_curr;
          }
        }
        if (k > 0) { // 有替代
          if (orig_i !== null) {
            arr.push(s.slice(orig_i, i));
            orig_i = null;
          }
          arr.push(v);
          i = k;
        } else { // 無替代
          if (orig_i === null) {
            orig_i = i;
          }
          i += s.codePointAt(i) > 0xffff ? 2 : 1;
        }
      }
      if (orig_i !== null) {
        arr.push(s.slice(orig_i, n));
      }
      return arr.join('');
    }
  }

  /**
   * Create a OpenCC converter
   * @param  {...DictGroup} dictGroup
   * @returns The converter that performs the conversion.
   */
  function ConverterFactory(...dictGroups) {
    const trieArr = dictGroups.map(grp => {
      const t = new Trie();
      t.loadDictGroup(grp);
      return t;
    });
    /**
     * The converter that performs the conversion.
     * @param {string} s The string to be converted.
     * @returns {string} The converted string.
     */
    function convert(s) {
      return trieArr.reduce((res, t) => {
        return t.convert(res);
      }, s);
    }
    return convert;
  }

  /**
   * Build Converter function with locale data
   * @param {LocalePreset} localePreset
   * @returns Converter function
   */
  function ConverterBuilder(localePreset) {
    return function Converter(options) {
      let dictGroups = [];
      ['from', 'to'].forEach(type => {
        if (typeof options[type] !== 'string') {
          throw new Error('Please provide the `' + type + '` option');
        }
        if (options[type] !== 't') {
          dictGroups.push(localePreset[type][options[type]]);
        }
      });
      return ConverterFactory.apply(null, dictGroups);
    }
  }

  /**
   * Create a custom converter.
   * @param {string[][]} dict The dictionary to be used for conversion.
   * @returns The converter that performs the conversion.
   */
  function CustomConverter(dict) {
    return ConverterFactory([dict]);
  }

  /**
   * Create a HTML page converter.
   * @param {(s: string) => string} converter The converter that performs the conversion.
   * @param {HTMLElement} rootNode The root node for recursive conversions.
   * @param {string} fromLangTag The lang tag to be converted.
   * @param {string} toLangTag The lang tag of the conversion result.
   * @returns The HTML page converter.
   */
  function HTMLConverter(converter, rootNode, fromLangTag, toLangTag) {
    /**
     * Perform the conversion on the page.
     */
    function convert() {
      function inner(currentNode, langMatched) {
        /* class list 包含 ignore-opencc 的元素會跳過後續的轉換 */
        if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.classList.contains('ignore-opencc')) return;

        if (currentNode.lang === fromLangTag) {
          langMatched = true;
          currentNode.shouldChangeLang = true; // 記住 lang 屬性被修改了，以便恢復
          currentNode.lang = toLangTag;
        } else if (currentNode.lang && currentNode.lang.length) {
          langMatched = false;
        }

        if (langMatched) {
          /* Do not convert these elements */
          if (currentNode.tagName === 'SCRIPT') return;
          if (currentNode.tagName === 'STYLE') return;

          /* 處理特殊屬性 */
          if (currentNode.tagName === 'META' && currentNode.name === 'description') {
            if (currentNode.originalContent == null) {
              currentNode.originalContent = currentNode.content;
            }
            currentNode.content = converter(currentNode.originalContent);
          } else if (currentNode.tagName === 'META' && currentNode.name === 'keywords') {
            if (currentNode.originalContent == null) {
              currentNode.originalContent = currentNode.content;
            }
            currentNode.content = converter(currentNode.originalContent);
          } else if (currentNode.tagName === 'IMG') {
            if (currentNode.originalAlt == null) {
              currentNode.originalAlt = currentNode.alt;
            }
            currentNode.alt = converter(currentNode.originalAlt);
          } else if (currentNode.tagName === 'INPUT' && currentNode.type === 'button') {
            if (currentNode.originalValue == null) {
              currentNode.originalValue = currentNode.value;
            }
            currentNode.value = converter(currentNode.originalValue);
          }
        }

        for (const node of currentNode.childNodes) {
          if (node.nodeType === Node.TEXT_NODE && langMatched) {
            if (node.originalString == null) {
              node.originalString = node.nodeValue; // 存儲原始字串，以便恢復
            }
            node.nodeValue = converter(node.originalString);
          } else {
            inner(node, langMatched);
          }
        }
      }
      inner(rootNode, false);
    }

    /**
     * Restore the page to the state before the conversion.
     */
    function restore() {
      function inner(currentNode) {
        /* class list 包含 ignore-opencc 的元素會跳過後續的轉換 */
        if (currentNode.nodeType === Node.ELEMENT_NODE && currentNode.classList.contains('ignore-opencc')) return;

        if (currentNode.shouldChangeLang) {
          currentNode.lang = fromLangTag;
        }

        if (currentNode.originalString !== undefined) {
          currentNode.nodeValue = currentNode.originalString;
        }

        /* 處理特殊屬性 */
        if (currentNode.tagName === 'META' && currentNode.name === 'description') {
          if (currentNode.originalContent !== undefined) {
            currentNode.content = currentNode.originalContent;
          }
        } else if (currentNode.tagName === 'META' && currentNode.name === 'keywords') {
          if (currentNode.originalContent !== undefined) {
            currentNode.content = currentNode.originalContent;
          }
        } else if (currentNode.tagName === 'IMG') {
          if (currentNode.originalAlt !== undefined) {
            currentNode.alt = currentNode.originalAlt;
          }
        } else if (currentNode.tagName === 'INPUT' && currentNode.type === 'button') {
          if (currentNode.originalValue !== undefined) {
            currentNode.value = currentNode.originalValue;
          }
        }

        for (const node of currentNode.childNodes) {
          inner(node);
        }
      }
      inner(rootNode);
    }

    return { convert, restore };
  }

  var HKVariantsRev = "偽 僞|兑 兌|卧 臥|叁 叄|台 臺|吃 喫|唇 脣|啟 啓|囱 囪|媪 媼|媯 嬀|悦 悅|愠 慍|户 戶|抬 擡|捝 挩|揾 搵|敍 敘|敚 敓|枱 檯|枴 柺|棁 梲|榅 榲|氲 氳|涚 涗|温 溫|溈 潙|潀 潨|濕 溼|灶 竈|為 爲|煴 熅|痴 癡|皂 皁|眾 衆|秘 祕|税 稅|稜 棱|粧 妝|粽 糉|糭 糉|緼 縕|缽 鉢|脱 脫|腽 膃|葱 蔥|蒀 蒕|蒍 蔿|藴 蘊|蜕 蛻|衞 衛|衹 只|説 說|踴 踊|輼 轀|醖 醞|針 鍼|鈎 鉤|鋭 銳|閲 閱|鰛 鰮";

  var HKVariantsRevPhrases = "一口吃個 一口喫個|一口吃成 一口喫成|一家三口 一家三口|一家五口 一家五口|一家六口 一家六口|一家四口 一家四口|七星巖 七星巖|世胄 世胄|介胄 介冑|傅巖 傅巖|免胄 免冑|冠胄 冠冑|千巖競秀 千巖競秀|千巖萬壑 千巖萬壑|千巖萬谷 千巖萬谷|口吃 口吃|台山 台山|台州 台州|台州地區 台州地區|台州市 台州市|吃口 喫口|吃口令 吃口令|吃口飯 喫口飯|吃吃 喫喫|吃子 喫子|名胄 名胄|國胄 國胄|圍巖 圍巖|地胄 地胄|壓胄子 壓冑子|士胄 士胄|大巖桐 大巖桐|天台女 天台女|天台宗 天台宗|天台山 天台山|天台縣 天台縣|天潢貴胄 天潢貴胄|奇巖 奇巖|寶胄 寶胄|小巖洞 小巖洞|岫巖縣 岫巖縣|峯巖 峯巖|嵌巖 嵌巖|巉巖 巉巖|巖壁 巖壁|巖居 巖居|巖居穴處 巖居穴處|巖居谷飲 巖居谷飲|巖岸 巖岸|巖巉 巖巉|巖巖 巖巖|巖徼 巖徼|巖手縣 巖手縣|巖村 巖村|巖洞 巖洞|巖流圈 巖流圈|巖牆 巖牆|巖牆之下 巖牆之下|巖畫 巖畫|巖穴 巖穴|巖穴之士 巖穴之士|巖薔薇 巖薔薇|巖邑 巖邑|巖郎 巖郎|巖阻 巖阻|巖陛 巖陛|帝胄 帝胄|幽巖 幽巖|幽棲巖谷 幽棲巖谷|張口 張口|懸巖 懸巖|懸巖峭壁 懸巖峭壁|懸胄 懸冑|攀巖 攀巖|支胄 支胄|教胄 教胄|景胄 景胄|望胄 望胄|末胄 末胄|村胄 村胄|枕巖漱流 枕巖漱流|枝胄 枝胄|氏胄 氏胄|洪胄 洪胄|浙江天台縣 浙江天台縣|清胄 清胄|灰巖殘丘 灰巖殘丘|玄胄 玄胄|甲胄 甲冑|甲胄魚類 甲冑魚類|皇胄 皇胄|石灰巖洞 石灰巖洞|神胄 神胄|簪纓世胄 簪纓世胄|系胄 系胄|紅巖 紅巖|絕巖 絕巖|緒胄 緒胄|纂胄 纂胄|胃口 胃口|胄嗣 胄嗣|胄子 胄子|胄序 胄序|胄族 胄族|胄甲 冑甲|胄監 胄監|胄科 冑科|胄緒 胄緒|胄胤 胄胤|胄裔 胄裔|胄裔繁衍 胄裔繁衍|胄閥 胄閥|胡雪巖 胡雪巖|胤胄 胤胄|苗胄 苗胄|英胄 英胄|華胄 華胄|血胄 血胄|裔胄 裔胄|訓胄 訓胄|試胄 試胄|豪門貴胄 豪門貴胄|貝胄 貝冑|貴胄 貴胄|賢胄 賢胄|蹇吃 蹇吃|躬擐甲胄 躬擐甲冑|遐胄 遐胄|遙胄 遙胄|遙遙華胄 遙遙華胄|遠胄 遠胄|遺胄 遺胄|鄧艾吃 鄧艾吃|重巖疊嶂 重巖疊嶂|金胄 金胄|鎧胄 鎧冑|鑿巖 鑿巖|門胄 門胄|開口 開口|雲巖區 雲巖區|非層巖 非層巖|韓侂胄 韓侂冑|飮胄 飮冑|骨巖巖 骨巖巖|高胄 高胄|魚胄 魚冑|鮮胄 鮮胄|鴻胄 鴻胄|黃巖區 黃巖區|黃巖島 黃巖島|黃炎貴胄 黃炎貴胄|齒胄 齒胄|龍巖 龍巖|龍巖市 龍巖市|龍巖村 龍巖村|龍胄 龍胄";

  var from_hk = [HKVariantsRev, HKVariantsRevPhrases];

  var TWVariantsRev = "偽 僞|參 蔘|吃 喫|唇 脣|啟 啓|媯 嬀|嫻 嫺|峰 峯|床 牀|抬 擡|汙 污|洩 泄|溈 潙|潀 潨|灶 竈|為 爲|痴 癡|痺 痹|皂 皁|眾 衆|睪 睾|秘 祕|稜 棱|簷 檐|粽 糉|缽 鉢|群 羣|著 着|蒍 蔿|裡 裏|踴 踊|韁 繮|顎 齶|鯰 鮎|麵 麪";

  var TWVariantsRevPhrases = "一口吃個 一口喫個|一口吃成 一口喫成|一家三口 一家三口|一家五口 一家五口|一家六口 一家六口|一家四口 一家四口|凶事 凶事|凶信 凶信|凶兆 凶兆|凶吉 凶吉|凶地 凶地|凶多吉少 凶多吉少|凶宅 凶宅|凶年 凶年|凶德 凶德|凶怪 凶怪|凶日 凶日|凶服 凶服|凶歲 凶歲|凶死 凶死|凶氣 凶氣|凶煞 凶煞|凶燄 凶燄|凶神 凶神|凶禮 凶禮|凶耗 凶耗|凶肆 凶肆|凶荒 凶荒|凶訊 凶訊|凶豎 凶豎|凶身 凶身|凶逆 凶逆|凶門 凶門|口吃 口吃|吃口 喫口|吃口令 吃口令|吃口飯 喫口飯|吃吃 喫喫|吃子 喫子|合著 合著|吉凶 吉凶|名著 名著|四凶 四凶|大凶 大凶|巨著 巨著|張口 張口|昭著 昭著|歲凶 歲凶|胃口 胃口|著作 著作|著名 著名|著式 著式|著志 著志|著於 著於|著書 著書|著白 著白|著稱 著稱|著者 著者|著述 著述|著錄 著錄|蹇吃 蹇吃|逢凶 逢凶|避凶 避凶|鄧艾吃 鄧艾吃|鉅著 鉅著|開口 開口|閔凶 閔凶|顯著 顯著";

  var from_tw = [TWVariantsRev, TWVariantsRevPhrases];

  var TWPhrasesRev = "PN接面 PN結|SQL隱碼攻擊 SQL注入|三極體 三極管|下拉選單 下拉列表|丟擲 拋出|中介軟體 中間件|串列埠 串口|主機板 主板|主開機記錄 主引導記錄|乙太網 以太網|乳酪 奶酪|二極體 二極管|互動 交互|互動式 交互式|亞塞拜然 阿塞拜疆|人工智慧 人工智能|介面 接口|介面卡 適配器|代碼 代碼|伺服器 服務器|佇列 隊列|位元 比特|位元率 比特率|位元組 字節|位元速率 碼率|位址 地址|位址列 地址欄|低級 低級|低階 低級|作業系統 操作系統|使用者 用戶|使用者名稱 用戶名|來電轉駁 呼叫轉移|例項 實例|信號 信號|偵錯 調試|偵錯程式 調試器|傅立葉 傅里葉|傳送 發送|傷心小棧 紅心大戰|價效比 性價比|優先順序 優先級|儲存 保存|元件 組件|光碟 光盤|光碟機 光驅|克羅埃西亞 克羅地亞|入口網站 門戶網站|內建 內置|內碼表 代碼頁|全域性 全局|全形 全角|全球資訊網 萬維網|冰棒 冰棍|冷盤 涼菜|函式 函數|函數語言程式設計 函數式編程|刀鋒伺服器 刀片服務器|分割槽 分區|分散式 分佈式|分時多工 時分複用|分時多重進接 時分多址|分碼多重進接 碼分多址|分空間多重進接 空分多址|分頻多工 頻分複用|分頻多重進接 頻分多址|列印 打印|列支敦斯登 列支敦士登|列舉 枚舉|前處理器 預處理器|剪下 剪切|剪貼簿 剪貼板|副檔名 擴展名|加彭 加蓬|匯入 導入|匯出 導出|匯流排 總線|區域性 局部|區域網 局域網|千里達及托巴哥 特立尼達和多巴哥|半形 半角|卡達 卡塔爾|印表機 打印機|厄利垂亞 厄立特里亞|厄瓜多 厄瓜多爾|原始檔 源文件|原始碼 原代碼|原生代碼 本地代碼|參數列 參數表|取樣 採樣|取樣率 採樣率|叢集 集羣|史瓦濟蘭 斯威士蘭|吉布地 吉布堤|吉里巴斯 基里巴斯|名稱空間 命名空間|吐瓦魯 圖瓦盧|向量 矢量|呼叫 調用|命令列 命令行|咖哩 咖喱|哈薩克 哈薩克斯坦|哥斯大黎加 哥斯達黎加|啟用 激活|喫茶小舖 喫茶小舖|喬治亞 格魯吉亞|單核心 宏內核|回撥 回調|圖示 圖標|土庫曼 土庫曼斯坦|地址 地址|坦尚尼亞 坦桑尼亞|型別 類型|埠 端口|執行 運行|執行緒 線程|執行長 首席執行官|堆疊 堆棧|場效電晶體 場效應管|塑膠 塑料|塔吉克 塔吉克斯坦|塞席爾 塞舌爾|塞普勒斯 塞浦路斯|壁紙 壁紙|夏農 香農|外來鍵 外鍵|外掛 插件|外接 外置|多型 多態|多執行緒 多線程|多工 多任務|多明尼加 多米尼加|太空梭 航天飛機|奈及利亞 尼日利亞|奈米 納米|子音 輔音|字串 字符串|字元 字符|字型 字體|字型檔 字庫|字尾 後綴|字符集 字符集|字首 前綴|存取 訪問|存檔 存盤|安地卡及巴布達 安提瓜和巴布達|宏都拉斯 洪都拉斯|宕機 死機|定址 尋址|宣告 聲明|實例 實例|實體地址 物理地址|實體記憶體 物理內存|寬頻 寬帶|寮國 老撾|專案 項目|對映 映射|對話方塊 對話框|對象 對象|尚比亞 贊比亞|尤拉 歐拉|尼日 尼日爾|巢狀 嵌套|工作列 任務欄|工作管理員 任務管理器|巨集 宏|巴布亞紐幾內亞 巴布亞新幾內亞|巴貝多 巴巴多斯|布吉納法索 布基納法索|布林 布爾|帛琉 帕勞|平行計算 並行計算|幾內亞比索 幾內亞比紹|序列 串行|序號產生器 註冊機|建構函式 構造函數|建立 創建|引數 參數|彙編 彙編|影印 複印|影片 視頻|影象 圖像|後設資料 元數據|循環 循環|微控制器 單片機|快取 緩存|快取記憶體 高速緩存|快捷半導體 仙童半導體|快閃記憶體 閃存|感測 傳感|截圖 截屏|打開 打開|批次 批量|技術長 首席技術官|指令式程式設計 命令式編程|指令碼 腳本|指標 指針|捲軸 滾動條|掃描器 掃描儀|排程 調度|控制代碼 句柄|控制元件 控件|搜尋 搜索|摺積 捲積|撥出 呼出|擴充套件 擴展|擴音 免提|擷取 截取|攜帶型 便攜式|支持者 支持者|支援 支持|效能 性能|整合 集成|數位 數字|數位印刷 數字印刷|數位電子 數字電子|數位電路 數字電路|數字 數字|數據機 調製解調器|文件 文檔|文字 文本|文書處理 文字處理|斯洛維尼亞 斯洛文尼亞|新增 添加|映象 鏡像|映象管 顯像管|時脈頻率 時鐘頻率|晶片 芯片|智慧 智能|智慧財產權 知識產權|暫存器 寄存器|最佳化 優化|有失真壓縮 有損壓縮|李彥宏 李彥宏|查德 乍得|查詢 查找|核心 內核|格瑞那達 格林納達|桌上型 桌面型|桌上型電腦 臺式機|桌布 壁紙|標頭檔案 頭文件|模擬 仿真|模組 模塊|模里西斯 毛里求斯|機率 幾率|檔名 文件名|檔案 文件|檢視 查看|欄位 字段|正規化 範式|正規表示式 正則表達式|母音 元音|比特幣 比特幣|氣泡排序 冒泡排序|永珍 萬象|永續性 持久性|汶萊 文萊|沙烏地阿拉伯 沙特阿拉伯|泡麵 方便麪|波士尼亞赫塞哥維納 波斯尼亞黑塞哥維那|波札那 博茨瓦納|波長分波多工 波分複用|海內存知己 海內存知己|消息 消息|游標 光標|溢位 溢出|滑鼠 鼠標|演算法 算法|烏茲別克 烏茲別克斯坦|無失真壓縮 無損壓縮|燒錄 刻錄|營運長 首席運營官|片語 詞組|物件 對象|物件導向 面向對象|狀態列 狀態欄|獅子山 塞拉利昂|瓜地馬拉 危地馬拉|甘比亞 岡比亞|畫素 像素|登入 登錄|登出 註銷|登錄檔 註冊表|盧安達 盧旺達|目的碼 目標代碼|直譯器 解釋器|相容 兼容|相簿 圖庫|真實模式 實模式|矽 硅|砈 砹|破圖 花屏|硬碟 硬盤|硬體 硬件|碟片 盤片|磁碟 磁盤|磁碟機代號 盤符|磁軌 磁道|社區 社區|社羣 社區|程序 進程|程序不正義 程序不正義|程序導向 面向過程|程序式程式設計 過程式編程|程序正義 程序正義|程式 程序|程式碼 代碼|程式設計 編程|程式設計師 程序員|程式語言 編程語言|稽覈 審覈|積體電路 集成電路|空氣清淨機 空氣淨化器|空間多工 空分複用|突尼西亞 突尼斯|簡報 演示文稿|簡訊 短信|簽帳金融卡 借記卡|粘貼 粘貼|紐西蘭 新西蘭|純喫茶 純喫茶|索羅門羣島 所羅門羣島|索馬利亞 索馬里|終端使用者 最終用戶|組合語言 彙編語言|組譯 彙編|結束通話 掛斷|維德角 佛得角|網咖 網吧|網絡卡 網卡|網路 網絡|網路上的芳鄰 網上鄰居|網際網路 互聯網|線上 在線|縮圖 縮略圖|縮排 縮進|繫結 綁定|義大利 意大利|聖克里斯多福及尼維斯 聖基茨和尼維斯|聖文森及格瑞那丁 聖文森特和格林納丁斯|聖露西亞 聖盧西亞|聖馬利諾 聖馬力諾|聯結器 連接器|聯絡 聯繫|肯亞 肯尼亞|腳踏車 自行車|膝上型電腦 筆記本電腦|自動旋轉螢幕 自動轉屏|茅利塔尼亞 毛里塔尼亞|莫三比克 莫桑比克|菜單 菜單|萬用字元 通配符|萬那杜 瓦努阿圖|葉門 也門|葛摩 科摩羅|蒲隆地 布隆迪|蓋亞那 圭亞那|藍色畫面 藍屏|藍芽 藍牙|蘇利南 蘇里南|虛擬函式 虛函數|虛擬機器 虛擬機|虛擬碼 僞代碼|螢幕 屏幕|行內函數 內聯函數|行動式 便攜式|行動硬碟 移動硬盤|行動網路 移動網絡|行動資料 移動資料|行動通訊 移動通信|行動電話 移動電話|衣索比亞 埃塞俄比亞|表示式 表達式|裝置 設備|複製 拷貝|覈取按鈕 複選按鈕|覈取方塊 複選框|視窗 窗口|視覺化 可視化|視訊 視頻|視訊會議 視頻會議|視訊記憶體 顯存|視訊通話 視頻通話|解析度 分辨率|解構函式 析構函數|解除安裝 卸載|觸控 觸摸|觸控式螢幕 觸摸屏|計程車 出租車|訊息 消息|訊號 信號|訊雜比 信噪比|記憶體 內存|訪問 訪問|設定 設置|許可權 權限|調色盤 調色板|調變 調制|諾魯 瑙魯|識別符號 標識符|變數 變量|象牙海岸 科特迪瓦|貝南 貝寧|貝里斯 伯利茲|貼上 粘貼|資料 數據|資料來源 數據源|資料倉儲 數據倉庫|資料包 數據報|資料夾 文件夾|資料庫 數據庫|資料探勘 數據挖掘|資訊 信息|資訊保安 信息安全|資訊理論 信息論|資訊科技 信息技術|資訊長 首席信息官|賓士 奔馳|賴比瑞亞 利比里亞|賴索托 萊索托|超程式設計 元編程|跳脫字元 轉義字符|軟碟機 軟驅|軟體 軟件|載入 加載|載入程式 引導程序|辛巴威 津巴布韋|迦納 加納|迴圈 循環|透過 通過|通訊 通信|通話卡 通訊卡|通話記錄 聯繫歷史|通過 通過|通道 信道|速食麵 方便麪|連結 鏈接|連結串列 鏈表|連線 連接|進位制 進制|進程 進程|進階 高端|運算元 操作數|運算子 操作符|運算式 表達式|過載 重載|遞迴 遞歸|遠端 遠程|遮蔽 屏蔽|選單 菜單|邏輯閘 邏輯門|那杜 溫納圖萬|部落格 博客|都會網路 城域網|醯 酰|釋出 發佈|重新命名 重命名|重新整理 刷新|重灌 重裝|金氧半導體 金屬氧化物半導體|金鑰 密鑰|鈽 鈈|鉲 鐦|鉳 錇|鋂 鎇|錄影 錄像|錼 鎿|鍅 鈁|鎝 鍀|鎦 鑥|鐳射 激光|鑀 鎄|開啟 打開|閘流體 晶閘管|閘道器 網關|閘電路 門電路|關聯式資料庫 關係數據庫|防寫 寫保護|防毒 殺毒|阿拉伯聯合大公國 阿拉伯聯合酋長國|陣列 數組|除錯 調試|隨身碟 U盤|雜湊 哈希|離線 脫機|雲端儲存 雲存儲|雲端計算 雲計算|電晶體 晶體管|電腦保安 計算機安全|電腦科學 計算機科學|非同步 異步|韌體 固件|音效卡 聲卡|音訊 音頻|頁尾 頁腳|頁首 頁眉|預設 缺省|預設值 默認值|頻寬 帶寬|類别範本 類模板|類比 模擬|類比電子 模擬電子|類比電路 模擬電路|顯示卡 顯卡|飛航模式 飛行模式|馬利共和國 馬里共和國|馬爾地夫 馬爾代夫|駭客 黑客|高效能運算 高性能計算|高畫質 高清|高空彈跳 蹦極|高級 高級|高階 高端|黃宏 黃宏|點選 點擊|點陣圖 位圖";

  var from_twp = [TWVariantsRev, TWVariantsRevPhrases, TWPhrasesRev];

  var JPVariantsRev = "万 萬|与 與|両 兩|乗 乘|乱 亂|亀 龜|争 爭|亘 亙|亜 亞|仏 佛|仮 假|会 會|伝 傳|体 體|価 價|倹 儉|偽 僞|児 兒|党 黨|内 內|円 圓|写 寫|処 處|刹 剎|剣 劍|剤 劑|剰 剩|励 勵|労 勞|効 效|勅 敕|勧 勸|勲 勳|匀 勻|区 區|医 醫|単 單|却 卻|厠 廁|厳 嚴|参 參|双 雙|収 收|叙 敘|号 號|呉 吳|呪 咒|唇 脣|唖 啞|営 營|嘘 噓|嘱 囑|噛 嚙|団 團|囲 圍|図 圖|国 國|圏 圈|圧 壓|堕 墮|塁 壘|塩 鹽|増 增|壊 壞|壌 壤|壮 壯|声 聲|壱 壹|売 賣|変 變|奥 奧|奨 奬|嬢 孃|学 學|宝 寶|実 實|寛 寬|寝 寢|対 對|寿 壽|専 專|将 將|尽 盡|届 屆|属 屬|岳 嶽|峡 峽|峰 峯|巌 巖|巣 巢|巻 卷|帯 帶|帰 歸|庁 廳|広 廣|床 牀|廃 廢|弁 瓣|弐 貳|弥 彌|弯 彎|弾 彈|当 當|彦 彥|径 徑|従 從|御 禦|徳 德|徴 徵|応 應|恋 戀|恒 恆|恵 惠|悦 悅|悩 惱|悪 惡|惨 慘|懐 懷|戦 戰|戯 戲|戸 戶|戻 戾|払 拂|抜 拔|択 擇|担 擔|拝 拜|拠 據|拡 擴|挙 舉|挟 挾|挿 插|捜 搜|掲 揭|掴 摑|掻 搔|揺 搖|摂 攝|撃 擊|撹 攪|数 數|斉 齊|斎 齋|断 斷|旧 舊|昼 晝|晋 晉|晩 晚|暁 曉|暦 曆|曁 暨|曽 曾|条 條|来 來|枢 樞|査 查|栄 榮|桜 櫻|桝 枡|桟 棧|検 檢|楡 榆|楼 樓|楽 樂|様 樣|権 權|横 橫|欧 歐|歓 歡|歩 步|歯 齒|歳 歲|歴 歷|残 殘|殴 毆|殻 殼|毎 每|気 氣|汚 污|没 沒|沢 澤|沪 濾|浄 淨|浅 淺|浜 濱|涙 淚|涛 濤|渇 渴|済 濟|渉 涉|渋 澀|渓 溪|温 溫|湾 灣|湿 溼|満 滿|溌 潑|滝 瀧|滞 滯|潜 潛|瀬 瀨|灯 燈|炉 爐|点 點|為 爲|焔 焰|焼 燒|煙 菸|犠 犧|状 狀|独 獨|狭 狹|猟 獵|猫 貓|献 獻|獣 獸|産 產|画 畫|畳 疊|疏 疎|痩 瘦|痴 癡|痺 痹|発 發|皐 皋|盗 盜|県 縣|砕 碎|礼 禮|祷 禱|禄 祿|禅 禪|秘 祕|称 稱|税 稅|稜 棱|稲 稻|穂 穗|穏 穩|穣 穰|窃 竊|竃 竈|竜 龍|粋 粹|粛 肅|粧 妝|粽 糉|経 經|絵 繪|絶 絕|継 繼|続 續|総 總|緑 綠|緒 緖|縁 緣|縄 繩|縦 縱|繊 纖|繋 繫|繍 繡|群 羣|聡 聰|聴 聽|胆 膽|脚 腳|脱 脫|脳 腦|臓 臟|舎 舍|舗 鋪|芦 蘆|芸 藝|茎 莖|茘 荔|荘 莊|莱 萊|葱 蔥|蒋 蔣|蔵 藏|薫 薰|薬 藥|虚 虛|虫 蟲|蚕 蠶|蛍 螢|蛮 蠻|蝋 蠟|装 裝|覇 霸|覚 覺|覧 覽|観 觀|触 觸|訳 譯|証 證|誉 譽|説 說|読 讀|謡 謠|譲 讓|豊 豐|賛 贊|贋 贗|践 踐|転 轉|軽 輕|輌 輛|辞 辭|辺 邊|逓 遞|遅 遲|遙 遥|郷 鄉|酔 醉|醋 酢|醗 醱|醤 醬|醸 釀|釈 釋|鉄 鐵|鉱 鑛|銭 錢|鋳 鑄|錬 鍊|録 錄|関 關|閲 閱|闘 鬥|陥 陷|険 險|随 隨|隠 隱|雑 雜|霊 靈|静 靜|頴 穎|頼 賴|顔 顏|顕 顯|駅 驛|駆 驅|騒 騷|験 驗|髄 髓|髪 髮|鴎 鷗|鶏 雞|鹸 鹼|麦 麥|麹 麴|麺 麪|黄 黃|黒 黑|黙 默|鼈 鱉|齢 齡";

  var JPShinjitaiCharacters = "両 兩|弁 辨|欠 缺|糸 絲|芸 藝|浜 濱";

  var JPShinjitaiPhrases = "一獲千金 一攫千金|丁寧 叮嚀|丁重 鄭重|三差路 三叉路|世論 輿論|亜鈴 啞鈴|交差 交叉|供宴 饗宴|俊馬 駿馬|保塁 堡壘|個条書 箇条書|偏平 扁平|停泊 碇泊|優俊 優駿|先兵 尖兵|先鋭 尖鋭|共役 共軛|冗舌 饒舌|凶器 兇器|削岩 鑿岩|包丁 庖丁|包帯 繃帯|区画 區劃|厳然 儼然|友宜 友誼|反乱 叛乱|収集 蒐集|叙情 抒情|台頭 擡頭|合弁 合辦|喜遊曲 嬉遊曲|嘆願 歎願|回転 廻転|回遊 回游|奉持 捧持|委縮 萎縮|展転 輾轉|希少 稀少|幻惑 眩惑|広範 廣汎|広野 曠野|廃虚 廢墟|建坪率 建蔽率|弁当 辨當|弁膜 瓣膜|弁護 辯護|弁髪 辮髮|弦歌 絃歌|恩義 恩誼|意向 意嚮|慰謝料 慰藉料|憶断 臆断|憶病 臆病|戦没 戰歿|扇情 煽情|手帳 手帖|技量 伎倆|抜粋 抜萃|披歴 披瀝|抵触 牴触|抽選 抽籤|拘引 勾引|拠出 醵出|拠金 醵金|掘削 掘鑿|控除 扣除|援護 掩護|放棄 抛棄|散水 撒水|敬謙 敬虔|敷延 敷衍|断固 断乎|族生 簇生|昇叙 陞敘|暖房 煖房|暗唱 暗誦|暗夜 闇夜|暴露 曝露|枯渇 涸渇|格好 恰好|格幅 恰幅|棄損 毀損|模索 摸索|橋頭保 橋頭堡|欠缺 欠缺|死体 屍體|殿部 臀部|母指 拇指|気迫 気魄|決別 訣別|決壊 決潰|沈殿 沈澱|油送船 油槽船|波乱 波瀾|注釈 註釋|洗浄 洗滌|活発 活潑|浸透 滲透|浸食 浸蝕|消却 銷卻|混然 渾然|湾曲 彎曲|溶接 熔接|漁労 漁撈|漂然 飄然|激高 激昂|火炎 火焰|焦燥 焦躁|班点 斑点|留飲 溜飲|略奪 掠奪|疎通 疏通|発酵 醱酵|白亜 白堊|相克 相剋|知恵 智慧|破棄 破毀|確固 確乎|禁固 禁錮|符丁 符牒|粉装 扮装|紫班 紫斑|終息 終熄|総合 綜合|編集 編輯|義援 義捐|耕運機 耕耘機|肝心 肝腎|肩甲骨 肩胛骨|背徳 悖德|脈拍 脈搏|膨張 膨脹|芳純 芳醇|英知 叡智|蒸留 蒸溜|薫蒸 燻蒸|薫製 燻製|衣装 衣裳|衰退 衰退|裕然 悠然|補佐 輔佐|訓戒 訓誡|試練 試煉|詭弁 詭辯|講和 媾和|象眼 象嵌|貫録 貫禄|買弁 買辦|賛辞 讚辭|踏襲 蹈襲|車両 車輛|転倒 顛倒|輪郭 輪廓|退色 褪色|途絶 杜絶|連係 連繫|連合 聯合|選考 銓衡|酢酸 醋酸|野卑 野鄙|鉱石 礦石|間欠 間歇|関数 函數|防御 防禦|険阻 嶮岨|障壁 牆壁|障害 障礙|隠滅 湮滅|集落 聚落|雇用 雇傭|風諭 諷喩|飛語 蜚語|香典 香奠|骨格 骨骼|高進 亢進|鳥観 鳥瞰";

  var from_jp = [JPVariantsRev, JPShinjitaiCharacters, JPShinjitaiPhrases];

  var TSCharacters = "㑮 𫝈|㑯 㑔|㑳 㑇|㑶 㐹|㒓 𠉂|㓄 𪠟|㓨 刾|㔋 𪟎|㖮 𪠵|㗲 𠵾|㗿 𪡛|㘉 𠰱|㘓 𪢌|㘔 𫬐|㘚 㘎|㛝 𫝦|㜄 㚯|㜏 㛣|㜐 𫝧|㜗 𡞋|㜢 𡞱|㜷 𡝠|㞞 𪨊|㟺 𪩇|㠏 㟆|㠣 𫵷|㢗 𪪑|㢝 𢋈|㥮 㤘|㦎 𢛯|㦛 𢗓|㦞 𪫷|㨻 𪮃|㩋 𪮋|㩜 㨫|㩳 㧐|㩵 擜|㪎 𪯋|㯤 𣘐|㰙 𣗙|㵗 𣳆|㵾 𪷍|㶆 𫞛|㷍 𤆢|㷿 𤈷|㸇 𤎺|㹽 𫞣|㺏 𤠋|㺜 𪺻|㻶 𪼋|㿖 𪽮|㿗 𤻊|㿧 𤽯|䀉 𥁢|䀹 𥅴|䁪 𥇢|䁻 䀥|䂎 𥎝|䃮 鿎|䅐 𫀨|䅳 𫀬|䆉 𫁂|䉑 𫁲|䉙 𥬀|䉬 𫂈|䉲 𥮜|䉶 𫁷|䊭 𥺅|䊷 䌶|䊺 𫄚|䋃 𫄜|䋔 𫄞|䋙 䌺|䋚 䌻|䋦 𫄩|䋹 䌿|䋻 䌾|䋼 𫄮|䋿 𦈓|䌈 𦈖|䌋 𦈘|䌖 𦈜|䌝 𦈟|䌟 𦈞|䌥 𦈠|䌰 𦈙|䍤 𫅅|䍦 䍠|䍽 𦍠|䎙 𫅭|䎱 䎬|䓣 𬜯|䕤 𫟕|䕳 𦰴|䖅 𫟑|䗅 𫊪|䗿 𧉞|䙔 𫋲|䙡 䙌|䙱 𧜭|䚩 𫌯|䛄 𫍠|䛳 𫍫|䜀 䜧|䜖 𫟢|䝭 𫎧|䝻 𧹕|䝼 䞍|䞈 𧹑|䞋 𫎪|䞓 𫎭|䟃 𫎺|䟆 𫎳|䟐 𫎱|䠆 𫏃|䠱 𨅛|䡐 𫟤|䡩 𫟥|䡵 𫟦|䢨 𨑹|䤤 𫟺|䥄 𫠀|䥇 䦂|䥑 鿏|䥕 𬭯|䥗 𫔋|䥩 𨱖|䥯 𫔆|䥱 䥾|䦘 𨸄|䦛 䦶|䦟 䦷|䦯 𫔵|䦳 𨷿|䧢 𨸟|䪊 𫖅|䪏 𩏼|䪗 𩐀|䪘 𩏿|䪴 𫖫|䪾 𫖬|䫀 𫖱|䫂 𫖰|䫟 𫖲|䫴 𩖗|䫶 𫖺|䫻 𫗇|䫾 𫠈|䬓 𫗊|䬘 𩙮|䬝 𩙯|䬞 𩙧|䬧 𫗟|䭀 𩠇|䭃 𩠈|䭑 𫗱|䭔 𫗰|䭿 𩧭|䮄 𫠊|䮝 𩧰|䮞 𩨁|䮠 𩧿|䮫 𩨇|䮰 𫘮|䮳 𩨏|䮾 𩧪|䯀 䯅|䯤 𩩈|䰾 鲃|䱀 𫚐|䱁 𫚏|䱙 𩾈|䱧 𫚠|䱬 𩾊|䱰 𩾋|䱷 䲣|䱸 𫠑|䱽 䲝|䲁 鳚|䲅 𫚜|䲖 𩾂|䲘 鳤|䲰 𪉂|䳜 𫛬|䳢 𫛰|䳤 𫛮|䳧 𫛺|䳫 𫛼|䴉 鹮|䴋 𫜅|䴬 𪎈|䴱 𫜒|䴴 𪎋|䴽 𫜔|䵳 𪑅|䵴 𫜙|䶕 𫜨|䶲 𫜳|丟 丢|並 并|乾 干|亂 乱|亙 亘|亞 亚|佇 伫|佈 布|佔 占|併 并|來 来|侖 仑|侶 侣|侷 局|俁 俣|係 系|俓 𠇹|俔 伣|俠 侠|俥 伡|俬 私|倀 伥|倆 俩|倈 俫|倉 仓|個 个|們 们|倖 幸|倫 伦|倲 㑈|偉 伟|偑 㐽|側 侧|偵 侦|偽 伪|傌 㐷|傑 杰|傖 伧|傘 伞|備 备|傢 家|傭 佣|傯 偬|傳 传|傴 伛|債 债|傷 伤|傾 倾|僂 偻|僅 仅|僉 佥|僑 侨|僕 仆|僞 伪|僤 𫢸|僥 侥|僨 偾|僱 雇|價 价|儀 仪|儁 俊|儂 侬|億 亿|儈 侩|儉 俭|儎 傤|儐 傧|儔 俦|儕 侪|儘 尽|償 偿|儣 𠆲|優 优|儭 𠋆|儲 储|儷 俪|儸 㑩|儺 傩|儻 傥|儼 俨|兇 凶|兌 兑|兒 儿|兗 兖|內 内|兩 两|冊 册|冑 胄|冪 幂|凈 净|凍 冻|凙 𪞝|凜 凛|凱 凯|別 别|刪 删|剄 刭|則 则|剋 克|剎 刹|剗 刬|剛 刚|剝 剥|剮 剐|剴 剀|創 创|剷 铲|剾 𠛅|劃 划|劇 剧|劉 刘|劊 刽|劌 刿|劍 剑|劏 㓥|劑 剂|劚 㔉|勁 劲|勑 𠡠|動 动|務 务|勛 勋|勝 胜|勞 劳|勢 势|勣 𪟝|勩 勚|勱 劢|勳 勋|勵 励|勸 劝|勻 匀|匭 匦|匯 汇|匱 匮|區 区|協 协|卹 恤|卻 却|卽 即|厙 厍|厠 厕|厤 历|厭 厌|厲 厉|厴 厣|參 参|叄 叁|叢 丛|吒 咤|吳 吴|吶 呐|呂 吕|咼 呙|員 员|哯 𠯟|唄 呗|唓 𪠳|唸 念|問 问|啓 启|啞 哑|啟 启|啢 唡|喎 㖞|喚 唤|喪 丧|喫 吃|喬 乔|單 单|喲 哟|嗆 呛|嗇 啬|嗊 唝|嗎 吗|嗚 呜|嗩 唢|嗰 𠮶|嗶 哔|嗹 𪡏|嘆 叹|嘍 喽|嘓 啯|嘔 呕|嘖 啧|嘗 尝|嘜 唛|嘩 哗|嘪 𪡃|嘮 唠|嘯 啸|嘰 叽|嘳 𪡞|嘵 哓|嘸 呒|嘺 𪡀|嘽 啴|噁 恶|噅 𠯠|噓 嘘|噚 㖊|噝 咝|噞 𪡋|噠 哒|噥 哝|噦 哕|噯 嗳|噲 哙|噴 喷|噸 吨|噹 当|嚀 咛|嚇 吓|嚌 哜|嚐 尝|嚕 噜|嚙 啮|嚛 𪠸|嚥 咽|嚦 呖|嚧 𠰷|嚨 咙|嚮 向|嚲 亸|嚳 喾|嚴 严|嚶 嘤|嚽 𪢕|囀 啭|囁 嗫|囂 嚣|囃 𠱞|囅 冁|囈 呓|囉 啰|囌 苏|囑 嘱|囒 𪢠|囪 囱|圇 囵|國 国|圍 围|園 园|圓 圆|圖 图|團 团|圞 𪢮|垻 坝|埡 垭|埨 𫭢|埬 𪣆|埰 采|執 执|堅 坚|堊 垩|堖 垴|堚 𪣒|堝 埚|堯 尧|報 报|場 场|塊 块|塋 茔|塏 垲|塒 埘|塗 涂|塚 冢|塢 坞|塤 埙|塵 尘|塸 𫭟|塹 堑|塿 𪣻|墊 垫|墜 坠|墠 𫮃|墮 堕|墰 坛|墲 𪢸|墳 坟|墶 垯|墻 墙|墾 垦|壇 坛|壈 𡒄|壋 垱|壎 埙|壓 压|壗 𡋤|壘 垒|壙 圹|壚 垆|壜 坛|壞 坏|壟 垄|壠 垅|壢 坜|壣 𪤚|壩 坝|壪 塆|壯 壮|壺 壶|壼 壸|壽 寿|夠 够|夢 梦|夥 伙|夾 夹|奐 奂|奧 奥|奩 奁|奪 夺|奬 奖|奮 奋|奼 姹|妝 妆|姍 姗|姦 奸|娙 𫰛|娛 娱|婁 娄|婡 𫝫|婦 妇|婭 娅|媈 𫝨|媧 娲|媯 妫|媰 㛀|媼 媪|媽 妈|嫋 袅|嫗 妪|嫵 妩|嫺 娴|嫻 娴|嫿 婳|嬀 妫|嬃 媭|嬇 𫝬|嬈 娆|嬋 婵|嬌 娇|嬙 嫱|嬡 嫒|嬣 𪥰|嬤 嬷|嬦 𫝩|嬪 嫔|嬰 婴|嬸 婶|嬻 𪥿|孃 娘|孄 𫝮|孆 𫝭|孇 𪥫|孋 㛤|孌 娈|孎 𡠟|孫 孙|學 学|孻 𡥧|孾 𪧀|孿 孪|宮 宫|寀 采|寠 𪧘|寢 寝|實 实|寧 宁|審 审|寫 写|寬 宽|寵 宠|寶 宝|將 将|專 专|尋 寻|對 对|導 导|尷 尴|屆 届|屍 尸|屓 屃|屜 屉|屢 屡|層 层|屨 屦|屩 𪨗|屬 属|岡 冈|峯 峰|峴 岘|島 岛|峽 峡|崍 崃|崑 昆|崗 岗|崙 仑|崢 峥|崬 岽|嵐 岚|嵗 岁|嵼 𡶴|嵽 𫶇|嵾 㟥|嶁 嵝|嶄 崭|嶇 岖|嶈 𡺃|嶔 嵚|嶗 崂|嶘 𡺄|嶠 峤|嶢 峣|嶧 峄|嶨 峃|嶮 崄|嶸 嵘|嶹 𫝵|嶺 岭|嶼 屿|嶽 岳|巊 𪩎|巋 岿|巒 峦|巔 巅|巖 岩|巗 𪨷|巘 𪩘|巰 巯|巹 卺|帥 帅|師 师|帳 帐|帶 带|幀 帧|幃 帏|幓 㡎|幗 帼|幘 帻|幝 𪩷|幟 帜|幣 币|幩 𪩸|幫 帮|幬 帱|幹 干|幾 几|庫 库|廁 厕|廂 厢|廄 厩|廈 厦|廎 庼|廕 荫|廚 厨|廝 厮|廞 𫷷|廟 庙|廠 厂|廡 庑|廢 废|廣 广|廧 𪪞|廩 廪|廬 庐|廳 厅|弒 弑|弔 吊|弳 弪|張 张|強 强|彃 𪪼|彄 𫸩|彆 别|彈 弹|彌 弥|彎 弯|彔 录|彙 汇|彠 彟|彥 彦|彫 雕|彲 彨|彿 佛|後 后|徑 径|從 从|徠 徕|復 复|徵 征|徹 彻|徿 𪫌|恆 恒|恥 耻|悅 悦|悞 悮|悵 怅|悶 闷|悽 凄|惡 恶|惱 恼|惲 恽|惻 恻|愛 爱|愜 惬|愨 悫|愴 怆|愷 恺|愻 𢙏|愾 忾|慄 栗|態 态|慍 愠|慘 惨|慚 惭|慟 恸|慣 惯|慤 悫|慪 怄|慫 怂|慮 虑|慳 悭|慶 庆|慺 㥪|慼 戚|慾 欲|憂 忧|憊 惫|憐 怜|憑 凭|憒 愦|憖 慭|憚 惮|憢 𢙒|憤 愤|憫 悯|憮 怃|憲 宪|憶 忆|憸 𪫺|憹 𢙐|懀 𢙓|懇 恳|應 应|懌 怿|懍 懔|懎 𢠁|懞 蒙|懟 怼|懣 懑|懤 㤽|懨 恹|懲 惩|懶 懒|懷 怀|懸 悬|懺 忏|懼 惧|懾 慑|戀 恋|戇 戆|戔 戋|戧 戗|戩 戬|戰 战|戱 戯|戲 戏|戶 户|拋 抛|挩 捝|挱 挲|挾 挟|捨 舍|捫 扪|捱 挨|捲 卷|掃 扫|掄 抡|掆 㧏|掗 挜|掙 挣|掚 𪭵|掛 挂|採 采|揀 拣|揚 扬|換 换|揮 挥|揯 搄|損 损|搖 摇|搗 捣|搵 揾|搶 抢|摋 𢫬|摐 𪭢|摑 掴|摜 掼|摟 搂|摯 挚|摳 抠|摶 抟|摺 折|摻 掺|撈 捞|撊 𪭾|撏 挦|撐 撑|撓 挠|撝 㧑|撟 挢|撣 掸|撥 拨|撧 𪮖|撫 抚|撲 扑|撳 揿|撻 挞|撾 挝|撿 捡|擁 拥|擄 掳|擇 择|擊 击|擋 挡|擓 㧟|擔 担|據 据|擟 𪭧|擠 挤|擣 捣|擫 𢬍|擬 拟|擯 摈|擰 拧|擱 搁|擲 掷|擴 扩|擷 撷|擺 摆|擻 擞|擼 撸|擽 㧰|擾 扰|攄 摅|攆 撵|攋 𪮶|攏 拢|攔 拦|攖 撄|攙 搀|攛 撺|攜 携|攝 摄|攢 攒|攣 挛|攤 摊|攪 搅|攬 揽|敎 教|敓 敚|敗 败|敘 叙|敵 敌|數 数|斂 敛|斃 毙|斅 𢽾|斆 敩|斕 斓|斬 斩|斷 断|斸 𣃁|於 于|旂 旗|旣 既|昇 升|時 时|晉 晋|晛 𬀪|晝 昼|暈 晕|暉 晖|暐 𬀩|暘 旸|暢 畅|暫 暂|曄 晔|曆 历|曇 昙|曉 晓|曊 𪰶|曏 向|曖 暧|曠 旷|曥 𣆐|曨 昽|曬 晒|書 书|會 会|朥 𦛨|朧 胧|朮 术|東 东|枴 拐|柵 栅|柺 拐|査 查|桱 𣐕|桿 杆|梔 栀|梖 𪱷|梘 枧|梜 𬂩|條 条|梟 枭|梲 棁|棄 弃|棊 棋|棖 枨|棗 枣|棟 栋|棡 㭎|棧 栈|棲 栖|棶 梾|椏 桠|椲 㭏|楇 𣒌|楊 杨|楓 枫|楨 桢|業 业|極 极|榘 矩|榦 干|榪 杩|榮 荣|榲 榅|榿 桤|構 构|槍 枪|槓 杠|槤 梿|槧 椠|槨 椁|槫 𣏢|槮 椮|槳 桨|槶 椢|槼 椝|樁 桩|樂 乐|樅 枞|樑 梁|樓 楼|標 标|樞 枢|樠 𣗊|樢 㭤|樣 样|樤 𣔌|樧 榝|樫 㭴|樳 桪|樸 朴|樹 树|樺 桦|樿 椫|橈 桡|橋 桥|機 机|橢 椭|橫 横|橯 𣓿|檁 檩|檉 柽|檔 档|檜 桧|檟 槚|檢 检|檣 樯|檭 𣘴|檮 梼|檯 台|檳 槟|檵 𪲛|檸 柠|檻 槛|櫃 柜|櫅 𪲎|櫍 𬃊|櫓 橹|櫚 榈|櫛 栉|櫝 椟|櫞 橼|櫟 栎|櫠 𪲮|櫥 橱|櫧 槠|櫨 栌|櫪 枥|櫫 橥|櫬 榇|櫱 蘖|櫳 栊|櫸 榉|櫻 樱|欄 栏|欅 榉|欇 𪳍|權 权|欍 𣐤|欏 椤|欐 𪲔|欑 𪴙|欒 栾|欓 𣗋|欖 榄|欘 𣚚|欞 棂|欽 钦|歎 叹|歐 欧|歟 欤|歡 欢|歲 岁|歷 历|歸 归|歿 殁|殘 残|殞 殒|殢 𣨼|殤 殇|殨 㱮|殫 殚|殭 僵|殮 殓|殯 殡|殰 㱩|殲 歼|殺 杀|殻 壳|殼 壳|毀 毁|毆 殴|毊 𪵑|毿 毵|氂 牦|氈 毡|氌 氇|氣 气|氫 氢|氬 氩|氭 𣱝|氳 氲|氾 泛|汎 泛|汙 污|決 决|沒 没|沖 冲|況 况|泝 溯|洩 泄|洶 汹|浹 浃|浿 𬇙|涇 泾|涗 涚|涼 凉|淒 凄|淚 泪|淥 渌|淨 净|淩 凌|淪 沦|淵 渊|淶 涞|淺 浅|渙 涣|減 减|渢 沨|渦 涡|測 测|渾 浑|湊 凑|湋 𣲗|湞 浈|湧 涌|湯 汤|溈 沩|準 准|溝 沟|溡 𪶄|溫 温|溮 浉|溳 涢|溼 湿|滄 沧|滅 灭|滌 涤|滎 荥|滙 汇|滬 沪|滯 滞|滲 渗|滷 卤|滸 浒|滻 浐|滾 滚|滿 满|漁 渔|漊 溇|漍 𬇹|漚 沤|漢 汉|漣 涟|漬 渍|漲 涨|漵 溆|漸 渐|漿 浆|潁 颍|潑 泼|潔 洁|潕 𣲘|潙 沩|潚 㴋|潛 潜|潣 𫞗|潤 润|潯 浔|潰 溃|潷 滗|潿 涠|澀 涩|澅 𣶩|澆 浇|澇 涝|澐 沄|澗 涧|澠 渑|澤 泽|澦 滪|澩 泶|澫 𬇕|澬 𫞚|澮 浍|澱 淀|澾 㳠|濁 浊|濃 浓|濄 㳡|濆 𣸣|濕 湿|濘 泞|濚 溁|濛 蒙|濜 浕|濟 济|濤 涛|濧 㳔|濫 滥|濰 潍|濱 滨|濺 溅|濼 泺|濾 滤|濿 𪵱|瀂 澛|瀃 𣽷|瀅 滢|瀆 渎|瀇 㲿|瀉 泻|瀋 沈|瀏 浏|瀕 濒|瀘 泸|瀝 沥|瀟 潇|瀠 潆|瀦 潴|瀧 泷|瀨 濑|瀰 弥|瀲 潋|瀾 澜|灃 沣|灄 滠|灍 𫞝|灑 洒|灒 𪷽|灕 漓|灘 滩|灙 𣺼|灝 灏|灡 㳕|灣 湾|灤 滦|灧 滟|灩 滟|災 灾|為 为|烏 乌|烴 烃|無 无|煇 𪸩|煉 炼|煒 炜|煙 烟|煢 茕|煥 焕|煩 烦|煬 炀|煱 㶽|熂 𪸕|熅 煴|熉 𤈶|熌 𤇄|熒 荧|熓 𤆡|熗 炝|熚 𤇹|熡 𤋏|熰 𬉼|熱 热|熲 颎|熾 炽|燀 𬊤|燁 烨|燈 灯|燉 炖|燒 烧|燖 𬊈|燙 烫|燜 焖|營 营|燦 灿|燬 毁|燭 烛|燴 烩|燶 㶶|燻 熏|燼 烬|燾 焘|爃 𫞡|爄 𤇃|爇 𦶟|爍 烁|爐 炉|爖 𤇭|爛 烂|爥 𪹳|爧 𫞠|爭 争|爲 为|爺 爷|爾 尔|牀 床|牆 墙|牘 牍|牽 牵|犖 荦|犛 牦|犞 𪺭|犢 犊|犧 牺|狀 状|狹 狭|狽 狈|猌 𪺽|猙 狰|猶 犹|猻 狲|獁 犸|獃 呆|獄 狱|獅 狮|獊 𪺷|獎 奖|獨 独|獩 𤞃|獪 狯|獫 猃|獮 狝|獰 狞|獱 㺍|獲 获|獵 猎|獷 犷|獸 兽|獺 獭|獻 献|獼 猕|玀 猡|玁 𤞤|珼 𫞥|現 现|琱 雕|琺 珐|琿 珲|瑋 玮|瑒 玚|瑣 琐|瑤 瑶|瑩 莹|瑪 玛|瑲 玱|瑻 𪻲|瑽 𪻐|璉 琏|璊 𫞩|璕 𬍤|璗 𬍡|璝 𪻺|璡 琎|璣 玑|璦 瑷|璫 珰|璯 㻅|環 环|璵 玙|璸 瑸|璼 𫞨|璽 玺|璾 𫞦|璿 璇|瓄 𪻨|瓅 𬍛|瓊 琼|瓏 珑|瓔 璎|瓕 𤦀|瓚 瓒|瓛 𤩽|甌 瓯|甕 瓮|產 产|産 产|甦 苏|甯 宁|畝 亩|畢 毕|畫 画|異 异|畵 画|當 当|畼 𪽈|疇 畴|疊 叠|痙 痉|痠 酸|痮 𪽪|痾 疴|瘂 痖|瘋 疯|瘍 疡|瘓 痪|瘞 瘗|瘡 疮|瘧 疟|瘮 瘆|瘱 𪽷|瘲 疭|瘺 瘘|瘻 瘘|療 疗|癆 痨|癇 痫|癉 瘅|癐 𤶊|癒 愈|癘 疠|癟 瘪|癡 痴|癢 痒|癤 疖|癥 症|癧 疬|癩 癞|癬 癣|癭 瘿|癮 瘾|癰 痈|癱 瘫|癲 癫|發 发|皁 皂|皚 皑|皟 𤾀|皰 疱|皸 皲|皺 皱|盃 杯|盜 盗|盞 盏|盡 尽|監 监|盤 盘|盧 卢|盨 𪾔|盪 荡|眝 𪾣|眞 真|眥 眦|眾 众|睍 𪾢|睏 困|睜 睁|睞 睐|瞘 眍|瞜 䁖|瞞 瞒|瞤 𥆧|瞶 瞆|瞼 睑|矇 蒙|矉 𪾸|矑 𪾦|矓 眬|矚 瞩|矯 矫|硃 朱|硜 硁|硤 硖|硨 砗|硯 砚|碕 埼|碙 𥐻|碩 硕|碭 砀|碸 砜|確 确|碼 码|碽 䂵|磑 硙|磚 砖|磠 硵|磣 碜|磧 碛|磯 矶|磽 硗|磾 䃅|礄 硚|礆 硷|礎 础|礐 𬒈|礒 𥐟|礙 碍|礦 矿|礪 砺|礫 砾|礬 矾|礮 𪿫|礱 砻|祕 秘|祿 禄|禍 祸|禎 祯|禕 祎|禡 祃|禦 御|禪 禅|禮 礼|禰 祢|禱 祷|禿 秃|秈 籼|稅 税|稈 秆|稏 䅉|稜 棱|稟 禀|種 种|稱 称|穀 谷|穇 䅟|穌 稣|積 积|穎 颖|穠 秾|穡 穑|穢 秽|穩 稳|穫 获|穭 穞|窩 窝|窪 洼|窮 穷|窯 窑|窵 窎|窶 窭|窺 窥|竄 窜|竅 窍|竇 窦|竈 灶|竊 窃|竚 𥩟|竪 竖|竱 𫁟|競 竞|筆 笔|筍 笋|筧 笕|筴 䇲|箇 个|箋 笺|箏 筝|節 节|範 范|築 筑|篋 箧|篔 筼|篘 𥬠|篠 筿|篢 𬕂|篤 笃|篩 筛|篳 筚|篸 𥮾|簀 箦|簂 𫂆|簍 篓|簑 蓑|簞 箪|簡 简|簢 𫂃|簣 篑|簫 箫|簹 筜|簽 签|簾 帘|籃 篮|籅 𥫣|籋 𥬞|籌 筹|籔 䉤|籙 箓|籛 篯|籜 箨|籟 籁|籠 笼|籤 签|籩 笾|籪 簖|籬 篱|籮 箩|籲 吁|粵 粤|糉 粽|糝 糁|糞 粪|糧 粮|糰 团|糲 粝|糴 籴|糶 粜|糹 纟|糺 𫄙|糾 纠|紀 纪|紂 纣|紃 𬘓|約 约|紅 红|紆 纡|紇 纥|紈 纨|紉 纫|紋 纹|納 纳|紐 纽|紓 纾|純 纯|紕 纰|紖 纼|紗 纱|紘 纮|紙 纸|級 级|紛 纷|紜 纭|紝 纴|紞 𬘘|紟 𫄛|紡 纺|紬 䌷|紮 扎|細 细|紱 绂|紲 绁|紳 绅|紵 纻|紹 绍|紺 绀|紼 绋|紿 绐|絀 绌|絁 𫄟|終 终|絃 弦|組 组|絅 䌹|絆 绊|絍 𫟃|絎 绗|結 结|絕 绝|絙 𫄠|絛 绦|絝 绔|絞 绞|絡 络|絢 绚|絥 𫄢|給 给|絧 𫄡|絨 绒|絪 𬘡|絰 绖|統 统|絲 丝|絳 绛|絶 绝|絹 绢|絺 𫄨|綀 𦈌|綁 绑|綃 绡|綄 𬘫|綆 绠|綇 𦈋|綈 绨|綉 绣|綋 𫟄|綌 绤|綎 𬘩|綏 绥|綐 䌼|綑 捆|經 经|綖 𫄧|綜 综|綝 𬘭|綞 缍|綟 𫄫|綠 绿|綡 𫟅|綢 绸|綣 绻|綧 𬘯|綪 𬘬|綫 线|綬 绶|維 维|綯 绹|綰 绾|綱 纲|網 网|綳 绷|綴 缀|綵 彩|綸 纶|綹 绺|綺 绮|綻 绽|綽 绰|綾 绫|綿 绵|緄 绲|緇 缁|緊 紧|緋 绯|緍 𦈏|緑 绿|緒 绪|緓 绬|緔 绱|緗 缃|緘 缄|緙 缂|線 线|緝 缉|緞 缎|緟 𫟆|締 缔|緡 缗|緣 缘|緤 𫄬|緦 缌|編 编|緩 缓|緬 缅|緮 𫄭|緯 纬|緰 𦈕|緱 缑|緲 缈|練 练|緶 缏|緷 𦈉|緸 𦈑|緹 缇|緻 致|緼 缊|縈 萦|縉 缙|縊 缢|縋 缒|縍 𫄰|縎 𦈔|縐 绉|縑 缣|縕 缊|縗 缞|縛 缚|縝 缜|縞 缟|縟 缛|縣 县|縧 绦|縫 缝|縬 𦈚|縭 缡|縮 缩|縯 𬙂|縰 𫄳|縱 纵|縲 缧|縳 䌸|縴 纤|縵 缦|縶 絷|縷 缕|縸 𫄲|縹 缥|縺 𦈐|總 总|績 绩|繂 𫄴|繃 绷|繅 缫|繆 缪|繈 𫄶|繏 𦈝|繐 𰬸|繒 缯|繓 𦈛|織 织|繕 缮|繚 缭|繞 绕|繟 𦈎|繡 绣|繢 缋|繨 𫄤|繩 绳|繪 绘|繫 系|繬 𫄱|繭 茧|繮 缰|繯 缳|繰 缲|繳 缴|繶 𫄷|繷 𫄣|繸 䍁|繹 绎|繻 𦈡|繼 继|繽 缤|繾 缱|繿 䍀|纁 𫄸|纆 𬙊|纇 颣|纈 缬|纊 纩|續 续|纍 累|纏 缠|纓 缨|纔 才|纕 𬙋|纖 纤|纗 𫄹|纘 缵|纚 𫄥|纜 缆|缽 钵|罃 䓨|罈 坛|罌 罂|罎 坛|罰 罚|罵 骂|罷 罢|羅 罗|羆 罴|羈 羁|羋 芈|羣 群|羥 羟|羨 羡|義 义|羵 𫅗|羶 膻|習 习|翫 玩|翬 翚|翹 翘|翽 翙|耬 耧|耮 耢|聖 圣|聞 闻|聯 联|聰 聪|聲 声|聳 耸|聵 聩|聶 聂|職 职|聹 聍|聻 𫆏|聽 听|聾 聋|肅 肃|脅 胁|脈 脉|脛 胫|脣 唇|脥 𣍰|脩 修|脫 脱|脹 胀|腎 肾|腖 胨|腡 脶|腦 脑|腪 𣍯|腫 肿|腳 脚|腸 肠|膃 腽|膕 腘|膚 肤|膞 䏝|膠 胶|膢 𦝼|膩 腻|膹 𪱥|膽 胆|膾 脍|膿 脓|臉 脸|臍 脐|臏 膑|臗 𣎑|臘 腊|臚 胪|臟 脏|臠 脔|臢 臜|臥 卧|臨 临|臺 台|與 与|興 兴|舉 举|舊 旧|舘 馆|艙 舱|艣 𫇛|艤 舣|艦 舰|艫 舻|艱 艰|艷 艳|芻 刍|苧 苎|茲 兹|荊 荆|莊 庄|莖 茎|莢 荚|莧 苋|菕 𰰨|華 华|菴 庵|菸 烟|萇 苌|萊 莱|萬 万|萴 荝|萵 莴|葉 叶|葒 荭|葝 𫈎|葤 荮|葦 苇|葯 药|葷 荤|蒍 𫇭|蒐 搜|蒓 莼|蒔 莳|蒕 蒀|蒞 莅|蒭 𫇴|蒼 苍|蓀 荪|蓆 席|蓋 盖|蓧 𦰏|蓮 莲|蓯 苁|蓴 莼|蓽 荜|蔄 𬜬|蔔 卜|蔘 参|蔞 蒌|蔣 蒋|蔥 葱|蔦 茑|蔭 荫|蔯 𫈟|蔿 𫇭|蕁 荨|蕆 蒇|蕎 荞|蕒 荬|蕓 芸|蕕 莸|蕘 荛|蕝 𫈵|蕢 蒉|蕩 荡|蕪 芜|蕭 萧|蕳 𫈉|蕷 蓣|蕽 𫇽|薀 蕰|薆 𫉁|薈 荟|薊 蓟|薌 芗|薑 姜|薔 蔷|薘 荙|薟 莶|薦 荐|薩 萨|薳 䓕|薴 苧|薵 䓓|薹 苔|薺 荠|藍 蓝|藎 荩|藝 艺|藥 药|藪 薮|藭 䓖|藴 蕴|藶 苈|藷 𫉄|藹 蔼|藺 蔺|蘀 萚|蘄 蕲|蘆 芦|蘇 苏|蘊 蕴|蘋 苹|蘚 藓|蘞 蔹|蘟 𦻕|蘢 茏|蘭 兰|蘺 蓠|蘿 萝|虆 蔂|虉 𬟁|處 处|虛 虚|虜 虏|號 号|虧 亏|虯 虬|蛺 蛱|蛻 蜕|蜆 蚬|蝀 𬟽|蝕 蚀|蝟 猬|蝦 虾|蝨 虱|蝸 蜗|螄 蛳|螞 蚂|螢 萤|螮 䗖|螻 蝼|螿 螀|蟂 𫋇|蟄 蛰|蟈 蝈|蟎 螨|蟘 𫋌|蟜 𫊸|蟣 虮|蟬 蝉|蟯 蛲|蟲 虫|蟳 𫊻|蟶 蛏|蟻 蚁|蠀 𧏗|蠁 蚃|蠅 蝇|蠆 虿|蠍 蝎|蠐 蛴|蠑 蝾|蠔 蚝|蠙 𧏖|蠟 蜡|蠣 蛎|蠦 𫊮|蠨 蟏|蠱 蛊|蠶 蚕|蠻 蛮|蠾 𧑏|衆 众|衊 蔑|術 术|衕 同|衚 胡|衛 卫|衝 冲|袞 衮|裊 袅|裏 里|補 补|裝 装|裡 里|製 制|複 复|褌 裈|褘 袆|褲 裤|褳 裢|褸 褛|褻 亵|襀 𫌀|襇 裥|襉 裥|襏 袯|襓 𫋹|襖 袄|襗 𫋷|襘 𫋻|襝 裣|襠 裆|襤 褴|襪 袜|襬 摆|襯 衬|襰 𧝝|襲 袭|襴 襕|襵 𫌇|覈 核|見 见|覎 觃|規 规|覓 觅|視 视|覘 觇|覛 𫌪|覡 觋|覥 觍|覦 觎|親 亲|覬 觊|覯 觏|覲 觐|覷 觑|覹 𫌭|覺 觉|覼 𫌨|覽 览|覿 觌|觀 观|觴 觞|觶 觯|觸 触|訁 讠|訂 订|訃 讣|計 计|訊 讯|訌 讧|討 讨|訏 𬣙|訐 讦|訑 𫍙|訒 讱|訓 训|訕 讪|訖 讫|託 托|記 记|訛 讹|訜 𫍛|訝 讶|訞 𫍚|訟 讼|訢 䜣|訣 诀|訥 讷|訨 𫟞|訩 讻|訪 访|設 设|許 许|訴 诉|訶 诃|診 诊|註 注|証 证|詀 𧮪|詁 诂|詆 诋|詊 𫟟|詎 讵|詐 诈|詑 𫍡|詒 诒|詓 𫍜|詔 诏|評 评|詖 诐|詗 诇|詘 诎|詛 诅|詝 𬣞|詞 词|詠 咏|詡 诩|詢 询|詣 诣|試 试|詩 诗|詪 𬣳|詫 诧|詬 诟|詭 诡|詮 诠|詰 诘|話 话|該 该|詳 详|詵 诜|詷 𫍣|詼 诙|詿 诖|誂 𫍥|誄 诔|誅 诛|誆 诓|誇 夸|誋 𫍪|誌 志|認 认|誑 诳|誒 诶|誕 诞|誘 诱|誚 诮|語 语|誠 诚|誡 诫|誣 诬|誤 误|誥 诰|誦 诵|誨 诲|說 说|誫 𫍨|説 说|誰 谁|課 课|誳 𫍮|誴 𫟡|誶 谇|誷 𫍬|誹 诽|誺 𫍧|誼 谊|誾 訚|調 调|諂 谄|諄 谆|談 谈|諉 诿|請 请|諍 诤|諏 诹|諑 诼|諒 谅|諓 𬣡|論 论|諗 谂|諛 谀|諜 谍|諝 谞|諞 谝|諟 𬤊|諡 谥|諢 诨|諣 𫍩|諤 谔|諥 𫍳|諦 谛|諧 谐|諫 谏|諭 谕|諮 咨|諯 𫍱|諰 𫍰|諱 讳|諲 𬤇|諳 谙|諴 𫍯|諶 谌|諷 讽|諸 诸|諺 谚|諼 谖|諾 诺|謀 谋|謁 谒|謂 谓|謄 誊|謅 诌|謆 𫍸|謉 𫍷|謊 谎|謎 谜|謏 𫍲|謐 谧|謔 谑|謖 谡|謗 谤|謙 谦|謚 谥|講 讲|謝 谢|謠 谣|謡 谣|謨 谟|謫 谪|謬 谬|謭 谫|謯 𫍹|謱 𫍴|謳 讴|謸 𫍵|謹 谨|謾 谩|譁 哗|譂 𫟠|譅 𰶎|譆 𫍻|證 证|譊 𫍢|譎 谲|譏 讥|譑 𫍤|譓 𬤝|譖 谮|識 识|譙 谯|譚 谭|譜 谱|譞 𫍽|譟 噪|譨 𫍦|譫 谵|譭 毁|譯 译|議 议|譴 谴|護 护|譸 诪|譽 誉|譾 谫|讀 读|讅 谉|變 变|讋 詟|讌 䜩|讎 雠|讒 谗|讓 让|讕 谰|讖 谶|讚 赞|讜 谠|讞 谳|豈 岂|豎 竖|豐 丰|豔 艳|豬 猪|豵 𫎆|豶 豮|貓 猫|貗 𫎌|貙 䝙|貝 贝|貞 贞|貟 贠|負 负|財 财|貢 贡|貧 贫|貨 货|販 贩|貪 贪|貫 贯|責 责|貯 贮|貰 贳|貲 赀|貳 贰|貴 贵|貶 贬|買 买|貸 贷|貺 贶|費 费|貼 贴|貽 贻|貿 贸|賀 贺|賁 贲|賂 赂|賃 赁|賄 贿|賅 赅|資 资|賈 贾|賊 贼|賑 赈|賒 赊|賓 宾|賕 赇|賙 赒|賚 赉|賜 赐|賝 𫎩|賞 赏|賟 𧹖|賠 赔|賡 赓|賢 贤|賣 卖|賤 贱|賦 赋|賧 赕|質 质|賫 赍|賬 账|賭 赌|賰 䞐|賴 赖|賵 赗|賺 赚|賻 赙|購 购|賽 赛|賾 赜|贃 𧹗|贄 贽|贅 赘|贇 赟|贈 赠|贉 𫎫|贊 赞|贋 赝|贍 赡|贏 赢|贐 赆|贑 𫎬|贓 赃|贔 赑|贖 赎|贗 赝|贚 𫎦|贛 赣|贜 赃|赬 赪|趕 赶|趙 赵|趨 趋|趲 趱|跡 迹|踐 践|踰 逾|踴 踊|蹌 跄|蹔 𫏐|蹕 跸|蹟 迹|蹠 跖|蹣 蹒|蹤 踪|蹳 𫏆|蹺 跷|蹻 𫏋|躂 跶|躉 趸|躊 踌|躋 跻|躍 跃|躎 䟢|躑 踯|躒 跞|躓 踬|躕 蹰|躘 𨀁|躚 跹|躝 𨅬|躡 蹑|躥 蹿|躦 躜|躪 躏|軀 躯|軉 𨉗|車 车|軋 轧|軌 轨|軍 军|軏 𫐄|軑 轪|軒 轩|軔 轫|軕 𫐅|軗 𨐅|軛 轭|軜 𫐇|軝 𬨂|軟 软|軤 轷|軨 𫐉|軫 轸|軬 𫐊|軲 轱|軷 𫐈|軸 轴|軹 轵|軺 轺|軻 轲|軼 轶|軾 轼|軿 𫐌|較 较|輄 𨐈|輅 辂|輇 辁|輈 辀|載 载|輊 轾|輋 𪨶|輒 辄|輓 挽|輔 辅|輕 轻|輖 𫐏|輗 𫐐|輛 辆|輜 辎|輝 辉|輞 辋|輟 辍|輢 𫐎|輥 辊|輦 辇|輨 𫐑|輩 辈|輪 轮|輬 辌|輮 𫐓|輯 辑|輳 辏|輶 𬨎|輷 𫐒|輸 输|輻 辐|輼 辒|輾 辗|輿 舆|轀 辒|轂 毂|轄 辖|轅 辕|轆 辘|轇 𫐖|轉 转|轊 𫐕|轍 辙|轎 轿|轐 𫐗|轔 辚|轗 𫐘|轟 轰|轠 𫐙|轡 辔|轢 轹|轣 𫐆|轤 轳|辦 办|辭 辞|辮 辫|辯 辩|農 农|迴 回|逕 迳|這 这|連 连|週 周|進 进|遊 游|運 运|過 过|達 达|違 违|遙 遥|遜 逊|遞 递|遠 远|遡 溯|適 适|遱 𫐷|遲 迟|遷 迁|選 选|遺 遗|遼 辽|邁 迈|還 还|邇 迩|邊 边|邏 逻|邐 逦|郟 郏|郵 邮|鄆 郓|鄉 乡|鄒 邹|鄔 邬|鄖 郧|鄟 𫑘|鄧 邓|鄩 𬩽|鄭 郑|鄰 邻|鄲 郸|鄳 𫑡|鄴 邺|鄶 郐|鄺 邝|酇 酂|酈 郦|醃 腌|醖 酝|醜 丑|醞 酝|醟 蒏|醣 糖|醫 医|醬 酱|醱 酦|醲 𬪩|醶 𫑷|釀 酿|釁 衅|釃 酾|釅 酽|釋 释|釐 厘|釒 钅|釓 钆|釔 钇|釕 钌|釗 钊|釘 钉|釙 钋|釚 𫟲|針 针|釟 𫓥|釣 钓|釤 钐|釦 扣|釧 钏|釨 𫓦|釩 钒|釲 𫟳|釳 𨰿|釴 𬬩|釵 钗|釷 钍|釹 钕|釺 钎|釾 䥺|釿 𬬱|鈀 钯|鈁 钫|鈃 钘|鈄 钭|鈅 钥|鈆 𫓪|鈇 𫓧|鈈 钚|鈉 钠|鈋 𨱂|鈍 钝|鈎 钩|鈐 钤|鈑 钣|鈒 钑|鈔 钞|鈕 钮|鈖 𫟴|鈗 𫟵|鈛 𫓨|鈞 钧|鈠 𨱁|鈡 钟|鈣 钙|鈥 钬|鈦 钛|鈧 钪|鈮 铌|鈯 𨱄|鈰 铈|鈲 𨱃|鈳 钶|鈴 铃|鈷 钴|鈸 钹|鈹 铍|鈺 钰|鈽 钸|鈾 铀|鈿 钿|鉀 钾|鉁 𨱅|鉅 巨|鉆 钻|鉈 铊|鉉 铉|鉊 𬬿|鉋 铇|鉍 铋|鉑 铂|鉔 𫓬|鉕 钷|鉗 钳|鉚 铆|鉛 铅|鉝 𫟷|鉞 钺|鉠 𫓭|鉢 钵|鉤 钩|鉥 𬬸|鉦 钲|鉧 𬭁|鉬 钼|鉭 钽|鉮 𬬹|鉳 锫|鉶 铏|鉷 𫟹|鉸 铰|鉺 铒|鉻 铬|鉽 𫟸|鉾 𫓴|鉿 铪|銀 银|銁 𫓲|銂 𫟻|銃 铳|銅 铜|銈 𫓯|銊 𫓰|銍 铚|銏 𫟶|銑 铣|銓 铨|銖 铢|銘 铭|銚 铫|銛 铦|銜 衔|銠 铑|銣 铷|銥 铱|銦 铟|銨 铵|銩 铥|銪 铕|銫 铯|銬 铐|銱 铞|銳 锐|銶 𨱇|銷 销|銹 锈|銻 锑|銼 锉|鋁 铝|鋂 𰾄|鋃 锒|鋅 锌|鋇 钡|鋉 𨱈|鋌 铤|鋏 铗|鋐 𬭎|鋒 锋|鋗 𫓶|鋙 铻|鋝 锊|鋟 锓|鋠 𫓵|鋣 铘|鋤 锄|鋥 锃|鋦 锔|鋨 锇|鋩 铓|鋪 铺|鋭 锐|鋮 铖|鋯 锆|鋰 锂|鋱 铽|鋶 锍|鋸 锯|鋹 𬬮|鋼 钢|錀 𬬭|錁 锞|錂 𨱋|錄 录|錆 锖|錇 锫|錈 锩|錏 铔|錐 锥|錒 锕|錕 锟|錘 锤|錙 锱|錚 铮|錛 锛|錜 𫓻|錝 𫓽|錞 𬭚|錟 锬|錠 锭|錡 锜|錢 钱|錤 𫓹|錥 𫓾|錦 锦|錨 锚|錩 锠|錫 锡|錮 锢|錯 错|録 录|錳 锰|錶 表|錸 铼|錼 镎|錽 𫓸|鍀 锝|鍁 锨|鍃 锪|鍄 𨱉|鍅 钫|鍆 钔|鍇 锴|鍈 锳|鍉 𫔂|鍊 炼|鍋 锅|鍍 镀|鍒 𫔄|鍔 锷|鍘 铡|鍚 钖|鍛 锻|鍠 锽|鍤 锸|鍥 锲|鍩 锘|鍬 锹|鍭 𬭤|鍮 𨱎|鍰 锾|鍵 键|鍶 锶|鍺 锗|鍼 针|鍾 钟|鎂 镁|鎄 锿|鎇 镅|鎈 𫟿|鎊 镑|鎌 镰|鎍 𫔅|鎓 𬭩|鎔 镕|鎖 锁|鎘 镉|鎙 𫔈|鎚 锤|鎛 镈|鎝 𨱏|鎞 𫔇|鎡 镃|鎢 钨|鎣 蓥|鎦 镏|鎧 铠|鎩 铩|鎪 锼|鎬 镐|鎭 镇|鎮 镇|鎯 𨱍|鎰 镒|鎲 镋|鎳 镍|鎵 镓|鎶 鿔|鎷 𨰾|鎸 镌|鎿 镎|鏃 镞|鏆 𨱌|鏇 旋|鏈 链|鏉 𨱒|鏌 镆|鏍 镙|鏏 𬭬|鏐 镠|鏑 镝|鏗 铿|鏘 锵|鏚 𬭭|鏜 镗|鏝 镘|鏞 镛|鏟 铲|鏡 镜|鏢 镖|鏤 镂|鏥 𫔊|鏦 𫓩|鏨 錾|鏰 镚|鏵 铧|鏷 镤|鏹 镪|鏺 䥽|鏻 𬭸|鏽 锈|鏾 𫔌|鐃 铙|鐄 𨱑|鐇 𫔍|鐈 𫓱|鐋 铴|鐍 𫔎|鐎 𨱓|鐏 𨱔|鐐 镣|鐒 铹|鐓 镦|鐔 镡|鐘 钟|鐙 镫|鐝 镢|鐠 镨|鐥 䦅|鐦 锎|鐧 锏|鐨 镄|鐩 𬭼|鐪 𫓺|鐫 镌|鐮 镰|鐯 䦃|鐲 镯|鐳 镭|鐵 铁|鐶 镮|鐸 铎|鐺 铛|鐼 𫔁|鐽 𫟼|鐿 镱|鑀 𰾭|鑄 铸|鑉 𫠁|鑊 镬|鑌 镔|鑑 鉴|鑒 鉴|鑔 镲|鑕 锧|鑞 镴|鑠 铄|鑣 镳|鑥 镥|鑪 𬬻|鑭 镧|鑰 钥|鑱 镵|鑲 镶|鑴 𫔔|鑷 镊|鑹 镩|鑼 锣|鑽 钻|鑾 銮|鑿 凿|钁 镢|钂 镋|長 长|門 门|閂 闩|閃 闪|閆 闫|閈 闬|閉 闭|開 开|閌 闶|閍 𨸂|閎 闳|閏 闰|閐 𨸃|閑 闲|閒 闲|間 间|閔 闵|閗 𫔯|閘 闸|閝 𫠂|閞 𫔰|閡 阂|閣 阁|閤 合|閥 阀|閨 闺|閩 闽|閫 阃|閬 阆|閭 闾|閱 阅|閲 阅|閵 𫔴|閶 阊|閹 阉|閻 阎|閼 阏|閽 阍|閾 阈|閿 阌|闃 阒|闆 板|闇 暗|闈 闱|闉 𬮱|闊 阔|闋 阕|闌 阑|闍 阇|闐 阗|闑 𫔶|闒 阘|闓 闿|闔 阖|闕 阙|闖 闯|關 关|闞 阚|闠 阓|闡 阐|闢 辟|闤 阛|闥 闼|陘 陉|陝 陕|陞 升|陣 阵|陰 阴|陳 陈|陸 陆|陽 阳|隉 陧|隊 队|階 阶|隑 𬮿|隕 陨|際 际|隤 𬯎|隨 随|險 险|隮 𬯀|隯 陦|隱 隐|隴 陇|隸 隶|隻 只|雋 隽|雖 虽|雙 双|雛 雏|雜 杂|雞 鸡|離 离|難 难|雲 云|電 电|霑 沾|霢 霡|霣 𫕥|霧 雾|霼 𪵣|霽 霁|靂 雳|靄 霭|靆 叇|靈 灵|靉 叆|靚 靓|靜 静|靝 靔|靦 腼|靧 𫖃|靨 靥|鞏 巩|鞝 绱|鞦 秋|鞽 鞒|鞾 𫖇|韁 缰|韃 鞑|韆 千|韉 鞯|韋 韦|韌 韧|韍 韨|韓 韩|韙 韪|韚 𫠅|韛 𫖔|韜 韬|韝 鞲|韞 韫|韠 𫖒|韻 韵|響 响|頁 页|頂 顶|頃 顷|項 项|順 顺|頇 顸|須 须|頊 顼|頌 颂|頍 𫠆|頎 颀|頏 颃|預 预|頑 顽|頒 颁|頓 顿|頔 𬱖|頗 颇|領 领|頜 颌|頠 𬱟|頡 颉|頤 颐|頦 颏|頫 𫖯|頭 头|頮 颒|頰 颊|頲 颋|頴 颕|頵 𫖳|頷 颔|頸 颈|頹 颓|頻 频|頽 颓|顂 𩓋|顃 𩖖|顅 𫖶|顆 颗|題 题|額 额|顎 颚|顏 颜|顒 颙|顓 颛|顔 颜|顗 𫖮|願 愿|顙 颡|顛 颠|類 类|顢 颟|顣 𫖹|顥 颢|顧 顾|顫 颤|顬 颥|顯 显|顰 颦|顱 颅|顳 颞|顴 颧|風 风|颭 飐|颮 飑|颯 飒|颰 𩙥|颱 台|颳 刮|颶 飓|颷 𩙪|颸 飔|颺 飏|颻 飖|颼 飕|颾 𩙫|飀 飗|飄 飘|飆 飙|飈 飚|飋 𫗋|飛 飞|飠 饣|飢 饥|飣 饤|飥 饦|飦 𫗞|飩 饨|飪 饪|飫 饫|飭 饬|飯 饭|飱 飧|飲 饮|飴 饴|飵 𫗢|飶 𫗣|飼 饲|飽 饱|飾 饰|飿 饳|餃 饺|餄 饸|餅 饼|餈 糍|餉 饷|養 养|餌 饵|餎 饹|餏 饻|餑 饽|餒 馁|餓 饿|餔 𫗦|餕 馂|餖 饾|餗 𫗧|餘 余|餚 肴|餛 馄|餜 馃|餞 饯|餡 馅|餦 𫗠|餧 𫗪|館 馆|餪 𫗬|餫 𫗥|餬 糊|餭 𫗮|餱 糇|餳 饧|餵 喂|餶 馉|餷 馇|餸 𩠌|餺 馎|餼 饩|餾 馏|餿 馊|饁 馌|饃 馍|饅 馒|饈 馐|饉 馑|饊 馓|饋 馈|饌 馔|饑 饥|饒 饶|饗 飨|饘 𫗴|饜 餍|饞 馋|饟 𫗵|饠 𫗩|饢 馕|馬 马|馭 驭|馮 冯|馯 𫘛|馱 驮|馳 驰|馴 驯|馹 驲|馼 𫘜|駁 驳|駃 𫘝|駉 𬳶|駊 𫘟|駎 𩧨|駐 驻|駑 驽|駒 驹|駓 𬳵|駔 驵|駕 驾|駘 骀|駙 驸|駚 𩧫|駛 驶|駝 驼|駞 𫘞|駟 驷|駡 骂|駢 骈|駤 𫘠|駧 𩧲|駩 𩧴|駪 𬳽|駫 𫘡|駭 骇|駰 骃|駱 骆|駶 𩧺|駸 骎|駻 𫘣|駼 𬳿|駿 骏|騁 骋|騂 骍|騃 𫘤|騄 𫘧|騅 骓|騉 𫘥|騊 𫘦|騌 骔|騍 骒|騎 骑|騏 骐|騑 𬴂|騔 𩨀|騖 骛|騙 骗|騚 𩨊|騜 𫘩|騝 𩨃|騞 𬴃|騟 𩨈|騠 𫘨|騤 骙|騧 䯄|騪 𩨄|騫 骞|騭 骘|騮 骝|騰 腾|騱 𫘬|騴 𫘫|騵 𫘪|騶 驺|騷 骚|騸 骟|騻 𫘭|騼 𫠋|騾 骡|驀 蓦|驁 骜|驂 骖|驃 骠|驄 骢|驅 驱|驊 骅|驋 𩧯|驌 骕|驍 骁|驎 𬴊|驏 骣|驓 𫘯|驕 骄|驗 验|驙 𫘰|驚 惊|驛 驿|驟 骤|驢 驴|驤 骧|驥 骥|驦 骦|驨 𫘱|驪 骊|驫 骉|骯 肮|髏 髅|髒 脏|體 体|髕 髌|髖 髋|髮 发|鬆 松|鬍 胡|鬖 𩭹|鬚 须|鬠 𫘽|鬢 鬓|鬥 斗|鬧 闹|鬨 哄|鬩 阋|鬮 阄|鬱 郁|鬹 鬶|魎 魉|魘 魇|魚 鱼|魛 鱽|魟 𫚉|魢 鱾|魥 𩽹|魦 𫚌|魨 鲀|魯 鲁|魴 鲂|魵 𫚍|魷 鱿|魺 鲄|魽 𫠐|鮀 𬶍|鮁 鲅|鮃 鲆|鮄 𫚒|鮅 𫚑|鮆 𫚖|鮈 𬶋|鮊 鲌|鮋 鲉|鮍 鲏|鮎 鲇|鮐 鲐|鮑 鲍|鮒 鲋|鮓 鲊|鮚 鲒|鮜 鲘|鮝 鲞|鮞 鲕|鮟 𩽾|鮠 𬶏|鮡 𬶐|鮣 䲟|鮤 𫚓|鮦 鲖|鮪 鲔|鮫 鲛|鮭 鲑|鮮 鲜|鮯 𫚗|鮰 𫚔|鮳 鲓|鮵 𫚛|鮶 鲪|鮸 𩾃|鮺 鲝|鮿 𫚚|鯀 鲧|鯁 鲠|鯄 𩾁|鯆 𫚙|鯇 鲩|鯉 鲤|鯊 鲨|鯒 鲬|鯔 鲻|鯕 鲯|鯖 鲭|鯗 鲞|鯛 鲷|鯝 鲴|鯞 𫚡|鯡 鲱|鯢 鲵|鯤 鲲|鯧 鲳|鯨 鲸|鯪 鲮|鯫 鲰|鯬 𫚞|鯰 鲶|鯱 𩾇|鯴 鲺|鯶 𩽼|鯷 鳀|鯻 𬶟|鯽 鲫|鯾 𫚣|鯿 鳊|鰁 鳈|鰂 鲗|鰃 鳂|鰆 䲠|鰈 鲽|鰉 鳇|鰊 𬶠|鰋 𫚢|鰌 䲡|鰍 鳅|鰏 鲾|鰐 鳄|鰑 𫚊|鰒 鳆|鰓 鳃|鰕 𫚥|鰛 鳁|鰜 鳒|鰟 鳑|鰠 鳋|鰣 鲥|鰤 𫚕|鰥 鳏|鰦 𫚤|鰧 䲢|鰨 鳎|鰩 鳐|鰫 𫚦|鰭 鳍|鰮 鳁|鰱 鲢|鰲 鳌|鰳 鳓|鰵 鳘|鰶 𬶭|鰷 鲦|鰹 鲣|鰺 鲹|鰻 鳗|鰼 鳛|鰽 𫚧|鰾 鳔|鱀 𬶨|鱂 鳉|鱄 𫚋|鱅 鳙|鱆 𫠒|鱇 𩾌|鱈 鳕|鱉 鳖|鱊 𫚪|鱒 鳟|鱔 鳝|鱖 鳜|鱗 鳞|鱘 鲟|鱚 𬶮|鱝 鲼|鱟 鲎|鱠 鲙|鱢 𫚫|鱣 鳣|鱤 鳡|鱧 鳢|鱨 鲿|鱭 鲚|鱮 𫚈|鱯 鳠|鱲 𫚭|鱷 鳄|鱸 鲈|鱺 鲡|鳥 鸟|鳧 凫|鳩 鸠|鳬 凫|鳲 鸤|鳳 凤|鳴 鸣|鳶 鸢|鳷 𫛛|鳼 𪉃|鳽 𫛚|鳾 䴓|鴀 𫛜|鴃 𫛞|鴅 𫛝|鴆 鸩|鴇 鸨|鴉 鸦|鴐 𫛤|鴒 鸰|鴔 𫛡|鴕 鸵|鴗 𫁡|鴛 鸳|鴜 𪉈|鴝 鸲|鴞 鸮|鴟 鸱|鴣 鸪|鴥 𫛣|鴦 鸯|鴨 鸭|鴮 𫛦|鴯 鸸|鴰 鸹|鴲 𪉆|鴳 𫛩|鴴 鸻|鴷 䴕|鴻 鸿|鴽 𫛪|鴿 鸽|鵁 䴔|鵂 鸺|鵃 鸼|鵊 𫛥|鵏 𬷕|鵐 鹀|鵑 鹃|鵒 鹆|鵓 鹁|鵚 𪉍|鵜 鹈|鵝 鹅|鵟 𫛭|鵠 鹄|鵡 鹉|鵧 𫛨|鵩 𫛳|鵪 鹌|鵫 𫛱|鵬 鹏|鵮 鹐|鵯 鹎|鵰 雕|鵲 鹊|鵷 鹓|鵾 鹍|鶄 䴖|鶇 鸫|鶉 鹑|鶊 鹒|鶌 𫛵|鶒 𫛶|鶓 鹋|鶖 鹙|鶗 𫛸|鶘 鹕|鶚 鹗|鶠 𬸘|鶡 鹖|鶥 鹛|鶦 𫛷|鶩 鹜|鶪 䴗|鶬 鸧|鶭 𫛯|鶯 莺|鶰 𫛫|鶱 𬸣|鶲 鹟|鶴 鹤|鶹 鹠|鶺 鹡|鶻 鹘|鶼 鹣|鶿 鹚|鷀 鹚|鷁 鹢|鷂 鹞|鷄 鸡|鷅 𫛽|鷉 䴘|鷊 鹝|鷐 𫜀|鷓 鹧|鷔 𪉑|鷖 鹥|鷗 鸥|鷙 鸷|鷚 鹨|鷟 𬸦|鷣 𫜃|鷤 𫛴|鷥 鸶|鷦 鹪|鷨 𪉊|鷩 𫜁|鷫 鹔|鷭 𬸪|鷯 鹩|鷲 鹫|鷳 鹇|鷴 鹇|鷷 𫜄|鷸 鹬|鷹 鹰|鷺 鹭|鷽 鸴|鷿 𬸯|鸂 㶉|鸇 鹯|鸊 䴙|鸋 𫛢|鸌 鹱|鸏 鹲|鸑 𬸚|鸕 鸬|鸗 𫛟|鸘 鹴|鸚 鹦|鸛 鹳|鸝 鹂|鸞 鸾|鹵 卤|鹹 咸|鹺 鹾|鹼 碱|鹽 盐|麗 丽|麥 麦|麨 𪎊|麩 麸|麪 面|麫 面|麬 𤿲|麯 曲|麲 𪎉|麳 𪎌|麴 曲|麵 面|麷 𫜑|麼 么|麽 么|黃 黄|黌 黉|點 点|黨 党|黲 黪|黴 霉|黶 黡|黷 黩|黽 黾|黿 鼋|鼂 鼌|鼉 鼍|鼕 冬|鼴 鼹|齊 齐|齋 斋|齎 赍|齏 齑|齒 齿|齔 龀|齕 龁|齗 龂|齘 𬹼|齙 龅|齜 龇|齟 龃|齠 龆|齡 龄|齣 出|齦 龈|齧 啮|齩 𫜪|齪 龊|齬 龉|齭 𫜭|齮 𬺈|齯 𫠜|齰 𫜬|齲 龋|齴 𫜮|齶 腭|齷 龌|齼 𬺓|齾 𫜰|龍 龙|龎 厐|龐 庞|龑 䶮|龓 𫜲|龔 龚|龕 龛|龜 龟|龭 𩨎|龯 𨱆|鿁 䜤|鿓 鿒|𠁞 𠀾|𠌥 𠆿|𠏢 𠉗|𠐊 𫝋|𠗣 㓆|𠞆 𠛆|𠠎 𠚳|𠬙 𪠡|𠽃 𪠺|𠿕 𪜎|𡂡 𪢒|𡃄 𪡺|𡃕 𠴛|𡃤 𪢐|𡄔 𠴢|𡄣 𠵸|𡅏 𠲥|𡅯 𪢖|𡑍 𫭼|𡑭 𡋗|𡓁 𪤄|𡓾 𡋀|𡔖 𡍣|𡞵 㛟|𡟫 𫝪|𡠹 㛿|𡢃 㛠|𡮉 𡭜|𡮣 𡭬|𡳳 𡳃|𡸗 𪨩|𡹬 𪨹|𡻕 岁|𡽗 𡸃|𡾱 㟜|𡿖 𪩛|𢍰 𪪴|𢠼 𢙑|𢣐 𪬚|𢣚 𢘝|𢣭 𢘞|𢤩 𪫡|𢤱 𢘙|𢤿 𪬯|𢯷 𪭝|𢶒 𪭯|𢶫 𢫞|𢷮 𢫊|𢹿 𢬦|𢺳 𪮳|𣈶 暅|𣋋 𣈣|𣍐 𫧃|𣙎 㭣|𣜬 𪳗|𣝕 𣘷|𣞻 𣘓|𣠩 𣞎|𣠲 𣑶|𣯩 𣯣|𣯴 𣭤|𣯶 毶|𣽏 𪶮|𣾷 㳢|𣿉 𣶫|𤁣 𣺽|𤄷 𪶒|𤅶 𣷷|𤑳 𤎻|𤑹 𪹀|𤒎 𤊀|𤒻 𪹹|𤓌 𪹠|𤓎 𤎺|𤓩 𤊰|𤘀 𪺣|𤛮 𤙯|𤛱 𫞢|𤜆 𪺪|𤠮 𪺸|𤢟 𤝢|𤢻 𢢐|𤩂 𫞧|𤪺 㻘|𤫩 㻏|𤬅 𪼴|𤳷 𪽝|𤳸 𤳄|𤷃 𪽭|𤸫 𤶧|𤺔 𪽴|𥊝 𥅿|𥌃 𥅘|𥏝 𪿊|𥕥 𥐰|𥖅 𥐯|𥖲 𪿞|𥗇 𪿵|𥗽 𬒗|𥜐 𫀓|𥜰 𫀌|𥞵 𥞦|𥢢 䅪|𥢶 𫞷|𥢷 𫀮|𥨐 𥧂|𥪂 𥩺|𥯤 𫁳|𥴨 𫂖|𥴼 𫁺|𥵃 𥱔|𥵊 𥭉|𥶽 𫁱|𥸠 𥮋|𥻦 𫂿|𥼽 𥹥|𥽖 𥺇|𥾯 𫄝|𥿊 𦈈|𦀖 𫄦|𦂅 𦈒|𦃄 𦈗|𦃩 𫄯|𦅇 𫄪|𦅈 𫄵|𦆲 𫟇|𦒀 𫅥|𦔖 𫅼|𦘧 𡳒|𦟼 𫆝|𦠅 𫞅|𦡝 𫆫|𦢈 𣍨|𦣎 𦟗|𦧺 𫇘|𦪙 䑽|𦪽 𦨩|𦱌 𫇪|𦾟 𦶻|𧎈 𧌥|𧒯 𫊹|𧔥 𧒭|𧕟 𧉐|𧜗 䘞|𧜵 䙊|𧝞 䘛|𧞫 𫌋|𧟀 𧝧|𧡴 𫌫|𧢄 𫌬|𧦝 𫍞|𧦧 𫍟|𧩕 𫍭|𧩙 䜥|𧩼 𫍶|𧫝 𫍺|𧬤 𫍼|𧭈 𫍾|𧭹 𫍐|𧳟 𧳕|𧵳 䞌|𧶔 𧹓|𧶧 䞎|𧷎 𪠀|𧸘 𫎨|𧹈 𪥠|𧽯 𫎸|𨂐 𫏌|𨄣 𨀱|𨅍 𨁴|𨆪 𫏕|𨇁 𧿈|𨇞 𨅫|𨇤 𫏨|𨇰 𫏞|𨇽 𫏑|𨈊 𨂺|𨈌 𨄄|𨊰 䢀|𨊸 䢁|𨊻 𨐆|𨋢 䢂|𨌈 𫐍|𨍰 𫐔|𨎌 𫐋|𨎮 𨐉|𨏠 𨐇|𨏥 𨐊|𨞺 𫟫|𨟊 𫟬|𨢿 𨡙|𨣈 𨡺|𨣞 𨟳|𨣧 𨠨|𨤻 𨤰|𨥛 𨱀|𨥟 𫓫|𨦫 䦀|𨧀 𬭊|𨧜 䦁|𨧰 𫟽|𨧱 𨱊|𨨏 𬭛|𨨛 𫓼|𨨢 𫓿|𨩰 𫟾|𨪕 𫓮|𨫒 𨱐|𨬖 𫔏|𨭆 𬭶|𨭎 𬭳|𨭖 𫔑|𨭸 𫔐|𨮂 𨱕|𨮳 𫔒|𨯅 䥿|𨯟 𫔓|𨰃 𫔉|𨰋 𫓳|𨰥 𫔕|𨰲 𫔃|𨲳 𫔖|𨳑 𨸁|𨳕 𨸀|𨴗 𨸅|𨴹 𫔲|𨵩 𨸆|𨵸 𨸇|𨶀 𨸉|𨶏 𨸊|𨶮 𨸌|𨶲 𨸋|𨷲 𨸎|𨼳 𫔽|𨽏 𨸘|𩀨 𫕚|𩅙 𫕨|𩎖 𫖑|𩎢 𩏾|𩏂 𫖓|𩏠 𫖖|𩏪 𩏽|𩏷 𫃗|𩑔 𫖪|𩒎 𫖭|𩓣 𩖕|𩓥 𫖵|𩔑 𫖷|𩔳 𫖴|𩖰 𫠇|𩗀 𩙦|𩗓 𫗈|𩗴 𫗉|𩘀 𩙩|𩘝 𩙭|𩘹 𩙨|𩘺 𩙬|𩙈 𩙰|𩚛 𩟿|𩚥 𩠀|𩚩 𫗡|𩚵 𩠁|𩛆 𩠂|𩛌 𫗤|𩛡 𫗨|𩛩 𩠃|𩜇 𩠉|𩜦 𩠆|𩜵 𩠊|𩝔 𩠋|𩝽 𫗳|𩞄 𩠎|𩞦 𩠏|𩞯 䭪|𩟐 𩠅|𩟗 𫗚|𩠴 𩠠|𩡣 𩡖|𩡺 𩧦|𩢡 𩧬|𩢴 𩧵|𩢸 𩧳|𩢾 𩧮|𩣏 𩧶|𩣑 䯃|𩣫 𩧸|𩣵 𩧻|𩣺 𩧼|𩤊 𩧩|𩤙 𩨆|𩤲 𩨉|𩤸 𩨅|𩥄 𩨋|𩥇 𩨍|𩥉 𩧱|𩥑 𩨌|𩦠 𫠌|𩧆 𩨐|𩭙 𩬣|𩯁 𫙂|𩯳 𩯒|𩰀 𩬤|𩰹 𩰰|𩳤 𩲒|𩴵 𩴌|𩵦 𫠏|𩵩 𩽺|𩵹 𩽻|𩶁 𫚎|𩶘 䲞|𩶰 𩽿|𩶱 𩽽|𩷰 𩾄|𩸃 𩾅|𩸄 𫚝|𩸡 𫚟|𩸦 𩾆|𩻗 𫚨|𩻬 𫚩|𩻮 𫚘|𩼶 𫚬|𩽇 𩾎|𩿅 𫠖|𩿤 𫛠|𩿪 𪉄|𪀖 𫛧|𪀦 𪉅|𪀾 𪉋|𪁈 𪉉|𪁖 𪉌|𪂆 𪉎|𪃍 𪉐|𪃏 𪉏|𪃒 𫛻|𪃧 𫛹|𪄆 𪉔|𪄕 𪉒|𪅂 𫜂|𪆷 𫛾|𪇳 𪉕|𪈼 𱊜|𪉸 𫜊|𪋿 𫧮|𪌭 𫜓|𪍠 𫜕|𪓰 𫜟|𪔵 𪔭|𪘀 𪚏|𪘯 𪚐|𪙏 𫜯|𪟖 𠛾|𪷓 𣶭|𫒡 𫓷|𫜦 𫜫";

  var TSPhrases = "一目瞭然 一目了然|上鍊 上链|不瞭解 不了解|么麼 幺麽|么麽 幺麽|乾乾淨淨 干干净净|乾乾脆脆 干干脆脆|乾元 乾元|乾卦 乾卦|乾嘉 乾嘉|乾圖 乾图|乾坤 乾坤|乾坤一擲 乾坤一掷|乾坤再造 乾坤再造|乾坤大挪移 乾坤大挪移|乾宅 乾宅|乾斷 乾断|乾旦 乾旦|乾曜 乾曜|乾清宮 乾清宫|乾盛世 乾盛世|乾紅 乾红|乾綱 乾纲|乾縣 乾县|乾象 乾象|乾造 乾造|乾道 乾道|乾陵 乾陵|乾隆 乾隆|乾隆年間 乾隆年间|乾隆皇帝 乾隆皇帝|二噁英 二𫫇英|以免藉口 以免借口|以功覆過 以功复过|侔德覆載 侔德复载|傢俱 家具|傷亡枕藉 伤亡枕藉|八濛山 八濛山|凌藉 凌借|出醜狼藉 出丑狼藉|函覆 函复|千鍾粟 千锺粟|反反覆覆 反反复复|反覆 反复|反覆思維 反复思维|反覆思量 反复思量|反覆性 反复性|名覆金甌 名复金瓯|哪吒 哪吒|回覆 回复|壺裏乾坤 壶里乾坤|大目乾連冥間救母變文 大目乾连冥间救母变文|宫商角徵羽 宫商角徵羽|射覆 射复|尼乾陀 尼乾陀|幺麼 幺麽|幺麼小丑 幺麽小丑|幺麼小醜 幺麽小丑|康乾 康乾|張法乾 张法乾|彷彿 仿佛|彷徨 彷徨|徵弦 徵弦|徵絃 徵弦|徵羽摩柯 徵羽摩柯|徵聲 徵声|徵調 徵调|徵音 徵音|情有獨鍾 情有独钟|憑藉 凭借|憑藉着 凭借着|手鍊 手链|扭轉乾坤 扭转乾坤|找藉口 找借口|拉鍊 拉链|拉鍊工程 拉链工程|拜覆 拜复|據瞭解 据了解|文錦覆阱 文锦复阱|於世成 於世成|於乎 於乎|於仲完 於仲完|於倫 於伦|於其一 於其一|於則 於则|於勇明 於勇明|於呼哀哉 於呼哀哉|於單 於单|於坦 於坦|於崇文 於崇文|於忠祥 於忠祥|於惟一 於惟一|於戲 於戏|於敖 於敖|於梨華 於梨华|於清言 於清言|於潛 於潜|於琳 於琳|於穆 於穆|於竹屋 於竹屋|於菟 於菟|於邑 於邑|於陵子 於陵子|旋乾轉坤 旋乾转坤|旋轉乾坤 旋转乾坤|旋轉乾坤之力 旋转乾坤之力|明瞭 明了|明覆 明复|書中自有千鍾粟 书中自有千锺粟|有序 有序|朝乾夕惕 朝乾夕惕|木吒 木吒|李乾德 李乾德|李澤鉅 李泽钜|李鍊福 李链福|李鍾郁 李锺郁|樊於期 樊於期|沈沒 沉没|沈沒成本 沉没成本|沈積 沉积|沈船 沉船|沈默 沉默|流徵 流徵|浪蕩乾坤 浪荡乾坤|滑藉 滑借|無序 无序|牴牾 抵牾|牴觸 抵触|狐藉虎威 狐借虎威|珍珠項鍊 珍珠项链|甚鉅 甚钜|申覆 申复|畢昇 毕昇|發覆 发复|瞭如 了如|瞭如指掌 了如指掌|瞭望 瞭望|瞭然 了然|瞭然於心 了然于心|瞭若指掌 了若指掌|瞭解 了解|瞭解到 了解到|示覆 示复|神祇 神祇|稟覆 禀复|答覆 答复|篤麼 笃麽|簡單明瞭 简单明了|籌畫 筹划|素藉 素借|老態龍鍾 老态龙钟|肘手鍊足 肘手链足|茵藉 茵借|萬鍾 万锺|蒜薹 蒜薹|蕓薹 芸薹|蕩覆 荡复|蕭乾 萧乾|藉代 借代|藉以 借以|藉助 借助|藉助於 借助于|藉卉 借卉|藉口 借口|藉喻 借喻|藉寇兵 借寇兵|藉寇兵齎盜糧 借寇兵赍盗粮|藉手 借手|藉據 借据|藉故 借故|藉故推辭 借故推辞|藉方 借方|藉條 借条|藉槁 借槁|藉機 借机|藉此 借此|藉此機會 借此机会|藉甚 借甚|藉由 借由|藉着 借着|藉端 借端|藉端生事 借端生事|藉箸代籌 借箸代筹|藉草枕塊 借草枕块|藉藉 藉藉|藉藉无名 藉藉无名|藉詞 借词|藉讀 借读|藉資 借资|衹得 只得|衹見樹木 只见树木|衹見樹木不見森林 只见树木不见森林|袖裏乾坤 袖里乾坤|覆上 复上|覆住 复住|覆信 复信|覆冒 复冒|覆呈 复呈|覆命 复命|覆墓 复墓|覆宗 复宗|覆帳 复帐|覆幬 复帱|覆成 复成|覆按 复按|覆文 复文|覆杯 复杯|覆校 复校|覆瓿 复瓿|覆盂 复盂|覆盆 覆盆|覆盆子 覆盆子|覆盤 覆盘|覆育 复育|覆蕉尋鹿 复蕉寻鹿|覆逆 复逆|覆醢 复醢|覆醬瓿 复酱瓿|覆電 复电|覆露 复露|覆鹿尋蕉 复鹿寻蕉|覆鹿遺蕉 复鹿遗蕉|覆鼎 复鼎|見覆 见复|角徵 角徵|角徵羽 角徵羽|計畫 计划|變徵 变徵|變徵之聲 变徵之声|變徵之音 变徵之音|貂覆額 貂复额|買臣覆水 买臣复水|踅門瞭戶 踅门了户|躪藉 躏借|郭子乾 郭子乾|酒逢知己千鍾少 酒逢知己千锺少|酒逢知己千鍾少話不投機半句多 酒逢知己千锺少话不投机半句多|醞藉 酝借|重覆 重复|金吒 金吒|金鍊 金链|鈞覆 钧复|鉅子 钜子|鉅萬 钜万|鉅防 钜防|鉸鍊 铰链|銀鍊 银链|錢鍾書 钱锺书|鍊墜 链坠|鍊子 链子|鍊形 链形|鍊條 链条|鍊錘 链锤|鍊鎖 链锁|鍛鍾 锻锺|鍾繇 钟繇|鍾萬梅 锺万梅|鍾重發 锺重发|鍾鍛 锺锻|鍾馗 锺馗|鎖鍊 锁链|鐵鍊 铁链|鑽石項鍊 钻石项链|雁杳魚沈 雁杳鱼沉|雖覆能復 虽覆能复|電覆 电复|露覆 露复|項鍊 项链|頗覆 颇复|頸鍊 颈链|顛乾倒坤 颠乾倒坤|顛倒乾坤 颠倒乾坤|顧藉 顾借|麼些族 麽些族|黄鍾公 黄锺公|龍鍾 龙钟";

  var to_cn = [TSCharacters, TSPhrases];

  const fromDicts = {
      hk: from_hk,
      tw: from_tw,
      twp: from_twp,
      jp: from_jp
  };

  const toDicts = {
      cn: to_cn
  };

  var Locale = /*#__PURE__*/Object.freeze({
    __proto__: null,
    from: fromDicts,
    to: toDicts
  });

  const Converter = ConverterBuilder(Locale);

  exports.Converter = Converter;
  exports.ConverterFactory = ConverterFactory;
  exports.CustomConverter = CustomConverter;
  exports.HTMLConverter = HTMLConverter;
  exports.Locale = Locale;
  exports.Trie = Trie;


 // Regional glyph variants only: do not use twp's vocabulary substitutions.
 const convert = exports.ConverterFactory(exports.Locale.from.hk, exports.Locale.from.tw, exports.Locale.to.cn);
 return Object.freeze({ toSimplified: value => convert(value) });
})();

/* Additive read-only helper. Does not read/copy source credentials or cookie APIs.
 * Host transport may still apply its domain-scoped shared cookie jar. */
class LiziTencentComments {
    constructor(source, crypto) {
        this.source = source;
        this.crypto = crypto;
        this.cache = new Map();
        this.threads = new Map();
        this.flights = new Map();
        this.localFlights = new Map();
        this.cacheFlights = new Map();
        this.active = 0;
        this.waiters = [];
        this.ttl = 120000;
        this.deadlineMs = 20000;
        this.maxEntries = 64;
    }
    static messages = {
        disabled: '腾讯章节评论已停用', settings: '腾讯评论设置无效，请检查排序和作品绑定',
        input: '章节评论参数无效', reply: '母回复绑定无效，请重新加载该章节评论', busy: '评论请求繁忙，请稍后重试',
        timeout: '章节评论加载超时，请稍后重试', network: '腾讯评论网络请求失败，请稍后重试',
        http: '腾讯评论服务暂不可用，请稍后重试', decode: '腾讯评论响应无法解析',
        gate: '腾讯评论服务未返回已验证的成功响应', schema: '腾讯评论响应格式不受支持',
        converter: '书名繁简转换模块不可用，请更新漫画源',
        local: '无法获取栗子作品目录，请重新打开作品详情',
        work: '未能可靠匹配腾讯作品，请在评论作品绑定中手动确认腾讯作品ID',
        incomplete: '腾讯搜索结果完整性无法确认，请在评论作品绑定中手动确认腾讯作品ID',
        chapter: '该章节未能唯一匹配腾讯目录，暂不显示评论',
        repeated: '腾讯评论分页返回重复内容，已停止继续加载',
        limit: '腾讯评论分页已达安全上限，已停止继续加载',
        workDisabled: '腾讯作品讨论已停用', workInput: '作品讨论参数无效',
        workTimeout: '腾讯作品讨论加载超时，请稍后重试',
        workLocal: '无法获取栗子作品标题，请重新打开作品详情'
    };
    fail(code) {
        const e = new Error(LiziTencentComments.messages[code] || LiziTencentComments.messages.schema);
        e.liziCommentError = true;
        e.liziCommentCode = code;
        return e;
    }
    matchUnavailable(e) {
        if (!e || !e.liziCommentError || !['work', 'incomplete', 'chapter'].includes(e.liziCommentCode)) throw e;
        return { comments: [], maxPage: 0, total: null, available: false,
            reason: e.matchReason || 'match-unresolved', diagnostic: {
                code: e.liziCommentCode, message: e.message,
                searchComplete: e.searchEvidence ? e.searchEvidence.searchComplete : e.liziCommentCode === 'incomplete' ? false : null,
                searchEvidence: e.searchEvidence || null
            } };
    }
    check(ctx) {
        if (ctx.expired || Date.now() >= ctx.end) { ctx.expired = true; throw this.fail(ctx.workOnly ? 'workTimeout' : 'timeout'); }
    }
    settings(workOnly = false, explicitSort = null) {
        let enabled, sort, raw;
        try {
            enabled = this.source.loadSetting('tencentCommentsEnabled');
            sort = workOnly ? 'website-default' : explicitSort != null ? explicitSort : this.source.loadSetting('tencentCommentSort');
            raw = this.source.loadSetting('tencentCommentBindings');
        } catch (_) { throw this.fail('settings'); }
        if (enabled === 'off' || enabled === false || enabled === 'false' || enabled === 'disabled' || enabled === '0' || enabled === 0) throw this.fail('disabled');
        if (enabled != null && !['on', '', true, 'true', '1', 1].includes(enabled)) throw this.fail('settings');
        sort = sort == null || sort === '' ? 'new' : String(sort);
        if (!workOnly && !['new', 'hot', 'wonderful'].includes(sort)) throw this.fail('settings');
        let bindings = {};
        if (raw != null && raw !== '') {
            try { bindings = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch (_) { throw this.fail('settings'); }
            if (!bindings || Array.isArray(bindings) || typeof bindings !== 'object' || Object.keys(bindings).length > 200) throw this.fail('settings');
            for (const k of Object.keys(bindings)) if (!/^\d{1,20}$/.test(k) || !/^\d{1,20}$/.test(String(bindings[k]))) throw this.fail('settings');
        }
        return { sort, bindings };
    }
    enabled() {
        try { this.settings(true); return true; }
        catch (e) { return e.message === LiziTencentComments.messages.disabled ? false : true; }
    }
    options(options, workOnly = false) {
        if (options == null) return null;
        if (typeof options !== 'object' || Array.isArray(options)) throw this.fail('settings');
        const sort = options.sort;
        if (sort == null || sort === '') return null;
        if (workOnly || !['new', 'hot', 'wonderful'].includes(sort)) throw this.fail('settings');
        return sort;
    }
    async loadWithOptions(comicId, epId, page, replyTo, options) {
        // Explicitly disabled is not a network failure or title-matching failure. Zero GET.
        if (!this.enabled()) return { comments: [], maxPage: 0, total: 0, available: false };
        const sort = this.options(options);
        return this.loadCore(comicId, epId, page, replyTo, sort);
    }
    async loadWorkWithOptions(comicId, subId, page, replyTo, options) {
        if (!this.enabled()) return { comments: [], maxPage: 0, total: 0, available: false };
        this.options(options, true); // No invented work sort.
        return this.loadWork(comicId, subId, page, replyTo);
    }
    async optional(ctx, fn, ms = 4500) {
        const child = { end: Math.min(ctx.end - 100, Date.now() + ms), expired: false, workOnly: ctx.workOnly };
        if (child.end <= Date.now()) return null;
        let timer;
        try { return await Promise.race([Promise.resolve().then(() => fn(child)).catch(() => null), new Promise(resolve => { timer = setTimeout(() => { child.expired = true; resolve(null); }, child.end - Date.now()); })]); }
        finally { child.expired = true; if (timer && typeof clearTimeout === 'function') clearTimeout(timer); }
    }
    richFields(row) {
        return { userLevel: this.count(row.level), viewCount: this.count(row.topic_pv_count) };
    }
    context(data, chapter = true) {
        return { provider: 'tencent', comicFavoriteCount: this.count(data && data.comic_collection_num), chapterLikeCount: chapter ? this.count(data && data.chapter_good_num) : null };
    }
    async stats(ctx, comicId, chapterId) {
        return this.cached(ctx, JSON.stringify(['stats', 'lizimh', 'tencent', comicId, chapterId]), async () => {
            const obj = await this.api(ctx, '/13.1.2/Community/getWonderfulChapterTopicList/comic_id/' + comicId + '/chapter_id/' + chapterId);
            if (!Array.isArray(obj.data && obj.data.chapter_topic_list)) throw this.fail('schema');
            this.validateBindings(obj.data, comicId, chapterId);
            return this.context(obj.data);
        });
    }
    async previews(ctx, comments, fetch) {
        // Only current response page, hard bound 200; workers and transport both cap concurrency at 2.
        ctx = { end: Math.min(ctx.end - 500, Date.now() + 6000), expired: false, workOnly: ctx.workOnly };
        const out = comments.map(x => Object.assign({}, x, { replyPreviews: (x.replyPreviews || (x.replyPreview ? [x.replyPreview] : [])).slice(0, 2) }));
        let next = 0;
        const worker = async () => { while (next < out.length && Date.now() < ctx.end - 150) {
            const i = next++, mother = out[i];
            if (mother.replyCount === 0) continue;
            const r = await this.optional(ctx, c => fetch(c, mother));
            if (r && Array.isArray(r.comments)) mother.replyPreviews = r.comments.slice(0, 2).map(x => Object.assign({}, x));
            mother.replyPreview = mother.replyPreviews[0] || null;
        }};
        await Promise.all([worker(), worker()]);
        return out;
    }
    expose(result) {
        if (result.available === false) return { ...result, comments: [] };
        return { comments: result.comments.map(x => {
            const copy = Object.assign({}, x);
            if (copy.replyPreview) copy.replyPreview = Object.assign({}, copy.replyPreview);
            const comment = new Comment(copy);
            // Old hosts ignore constructor additions; safe additive property, no prototype replacement.
            if (copy.replyPreview) comment.replyPreview = copy.replyPreview;
            comment.replyPreviews = (copy.replyPreviews || (copy.replyPreview ? [copy.replyPreview] : [])).slice(0, 2).map(x => Object.assign({}, x));
            comment.userLevel = copy.userLevel == null ? null : copy.userLevel;
            comment.viewCount = copy.viewCount == null ? null : copy.viewCount;
            return comment;
        }), maxPage: result.maxPage, total: result.total == null ? null : result.total, available: true,
            ...(result.notes ? { notes: result.notes } : {}),
            ...(result.commentContext ? { commentContext: Object.assign({}, result.commentContext) } : {}) };
    }
    // Work discussion is separate from load()/chapter comments. subId is opaque host metadata.
    async loadWork(comicId, subId, page, replyTo) {
        let settings;
        try { settings = this.settings(true); }
        catch (e) { throw e.message === LiziTencentComments.messages.disabled ? this.fail('workDisabled') : e; }
        comicId = String(comicId);
        let workThread = null;
        if (replyTo != null && replyTo !== '') {
            workThread = this.threads.get(replyTo);
            if (typeof replyTo !== 'string' || !replyTo.startsWith('tqw8:') || !workThread || workThread[0] !== 'lizimh' || workThread[1] !== comicId || workThread[2] !== 'work') throw this.fail('reply');
        }
        if (!/^\d{1,20}$/.test(comicId)) throw this.fail('workInput');
        page = page == null ? 1 : Number(page);
        if (!Number.isSafeInteger(page) || page < 1) throw this.fail('workInput');
        if (page > 500) throw this.fail('limit');
        const bound = Object.prototype.hasOwnProperty.call(settings.bindings, comicId) ? String(settings.bindings[comicId]) : null;
        // subId is deliberately NOT a chapter ID, topic ID or request parameter.
        const key = JSON.stringify(['loadWork', comicId, page, 'website-default', bound, replyTo || null]);
        let promise = this.flights.get(key);
        if (!promise) {
            if (this.flights.size >= 16) throw this.fail('busy');
            const ctx = { end: Date.now() + this.deadlineMs, expired: false, workOnly: true };
            let done = false;
            promise = new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    if (!done) { ctx.expired = true; done = true; reject(this.fail('workTimeout')); }
                }, this.deadlineMs);
                Promise.resolve().then(async () => {
                    const local = await this.localWork(ctx, comicId);
                    let work;
                    try { work = await this.bindingWork(ctx, comicId, local, bound); }
                    catch (e) {
                        // Only a matching failure hides the entry. Transport/schema/local failures remain errors.
                        return this.matchUnavailable(e);
                    }
                    if (workThread) {
                        if (workThread[3] !== work.id) throw this.fail('reply');
                        return this.workReplies(ctx, work.id, workThread[4], page);
                    }
                    const result = Object.assign({}, await this.workComments(ctx, work.id, page));
                    result.comments = await this.previews(ctx, result.comments, (c, x) => this.workReplies(c, work.id, x.id, 1));
                    result.comments = result.comments.map(x => Object.assign({}, x, { id: this.workToken(comicId, work.id, x.id) }));
                    const stats = await this.optional(ctx, async c => {
                        const remote = await this.remote(c, work.id);
                        const s = await this.stats(c, work.id, remote.chapters[0].id);
                        return { provider: 'tencent', comicFavoriteCount: s.comicFavoriteCount, chapterLikeCount: null };
                    }, 3000);
                    result.commentContext = stats || { provider: 'tencent', comicFavoriteCount: null, chapterLikeCount: null };
                    return result;
                }).then(
                    value => { if (!done) { done = true; resolve(value); } },
                    error => { if (!done) { done = true; reject(error && error.liziCommentError ? error : this.fail('schema')); } }
                ).then(() => {
                    // clearTimeout is optional in older hosts; safe timer closure is already marked done.
                    if (typeof clearTimeout === 'function') clearTimeout(timer);
                    this.flights.delete(key);
                });
            });
            this.flights.set(key, promise);
        }
        const result = await promise;
        return this.expose(result);
    }
    async localWork(ctx, comicId) {
        return this.cached(ctx, JSON.stringify(['workLocal', comicId]), async () => {
            let info, pending = this.localFlights.get(comicId);
            if (!pending) {
                pending = this.slot(ctx, () => this.source.comic.loadInfo(comicId));
                this.localFlights.set(comicId, pending);
                pending.then(() => this.localFlights.delete(comicId), () => this.localFlights.delete(comicId));
            }
            try { info = await pending; } catch (_) { this.check(ctx); throw this.fail('workLocal'); }
            this.check(ctx);
            const title = LiziTencentComments.text(info && info.title);
            if (!title) throw this.fail('workLocal');
            // No catalog/author/chapter gate for a work discussion.
            return { title };
        });
    }
    async remoteWork(ctx, id) {
        return this.cached(ctx, JSON.stringify(['workRemote', id]), async () => {
            const body = await this.get(ctx, 'https://m.ac.qq.com/comic/index/id/' + id, this.metadataHeaders());
            const doc = new HtmlDocument(body);
            let title;
            try { title = LiziTencentComments.text(doc.querySelector('.head-title-tags h1')?.text || doc.querySelector('h1')?.text); }
            finally { doc.dispose(); }
            if (!title) throw this.fail('schema');
            return { id, title };
        });
    }
    async bindingWork(ctx, comicId, local, bound) {
        return this.cached(ctx, JSON.stringify(['workBinding', comicId, local.title, bound]), async () => {
            const titleKey = LiziTencentComments.titleKey(local.title);
            if (bound) {
                const work = await this.remoteWork(ctx, bound);
                if (LiziTencentComments.titleKey(work.title) !== titleKey) {
                    const error = this.fail('work'); error.matchReason = 'manual-conflict'; throw error;
                }
                return work;
            }
            // Keep observed-exact-title policy; never select fuzzy first row or claim global uniqueness.
            const candidates = await this.search(ctx, local.title);
            const exact = candidates.filter(x => LiziTencentComments.titleKey(x.title) === titleKey);
            if (exact.length !== 1) {
                const incomplete = exact.length === 0 && !!candidates.searchEvidence;
                const error = this.fail(incomplete ? 'incomplete' : 'work');
                error.matchReason = incomplete ? 'match-unresolved' : exact.length === 0 ? 'no-match' : 'nonunique';
                error.searchEvidence = candidates.searchEvidence || { searchComplete: true, scope: 'validated-search', observedRows: candidates.length };
                throw error;
            }
            const work = await this.remoteWork(ctx, exact[0].id);
            if (LiziTencentComments.titleKey(work.title) !== titleKey) throw this.fail('work');
            return work;
        });
    }
    normalizeWork(row) {
        const attrs = row && row.attributes;
        const detail = row && row.querySelector('.comment-content-detail');
        const href = detail && detail.attributes && detail.attributes.href;
        const match = typeof href === 'string' && href.match(/^\/Community\/topic\/topic_id\/(\d{1,20})\/page\/1$/);
        if (!attrs || !/^\d{1,20}$/.test(String(attrs['data-c'] || '')) || !match || match[1] !== String(attrs['data-c'])) throw this.fail('schema');
        if (typeof detail.text !== 'string') throw this.fail('schema');
        // HtmlDocument.text has already decoded entities/stripped tags; never parse it again as HTML.
        const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim() : '';
        const content = clean(detail.text);
        if (!content || content.length > 20000) throw this.fail('schema');
        const nickname = clean(row.querySelector('.comment-content-name')?.text);
        // Official list has two .comment-time nodes: client provenance, then date.
        // A provenance string (e.g. 来自Android版) is NEVER a timestamp.
        const dates = Array.from(row.querySelectorAll('.comment-time') || []).map(x => clean(x.text))
            .filter(x => /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?::\d{2})?$/.test(x));
        const times = dates.length === 1 ? dates[0] : null;
        const likes = clean(row.querySelector('.comment-zan-num')?.text);
        const score = /^\d{1,12}$/.test(likes) ? this.count(Number(likes)) : null;
        const rawAvatar = row.querySelector('.userhead-b')?.attributes?.src;
        const avatar = this.avatar(rawAvatar);
        return { id: match[1], userName: nickname.slice(0, 200) || '腾讯动漫用户', avatar,
            content,
            time: times,
            // No reply-count field in the verified list DOM. Do not imply zero or copy chapter counts.
            replyCount: null, score, isLiked: null, voteStatus: null, userLevel: null, viewCount: null, replyPreviews: [] };
    }
    workToken(localId, comicId, topicId) {
        const scope = ['lizimh', String(localId), 'work', String(comicId), String(topicId)];
        const token = 'tqw8:' + encodeURIComponent(JSON.stringify(scope));
        this.threads.set(token, scope);
        while (this.threads.size > 2048) this.threads.delete(this.threads.keys().next().value);
        return token;
    }
    async workReplies(ctx, comicId, topicId, page) {
        return this.cached(ctx, JSON.stringify(['lizimh', 'tencent', 'workReplies', comicId, topicId, page]), async () => {
            const body = await this.get(ctx, 'https://ac.qq.com/Community/loadComment?comic_id=' + comicId + '&topic_id=' + topicId + '&page=' + page + '&type=0&hd=0', this.workHeaders(comicId));
            if (body[0] !== '2') throw this.fail('gate');
            let html = body.slice(1); try { html = decodeURIComponent(html); } catch (_) {}
            const doc = new HtmlDocument(html);
            try {
                const rows = Array.from(doc.querySelectorAll('.comment-list-wr') || []);
                if (!doc.getElementById('commen-con') || rows.length > 200) throw this.fail('schema');
                const comments = rows.map(row => {
                    const id = row.attributes && row.attributes['data-c'];
                    if (!/^\d{1,20}$/.test(String(id || ''))) throw this.fail('schema');
                    const raw = row.querySelector('.comment-content')?.text;
                    if (typeof raw !== 'string' || !raw.trim()) throw this.fail('schema');
                    const userName = row.querySelector('.comment-user-name')?.text?.trim() || '腾讯动漫用户';
                    const content = raw.trim().replace(new RegExp('^' + userName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*[：:]\\s*'), '');
                    const dates = Array.from(row.querySelectorAll('.comment-time') || []).map(x => x.text.trim()).filter(x => /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/.test(x));
                    return { id: String(id), userName, content, avatar: this.avatar(row.querySelector('.reply-userhead-b')?.attributes?.src), time: dates.length === 1 ? dates[0] : null,
                        userLevel: null, viewCount: null, score: null, replyCount: null, replyPreviews: [] };
                });
                return { comments, maxPage: rows.length === 0 ? page : null, total: null };
            } finally { doc.dispose(); }
        });
    }
    workHeaders(comicId) {
        return { 'User-Agent': 'Mozilla/5.0', Accept: 'text/html', Referer: 'https://ac.qq.com/Comic/comicInfo/id/' + comicId };
    }
    async workComments(ctx, comicId, page) {
        const scope = JSON.stringify(['workPage', comicId, 'website-default']);
        return this.cached(ctx, JSON.stringify([scope, page]), async () => {
            const url = 'https://ac.qq.com/Community/topicList?targetId=' + comicId + '&page=' + page;
            const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36',
                Accept: 'text/html', Referer: 'https://ac.qq.com/Comic/comicInfo/id/' + comicId };
            const body = await this.get(ctx, url, headers);
            if (body[0] !== '2') throw this.fail('gate');
            let html = body.slice(1);
            try { html = decodeURIComponent(html); } catch (_) { /* official web behavior: raw HTML on stray %. */ }
            const doc = new HtmlDocument(html);
            let comments, totalCount = null;
            try {
                const total = doc.getElementById('totalNum')?.attributes?.value;
                // totalNum is only a known response marker, NEVER a page count.
                if (typeof total !== 'string' || !/^\d{1,12}$/.test(total)) throw this.fail('schema');
                totalCount = this.count(Number(total));
                const rows = doc.querySelectorAll('.comment-list-content-wr');
                if (!rows || rows.length > 200) throw this.fail('schema');
                const unique = new Map();
                for (const row of rows) { const comment = this.normalizeWork(row); if (!unique.has(comment.id)) unique.set(comment.id, comment); }
                comments = Array.from(unique.values());
            } finally { doc.dispose(); }
            const prev = page > 1 ? this.getCache(JSON.stringify([scope, page - 1])) : null;
            if (comments.length && prev && prev.comments.length && JSON.stringify(comments.map(x => x.id).sort()) === JSON.stringify(prev.comments.map(x => x.id).sort())) throw this.fail('repeated');
            // First/second real pages verified. Unknown last page; empty page terminates host scrolling.
            return { comments, maxPage: comments.length === 0 ? page : null, total: totalCount,
                notes: ['腾讯作品讨论 · 网站默认排序；与章节评论为不同数据集。作品完整回复功能未验证，暂不可用。'] };
        });
    }
    async load(comicId, epId, page, replyTo) {
        return this.loadCore(comicId, epId, page, replyTo, null);
    }
    async loadCore(comicId, epId, page, replyTo, explicitSort) {
        const settings = this.settings(false, explicitSort); // Disabled means no loadInfo and no Network.
        comicId = String(comicId); epId = String(epId);
        const thread = replyTo == null || replyTo === '' ? null : this.parseThread(replyTo, comicId, epId);
        if (!/^\d{1,20}$/.test(comicId) || !epId || epId.length > 80) throw this.fail('input');
        page = page == null ? 1 : Number(page);
        if (!Number.isSafeInteger(page) || page < 1) throw this.fail('input');
        if (page > 500) throw this.fail('limit');
        const bound = Object.prototype.hasOwnProperty.call(settings.bindings, comicId) ? String(settings.bindings[comicId]) : null;
        const key = JSON.stringify(['load', comicId, epId, page, settings.sort, bound, thread]);
        let promise = this.flights.get(key);
        if (!promise) {
            if (this.flights.size >= 16) throw this.fail('busy');
            const ctx = { end: Date.now() + this.deadlineMs, expired: false };
            // The timer rejects the caller only. Underlying slots remain occupied until transport settles.
            let done = false;
            promise = new Promise((resolve, reject) => {
                setTimeout(() => {
                    if (!done) { ctx.expired = true; done = true; reject(this.fail('timeout')); }
                }, this.deadlineMs);
                Promise.resolve().then(() => this.run(ctx, comicId, epId, page, settings.sort, bound, thread)).then(
                    value => { if (!done) { done = true; resolve(value); } },
                    error => { if (!done) { done = true; reject(error && error.liziCommentError ? error : this.fail('schema')); } }
                ).then(() => { this.flights.delete(key); });
            });
            this.flights.set(key, promise);
        }
        const result = await promise;
        // Never expose cache objects to a mutable host UI.
        return this.expose(result);
    }
    async slot(ctx, fn) {
        this.check(ctx);
        if (this.active >= 2) {
            if (this.waiters.length >= 8) throw this.fail('busy');
            await new Promise(resolve => this.waiters.push(resolve));
            // A released slot was reserved for this waiter.
            try { this.check(ctx); } catch (e) { this.release(); throw e; }
        } else this.active++;
        try { return await fn(); } finally { this.release(); }
    }
    release() {
        const next = this.waiters.shift();
        if (next) next(); else this.active--;
    }
    getCache(key) {
        const item = this.cache.get(key);
        if (!item) return null;
        if (item.until <= Date.now()) { this.cache.delete(key); return null; }
        this.cache.delete(key); this.cache.set(key, item);
        return item.value;
    }
    putCache(ctx, key, value, ttl) {
        this.check(ctx);
        this.cache.delete(key);
        this.cache.set(key, { until: Date.now() + (ttl || this.ttl), value });
        while (this.cache.size > this.maxEntries) this.cache.delete(this.cache.keys().next().value);
        return value;
    }
    async cached(ctx, key, fn) {
        this.check(ctx);
        const hit = this.getCache(key);
        if (hit != null) return hit;
        let pending = this.cacheFlights.get(key);
        if (!pending) {
            pending = Promise.resolve().then(fn).then(value => this.putCache(ctx, key, value));
            this.cacheFlights.set(key, pending);
            pending.then(() => this.cacheFlights.delete(key), () => this.cacheFlights.delete(key));
        }
        return pending;
    }
    async get(ctx, url, headers, maxBytes) {
        let response;
        try { response = await this.slot(ctx, () => Network.get(url, headers)); }
        catch (e) { this.check(ctx); throw e && e.liziCommentError ? e : this.fail('network'); }
        this.check(ctx);
        if (!response || response.status !== 200) throw this.fail('http');
        if (typeof response.body !== 'string' || response.body.length > (maxBytes || 2097152)) throw this.fail('schema');
        return response.body;
    }
    static text(value) {
        return typeof value === 'string' ? value.normalize('NFKC').replace(/\s+/g, ' ').trim() : '';
    }
    static titleKey(value) {
        if (typeof LiziCommentTitleConverter === 'undefined' || typeof LiziCommentTitleConverter.toSimplified !== 'function') {
            const e = new Error(LiziTencentComments.messages.converter);
            e.liziCommentError = true;
            throw e;
        }
        return LiziCommentTitleConverter.toSimplified(this.text(value));
    }
    static number(s) {
        if (/^\d+$/.test(s)) { const n = Number(s); return Number.isSafeInteger(n) ? String(n) : null; }
        const d = '零一二三四五六七八九';
        function render(n) {
            if (n < 10) return d[n];
            if (n < 100) return (n < 20 ? '' : d[Math.floor(n / 10)]) + '十' + (n % 10 ? d[n % 10] : '');
            const rem = n % 100;
            return d[Math.floor(n / 100)] + '百' + (rem ? (rem < 10 ? '零' + d[rem] : (rem < 20 ? '一' : '') + render(rem)) : '');
        }
        for (let n = 1; n <= 999; n++) if (render(n) === s) return String(n);
        return null;
    }
    static chapter(raw) {
        const title = this.titleKey(raw).replace(/話/g, '话');
        const token = '[0-9零一二三四五六七八九十百]+';
        let rest = title, volume = null, kind = 'main';
        const vol = rest.match(new RegExp('^第?(' + token + ')卷\\s*'));
        if (vol) { volume = this.number(vol[1]); if (volume == null) return null; rest = rest.slice(vol[0].length); }
        if (rest.startsWith('番外')) { kind = 'extra'; rest = rest.slice(2).trim(); }
        // A catalog ordinal is not the chapter number: 94-091春风 is #91.
        const composite = kind === 'main' && rest.match(/^(\d{1,4})[-－](0\d{1,5})([^\d].*)$/);
        if (composite) rest = composite[2] + composite[3];
        const padded = kind === 'main' && rest.match(/^(0\d{1,5})([^\d].*)$/);
        const m = rest.match(/^第?\s*(\d+)\s*(话|章|回)?(.*)$/) ||
            rest.match(new RegExp('^第?\\s*(' + token + ')\\s*(话|章|回)?(.*)$'));
        const bare = kind === 'main' && /^第?\s*\d+[^\d].*$/.test(rest);
        if (!m || (kind === 'main' && !m[2] && !bare)) return null;
        const number = this.number(m[1]);
        if (number == null) return null;
        let tail = m[3].trim(), part = null;
        // Preserve range rejection before removing a subtitle/part separator.
        if (/^[.．/、~～]|^[-－]\s*\d/.test(tail)) return null;
        tail = tail.replace(/^[：:]\s*|^[-－—–]\s+/, '').trim();
        const p = tail.match(/^(?:[（(]\s*(上|中|下)(?:篇)?\s*[）)]|(上|中|下)(?:篇)?)(.*)$/);
        if (p) { part = p[1] || p[2]; tail = p[3].trim(); }
        // Residual part markers are ambiguous identity, never ordinary subtitles.
        if (/^[.．/、~～]|^[-－]\s*\d|上下|[上中下]篇|(?:^|[\s:：()（）-])[上中下](?:$|[\s)）])|合并|合併|番外|特别|特別/.test(tail)) return null;
        tail = tail.replace(/^[：:]\s*|^[-－—–]\s+/, '').trim();
        return { title, identity: JSON.stringify([kind, volume, number, m[2] || (bare ? '话' : null), part]),
            subtitle: tail, padded: !!padded && !m[2], composite: !!composite };
    }
    static subtitleKey(value) {
        // Cosmetic punctuation is not chapter identity; part/range guards run first.
        return value.replace(/[\s!！?？,，。:：;；、·‘’“”"'「」『』《》<>（）()\[\]【】—–-]/g, '');
    }
    static compatibleSubtitle(a, b, anchored = false) {
        if (!a || !b) return false;
        if (a.subtitle === b.subtitle) return true;
        if (!a.subtitle || !b.subtitle) return true;
        const x = this.subtitleKey(a.subtitle), y = this.subtitleKey(b.subtitle);
        if (x && x === y) return true;
        const short = x.length <= y.length ? x : y;
        const long = x.length <= y.length ? y : x;
        if (a.padded && b.composite || b.padded && a.composite) {
            if (short.length >= 2 && long.endsWith(short)) return true;
        }
        // Real web catalogs omit the ordinal (091春风). Require unique numbered
        // identities AND strict anchors on both sides before relaxing subtitles.
        if (!anchored || !short || !long) return false;
        if ((long.startsWith(short) || long.endsWith(short)) &&
            (short.length >= 2 || short.length === 1 && long.length <= 3)) return true;
        // One typo/omitted character in a substantial subtitle, never number-only.
        if (short.length < 4 || long.length - short.length > 1) return false;
        let i = 0, j = 0, edits = 0;
        while (i < short.length && j < long.length) {
            if (short[i] === long[j]) { i++; j++; continue; }
            if (++edits > 1) return false;
            if (short.length === long.length) i++;
            j++;
        }
        return edits + (long.length - j) + (short.length - i) <= 1;
    }
    static contextAnchored(row, target, local, remote, index) {
        const li = index && index.local || LiziChapterMetadata.prepared(local);
        const ri = index && index.remote || LiziChapterMetadata.prepared(remote);
        const parsed = li.parse(row.title);
        if (!parsed) return false;
        const identity = JSON.parse(parsed.identity), number = Number(identity[2]);
        if (identity[0] !== 'main' || identity[4] != null) return false;
        const pos = local.indexOf(row), targetPos = remote.indexOf(target);
        if (pos < 0 || targetPos < 0) return false;
        const evidence = { before: false, after: false };
        for (let offset = -6; offset <= 6; offset++) {
            if (!offset || pos + offset < 0 || pos + offset >= local.length) continue;
            const neighbor = local[pos + offset], a = li.parse(neighbor.title);
            if (!a || !a.subtitle) continue;
            const key = JSON.parse(a.identity), delta = Number(key[2]) - number;
            if (key[0] !== identity[0] || key[1] !== identity[1] ||
                key[3] !== identity[3] || key[4] != null || !delta || Math.abs(delta) > 3) continue;
            const ls = li.byIdentity.get(a.identity) || [], rs = ri.byIdentity.get(a.identity) || [];
            if (ls.length !== 1 || rs.length !== 1) continue;
            const b = ri.parse(rs[0].title);
            if (!b || !b.subtitle || this.subtitleKey(a.subtitle) !== this.subtitleKey(b.subtitle)) continue;
            const remoteOffset = remote.indexOf(rs[0]) - targetPos;
            if (offset < 0 && remoteOffset < 0) evidence.before = true;
            if (offset > 0 && remoteOffset > 0) evidence.after = true;
        }
        return evidence.before && evidence.after;
    }
    static matchChapter(row, local, remote) {
        const a = this.chapter(row.title);
        if (a) {
            const locals = local.filter(x => { const p = this.chapter(x.title); return p && p.identity === a.identity; });
            const targets = remote.filter(x => { const p = this.chapter(x.title); return p && p.identity === a.identity; });
            if (locals.length !== 1 || targets.length !== 1) return null;
            const b = this.chapter(targets[0].title);
            if (!this.compatibleSubtitle(a, b) &&
                !(this.contextAnchored(row, targets[0], local, remote) && this.compatibleSubtitle(a, b, true))) return null;
            return targets[0];
        }
        const title = this.text(row.title);
        if (/第?[0-9零一二三四五六七八九十百]+[话話章回]/.test(title) && /上下|[上中下]篇|(?:^|[\s:：()（）-])[上中下](?:$|[\s)）])/.test(title)) return null;
        // Exact unnumbered titles are anchors too; no stripping 番外/卷/上下篇.
        if (!title || /^(?:正文|章节|章節|更新|通知|无标题|無標題|未命名|待定|暂无标题|暫無標題|暂无|暫無|未定|待命名|untitled)$/i.test(title)) return null;
        const ls = local.filter(x => this.text(x.title) === title);
        const rs = remote.filter(x => this.text(x.title) === title);
        return ls.length === 1 && rs.length === 1 ? rs[0] : null;
    }
    static catalog(chapters) {
        const rows = chapters instanceof Map ? Array.from(chapters.entries()) :
            chapters && typeof chapters === 'object' && !Array.isArray(chapters) ? Object.entries(chapters) : [];
        if (!rows.length || rows.length > 10000 || rows.some(x => typeof x[1] !== 'string' || !this.text(x[1]))) return null;
        return rows.map(x => ({ id: String(x[0]), title: this.text(x[1]) }));
    }
    static authors(value) {
        const values = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
        const names = values.flatMap(x => this.text(x).split(/[,，、;；]/)).map(x => x.trim()).filter(Boolean);
        return Array.from(new Set(names)).sort();
    }
    metadataHeaders() {
        return { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', Accept: 'text/html' };
    }
    async local(ctx, comicId) {
        return this.cached(ctx, JSON.stringify(['local', comicId]), async () => {
            let info;
            let pending = this.localFlights.get(comicId);
            if (!pending) {
                pending = this.slot(ctx, () => this.source.comic.loadInfo(comicId));
                this.localFlights.set(comicId, pending);
                pending.then(() => this.localFlights.delete(comicId), () => this.localFlights.delete(comicId));
            }
            try { info = await pending; }
            catch (e) { this.check(ctx); throw this.fail('local'); }
            this.check(ctx);
            const chapters = LiziTencentComments.catalog(info && info.chapters);
            if (!chapters || !LiziTencentComments.text(info.title)) throw this.fail('local');
            const dates = {};
            const sourceMeta = info && info.chapterMetadata && typeof info.chapterMetadata === 'object' ? info.chapterMetadata : {};
            for (const id of Object.keys(chapters)) {
                const m = sourceMeta[id];
                if (m && typeof m.updateTime === 'string' && m.updateTime) dates[id] = { updateTime: m.updateTime, dateSource: 'lizi' };
            }
            return { title: LiziTencentComments.text(info.title), authors: LiziTencentComments.authors(info.tags && info.tags['作者']), chapters, dates };
        });
    }
    async remote(ctx, id) {
        return this.cached(ctx, JSON.stringify(['remote', id]), async () => {
            const body = await this.get(ctx, 'https://m.ac.qq.com/comic/index/id/' + id, this.metadataHeaders());
            const doc = new HtmlDocument(body);
            let title, authors, first;
            try {
                title = LiziTencentComments.text(doc.querySelector('.head-title-tags h1')?.text || doc.querySelector('h1')?.text);
                authors = LiziTencentComments.authors(LiziTencentComments.text(doc.querySelector('.head-info-author')?.text).replace(/^作者[：:]?\s*/, ''));
                first = doc.querySelector('.chapter-link')?.attributes['data-cid'];
            } finally { doc.dispose(); }
            if (!title || !/^\d{1,20}$/.test(String(first || ''))) throw this.fail('schema');
            // Read embedded complete catalog only. No image/nonce/reader decode requests.
            const chapterBody = await this.get(ctx, 'https://m.ac.qq.com/chapter/index/id/' + id + '/cid/' + first, this.metadataHeaders());
            const chapterDoc = new HtmlDocument(chapterBody);
            let raw;
            try { raw = JSON.parse(chapterDoc.getElementById('data_chapterInfo')?.text || 'null'); }
            catch (_) { throw this.fail('schema'); }
            finally { chapterDoc.dispose(); }
            if (!Array.isArray(raw) || !raw.length || raw.length > 10000) throw this.fail('schema');
            const chapters = raw.map(x => ({ id: String(x.cid || ''), title: LiziTencentComments.text(x.title || x.cTitle) }));
            if (chapters.some(x => !/^\d{1,20}$/.test(x.id) || !x.title) || new Set(chapters.map(x => x.id)).size !== chapters.length) throw this.fail('schema');
            return { id, title, authors, chapters };
        });
    }
    searchConfig(body) {
        // Read public BIU.Page literals only; never execute scripts or apply JS bitwise coercion.
        const scripts = Array.from(body.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)).map(x => x[1]);
        const marked = scripts.filter(x => /\bpg_SearchResult\s*=/.test(x));
        if (!marked.length) return null;
        if (marked.length !== 1) throw this.fail('incomplete');
        const configs = Array.from(marked[0].matchAll(/\bvar\s+pg_SearchResult\s*=\s*new\s+BIU\.Page\s*\(\s*\{([^{}]*)\}\s*\)/g));
        if (configs.length !== 1) throw this.fail('incomplete');
        const config = {};
        const words = Array.from(configs[0][1].matchAll(/(?:^|,)\s*word\s*:\s*('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*")\s*(?=,|$)/g));
        if (words.length !== 1) throw this.fail('incomplete');
        const literalWord = words[0][1];
        try {
            config.word = literalWord[0] === '"' ? JSON.parse(literalWord) :
                JSON.parse('"' + literalWord.slice(1, -1).replace(/\\'|"/g, x => x === "\\'" ? "'" : '\\"') + '"');
        } catch (_) { throw this.fail('incomplete'); }
        for (const key of ['total', 'pageIndex', 'pageSize']) {
            const fields = Array.from(configs[0][1].matchAll(new RegExp('(?:^|,)\\s*' + key + '\\s*:\\s*([^,]+)', 'g')));
            if (fields.length !== 1) throw this.fail('incomplete');
            const literal = fields[0][1].trim().match(/^(?:'(\d+)'|"(\d+)"|(\d+))\s*(?:\|\s*0)?$/);
            if (!literal) throw this.fail('incomplete');
            const n = Number(literal[1] || literal[2] || literal[3]);
            if (!Number.isSafeInteger(n) || n < 0) throw this.fail('incomplete');
            config[key] = n;
        }
        // A large literal is valid public metadata, not a parser failure.
        // The bounded collector handles overflow only after validating the first-page shape.
        if (config.pageIndex < 1 || config.pageSize !== 10) throw this.fail('incomplete');
        return config;
    }
    async search(ctx, title) {
        title = LiziTencentComments.titleKey(title);
        // Two proven metadata shapes share one bounded, duplicate-rejecting collector.
        const seen = new Set(), rows = new Map();
        const base = 'https://m.ac.qq.com/search/result?word=' + encodeURIComponent(title);
        let url = base, hadNext = false, declared = null, official = false, pages = null;
        for (let page = 1; page <= 4; page++) {
            if (seen.has(url)) throw this.fail('incomplete');
            seen.add(url);
            const body = await this.get(ctx, url, this.metadataHeaders());
            const config = this.searchConfig(body);
            if (page === 1 && config) {
                official = true; declared = config.total;
                pages = Math.max(1, Math.ceil(declared / config.pageSize));
            }
            if (config && (!official || config.word !== title || config.total !== declared || config.pageIndex !== page)) throw this.fail('incomplete');
            const doc = new HtmlDocument(body);
            let next, hasPages = false, pageRows;
            try {
                if (official && page === 1 && !doc.getElementById('lst_searchResult')) throw this.fail('incomplete');
                if (official && page > 1 && (doc.getElementById('lst_searchResult') || /<(?:html|body)\b/i.test(body))) throw this.fail('incomplete');
                pageRows = doc.querySelectorAll(official && page > 1 ? '.comic-item' : '#lst_searchResult .comic-item');
                if (pageRows.length > (official ? 10 : 40) || (official && declared > 0 && !pageRows.length)) throw this.fail('incomplete');
                for (const item of pageRows) {
                    const href = item.querySelector('.comic-link')?.attributes.href || '';
                    const id = href.match(/^(?:https:\/\/m\.ac\.qq\.com)?\/comic\/index\/id\/(\d{1,20})\/?(?:[?#][^\s]*)?$/)?.[1];
                    const name = LiziTencentComments.text(item.querySelector('.comic-title')?.text);
                    if (!id || !name || rows.has(id)) throw this.fail('incomplete');
                    rows.set(id, { id, title: name });
                    if (rows.size > 40 || (declared !== null && rows.size > declared)) throw this.fail('incomplete');
                }
                for (const link of doc.querySelectorAll('a')) {
                    const a = link.attributes || {}, text = LiziTencentComments.text(link.text);
                    const href = a.href || '';
                    if (/page=\d+|\/page\/\d+/.test(href)) hasPages = true;
                    if (a.rel === 'next' || /^(?:下一页|下一頁|下页|下頁|Next)$/i.test(text)) {
                        if (next) throw this.fail('incomplete');
                        if (/^\/search\/result\?/.test(href)) next = 'https://m.ac.qq.com' + href;
                        else if (/^https:\/\/m\.ac\.qq\.com\/search\/result\?/.test(href)) next = href;
                        else throw this.fail('incomplete');
                        if (!next.includes('word=' + encodeURIComponent(title))) throw this.fail('incomplete');
                    }
                }
                const text = doc.querySelector('body')?.text || '';
                if (/更多|加载更多|加載更多|截断|截斷/.test(text)) throw this.fail('incomplete');
                const totals = Array.from(text.matchAll(/(?:共找到|共搜索到|搜索结果共|搜尋結果共)\s*(\d+)\s*(?:部|个|個|条|條)/g));
                for (const total of totals) {
                    const n = Number(total[1]);
                    if (!Number.isSafeInteger(n) || n > 40 || (declared !== null && n !== declared)) throw this.fail('incomplete');
                    declared = n;
                }
                if (declared !== null && rows.size > declared) throw this.fail('incomplete');
            } finally { doc.dispose(); }
            if (official) {
                if (next || hasPages) throw this.fail('incomplete');
                if (declared > 40) {
                    // Observed-title policy: no global uniqueness claim for a fuzzy overflow.
                    // Validate one exact observed title downstream; never choose a fuzzy first row.
                    const observed = Array.from(rows.values());
                    observed.searchEvidence = { declaredTotal: declared, observedRows: rows.size,
                        searchComplete: false, scope: 'validated-first-page',
                        exactCandidateIds: observed.filter(x => LiziTencentComments.titleKey(x.title) === title).map(x => x.id) };
                    return observed;
                }
                if (page === pages) {
                    if (rows.size > declared) throw this.fail('incomplete');
                    const observed = Array.from(rows.values());
                    // Search metadata may overstate the number of returned rows. The page
                    // budget is exhausted and every observed row has passed shape/ID checks;
                    // retain an explicit incomplete marker so zero-match stays fail-closed.
                    if (rows.size < declared) observed.searchEvidence = { declaredTotal: declared, observedRows: rows.size,
                        searchComplete: false, scope: 'validated-short-final-page',
                        exactCandidateIds: observed.filter(x => LiziTencentComments.titleKey(x.title) === title).map(x => x.id) };
                    return observed;
                }
                // Short fragments never prove exhaustion; request every declared page.
                url = base + '&page=' + (page + 1) + '&pageSize=10&style=items';
                continue;
            }
            if (next) { hadNext = true; url = next; continue; }
            if (declared === rows.size || (declared === null && hadNext && !hasPages && pageRows.length === 0)) return Array.from(rows.values());
            throw this.fail('incomplete');
        }
        throw this.fail('incomplete');
    }
    async binding(ctx, comicId, local, bound) {
        const key = JSON.stringify(['binding', comicId, bound, local]);
        return this.cached(ctx, key, async () => {
            const titleKey = LiziTencentComments.titleKey(local.title);
            let remote;
            if (bound) {
                remote = await this.remote(ctx, bound);
            } else {
                const candidates = await this.search(ctx, local.title);
                const exact = candidates.filter(x => LiziTencentComments.titleKey(x.title) === titleKey);
                // Multiple observed same-name editions require explicit disambiguation.
                // An absent observed title is inconclusive, not proof that the work does not exist.
                if (exact.length !== 1) {
                    const error = this.fail(exact.length === 0 && candidates.searchEvidence ? 'incomplete' : 'work');
                    error.matchReason = candidates.searchEvidence ? 'match-unresolved' : exact.length === 0 ? 'no-match' : 'nonunique';
                    error.searchEvidence = candidates.searchEvidence || { searchComplete: true, scope: 'validated-search', observedRows: candidates.length };
                    throw error;
                }
                remote = await this.remote(ctx, exact[0].id);
                if (candidates.searchEvidence) remote = { ...remote, searchComplete: false,
                    searchEvidence: candidates.searchEvidence };
            }
            if (LiziTencentComments.titleKey(remote.title) !== titleKey) {
                const error = this.fail('work'); error.matchReason = bound ? 'manual-conflict' : 'match-unresolved'; throw error;
            }
            // A manual ID is explicit work confirmation, not chapter confirmation or index permission.
            return remote;
        });
    }
    plain(value) {
        if (typeof value !== 'string') throw this.fail('schema');
        const html = value.replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>|<style\b[^>]*>[\s\S]*?<\/style\s*>/gi, '').replace(/<br\s*\/?\s*>/gi, '\n');
        const doc = new HtmlDocument('<html><body><div id="lizi-comment-text">' + html + '</div></body></html>');
        try { return String(doc.querySelector('body')?.text || '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim(); }
        finally { doc.dispose(); }
    }
    normalize(row) {
        if (!row || typeof row !== 'object' || !/^\d{1,20}$/.test(String(row.topic_id || '')) || typeof row.content !== 'string') throw this.fail('schema');
        // Observed live schema: nick_name, qq_head(https), date(string),
        // good_count and comment_count(number). Do not guess user/avatar aliases.
        let replyPreview = null;
        const preview = row.over_comment_info;
        if (preview && typeof preview === 'object' && typeof preview.content === 'string') {
            const content = this.plain(preview.content);
            if (content) replyPreview = {
                id: /^\d{1,20}$/.test(String(preview.comment_id || '')) ? String(preview.comment_id) : null,
                userName: typeof preview.nick_name === 'string' ? this.plain(preview.nick_name) || '腾讯动漫用户' : '腾讯动漫用户',
                content, avatar: null, time: null
            }; // Preview contains no observed avatar or date. Never invent from host_qq.
        }
        return { id: String(row.topic_id),
            threadType: this.count(row.target_type),
            userName: typeof row.nick_name === 'string' ? this.plain(row.nick_name) || '腾讯动漫用户' : '腾讯动漫用户',
            avatar: this.avatar(row.qq_head), content: this.plain(row.content),
            time: this.time(row.date), score: this.count(row.good_count),
            replyCount: this.count(row.comment_count), replyPreview, replyPreviews: replyPreview ? [replyPreview] : [], ...this.richFields(row) };
    }
    threadToken(localId, epId, remoteId, chapterId, topicId, type) {
        if (type == null) return null; // No guessed target_type.
        const scope = ['lizimh', String(localId), String(epId), String(remoteId), String(chapterId), String(topicId), type];
        const token = 'tqc3:' + encodeURIComponent(JSON.stringify(scope));
        this.threads.delete(token); this.threads.set(token, scope);
        while (this.threads.size > 2048) this.threads.delete(this.threads.keys().next().value);
        return token;
    }
    parseThread(token, localId, epId) {
        if (typeof token !== 'string' || token.length > 1500 || !token.startsWith('tqc3:')) throw this.fail('reply');
        const scope = this.threads.get(token);
        if (!scope || scope[0] !== 'lizimh' || scope[1] !== localId || scope[2] !== epId) throw this.fail('reply');
        return scope.slice(); // Only registered observed mothers; no arbitrary route injection.
    }
    safeStringCount(value) {
        if (typeof value === 'string' && /^(?:0|[1-9]\d*)$/.test(value)) return this.count(Number(value));
        return this.count(value);
    }
    normalizeReply(row) {
        if (!row || typeof row !== 'object' || !/^\d{1,20}$/.test(String(row.comment_id || '')) || typeof row.content !== 'string') throw this.fail('schema');
        let replyPreview = null;
        if (Array.isArray(row.reply_list)) {
            const nested = row.reply_list.find(x => x && typeof x.content === 'string');
            if (nested) replyPreview = { id: null,
                userName: typeof nested.from_nick === 'string' ? this.plain(nested.from_nick) || '腾讯动漫用户' : '腾讯动漫用户',
                toUserName: typeof nested.to_nick === 'string' ? this.plain(nested.to_nick) || null : null,
                content: this.plain(nested.content), avatar: null, time: null };
        }
        return { id: String(row.comment_id), userName: typeof row.nick_name === 'string' ? this.plain(row.nick_name) || '腾讯动漫用户' : '腾讯动漫用户',
            avatar: this.avatar(row.qq_head), content: this.plain(row.content), time: this.time(row.date),
            score: this.safeStringCount(row.good_count), replyCount: this.count(row.reply_count), replyPreview,
            replyPreviews: Array.isArray(row.reply_list) ? row.reply_list.filter(x => x && typeof x.content === 'string').slice(0, 2).map(x => ({ id: null,
                userName: typeof x.from_nick === 'string' ? this.plain(x.from_nick) || '腾讯动漫用户' : '腾讯动漫用户',
                toUserName: typeof x.to_nick === 'string' ? this.plain(x.to_nick) || null : null,
                content: this.plain(x.content), avatar: null, time: null, userLevel: null, viewCount: null })) : [], ...this.richFields(row) };
    }
    async threadComments(ctx, thread, page) {
        const scope = JSON.stringify(['threadPage', thread]);
        return this.cached(ctx, JSON.stringify([scope, page]), async () => {
            const [source, localId, epId, comicId, chapterId, topicId, type] = thread;
            const path = '/13.1.2/Comment/getTopicCommentList/type/1/topic_id/' + topicId + '/page/' + page + '/listcnt/10/comic_id/' + comicId +
                (type === 11 ? '' : '/target_type/' + type);
            const obj = await this.api(ctx, path);
            const data = obj.data, rows = data && data.list;
            if (!Array.isArray(rows) || rows.length > 200) throw this.fail('schema');
            this.validateBindings(data, comicId, chapterId);
            // Optional echoed mother identity must never disagree with the requested mother.
            for (const row of rows) if (row && row.topic_id != null && String(row.topic_id) !== topicId) throw this.fail('schema');
            if (data.topic_id != null && String(data.topic_id) !== topicId) throw this.fail('schema');
            const unique = new Map();
            for (const row of rows) {
                const comment = this.normalizeReply(row);
                if (!unique.has(String(row.comment_id))) unique.set(String(row.comment_id), comment);
            }
            const ids = Array.from(unique.keys());
            const prev = page > 1 ? this.getCache(JSON.stringify([scope, page - 1])) : null;
            if (ids.length && prev && prev.ids.length && JSON.stringify(ids.slice().sort()) === JSON.stringify(prev.ids.slice().sort())) throw this.fail('repeated');
            // Native CFString 0x1040a03b8=end_of_list; callback cmp 2 then setIsEnd:1.
            return { comments: Array.from(unique.values()), ids, total: this.count(data.comment_count),
                maxPage: rows.length === 0 || data.end_of_list === 2 ? page : null };
        });
    }
    async api(ctx, path, chapterCatalog = false) {
        const host = 'iphone.ac.qq.com', time = String(Date.now());
        const headers = { GUESTID: '0', GUESTTOKEN: '0', QIMEI: '0', QIMEI36: '0', FAKEDUIN: '0', OPENID: '0', ACCESSTOKEN: '0', QQ: '0', LOGINTYPE: '3', VERSION: '13.1.2', BUILDNO: '0924253', HOST: host,
            Accept: 'application/json', 'Accept-Encoding': 'identity', 'User-Agent': '', LOCALTIME: time };
        let metadata;
        try { metadata = this.crypto.metadata(); } catch (_) { throw this.fail('decode'); }
        if (!metadata || typeof metadata !== 'object') throw this.fail('decode');
        for (const key of ['DEVICETYPE', 'MODEL', 'NETWORK']) {
            const value = metadata[key];
            if (typeof value !== 'string' || !value || value.length > 128 || !/^[\x20-\x7e]+$/.test(value)) throw this.fail('decode');
            headers[key] = value;
        }
        try { headers.SC = this.crypto.sign(path, host, '0', '0', time); } catch (_) { throw this.fail('decode'); }
        if (chapterCatalog) { headers['Cache-Control'] = 'no-cache, no-store'; headers.Pragma = 'no-cache'; }
        const body = await this.get(ctx, 'https://' + host + path, headers, chapterCatalog ? 2097152 : 1048576);
        let obj;
        try {
            if (typeof this.crypto.decodeAsync !== 'function') throw this.fail('decode');
            obj = chapterCatalog ? await this.crypto.decodeCatalogAsync(body.trim()) : await this.crypto.decodeAsync(body.trim());
        } catch (_) { throw this.fail('decode'); }
        this.check(ctx);
        if (!obj || obj.error_code !== 2 || (Object.prototype.hasOwnProperty.call(obj, 'ret') && obj.ret !== 2) || Object.prototype.hasOwnProperty.call(obj, 'code') || Object.prototype.hasOwnProperty.call(obj, 'status')) throw this.fail('gate');
        return obj;
    }
    count(value) {
        return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
    }
    time(value) {
        // date is observed string only. Preserve relative text; blank means unknown.
        return typeof value === 'string' ? this.plain(value).slice(0, 100) || null : null;
    }
    avatar(value) {
        if (typeof value !== 'string') return null;
        value = value.replace(/^https:\/\/\/(thirdqq\.qlogo\.cn|manhua\.acimg\.cn)\//, 'https://$1/');
        return /^https:\/\/[^/\s<>@]+(?:\/[^\s<>]*)?$/.test(value) ? value : null;
    }
    validateBindings(obj, comicId, chapterId) {
        let count = 0;
        const walk = (x, depth) => {
            if (++count > 20000 || depth > 15) throw this.fail('schema');
            if (!x || typeof x !== 'object') return;
            if (Array.isArray(x)) { for (const v of x) walk(v, depth + 1); return; }
            for (const k of Object.keys(x)) {
                if ((k === 'comic_id' || k === 'chapter_id') && String(x[k]) !== (k === 'comic_id' ? comicId : chapterId)) throw this.fail('schema');
                if (x[k] && typeof x[k] === 'object') walk(x[k], depth + 1);
            }
        };
        walk(obj, 0); // target_id is deliberately NOT a chapter ID.
    }
    async comments(ctx, comicId, chapterId, page, sort) {
        const scope = JSON.stringify(['page', comicId, chapterId, sort]);
        const key = JSON.stringify([scope, page]);
        return this.cached(ctx, key, async () => {
            if (sort === 'wonderful' && page > 1) return { comments: [], maxPage: 1 };
            const host = 'iphone.ac.qq.com';
            const path = '/13.1.2/Community/' + (sort === 'wonderful' ? 'getWonderfulChapterTopicList' : 'getChapterTopicList') +
                '/comic_id/' + comicId + '/chapter_id/' + chapterId + (sort === 'wonderful' ? '' : '/listcnt/8/page/' + page + '/type/' + (sort === 'hot' ? '1' : '2'));
            const time = String(Date.now());
            const headers = { GUESTID: '0', GUESTTOKEN: '0', QIMEI: '0', QIMEI36: '0', FAKEDUIN: '0', OPENID: '0', ACCESSTOKEN: '0', QQ: '0', LOGINTYPE: '3', VERSION: '13.1.2', BUILDNO: '0924253', HOST: host,
                Accept: 'application/json', 'Accept-Encoding': 'identity', 'User-Agent': '', LOCALTIME: time };
            // Non-identity metadata comes from crypto owner's offline generated verified material.
            let metadata;
            try { metadata = this.crypto.metadata(); } catch (_) { throw this.fail('decode'); }
            if (!metadata || typeof metadata !== 'object') throw this.fail('decode');
            for (const key of ['DEVICETYPE', 'MODEL', 'NETWORK']) {
                const value = metadata[key];
                if (typeof value !== 'string' || !value || value.length > 128 || !/^[\x20-\x7e]+$/.test(value)) throw this.fail('decode');
                headers[key] = value;
            }
            try { headers.SC = this.crypto.sign(path, host, '0', '0', time); }
            catch (_) { throw this.fail('decode'); }
            const body = await this.get(ctx, 'https://' + host + path, headers, 1048576);
            let obj;
            try {
                if (typeof this.crypto.decodeAsync !== 'function') throw this.fail('decode');
                obj = await this.crypto.decodeAsync(body.trim());
            } catch (_) { throw this.fail('decode'); }
            this.check(ctx);
            if (!obj || obj.error_code !== 2 || (Object.prototype.hasOwnProperty.call(obj, 'ret') && obj.ret !== 2) || Object.prototype.hasOwnProperty.call(obj, 'code') || Object.prototype.hasOwnProperty.call(obj, 'status')) throw this.fail('gate');
            const rows = obj.data && obj.data[sort === 'wonderful' ? 'chapter_topic_list' : 'topic_list'];
            if (!Array.isArray(rows) || rows.length > 200) throw this.fail('schema');
            this.validateBindings(obj.data, comicId, chapterId);
            const unique = new Map();
            for (const row of rows) { const comment = this.normalize(row); if (!unique.has(comment.id)) unique.set(comment.id, comment); }
            const ids = Array.from(unique.keys());
            // Compare bounded cached adjacent pages only, never globally consume IDs. Repeat loads are deterministic.
            const prev = page > 1 ? this.getCache(JSON.stringify([scope, page - 1])) : null;
            if (ids.length && prev && prev.comments.length && JSON.stringify(ids.slice().sort()) === JSON.stringify(prev.comments.map(x => x.id).sort())) throw this.fail('repeated');
            // No count arithmetic or short-page inference: observed server can return 9 for listcnt/8.
            return { comments: Array.from(unique.values()), maxPage: sort === 'wonderful' ? 1 : rows.length === 0 ? page : null,
                ...(sort === 'wonderful' ? { commentContext: this.context(obj.data) } : {}) };
        });
    }
    async run(ctx, comicId, epId, page, sort, bound, thread = null) {
        const local = await this.local(ctx, comicId);
        // epId is the public source's ORDER KEY. No raw chapter ID, ordinal or index fallback.
        const row = local.chapters.find(x => x.id === epId);
        if (!row) return this.matchUnavailable(this.fail('chapter'));
        let remote;
        try { remote = await this.binding(ctx, comicId, local, bound); }
        catch (e) { return this.matchUnavailable(e); }
        const target = LiziTencentComments.matchChapter(row, local.chapters, remote.chapters);
        if (!target) return this.matchUnavailable(this.fail('chapter'));
        this.check(ctx);
        if (thread) {
            if (thread[3] !== remote.id || thread[4] !== target.id) throw this.fail('reply');
            return this.threadComments(ctx, thread, page);
        }
        const result = Object.assign({}, await this.comments(ctx, remote.id, target.id, page, sort));
        const stats = result.commentContext || await this.optional(ctx, c => this.stats(c, remote.id, target.id), 3000);
        const rich = await this.previews(ctx, result.comments, (c, x) => x.threadType == null ? null : this.threadComments(c, ['lizimh', comicId, epId, remote.id, target.id, x.id, x.threadType], 1));
        result.comments = rich;
        result.commentContext = stats || { provider: 'tencent', comicFavoriteCount: null, chapterLikeCount: null };
        // Bind at the local boundary, not inside a remote-page cache shared by local works.
        return Object.assign({}, result, { comments: result.comments.map(x => {
            const copy = Object.assign({}, x);
            copy.id = this.threadToken(comicId, epId, remote.id, target.id, x.id, x.threadType);
            delete copy.threadType;
            return copy;
        }) });
    }
}

/* Native Qingman bridge owns bootstrap, credentials and mTLS.
 * Search POST/query and catalog GET independently evidenced; search uniqueness
 * applies to the returned collection, not an unproved global exhaustive set. */
class QingmanProvider {
    constructor(source) { this.source = source; }
    static id(x) { return typeof x === 'string' && /^\d{1,20}$/.test(x); }
    static key(x) { return LiziTencentComments.titleKey(x); }
    static exactWork(title, candidates) {
        const matches = candidates.filter(x => this.key(x.title) === this.key(title));
        return matches.length === 1 ? matches[0] : null;
    }
    static exactChapter(row, local, remote) {
        const key = this.key(row.title);
        // Entire title is the anchor, including volume/subtitle/upper/lower part.
        const a = local.filter(x => this.key(x.title) === key);
        const b = remote.filter(x => this.key(x.title) === key);
        if (key && a.length === 1 && b.length === 1) return b[0];
        const parsed = LiziTencentComments.chapter(row.title);
        // Keep the provider's exact-title contract for ordinary titles.
        return parsed && parsed.padded ? LiziTencentComments.matchChapter(row, local, remote) : null;
    }
    static unavailable(reason) {
        return { comments: [], maxPage: 0, total: null, available: false, reason,
            diagnostic: { code: reason, provider: 'qingman' } };
    }
    static failure(code) {
        const messages = {
            'disabled': '青漫评论已关闭，请在源设置开启青漫只读评论后重试。',
            'work-unresolved': '青漫服务返回集合中没有完整书名精确匹配，不会猜测近似作品；可选手工绑定后仍核对详情。',
            'work-ambiguous': '青漫服务返回集合中存在多个精确同名候选，请用可选手工绑定消歧。',
            'search-truncated': '青漫搜索返回达到安全上限，集合可能截断，拒绝自动选择。',
            'search-schema': '青漫搜索数据格式无效或作品 ID 不完整，拒绝匹配。',
            'work-title-mismatch': '青漫绑定书名与当前作品不符，请核对本地作品 ID 和绑定的完整书名。',
            'remote-work-title-mismatch': '青漫作品 ID 对应的书名与当前作品不符，请核对青漫 comicId，勿绑定到同名以外的作品。',
            'chapter-unresolved': '青漫章节未匹配：当前章节或青漫真实目录中没有完整标题一致的章节；请核对目录，不会按章节序号猜测。',
            'chapter-ambiguous': '青漫章节匹配到多个候选：本地或青漫目录存在重复完整标题；为避免串章，暂不加载评论。',
            'chapter-binding-mismatch': '青漫显式章节绑定与唯一标题匹配结果不符，请核对 chapterId 和完整章节名。',
            'reply-unsupported': '青漫仅支持只读评论，暂不支持加载回复详情。',
            'sort-unsupported': '青漫不支持当前评论排序，请改用新评或热评；作品讨论仅支持默认排序。',
            'provider-changed': '青漫评论请求期间接口或绑定设置已变更，本次结果已过期，请重试。',
            'bridge-required': '当前 App 缺少 Qingman.request 桥接，请使用支持青漫桥接的 App 并导入本机配置。'
        };
        const error = new Error((messages[code] || '青漫评论无法加载，请核对配置后重试。') + ' [' + code + ']');
        error.code = code;
        error.qingmanCommentCode = code;
        error.provider = 'qingman';
        return error;
    }
    enabled() { return this.source.loadSetting('qingmanCommentsEnabled') !== 'off'; }
    bindings() {
        let x = this.source.loadSetting('manualqingmanbinding');
        if (x == null || x === '') return {};
        if (typeof x === 'string') { try { x = JSON.parse(x); } catch (_) { throw new Error('青漫手工绑定 JSON 无效'); } }
        if (!x || typeof x !== 'object' || Array.isArray(x) || Object.keys(x).length > 200) throw new Error('青漫手工绑定格式无效');
        for (const [localId, v] of Object.entries(x)) {
            if (!QingmanProvider.id(localId) || !v || typeof v !== 'object' || !QingmanProvider.id(v.comicId) || typeof v.title !== 'string' || !v.title.trim()) throw new Error('青漫绑定必须显式提供作品 comicId 和 title');
            if (v.chapters != null) {
                if (Array.isArray(v.chapters) || typeof v.chapters !== 'object' || Object.keys(v.chapters).length > 10000) throw new Error('青漫章节绑定无效');
                for (const [k, c] of Object.entries(v.chapters)) if (!QingmanProvider.id(k) || !c || !QingmanProvider.id(c.chapterId) || typeof c.title !== 'string' || !c.title.trim()) throw new Error('青漫章节绑定必须包含 chapterId/title');
            }
        }
        return x;
    }
    async request(path, params) {
        let r=await Qingman.request(path,params);
        if (r && typeof r.status==='number' && typeof r.body==='string') {
            if (r.status!==200) throw new Error('青漫 HTTP 请求失败');
            r=JSON.parse(r.body);
        }
        if (!r || r.code!==1) throw new Error('青漫未返回已验证成功响应');
        return r;
    }
    async load(comicId, epId, page, replyTo, options, workOnly = false) {
        if (!this.enabled()) throw QingmanProvider.failure('disabled');
        if (replyTo != null && replyTo !== '') throw QingmanProvider.failure('reply-unsupported');
        if (!QingmanProvider.id(String(comicId)) || !Number.isInteger(page) || page < 1 || page > 200) throw new Error('青漫评论参数无效');
        if (options != null && (typeof options !== 'object' || Array.isArray(options))) throw new Error('青漫评论选项无效');
        const sort = options && options.sort || (workOnly ? 'website-default' : 'new');
        if (workOnly ? sort !== 'website-default' : !['new', 'hot'].includes(sort)) throw QingmanProvider.failure('sort-unsupported');
        let binding = this.bindings()[String(comicId)];
        // No ordinal, author, fuzzy title or work-comment fallback.
        const info = await this.source.comic.loadInfo(String(comicId));
        if (!info || typeof info.title !== 'string' || !QingmanProvider.key(info.title)) throw QingmanProvider.failure('work-title-mismatch');
        if (binding && QingmanProvider.key(info.title) !== QingmanProvider.key(binding.title)) throw QingmanProvider.failure('work-title-mismatch');
        if (typeof Qingman === 'undefined' || typeof Qingman.request !== 'function') throw QingmanProvider.failure('bridge-required');
        if (!binding) {
            // Match the independently guarded native contract: keyword only,
            // no control characters, bounded UTF-8 bytes; never send page/author.
            let keywordBytes;
            try { keywordBytes = encodeURIComponent(info.title).replace(/%[0-9A-F]{2}|[^%]/g, 'x').length; }
            catch (_) { throw QingmanProvider.failure('search-schema'); }
            if (/[\u0000-\u001f\u007f-\u009f]/.test(info.title) || keywordBytes > 200) throw QingmanProvider.failure('search-schema');
            const search = await this.request('/api/comic/history/fu893u94/search', {keyword:info.title});
            if (!search.data || !Array.isArray(search.data.datas)) throw QingmanProvider.failure('search-schema');
            const candidates = search.data.datas;
            // No pagination metadata is evidenced. A full cap is treated as potentially truncated.
            if (candidates.length >= 200) throw QingmanProvider.failure('search-truncated');
            const ids = new Set();
            for (const c of candidates) {
                if (!c || !QingmanProvider.id(c.id) || typeof c.title !== 'string' || !QingmanProvider.key(c.title) || ids.has(c.id)) throw QingmanProvider.failure('search-schema');
                ids.add(c.id);
            }
            const matches = candidates.filter(c => QingmanProvider.key(c.title) === QingmanProvider.key(info.title));
            if (matches.length !== 1) throw QingmanProvider.failure(matches.length ? 'work-ambiguous' : 'work-unresolved');
            binding = {comicId:matches[0].id, title:matches[0].title};
        }
        const detail = await this.request('/api/comic/comics/ie84hfh8/detail', {comicId:binding.comicId});
        if (!detail.data || detail.data.id !== binding.comicId || typeof detail.data.title !== 'string') throw new Error('青漫作品详情格式错误');
        if (QingmanProvider.key(detail.data.title) !== QingmanProvider.key(info.title)) throw QingmanProvider.failure('remote-work-title-mismatch');
        let target;
        if (!workOnly) {
            const local = LiziTencentComments.catalog(info.chapters);
            const row = local && local.find(x => x.id === String(epId));
            if (!row) throw QingmanProvider.failure('chapter-unresolved');
            const catalog = await this.request('/api/comic/chapter/ie84hfh8/homelist/'+binding.comicId, {});
            if (!catalog.data || !Array.isArray(catalog.data.datas) || catalog.data.datas.length > 10000) throw new Error('青漫目录格式错误');
            const seen = new Set();
            const remote = catalog.data.datas.map(x => {
                if (!x || !QingmanProvider.id(x.id) || typeof x.chapterName !== 'string' || seen.has(x.id)) throw new Error('青漫目录含无效或重复章节');
                seen.add(x.id);return {id:x.id,title:x.chapterName};
            });
            target = QingmanProvider.exactChapter(row, local, remote);
            const mapped = binding.chapters && binding.chapters[String(epId)];
            // Explicit IDs narrow a verified title match, never override a mismatch.
            if (!target) {
                const key = QingmanProvider.key(row.title);
                const localMatches = local.filter(x => QingmanProvider.key(x.title) === key);
                const remoteMatches = remote.filter(x => QingmanProvider.key(x.title) === key);
                throw QingmanProvider.failure(key && (localMatches.length > 1 || remoteMatches.length > 1) ? 'chapter-ambiguous' : 'chapter-unresolved');
            }
            if (mapped && (target.id !== mapped.chapterId || QingmanProvider.key(mapped.title) !== QingmanProvider.key(target.title))) throw QingmanProvider.failure('chapter-binding-mismatch');
        }
        const path = workOnly ? '/api/comic/comments/fu893u94/list' : '/api/comic/comments/fu893u94/chapterList';
        const params = { page, size:20 };
        if (workOnly) { params.comicId = binding.comicId; params.sortType = 0; }
        else { params.chapterId = target.id; params.sort = sort === 'new' ? 1 : 0; }
        const r = await this.request(path, params);
        if (!r || r.code !== 1 || !r.data || !Array.isArray(r.data.datas) || !Number.isSafeInteger(r.data.total) || r.data.total < 0) throw new Error('青漫评论未返回已验证成功格式');
        const ids = new Set();
        const comments = r.data.datas.map(x => {
            if (!x || !QingmanProvider.id(x.id) || typeof x.content !== 'string' || ids.has(x.id)) throw new Error('青漫评论数据格式错误或重复（ID必须为无损字符串）');
            ids.add(x.id);
            return new Comment({id:'qingman:'+x.id, userName:typeof x.nickname === 'string' ? x.nickname : '', avatar:typeof x.avatar === 'string' && /^https:\/\//.test(x.avatar) ? x.avatar : null, content:x.content, time:x.createTime == null ? null : String(x.createTime), score:Number.isSafeInteger(x.likeNum) && x.likeNum>=0 ? x.likeNum : null, replyCount:Number.isSafeInteger(x.replyNum) && x.replyNum>=0 ? x.replyNum : null});
        });
        return {comments, available:true, total:r.data.total, maxPage:Math.max(1,Math.ceil(r.data.total/20)), notes:['青漫仅支持只读评论；回复/发评/点赞/精彩不可用','自动搜索服务返回集合唯一完整书名并核对详情；真实目录按完整标题唯一匹配']};
    }
}

class LiziCommentProviders {
    constructor(source) {
        this.source=source; this.revision=0; this.snapshot=null; this.tencent=null; this.qingman=null;
        this.scopes=new Map(); this.replies=new Map(); this.maxScopes=64; this.maxReplies=1024; this.ttl=120000;
    }
    selected() {
        // A new preference namespace is the one-time migration. Never write settings during a request.
        const p=this.source.loadSetting('commentProviderV2');
        if (p==null || p==='') return 'auto';
        if (!['auto','tencent','qingman'].includes(p)) throw new Error('评论接口设置无效');
        return p;
    }
    token() {
        const keys=['tencentCommentsEnabled','tencentCommentSort','tencentCommentBindings','qingmanCommentsEnabled','manualqingmanbinding'];
        const state=JSON.stringify([this.selected(),keys.map(k=>this.source.loadSetting(k))]);
        if (state!==this.snapshot) {
            this.snapshot=state; this.revision++; this.tencent=null; this.qingman=null;
            this.scopes.clear(); this.replies.clear();
        }
        return this.revision;
    }
    failure(code) { const e=new Error('评论路由已过期或参数无效，请重新加载首屏 ['+code+']'); e.code=code; return e; }
    check(revision) { if (this.token()!==revision) throw this.failure('provider-changed'); }
    put(map,key,value,max) {
        map.delete(key); map.set(key,value);
        while (map.size>max) map.delete(map.keys().next().value);
    }
    capabilities(workOnly) {
        this.token(); const q=this.selected()==='qingman';
        return {sorts:workOnly?[]:q?['new','hot']:['new','hot','wonderful'], defaultSort:'new', canLoadReplies:!q, canSend:false, canLike:false,
            enabled:q?new QingmanProvider(this.source).enabled():new LiziTencentComments(this.source,TencentChapterCrypto).enabled()};
    }
    async invoke(provider,workOnly,comicId,epId,page,replyTo,options) {
        if (provider==='qingman') {
            if (!this.qingman) this.qingman=new QingmanProvider(this.source);
            return this.qingman.load(comicId,epId,page,replyTo,options,workOnly);
        }
        if (!this.tencent) this.tencent=new LiziTencentComments(this.source,TencentChapterCrypto);
        return workOnly ? this.tencent.loadWorkWithOptions(comicId,epId,page,replyTo,options) : this.tencent.loadWithOptions(comicId,epId,page,replyTo,options);
    }
    noMatch(r) {
        return r && r.available===false && r.reason==='no-match' && r.diagnostic &&
            r.diagnostic.code==='work' && r.diagnostic.searchComplete===true;
    }
    chapterUnmatched(r) {
        return r && r.available===false && r.reason==='match-unresolved' && r.diagnostic &&
            r.diagnostic.code==='chapter';
    }
    empty(r) { return !!r && r.available===true && Array.isArray(r.comments) && r.comments.length===0; }
    async fallback(r,workOnly,comicId,epId,options,revision) {
        if (this.noMatch(r)) return 'no-match';
        if (!workOnly && this.chapterUnmatched(r)) return 'chapter-unmatched';
        if (!this.empty(r)) return null;
        if (workOnly) return r.total===0 ? 'confirmed-empty' : null;
        // A zero new page says nothing about hot/wonderful. Verify every supported first-page collection.
        const selected=options && options.sort || this.source.loadSetting('tencentCommentSort') || 'new';
        for (const sort of ['new','hot','wonderful']) {
            if (sort===selected) continue;
            const probe=await this.invoke('tencent',false,comicId,epId,1,null,{sort});
            this.check(revision);
            if (!this.empty(probe)) return null;
        }
        return 'confirmed-empty';
    }
    decorate(result,provider,base,revision,reason) {
        if (!result || !Array.isArray(result.comments)) throw this.failure('schema');
        const previous=result.commentContext || {};
        const commentContext={provider, comicFavoriteCount:provider==='tencent' && previous.comicFavoriteCount!=null?previous.comicFavoriteCount:null,
            chapterLikeCount:provider==='tencent' && previous.chapterLikeCount!=null?previous.chapterLikeCount:null};
        for (const comment of result.comments) {
            if (provider==='tencent' && typeof comment.id==='string' && /^(?:tqw8:|tqc3:)/.test(comment.id))
                this.put(this.replies,comment.id,{provider,base,revision},this.maxReplies);
        }
        return Object.assign({},result,{provider,effectiveProvider:provider,commentContext,
            routingContext:{provider,mode:this.selected(),revision,reason:reason || null,scope:base}});
    }
    async load(workOnly,comicId,epId,page,replyTo,options) {
        const revision=this.token();
        try { return await this.loadScoped(workOnly,comicId,epId,page,replyTo,options); }
        catch(e) { this.check(revision); throw e; }
    }
    async loadScoped(workOnly,comicId,epId,page,replyTo,options) {
        const revision=this.token(), mode=this.selected();
        comicId=String(comicId); epId=epId==null?'':String(epId); page=page==null?1:Number(page);
        if (!Number.isSafeInteger(page) || page<1 || page>500) throw this.failure('page');
        if (options!=null && (typeof options!=='object' || Array.isArray(options))) throw this.failure('options');
        const base=JSON.stringify([workOnly?'work':'chapter',comicId,workOnly?'':epId]);
        const sort=workOnly?'website-default':options && options.sort || (mode==='qingman'?'new':this.source.loadSetting('tencentCommentSort')) || 'new';
        if (!workOnly) options=Object.assign({},options || {},{sort});
        const key=JSON.stringify([base,sort]);
        const guard=p=>{ if (options && options.provider!=null && options.provider!==p) throw this.failure('stale-provider'); };
        if (replyTo!=null && replyTo!=='') {
            const reply=this.replies.get(replyTo);
            const active=this.scopes.get(key);
            if (!reply || reply.base!==base || reply.revision!==revision || reply.provider!=='tencent' || mode==='qingman' || !active || active.provider!==reply.provider) throw this.failure('reply-provider');
            guard(reply.provider);
            const r=await this.invoke(reply.provider,workOnly,comicId,epId,page,replyTo,options);
            this.check(revision); return this.decorate(r,reply.provider,base,revision,null);
        }
        let entry=this.scopes.get(key);
        if (entry && Date.now()-entry.time>this.ttl) {
            this.scopes.delete(key);
            entry=null;
        }
        let resolvedOnThisCall=false;
        if (!entry) {
            // Resolve the provider again after eviction; the decision remains sticky for this scope.
            entry={provider:mode==='auto'?'tencent':mode,time:Date.now(),reason:null,pending:null,sort};
            this.put(this.scopes,key,entry,this.maxScopes);
            if (mode==='auto') {
                resolvedOnThisCall=true;
                entry.pending=(async()=>{
                    let r=await this.invoke('tencent',workOnly,comicId,epId,1,null,options);
                    this.check(revision);
                    const reason=await this.fallback(r,workOnly,comicId,epId,options,revision);
                    this.check(revision);
                    if (reason) {
                        const fallbackOptions=!workOnly && sort==='wonderful'
                            ? Object.assign({},options,{sort:'new'}) : options;
                        try {
                            const qingman=await this.invoke('qingman',workOnly,comicId,epId,1,null,fallbackOptions);
                            this.check(revision);
                            r=qingman; entry.provider='qingman'; entry.reason=reason;
                            entry.sort=fallbackOptions && fallbackOptions.sort || sort;
                        } catch(e) {
                            if (e && e.code==='provider-changed') throw e;
                            this.check(revision);
                            entry.provider='tencent';
                            entry.reason=reason+':fallback-failed:'+((e && e.code) || 'error');
                        }
                    }
                    entry.first=r; entry.time=Date.now();
                })();
                try { await entry.pending; }
                catch(e) { if (this.scopes.get(key)===entry) this.scopes.delete(key); this.check(revision); throw e; }
                finally { entry.pending=null; }
                guard(entry.provider);
                if (page===1) return this.decorate(entry.first,entry.provider,base,revision,entry.reason);
            }
        }
        if (entry.pending) await entry.pending;
        this.check(revision); guard(entry.provider);
        // The first request decides the route; a requested later page follows it.
        const result=resolvedOnThisCall && entry.first && page>1
            ? await this.invoke(entry.provider,workOnly,comicId,epId,page,null,
                entry.provider==='qingman' && !workOnly && entry.sort==='new'
                    ? Object.assign({},options,{sort:'new'}) : options)
            : resolvedOnThisCall && page===1 ? entry.first
            : await this.invoke(entry.provider,workOnly,comicId,epId,page,null,
                entry.provider==='qingman' && !workOnly && entry.sort==='new'
                    ? Object.assign({},options,{sort:'new'}) : options);
        this.check(revision);
        return this.decorate(result,entry.provider,base,revision,entry.reason);
    }
}


/* Read-only visible chapter facts: local dates, Tencent chapter_good_num.
 * Uses an independent provider so comment errors/settings never block this feed. */
class LiziChapterMetadata {
    constructor(source) {
        this.source = source;
        this.provider = new LiziTencentComments(source, TencentChapterCrypto);
        this.flights = new Map();
    }
    static title(value) {
        let title = LiziTencentComments.titleKey(String(value || ''));
        const m = title.match(/^(\d{1,6})\s*([^\d\s:：.．/、~～—–-].*)$/);
        if (m && !/^[话話章回]/.test(m[2])) title = '第' + Number(m[1]) + '话 ' + m[2];
        return title;
    }
    // Parse every title once (identity, subtitle, trimmed text), then match by
    // lookup. Pure index over the same rows: no identity rule is relaxed.
    static prepared(rows) {
        const parses = new Map(), byIdentity = new Map(), byText = new Map();
        const parse = (title) => {
            const key = String(title == null ? '' : title);
            if (parses.has(key)) return parses.get(key);
            const value = LiziTencentComments.chapter(key);
            parses.set(key, value);
            return value;
        };
        for (const row of rows) {
            const a = parse(row.title);
            if (a) {
                const list = byIdentity.get(a.identity);
                if (list) list.push(row); else byIdentity.set(a.identity, [row]);
            }
            const text = LiziTencentComments.text(row.title);
            if (text) {
                const list = byText.get(text);
                if (list) list.push(row); else byText.set(text, [row]);
            }
        }
        return { parse, byIdentity, byText };
    }
    static match(row, local, remote, index) {
        const localIndex = (index && index.local) || this.prepared(local);
        const remoteIndex = (index && index.remote) || this.prepared(remote);
        const a = localIndex.parse(row.title);
        if (a) {
            const locals = localIndex.byIdentity.get(a.identity) || [];
            const targets = remoteIndex.byIdentity.get(a.identity) || [];
            if (locals.length !== 1 || targets.length !== 1) return null;
            const b = remoteIndex.parse(targets[0].title);
            if (!LiziTencentComments.compatibleSubtitle(a, b) &&
                !(LiziTencentComments.contextAnchored(row, targets[0], local, remote, { local: localIndex, remote: remoteIndex }) &&
                  LiziTencentComments.compatibleSubtitle(a, b, true))) return null;
            return targets[0];
        }
        const title = LiziTencentComments.text(row.title);
        if (/第?[0-9零一二三四五六七八九十百]+[话話章回]/.test(title) && /上下|[上中下]篇|(?:^|[\s:：()（）-])[上中下](?:$|[\s)）])/.test(title)) return null;
        // Exact unnumbered titles are anchors too; no stripping 番外/卷/上下篇.
        if (!title || /^(?:正文|章节|章節|更新|通知|无标题|無標題|未命名|待定|暂无标题|暫無標題|暂无|暫無|未定|待命名|untitled)$/i.test(title)) return null;
        const ls = localIndex.byText.get(title) || [];
        const rs = remoteIndex.byText.get(title) || [];
        return ls.length === 1 && rs.length === 1 ? rs[0] : null;
    }
    async load(comicId, chapterIds) {
        comicId = String(comicId);
        if (!/^\d{1,20}$/.test(comicId) || !Array.isArray(chapterIds)) return {};
        const ids = Array.from(new Set(chapterIds.filter(x => typeof x === 'string' && /^\d{1,20}$/.test(x))));
        if (!ids.length) return {};
        const key = JSON.stringify([comicId, ids]);
        if (this.flights.has(key)) return this.flights.get(key);
        const ctx = { end: Date.now() + 18000, expired: false };
        let timer;
        const work = this.run(ctx, comicId, ids).catch(() => ({}));
        const pending = Promise.race([work, new Promise(resolve => {
            timer = setTimeout(() => { ctx.expired = true; resolve({}); }, 18000);
        })]).finally(() => { if (timer) clearTimeout(timer); this.flights.delete(key); });
        this.flights.set(key, pending);
        return pending;
    }
    async local(ctx, comicId) {
        // Details are a seed for this entry, never a completed loadInfo cache.
        const seed = await (this.source._chapterInfoFlights[comicId] ||
            this.source._chapterInfoCache[comicId] || this.source.comic.loadInfo(comicId));
        this.provider.check(ctx);
        if (!this.locals) this.locals = new Map();
        const cached = this.locals.get(comicId);
        if (cached && cached.seed === seed) return cached.local;
        const chapters = LiziTencentComments.catalog(seed && seed.chapters);
        if (!chapters || !LiziTencentComments.text(seed.title)) throw this.provider.fail('local');
        const dates = {}, sourceMeta = seed.chapterMetadata || {};
        for (const row of chapters) {
            const m = sourceMeta[row.id];
            if (m && typeof m.updateTime === 'string' && m.updateTime) dates[row.id] = { updateTime: m.updateTime, dateSource: 'lizi' };
        }
        const local = { title: LiziTencentComments.text(seed.title), authors: LiziTencentComments.authors(seed.tags && seed.tags['作者']), chapters, dates };
        this.locals.set(comicId, { seed, local });
        return local;
    }
    withDates(local, ids, out) {
        for (const id of ids) if (local && local.dates && local.dates[id]) out[id] = { ...local.dates[id] };
        return out;
    }
    async run(ctx, comicId, ids) {
        const p = this.provider, out = {};
        let local, remote;
        try { local = await this.local(ctx, comicId); } catch (_) { return out; }
        this.withDates(local, ids, out);
        let bound = null;
        // Explicit work binding remains available even when comments are off.
        const setting = this.source.loadSetting('tencentCommentBindings');
        if (setting != null && setting !== '') {
            let bindings;
            try { bindings = typeof setting === 'string' ? JSON.parse(setting) : setting; } catch (_) { return out; }
            if (!bindings || Array.isArray(bindings) || typeof bindings !== 'object') return out;
            if (Object.prototype.hasOwnProperty.call(bindings, comicId)) {
                bound = String(bindings[comicId]);
                if (!/^\d{1,20}$/.test(bound)) return out;
            }
        }
        const catalogFor = (id) => {
            // Like counts are live; share only an unfinished catalog request.
            let flight = this.catalogFlight;
            if (!flight || flight.comicId !== id) {
                const promise = p.api(ctx, '/13.1.2/Comic/comicChapterList/comic_id/' + id, true);
                flight = { comicId: id, promise };
                this.catalogFlight = flight;
                promise.then(() => { if (this.catalogFlight === flight) this.catalogFlight = null; },
                             () => { if (this.catalogFlight === flight) this.catalogFlight = null; });
            }
            return flight.promise;
        };
        // A manual ID is known before title verification, so overlap both requests.
        // Never consume its catalog until the existing binding checks succeed.
        const catalogPending = bound ? catalogFor(bound) : null;
        try { remote = await p.binding(ctx, comicId, local, bound); }
        catch (_) { return out; }
        try {
        const obj = await (catalogPending || catalogFor(remote.id));
        p.check(ctx);
        const rows = obj.data && obj.data.chapter_list;
        if (!Array.isArray(rows) || !rows.length || rows.length > 10000) return out;
        const counts = new Map();
        for (const row of rows) {
            const id = String(row && row.chapter_id || '');
            if (!/^\d{1,20}$/.test(id) || counts.has(id)) throw p.fail('schema');
            counts.set(id, { likes: p.count(row.good_count), date: typeof row.update_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(row.update_date) ? row.update_date : null });
        }
        // Preserve raw numbering for the constrained padded/ordinal fallback.
        // prepared() normalizes exact-title keys without rewriting identities.
        const normalizedLocal = local.chapters;
        const normalizedRemote = remote.chapters;
        // Build both indexes once; parity with LiziTencentComments.matchChapter is
        // covered by test.cjs over the real 385x384 catalog.
        const index = { local: LiziChapterMetadata.prepared(normalizedLocal), remote: LiziChapterMetadata.prepared(normalizedRemote) };
        for (let i = 0; i < normalizedLocal.length; i++) {
            const row = normalizedLocal[i];
            const target = LiziChapterMetadata.match(row, normalizedLocal, normalizedRemote, index);
            const fact = target && counts.get(target.id);
            out[row.id] = {
                ...(out[row.id] || {}),
                ...(fact && fact.date ? { tencentUpdateTime: fact.date } : {}),
                ...(fact && Number.isSafeInteger(fact.likes) && fact.likes >= 0 ? { likesCount: fact.likes, likesSource: 'tencent' } : {})
            };
            if (i % 16 === 15) { await new Promise(resolve => setTimeout(resolve, 0)); p.check(ctx); }
        }
        return out;
        } catch (_) { return this.withDates(local, ids, {}); }
    }
}

// Local test repair, 2026-10-31. No account creation, ad operations or fabricated manifests.
(() => {
    const proto = Lizimh.prototype;
    const originalInit = proto.init;
    const ttl = 5 * 60 * 1000;
    const validArray = value => Array.isArray(value) && value.length > 0 && value.length <= 2000 && value.every(x => typeof x === "string" && x.length < 4096);
    const header = (headers, key) => {
        for (const name of Object.keys(headers || {})) if (name.toLowerCase() === key) return String(headers[name]);
        return "";
    };
    const oldApiHeaders = Lizimh.apiHeaders;
    Lizimh.apiHeaders = extra => Object.assign({}, oldApiHeaders(extra), { "cache-time": "no" });

    proto.loadSetting = function (key) {
        const fallback = this.settings && this.settings[key] ? this.settings[key].default : null;
        if (!this._repairReady) return fallback;
        return ComicSource.prototype.loadSetting.call(this, key) ?? fallback;
    };

    proto.installRepair = function () {
        this._repairReady = false;
        this._catalogEpoch = {};
        this._directoryEpoch = {};
        this._verifiedAt = {};
        this._pageStart = {};
        this._identities = {};
        this._catalogRows = {};
        this._readerFlights = {};
        this._verifyFlights = {};
        this._officialFlights = {};
        this._officialAt = {};
        this._officialFailure = {};
        this._officialEpoch = {};
        this._officialCredential = "";
        this._requestQueue = [];
        this._requestActive = 0;
        this._prefetchGeneration = 0;
        this._cacheSchema = 3;
        this.comic.loadInfo = id => this.repairedInfo(id);
        this.comic.loadEp = (id, ep) => this.repairedChapter(id, ep);
        this.comic.onImageLoad = url => {
            const seen = new Set([url]);
            return { headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.lizimh.com/" }, onLoadFailed: () => {
                const next = this.nextLineUrl(url);
                if (!next || seen.has(next) || seen.size >= Lizimh.lines.length) return undefined;
                seen.add(next); url = next;
                return { url: next, headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://www.lizimh.com/" } };
            } };
        };
        this.settings.authToken.description = "选填本人有效的官方登录凭证。带后缀文件名的新章节需服务器返回真实图片清单；仍受账号阅读权限限制。API 当前使用 HTTP，请知悉凭证传输方式。";
        this.settings.clearRepairCaches = { title: "清理阅读缓存", type: "callback", buttonText: "清理后重新加载", callback: () => {
            this.clearRepairCaches(); UI.showMessage("阅读缓存已清理，请重新打开作品目录和章节。");
        } };
        this.settings.prefetchNextV3 = { title: "预取下一章", type: "select", options: [{ value: "off", text: "关闭（省流量）" }, { value: "on", text: "仅预取旧格式章节" }], default: "off" };
    };

    proto.init = async function () {
        this._repairReady = true;
        await originalInit.call(this);
    };

    proto.catalogIdentity = function (comicId) {
        if (this._identities[comicId]) return this._identities[comicId];
        let map = {};
        try { const saved = JSON.parse(this.loadData("chapterIdentityV3_" + comicId) || "{}");
            if (saved && typeof saved === "object" && !Array.isArray(saved)) {
                const used = new Set();
                for (const id of Object.keys(saved)) if (/^\d{1,20}$/.test(id) && /^\d{1,10}$/.test(String(saved[id])) && !used.has(String(saved[id]))) {
                    map[id] = String(saved[id]); used.add(String(saved[id]));
                }
            }
        } catch (_) {}
        this._identities[comicId] = map;
        return map;
    };

    proto.repairedInfo = async function (comicId) {
        const id = String(comicId);
        if (!/^\d{1,20}$/.test(id)) throw new Error("栗子：作品 ID 无效，请重新搜索作品。");
        if (this._chapterInfoFlights[id]) return this._chapterInfoFlights[id];
        const epoch = this._catalogEpoch[id] || 0;
        const flight = (async () => {
            const data = await Lizimh.getJson("/app/api/v2/detail/" + id);
            if (!data || !Array.isArray(data.chapters) || !data.chapters.length) throw new Error("栗子：作品详情没有取得有效目录，请稍后刷新。");
            if ((this._catalogEpoch[id] || 0) !== epoch) throw new Error("栗子：目录缓存已清理，请重新打开作品。");
            const number = row => { const n = Number(row.order); return Number.isFinite(n) && n > 0 ? n : 1e12; };
            const rows = data.chapters.slice().sort((a, b) => number(a) - number(b));
            const ids = new Set();
            for (const row of rows) {
                const id = String(row && row.id || "");
                if (!/^\d{1,20}$/.test(id) || ids.has(id)) throw new Error("栗子：目录章节 ID 缺失或重复，未替换已有目录。");
                ids.add(id);
            }
            const identities = this.catalogIdentity(id), used = new Set(Object.values(identities));
            let maximum = Math.max(0, ...Array.from(used, Number));
            const firstImport = used.size === 0;
            let previous = 0;
            const chapters = new Map(), covers = {}, byId = {}, epMap = {}, metadata = {}, chapterCovers = {}, rowsById = {}, order = [];
            for (const row of rows) {
                const chapterId = String(row.id);
                let key = identities[chapterId];
                if (!key) {
                    let candidate = firstImport ? parseInt(row.order, 10) : maximum + 1;
                    if (!Number.isFinite(candidate) || candidate <= 0 || candidate <= previous && firstImport) candidate = previous + 1;
                    while (used.has(String(candidate))) candidate++;
                    key = String(candidate); identities[chapterId] = key; used.add(key); maximum = Math.max(maximum, candidate); previous = candidate;
                }
                const cover = typeof row.cover === "string" ? row.cover : "";
                epMap[key] = chapterId; byId[chapterId] = cover; rowsById[chapterId] = row;
                chapters.set(key, String(row.name || "第" + key + "话")); order.push(key);
                if (cover) { covers[key] = cover; chapterCovers[key] = this.abs(cover); }
                if (typeof row.created_at === "string" && row.created_at) metadata[key] = { updateTime: row.created_at, dateSource: "lizi" };
            }
            this._epMap[id] = epMap; this._coverById[id] = byId; this._coverCache[id] = covers;
            this._orderCache[id] = order; this._catalogRows[id] = rowsById;
            this.saveData("chapterIdentityV3_" + id, JSON.stringify(identities));
            const dates = rows.map(row => row.created_at).filter(value => typeof value === "string" && value).sort();
            const lastDate = dates.length ? dates[dates.length - 1] : "";
            const info = new ComicDetails({ title: String(data.name || ""), cover: this.abs(data.picY || data.picX), description: String(data.content || ""),
                tags: { "作者": String(data.author || "").split(",").filter(Boolean), "标签": String(data.tags || "").split(",").filter(Boolean), "状态": [this.statusFromData(data, lastDate)] },
                chapters, stars: Number(data.score) || null, updateTime: lastDate ? Lizimh.fmtDate(lastDate) : null });
            info.chapterCovers = chapterCovers; info.chapterMetadata = metadata;
            this._chapterInfoCache[id] = info;
            return info;
        })();
        this._chapterInfoFlights[id] = flight;
        try { return await flight; } finally { if (this._chapterInfoFlights[id] === flight) delete this._chapterInfoFlights[id]; }
    };

    proto.statusFromData = function (data, date) {
        // Keep the prior site's display convention rather than assume isend semantics.
        return Lizimh.statusByLastUpdate(date);
    };

    proto.chapterCovers = async function (id) {
        id = String(id);
        if (!this._coverCache[id]) await this.comic.loadInfo(id);
        return this._coverCache[id] || {};
    };

    proto.resetComicCache = function (comicId) {
        const id = String(comicId || "");
        if (!id) return false;
        this._catalogEpoch[id] = (this._catalogEpoch[id] || 0) + 1;
        this._prefetchGeneration++;
        const chapterIds = new Set(Object.values(this._epMap[id] || {}));
        for (const chapterId of Object.keys(this._coverById[id] || {})) chapterIds.add(chapterId);
        let hit = 0;
        for (const cover of Object.values(this._coverById[id] || {})) {
            const dir = this.officialImagePath(cover).replace(/\/[^/]*$/, "");
            this._directoryEpoch[dir] = (this._directoryEpoch[dir] || 0) + 1;
            delete this._pageCache[dir]; delete this._verified[dir]; delete this._verifiedAt[dir]; delete this._pageStart[dir]; hit++;
        }
        for (const chapterId of chapterIds) {
            this._officialEpoch[chapterId] = (this._officialEpoch[chapterId] || 0) + 1;
            delete this._officialFlights[chapterId];
            delete this._officialCache[chapterId]; delete this._officialAt[chapterId]; delete this._officialFailure[chapterId];
            this.saveData("officialPics_" + chapterId, "");
        }
        delete this._coverCache[id]; delete this._orderCache[id]; delete this._epMap[id]; delete this._coverById[id];
        delete this._catalogRows[id]; delete this._chapterInfoCache[id]; delete this._chapterInfoFlights[id];
        if (this._chapterMetadataProvider) delete this._chapterMetadataProvider.locals;
        this.persistVerified(); this.persistPages();
        return hit;
    };

    proto.clearRepairCaches = function () {
        for (const id of Object.keys(this._epMap)) this.resetComicCache(id);
        this._prefetchGeneration++;
        this._verified = {}; this._verifiedAt = {}; this._pageCache = {}; this._pageStart = {};
        this._officialCache = {}; this._officialAt = {}; this._chapterInfoCache = {};
        this.saveData("verifiedPages", ""); this.saveData("pageCounts", ""); this.persistVerified();
    };

    proto.persistPages = function () { /* Discovery counts are not evidence of completeness; do not persist them. */ };
    proto.loadPersistedPages = function () { this._pageCache = {}; };
    proto.loadPersistedVerified = function () {
        try {
            const saved = JSON.parse(this.loadData("verifiedPagesV3") || "{}");
            if (saved.schema !== 3 || !Array.isArray(saved.entries)) return;
            for (const item of saved.entries.slice(-60)) if (typeof item.dir === "string" && validArray(item.urls) && Number.isFinite(item.time) && Date.now() - item.time >= 0 && Date.now() - item.time < ttl) {
                this._verified[item.dir] = item.urls; this._verifiedAt[item.dir] = item.time;
                this._pageStart[item.dir] = Number(item.start) || 1;
            }
        } catch (_) {}
    };
    proto.persistVerified = function () {
        const entries = Object.keys(this._verified).filter(dir => validArray(this._verified[dir]) && Date.now() - (this._verifiedAt[dir] || 0) < ttl)
            .map(dir => ({ dir, urls: this._verified[dir].map(url => this.officialImagePath(url)), time: this._verifiedAt[dir], start: this._pageStart[dir] || 1 }))
            .sort((a, b) => a.time - b.time).slice(-60);
        this.saveData("verifiedPagesV3", JSON.stringify({ schema: 3, entries }));
    };

    proto.requestImage = function (url) {
        const headers = { "User-Agent": "Mozilla/5.0", "Range": "bytes=0-0", "cache-time": "no" };
        return new Promise((resolve, reject) => {
            const entry = { url, resolve, reject, expired: false };
            setTimeout(() => { entry.expired = true; reject(new Error("栗子：图片连接超时，未返回不完整章节。")); }, 18000);
            this._requestQueue.push(entry); this.drainImageQueue(headers);
        });
    };
    proto.drainImageQueue = function (headers) {
        while (this._requestActive < 6 && this._requestQueue.length) {
            const entry = this._requestQueue.shift();
            if (entry.expired) continue;
            this._requestActive++;
            Promise.resolve().then(() => Network.sendRequest("GET", entry.url, headers)).then(value => {
                if (!entry.expired) entry.resolve(value);
            }, error => { if (!entry.expired) entry.reject(error); }).finally(() => {
                entry.expired = true; this._requestActive--; this.drainImageQueue(headers);
            });
        }
    };

    proto.imageState = async function (url) {
        let response;
        for (let attempt = 0; attempt < 2; attempt++) {
            try { response = await this.requestImage(url); } catch (_) { throw new Error("栗子：图片连接失败或超时，请稍后重试。"); }
            if (response.status !== 429 && response.status !== 503) break;
            if (attempt === 0) await this.sleep(400);
        }
        const status = Number(response.status);
        if (status === 404 || status === 410) return false;
        if (status === 401 || status === 403) throw new Error("栗子：图片线路拒绝访问（HTTP " + status + "），不能将其当成章节末尾。");
        if (status !== 200 && status !== 206) throw new Error("栗子：图片线路 HTTP " + status + "，请重试或在源设置中更换可用线路。");
        const headers = response.headers || {}, type = header(headers, "content-type");
        const range = header(headers, "content-range").match(/^bytes\s+0-0\/(\d+)$/i);
        const size = status === 206 && range ? Number(range[1]) : Number(header(headers, "content-length")) || (response.buffer ? response.buffer.byteLength : 0);
        if (!/^image\/(?:jpeg|jpg|png|webp|gif|avif)(?:;|$)/i.test(type)) throw new Error("栗子：图片线路返回了非图片内容，未缓存为章节。");
        if (size > 0 && size <= 128) return false; // Known tiny missing-image placeholders.
        if (!Number.isFinite(size) || size <= 128 || status === 206 && !range) throw new Error("栗子：无法验证图片响应的实际长度，请稍后重试。");
        return true;
    };

    proto.resolvePageUrl = async function (dir, ext, page) {
        const extensions = Array.from(new Set([ext, "jpg", "webp", "jpeg", "png"]));
        for (let line = 0; line < Lizimh.lines.length; line++) for (const extension of extensions) {
            const url = this.lineAbs(dir + "/" + page + "." + extension, line);
            if (await this.imageState(url)) return url;
        }
        return null;
    };

    proto.probePages = async function (rawDir, ext, limit) {
        const dir = this.officialImagePath(rawDir);
        limit = Number(limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 600) throw new Error("栗子：页数上限设置无效。");
        const epoch = this._directoryEpoch[dir] || 0;
        const current = () => { if ((this._directoryEpoch[dir] || 0) !== epoch) throw new Error("栗子：章节缓存已清理，请重新打开。"); };
        const url = page => this.lineAbs(dir + "/" + page + "." + ext);
        const prior = this._verified[dir];
        if (validArray(prior) && Date.now() - (this._verifiedAt[dir] || 0) < ttl) {
            const normalized = prior.map(value => this.abs(value));
            const last = Number(this.officialImagePath(normalized[normalized.length - 1]).match(/\/(\d+)\.[A-Za-z0-9]+$/)?.[1]);
            if (last && last <= limit) {
                const [end, next, beyond] = await Promise.all([this.imageState(normalized[normalized.length - 1]), this.imageState(url(last + 1)), this.imageState(url(last + 2))]);
                current();
                if (end && !next && !beyond) return normalized;
            }
            delete this._verified[dir]; delete this._verifiedAt[dir]; this.persistVerified();
        }
        const seen = new Map();
        let first = 0, last = 0, ended = false;
        for (let start = 1; start <= limit + 2; start += 6) {
            const pages = [];
            for (let page = start; page < start + 6 && page <= limit + 2; page++) pages.push(page);
            const states = await Promise.all(pages.map(async page => [page, await this.imageState(url(page))]));
            current();
            for (const [page, exists] of states) { seen.set(page, exists); if (exists) { if (!first) first = page; last = page; } }
            if (!first && seen.size >= 10) throw new Error("栗子：未取得有效正文图片，请刷新目录或更换可用线路。");
            if (last > limit) throw new Error("栗子：章节超过当前页数上限，请在源设置中提高上限后重试；未返回半章。");
            if (first && seen.get(last + 1) === false && seen.get(last + 2) === false) { ended = true; break; }
        }
        if (!first || !ended) throw new Error("栗子：尚未确认章节末尾，请提高页数上限或稍后重试。");
        const images = [];
        for (let page = first; page <= last; page++) {
            let found = seen.get(page) ? url(page) : await this.resolvePageUrl(dir, ext, page);
            current();
            if (!found) throw new Error("栗子：正文第 " + page + " 页缺失，未缓存为完整章节，请稍后重试。");
            images.push(found);
        }
        this._pageStart[dir] = first; this._pageCache[dir] = last;
        this._verified[dir] = images.map(value => this.officialImagePath(value)); this._verifiedAt[dir] = Date.now();
        this.persistVerified();
        return images;
    };

    proto.verifyAllPages = async function (dir, ext, total) {
        const epoch = this._directoryEpoch[dir] || 0, start = this._pageStart[dir] || 1, urls = [];
        for (let page = start; page <= total; page += 6) {
            const pages = [];
            for (let n = page; n < page + 6 && n <= total; n++) pages.push(n);
            const batch = await Promise.all(pages.map(n => this.resolvePageUrl(dir, ext, n)));
            if ((this._directoryEpoch[dir] || 0) !== epoch) return false;
            if (batch.some(value => !value)) return false;
            urls.push(...batch);
        }
        if (!urls.length) return false;
        this._verified[dir] = urls.map(value => this.officialImagePath(value)); this._verifiedAt[dir] = Date.now(); this.persistVerified(); return true;
    };
    proto.scheduleVerify = function (dir, ext, total) {
        if (this._verifyFlights[dir]) return;
        const pending = this.verifyAllPages(dir, ext, total).catch(() => false).finally(() => { if (this._verifyFlights[dir] === pending) delete this._verifyFlights[dir]; });
        this._verifyFlights[dir] = pending;
    };

    proto.officialPics = async function (chapterId) {
        chapterId = String(chapterId || "");
        if (!/^\d{1,20}$/.test(chapterId)) return null;
        let token = String(this.loadSetting("authToken") || "").replace(/^jwt:\s*/i, "").replace(/^Bearer\s+/i, "").trim();
        if (!token) { this._officialFailure[chapterId] = "此章节需要服务器返回真实图片清单；未填写本人有效的官方登录凭证。"; return null; }
        if (this._officialCredential !== token) {
            for (const id of new Set([...Object.keys(this._officialCache), ...Object.keys(this._officialFlights)])) this._officialEpoch[id] = (this._officialEpoch[id] || 0) + 1;
            this._officialCache = {}; this._officialAt = {}; this._officialFlights = {}; this._officialCredential = token;
        }
        const credential = token;
        if (validArray(this._officialCache[chapterId]) && Date.now() - (this._officialAt[chapterId] || 0) < ttl) return this.officialImageUrls(this._officialCache[chapterId]);
        if (this._officialFlights[chapterId]) return this._officialFlights[chapterId];
        const epoch = this._officialEpoch[chapterId] || 0;
        const pending = (async () => {
            const base = Lizimh._useFallback ? Lizimh.apiFallback : Lizimh.api;
            let response;
            try { response = await Network.get(base + Lizimh.signedPath("/app/api/chapter/v3/" + chapterId), Lizimh.apiHeaders({ authorization: credential })); }
            catch (_) { this._officialFailure[chapterId] = "官方图片清单连接失败，请稍后重试。"; return null; }
            if (response.status === 401 || response.status === 403) { this._officialFailure[chapterId] = "官方图片清单 HTTP " + response.status + "：请在官方 App 确认账号可阅读该章并更新本人凭证。"; return null; }
            let payload; try { payload = JSON.parse(response.body); } catch (_) {}
            const pics = payload && payload.data && payload.data.pics;
            if (response.status !== 200 || !validArray(pics)) { this._officialFailure[chapterId] = "官方接口未返回有效的完整图片清单（HTTP " + response.status + "）。"; return null; }
            if ((this._officialEpoch[chapterId] || 0) !== epoch || this._officialCredential !== credential) throw new Error("栗子：凭证或阅读缓存已变化，请重新打开章节。");
            this._officialCache[chapterId] = pics.map(value => this.officialImagePath(value)); this._officialAt[chapterId] = Date.now();
            delete this._officialFailure[chapterId]; return this.officialImageUrls(pics);
        })();
        this._officialFlights[chapterId] = pending;
        try { return await pending; } finally { if (this._officialFlights[chapterId] === pending) delete this._officialFlights[chapterId]; }
    };

    proto.repairedChapter = async function (comicId, epId) {
        comicId = String(comicId); epId = String(epId);
        const flightKey = JSON.stringify([comicId, epId]);
        if (this._readerFlights[flightKey]) return this._readerFlights[flightKey];
        const epoch = this._catalogEpoch[comicId] || 0;
        const pending = (async () => {
            let refreshed = false;
            if (!this._epMap[comicId]) { await this.comic.loadInfo(comicId); refreshed = true; }
            let chapterId = this.resolveEp(comicId, epId);
            let cover = (this._coverById[comicId] || {})[chapterId];
            if (!cover && !refreshed) { await this.comic.loadInfo(comicId); refreshed = true; chapterId = this.resolveEp(comicId, epId); cover = (this._coverById[comicId] || {})[chapterId]; }
            const official = await this.officialPics(chapterId);
            if ((this._catalogEpoch[comicId] || 0) !== epoch) throw new Error("栗子：阅读缓存已清理，请重新打开章节。");
            if (official) return { images: official };
            if (!cover) throw new Error("栗子：刷新后仍没有取得该章自身的图片路径，请稍后重试；未使用其他章节图片替代。");
            const path = this.officialImagePath(cover);
            const match = path.match(/^(\/(?!\/)[^?#]*)\/(\d+)\.([A-Za-z0-9]+)$/);
            if (!match) throw new Error("栗子：该章使用新版图片文件名，无法从一张封面确定整章页数和顺序。" + (this._officialFailure[chapterId] || "请稍后刷新官方图片清单。"));
            const images = await this.probePages(match[1], match[3], Number(this.loadSetting("maxPages") || 300));
            if ((this._catalogEpoch[comicId] || 0) !== epoch) throw new Error("栗子：阅读缓存已清理，请重新打开章节。");
            const line = this.currentLine();
            for (const url of images) { this._imgLine[url] = line; this._imgPath[url] = this.officialImagePath(url); }
            if (this.loadSetting("prefetchNextV3") === "on") this.warmNext(comicId, epId).catch(() => {});
            return { images };
        })();
        this._readerFlights[flightKey] = pending;
        try { return await pending; } finally { if (this._readerFlights[flightKey] === pending) delete this._readerFlights[flightKey]; }
    };

    proto.warmNext = async function (comicId, epId) {
        if (this.loadSetting("prefetchNextV3") !== "on") return;
        const generation = this._prefetchGeneration, order = this._orderCache[String(comicId)] || [];
        const position = order.indexOf(String(epId)), next = order[position + 1];
        if (position < 0 || !next) return;
        const cover = (this._coverCache[String(comicId)] || {})[next];
        const match = this.officialImagePath(cover).match(/^(\/(?!\/)[^?#]*)\/(\d+)\.([A-Za-z0-9]+)$/);
        if (!match || generation !== this._prefetchGeneration || this._requestActive > 0) return;
        // Never make an account/official chapter request just to prefetch.
        await this.probePages(match[1], match[3], Number(this.loadSetting("maxPages") || 300));
    };

    proto.speedTest = async function () {
        let sample;
        try {
            const data = await Lizimh.getJson("/app/api/v2/detail/57229");
            sample = data && Array.isArray(data.chapters) && data.chapters.find(row => typeof row.cover === "string" && row.cover);
        } catch (_) {}
        if (!sample) { console.log("[lizimh] 未取得测速图片，保留当前线路。"); return; }
        const measured = await Promise.all(Lizimh.lines.map(async (line, index) => {
            const start = Date.now();
            try { const ok = await this.imageState(this.lineAbs(sample.cover, index)); return { index, time: ok ? Date.now() - start : 999999 }; }
            catch (_) { return { index, time: 999999 }; }
        }));
        const good = measured.filter(item => item.time < 999999).sort((a, b) => a.time - b.time);
        if (!good.length) { console.log("[lizimh] 测速图片未成功，保留线路并在阅读时显示具体错误。"); return; }
        this._lineOrder = good.map(item => item.index).concat(measured.filter(item => item.time >= 999999).map(item => item.index));
        console.log("[lizimh] 按同一张实际图片验证线路完成。");
    };
})();

// 2.33.30: validate actual bytes; separate probe/read cache keys; reject incompatible encrypted lines.
(() => {
    const proto = Lizimh.prototype;
    const previousInstall = proto.installRepair;
    const previousInit = proto.init;
    const previousPath = proto.officialImagePath;
    const previousAbs = proto.abs;
    const previousLine = proto.currentLine;
    const previousChapter = proto.repairedChapter;
    const mark = "#lz_image_23329";
    const clean = value => String(value || "").replace(/#lz_image_\d+$/, "");
    const origin = value => String(value || "").match(/^https?:\/\/[^/?#]+/i)?.[0] || "";
    const findHeader = (headers, name) => {
        for (const key of Object.keys(headers || {})) if (key.toLowerCase() === name) return String(headers[key]);
        return "";
    };
    const bytesOf = value => {
        if (value && typeof value.byteLength === "number" || Array.isArray(value)) return new Uint8Array(value);
        return new Uint8Array(0);
    };
    const isImage = bytes => {
        if (bytes.length < 12) return false;
        const ascii = (offset, text) => Array.from(text).every((char, index) => bytes[offset + index] === char.charCodeAt(0));
        return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ||
            bytes[0] === 137 && ascii(1, "PNG\r\n\x1a\n") ||
            ascii(0, "RIFF") && ascii(8, "WEBP") ||
            ascii(0, "GIF87a") || ascii(0, "GIF89a") ||
            ascii(4, "ftyp") && (ascii(8, "avif") || ascii(8, "avis"));
    };
    const failure = (text, retryLine = false) => { const error = new Error("栗子：" + text); error.retryImageLine = retryLine; return error; };

    proto.officialImagePath = function (value) { return previousPath.call(this, clean(value)); };
    proto.abs = function (value) {
        const url = previousAbs.call(this, value);
        return url ? clean(url) + mark : "";
    };
    proto.currentLine = function () {
        const requested = previousLine.call(this);
        if (this._imageLineOverride !== undefined && !this._badImageOrigins?.has(origin(Lizimh.lines[this._imageLineOverride]?.url))) return this._imageLineOverride;
        if (this._plainImageOrigins?.size && !this._plainImageOrigins.has(origin(Lizimh.lines[requested]?.url))) {
            const verified = (this._lineOrder || Lizimh.lines.map((_, index) => index)).find(index => this._plainImageOrigins.has(origin(Lizimh.lines[index]?.url)) && !this._badImageOrigins?.has(origin(Lizimh.lines[index]?.url)));
            if (verified !== undefined) return verified;
        }
        if (!this._badImageOrigins?.has(origin(Lizimh.lines[requested]?.url))) return requested;
        const order = this._lineOrder || Lizimh.lines.map((_, index) => index);
        return order.find(index => !this._badImageOrigins.has(origin(Lizimh.lines[index]?.url))) ?? requested;
    };

    proto.fullImageResponse = function (data) {
        const bytes = bytesOf(data);
        if (bytes.length <= 128 || !isImage(bytes)) throw failure("线路返回的数据不是可直接解码的完整图片，请重新加载或切换兼容线路。", true);
        return bytes;
    };
    proto.deliveryImageURL = function (key) {
        const plain = clean(key), path = this.officialImagePath(plain);
        return path.startsWith("/") && !path.startsWith("//") ? this.lineAbs(path) : plain;
    };
    proto.imageLoadingConfig = function (key) {
        const path = this.officialImagePath(key), tried = new Set();
        const build = url => ({ url: clean(url), headers: { "User-Agent": "Mozilla/5.0", "cache-time": "no" },
            onResponse: data => this.fullImageResponse(data),
            onLoadFailed: () => {
                if (!path.startsWith("/") || path.startsWith("//")) return undefined;
                for (const index of this._lineOrder || Lizimh.lines.map((_, i) => i)) {
                    const url = this.lineAbs(path, index), host = origin(url);
                    if (tried.has(host) || this._badImageOrigins.has(host)) continue;
                    tried.add(host); return build(url);
                }
                return undefined;
            } });
        const url = this.deliveryImageURL(key); tried.add(origin(url)); return build(url);
    };
    proto.installRepair = function () {
        previousInstall.call(this);
        this._badImageOrigins = new Set();
        this._plainImageOrigins = new Set();
        this._imageLineOverride = undefined;
        const load = this.comic.loadEp;
        this.comic.loadEp = async (comicId, epId) => {
            if (this._imageReady) await this._imageReady;
            const result = await load(comicId, epId);
            return Object.assign({}, result, { images: result.images.map(url => clean(url) + mark) });
        };
        // Thumbnail hooks are synchronous in Venera 1.6.3.
        this.comic.onThumbnailLoad = key => this.imageLoadingConfig(key);
        this.comic.onImageLoad = key => this.imageLoadingConfig(key);
    };
    proto.init = async function () {
        const pending = (async () => {
            await previousInit.call(this);
            if (this.loadSetting("imageLine") !== "auto") await this.speedTest();
        })();
        this._imageReady = pending;
        try { await pending; } finally { if (this._imageReady === pending) this._imageReady = null; }
    };

    proto.requestImage = function (rawURL) {
        const url = clean(rawURL) + (String(rawURL).includes("?") ? "&" : "?") + "lz_probe=23329";
        const headers = { "User-Agent": "Mozilla/5.0", "Range": "bytes=0-31", "cache-time": "no" };
        return new Promise((resolve, reject) => {
            const entry = { url, resolve, reject, expired: false };
            setTimeout(() => { entry.expired = true; reject(failure("图片连接超时，未返回不完整章节。", true)); }, 18000);
            this._requestQueue.push(entry); this.drainImageQueue(headers);
        });
    };
    proto.drainImageQueue = function (headers) {
        while (this._requestActive < 6 && this._requestQueue.length) {
            const entry = this._requestQueue.shift();
            if (entry.expired) continue;
            this._requestActive++;
            Promise.resolve().then(() => Network.fetchBytes("GET", entry.url, headers)).then(value => {
                if (!entry.expired) entry.resolve(value);
            }, error => { if (!entry.expired) entry.reject(error); }).finally(() => {
                entry.expired = true; this._requestActive--; this.drainImageQueue(headers);
            });
        }
    };
    proto.imageState = async function (url) {
        let response;
        for (let attempt = 0; attempt < 2; attempt++) {
            try { response = await this.requestImage(url); }
            catch (_) { throw failure("图片连接失败或超时，请稍后重试。", true); }
            if (response.status !== 429 && response.status !== 503) break;
            if (attempt === 0) await this.sleep(400);
        }
        const status = Number(response.status), headers = response.headers || {};
        if (status === 404 || status === 410) return false;
        if (status === 401 || status === 403) throw failure("图片线路拒绝访问（HTTP " + status + "），不能将其当成章节末尾。");
        if (status === 429) throw failure("图片线路请求过于频繁，请稍后重试（HTTP 429）。");
        if (status !== 200 && status !== 206) throw failure("图片线路 HTTP " + status + "，请重试或更换可用线路。", status >= 500);
        const bytes = bytesOf(response.body);
        if ((findHeader(headers, "x-image-enc-version") || findHeader(headers, "x-image-enc-seed")) && !isImage(bytes)) {
            this._badImageOrigins.add(origin(url));
            throw failure("当前线路返回加密图片，已排除这条不兼容线路。", true);
        }
        const range = findHeader(headers, "content-range").match(/^bytes\s+0-(\d+)\/(\d+)$/i);
        const size = status === 206 && range ? Number(range[2]) : Number(findHeader(headers, "content-length")) || bytes.length;
        if (size > 0 && size <= 128) return false;
        if (status === 206 && (!range || Number(range[1]) + 1 !== bytes.length) || !Number.isFinite(size) || size <= 128) throw failure("图片响应长度异常，请重新加载。", true);
        if (!isImage(bytes)) { this._badImageOrigins.add(origin(url)); throw failure("图片字节不符合常见图片格式，已排除不兼容线路。", true); }
        this._plainImageOrigins.add(origin(url));
        return true;
    };

    proto.repairedChapter = async function (comicId, epId) {
        const tried = new Set();
        for (let attempt = 0; attempt < Lizimh.lines.length; attempt++) {
            const current = this.currentLine(); tried.add(origin(Lizimh.lines[current]?.url));
            try { return await previousChapter.call(this, comicId, epId); }
            catch (error) {
                if (!error.retryImageLine) throw error;
                const order = this._lineOrder || Lizimh.lines.map((_, index) => index);
                const alternative = order.find(index => !tried.has(origin(Lizimh.lines[index]?.url)) && !this._badImageOrigins.has(origin(Lizimh.lines[index]?.url)));
                if (alternative === undefined) throw error;
                this._imageLineOverride = alternative;
            }
        }
        throw failure("当前没有可用的兼容图片线路，请稍后重试。");
    };
})();

// 2.33.30: bulk ArrayBuffer image bridge and bounded boundary discovery.
(() => {
    const proto = Lizimh.prototype;
    const previousInstall = proto.installRepair;
    const previousAbs = proto.abs;
    const clean = value => String(value || "").replace(/#lz_image_\d+$/, "");
    const marker = "#lz_image_23330";
    const ttl = 5 * 60 * 1000;
    const sourceRoot = "https://media.imgo.buzz"; // Previously verified plain-image fallback from public config.
    const actualBuffer = value => {
        if (Object.prototype.toString.call(value) === "[object ArrayBuffer]") return value;
        if (ArrayBuffer.isView(value)) return value.byteOffset === 0 && value.byteLength === value.buffer.byteLength ? value.buffer : value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
        if (Array.isArray(value)) return new Uint8Array(value).buffer;
        throw new Error("栗子：客户端没有传入图片字节。");
    };
    const imageSignature = bytes => bytes.length >= 12 && (
        bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 ||
        bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71 ||
        bytes[0] === 82 && bytes[1] === 73 && bytes[8] === 87 && bytes[9] === 69 ||
        bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70 ||
        bytes[4] === 102 && bytes[5] === 116 && bytes[6] === 121 && bytes[7] === 112 && bytes[8] === 97 && bytes[9] === 118);

    proto.abs = function (value) { const url = previousAbs.call(this, value); return url ? clean(url) + marker : ""; };
    proto.nativeRecord = function (field, value) {
        this._nativeV23330[field] = value;
        if (field === "cover" || field === "body" || field === "chapter" || field === "home") {
            try { this.saveData("nativeRegression23330", JSON.stringify(this._nativeV23330)); } catch (_) {}
        }
    };
    proto.fullImageResponse = function (data) {
        const buffer = actualBuffer(data), bytes = new Uint8Array(buffer);
        if (bytes.length <= 128 || !imageSignature(bytes)) throw new Error("栗子：收到非图片或截断内容，未写入图片缓存。");
        // The SDK contract is ArrayBuffer -> ArrayBuffer. Never return a typed-array object.
        return buffer;
    };
    proto.installRepair = function () {
        previousInstall.call(this);
        this._boundaryV4 = {};
        this._boundaryFlights = {};
        this._nativeV23330 = { version: "1.2.3", responseContract: "ArrayBuffer" };
        const config = this.imageLoadingConfig;
        const loading = (key, kind) => {
            const value = config.call(this, key);
            const response = value.onResponse;
            value.onResponse = data => {
                const started = Date.now(), buffer = response(data);
                if (!this._nativeV23330[kind]) this.nativeRecord(kind, { bytes: buffer.byteLength, inputType: Object.prototype.toString.call(data), outputType: Object.prototype.toString.call(buffer), callbackMs: Date.now() - started });
                return buffer;
            };
            return value;
        };
        this.comic.onThumbnailLoad = key => loading(key, "cover");
        this.comic.onImageLoad = key => loading(key, "body");
        const load = this.comic.loadEp;
        this.comic.loadEp = async (comicId, epId) => {
            const started = Date.now();
            const result = await load(comicId, epId);
            this.nativeRecord("chapter", { comicId: String(comicId), epId: String(epId), pages: result.images.length, loadMs: Date.now() - started });
            return Object.assign({}, result, { images: result.images.map(url => clean(url) + marker) });
        };
        this.explore[0].load = async () => {
            const started = Date.now();
            const data = await Lizimh.getJson("/app/api/home/data");
            if (this._configReady) await this._configReady;
            const groups = data && data.home_content_list;
            if (!Array.isArray(groups)) throw new Error("栗子：首页未取得有效分区，请刷新。");
            const parts = [];
            for (const group of groups) {
                if (!Array.isArray(group.comic_list) || !group.comic_list.length) continue;
                const seen = new Set(), comics = [];
                for (const row of group.comic_list) {
                    const id = String(row && row.id || "");
                    if (!id || seen.has(id)) continue;
                    seen.add(id); comics.push(this.parseComic(row, "chapter"));
                }
                if (comics.length) parts.push({ title: String(group.title || "首页推荐"), comics });
            }
            if (!parts.length) throw new Error("栗子：首页没有取得有效作品，请刷新。");
            this.nativeRecord("home", { groups: parts.length, comics: parts.reduce((sum, part) => sum + part.comics.length, 0), requests: 1, loadMs: Date.now() - started });
            return parts;
        };
    };

    proto.init = async function () {
        this._repairReady = true;
        // Slow/dead standby hosts must not block opening a comic.
        Lizimh.lines = [{ name: "兼容图片线路", url: sourceRoot }];
        this.loadPersistedPages(); this.loadPersistedVerified();
        const pending = (async () => {
            try {
                const data = await Lizimh.getJson("/app/api/configv2");
                const general = data.cfg_general || {}, generator = general.img_generator || {};
                let lines = Lizimh.parseGenerators(generator.code || "", generator.generators || []);
                lines = lines.filter((line, index, all) => /^https:\/\//.test(line.url) && !/cf-1\.imgio\.club/i.test(line.url) && all.findIndex(other => other.url === line.url) === index);
                if (lines.length) Lizimh.lines = lines;
                if (!Lizimh.lines.some(line => line.url === sourceRoot)) Lizimh.lines.unshift({ name: "兼容图片线路", url: sourceRoot });
                const tags = Array.isArray(general.category_tabs) && general.category_tabs.length ? general.category_tabs : Lizimh.fallbackTags;
                const classes = Array.isArray(data.cfg_comic_class) && data.cfg_comic_class.length ? data.cfg_comic_class.map(row => [row.name, row.id]) : Lizimh.fallbackClasses;
                this.category = { title: "栗子漫画", parts: [
                    { name: "推荐", type: "fixed", categories: ["热门排行"], categoryParams: ["rank"], itemType: "category" },
                    { name: "题材", type: "fixed", categories: tags, categoryParams: tags.map(tag => "tag:" + tag), itemType: "category" },
                    { name: "地区", type: "fixed", categories: classes.map(row => row[0]), categoryParams: classes.map(row => "class:" + row[1]), itemType: "category" },
                    { name: "状态", type: "fixed", categories: ["连载", "完结"], categoryParams: ["isend:0", "isend:1"], itemType: "category" }
                ] };
            } catch (_) { /* Use the known public-config fallback, never block on a speed test. */ }
            this._lineOrder = Lizimh.lines.map((_, index) => index);
            this._imageLineOverride = 0;
            this.settings.imageLine.options = [{ value: "auto", text: "自动选择兼容线路" }, ...Lizimh.lines.map((line, index) => ({ value: String(index), text: line.name }))];
        })();
        this._configReady = pending;
        try { await pending; } finally { if (this._configReady === pending) this._configReady = null; }
    };

    proto.probePages = async function (rawDir, ext, limit) {
        const dir = this.officialImagePath(rawDir);
        limit = Number(limit);
        if (!Number.isInteger(limit) || limit < 1 || limit > 600) throw new Error("栗子：页数上限设置无效。");
        const id = JSON.stringify([dir, ext, limit, this.currentLine()]);
        if (this._boundaryFlights[id]) return this._boundaryFlights[id];
        const epoch = this._directoryEpoch[dir] || 0;
        const pending = (async () => {
            const memo = new Map();
            const checkEpoch = () => { if ((this._directoryEpoch[dir] || 0) !== epoch) throw new Error("栗子：阅读缓存已清理，请重新打开章节。"); };
            const url = page => this.lineAbs(dir + "/" + page + "." + ext);
            const exists = page => {
                if (page < 1 || page > limit + 2) return Promise.resolve(false);
                if (!memo.has(page)) memo.set(page, this.imageState(url(page)).then(result => { checkEpoch(); return result; }));
                return memo.get(page);
            };
            const cached = this._boundaryV4[dir];
            let first = 0, last = 0;
            if (cached && cached.ext === ext && cached.last <= limit && Date.now() - cached.at < ttl) {
                const values = await Promise.all([exists(cached.first), exists(cached.last), exists(cached.last + 1), exists(cached.last + 2)]);
                if (values[0] && values[1] && !values[2] && !values[3]) { first = cached.first; last = cached.last; }
            }
            if (!first) {
                const heads = [1, 2, 3, 4, 5, 6].filter(page => page <= limit);
                let values = await Promise.all(heads.map(exists));
                first = heads.find((page, index) => values[index]) || 0;
                if (!first) {
                    const remaining = [7, 8, 9, 10].filter(page => page <= limit);
                    values = await Promise.all(remaining.map(exists));
                    first = remaining.find((page, index) => values[index]) || 0;
                }
                if (!first) throw new Error("栗子：未取得有效正文图片，请刷新目录或更换可用线路。");
                const grid = [];
                for (let page = 25; page < limit; page += 25) grid.push(page);
                if (!grid.includes(limit)) grid.push(limit);
                const states = await Promise.all(grid.map(exists));
                let lo = first, hi = limit + 1;
                for (let index = 0; index < grid.length; index++) if (states[index]) lo = Math.max(lo, grid[index]);
                for (let index = 0; index < grid.length; index++) if (grid[index] > lo && !states[index]) { hi = grid[index]; break; }
                if (lo === limit) {
                    const beyond = await Promise.all([exists(limit + 1), exists(limit + 2)]);
                    if (beyond.some(Boolean)) throw new Error("栗子：章节超过当前页数上限，请提高上限后重试；未返回半章。");
                    last = limit;
                } else {
                    while (hi - lo > 1) {
                        const middle = Math.floor((lo + hi) / 2);
                        if (await exists(middle)) lo = middle; else hi = middle;
                    }
                    // Validate a real tail and two absent following files. Errors never count as absence.
                    while (true) {
                        const values = await Promise.all([exists(lo + 1), exists(lo + 2)]);
                        if (!values[0] && !values[1]) break;
                        if (lo >= limit || lo + 1 > limit || values[1] && lo + 2 > limit) throw new Error("栗子：章节超过当前页数上限，请提高上限后重试；未返回半章。");
                        lo += values[1] ? 2 : 1;
                    }
                    last = lo;
                }
            }
            checkEpoch();
            this._boundaryV4[dir] = { first, last, ext, at: Date.now() };
            const images = [];
            for (let page = first; page <= last; page++) images.push(url(page));
            // Only a boundary has been checked. Individual full images are checked at download time.
            return images;
        })();
        this._boundaryFlights[id] = pending;
        try { return await pending; } finally { if (this._boundaryFlights[id] === pending) delete this._boundaryFlights[id]; }
    };
    const oldReset = proto.resetComicCache;
    proto.resetComicCache = function (id) {
        for (const value of Object.values(this._coverById[String(id)] || {})) delete this._boundaryV4[this.officialImagePath(value).replace(/\/[^/]+$/, "")];
        return oldReset.call(this, id);
    };
})();
