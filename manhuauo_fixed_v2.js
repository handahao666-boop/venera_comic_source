/**
 * 香蕉漫画（manhuauo.com）Venera 漫画源
 *
 * 更新日志：
 * - v1.0.3：补充真实开发证据、解密调查结论与验证规范。
 *   已实测：首页/分类使用 .mg-vod-item，搜索使用 .mg-search-item；
 *   分类分页为 ?page={n}；章节图片来自 player_aaaa.url，以 ||| 分隔。
 *   当前实测章节未发现 AES/XOR/Base64 图片加密，禁止无证据加入解密逻辑。
 *   【重点】每次更新必须验证：首页、搜索、分类、详情、章节与图片六条链路。
 * - v1.0.2：统一首页推荐页与分类页的显示名称为“香蕉漫画”。
 *   内部 key 保持 manhuauo_banana_v2 不变，避免影响已导入源的设置和数据。
 * - v1.0.1：修复搜索、分类分页、详情章节与阅读页图片解析。
 */
class XiangJiaoManHua extends ComicSource {
    name = "香蕉漫画"
    key = "manhuauo_banana_v2"
    version = "1.0.3"
    minAppVersion = "1.0.0"
    url = ""

    baseUrl = "https://www.manhuauo.com"

    // 开发规则：只有从真实网页/接口/脚本中确认的字段才可写入本源。
    // 本源详细证据、Venera 解密能力及验证记录见 manhuauo_development_log.md。

    settings = {
        image_quality: {
            title: "图片质量",
            type: "select",
            options: [{ value: "default", text: "默认" }],
            default: "default"
        }
    }

    absoluteUrl(path) {
        if (!path) return "";
        if (path.startsWith("http://") || path.startsWith("https://")) return path;
        return path.startsWith("/") ? this.baseUrl + path : this.baseUrl + "/" + path;
    }

    comicIdFromHref(href) {
        if (!href) return "";
        const match = href.match(/\/comic\/(\d+)\.html/);
        return match ? match[1] : href.replace(/^\/+|\/+$/g, "");
    }

    parseMaxPage(doc, fallback) {
        let maxPage = fallback || 1;
        const links = doc.querySelectorAll('.pagination-list .pagination-link');
        for (const link of links) {
            const value = parseInt(link.text.trim());
            if (!isNaN(value) && value > maxPage) maxPage = value;
        }
        return maxPage;
    }

    parseVodItem(item) {
        const thumb = item.querySelector('.mg-vod-thumb');
        const titleEl = item.querySelector('.mg-vod-name a');
        if (!thumb || !titleEl) return null;
        const status = item.querySelector('.mg-vod-status')?.text.trim() || "";
        const episode = item.querySelector('.mg-vod-tag')?.text.trim() || "";
        return new Comic({
            id: this.comicIdFromHref(thumb.attributes.href),
            title: titleEl.text.trim(),
            cover: this.absoluteUrl(thumb.attributes['data-original'] || thumb.attributes.src || ""),
            subTitle: [status, episode].filter(e => e).join(" · ")
        });
    }

    parseSearchItem(item) {
        const thumb = item.querySelector('.mg-search-thumb');
        const titleEl = item.querySelector('.mg-search-name a');
        if (!thumb || !titleEl) return null;
        const meta = item.querySelector('.mg-search-meta')?.text.trim() || "";
        return new Comic({
            id: this.comicIdFromHref(thumb.attributes.href),
            title: titleEl.text.trim(),
            cover: this.absoluteUrl(thumb.attributes['data-original'] || thumb.attributes.src || ""),
            subTitle: meta
        });
    }

    getCategoryUrl(param, page) {
        let url;
        if (param === "__serial") {
            url = this.baseUrl + "/type/cate/?lang=serial";
        } else if (param === "__end") {
            url = this.baseUrl + "/type/cate/?lang=end";
        } else if (!param) {
            url = this.baseUrl + "/type/cate/";
        } else {
            url = this.baseUrl + "/type/cate/" + encodeURIComponent(param);
        }
        if (page > 1) {
            url += (url.includes("?") ? "&" : "?") + "page=" + page;
        }
        return url;
    }

