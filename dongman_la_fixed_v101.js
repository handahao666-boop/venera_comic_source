/**
 * 动漫啦（www.dongman.la）Venera 漫画源
 *
 * 真实取证结论：
 * 1. 首页、分类、搜索、详情和阅读页均为服务端 HTML。
 * 2. 列表卡片使用 .cy_list_mh > ul，图片使用 img[src]。
 * 3. 搜索表单为 /manhua/search/?key=关键词。
 * 4. 详情路由为 /manhua/detail/{comicId}/，章节路由为 /manhua/chapter/{comicId}/{chapterId}/。
 * 5. 阅读页图片为 img[src] 直链 JPEG，无 Base64、AES、XOR 或脚本加密。
 * 6. /all.html 为整话下拉阅读页，可一次解析完整章节图片。
 */
class DongManLa extends ComicSource {
    name = "动漫啦";
    key = "dongman_la";
    version = "1.0.1";
    minAppVersion = "1.0.0";
    url = "";

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
        const pageLinks = doc.querySelectorAll(".GPageLink, .pages a, .page a");
        for (const link of pageLinks) {
            const text = String(link.text || "").trim();
            const number = parseInt(text, 10);
            if (Number.isFinite(number) && number > maxPage) maxPage = number;
            const href = String(link.attributes.href || "");
            const hrefMatch = href.match(/(?:^|\/)(\d+)\.html(?:$|\?)/i);
            if (hrefMatch) {
                const hrefNumber = parseInt(hrefMatch[1], 10);
                if (hrefNumber > maxPage) maxPage = hrefNumber;
            }
        }
        return maxPage;
    }

    parseListCard(item) {
        const titleLink = item.querySelector(".title a") || item.querySelector("a[href*='/manhua/detail/']");
        const image = item.querySelector("img");
        if (!titleLink || !image) return null;

        const href = titleLink.attributes.href || "";
        const id = this.parseComicId(href);
        if (!id) return null;

        const title = String(titleLink.text || image.attributes.alt || "").trim().replace(/漫画$/, "");
        const status = String(item.querySelector(".zuozhe")?.text || "").trim();
        const tags = String(item.querySelector(".biaoqian")?.text || "").trim();
        const info = String(item.querySelector(".info")?.text || "").trim();
        const subtitle = [status, tags].filter(value => value).join("；");
        const cover = this.absoluteUrl(image.attributes["data-src"] || image.attributes["data-original"] || image.attributes.src || "", this.imageBaseUrl);

        return new Comic({
            id,
            title: title || "未知漫画",
            cover,
            subTitle: subtitle || info
        });
    }

    parseList(doc) {
        const comics = [];
        const cards = doc.querySelectorAll(".cy_list_mh > ul");
        for (const card of cards) {
            const comic = this.parseListCard(card);
            if (comic) comics.push(comic);
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
        const cover = this.absoluteUrl(image.attributes["data-src"] || image.attributes["data-original"] || image.attributes.src || "", this.imageBaseUrl);
        return new Comic({ id, title: title || "未知漫画", cover, subTitle: latest });
    }

    parseHomeSections(doc) {
        const result = {};
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
        const response = await Network.get(url, this.defaultHeaders);
        const body = String(response?.body || "");
        if (!body) throw new Error("empty response");
        return new HtmlDocument(body);
    }

    explore = [{
        title: "动漫啦",
        type: "singlePageWithMultiPart",
        load: async () => {
            const doc = await this.fetchDocument(this.baseUrl + "/");
            let result = this.parseHomeSections(doc);
            if (Object.keys(result).length === 0) {
                result = { "推荐漫画": this.parseList(doc) };
            }
            doc.dispose();
            return result;
        }
    }];

    category = {
        title: "动漫啦",
        parts: [
            {
                name: "地区与进度",
                type: "fixed",
                categories: ["日本漫画", "港台漫画", "欧美漫画", "国产漫画", "韩漫", "完结", "连载中"],
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
            try {
                const url = this.buildListUrl("/manhua/" + String(param || "japan").replace(/^\/+|\/+$/g, "") + "/", page);
                const doc = await this.fetchDocument(url);
                const comics = this.parseList(doc);
                const maxPage = this.parseMaxPage(doc, this.parsePageNumber(page, 1));
                doc.dispose();
                return { comics, maxPage };
            } catch (e) {
                return { comics: [], maxPage: this.parsePageNumber(page, 1) };
            }
        }
    };

    search = {
        load: async (keyword, options, page) => {
            try {
                const doc = await this.fetchDocument(this.buildSearchUrl(keyword, page));
                const comics = this.parseList(doc);
                // 当前真实搜索结果没有可用分页；不能用调用方 page 伪造 maxPage。
                const maxPage = this.parseMaxPage(doc, 1);
                doc.dispose();
                return { comics, maxPage };
            } catch (e) {
                return { comics: [], maxPage: 1 };
            }
        }
    };

    comic = {
        loadInfo: async (id) => {
            try {
                const url = this.baseUrl + "/manhua/detail/" + encodeURIComponent(String(id || "")) + "/";
                const doc = await this.fetchDocument(url);
                const title = String(doc.querySelector("h1[itemprop='name'], h1")?.text || "未知漫画").trim();
                const cover = this.absoluteUrl(doc.querySelector("img[itemprop='image']")?.attributes.src || doc.querySelector("meta[property='og:image']")?.attributes.content || "", this.imageBaseUrl);
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
                const chapterLinks = doc.querySelectorAll("#chapterList a[href*='/manhua/chapter/'], a[href*='/manhua/chapter/']");
                for (const link of chapterLinks) {
                    const href = link.attributes.href || "";
                    const chapterId = this.parseChapterId(href);
                    if (!chapterId) continue;
                    const chapterTitle = String(link.text || "").trim() || ("章节 " + chapterId);
                    chapters.set(chapterId, chapterTitle);
                }
                doc.dispose();
                return new ComicDetails({ title, cover, description, tags, chapters });
            } catch (e) {
                return new ComicDetails({ title: "加载失败", chapters: new Map() });
            }
        },

        loadEp: async (comicId, epId) => {
            try {
                let chapterId = String(epId || "").trim();
                let chapterUrl = chapterId;
                if (!/^https?:\/\//i.test(chapterUrl)) {
                    const match = chapterId.match(/\/manhua\/chapter\/\d+\/\d+\/?/i);
                    if (!match) chapterUrl = "/manhua/chapter/" + String(comicId || "") + "/" + chapterId.replace(/^\/+|\/+$/g, "") + "/";
                }
                if (!/\/all\.html(?:\?|$)/i.test(chapterUrl)) {
                    chapterUrl = chapterUrl.replace(/\/$/, "") + "/all.html";
                }
                const allResponse = await Network.get(this.absoluteUrl(chapterUrl), this.defaultHeaders);
                const allBody = String(allResponse?.body || "");
                let images = this.extractImages(allBody);
                if (images.length === 0) {
                    const singleResponse = await Network.get(this.absoluteUrl(chapterId), this.defaultHeaders);
                    images = this.extractImages(String(singleResponse?.body || ""));
                }
                return { images: [...new Set(images)], headers: this.defaultHeaders };
            } catch (e) {
                return { images: [] };
            }
        },

        onImageLoad: (url) => ({ headers: this.defaultHeaders }),
        onThumbnailLoad: (url) => ({ headers: this.defaultHeaders })
    };

    extractImages(body) {
        if (!body) return [];
        const doc = new HtmlDocument(body);
        const images = [];
        for (const img of doc.querySelectorAll("img")) {
            const src = img.attributes.src || img.attributes["data-src"] || img.attributes["data-original"] || "";
            const url = this.absoluteUrl(src, this.imageBaseUrl);
            if (/^https?:\/\//i.test(url) && url.includes("img.dongman.la")) images.push(url);
        }
        doc.dispose();
        return images;
    }
}
