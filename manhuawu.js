// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/manhuawu
class MccmsWebSource extends ComicSource {
    config = {"name":"漫画屋","baseUrl":"https://www.mhua5.com","edition":"manhuawu","key":"manhuawu","version":"1.0.1","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/manhuawu.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;
    isSix = this.config.edition === "sixmh";
    categoryGroups = this.isSix ? {
        "地区": {
            "国产漫画": "/category/list/1", "日本漫画": "/category/list/2",
            "韩国漫画": "/category/list/3", "欧美漫画": "/category/list/4",
        },
        "题材": {
            "爆笑": "/category/tags/215", "生活": "/category/tags/216", "灵异": "/category/tags/217",
            "神魔": "/category/tags/218", "日常": "/category/tags/219", "总裁": "/category/tags/220",
            "修真": "/category/tags/221", "战斗": "/category/tags/223", "漫改": "/category/tags/224",
            "校园": "/category/tags/228", "治愈": "/category/tags/229", "奇幻": "/category/tags/236",
        },
        "浏览": { "热门漫画": "/category/order/hits", "最近更新": "/category/order/addtime" },
    } : {
        "首页栏目": { "首页精选": "featured", "上升最快": "rising", "完结大作": "completed", "最近更新": "recent" },
    };

    async get(route) {
        const result = await Network.get(this.config.baseUrl + route, { "cache-time": "no" });
        if (result?.status === 403) throw new Error(this.name + "当前页面返回 HTTP 403。");
        if (!result || result.error || result.status !== 200 || typeof result.body !== "string") {
            throw new Error(this.name + "页面请求失败，请稍后重试。");
        }
        const body = result.body.trim();
        if (!body) throw new Error(this.name + "返回了空页面。");
        if (body.startsWith("{")) {
            let data;
            try { data = JSON.parse(body); } catch (_) {}
            if (typeof data?.msg === "string") throw new Error(this.name + "：" + data.msg.slice(0, 120));
        }
        return body;
    }

    async document(route, parse) {
        const doc = new HtmlDocument(await this.get(route));
        try {
            if (doc.querySelector("#code-div")) throw new Error(this.name + "要求在官网验证后搜索。");
            return parse(doc);
        } finally {
            doc.dispose();
        }
    }

    imageUrl(raw) {
        const value = String(raw || "").trim();
        if (/^https?:\/\/[a-z0-9.-]+\/[^\s]+$/i.test(value)) return value;
        if (/^\/\/[a-z0-9.-]+\/[^\s]+$/i.test(value)) return "https:" + value;
        return /^\/(?!\/)[^\s]+$/.test(value) ? this.config.baseUrl + value : "";
    }

    idFromLink(href) {
        const path = String(href || "").replace(this.config.baseUrl + "/", "/");
        const pattern = this.isSix ? /^\/(\d{1,18})\/?$/ : /^\/(?:index\.php\/)?comic\/([a-z0-9_-]{1,160})\/?$/i;
        return path.match(pattern)?.[1];
    }

    detailPath(id) {
        if (typeof id !== "string" || !/^[a-z0-9_-]{1,160}$/i.test(id) || (this.isSix && !/^\d{1,18}$/.test(id))) {
            throw new Error("作品编号无效，请刷新列表。");
        }
        return this.isSix ? "/" + id : "/index.php/comic/" + id;
    }

    chapterPath(id, ep) {
        this.detailPath(id);
        const chapter = String(ep || "").match(/^ep_(\d{1,18})$/)?.[1];
        if (!chapter) throw new Error("章节编号无效，请刷新目录。");
        return this.isSix ? "/" + id + "/" + chapter + ".html" : "/index.php/chapter/" + chapter;
    }

    parseList(doc, page, search) {
        const covers = new Map();
        const selector = this.isSix ? "div.cy_list_mh ul a[href]" : "a[href*='/comic/']";
        for (const link of doc.querySelectorAll(selector)) {
            const id = this.idFromLink(link.attributes.href);
            const image = link.querySelector("img");
            if (!id || !image) continue;
            const cover = this.imageUrl(image.attributes["data-original"] || image.attributes.src);
            if (cover) covers.set(id, cover);
        }
        const titles = this.isSix ? "div.cy_list_mh ul li.title > a" : ".comic__title > a[href]";
        const rows = doc.querySelectorAll(titles);
        const comics = new Map();
        for (const link of rows) {
            const id = this.idFromLink(link.attributes.href);
            const title = link.text.trim();
            if (id && title && !comics.has(id)) comics.set(id, new Comic({ id, title, cover: covers.get(id) || "" }));
        }
        if (!comics.size) {
            const notice = doc.querySelector(this.isSix ? ".cy_list_mh" : "body")?.text || "";
            if (!search || rows.length || !/没有找到|没有搜索到|暂无相关|搜索无结果|無相關/.test(notice)) {
                throw new Error(this.name + "未返回可识别的作品列表。");
            }
        }
        const next = doc.querySelectorAll("#Pagination a[href], .NewPages a[href]")
            .find(link => /下一页|下一頁|^next$/i.test(link.text.trim()));
        const nextNumber = Number(next?.attributes.href?.match(/\/(?:page\/)?(\d+)\/?$/)?.[1]);
        return { comics: [...comics.values()], maxPage: nextNumber > page && comics.size ? page + 1 : page };
    }

    list(route, page, search = false) {
        return this.document(route, doc => this.parseList(doc, page, search));
    }

    popular(page) {
        if (!this.isSix && page > 1) return { comics: [], maxPage: 1 };
        const route = this.isSix ? "/category/order/hits/page/" + page : "/";
        return this.list(route, page);
    }

    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.popular(page) },
        ...(this.isSix ? [{
            title: this.name + " · 最近更新", type: "multiPageComicList",
            load: page => this.list("/category/order/addtime/page/" + page, page),
        }] : []),
    ];

    category = {
        title: this.name,
        parts: Object.entries(this.categoryGroups).map(([name, entries]) => ({
            name, type: "fixed", categories: Object.keys(entries), categoryParams: Object.values(entries), itemType: "category",
        })),
    };

    homepageSection(param, page) {
        if (page > 1) return { comics: [], maxPage: 1 };
        return this.document("/", doc => {
            const sections = {
                featured: ".in-fine",
                recent: ".in-sec-update",
                rising: '.in-sec__head a[href="/index.php/custom/ascension"]',
                completed: '.in-sec__head a[href="/index.php/category/finish/2"]',
            };
            const node = doc.querySelector(sections[param]);
            const section = param === "rising" || param === "completed" ? node?.parent?.parent : node;
            if (!section) throw new Error(this.name + "首页栏目已变化。");
            return this.parseList(section, 1, false);
        });
    }

    categoryComics = {
        load: (_category, param, _options, page) => {
            if (!this.category.parts.some(part => part.categoryParams.includes(param))) {
                throw new Error("分类已变化，请重新打开分类页。");
            }
            if (!this.isSix) return this.homepageSection(param, page);
            return this.list(param + (page > 1 ? "/page/" + page : ""), page);
        },
    };

    search = {
        load: (keyword, _options, page) => {
            const term = String(keyword || "").trim();
            if (!term) return this.popular(page);
            const query = encodeURIComponent(term);
            const route = this.isSix && page === 1 ? "/index.php/search?key=" + query : "/search/" + query + "/" + page;
            return this.list(route, page, true);
        },
    };

    chapterMap(doc, id) {
        const selector = this.isSix ? "ul#mh-chapter-list-ol-0 li.chapter__item a[href]" : ".chapter__list-box > li > a[href]";
        const links = doc.querySelectorAll(selector);
        if (this.isSix) links.reverse();
        const pattern = this.isSix ? new RegExp("^/" + id + "/(\\d{1,18})\\.html$") : /^\/(?:index\.php\/)?chapter\/(\d{1,18})\/?$/;
        const chapters = {};
        for (const link of links) {
            const ep = String(link.attributes.href || "").replace(this.config.baseUrl + "/", "/").match(pattern)?.[1];
            const title = link.text.trim();
            if (ep && title && !Object.hasOwn(chapters, "ep_" + ep)) chapters["ep_" + ep] = title;
        }
        if (!Object.keys(chapters).length) throw new Error(this.name + "没有提供可识别的章节目录。");
        return chapters;
    }

    unpackSixImages(html) {
        const encoded = html.match(/\bparams\s*=\s*'([A-Za-z0-9+/=]+)'/)?.[1];
        if (!encoded) throw new Error("六漫画未返回正文图片清单。");
        const data = new Uint8Array(Convert.decodeBase64(encoded));
        if (data.length <= 16 || data.length % 16) throw new Error("六漫画图片清单格式不完整。");
        const key = Convert.encodeUtf8(this.config.readerKey);
        const decoded = new Uint8Array(Convert.decryptAesCbc(data.slice(16).buffer, key, data.slice(0, 16).buffer));
        const pad = decoded.at(-1);
        if (!(pad >= 1 && pad <= 16 && decoded.slice(-pad).every(byte => byte === pad))) {
            throw new Error("六漫画图片清单解码失败。");
        }
        const manifest = JSON.parse(Convert.decodeUtf8(decoded.slice(0, -pad).buffer));
        return manifest?.images;
    }

    comic = {
        loadInfo: async id => {
            const route = this.detailPath(id);
            return this.document(route, doc => {
                const title = doc.querySelector(this.isSix ? ".cy_info .cy_title" : ".de-info__box .comic-title")?.text.trim();
                if (!title) throw new Error(this.name + "作品详情结构已变化。");
                const cover = doc.querySelector(this.isSix ? ".cy_info_cover img.pic" : ".de-info__box img");
                const author = doc.querySelector(this.isSix ? ".cy_info .cy_xinxi span:first-child > a" : ".de-info__box .name")?.text.trim();
                const description = doc.querySelector(this.isSix ? ".cy_desc #comic-description" : ".de-info__box .intro-total")?.text.trim();
                return new ComicDetails({
                    title, cover: this.imageUrl(cover?.attributes.src), description: description || "",
                    tags: author ? { "作者": [author] } : {}, chapters: this.chapterMap(doc, id),
                    url: this.config.baseUrl + route,
                });
            });
        },
        loadEp: async (id, ep) => {
            const route = this.chapterPath(id, ep);
            const urls = this.isSix ? this.unpackSixImages(await this.get(route)) :
                await this.document(route, doc => doc.querySelectorAll("img.lazy-read[data-original]")
                    .map(node => node.attributes["data-original"]));
            const images = Array.isArray(urls) ? urls.map(url => this.imageUrl(url)) : [];
            if (!images.length || images.some(url => !url)) throw new Error(this.name + "未提供完整正文图片清单。");
            return { images };
        },
    };
}
