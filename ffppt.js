/**
 * 飞翔漫画 (ffppt.com) Venera 漫画源
 *
 * 版本: 1.0.8
 * 站点: 飞翔漫画网 https://ffppt.com/ (帝国CMS / EmpireCMS, UTF-8)
 *
 * 1.0.8 修复 (2026-11-19):
 * - 正文及章节预览遵循原站阅读页的 Referrer 策略。
 * - 验证图床响应，识别返回 HTTP 200 的站点提示图，升级后重新获取旧缓存里的图片。
 *
 * 1.0.7 修复 (2026-11-16):
 * - 最近更新优先使用已验证的原封面。图床缺图时用原站公开章节的首张可用图作预览。
 * - 补图请求限制并发和首页等待时间，后台结果留给下次刷新。
 *
 * 1.0.6 修复 (2026-11-14):
 * - 瓜子图床正文请求遵循原站的无 Referer 阅读方式。
 *
 * 1.0.5 修复 (2026-11-13):
 * - 直接在正文图片清单里使用已验证的 CDN 地址。
 * - 普通封面由客户端直接下载，去掉封面图片字节回调。
 * - 首页优先补最近更新的前四张封面，单次等待最多 1.8 秒。
 *
 * 1.0.4 修复 (2026-11-13):
 * - 正文 img.dongman.la 优先使用其 DNS 公布并经实测的 HTTPS CDN 地址，保留原路径和查询参数。
 * - 首页并行读取首页和图文更新列表，复用封面缓存，移除逐部详情补图和图片 HEAD 预检。
 * - 目录持续并发抓取并按原站分页顺序合并，保留完整目录。
 *
 * 1.0.3 修复 (2026-10-13):
 * - 首页文字更新条目先从推荐/最新更新图文列表匹配封面，再补取缺失作品详情页的封面。
 * - 只补取封面，不加载章节分页；最多4个详情请求并发，成功封面缓存6小时、最多400条。
 * - 新封面用HEAD检查失效链接；404使用内置“暂无封面”图，失败不缓存，下次加载重试。
 * - 将图片请求配置注册到Venera实际使用的comic回调，不影响完整章节分页。
 *
 * 1.0.2 修复 (2026-10-13):
 * - 目录按 /novel{id}/?p=N 分页，读取分页导航并合并全部页面，修复只显示前50章。
 * - 目录请求禁用 Venera 网络缓存；章节按网站目录顺序去重，分页失败时明确报错。
 * - 最多同时请求4页，逐批读取并检查后续页的分页导航，不写死页数或章节数。
 *
 * 1.0.1 修复 (相较 1.0.0):
 * - 首页"最近更新"原本返回 cover:"" 空字符串, 会导致 UI 发起 "" URL 请求并报
 *   "relative URL without a base" 错误. 现改为用 站点 favicon 占位 (HOST+/favicon.ico).
 *   站点最近更新区块 (li.truyenhot_li_customcol) DOM 内确实是 0 个 img / 无 background / 无 data-*,
 *   取证确认站点设计的纯文字流, 无封面取自同一区块. 改用 favicon 占位避免 base-URL 异常
 *   并保证 UI 不留空.
 * - onImageLoad 改为按 host 分流: 普通 CDN 仍带 UA + Referer; 对历史上 TLS 握手易失败的
 *   g-mh.online / p.miyeye.cn 域增加更接近真实浏览器的 Accept / Accept-Language / Connection 头,
 *   并将 Referer 改为章节 page 路径 (部分 CDN 校验 referer 必须指向具体章节页). 注意 TLS handshake
 *   eof 属网络层问题, 源内只能降低概率, 无法 100% 保证可访问; 若个别漫画图片仍报错, 请在 Venera
 *   中点"重试"(多数章节重试一次即可) 或反馈给漫画站方更换图床.
 * - 解析字符串 ASCII 引号统一改为单引号 (源站合规);
 *
 * 本期已验证 (2026-08-26 取证):
 * - 首页: 推荐区 .de-cu .normal-image1 (7卡片) + 最近更新 .moi_cap_nhat ul.truyenhot_ul_customcol li (20条, 无封面)
 * - 分类/列表页: /{slug}/ 与 /{slug}/index_N.html 分页, 卡片 .home-truyendecu, 每页20卡
 *   guoman(国漫332页) hanman(韩漫307页) riman(日漫771页) oumei(欧美29页)
 *   gangtai(港台95页) latest(最新更新50页) release(最新入库50页) popular(热门50页) completed(完本50页)
 * - 搜索: GET /e/search/index.php?keyboard={kw}&show=title,writer,byr&searchget=1
 *   302 -> /e/search/result/?searchid=N, 结果与分类页同构, 仅单页(maxPage=1), 样本"修炼"得8项
 * - 详情: /novel{id}/, 标题 h3.title[itemprop=name], 封面 .info-holder img[itemprop=image],
 *   作者 a[itemprop=author], 分类 a[itemprop=genre], 简介 .desc-text, 当前页章节 #list-chapter
 * - 章节: /novel{id}/chapter{N}.html (N从0开始), 图片为 img.comic_img 的 data-original 懒加载属性,
 *   绝对URL, 未发现加密 (下载验证为标准 JPEG/WEBP).
 *   图片 CDN 域分布 (取证样本): img.dongman.la (主), f**.g-mh.online (部分, 易TLS失败),
 *   p.miyeye.cn, d1.hujw.com (封面).
 * - 图片 Referer: 实测 img.dongman.la 与封面 d1.hujw.com 无需Referer可访问(200), 源内仍统一携带.
 *
 * 已知限制:
 * - 站点部分漫画使用 g-mh.online / p.miyeye.cn 等CDN, 客户端网络TLS handshake eof 时
 *   章节图片会全页失败. 源内已对易失败域增加更接近浏览器的 headers, 但TLS层异常无法在
 *   JS 源完全规避, 属外部 CDN 网络层问题.
 * - 搜索频率限制(Cookie zmauylastsearchtime), 频繁搜索可能被临时拦截.
 * - 搜索依赖网络层自动跟随302重定向 (Venera Network.get 默认行为).
 */

