/**
 * Rawkuma（rawkuma.net）Venera 漫画源 v1.0.0
 *
 * 取证记录（2026-08-30 真实样本）：
 *  1. 列表/分类/搜索统一走 WP admin-ajax：
 *     POST https://{host}/wp-admin/admin-ajax.php?action=advanced_search
 *     表单字段：nonce / page / orderby(popular|rating|updated|bookmarked|title) / order(desc|asc)
 *              / genre(JSON数组) / type(JSON数组) / status(JSON数组) / query(关键词)
 *     nonce 由 GET ...?type=search_form&action=get_nonce 返回：
 *       <input type='hidden' name='search_nonce' value='...'>
 *     响应为纯结果片段，每页 24 张卡片；超出末页返回空片段（146 字节）。
 *  2. 卡片结构：<a href="https://{host}/manga/{slug}/"> 内包含 <img class="...wp-post-image" src="封面" alt="标题">
 *  3. 详情页：h1[itemprop="name"] 标题；[itemprop="image"] img.wp-post-image 封面；
 *     [itemprop="description"]（取最后一个）简介；a[itemprop="genre"] 题材；
 *     #chapter-list a[href*="/chapter-"] 章节（文本为 Chapter 编号）。
 *  4. 章节页：<section data-image-data="1"> 内的 img 即正文图（CDN: kuma.kyut.dev，无需特殊请求头）。
 */
class Rawkuma extends ComicSource {
    name = "Rawkuma"
    key = "rawkuma"
    version = "1.1.0"
    minAppVersion = "1.0.0"
    url = "https://rawkuma.net"

    static defaultBaseUrl = "rawkuma.net"
    static ajaxAction = "/wp-admin/admin-ajax.php"
    // 题材三列数据：[英文站内名, 中文显示名, slug]
    static genrePairs = [
        ["Action", "动作", "action"], ["Adaptions", "改编", "adaptions"], ["Adult", "成人", "adult"],
        ["Adventure", "冒险", "adventure"], ["Animals", "动物", "animals"], ["Comedy", "搞笑", "comedy"],
        ["Crime", "犯罪", "crime"], ["Drama", "剧情", "drama"], ["Ecchi", "擦边", "ecchi"],
        ["Fantasy", "奇幻", "fantasy"], ["Game", "游戏", "game"], ["Gender Bender", "性转换", "gender-bender"],
        ["Girls' Love", "GL百合", "girls-love"], ["Harem", "后宫", "harem"], ["Hentai", "里番", "hentai"],
        ["Historical", "历史", "historical"], ["Horror", "恐怖", "horror"], ["Isekai", "异世界", "isekai"],
        ["Josei", "女性向", "josei"], ["Lolicon", "萝莉", "lolicon"], ["Magic", "魔法", "magic"],
        ["Martial Arts", "格斗", "martial-arts"], ["Mature", "成人向", "mature"], ["Mecha", "机战", "mecha"],
        ["Mystery", "悬疑", "mystery"], ["Oneshot", "短篇", "oneshot"], ["Philosophical", "哲理", "philosophical"],
        ["Police", "警察", "police"], ["Psychological", "心理", "psychological"], ["Romance", "恋爱", "romance"],
        ["School Life", "校园", "school-life"], ["Sci-fi", "科幻", "sci-fi"], ["Seinen", "青年", "seinen"],
        ["Shotacon", "正太", "shotacon"], ["Shoujo", "少女", "shoujo"], ["Shoujo Ai", "少女爱", "shoujo-ai"],
        ["Shounen", "少年", "shounen"], ["Shounen Ai", "少年爱", "shounen-ai"], ["Slice of Life", "日常", "slice-of-life"],
        ["Smut", "情色", "smut"], ["Sports", "运动", "sports"], ["Supernatural", "超自然", "supernatural"],
        ["Thriller", "惊悚", "thriller"], ["Tragedy", "悲剧", "tragedy"], ["Yaoi", "耽美", "yaoi"],
        ["Yuri", "百合", "yuri"]
    ]
    static buildMap(pairs, keyIndex, valueIndex) {
        const map = {};
        pairs.forEach((pair) => { map[pair[keyIndex]] = pair[valueIndex]; });
        return map;
    }
    static genreDict = this.buildMap(this.genrePairs, 0, 2)      // 英文 -> slug
    static genreZh = this.buildMap(this.genrePairs, 1, 2)        // 中文 -> slug
    static genreEnToZh = this.buildMap(this.genrePairs, 0, 1)    // 英文 -> 中文
    static orderByKeys = ["popular", "rating", "updated", "bookmarked", "title"]
    static ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

