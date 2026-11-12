// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/mikagogo
class MikagogoSource extends ComicSource {
    config = {"name":"米卡插画","baseUrl":"https://mikagogo.com","key":"mikagogo","version":"1.0.0","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/mikagogo.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;

    async request(path, fields) {
        const headers = { Referer: this.config.baseUrl + "/", "cache-time": "no" };
        const url = this.config.baseUrl + path;
        const response = fields
            ? await Network.post(url, { ...headers, "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest" },
                Object.entries(fields).map(([key, value]) => key + "=" + encodeURIComponent(value)).join("&"))
            : await Network.get(url, headers);
        if (!response || response.error) throw new Error("米卡插画连接失败。");
        if (response.status !== 200) throw new Error("米卡插画返回 HTTP " + response.status);
        if (typeof response.body !== "string" || !response.body.trim()) throw new Error("米卡插画返回空页面。");
        return response.body;
    }

    parse(html, callback) {
        const doc = new HtmlDocument(html);
        try { return callback(doc); }
        finally { doc.dispose(); }
    }

    image(value) {
        if (typeof value !== "string") return "";
        if (/^https?:\/\/[a-z0-9.-]+\/[^\s]+$/i.test(value)) return value;
        if (/^\/\/[a-z0-9.-]+\/[^\s]+$/i.test(value)) return "https:" + value;
        return /^\/(?!\/)[^\s]+$/.test(value) ? this.config.baseUrl + value : "";
    }

    cards(doc) {
        const comics = new Map();
        for (const item of doc.querySelectorAll(".kzpost-data")) {
            const title = item.querySelector(".posr-tit")?.text.trim();
            const id = item.querySelector("a")?.attributes.href?.match(/^(?:https?:\/\/(?:www\.)?mikagogo\.com)?\/(\d{1,14})\/?$/i)?.[1];
            const img = item.querySelector("img.cardImage")?.attributes;
            const cover = this.image(img?.["data-original"] || img?.src);
            if (id && title && cover && !comics.has(id)) comics.set(id, new Comic({ id, title, cover }));
        }
        return [...comics.values()];
    }

    async list(page, sort, category = "0") {
        const text = await this.request("/wp-admin/admin-ajax.php", {
            action: "postlist_newajax", type: "sxpost", cat: category, term: "category", paged: page, orderby: sort,
        });
        const data = JSON.parse(text).data;
        if (!data || typeof data.html !== "string") throw new Error("米卡插画列表格式已变化。");
        const comics = this.parse(data.html, doc => this.cards(doc));
        return { comics, maxPage: comics.length && Number(data.starus) === 1 ? page + 1 : page };
    }

    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.list(page, "views") },
        { title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.list(page, "date") },
    ];

    categories = { "插画精选": "7", "图集画册": "8", "动漫壁纸": "5", "电脑壁纸": "6", "插画": "4", "P站画师": "3", "P站美图": "2" };
    category = { title: this.name, parts: [{
        name: "原站分类", type: "fixed", itemType: "category",
        categories: Object.keys(this.categories), categoryParams: Object.values(this.categories),
    }] };
    categoryComics = { load: (_category, param, _options, page) => {
        if (!Object.values(this.categories).includes(param)) throw new Error("分类无效。");
        return this.list(page, "date", param);
    } };

    search = { load: async (keyword, _options, page) => {
        const query = String(keyword || "").trim();
        if (!query) return this.list(page, "views");
        const path = (page > 1 ? "/page/" + page + "/" : "/") + "?s=" + encodeURIComponent(query);
        return this.parse(await this.request(path), doc => {
            const comics = this.cards(doc);
            return { comics, maxPage: comics.length && doc.querySelector("a.next.page-numbers") ? page + 1 : page };
        });
    } };

    postPath(id) {
        if (!/^\d{1,14}$/.test(String(id || ""))) throw new Error("图集编号无效。");
        return "/" + id;
    }

    post(html) {
        return this.parse(html, doc => {
            const title = doc.querySelector(".kz-single-data h1")?.text.trim();
            const content = doc.querySelector("#content .content_left");
            if (!title || !content) throw new Error("米卡插画图集结构已变化。");
            const images = [];
            for (const node of content.querySelectorAll("img")) {
                const attrs = node.attributes;
                const image = this.image(attrs["data-original"] || attrs["data-src"] || attrs.src);
                if (image && !images.includes(image)) images.push(image);
            }
            const tags = doc.querySelectorAll(".kz-post_tags_list a").map(node => node.text.trim()).filter(Boolean);
            const pages = content.querySelectorAll(".page_imges a.page-numbers")
                .map(node => Number(node.text.trim())).filter(page => Number.isSafeInteger(page) && page > 0);
            return { title, tags, images, maxPage: Math.max(1, ...pages) };
        });
    }

    comic = {
        loadInfo: async id => {
            const path = this.postPath(id);
            const post = this.post(await this.request(path));
            if (!post.images.length) throw new Error("原站没有公开图集预览。");
            return new ComicDetails({
                title: post.title, cover: post.images[0], tags: { "标签": post.tags },
                chapters: { gallery: "图集预览" }, url: this.config.baseUrl + path,
            });
        },
        loadEp: async (id, ep) => {
            if (ep !== "gallery") throw new Error("图集目录已变化。");
            const path = this.postPath(id);
            const post = this.post(await this.request(path));
            const images = [...post.images];
            for (let page = 2; page <= post.maxPage; page++) {
                const next = this.post(await this.request(path + "/" + page));
                if (!next.images.length) throw new Error("原站未返回第 " + page + " 页预览。");
                images.push(...next.images);
            }
            const unique = [...new Set(images)];
            if (!unique.length) throw new Error("原站没有公开图集预览。");
            return { images: unique };
        },
        onThumbnailLoad: url => ({ url, headers: { Referer: this.config.baseUrl + "/" } }),
        onImageLoad: (url, id) => ({ url, headers: { Referer: this.config.baseUrl + this.postPath(id) } }),
    };
}
