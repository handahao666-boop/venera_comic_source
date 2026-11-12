// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/manhuashe
class HtmlCatalogueSource extends ComicSource {
    config = {"name":"漫画社","baseUrl":"https://www.311s.com","popular":"/category/order/hits/page/{page}","latest":"/category/order/addtime/page/{page}","search":"/search/{keyword}/{page}","categories":{"浏览":{"热门漫画":"/category/order/hits/page/{page}","最新更新":"/category/order/addtime/page/{page}","连载中":"/category/order/hits/finish/1/page/{page}","已完结":"/category/order/hits/finish/2/page/{page}"},"题材":{"热血":"/category/order/hits/tags/6/page/{page}","冒险":"/category/order/hits/tags/7/page/{page}","科幻":"/category/order/hits/tags/8/page/{page}","霸总":"/category/order/hits/tags/9/page/{page}","玄幻":"/category/order/hits/tags/10/page/{page}","校园":"/category/order/hits/tags/11/page/{page}","修真":"/category/order/hits/tags/12/page/{page}","搞笑":"/category/order/hits/tags/13/page/{page}","穿越":"/category/order/hits/tags/14/page/{page}","后宫":"/category/order/hits/tags/15/page/{page}","耽美":"/category/order/hits/tags/16/page/{page}","恋爱":"/category/order/hits/tags/17/page/{page}","悬疑":"/category/order/hits/tags/18/page/{page}","恐怖":"/category/order/hits/tags/19/page/{page}","战争":"/category/order/hits/tags/20/page/{page}","动作":"/category/order/hits/tags/21/page/{page}","同人":"/category/order/hits/tags/22/page/{page}","竞技":"/category/order/hits/tags/23/page/{page}","励志":"/category/order/hits/tags/24/page/{page}","架空":"/category/order/hits/tags/25/page/{page}","灵异":"/category/order/hits/tags/26/page/{page}","百合":"/category/order/hits/tags/27/page/{page}"}},"cards":"div.comic-list > div.comic-item","cardTitle":"h3 a","cardIdNode":"h3 a","cardIdAttribute":"href","cardIdPattern":"^/comic_(\\d+)\\.html$","cardCover":"img","detail":"/comic_{comic}.html","detailTitle":".comic-meta-info > h1","detailCover":".comic-cover-large > img","description":".comic-description > p","chapters":"#chapter-list > div.chapter-item > a","newestFirst":false,"chapter":"/chapter_{comic}_{chapter}.html","images":"div.comic-content > img","imageAttribute":"src","next":".pagination > a.next","current":".pagination > a.on","key":"manhuashe","version":"1.0.2","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/manhuashe.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;

    path(pattern, values) {
        return pattern.replace(/\{(\w+)\}/g, (_, key) => encodeURIComponent(values[key]));
    }

    id(value) {
        const id = String(value ?? "");
        if (!/^\d{1,20}$/.test(id)) throw new Error("作品或章节编号无效。");
        return id;
    }

    async request(route, json = false) {
        const response = await Network.get(this.config.baseUrl + route, {
            "cache-time": "no",
            "Referer": this.config.baseUrl + "/",
            ...(json ? { "Accept": "application/json", "X-Requested-With": "XMLHttpRequest" } : {}),
        });
        if (!response || response.error) throw new Error(this.name + "连接失败。");
        if (response.status !== 200) throw new Error(this.name + "返回 HTTP " + response.status);
        if (typeof response.body !== "string" || !response.body.trim()) throw new Error("站点返回空数据。");
        if (!json) return response.body;
        try { return JSON.parse(response.body); }
        catch (_) { throw new Error("章节接口未返回 JSON。"); }
    }

    async html(route, parse) {
        const doc = new HtmlDocument(await this.request(route));
        try { return parse(doc); } finally { doc.dispose(); }
    }

    imageUrl(value) {
        if (typeof value !== "string") return "";
        if (/^https?:\/\/[^/\s]+\/[^\s]+$/.test(value)) return value;
        if (/^\/\/[^/\s]+\/[^\s]+$/.test(value)) return "https:" + value;
        return /^\/(?!\/)[^\s]+$/.test(value) ? this.config.baseUrl + value : "";
    }

    sectionRows(doc, section) {
        const siblings = doc.querySelector(".maincomic")?.parent?.children || [];
        const rows = [];
        let current;
        for (const child of siblings) {
            const classes = child.classNames;
            if (classes.includes("maincomic") || classes.includes("extracomic")) {
                current = classes.find(value => value === "maincomic" || value === "extracomic");
            } else if (current === section && child.attributes.href?.includes("/book/")) {
                rows.push(child);
            }
        }
        return rows;
    }

    async list(pattern, page, keyword = "", section = "") {
        const c = this.config;
        if (page > 1 && !pattern.includes("{page}")) return { comics: [], maxPage: 1 };
        const route = this.path(pattern, { page, keyword });
        return this.html(route, doc => {
            const comics = [];
            const seen = new Set();
            const idPattern = new RegExp(c.cardIdPattern);
            const rows = section ? this.sectionRows(doc, section) : doc.querySelectorAll(c.cards);
            for (const row of rows) {
                const idValue = row.querySelector(c.cardIdNode)?.attributes[c.cardIdAttribute] || "";
                const id = idValue.match(idPattern)?.[1];
                const title = row.querySelector(c.cardTitle)?.text?.trim();
                if (!id || !title || seen.has(id)) continue;
                seen.add(id);
                comics.push(new Comic({ id, title, cover: this.imageUrl(row.querySelector(c.cardCover)?.attributes.src) }));
            }
            if (!comics.length && (!keyword || rows.length)) throw new Error("官网作品列表为空或结构已变化。");
            const next = c.next && doc.querySelector(c.next)?.attributes.href;
            const current = c.current && doc.querySelector(c.current)?.attributes.href;
            return { comics, maxPage: next && next !== current && next !== "#" && next !== route ? page + 1 : page };
        });
    }

    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.list(this.config.popular, page) },
        ...(this.config.latest ? [{
            title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.list(this.config.latest, page),
        }] : []),
    ];

    category = {
        title: this.name,
        parts: Object.entries(this.config.categories).map(([name, entries]) => ({
            name, type: "fixed", categories: Object.keys(entries), categoryParams: Object.values(entries), itemType: "category",
        })),
    };

    categoryComics = {
        load: (_category, param, _options, page) => {
            if (!this.category.parts.some(part => part.categoryParams.includes(param))) {
                throw new Error("分类已变化，请重新打开分类页。");
            }
            return this.config.chaptersJson ? this.list(this.config.popular, page, "", param) : this.list(param, page);
        },
    };

    search = {
        load: async (keyword, _options, page) => {
            const query = String(keyword || "").trim();
            if (!query) return this.list(this.config.popular, page);
            if (this.config.search) return this.list(this.config.search, page, query);
            if (page > 1) return { comics: [], maxPage: 1 };
            const { comics } = await this.list(this.config.popular, 1);
            return { comics: comics.filter(row => row.title.toLowerCase().includes(query.toLowerCase())), maxPage: 1 };
        },
    };

    chapterRows(doc, id) {
        const pattern = new RegExp("^/chapter_" + id + "_(\\d+)\\.html$");
        return doc.querySelectorAll(this.config.chapters).map(node => ({
            id: (node.attributes.href || "").match(pattern)?.[1],
            title: node.text.trim(),
        }));
    }

    async jsonChapterRows(id) {
        const rows = await this.request(this.path(this.config.chaptersJson, { comic: id }), true);
        if (!Array.isArray(rows)) throw new Error("官网章节接口结构已变化。");
        return rows.map(row => ({
            id: String(row.bookid) === id ? String(row.chapterid ?? "") : "",
            title: row.title,
        }));
    }

    chapterMap(rows) {
        if (this.config.newestFirst) rows.reverse();
        const chapters = {};
        for (const row of rows) {
            const id = "ep_" + this.id(row.id);
            if (typeof row.title !== "string" || !row.title.trim()) throw new Error("章节标题缺失。");
            if (Object.hasOwn(chapters, id)) throw new Error("目录中存在重复章节编号。");
            chapters[id] = row.title.trim();
        }
        if (!rows.length) throw new Error("官网没有提供章节目录。");
        return chapters;
    }

    chapterPath(comic, episode) {
        if (typeof episode !== "string" || !episode.startsWith("ep_")) throw new Error("请刷新章节目录。");
        return this.path(this.config.chapter, { comic: this.id(comic), chapter: this.id(episode.slice(3)) });
    }

    comic = {
        loadInfo: async id => {
            id = this.id(id);
            const c = this.config;
            const route = this.path(c.detail, { comic: id });
            const parsed = await this.html(route, doc => ({
                title: doc.querySelector(c.detailTitle)?.text?.trim(),
                cover: this.imageUrl(doc.querySelector(c.detailCover)?.attributes.src),
                description: doc.querySelector(c.description)?.text?.trim() || "",
                rows: c.chapters ? this.chapterRows(doc, id) : null,
            }));
            if (!parsed.title) throw new Error("未能读取作品详情。");
            return new ComicDetails({
                title: parsed.title, cover: parsed.cover, description: parsed.description,
                tags: {},
                chapters: this.chapterMap(parsed.rows ?? await this.jsonChapterRows(id)),
                url: c.baseUrl + route,
            });
        },
        loadEp: async (id, ep) => {
            const route = this.chapterPath(id, ep);
            return this.html(route, doc => {
                const images = doc.querySelectorAll(this.config.images)
                    .map(node => this.imageUrl(node.attributes[this.config.imageAttribute]));
                if (!images.length || images.some(url => !url)) throw new Error("未取得完整正文图片清单。");
                return { images };
            });
        },
        onImageLoad: (url, id, ep) => ({ url, headers: { Referer: this.config.baseUrl + this.chapterPath(id, ep) } }),
        onThumbnailLoad: url => ({ url, headers: { Referer: this.config.baseUrl + "/" } }),
    };
}