class Ffppt extends ComicSource {
    name = "飞翔漫画";
    key = "ffppt";
    version = "1.0.8";
    minAppVersion = "1.0.0";
    url = "https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/ffppt.js";

    HOST = "https://ffppt.com";
    UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    PLACEHOLDER_COVER = "https://ffppt.com/favicon.ico?venera-no-cover=1";
    NO_COVER_PNG = "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";

    /** 图片的懒加载地址优先于占位src；仅返回可请求的HTTP地址。 */
    imageCover(img) {
        if (!img) return "";
        for (const key of ["data-original", "data-src", "src"]) {
            const value = String(img.attributes[key] || "").trim();
            if (!value || /^(?:data|javascript|about):/i.test(value)) continue;
            const cover = this.absoluteUrl(value);
            if (this.isRealCover(cover)) return cover;
        }
        return "";
    }

    isRealCover(cover) {
        return typeof cover === "string" && /^https?:\/\//i.test(cover)
            && !/\/favicon(?:\.[^/?#]+)?(?:[?#]|$)/i.test(cover);
    }

    /** 只取当前作品封面，不误取页面里的推荐作品图片。 */
    detailCover(doc) {
        const image = doc.querySelector(".info-holder img[itemprop=image]")
            || doc.querySelector(".info-holder img");
        const cover = this.imageCover(image);
        if (cover) return cover;
        const og = doc.querySelector("meta[property='og:image']");
        if (!og) return "";
        return this.imageCover({ attributes: { src: og.attributes.content } });
    }

    /** 复用已浏览的图文列表和详情封面，供首页文字更新使用。 */
    mergeCoverCache(comics, verified = false) {
        const now = Date.now();
        const stored = this.loadData("ffpptCoverCacheV3");
        const cache = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
        for (const { id, cover } of comics) {
            if (!this.isRealCover(cover)) continue;
            const previous = cache[id];
            if (!verified && previous?.verified && previous.expiresAt > now) continue;
            cache[id] = { cover, verified, expiresAt: now + 3 * 60 * 60 * 1000 };
        }
        const limited = {};
        Object.keys(cache).filter(id => cache[id] && cache[id].expiresAt > now && this.isRealCover(cache[id].cover))
            .sort((a, b) => cache[b].expiresAt - cache[a].expiresAt).slice(0, 400)
            .forEach(id => { limited[id] = cache[id]; });
        if (comics.length) this.saveData("ffpptCoverCacheV3", limited);
        return limited;
    }

    latestCoversRequest = null;
    pendingCovers = new Map();

    loadLatestCovers() {
        if (!this.latestCoversRequest) {
            this.latestCoversRequest = this.loadListPage("latest", 1)
                .then(result => result.comics)
                .catch(() => [])
                .finally(() => { this.latestCoversRequest = null; });
        }
        return this.latestCoversRequest;
    }

    async isAvailableCover(key) {
        const { url, headers } = this.onThumbnailLoad(key);
        try {
            const response = await Network.fetchBytes("GET", url, { ...headers, "cache-time": "no" });
            const contentType = Object.entries(response.headers || {})
                .find(([key]) => key.toLowerCase() === "content-type")?.[1];
            return response.status === 200 && /^image\//i.test(String(contentType))
                && response.body?.byteLength > 0 && !this.isReadingNotice(response.body);
        } catch (_) {
            return false;
        }
    }

    async findLatestCover(id, episode, knownCover) {
        let cover = knownCover;
        const episodes = [episode];
        if (!cover) {
            try {
                const response = await Network.get(this.HOST + "/novel" + id + "/", this._headers(this.HOST + "/"));
                if (response.status === 200) {
                    const doc = new HtmlDocument(response.body);
                    try {
                        cover = this.detailCover(doc);
                        for (const link of doc.querySelectorAll("#list-chapter a[href*='chapter']").slice(0, 2)) {
                            episodes.push(this.normalizeEpId(link.attributes.href));
                        }
                    }
                    finally { doc.dispose(); }
                }
            } catch (_) {
                // The public chapter can still supply a preview.
            }
        }
        return this.findCoverPreview(id, episodes, cover);
    }

    async findCoverPreview(id, episodes, cover) {
        if (this.isRealCover(cover)) {
            const candidate = this.coverKey(cover);
            if (await this.isAvailableCover(candidate)) return candidate;
        }
        for (const episode of new Set(episodes.filter(value => value != null))) {
            const result = await this.loadChapterImages(id, episode).catch(() => null);
            for (const preview of result?.images.slice(0, 2) || []) {
                if (await this.isAvailableCover(preview)) return preview;
            }
        }
        return "";
    }

    loadCover(id, episode) {
        if (this.pendingCovers.has(id)) return this.pendingCovers.get(id);
        if (this.pendingCovers.size >= 4) return Promise.resolve();
        const entry = this.mergeCoverCache([])[id];
        const request = this.findLatestCover(id, episode, entry?.cover)
            .then(cover => { if (cover) this.mergeCoverCache([{ id, cover }], true); })
            .catch(() => {})
            .finally(() => this.pendingCovers.delete(id));
        this.pendingCovers.set(id, request);
        return request;
    }

    async applyLatestCovers(latest, recommend, coverList) {
        this.mergeCoverCache(recommend);
        const resolveCovers = async (items, concurrency) => {
            let next = 0;
            const worker = async () => {
                while (next < items.length) {
                    const { comic, episode } = items[next++];
                    if (!this.mergeCoverCache([])[comic.id]?.verified) await this.loadCover(comic.id, episode);
                }
            };
            await Promise.all(Array.from({ length: concurrency }, worker));
        };
        const first = resolveCovers(latest.slice(0, 8), 4);
        const rest = latest.slice(8);
        if (rest.length) {
            first.then(() => resolveCovers(rest, 2)).catch(() => {
                // Refreshing the homepage gives pending covers another chance.
            });
        }
        await Promise.race([
            Promise.all([coverList, first]),
            new Promise(resolve => setTimeout(resolve, 4500)),
        ]);
        const covers = this.mergeCoverCache([]);
        for (const { comic } of latest) {
            const item = covers[comic.id];
            if (item?.verified) comic.cover = item.cover;
        }
    }

    /** 构造请求头 */
    _headers(referer) {
        const h = { "User-Agent": this.UA };
        if (referer) h["Referer"] = referer;
        return h;
    }

    /** 从 /novel{id}/ 或完整URL中提取漫画ID */
    comicIdFromHref(href) {
        if (!href) return null;
        const m = String(href).match(/novel(\d+)/);
        return m ? m[1] : null;
    }

    /** 标准化漫画ID: 支持 "10532" / "novel10532" */
    normalizeComicId(id) {
        if (id === null || id === undefined) return null;
        if (typeof id === "number") return String(id);
        const s = String(id).trim();
        if (!s) return null;
        const m = s.match(/novel(\d+)/);
        if (m) return m[1];
        if (/^\d+$/.test(s)) return s;
        return null;
    }

    /** 标准化章节ID: 支持 "49" / 完整章节URL / "comicId|chapterId" 组合形态 */
    normalizeEpId(epId) {
        if (epId === null || epId === undefined) return null;
        if (typeof epId === "number") return String(epId);
        let s = String(epId).trim();
        if (!s) return null;
        const mUrl = s.match(/chapter(\d+)\.html/);
        if (mUrl) return mUrl[1];
        if (s.indexOf("|") >= 0) {
            const parts = s.split("|");
            s = parts[parts.length - 1].trim();
        }
        if (/^\d+$/.test(s)) return s;
        return null;
    }

    /** 补全相对URL */
    absoluteUrl(url) {
        if (!url) return "";
        const s = String(url).trim();
        if (s.indexOf("http://") === 0 || s.indexOf("https://") === 0) return s;
        if (s.indexOf("//") === 0) return "https:" + s;
        if (s.indexOf("/") === 0) return this.HOST + s;
        return this.HOST + "/" + s;
    }

    /** 解析列表卡片 (分类页/搜索页/最新更新页同构, 均为 .home-truyendecu) */
    parseListCard(card) {
        let link = card.querySelector("a[itemprop=url]");
        if (!link) {
            const links = card.querySelectorAll("a[href*='/novel']");
            for (let i = 0; i < links.length; i++) {
                if (this.comicIdFromHref(links[i].attributes.href)) {
                    link = links[i];
                    break;
                }
            }
        }
        if (!link) return null;
        const id = this.comicIdFromHref(link.attributes.href);
        if (!id) return null;

        let title = "";
        const h3 = card.querySelector("h3[itemprop=name]");
        if (h3) title = h3.text.trim();
        if (!title) title = (link.attributes.title || "").trim();
        if (!title) title = link.text.trim();
        if (!title) return null;

        let cover = "";
        const img = card.querySelector("img[itemprop=image]");
        if (!img) {
            const imgs = card.querySelectorAll("img");
            for (let i = 0; i < imgs.length; i++) {
                const src = imgs[i].attributes.src || imgs[i].attributes["data-original"] || "";
                if (src && src.indexOf("/novel/images/") < 0) { cover = src; break; }
            }
        } else {
            cover = this.imageCover(img);
        }
        cover = this.absoluteUrl(cover) || this.PLACEHOLDER_COVER;

        const subParts = [];
        const cate = card.querySelector(".chuyen-muc");
        if (cate) {
            const t = cate.text.trim();
            if (t) subParts.push(t);
        }
        const tt = card.querySelector(".tt-status");
        if (tt) {
            const t = tt.text.trim();
            if (t) subParts.push(t);
        }

        return new Comic({
            id: id,
            title: title,
            subTitle: subParts.join(" · "),
            cover: this.coverKey(cover),
            description: "",
            tags: []
        });
    }

    /** 解析列表页全部卡片 */
    parseListCards(doc) {
        const comics = [];
        const cards = doc.querySelectorAll(".home-truyendecu");
        for (let i = 0; i < cards.length; i++) {
            const c = this.parseListCard(cards[i]);
            if (c) comics.push(c);
        }
        return comics;
    }

    /** 解析首页推荐大图卡片 (.normal-image1, 与列表卡片字段同构) */
    parseHomeCard(card) {
        let link = card.querySelector("a[itemprop=url]");
        if (!link) {
            const links = card.querySelectorAll("a[href*='/novel']");
            for (let i = 0; i < links.length; i++) {
                if (this.comicIdFromHref(links[i].attributes.href)) {
                    link = links[i];
                    break;
                }
            }
        }
        if (!link) return null;
        const id = this.comicIdFromHref(link.attributes.href);
        if (!id) return null;

        let title = "";
        const h3 = card.querySelector("h3[itemprop=name]");
        if (h3) title = h3.text.trim();
        if (!title) title = (link.attributes.title || "").trim();
        if (!title) return null;

        let cover = "";
        const img = card.querySelector("img[itemprop=image]");
        if (img) cover = this.imageCover(img);
        cover = this.absoluteUrl(cover) || this.PLACEHOLDER_COVER;

        const subParts = [];
        const cate = card.querySelector(".chuyen-muc");
        if (cate) {
            const t = (cate.attributes.title || cate.text || "").trim();
            if (t) subParts.push(t);
        }

        return new Comic({
            id: id,
            title: title,
            subTitle: subParts.join(" · "),
            cover: this.coverKey(cover),
            description: "",
            tags: []
        });
    }

    /** 解析首页"最近更新"文字列表条目 (li.truyenhot_li_customcol, 无封面) */
    parseLatestItem(li) {
        let a = li.querySelector("h3 a");
        if (!a) a = li.querySelector("a[href*='/novel']");
        if (!a) return null;
        const id = this.comicIdFromHref(a.attributes.href);
        if (!id) return null;
        const title = a.text.trim();
        if (!title) return null;

        let sub = "";
        const cate = li.querySelector(".update_cate");
        const chapA = li.querySelector(".update_chap a");
        const parts = [];
        if (cate) {
            const t = cate.text.trim();
            if (t) parts.push(t);
        }
        if (chapA) {
            let t = (chapA.attributes.title || "").trim();
            if (!t) t = chapA.text.trim();
            const idx = t.indexOf(" - ");
            if (idx >= 0) t = t.substring(idx + 3).trim();
            if (t) parts.push(t);
        }
        sub = parts.join(" · ");

        const comic = new Comic({
            id: id,
            title: title,
            subTitle: sub,
            cover: this.PLACEHOLDER_COVER,
            description: "",
            tags: []
        });
        const href = chapA?.attributes.href || "";
        const chapter = href.match(/^(?:https?:\/\/(?:www\.)?ffppt\.com)?\/novel(\d+)\/chapter(\d+)\.html(?:[?#].*)?$/i);
        return { comic, episode: chapter?.[1] === id ? chapter[2] : null };
    }

    /** 从分页链接 /{slug}/index_N.html 中提取最大页码 */
    parseMaxPage(doc, current) {
        const links = doc.querySelectorAll("a[href*='index_']");
        let max = 0;
        for (let i = 0; i < links.length; i++) {
            const m = (links[i].attributes.href || "").match(/index_(\d+)\.html/);
            if (m) {
                const n = parseInt(m[1], 10);
                if (n > max) max = n;
            }
        }
        return max > 0 ? max : current;
    }

    explore = [
        {
            title: "飞翔漫画",
            type: "multiPartPage",
            load: async () => {
                const parts = [];
                let doc = null;
                try {
                    const home = Network.get(this.HOST + "/", Object.assign(
                        this._headers(this.HOST + "/"), { "cache-time": "no" }
                    ));
                    const coverList = this.loadLatestCovers();
                    const res = await home;
                    if (res.status !== 200) return parts;
                    doc = new HtmlDocument(res.body);

                    const recommend = [];
                    const deCu = doc.querySelector(".de-cu");
                    if (deCu) {
                        const cards = deCu.querySelectorAll(".normal-image1");
                        for (let i = 0; i < cards.length; i++) {
                            const c = this.parseHomeCard(cards[i]);
                            if (c) recommend.push(c);
                        }
                    }
                    if (recommend.length > 0) {
                        parts.push({ title: "推荐漫画", comics: recommend, viewMore: "热门排行" });
                    }

                    const latest = [];
                    const moiUl = doc.querySelector(".moi_cap_nhat ul.truyenhot_ul_customcol");
                    if (moiUl) {
                        const lis = moiUl.querySelectorAll("li");
                        for (let i = 0; i < lis.length; i++) {
                            const c = this.parseLatestItem(lis[i]);
                            if (c) latest.push(c);
                        }
                    }
                    if (latest.length > 0) {
                        await this.applyLatestCovers(latest, recommend, coverList);
                        parts.push({ title: "最近更新", comics: latest.map(({ comic }) => comic), viewMore: "最新更新" });
                    }
                } catch (e) {
                    console.log("explore error: " + e);
                } finally {
                    if (doc) doc.dispose();
                }
                return parts;
            }
        }
    ];

    category = {
        title: "飞翔漫画",
        parts: [
            {
                name: "漫画分类",
                type: "fixed",
                categories: ["国漫漫画", "韩国漫画", "日本漫画", "欧美漫画", "港台漫画"],
                itemType: "category",
                categoryParams: ["guoman", "hanman", "riman", "oumei", "gangtai"]
            },
            {
                name: "更新与状态",
                type: "fixed",
                categories: ["最新更新", "最新入库", "热门排行", "完本漫画"],
                itemType: "category",
                categoryParams: ["latest", "release", "popular", "completed"]
            }
        ],
        enableRankingPage: false
    };

    categoryComics = {
        load: async (category, param, options, page) => {
            return await this.loadListPage(param, page);
        }
    };

    /** 加载列表页: 首页 /{slug}/, 第N页 /{slug}/index_N.html */
    async loadListPage(slug, page) {
        if (!slug || page < 1) return { comics: [], maxPage: 1 };
        const p = parseInt(page, 10) || 1;
        let url;
        if (p <= 1) {
            url = this.HOST + "/" + slug + "/";
        } else {
            url = this.HOST + "/" + slug + "/index_" + p + ".html";
        }
        let doc = null;
        try {
            const res = await Network.get(url, {
                ...this._headers(this.HOST + "/" + slug + "/"), "cache-time": "no",
            });
            if (res.status !== 200) return { comics: [], maxPage: p };
            doc = new HtmlDocument(res.body);
            const comics = this.parseListCards(doc);
            this.mergeCoverCache(comics);
            const maxPage = this.parseMaxPage(doc, p);
            return { comics: comics, maxPage: maxPage };
        } catch (e) {
            console.log("loadListPage error: " + e);
            return { comics: [], maxPage: p };
        } finally {
            if (doc) doc.dispose();
        }
    }

    search = {
        load: async (keyword, options, page) => {
            const kw = String(keyword || "").trim();
            if (!kw || page > 1) return { comics: [], maxPage: 1 };
            const url = this.HOST + "/e/search/index.php?keyboard=" + encodeURIComponent(kw)
                + "&show=title,writer,byr&searchget=1";
            let doc = null;
            try {
                const res = await Network.get(url, this._headers(this.HOST + "/"));
                if (res.status !== 200) return { comics: [], maxPage: 1 };
                doc = new HtmlDocument(res.body);
                const comics = this.parseListCards(doc);
                return { comics: comics, maxPage: 1 };
            } catch (e) {
                console.log("search error: " + e);
                return { comics: [], maxPage: 1 };
            } finally {
                if (doc) doc.dispose();
            }
        }
    };

    comic = {
        loadInfo: async (id) => {
            return await this.loadComicInfo(id);
        },
        loadEp: async (comicId, epId) => {
            return await this.loadChapterImages(comicId, epId);
        },
        onImageLoad: (url, comicId, epId) => this.onImageLoad(url, comicId, epId),
        onThumbnailLoad: (url) => this.onThumbnailLoad(url)
    };

    /** 目录必须重新取站点内容，避免更新后仍显示旧目录。 */
    directoryHeaders(comicId) {
        return Object.assign(this._headers(this.HOST + "/novel" + comicId + "/"), {
            "cache-time": "no"
        });
    }

    /** 只解析本作品的目录和分页，排除推荐作品中的章节链接。 */
    parseChapterPage(doc, comicId, page) {
        const list = doc.querySelector("#list-chapter");
        if (!list) throw new Error("章节目录第" + page + "页缺失，请重试");
        const chapters = new Map();
        const links = list.querySelectorAll("a[href*='chapter']");
        for (const link of links) {
            const href = (link.attributes.href || "").replace(/^https?:\/\/ffppt\.com/i, "");
            const match = href.match(/^\/novel(\d+)\/chapter(\d+)\.html(?:[?#].*)?$/);
            const relative = href.match(/^chapter(\d+)\.html(?:[?#].*)?$/);
            const id = match && match[1] === comicId ? match[2] : (relative ? relative[1] : null);
            if (id === null) continue;
            const text = link.querySelector(".chapter-text");
            const title = (text ? text.text : (link.attributes.title || link.text || "")).trim();
            if (!chapters.has(id)) chapters.set(id, title || ("章节" + id));
        }
        if (!chapters.size) throw new Error("章节目录第" + page + "页为空，请重试");

        const pager = doc.querySelector(".pagination-chap") || doc.querySelector("#pagination");
        let maxPage = page;
        if (pager) {
            for (const active of pager.querySelectorAll("li.active")) {
                const number = active.text.trim();
                if (/^\d+$/.test(number) && Number(number) !== page) {
                    throw new Error("章节目录第" + page + "页未正确返回，请重试");
                }
            }
            for (const link of pager.querySelectorAll("a[href]")) {
                const href = (link.attributes.href || "").replace(/^https?:\/\/ffppt\.com/i, "");
                if (href.indexOf("/novel" + comicId + "/?") !== 0) continue;
                const match = href.match(/[?&]p=(\d+)(?:[&#]|$)/);
                const number = match ? Number(match[1]) : 0;
                if (Number.isSafeInteger(number) && number > maxPage) maxPage = number;
            }
        }
        return { chapters: chapters, maxPage: maxPage };
    }

    /** 按页序合并；任意页失败都不把部分目录作为完整目录返回。 */
    async loadAllChapters(comicId, firstDoc) {
        const first = this.parseChapterPage(firstDoc, comicId, 1);
        const chapters = first.chapters;
        let maxPage = first.maxPage;
        let next = 2;
        let failure;
        const parsedPages = new Map();
        const worker = async () => {
            while (!failure && next <= maxPage) {
                const page = next++;
                try {
                    const res = await Network.get(
                        this.HOST + "/novel" + comicId + "/?p=" + page,
                        this.directoryHeaders(comicId)
                    );
                    if (res.status !== 200) throw new Error("HTTP " + res.status);
                    const doc = new HtmlDocument(res.body);
                    try {
                        const parsed = this.parseChapterPage(doc, comicId, page);
                        parsedPages.set(page, parsed.chapters);
                        maxPage = Math.max(maxPage, parsed.maxPage);
                    } finally {
                        doc.dispose();
                    }
                } catch (error) {
                    failure ||= new Error("章节目录第" + page + "页加载失败，请重试：" + String(error));
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(4, maxPage - 1) }, worker));
        if (failure) throw failure;
        for (let page = 2; page <= maxPage; page++) {
            const before = chapters.size;
            for (const [id, title] of parsedPages.get(page)) {
                if (!chapters.has(id)) chapters.set(id, title);
            }
            if (chapters.size === before) throw new Error("章节目录第" + page + "页重复返回旧目录，请重试");
        }
        return chapters;
    }

    /** 加载漫画详情和全部分页章节 */
    async loadComicInfo(id) {
        const comicId = this.normalizeComicId(id);
        if (!comicId) throw "Invalid comic id";

        const res = await Network.get(
            this.HOST + "/novel" + comicId + "/",
            this.directoryHeaders(comicId)
        );
        if (res.status !== 200) throw "Comic not found";

        const doc = new HtmlDocument(res.body);
        try {
            const body = res.body;
            if (body.indexOf("漫画不存在") >= 0 || body.indexOf("已被删除") >= 0) {
                throw "Comic not found";
            }

            let title = "";
            const titleEl = doc.querySelector("h3.title[itemprop=name]");
            if (titleEl) title = titleEl.text.trim();
            if (!title) {
                const single = doc.querySelector("h2.single_title");
                if (single) title = single.text.trim();
            }
            if (!title) title = "novel" + comicId;

            const knownCover = this.mergeCoverCache([])[comicId];
            const originalCover = this.detailCover(doc);

            let author = "";
            const authorEl = doc.querySelector(".info a[itemprop=author]");
            if (authorEl) author = authorEl.text.trim();

            let genre = "";
            const genreEl = doc.querySelector(".info a[itemprop=genre]");
            if (genreEl) genre = genreEl.text.trim();

            let status = "";
            const spans = doc.querySelectorAll(".info-chitiet .text-primary");
            for (let i = 0; i < spans.length; i++) {
                const t = spans[i].text.trim();
                if (t.indexOf("连载") >= 0 || t.indexOf("完结") >= 0) { status = t; break; }
            }

            let description = "";
            const descEl = doc.querySelector(".desc-text");
            if (descEl) {
                description = descEl.text.trim();
                if (description.indexOf("漫画介绍") === 0) {
                    description = description.substring(4).trim();
                }
            }

            const tags = {};
            if (author) tags["作者"] = [author];
            if (genre) tags["分类"] = [genre];
            if (status) tags["状态"] = [status.split(/\s+/)[0]];

            const chapters = await this.loadAllChapters(comicId, doc);
            let cover = knownCover?.verified ? knownCover.cover : this.PLACEHOLDER_COVER;
            if (!knownCover?.verified) {
                const episodes = [...chapters.keys()];
                const candidate = await this.findCoverPreview(
                    comicId, [episodes.at(-1), ...episodes.slice(0, 2)], originalCover
                );
                if (candidate) {
                    cover = candidate;
                    this.mergeCoverCache([{ id: comicId, cover }], true);
                }
            }

            return new ComicDetails({
                title: title,
                subtitle: author ? author : (genre || ""),
                cover: cover,
                description: description,
                tags: tags,
                chapters: chapters,
                isFavorite: false,
                subId: comicId,
                thumbnails: cover ? [cover] : [],
                recommend: [],
                updateTime: status,
                url: this.HOST + "/novel" + comicId + "/"
            });
        } finally {
            doc.dispose();
        }
    }

    /** 按阅读页顺序读取原站图片清单。 */
    async loadChapterImages(comicId, epId) {
        const cid = this.normalizeComicId(comicId);
        const eid = this.normalizeEpId(epId);
        if (!cid || eid === null) throw new Error("飞翔漫画章节编号无效。");

        const url = this.HOST + "/novel" + cid + "/chapter" + eid + ".html";
        const res = await Network.get(url, {
            ...this._headers(this.HOST + "/novel" + cid + "/"), "cache-time": "no",
        });
        if (res.error) throw new Error("飞翔漫画阅读页连接失败，请重试。");
        if (res.status !== 200) throw new Error("飞翔漫画阅读页返回 HTTP " + res.status);
        const doc = new HtmlDocument(res.body);
        try {
            // The site's browser reader uses "never", the legacy spelling of "no-referrer".
            const policy = doc.querySelector("meta[name='referrer']")?.attributes.content?.trim().toLowerCase();
            const noReferrer = policy === "never" || policy === "no-referrer";
            const images = [];
            for (const image of doc.querySelectorAll("img.comic_img")) {
                const src = image.attributes["data-original"] || image.attributes["data-src"] || image.attributes.src || "";
                const value = src.trim();
                if (/^(?:(?:https?:)?\/\/|\/)/i.test(value)) {
                    const address = this.readerImageUrl(this.absoluteUrl(value)).split("#", 1)[0];
                    images.push(address + (noReferrer ? "#ffppt-108-nr" : "#ffppt-108"));
                }
            }
            if (!images.length) throw new Error("飞翔漫画原站未返回此章的图片清单。");
            return { images };
        } finally {
            doc.dispose();
        }
    }

    readerImageUrl(url) {
        // img.dongman.la publishes this CDN hostname as its CNAME.
        return url.replace(/^https?:\/\/img\.dongman\.la(?=\/)/i, "https://dmlimg.youjieke.host");
    }

    coverKey(url) {
        if (url === this.PLACEHOLDER_COVER || /#ffppt-108(?:-nr)?$/.test(url)) return url;
        return this.readerImageUrl(url.split("#", 1)[0]) + "#ffppt-108";
    }

    isReadingNotice(bytes) {
        // The image server can return this WebP with HTTP 200 for multiple distinct addresses.
        if (bytes?.byteLength !== 9814) return false;
        const digest = new Uint8Array(Convert.sha256(new Uint8Array(bytes).buffer));
        const hex = Array.from(digest, byte => byte.toString(16).padStart(2, "0")).join("");
        return hex === "4080ca5057dbf7f865082aec81e5e718045ff996dadd9c0021df31dcad418254";
    }

    onImageLoad(url, comicId, epId) {
        const cid = this.normalizeComicId(comicId);
        const eid = this.normalizeEpId(epId);
        const referer = cid && eid !== null ? this.HOST + "/novel" + cid + "/chapter" + eid + ".html" : this.HOST + "/";
        const address = this.readerImageUrl(url.split("#", 1)[0]);
        const noReferrer = url.endsWith("#ffppt-108-nr") || /^https?:\/\/img\.guazicdn\.com\//i.test(address);
        const headers = this._headers(noReferrer ? null : referer);
        headers.Accept = "image/avif,image/webp,image/*,*/*;q=0.8";
        const request = { url: address, headers, onResponse: bytes => {
            if (this.isReadingNotice(bytes)) throw new Error("图床返回了阅读提示，请在飞翔漫画原站打开本章。");
            return bytes;
        } };
        return { ...request, onLoadFailed: () => request };
    }

    onThumbnailLoad(url) {
        const address = this.readerImageUrl(url.split("#", 1)[0]);
        const noReferrer = url.endsWith("#ffppt-108-nr") || /^https?:\/\/img\.guazicdn\.com\//i.test(address);
        const headers = this._headers(noReferrer ? null : this.HOST + "/");
        if (url === this.PLACEHOLDER_COVER) {
            return { headers, onResponse: () => Convert.decodeBase64(this.NO_COVER_PNG) };
        }
        return { url: address, headers, onResponse: bytes =>
            this.isReadingNotice(bytes) ? Convert.decodeBase64(this.NO_COVER_PNG) : bytes
        };
    }
}