    explore = [
        {
            // Venera 首页推荐页显示名称
            title: "香蕉漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                try {
                    const res = await Network.get(this.baseUrl + "/", {});
                    if (!res || !res.body) return {};
                    const doc = new HtmlDocument(res.body);
                    const result = {};
                    const sections = doc.querySelectorAll('.mg-section');
                    for (const section of sections) {
                        const head = section.querySelector('.mg-section-head h2');
                        if (!head) continue;
                        const comics = [];
                        const items = section.querySelectorAll('.mg-vod-item');
                        for (const item of items) {
                            const comic = this.parseVodItem(item);
                            if (comic) comics.push(comic);
                        }
                        if (comics.length > 0) result[head.text.trim()] = comics;
                    }
                    doc.dispose();
                    return result;
                } catch (e) {
                    return {};
                }
            }
        }
    ]

    category = {
        // Venera 分类页显示名称
        title: "香蕉漫画",
        parts: [
            {
                name: "题材",
                type: "fixed",
                categories: ["全部", "恋爱", "纯爱", "都市", "校园", "古风", "热血", "搞笑", "悬疑", "魔法", "剧情", "短篇", "科幻", "奇幻", "玄幻", "ABO", "黑白漫", "总裁", "言情", "甜宠", "西方", "穿越", "运动", "架空", "非人类", "灵异", "虐恋", "橘里橘气", "彩虹"],
                categoryParams: ["", "恋爱.html", "纯爱.html", "都市.html", "校园.html", "古风.html", "热血.html", "搞笑.html", "悬疑.html", "魔法.html", "剧情.html", "短篇.html", "科幻.html", "奇幻.html", "玄幻.html", "ABO.html", "黑白漫.html", "总裁.html", "言情.html", "甜宠.html", "西方.html", "穿越.html", "运动.html", "架空.html", "非人类.html", "灵异.html", "虐恋.html", "橘里橘气.html", "彩虹.html"],
                itemType: "category"
            },
            {
                name: "进度",
                type: "fixed",
                categories: ["连载中", "已完结"],
                categoryParams: ["__serial", "__end"],
                itemType: "category"
            }
        ],
        enableRankingPage: false
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            try {
                const res = await Network.get(this.getCategoryUrl(param, page), {});
                if (!res || !res.body) return { comics: [], maxPage: page };
                const doc = new HtmlDocument(res.body);
                const comics = [];
                const items = doc.querySelectorAll('.mg-vod-item');
                for (const item of items) {
                    const comic = this.parseVodItem(item);
                    if (comic) comics.push(comic);
                }
                const maxPage = this.parseMaxPage(doc, page);
                doc.dispose();
                return { comics: comics, maxPage: maxPage };
            } catch (e) {
                return { comics: [], maxPage: page };
            }
        }
    }

    search = {
        load: async (keyword, options, page) => {
            try {
                let url = this.baseUrl + "/search.html?wd=" + encodeURIComponent(keyword);
                if (page > 1) url += "&page=" + page;
                const res = await Network.get(url, {});
                if (!res || !res.body) return { comics: [], maxPage: 1 };
                const doc = new HtmlDocument(res.body);
                const comics = [];
                const items = doc.querySelectorAll('.mg-search-item');
                for (const item of items) {
                    const comic = this.parseSearchItem(item);
                    if (comic) comics.push(comic);
                }
                const maxPage = this.parseMaxPage(doc, page);
                doc.dispose();
                return { comics: comics, maxPage: maxPage };
            } catch (e) {
                return { comics: [], maxPage: 1 };
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            try {
                const res = await Network.get(this.baseUrl + "/comic/" + id + ".html", {});
                if (!res || !res.body) throw "Empty response";
                const doc = new HtmlDocument(res.body);
                const title = doc.querySelector('.mg-detail-title')?.text.trim() || "";
                const ogImage = doc.querySelector('meta[property="og:image"]');
                const cover = this.absoluteUrl(ogImage?.attributes.content || "");
                const description = doc.querySelector('.mg-detail-desc')?.text.trim() || doc.querySelector('.hl-content-text')?.text.trim() || "";

                const tags = {};
                const infoItems = doc.querySelectorAll('.mg-detail-meta li');
                for (const item of infoItems) {
                    const label = item.querySelector('em')?.text.trim() || "";
                    const value = item.text.replace(label, '').trim();
                    if (label && value) tags[label.replace(/[：:]/g, '')] = [value];
                }

                const chapters = new Map();
                const chapterEls = doc.querySelectorAll('.mg-chapter-list a');
                for (const el of chapterEls) {
                    const href = el.attributes.href;
                    if (href) chapters.set(href, el.text.trim());
                }
                doc.dispose();
                return new ComicDetails({ title, cover, description, tags, chapters });
            } catch (e) {
                return new ComicDetails({ title: "加载失败", chapters: new Map() });
            }
        },

        loadEp: async (comicId, epId) => {
            try {
                const chapterUrl = epId.startsWith("http") ? epId : this.absoluteUrl(epId);
                const res = await Network.get(chapterUrl, {});
                const body = String(res.body || "");
                if (!body) return { images: [] };

                const images = [];
                // 实测阅读页脚本：player_aaaa.url 是以 ||| 分隔的原始图片相对路径。
                // 未发现加密时不能猜测 AES/XOR；若页面格式变更，须重新取证后再修改。
                const playerMatch = body.match(/var\s+player_aaaa\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
                const dataText = playerMatch ? playerMatch[1] : body;
                const urlMatch = dataText.match(/["']url["']\s*:\s*["']([^"']*)["']/);
                if (urlMatch && urlMatch[1]) {
                    const rawUrls = urlMatch[1].split("|||");
                    for (const rawUrl of rawUrls) {
                        const imageUrl = this.absoluteUrl(rawUrl.trim());
                        if (imageUrl) images.push(imageUrl);
                    }
                }

                if (images.length === 0) {
                    const doc = new HtmlDocument(body);
                    const imgEls = doc.querySelectorAll('.mg-manga-reader img');
                    for (const img of imgEls) {
                        const imageUrl = this.absoluteUrl(img.attributes['data-original'] || img.attributes.src || "");
                        if (imageUrl) images.push(imageUrl);
                    }
                    doc.dispose();
                }
                return { images: [...new Set(images)] };
            } catch (e) {
                return { images: [] };
            }
        }
    }
}
