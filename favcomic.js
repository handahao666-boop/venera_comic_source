// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/favcomic
class FavComicSource extends ComicSource {
    config = {"name":"喜漫漫画","baseUrl":"https://www.favcomic.com","imageKey":"NlgrYjYuRT5ic1hifSs9Tg==","key":"favcomic","version":"1.0.0","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/favcomic.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;
    imageMarker = "#fav-image";

    async document(path, callback) {
        const response = await Network.get(this.config.baseUrl + path, {
            Referer: this.config.baseUrl + "/", "cache-time": "no",
        });
        if (!response || response.error) throw new Error("喜漫漫画连接失败。");
        if (response.status !== 200) throw new Error("喜漫漫画返回 HTTP " + response.status);
        const doc = new HtmlDocument(response.body);
        try { return callback(doc); }
        finally { doc.dispose(); }
    }

    image(node) {
        const attrs = node?.attributes;
        const value = attrs?.["data-src"] || attrs?.src;
        if (typeof value !== "string" || !/^https:\/\/[a-z0-9.-]+\/[^\s#]+$/i.test(value)) return "";
        const encrypted = (attrs.class || "").split(/\s+/).includes("encrypted-image");
        return value + (encrypted ? this.imageMarker : "");
    }

    id(raw) {
        const id = String(raw || "");
        if (!/^[a-z0-9_-]{1,180}$/i.test(id)) throw new Error("作品编号无效。");
        return id;
    }

    list(page, options = {}, route = "/free") {
        const query = Object.entries({ ...options, page }).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&");
        return this.document(route + "?" + query, doc => {
            const comics = new Map();
            for (const item of doc.querySelectorAll(".comic_list .comic_li")) {
                const link = item.querySelector('.cover_box a[href*="/comic/detail/"]');
                const id = link?.attributes.href?.match(/\/comic\/detail\/([a-z0-9_-]{1,180})\/?$/i)?.[1];
                const title = link?.attributes.title || item.querySelector(".brief_box .title a")?.text.trim();
                if (id && title && !comics.has(id)) comics.set(id, new Comic({
                    id, title, cover: this.image(link.querySelector("img")), subtitle: item.querySelector(".chapter .txt")?.text.trim(),
                }));
            }
            const next = doc.querySelector('.pagination_box a[title="下一页"]')?.attributes.href;
            return { comics: [...comics.values()], maxPage: comics.size && Number(next?.match(/[?&]page=(\d+)/)?.[1]) > page ? page + 1 : page };
        });
    }

    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.list(page, { sort: 1 }) },
        { title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.list(page) },
    ];

    genres = { "奇幻": "1", "冒险": "4", "悬疑": "2", "热血": "3", "搞笑喜剧": "6", "科幻": "42", "校园": "34" };
    category = { title: this.name, parts: [{
        name: "免费漫画题材", type: "fixed", itemType: "category",
        categories: Object.keys(this.genres), categoryParams: Object.values(this.genres),
    }] };
    categoryComics = { load: (_category, tag, _options, page) => {
        if (!Object.values(this.genres).includes(tag)) throw new Error("题材无效。");
        return this.list(page, { tag });
    } };
    search = { load: (keyword, _options, page) => {
        const query = String(keyword || "").trim();
        return query ? this.list(page, { keyword: query }, "/search") : this.list(page, { sort: 1 });
    } };

    chapterId(ep) {
        const id = String(ep || "").match(/^ep_(\d{1,22})$/)?.[1];
        if (!id) throw new Error("章节编号无效。");
        return id;
    }

    publicImage(data) {
        const bytes = new Uint8Array(data);
        if (bytes.length < 32 || bytes.length % 16) throw new Error("公开图片返回的数据不完整。");
        const key = Convert.decodeBase64(this.config.imageKey);
        const result = new Uint8Array(Convert.decryptAesCbc(bytes.slice(16).buffer, key, bytes.slice(0, 16).buffer));
        const pad = result.at(-1);
        if (!(pad >= 1 && pad <= 16 && result.slice(-pad).every(byte => byte === pad))) {
            throw new Error("喜漫漫画图片格式已变化。");
        }
        return result.slice(0, -pad).buffer;
    }

    imageRequest(url, referer) {
        const headers = { Referer: referer };
        if (!url.endsWith(this.imageMarker)) return { url, headers };
        return { url: url.slice(0, -this.imageMarker.length), headers, onResponse: data => this.publicImage(data) };
    }

    comic = {
        loadInfo: rawId => {
            const id = this.id(rawId);
            const path = "/comic/detail/" + id;
            return this.document(path, doc => {
                const title = doc.querySelector(".comic_title")?.text.trim();
                if (!title) throw new Error("喜漫漫画未返回作品详情。");
                const chapters = {};
                for (const link of doc.querySelectorAll(".catalog_box a")) {
                    const id = link.attributes.href?.match(/\/comic\/chapter\/(\d{1,22})\/?$/)?.[1];
                    const name = link.querySelector(".title")?.text.trim();
                    const price = Number(link.querySelector("span:last-child")?.text.trim().replace(/[￥¥]/g, ""));
                    if (id && name) chapters["ep_" + id] = (price > 0 ? "🔒 " : "") + name;
                }
                if (!Object.keys(chapters).length) throw new Error("原站没有返回章节。");
                const author = doc.querySelector(".author")?.text.trim();
                const genre = doc.querySelectorAll(".tag_box a").map(node => node.text.trim()).filter(Boolean);
                return new ComicDetails({
                    title, cover: this.image(doc.querySelector(".comic_cover_box > .flex_box > img")), chapters,
                    tags: { "作者": author ? [author] : [], "题材": genre }, url: this.config.baseUrl + path,
                    description: doc.querySelector(".intro_box > .txt")?.text.trim().replace(/^作品介绍：/, "") || "",
                });
            });
        },
        loadEp: (_id, ep) => {
            const path = "/comic/chapter/" + this.chapterId(ep);
            return this.document(path, doc => {
                const access = doc.querySelector(".comic_chapter_box")?.attributes.code;
                if (access !== "0") throw new Error("此章未向游客开放完整正文，请在原站查看阅读权限。");
                const images = doc.querySelectorAll("#content > img").map(node => this.image(node));
                if (!images.length || images.some(url => !url)) throw new Error("喜漫漫画未返回完整图片清单。");
                return { images };
            });
        },
        onThumbnailLoad: url => this.imageRequest(url, this.config.baseUrl + "/"),
        onImageLoad: (url, _id, ep) => this.imageRequest(url, this.config.baseUrl + "/comic/chapter/" + this.chapterId(ep)),
    };
}
