// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/all/toomics
class ToomicsChineseSource extends ComicSource {
    config = {"name":"Toomics 玩漫（繁中）","baseUrl":"https://global.toomics.com","key":"toomics","version":"1.0.0","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/toomics.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;
    prefix = "/tc/webtoon";
    desktopAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    async request(path, keyword = "") {
        const url = this.config.baseUrl + this.prefix + path;
        const headers = { "User-Agent": this.desktopAgent, "cache-time": "no" };
        const response = keyword ? await Network.post(url, {
            ...headers, Referer: this.config.baseUrl + "/tc", "Content-Type": "application/x-www-form-urlencoded", "X-Requested-With": "XMLHttpRequest",
        }, "toonData=" + encodeURIComponent(keyword)) : await Network.get(url, headers);
        if (!response || response.error) throw new Error("Toomics 連線失敗。");
        if (response.status !== 200) throw new Error("Toomics 返回 HTTP " + response.status);
        if (typeof response.body !== "string" || !response.body.trim()) throw new Error("Toomics 返回空頁面。");
        return response.body;
    }

    parse(html, callback) {
        const doc = new HtmlDocument(html);
        try { return callback(doc); }
        finally { doc.dispose(); }
    }

    image(value) {
        return typeof value === "string" && /^https:\/\/[a-z0-9.-]+\.toomics\.com\/[^\s]+$/i.test(value) ? value : "";
    }

    id(value) {
        if (!/^\d{1,12}$/.test(String(value || ""))) throw new Error("作品編號無效。");
        return value;
    }

    cards(doc, selector) {
        const comics = new Map();
        for (const link of doc.querySelectorAll(selector)) {
            const raw = link.attributes.href || "";
            let href = raw;
            try { href = decodeURIComponent(raw); } catch (_) {}
            const destination = href + " " + (link.attributes.onclick || "");
            const id = destination.match(/\/tc\/webtoon\/episode\/toon\/(\d{1,12})\b/)?.[1]
                || href.match(/[?&]toon=(\d{1,12})\b/)?.[1];
            const title = link.querySelector("h4, strong")?.text.trim();
            const pic = link.querySelector("img")?.attributes;
            if (id && title && !comics.has(id)) comics.set(id, new Comic({
                id, title, cover: this.image(pic?.["data-original"] || pic?.src),
            }));
        }
        return [...comics.values()];
    }

    async list(path, page) {
        if (page > 1) return { comics: [], maxPage: 1 };
        const comics = this.parse(await this.request(path), doc => this.cards(doc, "li > div.visual a[href]"));
        if (!comics.length) throw new Error("Toomics 列表沒有返回可識別的作品。");
        return { comics, maxPage: 1 };
    }

    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.list("/ranking", page) },
        { title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.list("/ongoing_all", page) },
        { title: this.name + " · 新作", type: "multiPageComicList", load: page => this.list("/new_comics", page) },
    ];

    genres = { "完結": "2", "劇情": "5", "浪漫愛情": "1065", "奇幻冒險": "1066", "動作": "2474", "幽默搞笑": "2473", "青春校園": "8" };
    category = { title: this.name, parts: [{
        name: "繁中類型", type: "fixed", itemType: "category", categories: Object.keys(this.genres), categoryParams: Object.values(this.genres),
    }] };
    categoryComics = { load: (_category, genre, _options, page) => {
        if (!Object.values(this.genres).includes(genre)) throw new Error("分類無效。");
        return this.list("/ranking/genre/" + genre, page);
    } };

    search = { load: async (keyword, _options, page) => {
        const query = String(keyword || "").trim();
        if (!query) return this.list("/ranking", page);
        if (page > 1) return { comics: [], maxPage: 1 };
        const json = JSON.parse(await this.request("/ajax_search", query));
        const html = json.webtoon?.sHtml || json.content;
        if (typeof html !== "string") throw new Error("Toomics 搜尋格式已變化。");
        let comics = this.parse(html, doc => this.cards(doc, "#search-list-items li a[href], li a[href], a.relative[href]"));
        if (!comics.length && !Number(json.webtoon?.iSearchCount || 0)) {
            const list = await this.list("/ranking", 1);
            comics = list.comics.filter(row => row.title.toLowerCase().includes(query.toLowerCase()));
        }
        return { comics, maxPage: 1 };
    } };

    episodePath(id, ep) {
        const match = String(ep || "").match(/^ep_(\d{1,12})_(\d{1,12})$/);
        if (!match) throw new Error("章節編號無效。");
        return "/detail/code/" + match[1] + "/ep/" + match[2] + "/toon/" + this.id(id);
    }

    comic = {
        loadInfo: async rawId => {
            const id = this.id(rawId);
            const route = "/episode/toon/" + id;
            return this.parse(await this.request(route), doc => {
                const header = doc.querySelectorAll("#glo_contents section.relative").find(node => node.querySelector("h2"))
                    || doc.querySelector("#glo_contents") || doc.querySelector("body");
                const title = header?.querySelector("h2")?.text.trim();
                if (!title) throw new Error("Toomics 未返回公開作品詳情。");
                const chapters = {};
                const episodes = [];
                for (const row of doc.querySelectorAll("li.normal_ep")) {
                    if (!row.querySelector(".coin-type1")) continue;
                    const link = row.querySelector("a");
                    const path = (link?.attributes.onclick || link?.attributes.href || "").match(/\/tc\/webtoon\/detail\/code\/(\d+)\/ep\/(\d+)\/toon\/(\d+)/);
                    if (!path || path[3] !== id) continue;
                    const name = row.querySelector(".cell-title strong")?.text.trim();
                    episodes.push({ code: path[1], number: path[2], name });
                }
                episodes.sort((a, b) => Number(a.number) - Number(b.number));
                for (const row of episodes) {
                    chapters["ep_" + row.code + "_" + row.number] = "第 " + row.number + " 話" + (row.name ? " · " + row.name : "");
                }
                if (!Object.keys(chapters).length) throw new Error("原站暫未開放免費章節。");
                const cover = this.image(doc.querySelector('meta[property="og:image"]')?.attributes.content);
                const author = [...new Set(header.querySelectorAll('a[href*="searchtype=author"]').map(node => node.text.trim()).filter(Boolean))];
                const genres = header.querySelectorAll("a[data-tag-name]").map(node => node.attributes["data-tag-name"]).filter(Boolean);
                return new ComicDetails({
                    title, cover, chapters, tags: { "作者": author, "類型": genres },
                    description: header.querySelector(".break-noraml")?.text.trim() || "", url: this.config.baseUrl + this.prefix + route,
                });
            });
        },
        loadEp: async (id, ep) => this.parse(await this.request(this.episodePath(id, ep)), doc => {
            if (doc.querySelector(".section_age_verif")) throw new Error("此章需要在原站完成分級確認。");
            const images = doc.querySelectorAll('div[id^="load_image_"] img').map(node => this.image(node.attributes["data-src"]));
            if (!images.length || images.some(url => !url)) throw new Error("原站未開放此章的完整免費正文。");
            return { images };
        }),
        onImageLoad: (url, id, ep) => ({
            url, headers: { Referer: this.config.baseUrl + this.prefix + this.episodePath(id, ep), "User-Agent": this.desktopAgent },
        }),
        onThumbnailLoad: url => ({
            url, headers: { Referer: this.config.baseUrl + "/tc/", "User-Agent": this.desktopAgent },
        }),
    };
}
