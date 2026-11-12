// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/comicabc
class ComicabcSource extends ComicSource {
    config = {"name":"無限動漫","baseUrl":"https://www.8comic.com","key":"comicabc","version":"1.0.0","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/comicabc.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;
    alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

    async get(route, referer = this.config.baseUrl + "/") {
        const response = await Network.get(this.config.baseUrl + route, { Referer: referer, "cache-time": "no" });
        if (!response || response.error) throw new Error("無限動漫連線失敗。");
        if (response.status !== 200) throw new Error("無限動漫返回 HTTP " + response.status);
        if (typeof response.body !== "string" || !response.body.trim()) throw new Error("無限動漫返回空頁面。");
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

    id(raw) {
        const value = String(raw || "");
        if (!/^\d{1,14}$/.test(value)) throw new Error("作品編號無效。");
        return value;
    }

    async list(route, page, allowEmpty = false) {
        return this.parse(await this.get(route), doc => {
            const comics = new Map();
            const cards = doc.querySelectorAll("article.cu-card, a.comicpic_col6, .cat2_list a");
            for (const card of cards) {
                const link = card.querySelector(".cu-title, a.cu-cover") || card;
                const id = link.attributes.href?.match(/\/html\/(\d{1,14})\.html$/)?.[1];
                const title = (link.attributes.title || card.querySelector("li.nowraphide")?.text || link.text).trim();
                const image = card.querySelector("img")?.attributes;
                if (id && title && !comics.has(id)) comics.set(id, new Comic({
                    id, title, cover: this.image(image?.["data-cc-src"] || image?.src),
                    subtitle: card.querySelector(".cu-range")?.text.trim(),
                }));
            }
            if (!allowEmpty && !comics.size) throw new Error("無限動漫未返回可讀作品列表。");
            const hasNext = doc.querySelector(".pager a .mdi-skip-next, .pager li[onclick] .mdi-skip-next, a[rel=next]")
                || doc.querySelectorAll(".pager li[onclick], .pager a").some(node => node.text.trim() === String(page + 1));
            return { comics: [...comics.values()], maxPage: comics.size && hasNext ? page + 1 : page };
        });
    }

    browse(group, page) { return this.list("/comic/" + group + "-" + page + ".html", page); }
    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.browse("h", page) },
        { title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.browse("u", page) },
    ];

    genres = { "武鬥": "24", "魔法": "3", "歷險": "67", "校園": "26", "生活": "45", "懸疑": "392", "爆笑": "48" };
    category = { title: this.name, parts: [{
        name: "漫畫類別", type: "fixed", itemType: "category", categories: Object.keys(this.genres), categoryParams: Object.values(this.genres),
    }] };
    categoryComics = { load: (_category, genre, _options, page) => {
        if (!Object.values(this.genres).includes(genre)) throw new Error("分類無效。");
        return this.browse(genre, page);
    } };
    search = { load: (keyword, _options, page) => {
        const query = String(keyword || "").trim();
        if (!query) return this.browse("h", page);
        return this.list("/member/search.aspx?key=" + encodeURIComponent(query) + "&page=" + page, page, true);
    } };

