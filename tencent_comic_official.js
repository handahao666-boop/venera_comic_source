/**
 * 腾讯动漫（正版） Venera 漫画源
 * 站点：m.ac.qq.com
 *
 * 开发日志：
 * - v1.0.3：适配腾讯动漫章节 plain 响应的动态 nonce 标记拆分和数字表达式变体；
 *   同时兼容无 nonce 的直接 Base64 响应，修复章节图片偶发“无效参数”。
 * - v1.0.2：修复详情页 meta[itemprop=image] 实为腾讯动漫通用分享图标的问题；
 *   改从首章节页实际元数据取得漫画竖版封面，并由 onThumbnailLoad 加载历史封面。
 * - v1.0.1：修复历史页可能传入完整章节 URL/组合 ID 的兼容问题；
 *   将还原后的 Base64 规范化并补齐 `=` Padding，避免不同章节在 Venera 原生转换层触发“无效参数”。
 * - v1.0.0：基于移动站真实页面和官方前端脚本实现。
 * - 首页推荐：section.mod-item / .comic-item。
 * - 搜索：GET /search/result?word={keyword}，结果为 #lst_searchResult .comic-item。
 * - 分类：GET /category/listAll/type/{type}/rank/{rank}?page={n}&pageSize=15&style=items。
 * - 章节：GET /chapter/index/id/{comicId}/cid/{cid}?style=plain；响应含混入字符的 Base64 JSON。
 *   真实前端通过 nonce 中的“数字+字母”指令逆序移除干扰字符后再 Base64 解码。
 * - 【重点】本源只返回响应中 chapter.canRead !== false 的图片；不会绕过腾讯动漫的正版付费与阅读权限。
 * - 【重点】每次改动必须重新验证首页、搜索、分类、详情、章节和图片六条链路。
 */
class TencentComicOfficial extends ComicSource {
    name = "腾讯动漫（正版）"
    key = "qq_comic_official_v1"
    version = "1.0.3"
    minAppVersion = "1.0.0"
    url = ""

    baseUrl = "https://m.ac.qq.com"
    headers = {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1"
    }

    // Venera 历史页通过此钩子加载 History.cover；确保真实封面按腾讯动漫移动站上下文请求。
    onThumbnailLoad = (url) => ({
        url: this.absoluteUrl(String(url || "")),
        headers: {
            "Referer": this.baseUrl + "/",
            "User-Agent": this.headers["User-Agent"]
        }
    })

    absoluteUrl(path) {
        if (!path) return "";
        if (path.startsWith("https://") || path.startsWith("http://")) return path;
        if (path.startsWith("//")) return "https:" + path;
        return path.startsWith("/") ? this.baseUrl + path : this.baseUrl + "/" + path;
    }

    normalizeText(value) {
        return String(value || "").replace(/\s+/g, " ").trim();
    }

    comicIdFromHref(href) {
        const match = String(href || "").match(/\/comic\/index\/id\/(\d+)/i);
        return match ? match[1] : "";
    }

    parseComicItem(item) {
        const link = item.querySelector('.comic-link');
        const titleEl = item.querySelector('.comic-title');
        if (!link || !titleEl) return null;

        const coverEl = item.querySelector('.cover-image');
        const update = this.normalizeText(item.querySelector('.comic-update')?.text);
        const tagsText = this.normalizeText(item.querySelector('.comic-tag')?.text);
        const desc = this.normalizeText(item.querySelector('.comic-desc')?.text);
        const subTitle = [update, tagsText].filter(e => e).join(" · ");

        return new Comic({
            id: this.comicIdFromHref(link.attributes.href),
            title: this.normalizeText(titleEl.text),
            cover: this.absoluteUrl(coverEl?.attributes.src || coverEl?.attributes['data-original'] || ""),
            subTitle: subTitle,
            description: desc,
            tags: tagsText ? tagsText.split(/\s+/) : []
        });
    }

