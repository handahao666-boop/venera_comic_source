class DM5 extends ComicSource {
    name = "动漫屋";

    key = "dm5";

    version = "7.0.0";

    minAppVersion = "1.6.0";

    url = "https://m.dm5.com/";

    settings = {
        domain: {
            title: "主域名",
            type: "input",
            default: "m.dm5.com"
        }
    };

    // ==================================================
    // 基础地址
    // ==================================================

    get baseUrl() {
        let domain = this.loadSetting("domain");

        if (!domain) {
            domain = "m.dm5.com";
        }

        domain = String(domain)
            .trim()
            .replace(/^https?:\/\//i, "")
            .replace(/\/+$/, "");

        return "https://" + domain;
    }

    // ==================================================
    // 请求头
    // ==================================================

    get headers() {
        return {
            "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",

            "Referer":
                this.baseUrl + "/",

            "Accept":
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8"
        };
    }

    // ==================================================
    // 构建图片请求头
    // ==================================================

    _buildImageHeaders(imageUrl, referer) {
        let host = "";

        try {
            let u = new URL(imageUrl);

            host = u.host;
        } catch (e) {
            let m = imageUrl.match(/^https?:\/\/([^\/]+)/i);

            host = m ? m[1] : "";
        }

        return {
            "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",

            "Accept-Encoding": "gzip, deflate, br",

            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",

            "Cache-Control": "no-cache",

            "Connection": "keep-alive",

            "Pragma": "no-cache",

            "Referer": referer || (this.baseUrl + "/"),

            "Sec-Fetch-Dest": "image",

            "Sec-Fetch-Mode": "no-cors",

            "Sec-Fetch-Site": "cross-site",

            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
        };
    }

    get imageHeaders() {
        return this._buildImageHeaders(
            "",

            this.baseUrl + "/"
        );
    }



    // ==================================================
    // URL 清理
    // ==================================================

    cleanUrl(url) {
        if (!url) {
            return "";
        }

        return String(url)
            .replace(/&amp;/g, "&")
            .replace(/\\u0026/g, "&")
            .replace(/\\\//g, "/")
            .replace(/\\'/g, "'")
            .replace(/\\"/g, '"')
            .replace(/\\+$/g, "")
            .trim();
    }

    cleanText(text) {
        if (!text) {
            return "";
        }

        return String(text)
            .replace(/\s+/g, " ")
            .trim();
    }

    toAbsoluteUrl(url) {
        if (!url) {
            return "";
        }

        url = this.cleanUrl(url);

        if (!url) {
            return "";
        }

        if (/^https?:\/\//i.test(url)) {
            return url;
        }

        if (url.startsWith("//")) {
            return "https:" + url;
        }

        if (url.startsWith("/")) {
            return this.baseUrl + url;
        }

        return this.baseUrl + "/" + url;
    }

    getImageUrl(element) {
        if (!element) {
            return "";
        }

        let attrs = element.attributes || {};

        let url =
            attrs["data-src"] ||
            attrs["data-original"] ||
            attrs["data-lazy-src"] ||
            attrs["data-url"] ||
            attrs["data-image"] ||
            attrs["src"] ||
            "";

        return this.toAbsoluteUrl(url);
    }

    // ==================================================
    // 漫画 ID
    // ==================================================

    getComicId(href) {
        if (!href) {
            return null;
        }

        href = String(href)
            .split("?")[0]
            .split("#")[0]
            .replace(/\/+$/, "");

        let match = href.match(
            /\/(manhua-[^/]+)$/i
        );

        if (match) {
            return match[1];
        }

        match = href.match(
            /\/(m\d+)$/i
        );

        if (match) {
            return match[1];
        }

        return null;
    }

    isComicUrl(href) {
        if (!href) {
            return false;
        }

        href = String(href)
            .split("?")[0]
            .split("#")[0];

        return (
            /\/manhua-[^/]+\/?$/i.test(href) ||
            /\/m\d+\/?$/i.test(href)
        );
    }

    getComicUrl(id) {
        if (!id) {
            return "";
        }

        id = String(id).trim();

        if (!id) {
            return "";
        }

        if (/^https?:\/\//i.test(id)) {
            return id;
        }

        if (id.startsWith("manhua-")) {
            return this.baseUrl + "/" + id;
        }

        if (/^m\d+$/i.test(id)) {
            return this.baseUrl + "/" + id + "/";
        }

        return this.baseUrl + "/" + id;
    }

    // ==================================================
    // DM5 P.A.C.K.E.R. 解包
    // ==================================================

    unpackDM5(html) {
        if (!html) {
            return "";
        }

        let result = html;

        const maxLoop = 10;

        for (let loop = 0; loop < maxLoop; loop++) {
            const match = result.match(
                /eval\s*\(\s*function\s*\(p\s*,\s*a\s*,\s*c\s*,\s*k\s*,\s*e\s*,\s*d\s*\)\s*\{([\s\S]*?)\}\s*\(\s*(['"])([\s\S]*?)\2\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*(['"])([\s\S]*?)\6\.split\(['"]\|['"]\)\s*,\s*0\s*,\s*\{\}\s*\)\s*\)/
            );

            if (!match) {
                break;
            }

            const packed = match[3];
            const radix = parseInt(match[4], 10);
            const count = parseInt(match[5], 10);
            const dictionaryString = match[7];

            if (
                !packed ||
                !radix ||
                !count ||
                dictionaryString === undefined
            ) {
                break;
            }

            const dictionary = dictionaryString.split("|");

            function encode(num) {
                let result = "";

                do {
                    const remainder = num % radix;

                    num = Math.floor(num / radix);

                    if (remainder > 35) {
                        result += String.fromCharCode(
                            remainder + 29
                        );
                    } else {
                        result += remainder.toString(36);
                    }
                } while (num > 0);

                return result
                    .split("")
                    .reverse()
                    .join("");
            }

            let unpacked = packed;

            for (
                let i = count - 1;
                i >= 0;
                i--
            ) {
                const key = encode(i);

                const value = dictionary[i] || key;

                const keyRegex = new RegExp(
                    "\\b" +
                    key +
                    "\\b",
                    "g"
                );

                unpacked = unpacked.replace(
                    keyRegex,
                    value
                );
            }

            if (unpacked === packed) {
                break;
            }

            result = result.replace(
                match[0],
                unpacked
            );
        }

        return result;
    }

    // ==================================================
    // 提取 newImgs
    // ==================================================

    extractNewImgs(html) {
        let images = [];

        if (!html) {
            return images;
        }

        const newImgsMatch = html.match(
            /(?:var\s+)?newImgs\s*=\s*(?:new\s+Array\s*\()?\s*\[([\s\S]*?)\]/i
        );

        if (!newImgsMatch) {
            return images;
        }

        const body = newImgsMatch[1];

        const urlRegex = /(['"])(.*?)\1/g;

        let match;

        while (
            (match = urlRegex.exec(body)) !== null
        ) {
            let url = this.cleanUrl(
                match[2]
            );

            if (
                /^https?:\/\//i.test(url) &&
                /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)
            ) {
                if (!images.includes(url)) {
                    images.push(url);
                }
            }
        }

        return images;
    }

    // ==================================================
    // 通用图片提取
    // ==================================================

    extractImages(html) {
        if (!html) {
            return [];
        }

        let images = [];

        // 第一优先级：newImgs
        images = this.extractNewImgs(html);

        if (images.length > 0) {
            return [
                ...new Set(images)
            ];
        }

        // 第二优先级：完整图片地址
        const fullRegex =
            /https?:\/\/[^"'\\\s<>]+?\.(?:jpg|jpeg|png|webp)\?[^"'\\\s<>]+/gi;

        let match;

        while (
            (match = fullRegex.exec(html)) !== null
        ) {
            let url = this.cleanUrl(
                match[0]
            );

            if (!images.includes(url)) {
                images.push(url);
            }
        }

        if (images.length > 0) {
            return [
                ...new Set(images)
            ];
        }

        // 第三优先级：cid/key/type
        const cidRegex =
            /https?:\/\/[^"'\\\s<>]+?\.jpg\?cid=\d+&key=[^"'\\\s<>]+?&type=\d+/gi;

        while (
            (match = cidRegex.exec(html)) !== null
        ) {
            let url = this.cleanUrl(
                match[0]
            );

            if (!images.includes(url)) {
                images.push(url);
            }
        }

        if (images.length > 0) {
            return [
                ...new Set(images)
            ];
        }

        // 第四优先级：HTML 图片标签
        const attrRegex =
            /(?:data-src|data-original|data-lazy-src|data-url|data-image|src)\s*=\s*["']([^"']+)["']/gi;

        while (
            (match = attrRegex.exec(html)) !== null
        ) {
            let url = this.cleanUrl(
                match[1]
            );

            if (
                /^https?:\/\//i.test(url) &&
                /\.(jpg|jpeg|png|webp)(\?|$)/i.test(url)
            ) {
                if (!images.includes(url)) {
                    images.push(url);
                }
            }
        }

        images = images.filter(
            url =>
                !url.includes(
                    "page_default_img"
                )
        );

        return [
            ...new Set(images)
        ];
    }

    // ==================================================
    // 首页
    // ==================================================

    explore = [
        {
            title: "动漫屋",

            type: "singlePageWithMultiPart",

            load: async () => {
                const res = await Network.get(
                    this.baseUrl + "/",
                    this.headers
                );

                if (res.status !== 200) {
                    throw "Invalid status code: " +
                        res.status;
                }

                const document = new HtmlDocument(
                    res.body
                );

                const comics = [];

                const seen = new Set();

                for (
                    const a of document.querySelectorAll("a")
                ) {
                    const href =
                        a.attributes["href"] || "";

                    if (!this.isComicUrl(href)) {
                        continue;
                    }

                    const id = this.getComicId(
                        href
                    );

                    if (
                        !id ||
                        seen.has(id)
                    ) {
                        continue;
                    }

                    const img = a.querySelector(
                        "img"
                    );

                    let title = this.cleanText(
                        a.text
                    );

                    if (
                        !title &&
                        img
                    ) {
                        title = this.cleanText(
                            img.attributes["alt"] || ""
                        );
                    }

                    if (!title) {
                        continue;
                    }

                    const cover = this.getImageUrl(
                        img
                    );

                    seen.add(id);

                    if (cover) {
                        comics.push({
                            id: String(id),
                            title: String(title),
                            cover: String(cover)
                        });
                    }
                }

                return {
                    "最新漫画": comics
                };
            }
        }
    ];

    // ==================================================
    // 搜索
    // ==================================================

    search = {
        load: async (
            keyword,
            options,
            page
        ) => {
            const url =
                this.baseUrl +
                "/search?f=2&language=1&title=" +
                encodeURIComponent(
                    String(keyword || "")
                ) +
                "&page=" +
                String(page || 1);

            const res = await Network.get(
                url,
                this.headers
            );

            if (res.status === 404) {
                return {
                    comics: [],

                    maxPage: page
                };
            }

            if (res.status !== 200) {
                throw "Invalid status code: " +
                    res.status;
            }

            const document = new HtmlDocument(
                res.body
            );

            const comics = [];

            const seen = new Set();

            for (
                const a of document.querySelectorAll("a")
            ) {
                const href =
                    a.attributes["href"] || "";

                if (!this.isComicUrl(href)) {
                    continue;
                }

                const id = this.getComicId(
                    href
                );

                if (
                    !id ||
                    seen.has(id)
                ) {
                    continue;
                }

                const img = a.querySelector(
                    "img"
                );

                let title = this.cleanText(
                    a.text
                );

                if (
                    !title &&
                    img
                ) {
                    title = this.cleanText(
                        img.attributes["alt"] || ""
                    );
                }

                if (!title) {
                    title =
                        "漫画 " +
                        String(id);
                }

                const cover = this.getImageUrl(
                    img
                );

                seen.add(id);

                if (cover) {
                    comics.push({
                        id: String(id),
                        title: String(title),
                        cover: String(cover)
                    });
                }
            }

            return {
                comics: comics,

                maxPage:
                    comics.length > 0
                        ? Number(page || 1) + 1
                        : Number(page || 1)
            };
        },

        optionList: []
    };

    // ==================================================
    // 分类
    // ==================================================

    category = {
        title: "动漫屋",
        parts: [
            {
                name: "题材",
                type: "fixed",
                itemType: "category",
                categories: [
                    "全部", "热血", "恋爱", "校园", "冒险", "后宫", "科幻", "战争", "悬疑", "推理",
                    "搞笑", "奇幻", "魔法", "神鬼", "历史", "同人", "运动", "绅士", "机甲"
                ],
                categoryParams: [
                    "", "tag-rexue", "tag-aiqing", "tag-xiaoyuan", "tag-maoxian", "tag-hougong", "tag-kehuan", "tag-zhanzheng", "tag-xuanyi", "tag-zhentan",
                    "tag-gaoxiao", "tag-qihuan", "tag-mofa", "tag-dongfangshengui", "tag-lishi", "tag-tongren", "tag-jingji", "tag-jiecao", "tag-jizhan"
                ]
            },
            {
                name: "地区",
                type: "fixed",
                itemType: "category",
                categories: ["全部", "港台", "日韩", "大陆", "欧美"],
                categoryParams: ["", "hktw", "jpkr", "china", "euus"]
            },
            {
                name: "受众",
                type: "fixed",
                itemType: "category",
                categories: ["全部", "少年向", "少女向", "青年向"],
                categoryParams: ["", "shaonan", "shaonv", "qingnian"]
            }
        ],
        enableRankingPage: false
    };

    categoryComics = {
        load: async (category, param, options, page) => {
            const tag = param || "";
            const statusOpt = (options && options[0]) ? options[0].split("-")[0] : "";
            const sortOpt = (options && options[1]) ? options[1].split("-")[0] : "";
            const payOpt = (options && options[2]) ? options[2].split("-")[0] : "";

            // 构建路径，DM5 移动端 URL 规则通常是 manhua-list-tag-xxx-stx-sx-payx/
            let path = "manhua-list";
            if (tag) path += "-" + tag;
            if (statusOpt && statusOpt !== "st0") path += "-" + statusOpt;
            if (sortOpt && sortOpt !== "s10") path += "-" + sortOpt;
            if (payOpt && payOpt !== "pay-1") path += "-" + payOpt;
            
            // 加上页码
            const pageNum = Number(page || 1);
            if (pageNum > 1) {
                path += "-p" + pageNum;
            }

            const url = this.baseUrl + "/" + path + "/";

            const res = await Network.get(
                url,
                this.headers
            );

            if (res.status !== 200) {
                throw "加载分类失败: " + res.status;
            }

            const document = new HtmlDocument(res.body);
            const comics = [];
            const seen = new Set();

            // 提取列表中的漫画
            // 动漫屋移动端列表通常使用 .manga-list-2 li
            const listItems = document.querySelectorAll(".manga-list-2 li, .manga-list li, .book-list li");
            
            if (listItems.length > 0) {
                for (const item of listItems) {
                    const a = item.querySelector("a");
                    if (!a) continue;

                    const href = a.attributes["href"] || "";
                    if (!this.isComicUrl(href)) continue;

                    const id = this.getComicId(href);
                    if (!id || seen.has(id)) continue;

                    const img = item.querySelector("img");
                    let title = this.cleanText(item.querySelector(".title, .book-list-info-title, .manga-list-2-title")?.text || a.text);
                    
                    if (!title && img) {
                        title = this.cleanText(img.attributes["alt"] || "");
                    }
                    if (!title) title = "漫画 " + id;

                    const cover = this.getImageUrl(img);
                    seen.add(id);

                    comics.push({
                        id: String(id),
                        title: String(title),
                        cover: this.toAbsoluteUrl(cover)
                    });
                }
            }

            // 如果精准提取失败，回退到全局链接扫描
            if (comics.length === 0) {
                for (const a of document.querySelectorAll("a")) {
                    const href = a.attributes["href"] || "";
                    if (!this.isComicUrl(href)) continue;

                    const id = this.getComicId(href);
                    if (!id || seen.has(id)) continue;

                    const img = a.querySelector("img");
                    let title = this.cleanText(a.text);
                    if (!title && img) {
                        title = this.cleanText(img.attributes["alt"] || "");
                    }
                    if (!title) title = "漫画 " + id;

                    const cover = this.getImageUrl(img);
                    seen.add(id);

                    comics.push({
                        id: String(id),
                        title: String(title),
                        cover: this.toAbsoluteUrl(cover)
                    });
                }
            }

            return {
                comics: comics,
                maxPage: comics.length > 0 ? pageNum + 1 : pageNum
            };
        },

        optionList: [
            {
                type: "select",
                label: "状态",
                options: ["st0-全部", "st1-连载", "st2-完结"],
                default: "st0"
            },
            {
                type: "select",
                label: "排序",
                options: ["s10-人气最旺", "s2-最近更新", "s18-最新上架"],
                default: "s10"
            },
            {
                type: "select",
                label: "收费",
                options: ["pay-1-全部", "pay0-免费", "pay1-付费", "pay2-VIP免费"],
                default: "pay-1"
            }
        ]
    };

    // ==================================================
    // 漫画详情
    // ==================================================

    comic = {
        loadInfo: async (id) => {
            const comicId = String(
                id || ""
            );

            const url = this.getComicUrl(
                comicId
            );

            const res = await Network.get(
                url,
                this.headers
            );

            if (res.status !== 200) {
                throw "Invalid status code: " +
                    res.status;
            }

            const document = new HtmlDocument(
                res.body
            );

            let title = "";

            const titleElement =
                document.querySelector("h1") ||
                document.querySelector(".book-title") ||
                document.querySelector(".comic-title");

            if (titleElement) {
                title = this.cleanText(
                    titleElement.text
                );
            }

            if (!title) {
                title =
                    "漫画 " +
                    comicId;
            }

            let cover = "";

            const coverSelectors = [
                ".book-cover img",
                ".comic-cover img",
                ".cover img",
                ".book-img img",
                ".detail-cover img"
            ];

            for (
                const selector of coverSelectors
            ) {
                const img =
                    document.querySelector(
                        selector
                    );

                if (!img) {
                    continue;
                }

                cover = this.getImageUrl(
                    img
                );

                if (cover) {
                    break;
                }
            }

            if (!cover) {
                // 兜底方案：尝试从页面所有图片中找一个可能是封面的
                const allImgs = document.querySelectorAll("img");
                for (const img of allImgs) {
                    const src = this.getImageUrl(img);
                    if (src && (src.includes("cover") || src.includes("title"))) {
                        cover = src;
                        break;
                    }
                }
            }

            let description = "";

            const meta =
                document.querySelector(
                    "meta[name='Description']"
                );

            if (meta) {
                description = String(
                    meta.attributes["content"] || ""
                );
            }

            const chapters = new Map();

            const seen = new Set();

            for (
                const a of document.querySelectorAll("a")
            ) {
                let href =
                    a.attributes["href"] || "";

                href =
                    href
                        .split("?")[0];

                let chapterId = null;

                let match =
                    href.match(
                        /\/(m\d+(?:-p\d+)?)\/?$/i
                    );

                if (match) {
                    chapterId =
                        match[1];
                }

                if (!chapterId) {
                    match =
                        href.match(
                            /\/(manhua-[^/]+-[^/]+)$/i
                        );

                    if (match) {
                        chapterId =
                            match[1];
                    }
                }

                if (
                    !chapterId ||
                    seen.has(chapterId)
                ) {
                    continue;
                }

                let chapterTitle =
                    this.cleanText(
                        a.text
                    );

                if (!chapterTitle) {
                    chapterTitle =
                        String(
                            chapterId
                        );
                }

                seen.add(
                    chapterId
                );

                chapters.set(
                    String(chapterId),

                    String(chapterTitle)
                );
            }

            return new ComicDetails({
                title: String(title),

                cover: String(
                    cover || ""
                ),

                description: String(
                    description
                ),

                tags: {},

                chapters: chapters
            });
        },

        // ==================================================
        // 章节图片
        // ==================================================

        loadEp: async (
            comicId,
            epId
        ) => {
            const chapterId =
                String(
                    epId || ""
                );

            const chapterUrl =
                this.getComicUrl(
                    chapterId
                );

            const res =
                await Network.get(
                    chapterUrl,

                    {
                        ...this.headers,

                        "Referer":
                            chapterUrl
                    }
                );

            if (res.status !== 200) {
                throw "Invalid status code: " +
                    res.status;
            }

            const html =
                res.body;

            // 第一步：解包
            const decoded =
                this.unpackDM5(
                    html
                );

            // 第二步：优先从解包后的内容提取 newImgs
            let images =
                this.extractImages(
                    decoded
                );

            // 第三步：如果解包失败，则从原始 HTML 提取
            if (
                images.length === 0
            ) {
                images =
                    this.extractImages(
                        html
                    );
            }

            if (
                images.length === 0
            ) {
                throw "未找到章节图片";
            }

            // 第四步：清理 URL
            images =
                images
                    .map(
                        url =>
                            this.cleanUrl(
                                url
                            )
                    )
                    .filter(
                        url =>
                            /^https?:\/\//i.test(
                                url
                            )
                    )
                    .filter(
                        url =>
                            !url.endsWith(
                                "\\"
                            )
                    );

            if (
                images.length === 0
            ) {
                throw "章节图片 URL 无效";
            }

            return {
                images: [
                    ...new Set(
                        images
                    )
                ]
            };
        },

        // ==================================================
        // 图片加载回调
        // ==================================================

        onImageLoad: (url, comicId, epId) => {
            let referer = "";

            if (epId && typeof epId === "string") {
                if (!epId.startsWith("http")) {
                    // dm0.8 的 epId 是正则提取后的章节 ID（如 m123、m123-p1、manhua-xxx）
                    // 需要用 getComicUrl 构建完整 URL 作为 Referer
                    referer = this.getComicUrl(epId);

                    // 确保 Referer 以 / 结尾
                    if (!referer.endsWith("/")) {
                        referer += "/";
                    }
                } else {
                    referer = epId;
                }
            } else {
                referer = this.baseUrl + "/";
            }

            return {
                headers: this._buildImageHeaders(url, referer)
            };
        },

        // ==================================================
        // 缩略图加载回调
        // ==================================================

        onThumbnailLoad: (url) => {
            return {
                headers: this._buildImageHeaders(url, this.baseUrl + "/")
            };
        }
    };
}