    chapters(doc, id) {
        const chapters = {};
        for (const node of doc.querySelectorAll("#chapters a, .comic_chapters a")) {
            const title = (node.querySelector("#lch")?.text || node.text).trim();
            if (!title || /登入觀看|付費|需要會員/.test(title)) continue;
            const code = node.attributes.onclick?.match(/cview\(\s*['"](\d{1,14})-(\d{1,8}[a-z]?)\.html['"]/i);
            const href = node.attributes.href?.match(/\/online\/new-(\d{1,14})\.html\?ch=(\d{1,8}[a-z]?)\b/i);
            const match = code || href;
            if (match?.[1] === id) chapters["ep_" + match[2]] = title;
        }
        if (!Object.keys(chapters).length) throw new Error("原站未提供公開章節目錄。");
        return chapters;
    }

    episodePath(id, ep) {
        const chapter = String(ep || "").match(/^ep_(\d{1,8}[a-z]?)$/i)?.[1];
        if (!chapter) throw new Error("章節編號無效。");
        return "/online/new-" + this.id(id) + ".html?ch=" + chapter;
    }

    code(value) {
        if (value.length !== 2) return Number(value);
        const first = this.alphabet.indexOf(value[0]);
        const last = this.alphabet.indexOf(value[1]);
        if (first < 0 || last < 0) return NaN;
        return value[0] === "Z" ? 8000 + last : first * 52 + last;
    }

    unpack(html, id, ep) {
        const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
            .map(match => match[1]).find(code => code.includes("comics-pics") && /\bvar chs\s*=/.test(code));
        const marker = script?.match(/([a-z_$][\w$]*)\.substring\(\1\.length-(\d+)-[a-z_$][\w$]*\*6/i);
        const count = Number(script?.match(/\bvar chs\s*=\s*(\d+)/)?.[1]);
        if (!marker || !Number.isSafeInteger(count) || count < 1 || script.match(/\bvar ti\s*=\s*(\d+)/)?.[1] !== id) {
            throw new Error("原站未返回此章的公開圖片資料。");
        }
        const packed = [...script.matchAll(/\bvar\s+([\w$]+)\s*=\s*'([a-z0-9]{80,})'/gi)]
            .find(match => match[1] === marker[1])?.[2];
        const tail = Number(marker[2]);
        if (!packed || count * 47 > packed.length - tail - 24) throw new Error("原站圖片資料格式已變化。");
        const tailWord = index => {
            const start = packed.length - tail - index * 6;
            const hex = packed.slice(start, start + 6);
            return /^[0-9a-f]{6}$/i.test(hex) ? String.fromCharCode(...hex.match(/../g).map(pair => parseInt(pair, 16))) : "";
        };
        const wanted = ep.slice(3).match(/^(\d+)([a-z]?)$/i);
        for (let index = 0; index < count; index++) {
            const row = packed.slice(index * 47, (index + 1) * 47);
            const chapter = this.code(row.slice(0, 2));
            const part = row[46] === "0" ? "" : row[46];
            if (chapter !== Number(wanted[1]) || (wanted[2] && part !== wanted[2])) continue;
            const pages = this.code(row.slice(2, 4));
            const server = String(this.code(row.slice(4, 6)));
            const host = tailWord(4) + server[0] + ".8" + tailWord(3) + tailWord(2) + tailWord(3);
            const ext = tailWord(1);
            if (!Number.isSafeInteger(pages) || pages < 1 || pages > 3000 || !/^\d{2,4}$/.test(server)
                || !/^[a-z0-9-]+\.8comic\.com$/i.test(host) || !/^(?:jpg|png|gif|web)$/i.test(ext)) {
                throw new Error("原站圖片伺服器格式已變化。");
            }
            const suffixes = row.slice(6, 46);
            return Array.from({ length: pages }, (_, index) => {
                const offset = Math.floor(index / 10) % 10 + index % 10 * 3;
                return "https://" + host + "/" + server[1] + "/" + id + "/" + chapter + part + "/"
                    + String(index + 1).padStart(3, "0") + "_" + suffixes.slice(offset, offset + 3) + "." + ext;
            });
        }
        throw new Error("原站圖片資料中沒有此章。");
    }

    comic = {
        loadInfo: async rawId => {
            const id = this.id(rawId);
            const path = "/html/" + id + ".html";
            return this.parse(await this.get(path), doc => {
                const title = doc.querySelector(".item_content_box .h2")?.text.trim();
                if (!title || /登入觀看/.test(title)) throw new Error("原站未返回公開作品詳情。");
                const attrs = doc.querySelector(".item-cover img")?.attributes;
                const author = doc.querySelector(".item-info-author")?.text.trim().replace(/^作者[:：]\s*/, "");
                return new ComicDetails({
                    title, cover: this.image(attrs?.["data-cc-src"] || attrs?.src), tags: author ? { "作者": [author] } : {},
                    description: doc.querySelector(".item_info_detail")?.text.trim() || "",
                    chapters: this.chapters(doc, id), url: this.config.baseUrl + path,
                });
            });
        },
        loadEp: async (rawId, ep) => {
            const id = this.id(rawId);
            const path = this.episodePath(id, ep);
            const html = await this.get(path, this.config.baseUrl + "/html/" + id + ".html");
            return { images: this.unpack(html, id, ep) };
        },
        onImageLoad: (url, id, ep) => ({ url, headers: { Referer: this.config.baseUrl + this.episodePath(id, ep) } }),
        onThumbnailLoad: url => ({ url, headers: { Referer: this.config.baseUrl + "/" } }),
    };
}