    // 源内置翻译器：App 在 locale 为 zh 时用 ts(sourceKey) 查这张表
    translation = {
        "zh": {
            "Popular": "热门", "Rating": "评分", "Updated": "更新时间", "Bookmarked": "收藏数", "Title": "标题",
            "Genre": "题材", "Type": "类型", "Status": "状态", "Sort": "排序", "Search": "搜索",
        },
        "zh_CN": {
            "Popular": "热门", "Rating": "评分", "Updated": "更新时间", "Bookmarked": "收藏数", "Title": "标题",
            "Genre": "题材", "Type": "类型", "Status": "状态", "Sort": "排序", "Search": "搜索",
        },
    }

    settings = {
        base_url: {
            title: "站点域名",
            type: "input",
            validator: "^(https?:\\/\\/)?([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}(\\/.*)?$",
            default: Rawkuma.defaultBaseUrl,
        },
    }

    get webHeaders() {
        return {
            "User-Agent": Rawkuma.ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "X-Requested-With": "XMLHttpRequest",
        }
    }

    get apiHeaders() {
        return {
            "User-Agent": Rawkuma.ua,
            "Accept": "text/html, */*; q=0.01",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Referer": `${this.baseUrl}/library/`,
        }
    }

    get baseUrl() {
        const saved = this.loadSetting('base_url');
        const value = String(saved || Rawkuma.defaultBaseUrl)
            .trim()
            .replace(/^https?:\/\//i, "")
            .replace(/\/+$/, "");
        return `https://${value}`;
    }

    absoluteUrl(url) {
        const raw = String(url || "").trim();
        if (!raw) return "";
        if (/^https?:\/\//i.test(raw)) return raw;
        if (raw.startsWith("//")) return `https:${raw}`;
        if (raw.startsWith("/")) return `${this.baseUrl}${raw}`;
        return `${this.baseUrl}/${raw}`;
    }

    errorMessage(error) {
        if (error == null) return "未知错误";
        if (typeof error === "string") return error;
        if (error.message) return String(error.message);
        return String(error);
    }

    // 获取/缓存搜索 nonce（WP 访客 nonce 长期有效，失效时自动刷新一次）
    async ensureNonce(forceRefresh) {
        let nonce = forceRefresh ? "" : this.loadData("_nonce");
        if (nonce) return nonce;
        try {
            const res = await Network.get(
                `${this.baseUrl}${Rawkuma.ajaxAction}?type=search_form&action=get_nonce`,
                this.webHeaders
            );
            if (res && Number(res.status) === 200) {
                const match = String(res.body || "").match(/name=['"]search_nonce['"][^>]*value=['"]([^'"]+)['"]/i);
                if (match && match[1]) {
                    this.saveData("_nonce", match[1]);
                    return match[1];
                }
            }
        } catch (_) {}
        return "";
    }

    // 统一 advanced_search 请求，返回响应 HTML；nonce 失效自动刷新重试一次
    async advancedSearch(params) {
        const buildForm = (nonce) => {
            const fields = [`nonce=${encodeURIComponent(nonce || "")}`];
            const page = Math.max(1, Number(params.page) || 1);
            fields.push(`page=${page}`);
            fields.push(`orderby=${encodeURIComponent(params.orderby || "popular")}`);
            fields.push(`order=${params.order === "asc" ? "asc" : "desc"}`);
            fields.push(`inclusion=OR`);
            fields.push(`exclusion=OR`);
            if (Array.isArray(params.genre) && params.genre.length > 0) {
                fields.push(`genre=${encodeURIComponent(JSON.stringify(params.genre))}`);
            }
            if (Array.isArray(params.type) && params.type.length > 0) {
                fields.push(`type=${encodeURIComponent(JSON.stringify(params.type))}`);
            }
            if (Array.isArray(params.status) && params.status.length > 0) {
                fields.push(`status=${encodeURIComponent(JSON.stringify(params.status))}`);
            }
            const query = String(params.query || "").trim();
            if (query) {
                fields.push(`query=${encodeURIComponent(query)}`);
            }
            return fields.join("&");
        };

        let nonce = await this.ensureNonce(false);
        let body = await this.postAdvancedSearch(buildForm(nonce));
        const trimmed = String(body || "").trim();
        if (trimmed === "-1" || trimmed === "0" || /invalid nonce|nonce.*expired|expired.*nonce/i.test(trimmed)) {
            // nonce 失效：删除缓存并刷新一次后重试
            this.deleteData("_nonce");
            nonce = await this.ensureNonce(true);
            body = await this.postAdvancedSearch(buildForm(nonce));
        }
        return body;
    }

    async postAdvancedSearch(form) {
        let res = null;
        try {
            res = await Network.post(
                `${this.baseUrl}${Rawkuma.ajaxAction}?action=advanced_search`,
                this.apiHeaders,
                form
            );
        } catch (error) {
            throw `Rawkuma 请求失败：${this.errorMessage(error)}`;
        }
        if (res && res.error) {
            throw `Rawkuma 网络错误：${this.errorMessage(res.error)}`;
        }
        if (!res || Number(res.status) !== 200) {
            throw `Rawkuma 请求失败（HTTP ${res && res.status}）`;
        }
        return String(res.body || "");
    }

    // 解析 advanced_search 结果片段中的漫画卡片
    parseCards(html) {
        const comics = [];
        const seen = {};
        let document = null;
        try {
            document = new HtmlDocument(String(html || ""));
        } catch (_) {
            return comics;
        }
        document.querySelectorAll('a[href*="/manga/"]').forEach((anchor) => {
            const href = this.absoluteUrl(anchor.attributes["href"]);
            if (!/^https?:\/\/[^/]+\/manga\/[^/?#]+\/$/i.test(href)) return;
            if (seen[href]) return;
            const img = anchor.querySelector("img");
            if (!img) return;
            const cover = this.absoluteUrl(img.attributes["src"]);
            const title = String(img.attributes["alt"] || anchor.attributes["title"] || (anchor.text || "")).trim();
            if (!title || !cover) return;
            seen[href] = true;
            comics.push(new Comic({
                id: href,
                title: title,
                cover: cover,
                subTitle: "",
            }));
        });
        return comics;
    }

    explore = [
        {
            title: "Rawkuma",
            type: "multiPageComicList",
            load: async (page) => {
                const html = await this.advancedSearch({ page: page, orderby: "updated", order: "desc" });
                return { comics: this.parseCards(html), maxPage: null };
            },
        },
    ]

    category = {
        title: "Rawkuma",
        parts: [
            {
                name: "题材",
                type: "fixed",
                categories: Object.keys(Rawkuma.genreDict).map((en) => Rawkuma.genreEnToZh[en] || en),
                categoryParams: Object.values(Rawkuma.genreDict),
                itemType: "category",
            },
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        optionList: [
            {
                type: "select",
                label: "排序",
                default: "popular",
                options: ["popular-Popular", "rating-Rating", "updated-Updated", "bookmarked-Bookmarked", "title-Title"],
            },
        ],
        load: async (category, param, options, page) => {
            let orderby = "popular";
            if (Array.isArray(options) && options[0]) {
                const raw = String(options[0]).replace(/^"|"$/g, "").trim();
                if (Rawkuma.orderByKeys.includes(raw)) orderby = raw;
            }
            const genreSlug = String(param || "");
            const html = await this.advancedSearch({
                page: page,
                genre: genreSlug ? [genreSlug] : [],
                orderby: orderby,
                order: "desc",
            });
            return { comics: this.parseCards(html), maxPage: null };
        },
    }

    search = {
        optionList: [],
        load: async (keyword, options, page) => {
            const html = await this.advancedSearch({
                page: page,
                query: String(keyword || "").trim(),
                orderby: "popular",
                order: "desc",
            });
            return { comics: this.parseCards(html), maxPage: null };
        },
    }

    comic = {
        // 开启 App 内置标签翻译（英文标签转中文）
        enableTagsTranslate: true,

        loadInfo: async (id) => {
            const url = this.absoluteUrl(id);
            let res = null;
            try {
                res = await Network.get(url, this.webHeaders);
            } catch (error) {
                throw `Rawkuma 详情请求失败：${this.errorMessage(error)}`;
            }
            if (res && res.error) throw `Rawkuma 网络错误：${this.errorMessage(res.error)}`;
            if (!res || Number(res.status) !== 200) {
                throw `Rawkuma 详情请求失败（HTTP ${res && res.status}）`;
            }

            const document = new HtmlDocument(String(res.body || ""));
            const titleElement = document.querySelector('h1[itemprop="name"]');
            const title = titleElement ? String(titleElement.text || "").trim() : "";
            const coverElement = document.querySelector('[itemprop="image"] img.wp-post-image');
            const cover = coverElement ? this.absoluteUrl(coverElement.attributes["src"]) : "";
            const descriptionElements = document.querySelectorAll('[itemprop="description"]');
            let description = "";
            if (descriptionElements.length > 0) {
                description = String(descriptionElements[descriptionElements.length - 1].text || "").replace(/\s+/g, " ").trim();
            }
            const genres = [];
            document.querySelectorAll('a[itemprop="genre"]').forEach((element) => {
                const text = String(element.text || "").trim();
                // 站点返回英文题材名，翻译为中文显示
                const translated = text ? (Rawkuma.genreEnToZh[text] || text) : "";
                if (translated && !genres.includes(translated)) genres.push(translated);
            });

            const chapters = new Map();
            document.querySelectorAll('#chapter-list a[href*="/chapter-"]').forEach((element) => {
                const href = this.absoluteUrl(element.attributes["href"]);
                const name = String(element.text || "").trim() || href;
                if (href && !chapters.has(href)) chapters.set(href, name);
            });

            return new ComicDetails({
                title: title,
                cover: cover,
                description: description,
                tags: { "题材": genres },
                chapters: chapters,
                url: url,
            });
        },

        loadEp: async (comicId, epId) => {
            const url = this.absoluteUrl(epId);
            let res = null;
            try {
                res = await Network.get(url, this.webHeaders);
            } catch (error) {
                throw `Rawkuma 章节请求失败：${this.errorMessage(error)}`;
            }
            if (res && res.error) throw `Rawkuma 网络错误：${this.errorMessage(res.error)}`;
            if (!res || Number(res.status) !== 200) {
                throw `Rawkuma 章节请求失败（HTTP ${res && res.status}）`;
            }

            const document = new HtmlDocument(String(res.body || ""));
            const images = [];
            document.querySelectorAll('[data-image-data] img').forEach((element) => {
                const src = this.absoluteUrl(element.attributes["src"]);
                if (src && !images.includes(src)) images.push(src);
            });
            if (images.length === 0) {
                throw "Rawkuma 章节没有返回正文图片（可能章节不存在或已删除）";
            }
            return { images: images };
        },

        onImageLoad: (url, comicId, epId) => ({
            headers: {
                "User-Agent": Rawkuma.ua,
                "Referer": this.absoluteUrl(epId || comicId),
            },
        }),

        // 点击中文标签时反查 slug，跳转到对应分类
        onClickTag: (namespace, tag) => {
            if (namespace === "题材" || namespace === "Genres") {
                const slug = Rawkuma.genreZh[String(tag || "").trim()];
                if (slug) {
                    return { action: "category", keyword: String(tag).trim(), param: slug };
                }
            }
            throw "未支持此类Tag检索";
        },
    }

    link = {
        domains: ["rawkuma.net"],
        linkToId: (url) => {
            const match = String(url || "").match(/https?:\/\/[^/]+\/manga\/[^/?#]+/i);
            return match ? `${match[0]}/` : null;
        },
    }
}
