/**
 * Mangabz — 1.0.0，2026-10-13。
 * 每次加载首页、列表、搜索、目录和章节均重新请求原站；无跨加载内容缓存。
 * 全量读取隐藏目录及站点正序目录接口；图片使用本次阅读页签名和真实图片接口。
 * 图片接口按页校验，最多4请求并发；失败明确报错，不返回部分目录/正文。
 * 不执行远程脚本，不猜图，不修改账号权限。
 */
class Mangabz extends ComicSource {
    name = "Mangabz";
    key = "mangabz";
    version = "1.0.0";
    minAppVersion = "1.6.3";
    url = "https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/mangabz.js";
    HOST = "https://www.mangabz.com";
    UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    headers(referer, ajax) {
        const headers = { "User-Agent": this.UA, "Referer": referer || this.HOST + "/", "cache-time": "no" };
        if (ajax) headers["X-Requested-With"] = "XMLHttpRequest";
        return headers;
    }
    async get(path, referer, ajax) {
        const response = await Network.get(this.HOST + path, this.headers(referer, ajax));
        if (response.status === 401 || response.status === 403) throw new Error("原站拒绝访问，请检查网络或在原站完成验证（HTTP " + response.status + "）");
        if (response.status !== 200) throw new Error("原站请求失败：HTTP " + response.status);
        if (typeof response.body !== "string" || !response.body.trim()) throw new Error("原站返回空响应，请重试");
        return response.body;
    }
    requirePage(body) {
        if (!/<\/html\s*>/i.test(body)) throw new Error("网页不完整或需要原站验证，请重试");
    }
    absolute(value) {
        const url = String(value || "").trim();
        if (/^https?:\/\//i.test(url)) return url;
        if (url.indexOf("//") === 0) return "https:" + url;
        if (url.indexOf("/") === 0) return this.HOST + url;
        return "";
    }
    comicId(value) {
        const s = String(value === null || value === undefined ? "" : value).trim();
        const m = s.match(/(?:^|\/)\b(\d+)bz\/?(?:[?#].*)?$/);
        if (m) return m[1];
        if (/^\d+$/.test(s)) return s;
        throw new Error("无效漫画ID");
    }
    episodeId(value) {
        const s = String(value === null || value === undefined ? "" : value).trim();
        const m = s.match(/(?:^|\/)m(\d+)\/?(?:[?#].*)?$/);
        if (m) return m[1];
        if (/^\d+$/.test(s)) return s;
        throw new Error("无效章节ID");
    }
    cover(node) {
        if (!node) return "";
        return this.absolute(node.attributes["data-original"] || node.attributes["data-src"] || node.attributes.src);
    }
    text(node) { return node ? node.text.replace(/\s+/g, " ").trim() : ""; }
    card(node, home) {
        const title = node.querySelector(home ? ".index-manga-item-title a" : ".title a");
        if (!title) throw new Error("列表条目缺少标题，网站结构可能已变化");
        const id = this.comicId(title.attributes.href);
        const cover = this.cover(node.querySelector("img"));
        if (!cover) throw new Error("作品封面地址缺失：" + id);
        return new Comic({ id: id, title: this.text(title), cover: cover,
            subtitle: this.text(node.querySelector(home ? ".index-manga-item-subtitle" : ".chapter")), tags: [] });
    }
    list(doc) {
        const result = [], ids = new Set();
        for (const node of doc.querySelectorAll(".mh-item")) {
            const comic = this.card(node, false);
            if (!ids.has(comic.id)) { result.push(comic); ids.add(comic.id); }
        }
        return result;
    }
    maxPage(doc, current) {
        let max = current;
        const pager = doc.querySelector(".page-pagination");
        if (!pager) return max;
        for (const anchor of pager.querySelectorAll("a")) {
            if ((anchor.attributes.class || "").split(/\s+/).indexOf("active") >= 0 && /^\d+$/.test(this.text(anchor)) && Number(this.text(anchor)) !== current) {
                throw new Error("网站未返回请求的列表页，请重试");
            }
            const href = anchor.attributes.href || "";
            const m = href.match(/-p(\d+)\//) || href.match(/[?&]page=(\d+)/);
            const p = m ? Number(m[1]) : 1;
            if (Number.isSafeInteger(p)) max = Math.max(max, p);
        }
        // 站点分页导航只显示附近页码；后续页会继续发现新页码，不将10写死为总页数。
        return max;
    }
    async loadList(path, page, emptySearch) {
        const body = await this.get(path);
        this.requirePage(body);
        const doc = new HtmlDocument(body);
        try {
            const comics = this.list(doc);
            if (!comics.length && !(emptySearch && /相近搜索[\s\S]{0,30}[（(]\s*0\s*[）)]/.test(body))) {
                throw new Error("没有取得漫画列表，网站可能需要验证或已改变结构");
            }
            return { comics: comics, maxPage: this.maxPage(doc, page) };
        } finally { doc.dispose(); }
    }
    listPath(slug, page) {
        if (!/^manga-list(?:-\d+-\d+-\d+)?$/.test(slug)) throw new Error("无效分类参数");
        const p = Number(page);
        if (!Number.isSafeInteger(p) || p < 1) throw new Error("无效页码");
        return "/" + slug + (p === 1 ? "" : "-p" + p) + "/";
    }
    explore = [{
        title: "Mangabz", type: "multiPartPage",
        load: async () => {
            const body = await this.get("/");
            this.requirePage(body);
            const doc = new HtmlDocument(body), parts = [];
            try {
                for (const block of doc.querySelectorAll(".index-block")) {
                    const title = this.text(block.querySelector(".list-con-title")).split(" ")[0];
                    if (title !== "人氣推薦" && title !== "人气推荐" && title !== "編輯推薦" && title !== "编辑推荐") continue;
                    const comics = block.querySelectorAll(".index-manga-item").map(node => this.card(node, true));
                    if (comics.length) parts.push({ title: title, comics: comics, viewMore: "category:人气排行@manga-list" });
                }
                if (!parts.length) throw new Error("首页推荐区域缺失，请重试或检查原站");
            } finally { doc.dispose(); }
            const updates = await this.loadList("/manga-list-0-0-2/", 1, false);
            parts.unshift({ title: "最近更新", comics: updates.comics, viewMore: "category:最近更新@manga-list-0-0-2" });
            return parts;
        }
    }];
    category = {
        title: "Mangabz", enableRankingPage: false,
        parts: [
            { name: "更新与状态", type: "fixed", itemType: "category",
              categories: ["最近更新", "人气排行", "连载中", "已完结"],
              categoryParams: ["manga-list-0-0-2", "manga-list", "manga-list-0-1-10", "manga-list-0-2-10"] },
            { name: "题材", type: "fixed", itemType: "category",
              categories: ["热血", "恋爱", "校园", "冒险", "科幻", "生活", "悬疑", "魔法", "运动"],
              categoryParams: ["manga-list-31-0-10", "manga-list-26-0-10", "manga-list-1-0-10", "manga-list-2-0-10", "manga-list-25-0-10", "manga-list-11-0-10", "manga-list-17-0-10", "manga-list-15-0-10", "manga-list-34-0-10"] }
        ]
    };
    categoryComics = {
        load: async (category, param, options, page) => this.loadList(this.listPath(param, page), Number(page), false)
    };
    search = {
        load: async (keyword, options, page) => {
            const p = Number(page);
            if (!Number.isSafeInteger(p) || p < 1) throw new Error("无效页码");
            const key = String(keyword || "").trim();
            if (!key) throw new Error("请输入搜索关键词");
            return this.loadList("/search?title=" + encodeURIComponent(key) + "&page=" + p, p, true);
        }
    };

    chapters(doc) {
        const chapters = new Map();
        for (const node of doc.querySelectorAll(".detail-list-form-item[href]")) {
            const id = this.episodeId(node.attributes.href);
            const title = this.text(node).replace(/\s*[（(]\d+\s*P[）)]\s*$/i, "");
            if (!title) throw new Error("章节标题缺失：" + id);
            if (!chapters.has(id)) chapters.set(id, title);
        }
        return chapters;
    }
    async loadInfo(value) {
        const id = this.comicId(value), path = "/" + id + "bz/", body = await this.get(path);
        this.requirePage(body);
        const doc = new HtmlDocument(body);
        try {
            const title = this.text(doc.querySelector(".detail-info-title"));
            const cover = this.cover(doc.querySelector(".detail-info-cover"));
            if (!title || !cover || !doc.querySelector(".detail-list-form-con")) throw new Error("漫画详情缺失或需要原站验证");
            const initial = this.chapters(doc);
            const directory = await this.get("/template-" + id + "-s1/", this.HOST + path, true);
            const chapterDoc = new HtmlDocument(directory);
            let chapters;
            try {
                chapters = this.chapters(chapterDoc);
                if (!chapters.size) throw new Error("完整章节目录为空，请重试");
                for (const chapterId of initial.keys()) {
                    if (!chapters.has(chapterId)) throw new Error("完整目录缺少章节 " + chapterId + "，请重试");
                }
                const stated = this.text(doc.querySelector(".detail-list-form-title")).match(/共\s*(\d+)\s*章/);
                if (stated && Number(stated[1]) > chapters.size) throw new Error("章节目录数量不足，请重试");
            } finally { chapterDoc.dispose(); }
            const tags = {}, metadata = doc.querySelector(".detail-info-tip");
            if (metadata) {
                for (const item of metadata.querySelectorAll(".item")) {
                    const text = this.text(item), split = text.indexOf("：");
                    if (split >= 0) tags[text.substring(0, split)] = [text.substring(split + 1).trim()];
                }
            }
            const full = doc.querySelector(".detail-info-content-2") || doc.querySelector(".detail-info-content");
            const heading = this.text(doc.querySelector(".detail-list-form-title"));
            const update = heading.match(/\d{4}-\d{2}-\d{2}|\d+\s*(?:分鐘|分钟|小時|小时|天)前/);
            return new ComicDetails({ title: title, subtitle: (tags["作者"] || []).join(" "), cover: cover,
                description: this.text(full).replace(/\[[-+]?(?:展開|展开|折疊|折叠)\]/g, ""), tags: tags,
                chapters: chapters, isFavorite: false, subId: id, thumbnails: [cover], recommend: [],
                updateTime: update ? update[0] : "", url: this.HOST + path });
        } finally { doc.dispose(); }
    }

    // 只解码字符串与已取证的P.A.C.K.E.R数据，不eval网站返回的函数。
    quoted(code, start) {
        const quote = code[start];
        if (quote !== "'" && quote !== '"') throw new Error("图片接口字符串格式变化");
        let result = "";
        for (let i = start + 1; i < code.length; i++) {
            const char = code[i];
            if (char === quote) return { value: result, end: i + 1 };
            if (char !== "\\") { result += char; continue; }
            const next = code[++i], escapes = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", "0": "\0" };
            if (next === "u" || next === "x") {
                const size = next === "u" ? 4 : 2, hex = code.substring(i + 1, i + 1 + size);
                if (!new RegExp("^[0-9a-f]{" + size + "}$", "i").test(hex)) throw new Error("图片接口转义不完整");
                result += String.fromCharCode(parseInt(hex, 16)); i += size;
            } else if (next === "\n") { /* 续行 */ }
            else if (next === "\r") { if (code[i + 1] === "\n") i++; }
            else result += Object.prototype.hasOwnProperty.call(escapes, next) ? escapes[next] : next;
        }
        throw new Error("图片接口字符串被截断");
    }
    unpack(code) {
        if (!/eval\s*\(\s*function\s*\(p,a,c,k,e,d\)/.test(code)) return code;
        const marker = /return\s+p\s*;?\s*}\s*\(\s*/.exec(code);
        if (!marker) throw new Error("无法解析图片接口封装");
        const payload = this.quoted(code, marker.index + marker[0].length);
        const numbers = /^\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*/.exec(code.substring(payload.end));
        if (!numbers) throw new Error("图片接口字典格式变化");
        const base = Number(numbers[1]), count = Number(numbers[2]);
        if (base < 2 || base > 62 || !Number.isSafeInteger(count) || count < 1 || count > code.length) throw new Error("图片接口字典无效");
        const dictionary = this.quoted(code, payload.end + numbers[0].length).value.split("|");
        if (dictionary.length < count) throw new Error("图片接口字典被截断");
        const words = Object.create(null);
        for (let n = 0; n < count; n++) {
            let value = n, word = "";
            do { const digit = value % base; word = (digit > 35 ? String.fromCharCode(digit + 29) : digit.toString(36)) + word; value = Math.floor(value / base); } while (value > 0);
            if (dictionary[n]) words[word] = dictionary[n];
        }
        return payload.value.replace(/\b\w+\b/g, word => words[word] || word);
    }
    variable(code, name) {
        const match = new RegExp("\\bvar\\s+" + name + "\\s*=\\s*").exec(code);
        if (!match) throw new Error("阅读页缺少 " + name + "，可能需要原站登录或验证");
        const start = match.index + match[0].length;
        if (code[start] === "'" || code[start] === '"') return this.quoted(code, start).value;
        const number = /^\d+/.exec(code.substring(start));
        if (!number) throw new Error("阅读页变量格式变化：" + name);
        return number[0];
    }
    imageData(body, cid) {
        const code = this.unpack(body);
        if (this.variable(code, "cid") !== cid) throw new Error("图片接口返回了其他章节");
        const prefix = this.variable(code, "pix"), match = /\bvar\s+pvalue\s*=\s*\[\s*/.exec(code);
        if (!match || !/^https?:\/\//i.test(prefix)) throw new Error("图片接口缺少地址数组");
        const paths = []; let position = match.index + match[0].length;
        while (code[position] !== "]") {
            const item = this.quoted(code, position); paths.push(item.value); position = item.end;
            const separator = /^\s*,?\s*/.exec(code.substring(position)); position += separator[0].length;
            if (position >= code.length) throw new Error("图片地址数组被截断");
        }
        const suffix = /pvalue\[i\]\s*=\s*pix\s*\+\s*pvalue\[i\]\s*\+\s*/.exec(code);
        if (!suffix) throw new Error("图片签名拼接格式变化");
        const query = this.quoted(code, suffix.index + suffix[0].length).value;
        if (!paths.length || paths.length > 2 || !/^\?cid=/.test(query)) throw new Error("图片接口响应不完整");
        return paths.map(path => prefix + path + query);
    }
    async loadEp(comicValue, episodeValue) {
        const mid = this.comicId(comicValue), cid = this.episodeId(episodeValue), pageUrl = this.HOST + "/m" + cid + "/";
        const body = await this.get("/m" + cid + "/", this.HOST + "/" + mid + "bz/");
        this.requirePage(body);
        if (this.variable(body, "MANGABZ_MID") !== mid || this.variable(body, "MANGABZ_CID") !== cid) throw new Error("阅读页漫画/章节ID不一致");
        const count = Number(this.variable(body, "MANGABZ_IMAGE_COUNT"));
        if (!Number.isSafeInteger(count) || count < 1) throw new Error("原站没有提供可阅读图片");
        const sign = this.variable(body, "MANGABZ_VIEWSIGN"), dt = this.variable(body, "MANGABZ_VIEWSIGN_DT");
        if (!sign || !dt) throw new Error("阅读签名缺失，请重试或在原站检查阅读权限");
        const images = new Array(count);
        for (let page = 1; page <= count;) {
            const requests = [];
            // 接口返回当前页和下一页预加载地址；仅使用实际返回值，不猜文件名。
            while (requests.length < 4 && page <= count) { requests.push(page); page += 2; }
            const results = await Promise.all(requests.map(async p => {
                try {
                    const query = "cid=" + cid + "&page=" + p + "&key=&_cid=" + cid + "&_mid=" + mid
                        + "&_dt=" + encodeURIComponent(dt) + "&_sign=" + encodeURIComponent(sign);
                    const response = await this.get("/m" + cid + "/chapterimage.ashx?" + query, pageUrl, true);
                    return { page: p, images: this.imageData(response, cid) };
                } catch (error) { return { page: p, error: error }; }
            }));
            for (const result of results) {
                if (result.error) throw new Error("第" + result.page + "页图片获取失败：" + String(result.error));
                for (let i = 0; i < result.images.length && result.page + i <= count; i++) images[result.page + i - 1] = result.images[i];
                if (result.images.length < 2 && result.page < count) {
                    // 若站点只给当前页，单独读取缺失页，不能将缺页视为正常结尾。
                    const next = result.page + 1;
                    const query = "cid=" + cid + "&page=" + next + "&key=&_cid=" + cid + "&_mid=" + mid
                        + "&_dt=" + encodeURIComponent(dt) + "&_sign=" + encodeURIComponent(sign);
                    const response = await this.get("/m" + cid + "/chapterimage.ashx?" + query, pageUrl, true);
                    images[next - 1] = this.imageData(response, cid)[0];
                }
            }
        }
        for (let p = 0; p < count; p++) if (!images[p] || !/^https?:\/\//i.test(images[p])) throw new Error("第" + (p + 1) + "页图片缺失，拒绝返回不完整章节");
        return { images: images };
    }
    comic = {
        loadInfo: async id => this.loadInfo(id),
        loadEp: async (comicId, episodeId) => this.loadEp(comicId, episodeId),
        onImageLoad: (url, comicId, episodeId) => ({ headers: this.headers(this.HOST + "/m" + this.episodeId(episodeId) + "/", false) }),
        onThumbnailLoad: url => ({ headers: this.headers(this.HOST + "/", false) })
    };
}
