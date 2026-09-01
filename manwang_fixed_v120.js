/**
 * 漫网 (manwang.net) Venera 漫画源
 *
 * 站点事实（取证于 2026-08，详见 development_log.md）：
 * - 首页: https://www.manwang.net/
 * - 详情页: /book/{bookId}
 * - 章节页: /chapter/{bookId}-{chapterId}
 * - 分类: /category (全部), /category/tags/{tagId} (题材), /category/finish/{1连载|2完结}
 *   分页: /category/page/{N} 或 /category/tags/{id}/page/{N}
 * - 搜索: GET /index.php/search?key={kw}（表单路由已确认，但当前出口实测会返回 0 结果或限流）
 *   注意：官方搜索失效时，源会优先过滤已取证目录，再按真实 /category/page/{N} 分页做深度兜底；不伪造不存在的书籍 ID
 *
 * 图片协议（已取证并复现）：
 * - 章节页内联脚本 var params='{密文}'，密文 = base64(前16字节IV + AES-128-CBC密文)
 * - AES key = "9S8$vJnU2ANeSRoF"（UTF-8），解密得 JSON {host, source_id, images:[...]}
 * - source_id==15：真实样本图片为直链（https://dmw.546457.xyz/...），需章节 Referer；已实测返回标准 WebP
 * - source_id==12：当前 pic-v2.js 对绝对图片 URL 直接加载；相对 URL 会补到 img1.baipiaoguai.org 并用 AES-CBC(key=iv="my2ecret782ecret")、Pkcs7 解密（真实 source_id==12 章节尚未取到，代码仅做协议兼容）
 */
class ManWang extends ComicSource {

    name = "漫网";

    key = "manwang";

    version = "1.2.0";

    minAppVersion = "1.4.0";

    // 无维护中的更新地址，按规范显式留空
    url = "";

    baseUrl = "https://www.manwang.net";

    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    // 已取证密钥（来自站点 pic-v2.js 前端解密调用链）
    paramsAesKey = "9S8$vJnU2ANeSRoF";      // params 密文 AES-128-CBC key
    imageAesKey = "my2ecret782ecret";       // source_id==12 图片 AES-CBC key（key=iv）

    // 搜索接口可能返回空壳或“搜索繁忙”；先使用真实列表页，再按分类分页深度检索。
    searchCatalogCache = null;
    searchCatalogPendingPaths = null;
    searchCatalogComplete = false;
    searchDeepCatalogCache = null;
    searchDeepCatalogNextPage = 2;
    searchDeepCatalogComplete = false;
    searchCatalogMaxPage = 1;

    /**
     * 初始化：若用户在设置中填入了浏览器 Cookie（如 cf_clearance），注入给搜索请求。
     * 说明：当前实测搜索会因服务端状态/网络出口返回空结果或限流；Cookie 是否能改变结果没有被证实，不能作为搜索修复保证。
     */
    init() {
        try {
            const cookieStr = this.loadSetting("search_cookie");
            if (cookieStr) {
                const cookies = String(cookieStr).split(";").map((pair) => {
                    const p = pair.trim().split("=");
                    return new Cookie({ name: p[0], value: p.slice(1).join("="), domain: "manwang.net" });
                }).filter((c) => c.name);
                if (cookies.length > 0) Network.setCookies(this.baseUrl, cookies);
            }
        } catch (e) {
            // 设置读取/注入失败不影响其他功能
        }
    }

    // 可选设置：搜索 Cookie（浏览器中 manwang.net 的 cf_clearance 等，name=value; name=value 形式）
    settings = {
        search_cookie: {
            title: "搜索 Cookie（可选，效果待验证）",
            type: "input",
            default: "",
        },
    };

    // ===== 工具函数 =====

    requestHeaders() {
        return {
            "User-Agent": this.ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": this.baseUrl + "/",
        };
    }

