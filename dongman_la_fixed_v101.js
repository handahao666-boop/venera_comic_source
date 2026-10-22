/**
 * 动漫啦（www.dongman.la）Venera 漫画源
 *
 * 真实取证结论：
 * 1. 首页、分类、搜索、详情和阅读页均为服务端 HTML。
 * 2. 兼容新站 .comic-card / h2 列表和旧版 .cy_list_mh；每次刷新重新请求。
 * 3. 搜索当前使用 /manhua/so/{关键词}/。
 * 4. 详情路由为 /manhua/detail/{comicId}/，章节路由为 /manhua/chapter/{comicId}/{chapterId}/。
 * 5. 阅读页图片为 img[src] 直链 JPEG，无 Base64、AES、XOR 或脚本加密。
 * 6. /all.html 为整话下拉阅读页，可一次解析完整章节图片。
 */
class DongManLa extends ComicSource {
    name = "动漫啦";
    key = "dongman_la";
    version = "1.0.5";
    minAppVersion = "1.0.0";
    url = "https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/dongman_la_fixed_v101.js";

    baseUrl = "https://www.dongman.la";
    imageBaseUrl = "https://img.dongman.la";

    defaultHeaders = {
        "User-Agent": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Referer": "https://www.dongman.la/"
    };

    absoluteUrl(path, base = this.baseUrl) {
        let value = String(path || "").trim();
        if (!value) return "";
        if (value.startsWith("//")) return "https:" + value;
        if (/^https?:\/\//i.test(value)) return value;
        if (value.startsWith("/")) return base + value;
        return base + "/" + value;
    }

    parsePageNumber(value, fallback = 1) {
        const number = parseInt(String(value || ""), 10);
        return Number.isFinite(number) && number > 0 ? number : fallback;
    }

    parseComicId(href) {
        const value = String(href || "");
        const match = value.match(/\/manhua\/detail\/(\d+)\/?/i);
        return match ? match[1] : "";
    }

    parseChapterId(href) {
        const value = String(href || "");
        const match = value.match(/\/manhua\/chapter\/(\d+)\/(\d+)\/?/i);
        return match ? match[2] : "";
    }

    parseMaxPage(doc, fallback = 1) {
        let maxPage = fallback;
        const pageLinks = doc.querySelectorAll("a[href], .GPageLink");
        for (const link of pageLinks) {
            const text = String(link.text || "").trim();
            const href = String(link.attributes.href || "");
            const hrefMatch = href.match(/(?:^|\/)(\d+)\.html(?:$|\?)/i);
            if (hrefMatch) {
                const hrefNumber = parseInt(hrefMatch[1], 10);
                if (hrefNumber > maxPage) maxPage = hrefNumber;
            }
            if (!href && /^\d+$/.test(text) && /\bGPageLink\b/.test(link.attributes.class || "")) {
                maxPage = Math.max(maxPage, parseInt(text, 10));
            }
        }
        return maxPage;
    }

    parseListCard(item) {
        const itemAttrs = item.attributes;
        const modern = /\bcomic-card\b/.test(itemAttrs.class || "");
        const titleLink = item.querySelector(modern ? "h3" : ".title a, h2 a") || item.querySelector("a[href*='/manhua/detail/']");
        const image = item.querySelector("img");
        if (!titleLink || !image) return null;

        const href = modern ? itemAttrs.href : titleLink.attributes.href;
        const id = this.parseComicId(href);
        if (!id) return null;

        const imageAttrs = image.attributes;
        const title = String(titleLink.text || imageAttrs.alt || "").trim().replace(/漫画$/, "");
        let subtitle = String(item.querySelector(modern ? "p" : "a[href*='/manhua/chapter/']")?.text || "").trim();
        if (!subtitle && !modern) {
            subtitle = [item.querySelector(".zuozhe")?.text, item.querySelector(".biaoqian")?.text].filter(Boolean).join("；") || item.querySelector(".info")?.text || "";
        }
        const cover = this.imageKey(imageAttrs["data-src"] || imageAttrs["data-original"] || imageAttrs.src || "");

        return new Comic({
            id,
            title: title || "未知漫画",
            cover,
            subTitle: subtitle
        });
    }

    parseList(doc) {
        const comics = [];
        const cards = Array.from(doc.querySelectorAll(".cy_list_mh > ul, a.comic-card"));
        // 新版分类/搜索：标题在 li > div > h2 中，封面位于同一 li 的另一个链接。
        for (const title of doc.querySelectorAll("h2 a[href*='/manhua/detail/']")) {
            let row = title.parent;
            while (row && row.localName !== "li") row = row.parent;
            if (row) cards.push(row);
        }
        const seen = new Set();
        for (const card of cards) {
            const comic = this.parseListCard(card);
            if (comic && !seen.has(comic.id)) {
                seen.add(comic.id);
                comics.push(comic);
            }
        }
        return comics;
    }

    parseWideCard(item) {
        const titleLink = item.querySelector("b a") || item.querySelector("a[href*='/manhua/detail/']");
        const image = item.querySelector("img");
        if (!titleLink || !image) return null;
        const id = this.parseComicId(titleLink.attributes.href || item.querySelector("a[href*='/manhua/detail/']")?.attributes.href || "");
        if (!id) return null;
        const title = String(titleLink.text || image.attributes.alt || "").trim().replace(/漫画$/, "");
        const latest = String(item.querySelector("p a")?.text || "").trim();
        const attrs = image.attributes;
        const cover = this.imageKey(attrs["data-src"] || attrs["data-original"] || attrs.src || "");
        return new Comic({ id, title: title || "未知漫画", cover, subTitle: latest });
    }

    parseHomeSections(doc) {
        const result = {};
        for (const section of doc.querySelectorAll(".library-section")) {
            const title = String(section.querySelector(".section-heading h2")?.text || "推荐漫画").trim();
            const comics = this.parseList(section);
            if (comics.length) result[title] = comics;
        }
        for (const section of doc.querySelectorAll(".cy_wide_list")) {
            const title = String(section.querySelector("span a")?.text || section.querySelector("span")?.text || "推荐漫画").trim();
            const comics = [];
            for (const item of section.querySelectorAll("ul li")) {
                const comic = this.parseWideCard(item);
                if (comic) comics.push(comic);
            }
            if (comics.length > 0) result[title || "推荐漫画"] = comics;
        }
        return result;
    }

    buildListUrl(path, page) {
        const base = this.absoluteUrl(path);
        const pageNumber = this.parsePageNumber(page, 1);
        if (pageNumber <= 1) return base;
        return base.replace(/\/$/, "") + "/" + pageNumber + ".html";
    }

    buildSearchUrl(keyword, page) {
        const query = encodeURIComponent(String(keyword || "").trim());
        // 实测旧表单 URL 会先返回 302，再跳转到 /manhua/so/{关键词}/。
        // Venera 网络层对 302 的处理可能因版本不同而异，因此直接请求最终路由。
        return this.baseUrl + "/manhua/so/" + query + "/";
    }

    async fetchDocument(url) {
        const response = await Network.get(url, {...this.defaultHeaders, "cache-time": "no"});
        if (response.status !== 200) throw new Error("动漫啦请求失败: " + response.status);
        const body = String(response?.body || "");
        if (!body) throw new Error("empty response");
        if (!/<\/html\s*>/i.test(body)) throw new Error("动漫啦网页传输不完整");
        return new HtmlDocument(body);
    }

    checkedList(doc) {
        const comics = this.parseList(doc);
        if (comics.length) return comics;
        const text = String(doc.querySelector("main")?.text || "");
        if (/没有找到与[\s\S]*相关的漫画/.test(text)) return [];
        throw new Error("列表未返回有效漫画，可能是错误页或网页结构已变化");
    }

    explore = [{
        title: "动漫啦",
        type: "singlePageWithMultiPart",
        load: async () => {
            const doc = await this.fetchDocument(this.baseUrl + "/");
            try {
            let result = this.parseHomeSections(doc);
            if (Object.keys(result).length === 0) {
                result = { "推荐漫画": this.parseList(doc) };
            }
            if (!Object.values(result).some(comics => comics.length > 0)) {
                throw new Error("首页未返回有效漫画，可能是错误页或网页结构已变化");
            }
            return result;
            } finally { doc.dispose(); }
        }
    }];

    category = {
        title: "动漫啦",
        parts: [
            {
                name: "地区与进度",
                type: "fixed",
                categories: ["日本漫画", "港台漫画", "欧美漫画", "国产漫画", "韩漫", "完结", "最近更新"],
                categoryParams: ["japan", "hongkongtaiwan", "oumei", "guochan", "hanguo", "finish", "serial"],
                itemType: "category"
            },
            {
                name: "题材",
                type: "fixed",
                categories: ["恐怖灵异", "少年热血", "少女爱情", "武侠格斗", "竞技体育", "侦探悬疑", "幽默搞笑", "科幻魔法", "耽美百合", "其他漫画"],
                categoryParams: ["node/1", "node/2", "node/3", "node/4", "node/5", "node/6", "node/7", "node/8", "node/10", "node/9"],
                itemType: "category"
            }
        ],
        enableRankingPage: false
    };

    categoryComics = {
        load: async (category, param, options, page) => {
            let doc;
            try {
                const url = this.buildListUrl("/manhua/" + String(param || "japan").replace(/^\/+|\/+$/g, "") + "/", page);
                doc = await this.fetchDocument(url);
                const comics = this.checkedList(doc);
                const maxPage = this.parseMaxPage(doc, this.parsePageNumber(page, 1));
                return { comics, maxPage };
            } catch (e) {
                throw new Error("动漫啦分类加载失败: " + String(e));
            } finally { doc?.dispose(); }
        }
    };

    search = {
        load: async (keyword, options, page) => {
            let doc;
            try {
                doc = await this.fetchDocument(this.buildSearchUrl(keyword, page));
                const comics = this.checkedList(doc);
                // 当前真实搜索结果没有可用分页；不能用调用方 page 伪造 maxPage。
                const maxPage = this.parseMaxPage(doc, 1);
                return { comics, maxPage };
            } catch (e) {
                throw new Error("动漫啦搜索加载失败: " + String(e));
            } finally { doc?.dispose(); }
        }
    };

    comic = {
        loadInfo: async (id) => {
            let doc;
            try {
                const url = this.baseUrl + "/manhua/detail/" + encodeURIComponent(String(id || "")) + "/";
                doc = await this.fetchDocument(url);
                const title = String(doc.querySelector("h1[itemprop='name'], h1")?.text || "").trim();
                const cover = this.imageKey(doc.querySelector("img[itemprop='image']")?.attributes.src || doc.querySelector("meta[property='og:image']")?.attributes.content || "");
                const description = String(doc.querySelector("[itemprop='description'], .description, .intro")?.text || "").trim();
                const tags = {};
                const author = String(doc.querySelector("[itemprop='author'], a[href*='author']")?.text || "").trim();
                const genre = String(doc.querySelector("[itemprop='genre']")?.text || "").trim();
                const category = String(doc.querySelector("[itemprop='inLanguage']")?.text || "").trim();
                const statusText = String(doc.querySelector(".text-orange-600, .status")?.text || "").trim();
                if (author) tags["作者"] = [author];
                if (genre) tags["类别"] = genre.split(/[，,、\s]+/).filter(value => value);
                if (category) tags["地区"] = [category];
                if (statusText) tags["状态"] = [statusText === "1" ? "连载中" : statusText];

                const chapters = new Map();
                const list = doc.querySelector("#chapterList");
                const chapterLinks = (list || doc).querySelectorAll("a[href*='/manhua/chapter/']");
                // 网站目录为倒序；不能把顶部“开始阅读/最新话”快捷链接掺进目录顺序。
                const orderedLinks = list ? Array.from(chapterLinks).reverse() : chapterLinks;
                for (const link of orderedLinks) {
                    const href = link.attributes.href || "";
                    const chapterId = this.parseChapterId(href);
                    if (!chapterId) continue;
                    const chapterTitle = String(link.text || "").trim() || ("章节 " + chapterId);
                    chapters.set(chapterId, chapterTitle);
                }
                if (!title || chapters.size === 0) throw new Error("未取得有效标题或章节目录，请重试或检查原站");
                return new ComicDetails({ title, cover, description, tags, chapters });
            } catch (e) {
                throw new Error("动漫啦详情加载失败: " + String(e));
            } finally { doc?.dispose(); }
        },

        loadEp: async (comicId, epId) => {
            try {
                const chapterId = String(epId || "").trim();
                let normalUrl = /\/manhua\/chapter\/\d+\/\d+\/?/i.test(chapterId)
                    ? chapterId : "/manhua/chapter/" + encodeURIComponent(String(comicId)) + "/" + encodeURIComponent(chapterId) + "/";
                normalUrl = this.absoluteUrl(normalUrl).replace(/\/(?:all|\d+)\.html(?:\?.*)?$/i, "/");
                const allUrl = normalUrl.replace(/\/$/, "") + "/all.html";
                let images = [];
                let allError = "";
                try {
                    const response = await Network.get(allUrl, {...this.defaultHeaders, "cache-time": "no"});
                    if (response.status !== 200) throw new Error("HTTP " + response.status);
                    images = this.extractImages(String(response.body || ""));
                } catch (e) { allError = String(e); }
                if (images.length === 0) {
                    const singleResponse = await Network.get(normalUrl, {...this.defaultHeaders, "cache-time": "no"});
                    if (singleResponse.status !== 200) throw new Error("阅读页 HTTP " + singleResponse.status + "; 整话页: " + allError);
                    const doc = new HtmlDocument(String(singleResponse.body || ""));
                    try {
                        // 单页模式不能静默丢掉后面的图片页。
                        const links = Array.from(doc.querySelectorAll("a[href]"));
                        const pages = new Set();
                        for (const link of links) {
                            const href = String(link.attributes.href || "");
                            if (/(?:^|\/)(\d+)\.html(?:\?|$)/.test(href)) {
                                const url = /^https?:\/\//.test(href) || href.startsWith("/")
                                    ? this.absoluteUrl(href) : normalUrl.replace(/\/?$/, "/") + href;
                                if (url.startsWith(normalUrl.replace(/\/?$/, "/"))) pages.add(url);
                            }
                        }
                        if (pages.size) throw new Error("整话页暂不可用，请重试，避免返回不完整章节");
                    } finally { doc.dispose(); }
                    images = this.extractImages(String(singleResponse.body || ""));
                }
                if (!images.length) throw new Error("未解析到正文图片，请检查网站或网络");
                return { images: [...new Set(images)], headers: this.defaultHeaders };
            } catch (e) {
                throw new Error("动漫啦章节加载失败: " + String(e));
            }
        },

        onImageLoad: (url) => this.imageConfig(url, true),
        onThumbnailLoad: (url) => this.imageConfig(url, false)
    };

    imageKey(value) {
        const url = this.absoluteUrl(value, this.imageBaseUrl);
        return url ? url + (url.includes("?") ? "&" : "?") + "venera_dl=105" : "";
    }

    imageConfig(key, retry) {
        // 缓存 key 换版本，但发给 CDN 的地址保持网站原样，避免额外缓存未命中。
        const url = String(key || "").replace(/([?&])venera_dl=\d+(&|$)/, (m, prefix, suffix) => suffix ? prefix : "").replace(/[?&]$/, "");
        const profiles = [
            {...this.defaultHeaders, "Accept": "image/webp,image/png,image/jpeg,image/*;q=0.8,*/*;q=0.5", "Accept-Language": "zh-CN,zh;q=0.9"},
            {"User-Agent": "Mozilla/5.0", "Accept": "image/*,*/*;q=0.8", "Referer": this.baseUrl + "/"},
            {"User-Agent": this.defaultHeaders["User-Agent"], "Accept": "image/*,*/*;q=0.8"}
        ];
        const build = i => ({
            url, headers: profiles[i],
            onResponse: buffer => {
                const bytes = new Uint8Array(buffer);
                const jpeg = bytes[0] === 255 && bytes[1] === 216;
                const png = bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
                const webp = bytes[0] === 82 && bytes[1] === 73 && bytes[8] === 87 && bytes[9] === 69;
                const gif = bytes[0] === 71 && bytes[1] === 73 && bytes[2] === 70;
                if (bytes.length < 12 || (!jpeg && !png && !webp && !gif)) throw new Error("动漫啦返回的不是图片");
                if (jpeg && (bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217)) throw new Error("动漫啦图片传输不完整，请重试");
                return buffer;
            },
            // 缩略图下载器不调用 onLoadFailed；只给正文配置有限重试。
            ...(retry ? {onLoadFailed: () => i + 1 < profiles.length ? build(i + 1) : null} : {})
        });
        return build(0);
    }

    extractImages(body) {
        if (!body) return [];
        if (!/<\/html\s*>/i.test(body)) throw new Error("动漫啦阅读页传输不完整");
        const doc = new HtmlDocument(body);
        const images = [];
        const reader = doc.querySelector("[data-reading], #images, #manga, .comic-content") || doc;
        for (const img of reader.querySelectorAll("img")) {
            const attrs = img.attributes;
            const src = attrs["data-src"] || attrs["data-original"] || attrs.src || "";
            const url = this.absoluteUrl(src, this.imageBaseUrl);
            if (/^https?:\/\/img\.dongman\.la\//i.test(url) && !/\/uploads\/manhua\//i.test(url)) images.push(this.imageKey(url));
        }
        doc.dispose();
        return images;
    }
}
