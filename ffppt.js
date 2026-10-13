/**
 * 飞翔漫画 (ffppt.com) Venera 漫画源
 *
 * 版本: 1.0.3
 * 站点: 飞翔漫画网 https://ffppt.com/ (帝国CMS / EmpireCMS, UTF-8)
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
    version = "1.0.3";
    minAppVersion = "1.0.0";
    url = "";

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

    /** 补齐文字更新条目的真实封面；不调用会读取全部目录的loadComicInfo。 */
    async fillLatestCovers(latest, recommend) {
        const now = Date.now();
        const stored = this.loadData("ffpptCoverCacheV1");
        const cache = stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
        const covers = new Map();
        const remember = (id, cover) => {
            if (!this.isRealCover(cover)) return;
            covers.set(id, cover);
            if (cache[id] && cache[id].cover === cover && cache[id].expiresAt > now && cache[id].verified === true) return;
            cache[id] = { cover: cover, expiresAt: now + 6 * 60 * 60 * 1000 };
        };
        for (const comic of recommend) remember(comic.id, comic.cover);
        for (const comic of latest) {
            const item = cache[comic.id];
            if (!covers.has(comic.id) && item && item.expiresAt > now && this.isRealCover(item.cover)) {
                covers.set(comic.id, item.cover);
            }
        }
        if (latest.some(comic => !covers.has(comic.id))) {
            let doc = null;
            try {
                const res = await Network.get(this.HOST + "/latest/", Object.assign(
                    this._headers(this.HOST + "/"), { "cache-time": "no" }
                ));
                if (res.status === 200) {
                    doc = new HtmlDocument(res.body);
                    for (const comic of this.parseListCards(doc)) remember(comic.id, comic.cover);
                }
            } catch (error) {
                console.log("latest cover list error: " + error);
            } finally {
                if (doc) doc.dispose();
            }
        }
        const missing = Array.from(new Set(latest.filter(comic => !covers.has(comic.id)).map(comic => comic.id)));
        let next = 0;
        const worker = async () => {
            while (next < missing.length) {
                const id = missing[next++];
                let doc = null;
                try {
                    const res = await Network.get(this.HOST + "/novel" + id + "/", this.directoryHeaders(id));
                    if (res.status !== 200) continue;
                    doc = new HtmlDocument(res.body);
                    remember(id, this.detailCover(doc));
                } catch (error) {
                    console.log("cover " + id + " error: " + error);
                } finally {
                    if (doc) doc.dispose();
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(4, missing.length) }, () => worker()));
        // 仅检查尚未验证的新封面。已验证缓存命中不追加图片请求。
        const checking = Array.from(new Set(latest.map(comic => comic.id)))
            .filter(id => covers.has(id) && !(cache[id] && cache[id].verified === true));
        let checkNext = 0;
        const checkWorker = async () => {
            while (checkNext < checking.length) {
                const id = checking[checkNext++];
                try {
                    const res = await Network.sendRequest("HEAD", covers.get(id),
                        this._buildImageHeaders(covers.get(id), null, null, true).headers);
                    const type = String(res.headers["content-type"] || res.headers["Content-Type"] || "");
                    if (res.status === 200 && (!type || /^image\//i.test(type))) {
                        cache[id].verified = true;
                    } else {
                        delete cache[id];
                        if (res.status === 404 || res.status === 410 || (res.status === 200 && type && !/^image\//i.test(type))) {
                            covers.delete(id);
                        }
                    }
                } catch (error) {
                    // 有些图床拒绝HEAD；仍让客户端尝试GET，但不缓存未经验证的地址。
                    delete cache[id];
                    console.log("cover check " + id + " error: " + error);
                }
            }
        };
        await Promise.all(Array.from({ length: Math.min(4, checking.length) }, () => checkWorker()));
        for (const comic of latest) comic.cover = covers.get(comic.id) || this.PLACEHOLDER_COVER;
        // 失败不写入缓存；过期或失败条目在下次加载时重新请求。
        const limited = {};
        Object.keys(cache).filter(id => cache[id] && cache[id].expiresAt > now && this.isRealCover(cache[id].cover))
            .sort((a, b) => cache[b].expiresAt - cache[a].expiresAt).slice(0, 400)
            .forEach(id => { limited[id] = cache[id]; });
        this.saveData("ffpptCoverCacheV1", limited);
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
        cover = this.absoluteUrl(cover);

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
            cover: cover,
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
        cover = this.absoluteUrl(cover);

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
            cover: cover,
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

        return new Comic({
            id: id,
            title: title,
            subTitle: sub,
            cover: this.PLACEHOLDER_COVER,
            description: "",
            tags: []
        });
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
                    const res = await Network.get(this.HOST + "/", Object.assign(
                        this._headers(this.HOST + "/"), { "cache-time": "no" }
                    ));
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
                        await this.fillLatestCovers(latest, recommend);
                        parts.push({ title: "最近更新", comics: latest, viewMore: "最新更新" });
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
            const res = await Network.get(url, this._headers(this.HOST + "/" + slug + "/"));
            if (res.status !== 200) return { comics: [], maxPage: p };
            doc = new HtmlDocument(res.body);
            const comics = this.parseListCards(doc);
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
        onImageLoad: (url, comicId, epId) => this._buildImageHeaders(url, comicId, epId, false),
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
        for (let next = 2; next <= maxPage;) {
            const pages = [];
            while (pages.length < 4 && next <= maxPage) pages.push(next++);
            // 等本批全部结束后再报错，确保已经解析的文档均已释放。
            const results = await Promise.all(pages.map(async (page) => {
                try {
                    const res = await Network.get(
                        this.HOST + "/novel" + comicId + "/?p=" + page,
                        this.directoryHeaders(comicId)
                    );
                    if (res.status !== 200) throw new Error("HTTP " + res.status);
                    const doc = new HtmlDocument(res.body);
                    try {
                        return { page: page, parsed: this.parseChapterPage(doc, comicId, page) };
                    } finally {
                        doc.dispose();
                    }
                } catch (error) {
                    return { page: page, error: error };
                }
            }));
            for (const result of results) {
                if (result.error) {
                    throw new Error("章节目录第" + result.page + "页加载失败，请重试：" + String(result.error));
                }
                let added = 0;
                for (const entry of result.parsed.chapters) {
                    if (!chapters.has(entry[0])) {
                        chapters.set(entry[0], entry[1]);
                        added++;
                    }
                }
                if (!added) throw new Error("章节目录第" + result.page + "页重复返回旧目录，请重试");
                maxPage = Math.max(maxPage, result.parsed.maxPage);
            }
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

            const cover = this.detailCover(doc) || this.PLACEHOLDER_COVER;

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

    /** 加载章节图片: 图片位于 img.comic_img 的 data-original 懒加载属性 (绝对URL, 无加密) */
    async loadChapterImages(comicId, epId) {
        const cid = this.normalizeComicId(comicId);
        const eid = this.normalizeEpId(epId);
        if (!cid || eid === null) return { images: [] };

        const url = this.HOST + "/novel" + cid + "/chapter" + eid + ".html";
        let doc = null;
        try {
            const res = await Network.get(url, this._headers(this.HOST + "/novel" + cid + "/"));
            if (res.status !== 200) return { images: [] };
            const body = res.body;
            if (body.indexOf("漫画不存在") >= 0 || body.indexOf("已被删除") >= 0) {
                return { images: [] };
            }
            doc = new HtmlDocument(body);
            const imgs = doc.querySelectorAll("img.comic_img");
            const images = [];
            for (let i = 0; i < imgs.length; i++) {
                let src = imgs[i].attributes["data-original"]
                    || imgs[i].attributes["data-src"]
                    || imgs[i].attributes.src
                    || "";
                src = String(src).trim();
                if (src.indexOf("http://") === 0 || src.indexOf("https://") === 0) {
                    if (images.indexOf(src) < 0) images.push(src);
                }
            }
            return { images: images };
        } catch (e) {
            console.log("loadEp error: " + e);
            return { images: [] };
        } finally {
            if (doc) doc.dispose();
        }
    }

    /** 图片请求上下文: 统一携带站点 Referer, 已知易 TLS 握手失败的 CDN 域加更多浏览器级 headers */
    async onImageLoad(url, comicId, epId) {
        return this._buildImageHeaders(url, comicId, epId, false);
    }

    /** 缩略图(封面)请求上下文 */
    onThumbnailLoad(url) {
        const config = this._buildImageHeaders(url, null, null, true);
        if (url === this.PLACEHOLDER_COVER) {
            // Venera 1.6.3的缩略图支持同步onResponse；用内置PNG替换favicon字节。
            config.onResponse = () => new Uint8Array(Convert.decodeBase64(this.NO_COVER_PNG));
        }
        return config;
    }

    /** 构造图片请求 headers.
     *  defaultThumb=true 时是封面请求: 加 Host/Origin 引导某些 CDN 通过校验
     *  对 g-mh.online / p.miyeye.cn 等历史上 TLS 握手易失败的 CDN, 增强 headers 模拟浏览器 (TLS eof 无法在 JS 源层面根治)
     */
    _buildImageHeaders(url, comicId, epId, defaultThumb) {
        const u = String(url || "");
        const m = u.match(/^https?:\/\/([^/]+)/i);
        const host = m ? m[1].toLowerCase() : "";
        const baseHeaders = {
            "User-Agent": this.UA,
            "Referer": this.HOST + "/"
        };
        if (!host) {
            return { headers: baseHeaders };
        }
        // 已知 TLS 握手易失败的图床域集合 (基于用户日志记录到的客户端网络错误)
        const isFragileCdn =
            host.indexOf("g-mh.online") >= 0 ||
            host.indexOf("miyeye.cn") >= 0;
        if (defaultThumb) {
            // 封面 / 缩略图: 完整浏览器头
            return {
                headers: {
                    "User-Agent": this.UA,
                    "Referer": this.HOST + (comicId ? "/novel" + comicId + "/" : "/"),
                    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Origin": this.HOST,
                    "Host": host,
                    "Connection": "keep-alive"
                }
            };
        }
        // 正文图 (易失败 CDN): 完整浏览器头 + 自定义 Referer 指向章节页
        if (isFragileCdn) {
            const epRef = comicId && epId
                ? this.HOST + "/novel" + this.normalizeComicId(comicId) + "/chapter" + this.normalizeEpId(epId) + ".html"
                : this.HOST + "/";
            return {
                headers: {
                    "User-Agent": this.UA,
                    "Referer": epRef,
                    "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
                    "Origin": this.HOST,
                    "Host": host,
                    "Connection": "keep-alive"
                }
            };
        }
        // 通用 (默认)
        return { headers: baseHeaders };
    }
}
