// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/mh1234
class Mh1234Source extends ComicSource {
    config = {"name":"漫画1234","baseUrl":"https://m.wmh1234.com","key":"mh1234","version":"1.0.0","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/mh1234.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;

    async get(url, referer = this.config.baseUrl + "/") {
        const response = await Network.get(url, { "cache-time": "no", Referer: referer });
        if (!response || response.error) throw new Error(this.name + "连接失败。");
        if (response.status !== 200) throw new Error(this.name + "返回 HTTP " + response.status + "。");
        if (typeof response.body !== "string" || !response.body.trim()) throw new Error(this.name + "返回空页面。");
        return response.body;
    }

    parse(html, callback) {
        const doc = new HtmlDocument(html);
        try { return callback(doc); }
        finally { doc.dispose(); }
    }

    localPath(href) {
        const link = String(href || "");
        return link.startsWith(this.config.baseUrl + "/") ? link.slice(this.config.baseUrl.length) : link;
    }

    image(value) {
        const url = String(value || "").trim();
        if (/^https?:\/\/[a-z0-9.-]+\/[^\s]+$/i.test(url)) return url;
        if (/^\/\/[a-z0-9.-]+\/[^\s]+$/i.test(url)) return "https:" + url;
        return /^\/(?!\/)[^\s]+$/.test(url) ? this.config.baseUrl + url : "";
    }

    async list(route, page, allowEmpty = false) {
        const url = this.config.baseUrl + route + (page > 1 ? "/page/" + page : "");
        return this.parse(await this.get(url), doc => {
            const comics = new Map();
            for (const card of doc.querySelectorAll("a.comic-card__link")) {
                const id = this.localPath(card.attributes.href).match(/^\/comic\/(\d{1,18})\.html$/)?.[1];
                const title = card.querySelector(".comic-card__title")?.text.trim();
                if (!id || !title || comics.has(id)) continue;
                const cover = this.image(card.querySelector("img.comic-card__image")?.attributes["data-src"]);
                const subtitle = card.querySelector(".comic-card__chapter")?.text.trim();
                comics.set(id, new Comic({ id, title, cover, subtitle }));
            }
            if (!comics.size) {
                const text = doc.querySelector("body")?.text || "";
                if (!allowEmpty || !/暂无|没有找到|未找到|没有相关|没有漫画|没有数据/.test(text)) {
                    throw new Error(this.name + "未返回可识别的作品列表。");
                }
            }
            const next = doc.querySelectorAll(".pagination-wrapper a").find(link => /^(?:下一页|>)$/.test(link.text.trim()));
            const target = this.localPath(next?.attributes.href).match(/\/page\/(\d+)\/?$/)?.[1];
            return { comics: [...comics.values()], maxPage: Number(target) > page ? page + 1 : page };
        });
    }

    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.list("/category/order/hits", page) },
        { title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.list("/category/order/addtime", page) },
    ];

    categoryGroups = {
        "地区": { "国漫": "tags/257", "日漫": "tags/240", "韩漫": "tags/209" },
        "题材": {
            "恋爱": "tags/17", "搞笑": "tags/13", "热血": "tags/6", "都市": "tags/31",
            "科幻": "tags/8", "魔幻": "tags/69", "奇幻": "tags/96", "冒险": "tags/7", "生活": "tags/29",
        },
        "连载状态": { "连载": "finish/1", "完结": "finish/2" },
    };

    category = {
        title: this.name,
        parts: Object.entries(this.categoryGroups).map(([name, entries]) => ({
            name, type: "fixed", itemType: "category", categories: Object.keys(entries), categoryParams: Object.values(entries),
        })),
    };

    categoryComics = {
        load: (_category, param, _options, page) => {
            if (!this.category.parts.some(part => part.categoryParams.includes(param))) throw new Error("分类无效。");
            return this.list("/category/order/addtime/" + param, page, true);
        },
    };

    search = {
        load: (keyword, _options, page) => {
            const query = String(keyword || "").trim();
            return query ? this.list("/search/" + encodeURIComponent(query), page, true) : this.list("/category/order/hits", page);
        },
    };

    comicId(value) {
        const id = String(value || "");
        if (!/^\d{1,18}$/.test(id)) throw new Error("作品编号无效。");
        return id;
    }

    episodePath(id, episode) {
        const ep = String(episode || "").match(/^ep_(\d{1,18})$/)?.[1];
        if (!ep) throw new Error("章节编号无效，请刷新目录。");
        return "/comic/" + this.comicId(id) + "/" + ep + ".html";
    }

    chapters(doc, id) {
        const chapters = {};
        const chapterPath = new RegExp("^/comic/" + id + "/(\\d{1,18})\\.html$");
        for (const link of doc.querySelectorAll(".mint-chapter-grid a").reverse()) {
            const chapter = this.localPath(link.attributes.href).match(chapterPath)?.[1];
            const title = link.text.trim();
            if (chapter && title && !/\bAPP\b/i.test(title)) chapters["ep_" + chapter] = title;
        }
        if (!Object.keys(chapters).length) throw new Error(this.name + "没有返回可读章节目录。");
        return chapters;
    }

    readerUrl(html) {
        const target = html.match(/\blocation\.replace\(\s*["']([^"']+)["']/)?.[1];
        if (!target) return null;
        if (!/^https:\/\/reader\.hqread\.cc\/r\/[a-z0-9_-]+\/?$/i.test(target)) throw new Error(this.name + "的阅读页地址已变化。");
        return target;
    }

    comic = {
        loadInfo: async rawId => {
            const id = this.comicId(rawId);
            const url = this.config.baseUrl + "/comic/" + id + ".html";
            return this.parse(await this.get(url), doc => {
                const title = doc.querySelector("#mintWorkTitle")?.text.trim();
                if (!title) throw new Error(this.name + "详情结构已变化。");
                const author = doc.querySelector(".mint-work-info p")?.text.trim().replace(/\s*著$/, "");
                const cover = this.image(doc.querySelector('meta[property="og:image"]')?.attributes.content);
                const description = doc.querySelector("#mintIntroPanel > div")?.text.trim() || "";
                const tags = author ? { "作者": author.split(/[,，]/).map(text => text.trim()).filter(Boolean) } : {};
                return new ComicDetails({ title, cover, description, tags, chapters: this.chapters(doc, id), url });
            });
        },
        loadEp: async (id, ep) => {
            const url = this.config.baseUrl + this.episodePath(id, ep);
            const chapter = await this.get(url);
            if (/最新章节抢先看|已在\s*App\s*抢先更新|网页端将在稍后开放/.test(chapter)) {
                throw new Error("该章目前由原站 App 抢先发布，网页开放后可在这里阅读。");
            }
            const reader = this.readerUrl(chapter);
            const html = reader ? await this.get(reader, url) : chapter;
            return this.parse(html, doc => {
                const images = doc.querySelectorAll("img.reader-image").map(img => this.image(img.attributes["data-src"]));
                if (!images.length || images.some(value => !value)) throw new Error("原站未返回完整的公开正文图片。");
                return { images };
            });
        },
        onImageLoad: url => ({ url, headers: { Referer: "https://reader.hqread.cc/" } }),
        onThumbnailLoad: url => ({ url, headers: { Referer: this.config.baseUrl + "/" } }),
    };
}
