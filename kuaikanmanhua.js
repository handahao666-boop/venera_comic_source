// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/kuaikanmanhua
// Parse the literal Nuxt payload, including its deduplicated values, without executing page scripts.
const KuaikanPayload = class {
    constructor(source, values = Object.create(null)) {
        this.source = source;
        this.values = values;
        this.tokens = /\s*("(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:e[+-]?\d+)?|[A-Za-z_$][\w$]*|[{}\[\]().,;:=!])/iy;
        this.position = 0;
        this.next = this.scan();
    }

    scan() {
        while (/\s/.test(this.source[this.position] || "")) this.position++;
        if (this.position >= this.source.length) return "";
        this.tokens.lastIndex = this.position;
        const match = this.tokens.exec(this.source);
        if (!match) throw new Error("快看漫画网页数据包含未知格式。");
        this.position = this.tokens.lastIndex;
        return match[1];
    }

    take(expected) {
        const token = this.next;
        if (!token || (expected && token !== expected)) throw new Error("快看漫画网页数据格式已变化。");
        this.next = this.scan();
        return token;
    }

    accept(token) {
        if (this.next !== token) return false;
        this.take();
        return true;
    }

    value(depth = 0) {
        if (depth > 90) throw new Error("快看漫画网页数据层级异常。");
        const token = this.take();
        if (token === "{" || token === "[") {
            const object = token === "{";
            const end = object ? "}" : "]";
            const value = object ? Object.create(null) : [];
            if (this.accept(end)) return value;
            do {
                if (object) {
                    const key = this.take();
                    this.take(":");
                    value[key.startsWith('"') ? JSON.parse(key) : key] = this.value(depth + 1);
                } else {
                    value.push(this.value(depth + 1));
                }
            } while (this.accept(",") && this.next !== end);
            this.take(end);
            return value;
        }
        if (token.startsWith('"')) return JSON.parse(token);
        if (/^-?\d/.test(token)) return Number(token);
        if (token === "true") return true;
        if (token === "false") return false;
        if (token === "null") return null;
        if (token === "undefined") return undefined;
        if (token === "void") { this.take("0"); return undefined; }
        if (token === "!") return !this.value(depth + 1);
        if (token === "Array") {
            this.take("(");
            const size = Number(this.take());
            this.take(")");
            if (!Number.isSafeInteger(size) || size < 0 || size > 10000) throw new Error("快看漫画网页数组长度异常。");
            return new Array(size);
        }
        if (Object.hasOwn(this.values, token)) return this.values[token];
        throw new Error("快看漫画网页数据引用无效。");
    }

    readBody() {
        while (this.next && this.next !== "return") {
            const target = this.values[this.take()];
            let key;
            if (this.accept("[")) {
                key = this.take();
                this.take("]");
                if (!Array.isArray(target) || !/^\d{1,4}$/.test(key) || Number(key) >= target.length) {
                    throw new Error("快看漫画网页数组引用无效。");
                }
            } else {
                this.take(".");
                key = this.take();
                if (!target || Object.getPrototypeOf(target) !== null || !/^[\w$]+$/.test(key)) {
                    throw new Error("快看漫画网页对象引用无效。");
                }
            }
            this.take("=");
            target[key] = this.value();
            this.take(";");
        }
        this.take("return");
        return this.value();
    }

    static read(html) {
        const raw = html.match(/<script\b[^>]*>\s*(window\.__NUXT__=[\s\S]*?)<\/script>/i)?.[1]?.trim();
        if (!raw) throw new Error("快看漫画未返回公开网页数据。");
        const prefix = raw.match(/^window\.__NUXT__=\(function\(([^)]*)\)\{/);
        const end = raw.lastIndexOf("}(");
        if (!prefix || end < prefix[0].length || !/\)\);?$/.test(raw)) throw new Error("快看漫画网页数据结构已变化。");
        const args = raw.slice(end + 2).replace(/\)\);?$/, "");
        const values = new KuaikanPayload("[" + args + "]").value();
        const names = prefix[1] ? prefix[1].split(",") : [];
        if (names.length !== values.length) throw new Error("快看漫画网页数据参数不匹配。");
        const variables = Object.create(null);
        names.forEach((name, index) => { variables[name] = values[index]; });
        const result = new KuaikanPayload(raw.slice(prefix[0].length, end), variables).readBody();
        return result?.data?.[0];
    }
};

