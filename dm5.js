// 动漫屋 (m.dm5.com / www.dm5.com) Venera 漫画源
// 版本: 7.0.3
// v7.0.3 修复：部分漫画「下一章」跳成上一章。站点详情页章节列表顺序**因漫画而异**，
//   实测抽样 30 部里有 5 部是倒序（最新话在前），而 Venera 的「下一章」= 列表下标 +1，
//   于是倒序漫画点下一章会回到上一话。现仅在检测到主序列倒序时才重排
//   （主序列按卷号+话号升序，番外/公告等保持在最后），正序漫画原样不动。
//   详见 dm5_bilimanga_development_log.md 第七节。
// v7.0.2 修复：分类点进去 404。旧版 categoryParams 用的是 tag-rexue / hktw / jpkr / china / euus，
//   拼出的 /manhua-list-tag-rexue/ 这类路径在站点上根本不存在（实测 404）。站点真实规则是
//   /manhua-list[-tag{n}|-area{n}][-group{n}][-st{n}][-s{n}][-pay{n}][-p{n}]/，已按真网取证的
//   数字 ID 重建四个 part（题材/地区/受众/状态）并把排序、付费改成官方格式的 optionList。
//   详见 dm5_bilimanga_development_log.md 第三节。
// v7.0.1 修复（按《Venera 漫画源开发日志》取证）：
//   1) 封面显示异常：站点同一张卡片里混有竖版封面(180x240, manga-list-2-cover-img)、
//      横版宣传图(320x246, manga-list-1/rank-list-cover-img)、首页横幅(880x385)和站点 UI 图标。
//      旧版取 <a> 里第一张图，三类非封面图会被当成封面，在竖版网格里被裁成横条。
//      新增 isRealCover()/pickCover()，只接受真实竖版封面，挑不到就跳过该条目。
//   2) 详情页标题永远显示「漫画 {slug}」：移动版没有 h1/.book-title/.comic-title，
//      真实标题在 .detail-main-info-title。已补上，并补 .normal-top-title 兜底。
//   3) 详情页封面为空或取到 /chaptercover/ 无关图：真实封面在 .detail-main-cover img。
//   4) 章节列表串到别的漫画：旧版扫全页 /m{id}/ 链接，命中「相关推荐」里其它漫画的
//      「最新 第N话」。现限定 .detail-list-select（站点对限制漫画隐藏该容器，此时返回空）。
//   5) 详情页补作者/标签/正文简介，并清理章节标题里的更新日期。
class DM5 extends ComicSource {
    name = "动漫屋";

    key = "dm5";

    version = "7.0.3";

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
    // 封面识别（v7.0.1 修复「封面显示有问题」）
    // ==================================================
    //
    // 站点在同一个 <a> 里会混入用途完全不同的图片：
    //   manga-list-2-cover-img / book-list-cover-img / detail-main-bg
    //        -> 竖版封面 180x240，才是真正的封面
    //   manga-list-1-cover-img / rank-list-cover-img
    //        -> 横版宣传图 320x246，实测是横构图插图，不是封面
    //   无 class 的 880x385
    //        -> 首页顶部横幅
    //   /dm5/images/... 下的 index-menu-*.png 等
    //        -> 站点 UI 图标，根本不是漫画
    //
    // 旧版直接 a.querySelector("img") 取第一张图，于是这四类都会被当成封面，
    // 在 Venera 的竖版网格里被裁成奇怪的横条 —— 这就是封面显示异常的根因。
    isRealCover(url, className) {
        const s = String(url || "");

        if (!/^https?:\/\//i.test(s)) {
            return false;
        }

        // 横版宣传图 / 首页横幅
        if (s.indexOf("_320x246") >= 0 || s.indexOf("_880x385") >= 0) {
            return false;
        }

        // 站点静态资源（UI 图标、logo、广告图）
        if (/\/dm5\/images?\//i.test(s) || /\/images\/mobile\//i.test(s)) {
            return false;
        }

        if (/\.(?:gif|svg)(?:\?|$)/i.test(s)) {
            return false;
        }

        const cls = String(className || "");

        if (cls.indexOf("manga-list-1-cover-img") >= 0) {
            return false;
        }

        if (cls.indexOf("rank-list-cover-img") >= 0) {
            return false;
        }

        return true;
    }