    absoluteUrl(p) {
        if (!p) return "";
        p = String(p).trim();
        // 详情页真实封面有 http://www.manwang.net 形式；先升级到 HTTPS，避免 Venera 移动端明文请求/混合内容问题。
        if (/^http:\/\/www\.manwang\.net\//i.test(p)) return "https://" + p.slice(7);
        if (/^https?:\/\//i.test(p)) return p;
        if (p.startsWith("//")) return "https:" + p;
        if (p.startsWith("/")) return this.baseUrl + p;
        return this.baseUrl + "/" + p;
    }

    normalizeBookId(id) {
        const s = String(id || "").trim();
        const fromPath = s.match(/(?:^|\/)book\/(\d+)/);
        if (fromPath) return fromPath[1];
        return /^\d+$/.test(s) ? s : null;
    }

    bookIdFromHref(href) {
        const m = String(href || "").match(/\/book\/(\d+)/);
        return m ? m[1] : "";
    }

    chapterIdFromHref(href) {
        const m = String(href || "").match(/\/chapter\/\d+-(\d+)/);
        return m ? m[1] : "";
    }

    /**
     * 标准化历史章节入参（纯章节ID / 组合ID / 完整URL / 对象），返回纯章节数字 ID。
     */
    normalizeChapterId(epId) {
        if (!epId) return null;
        if (typeof epId === "object") {
            const v = epId.epId || epId.chapterId || epId.id || epId.url;
            return v ? this.normalizeChapterId(v) : null;
        }
        const s = String(epId);
        const m = s.match(/chapter\/\d+-(\d+)/);
        if (m) return m[1];
        if (/^\d+$/.test(s)) return s;
        const m2 = s.match(/^\d+-(\d+)$/);
        if (m2) return m2[1];
        return null;
    }

    /**
     * 解密章节页 params 密文 → JSON 对象。
     * 结构：base64 → 前16字节 IV → 其余 AES-128-CBC(Pkcs7) → UTF-8 → JSON。
     */
    decryptParams(b64) {
        const raw = Convert.decodeBase64(b64);
        const rawView = new Uint8Array(raw);
        if (rawView.length < 32 || (rawView.length - 16) % 16 !== 0) throw "params 密文长度无效";
        const iv = rawView.slice(0, 16).buffer;
        const cipher = rawView.slice(16).buffer;
        const key = Convert.encodeUtf8(this.paramsAesKey);
        const decrypted = Convert.decryptAesCbc(cipher, key, iv);
        const plain = Convert.decodeUtf8(decrypted);
        // 截取最外层 JSON（容错尾部 Pkcs7 padding）
        const start = plain.indexOf("{");
        const end = plain.lastIndexOf("}");
        if (start < 0 || end <= start) throw "params 解密结果不是 JSON";
        return JSON.parse(plain.slice(start, end + 1));
    }

    /**
     * 从封面 img 提取 URL（优先 data-src 懒加载字段，回退 src）。
     */
    imgUrl(img) {
        if (!img) return "";
        const u = img.attributes["data-src"] || img.attributes.src || "";
        if (!u || u.indexOf("data-loading") >= 0) return "";
        return this.absoluteUrl(u);
    }

    /**
     * 首页卡片解析（.item-comic）。
     */
    parseHomeCard(item) {
        const link = item.querySelector("a");
        const id = this.bookIdFromHref(link ? link.attributes.href : "");
        if (!id) return null;
        const img = item.querySelector("img.lazyload") || item.querySelector("img");
        const cover = this.imgUrl(img);
        const titleEl = item.querySelector(".comic-info h4") || item.querySelector("h4") || item.querySelector(".detail-title");
        const title = titleEl ? titleEl.text.trim() : "";
        const subParts = [];
        const mask = item.querySelector(".comic-mask p");
        if (mask) subParts.push(mask.text.trim());
        return new Comic({ id: id, title: title, cover: cover, subTitle: subParts.join(" · ") });
    }

    /**
     * 分类/搜索卡片解析（.comic-item）。
     */
    parseListCard(item) {
        // item 即 a.comic-item
        const id = this.bookIdFromHref(item.attributes.href);
        if (!id) return null;
        const img = item.querySelector("img.lazyload") || item.querySelector("img");
        const cover = this.imgUrl(img);
        const titleEl = item.querySelector(".comic-info h2") || item.querySelector("h2") || item.querySelector(".detail-title") || item.querySelector("h4");
        const title = titleEl ? titleEl.text.trim() : "";
        const process = item.querySelector(".process");
        const desc = item.querySelector(".desc");
        const tagList = item.querySelector(".tag-list");
        const subParts = [];
        if (process) subParts.push(process.text.trim());
        if (tagList) subParts.push(tagList.text.trim());
        return new Comic({
            id: id,
            title: title,
            cover: cover,
            subTitle: subParts.join(" · "),
            description: desc ? desc.text.trim() : "",
        });
    }

    parseLeadCard(item) {
        const link = item.querySelector("a[href*='/book/']");
        const img = item.querySelector("img");
        const id = this.bookIdFromHref(link ? link.attributes.href : "");
        if (!id || !img) return null;
        const title = String(img.attributes.alt || img.attributes.title || "").trim();
        return new Comic({
            id: id,
            title: title || id,
            cover: this.imgUrl(img),
            subTitle: "首页重点推荐",
        });
    }

    parseRelatedCard(item) {
        const comic = this.parseLeadCard(item);
        if (!comic) return null;
        const mask = item.querySelector(".comic-mask p");
        comic.subTitle = mask && mask.text.trim()
            ? "相关推荐 · " + mask.text.trim()
            : "相关推荐";
        return comic;
    }

    addUniqueComic(list, seen, comic) {
        if (!comic || !comic.id) return;
        const existing = seen[comic.id];
        if (existing) {
            // 轮播卡片可能只有封面和 ID，后续热门搜索/列表卡片才有真实标题；合并而不是丢弃后者。
            if ((!existing.title || existing.title === existing.id) && comic.title && comic.title !== comic.id) existing.title = comic.title;
            if (!existing.cover && comic.cover) existing.cover = comic.cover;
            if (!existing.subTitle && comic.subTitle) existing.subTitle = comic.subTitle;
            if (!existing.description && comic.description) existing.description = comic.description;
            return;
        }
        seen[comic.id] = comic;
        list.push(comic);
    }

    parseHomePanel(panel) {
        const list = [];
        const seen = {};
        panel.querySelectorAll(".panel-comic-l").forEach((item) => {
            this.addUniqueComic(list, seen, this.parseLeadCard(item));
        });
        panel.querySelectorAll(".item-comic").forEach((item) => {
            this.addUniqueComic(list, seen, this.parseHomeCard(item));
        });
        return list;
    }

    parseListDocument(doc) {
        const list = [];
        const seen = {};
        doc.querySelectorAll(".comic-item").forEach((item) => {
            this.addUniqueComic(list, seen, this.parseListCard(item));
        });
        if (list.length === 0) {
            doc.querySelectorAll(".item-comic").forEach((item) => {
                this.addUniqueComic(list, seen, this.parseHomeCard(item));
            });
        }
        return list;
    }

    parseSearchSuggestions(doc) {
        const list = [];
        doc.querySelectorAll(".layer-search-all a[href*='/book/']").forEach((a) => {
            const id = this.bookIdFromHref(a.attributes.href || "");
            const title = a.text ? a.text.trim() : "";
            if (!id || !title) return;
            let cover = "";
            doc.querySelectorAll("a[href*='/book/']").forEach((link) => {
                if (cover || this.bookIdFromHref(link.attributes.href || "") !== id) return;
                const img = link.querySelector("img");
                if (img) cover = this.imgUrl(img);
            });
            list.push(new Comic({ id: id, title: title, cover: cover, subTitle: "站内推荐" }));
        });
        return list;
    }

    async loadSearchCatalog() {
        const allPaths = ["/", "/custom/update", "/custom/hot", "/category/finish/1", "/category/finish/2", "/category"];
        if (this.searchCatalogComplete && this.searchCatalogCache !== null) return this.searchCatalogCache;
        const paths = this.searchCatalogPendingPaths === null ? allPaths : this.searchCatalogPendingPaths.slice();
        const catalog = this.searchCatalogCache || [];
        const seen = {};
        catalog.forEach((comic) => { if (comic && comic.id) seen[comic.id] = comic; });
        const pending = [];
        for (let i = 0; i < paths.length; i++) {
            let doc = null;
            try {
                const res = await Network.get(this.baseUrl + paths[i], this.requestHeaders());
                if (!res || res.status !== 200 || !res.body) {
                    pending.push(paths[i]);
                    continue;
                }
                doc = new HtmlDocument(res.body);
                if (paths[i] === "/") {
                    doc.querySelectorAll("#slider .slides li").forEach((item) => {
                        this.addUniqueComic(catalog, seen, this.parseLeadCard(item));
                    });
                    doc.querySelectorAll(".panel-comic").forEach((panel) => {
                        this.parseHomePanel(panel).forEach((comic) => this.addUniqueComic(catalog, seen, comic));
                    });
                    this.parseSearchSuggestions(doc).forEach((comic) => this.addUniqueComic(catalog, seen, comic));
                } else {
                    this.parseListDocument(doc).forEach((comic) => this.addUniqueComic(catalog, seen, comic));
                    this.searchCatalogMaxPage = Math.max(this.searchCatalogMaxPage, this.parseMaxPage(doc));
                }
            } catch (e) {
                pending.push(paths[i]);
            } finally {
                if (doc) doc.dispose();
            }
        }
        this.searchCatalogPendingPaths = pending;
        this.searchCatalogComplete = pending.length === 0;
        // 部分基础请求失败时保留已有结果，但下次搜索只重试失败路由；全部失败时保留 null 以允许完整重试。
        if (catalog.length > 0 || pending.length < paths.length) this.searchCatalogCache = catalog;
        return catalog;
    }

    normalizeSearchText(value) {
        return String(value || "").toLowerCase().replace(/[\s\u3000]+/g, "");
    }

    searchKeywordAliases(keyword) {
        const raw = String(keyword || "").trim();
        if (!raw) return [];
        const compact = raw.replace(/[\s\u3000]+/g, "");
        const aliases = [raw];
        if (compact && aliases.indexOf(compact) < 0) aliases.push(compact);
        // 仅加入已经由用户输入与站点标题共同确认的别名，不做无依据的模糊替换。
        const known = {
            "妖神计": ["妖神记"],
            "妖神記": ["妖神记"],
            "古見同學有交流障礙症": ["古见同学有交流障碍症"],
        };
        (known[compact] || []).forEach((alias) => {
            if (aliases.indexOf(alias) < 0) aliases.push(alias);
        });
        return aliases;
    }

    filterSearchCatalog(catalog, keyword) {
        const queries = this.searchKeywordAliases(keyword).map((q) => this.normalizeSearchText(q));
        if (queries.length === 0) return [];
        return catalog.filter((comic) => {
            const text = this.normalizeSearchText([comic.title, comic.subTitle, comic.description].filter((v) => v).join(" "));
            return queries.some((q) => q && text.indexOf(q) >= 0);
        });
    }

    async loadSearchCatalogDeep(keyword) {
        if (this.searchCatalogComplete && this.searchDeepCatalogComplete && this.searchDeepCatalogCache !== null) return this.searchDeepCatalogCache;
        // 深度扫描前重试上一轮基础目录失败的路由；成功卡片合并到已有深度缓存。
        const baseCatalog = await this.loadSearchCatalog();
        if (this.searchCatalogCache === null) return baseCatalog;
        let catalog = this.searchDeepCatalogCache || [];
        const seen = {};
        catalog.forEach((comic) => { if (comic && comic.id) seen[comic.id] = comic; });
        baseCatalog.forEach((comic) => this.addUniqueComic(catalog, seen, comic));
        this.searchDeepCatalogCache = catalog;
        if (keyword && this.filterSearchCatalog(catalog, keyword).length > 0) return catalog;
        const maxPage = Math.min(Math.max(1, this.searchCatalogMaxPage), 50);
        for (let page = Math.max(2, this.searchDeepCatalogNextPage); page <= maxPage; page++) {
            let doc = null;
            try {
                const res = await Network.get(this.baseUrl + "/category/page/" + page, this.requestHeaders());
                // 当前页失败时保留 nextPage，让后续搜索有机会重试，而不是缓存不完整目录。
                if (!res || res.status !== 200 || !res.body) {
                    this.searchDeepCatalogNextPage = page;
                    return catalog;
                }
                doc = new HtmlDocument(res.body);
                this.parseListDocument(doc).forEach((comic) => this.addUniqueComic(catalog, seen, comic));
                this.searchDeepCatalogNextPage = page + 1;
                // 目标已在较早分页出现时立即停止，避免为一次搜索无条件请求全部 50 页。
                if (keyword && this.filterSearchCatalog(catalog, keyword).length > 0) {
                    this.searchDeepCatalogCache = catalog;
                    return catalog;
                }
            } catch (e) {
                this.searchDeepCatalogNextPage = page;
                return catalog;
            } finally {
                if (doc) doc.dispose();
            }
        }
        this.searchDeepCatalogComplete = this.searchCatalogComplete;
        this.searchDeepCatalogCache = catalog;
        return catalog;
    }

    parseMaxPage(doc) {
        let max = 1;
        doc.querySelectorAll("a").forEach((a) => {
            const href = a.attributes.href || "";
            const m = href.match(/\/page\/(\d+)/);
            if (m) {
                const n = parseInt(m[1], 10);
                if (!isNaN(n) && n > max) max = n;
            }
        });
        return max;
    }

    // ===== 首页探索 =====
    explore = [
        {
            title: this.name,
            type: "singlePageWithMultiPart",
            load: async () => {
                const result = {};
                let homeDoc = null;
                try {
                    const res = await Network.get(this.baseUrl + "/", this.requestHeaders());
                    if (res.status !== 200) return result;
                    homeDoc = new HtmlDocument(res.body);

                    // 首页真实 HTML 只有两个 panel，但每个 panel 还包含左侧重点推荐和右侧 6 个卡片。
                    // 轮播、重点推荐和普通卡片分别去重，避免只显示一小部分首页内容。
                    const banner = [];
                    const bannerSeen = {};
                    homeDoc.querySelectorAll("#slider .slides li").forEach((item) => {
                        this.addUniqueComic(banner, bannerSeen, this.parseLeadCard(item));
                    });
                    if (banner.length > 0) result["轮播推荐"] = banner;

                    const panels = homeDoc.querySelectorAll(".panel-comic");
                    for (let i = 0; i < panels.length; i++) {
                        const titleEl = panels[i].querySelector(".mod-title span");
                        const title = titleEl ? titleEl.text.trim() : "推荐";
                        const list = this.parseHomePanel(panels[i]);
                        if (list.length > 0) result[title] = list;
                    }
                } catch (e) {
                    // 首页失败时仍返回已成功解析的部分
                } finally {
                    if (homeDoc) homeDoc.dispose();
                }

                // 这些页面均为当前站点导航中的真实列表页，用作首页的更多分区。
                // 它们不是猜测的分页，而是独立的第一页列表；每个分区保留真实标题和 ID。
                const extraParts = [
                    ["最新更新", "/custom/update"],
                    ["人气排行", "/custom/hot"],
                    ["连载漫画", "/category/finish/1"],
                    ["完结漫画", "/category/finish/2"],
                ];
                for (let i = 0; i < extraParts.length; i++) {
                    const title = extraParts[i][0];
                    const path = extraParts[i][1];
                    let doc = null;
                    try {
                        const res = await Network.get(this.baseUrl + path, this.requestHeaders());
                        if (res.status !== 200) continue;
                        doc = new HtmlDocument(res.body);
                        const list = this.parseListDocument(doc);
                        if (list.length > 0) result[title] = list;
                    } catch (e) {
                        // 单个扩展分区失败不影响其他首页分区
                    } finally {
                        if (doc) doc.dispose();
                    }
                }
                return result;
            },
        },
    ];

    // ===== 分类 =====
    category = {
        title: this.name,
        parts: [
            {
                name: "题材",
                type: "fixed",
                categories: [
                    "全部", "热血", "恋爱", "奇幻", "冒险", "搞笑", "都市", "古风",
                    "悬疑", "穿越", "校园", "治愈", "科幻", "玄幻", "修仙", "少年",
                    "少女", "机甲", "重生", "系统", "同人",
                ],
                itemType: "category",
                categoryParams: [
                    "", "2572", "2617", "2569", "2591", "2570", "2571", "2593",
                    "2600", "2573", "2587", "2588", "2589", "2585", "2586", "2596",
                    "2612", "2575", "2615", "2597", "2618",
                ],
            },
            {
                name: "状态",
                type: "fixed",
                categories: ["连载中", "已完结"],
                itemType: "category",
                categoryParams: ["1", "2"],
            },
        ],
        enableRankingPage: false,
    };

    // ===== 分类漫画加载 =====
    categoryComics = {
        load: async (category, param, options, page) => {
            let doc = null;
            const safePage = Math.max(1, parseInt(page, 10) || 1);
            try {
                let base;
                if (category === "连载中" || category === "已完结") {
                    base = "/category/finish/" + param;
                } else if (!param) {
                    base = "/category";
                } else {
                    base = "/category/tags/" + param;
                }
                const path = safePage <= 1 ? base : base + "/page/" + safePage;
                const res = await Network.get(this.baseUrl + path, this.requestHeaders());
                if (!res || res.status !== 200) return { comics: [], maxPage: safePage };
                doc = new HtmlDocument(res.body);

                const comics = [];
                const seen = {};
                doc.querySelectorAll(".comic-item").forEach((item) => {
                    this.addUniqueComic(comics, seen, this.parseListCard(item));
                });
                const maxPage = this.parseMaxPage(doc);
                return { comics: comics, maxPage: maxPage };
            } catch (e) {
                return { comics: [], maxPage: page };
            } finally {
                if (doc) doc.dispose();
            }
        },
    };

    // ===== 搜索 =====
    search = {
        load: async (keyword, options, page) => {
            let doc = null;
            const safePage = Math.max(1, Number(page) || 1);
            try {
                // 表单 action 是当前站点的真实入口，但实测会出现空壳 HTML 或“搜索繁忙” JSON。
                // 先请求官方搜索接口；只有结果容器为空时，才回退到真实列表页本地过滤。
                const path = "/index.php/search?key=" + encodeURIComponent(String(keyword || "").trim());
                const res = await Network.get(this.baseUrl + path, this.requestHeaders());
                if (res && res.status === 200 && res.body && !String(res.body).trim().startsWith("{")) {
                    doc = new HtmlDocument(res.body);
                    const comics = this.parseListDocument(doc);
                    if (comics.length > 0) {
                        return { comics: comics, maxPage: this.parseMaxPage(doc) };
                    }
                }
            } catch (e) {
                // 站点搜索接口失败时继续尝试已取证列表兜底
            } finally {
                if (doc) doc.dispose();
            }

            // 当前实时取证显示搜索接口可返回“搜索结果（0）”或限流 JSON；
            // 通过网站真实列表页过滤标题/标签/简介，避免在空结果时直接让 Venera 搜索失效。
            if (safePage > 1) return { comics: [], maxPage: 1 };
            try {
                const catalog = await this.loadSearchCatalog();
                let comics = this.filterSearchCatalog(catalog, keyword);
                if (comics.length > 0) return { comics: comics, maxPage: 1 };
                // 官方搜索与精选目录均未命中时，扫描站点真实总分类分页。
                const deepCatalog = await this.loadSearchCatalogDeep(keyword);
                comics = this.filterSearchCatalog(deepCatalog, keyword);
                return { comics: comics, maxPage: 1 };
            } catch (e) {
                return { comics: [], maxPage: 1 };
            }
        },
    };

    // ===== 漫画详情与章节 =====
    comic = {
        loadInfo: async (id) => {
            let doc = null;
            const comicId = this.normalizeBookId(id);
            if (!comicId) throw "Invalid comic id";
            const res = await Network.get(this.baseUrl + "/book/" + comicId, this.requestHeaders());
            if (!res || res.status !== 200) throw "Comic not found";
            try {
                doc = new HtmlDocument(res.body);

                const titleEl = doc.querySelector("h1.detail-title");
                const title = titleEl ? titleEl.text.trim() : id;

                const coverImg = doc.querySelector(".mod-banner img.lazyload")
                    || doc.querySelector(".banner-img img")
                    || doc.querySelector(".mod-detail-info img.lazyload");
                const cover = this.imgUrl(coverImg);

                const authorEl = doc.querySelector("p.author");
                const author = authorEl ? authorEl.text.trim() : "";

                const description = doc.querySelector(".detail-desc")
                    ? doc.querySelector(".detail-desc").text.trim() : "";

                const tags = [];
                doc.querySelectorAll(".detail-info-btags .tag-list a").forEach((a) => {
                    const t = a.text.trim();
                    if (t) tags.push(t);
                });

                const updateEl = doc.querySelector(".detail-info-btips .tips b");
                const updateTime = updateEl ? updateEl.text.trim() : "";

                const recommend = [];
                const recommendSeen = {};
                doc.querySelectorAll(".panel-recommend .mod-vitem-comic").forEach((item) => {
                    this.addUniqueComic(recommend, recommendSeen, this.parseRelatedCard(item));
                });

                const chapters = new Map();
                doc.querySelectorAll("#j_chapter_list li.item").forEach((li) => {
                    const cid = li.attributes["data-chapter"];
                    if (!cid || chapters.has(cid)) return;
                    const a = li.querySelector("a");
                    const ctitle = a ? (a.attributes.title || "").trim() : "";
                    chapters.set(String(cid), ctitle || String(cid));
                });

                return new ComicDetails({
                    title: title,
                    subTitle: author,
                    cover: cover,
                    description: description,
                    tags: { 题材: tags },
                    chapters: chapters,
                    isFavorite: false,
                    subId: comicId,
                    thumbnails: cover ? [cover] : [],
                    recommend: recommend,
                    updateTime: updateTime,
                    url: this.baseUrl + "/book/" + comicId + "/",
                });
            } finally {
                if (doc) doc.dispose();
            }
        },

        loadEp: async (comicId, epId) => {
            const safeComicId = this.normalizeBookId(comicId);
            const chapterId = this.normalizeChapterId(epId);
            if (!safeComicId || !chapterId) return { images: [] };
            let doc = null;
            try {
                const res = await Network.get(
                    this.baseUrl + "/chapter/" + safeComicId + "-" + chapterId,
                    this.requestHeaders()
                );
                if (res.status !== 200) return { images: [] };
                const body = res.body;
                const pm = body.match(/params\s*=\s*([\"'])([^\"']+)\1/);
                if (!pm) return { images: [] };
                doc = new HtmlDocument(body);
                const data = this.decryptParams(pm[2]);
                if (!data || data.host !== "www.manwang.net") return { images: [] };
                const images = [];
                const seenImages = {};
                (Array.isArray(data.images) ? data.images : []).forEach((u) => {
                    const image = String(u || "").trim();
                    if (image && !seenImages[image]) {
                        seenImages[image] = true;
                        images.push(image);
                    }
                });
                return { images: images };
            } catch (e) {
                return { images: [] };
            } finally {
                if (doc) doc.dispose();
            }
        },

        onImageLoad: (url, comicId, epId) => {
            const safeComicId = this.normalizeBookId(comicId);
            const chapterId = this.normalizeChapterId(epId);
            const referer = safeComicId && chapterId
                ? this.baseUrl + "/chapter/" + safeComicId + "-" + chapterId
                : this.baseUrl + "/";
            const cfg = {
                headers: {
                    "User-Agent": this.ua,
                    "Referer": referer,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                },
            };
            // source_id==12 时图片响应为 AES-CBC 密文（key=iv=imageAesKey），需 onResponse 解密。
            // 仅当 URL 是相对路径（未验证样本）时按加密处理；直链保持原样。
            if (!/^https?:\/\//i.test(String(url || ""))) {
                const relative = String(url || "").startsWith("/") ? String(url || "") : "/" + String(url || "");
                // pic-v2.js 对 source_id==12 的相对图片会补到这个真实图片主机后再解密。
                cfg.url = "https://img1.baipiaoguai.org" + relative;
                const key = Convert.encodeUtf8(this.imageAesKey);
                const iv = key;
                cfg.onResponse = (buffer) => {
                    const decrypted = new Uint8Array(Convert.decryptAesCbc(buffer, key, iv));
                    if (decrypted.length === 0) throw "图片解密结果为空";
                    const padLen = decrypted[decrypted.length - 1];
                    if (padLen < 1 || padLen > 16 || padLen > decrypted.length) throw "图片 PKCS7 padding 无效";
                    for (let i = decrypted.length - padLen; i < decrypted.length; i++) {
                        if (decrypted[i] !== padLen) throw "图片 PKCS7 padding 无效";
                    }
                    return decrypted.slice(0, decrypted.length - padLen).buffer;
                };
            }
            return cfg;
        },
    };
}
