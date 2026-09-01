/**
 * 飞翔漫画 (ffppt.com) Venera 漫画源
 *
 * 版本: 1.0.1
 * 站点: 飞翔漫画网 https://ffppt.com/ (帝国CMS / EmpireCMS, UTF-8)
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
 *   作者 a[itemprop=author], 分类 a[itemprop=genre], 简介 .desc-text, 完整章节 #list-chapter
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
    version = "1.0.1";
    minAppVersion = "1.0.0";
    url = "";

    HOST = "https://ffppt.com";
    UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    PLACEHOLDER_COVER = "https://ffppt.com/favicon.ico";

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
            cover = img.attributes.src || img.attributes["data-original"] || "";
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
        if (img) cover = img.attributes.src || img.attributes["data-original"] || "";
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
                    const res = await Network.get(this.HOST + "/", this._headers(this.HOST + "/"));
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
        }
    };

    /** 加载漫画详情 */
    async loadComicInfo(id) {
        const comicId = this.normalizeComicId(id);
        if (!comicId) throw "Invalid comic id";

        const res = await Network.get(
            this.HOST + "/novel" + comicId + "/",
            this._headers(this.HOST + "/")
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

            let cover = "";
            const img = doc.querySelector(".info-holder img[itemprop=image]")
                || doc.querySelector("img[itemprop=image]");
            if (img) cover = img.attributes.src || img.attributes["data-original"] || "";
            if (!cover) {
                const og = doc.querySelector("meta[property='og:image']");
                if (og) cover = og.attributes.content || "";
            }
            cover = this.absoluteUrl(cover);

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

            const chapters = {};
            const listChapter = doc.querySelector("#list-chapter");
            if (listChapter) {
                const links = listChapter.querySelectorAll("a[href*='chapter']");
                for (let i = 0; i < links.length; i++) {
                    const m = (links[i].attributes.href || "").match(/chapter(\d+)\.html/);
                    if (!m) continue;
                    let t = "";
                    const ct = links[i].querySelector(".chapter-text");
                    if (ct) t = ct.text.trim();
                    if (!t) t = (links[i].attributes.title || links[i].text || "").trim();
                    if (!(m[1] in chapters)) chapters[m[1]] = t;
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
    async onThumbnailLoad(url) {
        return this._buildImageHeaders(url, null, null, true);
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