    // 在卡片里挑一张真正的竖版封面；挑不到返回空串（调用方跳过该条目）
    pickCover(anchor) {
        if (!anchor) {
            return "";
        }

        const preferred = [
            "manga-list-2-cover-img",
            "book-list-cover-img",
            "detail-main-cover-img",
            "detail-main-bg"
        ];

        for (const cls of preferred) {
            const img = anchor.querySelector("img." + cls);

            if (!img) {
                continue;
            }

            const url = this.getImageUrl(img);

            if (this.isRealCover(url, cls)) {
                return url;
            }
        }

        for (const img of anchor.querySelectorAll("img")) {
            const url = this.getImageUrl(img);

            if (this.isRealCover(url, img.attributes["class"])) {
                return url;
            }
        }

        return "";
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
    // 章节顺序归一化（v7.0.3）
    // ==================================================
    // 真网实测（2026-10-02）：动漫屋详情页的章节列表顺序**因漫画而异**。
    // 抽样 30 部：25 部是正序（第1话在前），5 部是倒序（最新话在前）：
    //   manhua-luonalita / manhua-shining / manhua-xiabeiziwozaihaohaoguo /
    //   manhua-kaishichengweishijiezuiqiangdemonv--… / manhua-beizhuifangdezhuansheng…
    // 而 Venera 的「下一章」是按章节在列表里的下标 +1 走的
    // （lib/pages/reader/reader.dart: toNextChapter() -> toChapter(chapter + 1)），
    // 所以倒序列表会让「下一章」跳到上一话（用户实测：看第2话点下一章跳到第1话）。
    //
    // 处理策略：**只有检测到主序列确实是倒序时才重排**；正序列表原样返回（零风险）。
    // 重排规则：主序列（话/回/集/章）按卷号+话号升序，其余条目（番外/公告/杂图等）
    // 保持站点原有相对顺序接在最后 —— 这也正是正序漫画的既有排版。
    parseChapterKey(title) {
        const text = String(title == null ? "" : title);

        const chapterMatch = text.match(
            /第\s*(\d+(?:\.\d+)?)\s*(?:话|話|回|集|章|節|节)/
        );

        const volumeMatch =
            text.match(/第\s*(\d+(?:\.\d+)?)\s*(?:卷|冊|册)/) ||
            text.match(/^\s*(\d+(?:\.\d+)?)\s*(?:卷|冊|册)/);

        if (chapterMatch) {
            return {
                series: "chapter",
                volume: volumeMatch ? parseFloat(volumeMatch[1]) : 0,
                number: parseFloat(chapterMatch[1])
            };
        }

        if (volumeMatch) {
            return {
                series: "volume",
                volume: 0,
                number: parseFloat(volumeMatch[1])
            };
        }

        return null;
    }

    normalizeChapterOrder(chapters) {
        const items = [];

        let position = 0;

        for (const entry of chapters.entries()) {
            items.push({
                id: entry[0],
                title: entry[1],
                position: position++,
                key: this.parseChapterKey(entry[1])
            });
        }

        // 按序列类型分组，取条目最多的那一组当主序列
        const groups = {};

        for (const item of items) {
            if (!item.key) continue;
            if (!groups[item.key.series]) groups[item.key.series] = [];
            groups[item.key.series].push(item);
        }

        let mainSeries = null;

        for (const name of Object.keys(groups)) {
            if (
                !mainSeries ||
                groups[name].length > groups[mainSeries].length
            ) {
                mainSeries = name;
            }
        }

        // 样本太少就不动，避免误判
        if (!mainSeries || groups[mainSeries].length < 3) {
            return chapters;
        }

        const mainItems = groups[mainSeries];

        const first = mainItems[0].key;

        const last = mainItems[mainItems.length - 1].key;

        const descending =
            first.volume > last.volume ||
            (first.volume === last.volume && first.number > last.number);

        // 已经是正序 —— 原样返回
        if (!descending) {
            return chapters;
        }

        const sorted = mainItems.slice().sort((a, b) => {
            if (a.key.volume !== b.key.volume) {
                return a.key.volume - b.key.volume;
            }
            if (a.key.number !== b.key.number) {
                return a.key.number - b.key.number;
            }
            return a.position - b.position;
        });

        const ordered = new Map();

        for (const item of sorted) {
            ordered.set(item.id, item.title);
        }

        // 非主序列条目（番外、公告、杂图……）按站点原顺序接在后面
        for (const item of items) {
            if (item.key && item.key.series === mainSeries) continue;
            ordered.set(item.id, item.title);
        }

        return ordered;
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

                    // 竖版封面卡片既没有文本也没有 img.alt，标题只放在 <a title>
                    if (!title) {
                        title = this.cleanText(
                            a.attributes["title"] || ""
                        );
                    }

                    if (!title) {
                        continue;
                    }

                    // 只接受真正的竖版封面：横版宣传图/首页横幅/站点图标一律跳过
                    const cover = this.pickCover(a);

                    // 注意：必须在确认有封面之后才标记 seen。
                    // 同一本漫画可能同时出现在「横版缩略图」模块和「竖版封面」模块里，
                    // 若提前标记 seen，后面那条带正确封面的记录会被去重掉（实测少 10 本）。
                    if (!cover) {
                        continue;
                    }

                    seen.add(id);

                    comics.push({
                        id: String(id),
                        title: String(title),
                        cover: String(cover)
                    });
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

                // 竖版封面卡片没有文本也没有 img.alt，标题只放在 <a title>
                if (!title) {
                    title = this.cleanText(
                        a.attributes["title"] || ""
                    );
                }

                if (!title) {
                    title =
                        "漫画 " +
                        String(id);
                }

                // 只接受真正的竖版封面
                const cover = this.pickCover(a);

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

    // ==================================================
    // 分类（v7.0.2 修复）
    // ==================================================
    //
    // 站点真实的分类 URL 是 manhua-list 加各维度后缀，顺序固定：
    //   /manhua-list[-tag{n}|-area{n}][-group{n}][-st{n}][-s{n}][-pay{n}][-p{n}]/
    // 旧版参数（tag-rexue / hktw / jpkr / china / euus）实测全部 404 ——
    // /manhua-list-tag-rexue/ 这种路径在站点上根本不存在，所以点分类打不开。
    //
    // 维度 ID（真网逐个取证，2026-09-27）：
    //   题材 tag  ：校园1 冒险2 历史4 后宫8 战争12 奇幻14 魔法15 悬疑17 神鬼20
    //              科幻25 恋爱26 同人30 热血31 推理33 运动34 绅士36 搞笑37 机甲40
    //   地区 area ：港台35 日韩36 大陆37 欧美52
    //   受众 group：少年向1 少女向2 青年向3
    //   状态 st   ：连载1 完结2
    //   排序 s    ：最热10 最近更新2 最新上架18
    //   付费 pay  ：免费0 付费1 VIP免费2
    // 实测组合：tag+st+s+p ✓、area+group+st+s+p ✓、tag+group+st+s+p ✓、tag+pay+st+p ✓；
    // 但 **题材与地区不能同时用**（/manhua-list-tag31-area35/ 实测 404）。
    static dm5Tags = [
        ["校园", "tag1"], ["冒险", "tag2"], ["历史", "tag4"], ["后宫", "tag8"],
        ["战争", "tag12"], ["奇幻", "tag14"], ["魔法", "tag15"], ["悬疑", "tag17"],
        ["神鬼", "tag20"], ["科幻", "tag25"], ["恋爱", "tag26"], ["同人", "tag30"],
        ["热血", "tag31"], ["推理", "tag33"], ["运动", "tag34"], ["绅士", "tag36"],
        ["搞笑", "tag37"], ["机甲", "tag40"]
    ];
    static dm5Areas = [["港台", "area35"], ["日韩", "area36"], ["大陆", "area37"], ["欧美", "area52"]];
    static dm5Groups = [["少年向", "group1"], ["少女向", "group2"], ["青年向", "group3"]];
    static dm5Status = [["连载中", "st1"], ["已完结", "st2"]];

    category = {
        title: "动漫屋",
        parts: [
            {
                name: "题材",
                type: "fixed",
                itemType: "category",
                categories: ["全部"].concat(DM5.dm5Tags.map((e) => e[0])),
                categoryParams: [""].concat(DM5.dm5Tags.map((e) => e[1]))
            },
            {
                name: "地区",
                type: "fixed",
                itemType: "category",
                categories: ["全部"].concat(DM5.dm5Areas.map((e) => e[0])),
                categoryParams: [""].concat(DM5.dm5Areas.map((e) => e[1]))
            },
            {
                name: "受众",
                type: "fixed",
                itemType: "category",
                categories: ["全部"].concat(DM5.dm5Groups.map((e) => e[0])),
                categoryParams: [""].concat(DM5.dm5Groups.map((e) => e[1]))
            },
            {
                name: "状态",
                type: "fixed",
                itemType: "category",
                categories: ["全部"].concat(DM5.dm5Status.map((e) => e[0])),
                categoryParams: [""].concat(DM5.dm5Status.map((e) => e[1]))
            }
        ],
        enableRankingPage: false
    };

    categoryComics = {
        load: async (category, param, options, page) => {
            const pageNum = Number(page || 1) > 0 ? Number(page || 1) : 1;

            // optionList 的取值形如 "s10-人氣最旺" / "x-全部"，取 "-" 前面的值，"x" 表示不加该维度
            const optValue = (i) => {
                const raw = options && options[i] != null ? String(options[i]) : "";
                const v = raw.split("-")[0].trim();
                return v === "x" ? "" : v;
            };

            // param 形如 tag31 / area35 / group1 / st1（来自 category 各 part）。
            // 只接受这个形态，避免旧版参数（tag-rexue / hktw …）拼出 404 路径。
            const seg = String(param || "").trim().replace(/^-+/, "");
            let path = "manhua-list";
            if (/^(?:tag|area|group|st)\d+$/.test(seg)) {
                path += "-" + seg;
            }

            const sortOpt = optValue(0);
            if (sortOpt && sortOpt !== "s10") path += "-" + sortOpt;
            const payOpt = optValue(1);
            if (payOpt && /^pay\d+$/.test(payOpt)) path += "-" + payOpt;
            
            // 加上页码
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
                    if (!title) {
                        title = this.cleanText(a.attributes["title"] || "");
                    }
                    if (!title) title = "漫画 " + id;

                    // 只接受真正的竖版封面
                    const cover = this.pickCover(a);
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
                    if (!title) {
                        title = this.cleanText(a.attributes["title"] || "");
                    }
                    if (!title) title = "漫画 " + id;

                    // 只接受真正的竖版封面
                    const cover = this.pickCover(a);
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

                // 站点不公开总页数（移动页没有分页控件，PC 分页器也是窗口式只显示到第 10 页），
                // 因此用页面自带的 pagesize 与「本页是否满页」判断是否还有下一页：
                // 满页 => 可能还有；不满页或空 => 已到末页。
                maxPage: (() => {
                    const pageSize = Number((String(res.body).match(/var pagesize = "(\d+)"/) || [])[1]) || 0;
                    return pageSize > 0 && comics.length >= pageSize ? pageNum + 1 : pageNum;
                })()
            };
        },

        optionList: [
            // 官方格式：每个选项用 "-" 分隔「值-显示文本」
            { options: ["s10-人氣最旺", "s2-最近更新", "s18-最新上架"] },
            { options: ["x-全部", "pay0-免費", "pay1-付費", "pay2-VIP免費"] }
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

            // 移动版详情页实测没有 h1 / .book-title / .comic-title，
            // 真实标题在 .detail-main-info-title（另有一处 .normal-top-title）。
            // 旧版只用 h1/.book-title/.comic-title，导致标题永远回退成「漫画 {slug}」。
            const titleElement =
                document.querySelector(".detail-main-info-title") ||
                document.querySelector(".normal-top-title") ||
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

            // 移动版详情页的真实封面是 .detail-main-cover 里的 img（180x240 竖版）；
            // 同一张图也在 img.detail-main-bg 上。旧版的选择器都不匹配，
            // 兜底逻辑又会命中 /chaptercover/ 这类无关图片。
            const coverSelectors = [
                ".detail-main-cover img",
                "img.detail-main-bg",
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
                // 兜底方案：从页面所有图片里找一张真正的竖版封面。
                // 注意不能只按 URL 里是否含 "cover"/"title" 判断：
                // 页面里的 /chaptercover/xxx.jpg 含 "cover" 但那是无关的章节封面图。
                const allImgs = document.querySelectorAll("img");
                for (const img of allImgs) {
                    const src = this.getImageUrl(img);
                    if (this.isRealCover(src, img.attributes["class"])) {
                        cover = src;
                        break;
                    }
                }
            }

            // 简介：移动版在 .detail-desc；旧版只读 meta[name='Description']（能用但不如页面正文准）
            let description = "";

            const descEl = document.querySelector(".detail-desc");

            if (descEl) {
                description = this.cleanText(descEl.text);
            }

            if (!description) {
            const meta =
                document.querySelector(
                    "meta[name='Description']"
                );

            if (meta) {
                description = String(
                    meta.attributes["content"] || ""
                );
            }
            }

            // 作者 / 标签（移动版详情页）
            const authors = [];

            for (const a of document.querySelectorAll(".detail-main-info-author a")) {
                const t = this.cleanText(a.text);

                if (t && authors.indexOf(t) < 0) {
                    authors.push(t);
                }
            }

            const genreTags = [];

            for (const a of document.querySelectorAll(".detail-main-info-class a")) {
                const t = this.cleanText(a.text);

                if (t && genreTags.indexOf(t) < 0) {
                    genreTags.push(t);
                }
            }

            const chapters = new Map();

            const seen = new Set();

            // 章节列表只在 .detail-list-select 里。
            // 旧版扫全页的 /m{id}/ 链接，会把页面下方「相关推荐」里其它漫画的
            // 「最新 第N话」当成本书章节（实测海贼王拿到 6 条全是《海贼王 艾斯》的章节）。
            // 站点对「限制漫画」隐藏该容器（18+ 门禁），此时宁可为空也不返回错误章节。
            for (
                const a of document.querySelectorAll(".detail-list-select a")
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

                // .detail-list-select 的 <a> 文本里还带着更新日期（如「第1回 … 2021-08-23」），
                // 去掉行尾的 YYYY-MM-DD 让章节标题干净
                chapterTitle = chapterTitle
                    .replace(/\s*\d{4}-\d{2}-\d{2}\s*$/, "")
                    .trim();

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

                tags: (() => {
                    const t = {};

                    if (authors.length > 0) {
                        t["作者"] = authors;
                    }

                    if (genreTags.length > 0) {
                        t["标签"] = genreTags;
                    }

                    return t;
                })(),

                chapters: this.normalizeChapterOrder(chapters)
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
