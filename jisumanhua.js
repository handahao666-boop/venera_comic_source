// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/jisumanhua
class JisuManhuaSource extends ComicSource {
    config = {"name":"极速漫画","baseUrl":"https://www.1kkk.com","key":"jisumanhua","version":"1.0.0","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/jisumanhua.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;
    desktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    readers = new Map();

    async get(route, referer = this.config.baseUrl + "/") {
        const response = await Network.get(this.config.baseUrl + route, {
            Referer: referer, "User-Agent": this.desktop, "cache-time": "no",
        });
        if (!response || response.error) throw new Error("极速漫画连接失败。");
        if (response.status !== 200) throw new Error("极速漫画返回 HTTP " + response.status);
        if (typeof response.body !== "string" || !response.body.trim()) throw new Error("极速漫画返回空页面。");
        return response.body;
    }

    parse(html, callback) {
        const doc = new HtmlDocument(html);
        try { return callback(doc); }
        finally { doc.dispose(); }
    }

    image(value) {
        if (typeof value !== "string") return "";
        if (/^https:\/\/[a-z0-9.-]+\/[^\s]+$/i.test(value)) return value;
        if (/^http:\/\/[a-z0-9.-]+\/[^\s]+$/i.test(value)) return "https:" + value.slice(5);
        if (/^\/\/[a-z0-9.-]+\/[^\s]+$/i.test(value)) return "https:" + value;
        return /^\/(?!\/)[^\s]+$/.test(value) ? this.config.baseUrl + value : "";
    }

    async list(route, page, search = false) {
        return this.parse(await this.get(route), doc => {
            const comics = new Map();
            const cards = doc.querySelectorAll(search ? "ul.mh-list > li, .banner_detail_form" : "ul.mh-list > li > div.mh-item");
            for (const card of cards) {
                const link = card.querySelector(".title > a");
                const id = link?.attributes.href?.match(/\/manhua([a-z0-9-]+)\/$/i)?.[1];
                if (!id || comics.has(id)) continue;
                const css = card.querySelector("p.mh-cover")?.attributes.style;
                const image = card.querySelector("img")?.attributes;
                comics.set(id, new Comic({
                    id, title: (link.attributes.title || link.text).trim(),
                    cover: this.image(css?.match(/url\(['"]?([^)'"]+)['"]?\)/i)?.[1] || image?.["data-src"] || image?.src),
                    subtitle: card.querySelector("p.chapter a")?.text.trim(),
                }));
            }
            if (!comics.size && !search) throw new Error("极速漫画未返回作品列表。");
            const next = doc.querySelectorAll(".page-pagination a, .pager-list a, .pagination a")
                .some(link => link.text.trim() === String(page + 1));
            return { comics: [...comics.values()], maxPage: comics.size && next ? page + 1 : page };
        });
    }

    browse(filter, page) { return this.list("/manhua-list" + filter + "-p" + page + "/", page); }
    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.browse("", page) },
        { title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.browse("-s2", page) },
    ];
    filters = { "连载": "-st1", "完结": "-st2", "免费": "-pay0" };
    category = { title: this.name, parts: [{
        name: "漫画分类", type: "fixed", itemType: "category",
        categories: Object.keys(this.filters), categoryParams: Object.values(this.filters),
    }] };
    categoryComics = { load: (_label, filter, _options, page) => {
        if (!Object.values(this.filters).includes(filter)) throw new Error("分类无效。");
        return this.browse(filter, page);
    } };
    search = { load: (keyword, _options, page) => {
        const query = String(keyword || "").trim();
        return query ? this.list("/search?title=" + encodeURIComponent(query) + "&language=1&page=" + page, page, true) : this.browse("", page);
    } };

    seriesPath(id) {
        if (!/^[a-z0-9-]{1,160}$/i.test(id)) throw new Error("作品编号无效。");
        return "/manhua" + id + "/";
    }

    episodePath(ep) {
        const route = String(ep || "").match(/^ep_((?:ch|vol|other)[a-z0-9.-]{1,80})$/i)?.[1];
        if (!route) throw new Error("章节编号无效。");
        return "/" + route + "/";
    }

    async reader(route) {
        const html = await this.get(route);
        const images = this.parse(html, doc => {
            const restriction = doc.querySelector(".warning-bar, .view-pay-form p.subtitle");
            if (restriction) throw new Error(restriction.text.trim() || "请在原站确认章节阅读权限。");
            return doc.querySelectorAll("#barChapter > img.load-src")
                .map(node => this.image(node.attributes["data-src"] || node.attributes.src)).filter(Boolean);
        });
        if (images.length) return { images };

        const field = key => html.match(new RegExp("\\bvar\\s+DM5_" + key + '\\s*=\\s*["\']?([^"\';]+)'))?.[1].trim();
        const reader = {
            cid: field("CID"), mid: field("MID"), time: field("VIEWSIGN_DT"),
            sign: field("VIEWSIGN"), count: Number(field("IMAGE_COUNT")), received: Date.now(),
        };
        if (!/^\d+$/.test(reader.cid || "") || !/^\d+$/.test(reader.mid || "") || !reader.time || !reader.sign
            || !Number.isSafeInteger(reader.count) || reader.count < 1 || reader.count > 3000) {
            throw new Error("极速漫画未返回此章的公开阅读数据。");
        }
        this.readers.delete(route);
        this.readers.set(route, reader);
        if (this.readers.size > 6) this.readers.delete(this.readers.keys().next().value);
        return reader;
    }

    unpack(script) {
        const packed = script.match(/\}\(\s*'((?:\\.|[^'\\])*)',\s*(\d+),\s*\d+,\s*'((?:\\.|[^'\\])*)'\.split\('\|'\)/);
        if (!packed) return script;
        const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
        const radix = Number(packed[2]);
        const words = packed[3].split("|");
        return packed[1].replace(/\\([\\'"])/g, "$1").replace(/\b\w+\b/g, token => {
            let index = 0;
            for (const character of token) {
                const digit = alphabet.indexOf(character);
                if (digit < 0 || digit >= radix) return token;
                index = index * radix + digit;
                if (index >= words.length) return token;
            }
            return words[index] || token;
        });
    }

    async resolveImage(route, page) {
        let reader = this.readers.get(route);
        if (!reader || Date.now() - reader.received > 300000) reader = await this.reader(route);
        if (reader.images?.[page - 1]) return reader.images[page - 1];
        if (!(page >= 1 && page <= reader.count)) throw new Error("此页已不在原站的章节清单中。");

        const values = { cid: reader.cid, page, key: "", language: 1, gtk: 6, _cid: reader.cid,
            _mid: reader.mid, _dt: reader.time, _sign: reader.sign };
        const query = Object.entries(values).map(([key, value]) => key + "=" + encodeURIComponent(value)).join("&");
        const script = this.unpack(await this.get(route + "chapterfun.ashx?" + query, this.config.baseUrl + route));
        const base = script.match(/\bvar\s+pix\s*=\s*"([^"]+)"/)?.[1];
        const image = script.match(/\bvar\s+pvalue\s*=\s*\[\s*"([^"]+)"/)?.[1];
        const suffix = script.match(/\bpix\s*\+\s*pvalue\[i\]\s*\+\s*(['"])(\?[^'"]+)\1/)?.[2] || "";
        const url = this.image(/^https?:\/\//i.test(image || "") ? image : (base || "") + (image || "") + suffix);
        if (!base || !image || !/^https:\/\/(?:[a-z0-9-]+\.)+cdndm5\.com\//i.test(url)) {
            throw new Error("极速漫画未返回此页的公开图片。");
        }
        return url;
    }

    comic = {
        loadInfo: async id => {
            const route = this.seriesPath(id);
            return this.parse(await this.get(route), doc => {
                const warning = doc.querySelector(".warning-bar");
                if (warning) throw new Error(warning.text.trim() || "请在原站确认阅读权限。");
                const details = doc.querySelector(".banner_detail_form");
                const titleNode = details?.querySelector("p.title");
                const rating = titleNode?.querySelector(".right")?.text;
                const title = (rating ? titleNode.text.replace(rating, "") : titleNode?.text)?.trim();
                if (!title) throw new Error("极速漫画未返回作品详情。");
                const chapters = {};
                const lists = doc.querySelectorAll("#chapterlistload > ul");
                const descending = doc.querySelector(".detail-list-title a.order")?.text.trim() === "倒序";
                for (const list of lists) {
                    const links = list.querySelectorAll("li > a");
                    if (descending) links.reverse();
                    for (const link of links) {
                        const id = link.attributes.href?.match(/^\/((?:ch|vol|other)[a-z0-9.-]+)\/$/i)?.[1];
                        const text = (link.querySelector("p.title")?.text || link.text).trim().replace(/\s+/g, " ");
                        if (id && text) chapters["ep_" + id] = (link.querySelector(".detail-lock, .view-lock") ? "🔒 " : "") + text;
                    }
                }
                if (!Object.keys(chapters).length) throw new Error("极速漫画未返回章节目录。");
                const author = details.querySelectorAll("p.subtitle > a").map(node => node.text.trim()).filter(Boolean);
                const genre = details.querySelectorAll("p.tip a").map(node => node.text.trim()).filter(Boolean);
                return new ComicDetails({
                    title, cover: this.image(details.querySelector("img")?.attributes.src), chapters,
                    tags: { "作者": author, "题材": genre },
                    description: details.querySelector("p.content")?.text.trim() || "", url: this.config.baseUrl + route,
                });
            });
        },
        loadEp: async (_id, ep) => {
            const route = this.episodePath(ep);
            const reader = await this.reader(route);
            return { images: reader.images || Array.from({ length: reader.count }, (_, index) =>
                this.config.baseUrl + route + "?veneraPage=" + (index + 1)) };
        },
        onThumbnailLoad: url => ({ url, headers: { Referer: this.config.baseUrl + "/" } }),
        onImageLoad: async (url, _id, ep) => {
            const route = this.episodePath(ep);
            const referer = this.config.baseUrl + route;
            const page = url.startsWith(referer) && url.slice(referer.length).match(/^\?veneraPage=(\d+)$/)?.[1];
            return { url: page ? await this.resolveImage(route, Number(page)) : url, headers: { Referer: referer } };
        },
    };
}