    parseComicItems(doc, selector) {
        const comics = [];
        const seen = new Set();
        for (const item of doc.querySelectorAll(selector)) {
            const comic = this.parseComicItem(item);
            if (comic && comic.id && !seen.has(comic.id)) {
                seen.add(comic.id);
                comics.push(comic);
            }
        }
        return comics;
    }

    // 分类异步接口的原始前端以 pageSize=15 请求；当前实测首、二页均为 14 项，第三页已无项目。
    // 因此只在第 1 页有项目时开放第 2 页，避免将不存在的后续页作为有效分页。
    getCategoryMaxPage(currentPage, itemCount) {
        if (currentPage === 1 && itemCount > 0) return 2;
        return currentPage;
    }

    // 仅解释腾讯动漫 nonce 内已取证的数字变体；不执行服务端响应中的 JavaScript。
    evaluateNonceNumber(expression) {
        let safe = String(expression || "").replace(/\s+/g, "");

        // 已从多个真实章节响应中验证的无副作用表达式变体。
        safe = safe
            .replace(/'([^']*)'\.charCodeAt\(\)/g, (all, text) => String(text.charCodeAt(0)))
            .replace(/"([^"]*)"\.charCodeAt\(\)/g, (all, text) => String(text.charCodeAt(0)))
            .replace(/'([^']*)'\.substring\((\d+)(?:,(\d+))?\)/g, (all, text, start, end) => String(Number(text.substring(Number(start), end === undefined ? undefined : Number(end)))))
            .replace(/"([^"]*)"\.substring\((\d+)(?:,(\d+))?\)/g, (all, text, start, end) => String(Number(text.substring(Number(start), end === undefined ? undefined : Number(end)))))
            .replace(/parseInt\((\d+(?:\.\d+)?[+\-*/]\d+(?:\.\d+)?)\)/g, (all, inner) => String(parseInt(this.evaluateNonceNumber(inner), 10)))
            .replace(/Math\.pow\((\d+),(\d+)\)/g, (all, base, power) => String(Math.pow(Number(base), Number(power))))
            .replace(/Math\.round\((\d*\.?\d+)\)/g, (all, value) => String(Math.round(Number(value))))
            .replace(/~~(\d+(?:\.\d+)?)/g, (all, value) => String(Math.trunc(Number(value))))
            // document.getElementsByTagName 返回 HTMLCollection，在网站浏览器环境中始终为真。
            .replace(/!!document\.getElementsByTagName\(['"][^'"]+['"]\)/g, "1")
            .replace(/!!\d+/g, "1")
            .replace(/!\d+/g, (all) => Number(all.substring(1)) === 0 ? "1" : "0");

        // 真实响应还会使用简单三目比较，例如 0<=3?2:1。
        const ternary = safe.match(/^(\d+)(<=|>=|===|==|!==|!=|<|>)(\d+)\?(\d+):(\d+)$/);
        if (ternary) {
            const left = Number(ternary[1]);
            const right = Number(ternary[3]);
            let condition = false;
            if (ternary[2] === "<=") condition = left <= right;
            else if (ternary[2] === ">=") condition = left >= right;
            else if (ternary[2] === "<") condition = left < right;
            else if (ternary[2] === ">") condition = left > right;
            else if (ternary[2] === "==" || ternary[2] === "===") condition = left === right;
            else condition = left !== right;
            return condition ? ternary[4] : ternary[5];
        }

        if (!/^[0-9+\-*/&|().]+$/.test(safe)) throw "不支持的 nonce 数字表达式";
        let pos = 0;
        const parseFactor = () => {
            if (safe[pos] === "+") pos++;
            if (safe[pos] === "-") return -(pos++, parseFactor());
            if (safe[pos] === "(") {
                pos++;
                const value = parseBitOr();
                if (safe[pos] !== ")") throw "nonce 括号不匹配";
                pos++;
                return value;
            }
            const match = safe.substring(pos).match(/^(\d+(?:\.\d+)?)/);
            if (!match) throw "nonce 数字表达式无效";
            pos += match[1].length;
            return Number(match[1]);
        };
        const parseTerm = () => {
            let value = parseFactor();
            while (safe[pos] === "*" || safe[pos] === "/") {
                const op = safe[pos++];
                const right = parseFactor();
                value = op === "*" ? value * right : value / right;
            }
            return value;
        };
        const parseSum = () => {
            let value = parseTerm();
            while (safe[pos] === "+" || safe[pos] === "-") {
                const op = safe[pos++];
                const right = parseTerm();
                value = op === "+" ? value + right : value - right;
            }
            return value;
        };
        const parseBitAnd = () => {
            let value = parseSum();
            while (safe[pos] === "&") {
                pos++;
                value = (value | 0) & (parseSum() | 0);
            }
            return value;
        };
        const parseBitOr = () => {
            let value = parseBitAnd();
            while (safe[pos] === "|") {
                pos++;
                value = (value | 0) | (parseBitAnd() | 0);
            }
            return value;
        };

        const value = parseBitOr();
        if (pos !== safe.length || !isFinite(value)) throw "nonce 数字表达式无效";
        return String(Math.floor(value) === value ? Math.floor(value) : value);
    }

    // nonce 的 window 属性名会动态拆分为 no+nce、n+once、non+ce 等形式。
    findNonceAssignmentIndex(plainResponse) {
        const match = String(plainResponse || "").match(/window\[\s*"[^"]+"\s*\+\s*"[^"]+"\s*\]\s*=/);
        return match ? match.index : -1;
    }

    // plain 响应的 nonce 行形如：window["n"+"once"] = "abc" + (+eval("2+3")).toString()。
    // 只提取字符串常量与已白名单解析的数字表达式，不执行服务器返回的 JS。
    extractNonce(plainResponse, start) {
        const index = start === undefined ? this.findNonceAssignmentIndex(plainResponse) : start;
        if (index < 0) throw "章节响应中未找到 nonce";
        const nonceLine = String(plainResponse).substring(index).split(/\r?\n/)[0];
        const equalIndex = nonceLine.indexOf('=');
        if (equalIndex < 0) throw "章节 nonce 格式不匹配";
        const assignment = nonceLine.substring(equalIndex + 1).trim().replace(/;$/, "");

        let nonce = "";
        const partPattern = /\(\+eval\("([^"]+)"\)\)\.toString\(\)|"([^"]*)"/g;
        let part;
        while ((part = partPattern.exec(assignment)) !== null) {
            nonce += part[1] !== undefined ? this.evaluateNonceNumber(part[1]) : part[2];
        }
        if (!nonce) throw "章节 nonce 为空";
        return nonce;
    }

    // 兼容目录页和历史页传入的纯 cid、完整章节 URL、或 comicId|cid 组合 ID。
    normalizeChapterIdentifiers(comicId, epId) {
        const rawComicId = String(comicId || "");
        const rawEpId = String(epId || "");
        const combined = rawComicId + " " + rawEpId;
        const urlMatch = combined.match(/\/chapter\/index\/id\/(\d+)\/cid\/(\d+)/i);
        if (urlMatch) return { comicId: urlMatch[1], cid: urlMatch[2] };

        const pairMatch = combined.match(/(?:^|\s)(\d+)\s*[|,:_]\s*(\d+)(?:$|\s)/);
        if (pairMatch) return { comicId: pairMatch[1], cid: pairMatch[2] };

        if (/^\d+$/.test(rawComicId) && /^\d+$/.test(rawEpId)) {
            return { comicId: rawComicId, cid: rawEpId };
        }
        return null;
    }

    // 腾讯动漫章节前端的真实还原逻辑：根据 nonce 逆序删除干扰字符，再做 Base64 → UTF-8 → JSON。
    // 部分真实响应会直接给出 Base64，此时没有 nonce 行且无需删除字符。
    decodePlainChapter(plainResponse) {
        const response = String(plainResponse || "").trim();
        const markerIndex = this.findNonceAssignmentIndex(response);
        const raw = markerIndex >= 0 ? response.substring(0, markerIndex).trim() : response;
        const nonce = markerIndex >= 0 ? this.extractNonce(response, markerIndex) : null;
        const instructions = nonce ? (nonce.match(/\d+[a-zA-Z]+/g) || []) : [];
        const chars = raw.split("");

        for (let index = instructions.length - 1; index >= 0; index--) {
            const instruction = instructions[index];
            const position = parseInt(instruction.match(/\d+/)[0]) & 255;
            const interference = instruction.replace(/\d+/g, "");
            chars.splice(position, interference.length);
        }

        // Venera 的原生 Base64 转换需要标准 Base64；不同章节可能缺少末尾 Padding。
        let encoded = chars.join("").replace(/-/g, "+").replace(/_/g, "/");
        const padding = (4 - encoded.length % 4) % 4;
        if (padding > 0) encoded += "=".repeat(padding);
        const jsonText = Convert.decodeUtf8(Convert.decodeBase64(encoded));
        return JSON.parse(jsonText);
    }

    explore = [
        {
            title: "腾讯动漫（正版）",
            type: "singlePageWithMultiPart",
            load: async () => {
                try {
                    const res = await Network.get(this.baseUrl + "/", this.headers);
                    if (!res || !res.body) return {};
                    const doc = new HtmlDocument(res.body);
                    const result = {};
                    const sections = doc.querySelectorAll('section.mod-item');

                    for (const section of sections) {
                        const titleEl = section.querySelector('.title-content') || section.querySelector('.sub-title');
                        const title = this.normalizeText(titleEl?.text);
                        const comics = this.parseComicItems(section, '.comic-item');
                        if (title && comics.length > 0) result[title] = comics;
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
        title: "腾讯动漫（正版）",
        parts: [
            {
                name: "作品类型",
                type: "fixed",
                categories: ["条漫", "独家", "完结", "日漫", "恋爱", "玄幻", "热血", "悬疑", "少女", "韩漫", "科幻", "逗比", "校园", "都市", "治愈", "恐怖", "妖怪"],
                categoryParams: ["tm|upt", "dj|upt", "wj|upt", "rm|upt", "na|pgv", "xh|pgv", "rx|pgv", "xy|pgv", "sv|pgv", "hm|pgv", "kh|pgv", "db|pgv", "qcxy|pgv", "ds|pgv", "zy|pgv", "kb|pgv", "yg|pgv"],
                itemType: "category"
            }
        ],
        enableRankingPage: false
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            try {
                const values = String(param || "na|pgv").split("|");
                const type = values[0] || "na";
                const rank = values[1] || "pgv";
                const url = this.baseUrl + "/category/listAll/type/" + encodeURIComponent(type) + "/rank/" + encodeURIComponent(rank) + "?page=" + page + "&pageSize=15&style=items";
                const res = await Network.get(url, this.headers);
                if (!res || !res.body) return { comics: [], maxPage: page };
                const doc = new HtmlDocument(res.body);
                const comics = this.parseComicItems(doc, '.comic-item');
                doc.dispose();
                return { comics: comics, maxPage: this.getCategoryMaxPage(page, comics.length) };
            } catch (e) {
                return { comics: [], maxPage: page };
            }
        }
    }

    search = {
        load: async (keyword, options, page) => {
            // 当前移动站实测搜索页没有提供分页控件，因此仅声明并返回已验证的第 1 页。
            if (page > 1) return { comics: [], maxPage: 1 };
            try {
                const url = this.baseUrl + "/search/result?word=" + encodeURIComponent(keyword);
                const res = await Network.get(url, this.headers);
                if (!res || !res.body) return { comics: [], maxPage: 1 };
                const doc = new HtmlDocument(res.body);
                const comics = this.parseComicItems(doc, '#lst_searchResult .comic-item');
                doc.dispose();
                return { comics: comics, maxPage: 1 };
            } catch (e) {
                return { comics: [], maxPage: 1 };
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            try {
                const res = await Network.get(this.baseUrl + "/comic/index/id/" + id, this.headers);
                if (!res || !res.body) throw "详情页为空";
                const doc = new HtmlDocument(res.body);

                const title = this.normalizeText(doc.querySelector('.head-title-tags h1')?.text || doc.querySelector('h1')?.text);
                // 详情页 meta[itemprop=image] 是站点通用 share-icon，不能作为漫画封面。
                // 先使用详情页的实际横幅作为回退；随后优先由首章节页补全竖版漫画封面。
                let cover = this.absoluteUrl(doc.querySelector('.head-cover')?.attributes.src || "");
                const description = this.normalizeText(doc.querySelector('.head-info-desc')?.text);
                const author = this.normalizeText(doc.querySelector('.head-info-author')?.text).replace(/^作者[：:]?/, "");
                const tags = {};
                if (author) tags["作者"] = [author];

                const chapters = new Map();
                const previewChapter = doc.querySelector('.chapter-link');
                const firstCid = previewChapter?.attributes['data-cid'];
                for (const chapter of doc.querySelectorAll('.chapter-link')) {
                    const cid = chapter.attributes['data-cid'];
                    const chapterTitle = this.normalizeText(chapter.querySelector('.chapter-title')?.text);
                    if (cid && chapterTitle && !chapters.has(cid)) chapters.set(cid, chapterTitle);
                }
                doc.dispose();

                // 详情页只展示目录预览；实测公开章节页 #data_chapterInfo 内嵌完整章节 JSON。
                if (firstCid) {
                    const chapterRes = await Network.get(this.baseUrl + "/chapter/index/id/" + id + "/cid/" + firstCid, this.headers);
                    if (chapterRes && chapterRes.body) {
                        const chapterDoc = new HtmlDocument(chapterRes.body);
                        // 章节页的 itemprop=image 是该漫画实际竖版封面，不是详情页的通用分享图标。
                        const chapterCover = this.absoluteUrl(chapterDoc.querySelector('meta[itemprop="image"]')?.attributes.content || "");
                        if (chapterCover) cover = chapterCover;
                        const chapterDataText = chapterDoc.getElementById('data_chapterInfo')?.text;
                        if (chapterDataText) {
                            const chapterData = JSON.parse(chapterDataText);
                            for (const chapter of chapterData) {
                                const cid = String(chapter.cid || "");
                                const chapterTitle = this.normalizeText(chapter.title || chapter.cTitle);
                                if (cid && chapterTitle && !chapters.has(cid)) chapters.set(cid, chapterTitle);
                            }
                        }
                        chapterDoc.dispose();
                    }
                }

                return new ComicDetails({
                    title,
                    cover,
                    description,
                    tags,
                    chapters,
                    // 缩略图用于详情预览；历史列表仍以 cover 作为唯一漫画封面。
                    thumbnails: cover ? [cover] : []
                });
            } catch (e) {
                return new ComicDetails({ title: "加载失败", chapters: new Map() });
            }
        },

        loadEp: async (comicId, epId) => {
            try {
                const ids = this.normalizeChapterIdentifiers(comicId, epId);
                // 参数不完整时直接返回空数组，避免向站点发出畸形 URL 并触发客户端“无效参数”。
                if (!ids) return { images: [] };

                const url = this.baseUrl + "/chapter/index/id/" + ids.comicId + "/cid/" + ids.cid + "?style=plain";
                const res = await Network.get(url, this.headers);
                if (!res || !res.body) return { images: [] };
                const data = this.decodePlainChapter(String(res.body));

                // 正版权限控制：页面数据明确标记为不可读时，不返回图片。
                if (data.chapter && data.chapter.canRead === false) return { images: [] };
                const images = [];
                const seen = new Set();
                for (const picture of (data.picture || [])) {
                    const imageUrl = this.absoluteUrl(picture.url || "");
                    if (imageUrl && !seen.has(imageUrl)) {
                        seen.add(imageUrl);
                        images.push(imageUrl);
                    }
                }
                return { images: images };
            } catch (e) {
                return { images: [] };
            }
        }
    }
}
