// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/manben
class ManbenSource extends ComicSource {
    config = {"name":"漫本","baseUrl":"https://www.manben.com","key":"manben","version":"1.0.1","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/manben.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;
    userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
    genres = { "搞笑": "37", "奇幻": "14", "热血": "31", "悬疑": "17", "格斗": "28", "科幻": "25",
        "励志": "10", "校园": "1", "爱情": "26", "日常": "7", "战争": "12", "其他": "3" };

    async request(path, referer = "/", fields) {
        const headers = {
            "User-Agent": this.userAgent, Referer: this.config.baseUrl + referer, "cache-time": "no",
        };
        // The site's vertical reader returns the complete chapter image list in its HTML.
        if (/^\/m\d+\/$/.test(path)) headers.cookie = "showtype=2";
        let response;
        if (fields) {
            headers["X-Requested-With"] = "XMLHttpRequest";
            headers["Content-Type"] = "application/x-www-form-urlencoded";
            const body = Object.entries(fields).map(([key, value]) => key + "=" + encodeURIComponent(value)).join("&");
            response = await Network.post(this.config.baseUrl + path, headers, body);
        } else {
            response = await Network.get(this.config.baseUrl + path, headers);
        }
        if (!response || response.error) throw new Error("漫本连接失败。");
        if (response.status !== 200) throw new Error("漫本返回 HTTP " + response.status);
        if (typeof response.body !== "string" || !response.body.trim()) throw new Error("漫本返回空内容。");
        return response.body;
    }

    parse(html, callback) {
        const doc = new HtmlDocument(html);
        try { return callback(doc); }
        finally { doc.dispose(); }
    }

    image(value) {
        if (typeof value !== "string" || !/^(?:https?:)?\/\/(?:[a-z0-9-]+\.)+cdndm5\.com\/[^\s"']+$/i.test(value)) return "";
        return value.startsWith("//") ? "https:" + value : value.replace(/^http:/i, "https:");
    }

    async list(page, path, referer, fields) {
        const rows = JSON.parse(await this.request(path, referer, { ...fields, pageindex: page }));
        if (!Array.isArray(rows)) throw new Error("漫本作品列表格式已变化。");
        const comics = new Map();
        for (const row of rows) {
            const id = String(row.Url || "").match(/^\/mh-([a-z0-9-]{1,180})\/$/i)?.[1];
            if (!id || !row.Title || comics.has(id)) continue;
            comics.set(id, new Comic({
                id, title: row.Title, cover: this.image(row.Pic || row.BigPic),
                subtitle: row.LastUpdateInfo || row.LastPartShowName,
            }));
        }
        return { comics: [...comics.values()], maxPage: comics.size && rows.length >= 10 ? page + 1 : page };
    }

    catalogue(page, sort, genre = "0") {
        return this.list(page, "/mh-list/pagerdata.ashx", "/mh-list/", {
            t: "2", sc: "1", tsort: sort, tagid: genre, tst: "0", tarea: "0", tgroup: "0", tnm: "",
        });
    }

    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.catalogue(page, "4") },
        { title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.catalogue(page, "2") },
    ];
    category = { title: this.name, parts: [{
        name: "漫画题材", type: "fixed", itemType: "category",
        categories: Object.keys(this.genres), categoryParams: Object.values(this.genres),
    }] };
    categoryComics = { load: (_label, tag, _options, page) => {
        if (!Object.values(this.genres).includes(tag)) throw new Error("题材无效。");
        return this.catalogue(page, "2", tag);
    } };
    search = { load: (keyword, _options, page) => {
        const query = String(keyword || "").trim();
        return query ? this.list(page, "/pagerdata.ashx", "/search/", { t: "7", title: query, f: "0" }) : this.catalogue(page, "4");
    } };

    seriesPath(id) {
        if (!/^[a-z0-9-]{1,180}$/i.test(String(id || ""))) throw new Error("作品编号无效。");
        return "/mh-" + id + "/";
    }

    chapterPath(episode) {
        const id = String(episode || "").match(/^ep_(\d{1,14})$/)?.[1];
        if (!id) throw new Error("章节编号无效。");
        return "/m" + id + "/";
    }

    chapters(doc) {
        const chapters = {};
        const groups = doc.querySelectorAll("#chapterlistload > .list, div.chapter.swiper-slide ul.chapterList");
        const newestFirst = !doc.querySelector("#chapterList .sortOld");
        for (const group of groups) {
            const links = group.querySelectorAll("a[href]");
            if (newestFirst) links.reverse();
            for (const link of links) {
                const id = link.attributes.href?.match(/^\/m(\d{1,14})\/$/)?.[1];
                const title = link.text.replace(/\s+/g, " ").trim();
                if (id && title && !Object.hasOwn(chapters, "ep_" + id)) chapters["ep_" + id] = title;
            }
        }
        return chapters;
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

    images(html) {
        for (const match of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)) {
            if (!match[1].includes("newImgs")) continue;
            const literal = this.unpack(match[1]).match(/\bnewImgs\s*=\s*\[([^\]]*)\]\s*;/)?.[1];
            if (!literal) continue;
            const urls = [...literal.matchAll(/(['"])((?:https?:)?\/\/[^'"\s]+)\1/g)];
            if (urls.length && !literal.replace(/(['"])((?:https?:)?\/\/[^'"\s]+)\1/g, "").replace(/[\s,]/g, "")) {
                const images = urls.map(match => this.image(match[2]));
                if (images.every(Boolean)) return images;
            }
        }
        return [];
    }

    comic = {
        loadInfo: async id => {
            const path = this.seriesPath(id);
            return this.parse(await this.request(path), doc => {
                const details = doc.querySelector(".mainForm .comicInfo, .detailTop");
                const cover = details?.querySelector(".cover img, img.cover")?.attributes;
                const titleNode = details?.querySelector("p.title");
                const rating = titleNode?.querySelector(".grading")?.text;
                const title = cover?.alt?.trim() || (rating ? titleNode.text.replace(rating, "") : titleNode?.text)?.trim();
                if (!title) throw new Error("漫本未返回作品详情。");
                const chapters = this.chapters(doc);
                if (!Object.keys(chapters).length) {
                    throw new Error(doc.querySelector(".banForm p")?.text.trim() || "漫本未公开此作品的章节。");
                }
                const author = details.querySelectorAll(".avatar, p.subtitle a").map(node => node.text.trim()).filter(Boolean);
                const type = details.querySelectorAll("p.gray > span, p.subtitle")
                    .map(node => node.text.trim()).find(text => /^类\s*(?:别|型)\s*[：:]/.test(text));
                const genres = (type || "").replace(/^类\s*(?:别|型)\s*[：:]\s*/, "").split("/").map(x => x.trim()).filter(Boolean);
                return new ComicDetails({
                    title, cover: this.image(cover?.src), chapters, tags: { "作者": author, "题材": genres },
                    description: details.querySelector("p.content")?.text.trim() || doc.querySelector(".detailContent > p")?.text.trim() || "",
                    url: this.config.baseUrl + path,
                });
            });
        },
        loadEp: async (id, episode) => {
            const path = this.chapterPath(episode);
            const html = await this.request(path, this.seriesPath(id));
            const restriction = this.parse(html, doc => doc.querySelector(".banForm p, .chapterBan")?.text.trim()
                || doc.querySelectorAll("body p").map(node => node.text.trim()).find(text =>
                    /进行屏蔽处理|章节已下架|请(?:先)?登录后阅读|仅限会员阅读/.test(text)));
            if (restriction) throw new Error(restriction);
            const images = this.images(html);
            if (!images.length) throw new Error("漫本未返回此章的公开图片，可打开原站章节查看。");
            return { images };
        },
        onThumbnailLoad: url => ({ url, headers: { Referer: this.config.baseUrl + "/" } }),
        onImageLoad: (url, _id, episode) => ({ url, headers: { Referer: this.config.baseUrl + this.chapterPath(episode) } }),
    };
}