class KuaikanSource extends ComicSource {
    config = {"name":"快看漫画","baseUrl":"https://www.kuaikanmanhua.com","api":"https://api.kkmh.com","key":"kuaikanmanhua","version":"1.0.0","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/kuaikanmanhua.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;

    async get(url) {
        const response = await Network.get(url, { Referer: this.config.baseUrl + "/", "cache-time": "no" });
        if (!response || response.error) throw new Error("快看漫画连接失败。");
        if (response.status !== 200) throw new Error("快看漫画返回 HTTP " + response.status);
        return response.body;
    }

    image(url) {
        return typeof url === "string" && /^https:\/\/[a-z0-9.-]+\/[^\s]+$/i.test(url) ? url : "";
    }

    id(value) {
        if (!/^\d{1,15}$/.test(String(value || ""))) throw new Error("编号无效。");
        return String(value);
    }

    cards(rows) {
        if (!Array.isArray(rows)) throw new Error("快看漫画列表格式已变化。");
        const comics = new Map();
        for (const row of rows) {
            if (!row?.id || !row.title) continue;
            const id = this.id(row.id);
            comics.set(id, new Comic({ id, title: row.title, cover: this.image(row.verticalImageUrl || row.vertical_image_url) }));
        }
        return [...comics.values()];
    }

    async list(page, sort, genre = "0") {
        const html = await this.get(this.config.baseUrl + "/tag/" + genre + "?region=1&pays=0&state=0&sort=" + sort + "&page=" + page);
        const comics = this.cards(KuaikanPayload.read(html)?.dataList);
        const doc = new HtmlDocument(html);
        try {
            const next = doc.querySelectorAll("ul.pagination li a")
                .some(link => link.text.trim() === String(page + 1) || Number(link.attributes.href?.match(/[?&]page=(\d+)/)?.[1]) === page + 1);
            return { comics, maxPage: next && comics.length ? page + 1 : page };
        } finally { doc.dispose(); }
    }

    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.list(page, 2) },
        { title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.list(page, 3) },
    ];

    genres = { "恋爱": "20", "古风": "46", "校园": "74", "悬疑": "65", "奇幻": "22", "热血": "67", "剧情": "23", "搞笑": "71" };
    category = { title: this.name, parts: [{
        name: "题材", type: "fixed", itemType: "category", categories: Object.keys(this.genres), categoryParams: Object.values(this.genres),
    }] };
    categoryComics = { load: (_category, genre, _options, page) => {
        if (!Object.values(this.genres).includes(genre)) throw new Error("分类无效。");
        return this.list(page, 3, genre);
    } };

    search = { load: async (keyword, _options, page) => {
        const query = String(keyword || "").trim();
        if (!query) return this.list(page, 2);
        const offset = (page - 1) * 20;
        const data = JSON.parse(await this.get(this.config.api + "/v1/search/topic?q=" + encodeURIComponent(query) + "&since=" + offset + "&size=20"));
        const rows = data.data?.hit || [];
        return { comics: this.cards(rows), maxPage: rows.length >= 20 ? page + 1 : page };
    } };

    chapterId(ep) { return this.id(String(ep || "").match(/^ep_(\d{1,15})$/)?.[1]); }

    comic = {
        loadInfo: async rawId => {
            const id = this.id(rawId);
            const url = this.config.baseUrl + "/web/topic/" + id + "/";
            const data = KuaikanPayload.read(await this.get(url));
            const row = data?.topicInfo || data?.res?.data?.topic_info;
            const list = data?.comics || data?.comicList || row?.comics || data?.res?.data?.topic_info?.comics;
            if (!row?.title || !Array.isArray(list)) throw new Error("快看漫画详情格式已变化。");
            const chapters = {};
            for (const item of list) {
                if (!item.id || !item.title) continue;
                const locked = item.locked || item.need_vip || item.needVip || item.is_pay_comic || item.isPayComic;
                chapters["ep_" + this.id(item.id)] = (locked ? "🔒 " : "") + item.title;
            }
            if (!Object.keys(chapters).length) throw new Error("原站暂未列出章节。");
            const author = row.user?.nickname;
            return new ComicDetails({
                title: row.title, cover: this.image(row.verticalImageUrl || row.vertical_image_url),
                description: row.description || "", tags: author ? { "作者": [author] } : {}, chapters, url,
            });
        },
        loadEp: async (_rawId, ep) => {
            const id = this.chapterId(ep);
            const data = KuaikanPayload.read(await this.get(this.config.baseUrl + "/webs/comic-next/" + id));
            const access = data?.comicInfo;
            const row = data?.res?.data?.comicInfo || data?.res?.data?.comic_info;
            if (!access || !row || [access, row].some(value =>
                value.locked || value.need_vip || value.needVip || value.is_pay_comic || value.isPayComic)) {
                throw new Error("原站未开放此章的公开正文。");
            }
            const images = (row.comicImages || row.comic_images)?.map(image => this.image(image.url1280 || image.url));
            if (!images?.length || images.some(url => !url)) throw new Error("原站未返回完整的公开正文。");
            return { images };
        },
        onImageLoad: (url, _id, ep) => ({ url, headers: { Referer: this.config.baseUrl + "/webs/comic-next/" + this.chapterId(ep) } }),
    };
}
