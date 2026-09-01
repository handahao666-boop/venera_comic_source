
class GuaziManhua extends ComicSource {
    name = "瓜子漫画"
    key = "guazimanhua"
    version = "1.0.4"
    minAppVersion = "1.0.0"
    url = ""

    get baseUrl() {
        return "https://www.guazimanhua.com"
    }

    // ========== 工具函数 ==========

    absoluteUrl(url) {
        if (!url) return ""
        url = String(url).trim()
        if (!url) return ""
        if (url.startsWith("//")) return "https:" + url
        if (url.startsWith("http://") || url.startsWith("https://")) return url
        if (url.startsWith("/")) return this.baseUrl + url
        return this.baseUrl + "/" + url
    }

    cleanText(value) {
        if (value == null) return ""
        return String(value).replace(/\s+/g, " ").trim()
    }

    comicIdFromHref(href) {
        if (!href) return ""
        let m = String(href).match(/[?&]id=(\d+)/i)
        return m ? m[1] : ""
    }

    /**
     * 从HTML中提取JSON-LD数据
     */
    extractJsonLd(html) {
        const results = []
        try {
            const regex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
            let match
            while ((match = regex.exec(html)) !== null) {
                try {
                    results.push(JSON.parse(match[1].trim()))
                } catch (e) {}
            }
        } catch (e) {}
        return results
    }

    /**
     * 从JSON-LD中查找指定类型
     */
    findJsonLdType(jsonLdList, type) {
        for (const data of jsonLdList) {
            const graph = data["@graph"] || [data]
            for (const item of graph) {
                if (item["@type"] === type) return item
                if (Array.isArray(item["@type"]) && item["@type"].includes(type)) return item
            }
        }
        return null
    }

    imageUrl(element) {
        if (!element) return ""
        let attrs = ["data-original", "data-src", "data-lazy-src", "data-url", "src"]
        for (let name of attrs) {
            let value = element.attributes[name]
            if (value && !value.startsWith("data:image")) {
                return this.absoluteUrl(value)
            }
        }
        return ""
    }

    // ========== 卡片解析（精确选择器版本） ==========

    /**
     * 解析搜索/分类页的标准卡片 article.card
     */
    parseStandardCard(card) {
        try {
            const link = card.querySelector("a.cover-wrap")
            const titleEl = card.querySelector("h3 a")
            const coverEl = card.querySelector("img.cover")
            const metaEl = card.querySelector(".meta")

            if (!link || !titleEl) return null

            const id = this.comicIdFromHref(link.attributes.href)
            if (!id) return null

            const title = this.cleanText(titleEl.text)
            if (!title) return null

            const cover = coverEl ? this.imageUrl(coverEl) : ""
            const subTitle = this.cleanText(metaEl?.text || "")

            return new Comic({
                id: String(id),
                title: String(title),
                cover: String(cover),
                subTitle: String(subTitle)
            })
        } catch (e) {
            return null
        }
    }

    /**
     * 解析首页卡片（hot-art / mobile-comic-art）
     */
    parseHomeCard(card, artSelector) {
        try {
            const link = card.querySelector(artSelector)
            const titleEl = card.querySelector("h3 a")
            const coverEl = card.querySelector("img.cover")
            const subEl = card.querySelector("p")

            if (!link || !titleEl) return null

            const id = this.comicIdFromHref(link.attributes.href)
            if (!id) return null

            const title = this.cleanText(titleEl.text)
            if (!title) return null

            const cover = coverEl ? this.imageUrl(coverEl) : ""
            const subTitle = this.cleanText(subEl?.text || "")

            return new Comic({
                id: String(id),
                title: String(title),
                cover: String(cover),
                subTitle: String(subTitle)
            })
        } catch (e) {
            return null
        }
    }

    /**
     * 解析搜索/分类页漫画列表（精确选择器，不遍历所有a标签）
     */
    parseComicList(document) {
        const result = []
        const seen = new Set()

        // 优先使用标准卡片选择器
        let cards = document.querySelectorAll("section.grid article.card")
        if (cards.length === 0) {
            // 兜底：首页的各种卡片
            cards = document.querySelectorAll("#hot article.comic-card, .mobile-category-card-section article.mobile-comic-card, [data-seo-revisit-links] article.revisit-card")
        }

        for (const card of cards) {
            let comic = null
            if (card.querySelector("a.cover-wrap")) {
                comic = this.parseStandardCard(card)
            } else if (card.querySelector("a.hot-art")) {
                comic = this.parseHomeCard(card, "a.hot-art")
            } else if (card.querySelector("a.mobile-comic-art")) {
                comic = this.parseHomeCard(card, "a.mobile-comic-art")
            }

            if (comic && comic.id && !seen.has(comic.id)) {
                seen.add(comic.id)
                result.push(comic)
            }
        }

        return result
    }

    parseMaxPage(document, currentPage) {
        let maxPage = currentPage || 1
        try {
            const pager = document.querySelector("nav.pager")
            if (pager) {
                const links = pager.querySelectorAll("a")
                for (const a of links) {
                    const text = this.cleanText(a.text)
                    const n = parseInt(text)
                    if (!isNaN(n) && n > maxPage && n < 10000) {
                        maxPage = n
                    }
                }
            }
        } catch (e) {}
        return maxPage
    }

    // ========== 首页推荐（数组格式，保持可导入） ==========

    explore = [
        {
            title: "瓜子漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                try {
                    let res = await Network.get(this.baseUrl + "/")
                    if (res.status !== 200) {
                        return { "推荐": [] }
                    }

                    let document = new HtmlDocument(res.body)
                    try {
                        let result = {}

                        // 1. 今日热门
                        try {
                            const hotSection = document.querySelector("#hot")
                            if (hotSection) {
                                const comics = []
                                const cards = hotSection.querySelectorAll("article.comic-card")
                                for (const card of cards) {
                                    const comic = this.parseHomeCard(card, "a.hot-art")
                                    if (comic) comics.push(comic)
                                }
                                if (comics.length > 0) result["今日热门"] = comics
                            }
                        } catch (e) {}

                        // 2. 移动端分类区块（热血冒险、恋爱古风等）
                        try {
                            const mobileSections = document.querySelectorAll(".mobile-category-card-section")
                            for (const section of mobileSections) {
                                const titleEl = section.querySelector(".section-title")
                                if (!titleEl) continue
                                let title = this.cleanText(titleEl.text)
                                title = title.replace(/^(local_fire_department|schedule|auto_stories|leaderboard)\s*/, "").trim()
                                if (!title) continue

                                const comics = []
                                const cards = section.querySelectorAll("article.mobile-comic-card")
                                for (const card of cards) {
                                    const comic = this.parseHomeCard(card, "a.mobile-comic-art")
                                    if (comic) comics.push(comic)
                                }
                                if (comics.length > 0) result[title] = comics
                            }
                        } catch (e) {}

                        // 3. 近期值得重读
                        try {
                            const revisitSection = document.querySelector("[data-seo-revisit-links]")
                            if (revisitSection) {
                                const comics = []
                                const cards = revisitSection.querySelectorAll("article.revisit-card")
                                for (const card of cards) {
                                    const comic = this.parseHomeCard(card, "a.hot-art")
                                    if (comic) comics.push(comic)
                                }
                                if (comics.length > 0) result["近期值得重读"] = comics
                            }
                        } catch (e) {}

                        if (Object.keys(result).length === 0) {
                            return { "推荐": [] }
                        }
                        return result
                    } finally {
                        document.dispose()
                    }
                } catch (e) {
                    return { "推荐": [] }
                }
            }
        }
    ]

    // ========== 分类（保持GPT的可导入结构） ==========

    category = {
        title: "瓜子漫画",
        parts: [
            {
                name: "题材",
                type: "fixed",
                categories: [
                    "全部", "热血", "玄幻", "都市", "恋爱", "古风",
                    "穿越", "校园", "搞笑", "冒险", "悬疑", "科幻",
                    "灵异", "动作", "霸总", "耽美", "奇幻", "系统", "逆袭"
                ],
                itemType: "category",
                categoryParams: [
                    "",
                    "tag=热血", "tag=玄幻", "tag=都市", "tag=恋爱", "tag=古风",
                    "tag=穿越", "tag=校园", "tag=搞笑", "tag=冒险", "tag=悬疑", "tag=科幻",
                    "tag=灵异", "tag=动作", "tag=霸总", "tag=耽美", "tag=奇幻", "tag=系统", "tag=逆袭"
                ]
            }
        ],
        enableRankingPage: true
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            try {
                let query = []
                if (param) query.push(param)
                if (options && options.length > 0) {
                    for (let option of options) {
                        if (option) query.push(option)
                    }
                }
                query.push("page=" + (page || 1))
                let url = this.baseUrl + "/category.php?" + query.join("&")

                let res = await Network.get(url)
                if (res.status !== 200) {
                    return { comics: [], maxPage: page || 1 }
                }

                let document = new HtmlDocument(res.body)
                try {
                    return {
                        comics: this.parseComicList(document),
                        maxPage: this.parseMaxPage(document, page || 1)
                    }
                } finally {
                    document.dispose()
                }
            } catch (e) {
                return { comics: [], maxPage: page || 1 }
            }
        },

        optionList: [
            {
                options: [
                    "is_end=0-全部",
                    "is_end=2-连载",
                    "is_end=1-完结"
                ]
            },
            {
                options: [
                    "sort=update-最新",
                    "sort=hits-人气",
                    "sort=score-评分"
                ]
            }
        ],

        ranking: {
            options: [
                "hits-人气",
                "score-评分",
                "update-更新"
            ],
            load: async (option, page) => {
                try {
                    let sort = option || "hits"
                    let res = await Network.get(
                        this.baseUrl + "/category.php?sort=" + encodeURIComponent(sort) +
                        "&page=" + (page || 1)
                    )
                    if (res.status !== 200) {
                        return { comics: [], maxPage: page || 1 }
                    }
                    let document = new HtmlDocument(res.body)
                    try {
                        return {
                            comics: this.parseComicList(document),
                            maxPage: this.parseMaxPage(document, page || 1)
                        }
                    } finally {
                        document.dispose()
                    }
                } catch (e) {
                    return { comics: [], maxPage: page || 1 }
                }
            }
        }
    }

    // ========== 搜索（保持3参数结构） ==========

    search = {
        load: async (keyword, options, page) => {
            try {
                let url = this.baseUrl + "/category.php?keyword=" + encodeURIComponent(keyword || "") + "&page=" + (page || 1)

                let res = await Network.get(url)
                if (res.status !== 200) {
                    return { comics: [], maxPage: page || 1 }
                }

                let document = new HtmlDocument(res.body)
                try {
                    return {
                        comics: this.parseComicList(document),
                        maxPage: this.parseMaxPage(document, page || 1)
                    }
                } finally {
                    document.dispose()
                }
            } catch (e) {
                return { comics: [], maxPage: page || 1 }
            }
        },

        optionList: []
    }

    // ========== 漫画详情与阅读 ==========

    comic = {
        loadInfo: async (id) => {
            try {
                let comicId = String(id || "").match(/\d+/)?.[0] || String(id || "")
                if (!comicId) {
                    return this._emptyDetails(id)
                }

                let res = await Network.get(this.baseUrl + "/comic.php?id=" + comicId)
                if (res.status !== 200) {
                    return this._emptyDetails(comicId)
                }

                let html = res.body
                let document = new HtmlDocument(html)
                try {
                    // 检查是否是错误页
                    let bodyText = this.cleanText(document.querySelector("body")?.text || "")
                    if (/漫画不存在|不存在或章节已被删除|页面不存在/i.test(bodyText)) {
                        return this._emptyDetails(comicId)
                    }

                    // 优先从JSON-LD提取
                    const jsonLdList = this.extractJsonLd(html)
                    let title = ""
                    let cover = ""
                    let description = ""
                    let author = ""
                    let tags = []
                    let updateTime = ""
                    let chapters = new Map()

                    // 提取 ComicStory
                    const comicStory = this.findJsonLdType(jsonLdList, "ComicStory")
                    if (comicStory) {
                        title = this.cleanText(comicStory.name || "")
                        cover = this.absoluteUrl(comicStory.image || "")
                        description = this.cleanText(comicStory.description || "")
                        author = this.cleanText(comicStory.author?.name || "")
                        updateTime = this.cleanText(comicStory.dateModified || comicStory.datePublished || "")
                        if (Array.isArray(comicStory.genre)) {
                            tags = comicStory.genre.map(t => this.cleanText(t)).filter(t => t)
                        }
                    }

                    // 优先从HTML的章节列表容器提取（完整、无重复、干净）
                    // 容器：div.mobile-chapter-grid[data-mobile-chapter-list]
                    try {
                        const chapterGrid = document.querySelector('div.mobile-chapter-grid[data-mobile-chapter-list]')
                        if (chapterGrid) {
                            const chapterLinks = chapterGrid.querySelectorAll('a[href*="chapter.php"]')
                            // HTML中是倒序（最新在前），需要反转成正序
                            const reversedLinks = Array.from(chapterLinks).reverse()
                            for (const link of reversedLinks) {
                                try {
                                    const href = link.attributes.href || ""
                                    const chapterId = this.comicIdFromHref(href)
                                    // 清理章节名称：去掉换行、多余空格、"阅读"后缀
                                    let chapterName = this.cleanText(link.text || "")
                                    chapterName = chapterName.replace(/\s*阅读\s*$/, "").trim()
                                    if (chapterId && chapterName && !chapters.has(chapterId)) {
                                        chapters.set(String(chapterId), String(chapterName))
                                    }
                                } catch (e) {}
                            }
                        }
                    } catch (e) {}

                    // HTML兜底：如果容器没找到，从JSON-LD提取（只有50章，不完整）
                    if (chapters.size === 0) {
                        try {
                            for (const data of jsonLdList) {
                                const graph = data["@graph"] || [data]
                                for (const item of graph) {
                                    if (item["@type"] === "ItemList" && Array.isArray(item.itemListElement)) {
                                        const firstUrl = item.itemListElement[0]?.url || ""
                                        if (firstUrl.includes("chapter.php")) {
                                            for (const listItem of item.itemListElement) {
                                                try {
                                                    const chapterUrl = listItem.url || ""
                                                    const chapterId = this.comicIdFromHref(chapterUrl)
                                                    const chapterName = this.cleanText(listItem.name || "")
                                                    if (chapterId && chapterName && !chapters.has(chapterId)) {
                                                        chapters.set(String(chapterId), String(chapterName))
                                                    }
                                                } catch (e) {}
                                            }
                                        }
                                    }
                                }
                            }
                        } catch (e) {}
                    }

                    // 最后兜底：从全页a标签提取（去重、过滤按钮）
                    if (chapters.size === 0) {
                        try {
                            const chapterLinks = document.querySelectorAll('a[href*="chapter.php"]')
                            for (const link of chapterLinks) {
                                try {
                                    const href = link.attributes.href || ""
                                    const chapterId = this.comicIdFromHref(href)
                                    let chapterName = this.cleanText(link.text || "")
                                    // 过滤掉按钮文本
                                    if (!chapterName || /开始阅读|从第.*章开始阅读|继续阅读/.test(chapterName)) continue
                                    chapterName = chapterName.replace(/\s*阅读\s*$/, "").trim()
                                    if (chapterId && chapterName && !chapters.has(chapterId)) {
                                        chapters.set(String(chapterId), String(chapterName))
                                    }
                                } catch (e) {}
                            }
                        } catch (e) {}
                    }

                    // HTML兜底：标题
                    if (!title) {
                        try {
                            const titleEls = document.querySelectorAll("h1")
                            for (const node of titleEls) {
                                const t = this.cleanText(node.text)
                                if (t && t.length < 100) {
                                    title = t
                                    break
                                }
                            }
                        } catch (e) {}
                        if (!title) title = comicId
                    }

                    // HTML兜底：封面
                    if (!cover) {
                        try {
                            const coverEl = document.querySelector(".cover img, img[itemprop=image], .detail-cover img")
                            if (coverEl) cover = this.imageUrl(coverEl)
                        } catch (e) {}
                    }

                    // HTML兜底：简介
                    if (!description) {
                        try {
                            const metas = document.querySelectorAll("meta")
                            for (const m of metas) {
                                const property = m.attributes["name"] || m.attributes["property"] || ""
                                if (/description/i.test(property)) {
                                    description = this.cleanText(m.attributes["content"] || "")
                                    break
                                }
                            }
                        } catch (e) {}
                    }

                    // HTML兜底：更新时间（从body文本中匹配"更新时间：XXX"）
                    if (!updateTime) {
                        try {
                            const timeMatch = bodyText.match(/更新时间[：:]\s*([0-9\-\/]+)/)
                            if (timeMatch) {
                                updateTime = this.cleanText(timeMatch[1])
                            }
                        } catch (e) {}
                    }

                    return new ComicDetails({
                        title: String(title || comicId),
                        subtitle: String(author || ""),
                        subTitle: String(author || ""),
                        cover: String(cover || ""),
                        description: String(description || ""),
                        tags: {
                            "标签": Array.isArray(tags) ? tags.map(t => String(t || "")) : []
                        },
                        chapters: chapters,
                        isFavorite: false,
                        subId: String(comicId),
                        thumbnails: cover ? [String(cover)] : [],
                        recommend: [],
                        updateTime: String(updateTime || ""),
                        url: String(this.baseUrl + "/comic.php?id=" + comicId)
                    })
                } finally {
                    document.dispose()
                }
            } catch (e) {
                return this._emptyDetails(id)
            }
        },

        loadEp: async (comicId, epId) => {
            try {
                if (!epId) return { images: [] }

                // 标准化章节ID
                let chapterId = ""
                const epStr = String(epId).trim()

                // 形态1：完整URL
                const urlMatch = epStr.match(/[?&]id=(\d+)/i)
                if (urlMatch) {
                    chapterId = urlMatch[1]
                }
                // 形态2：组合ID comicId|chapterId
                else if (epStr.includes("|")) {
                    const parts = epStr.split("|")
                    chapterId = parts[parts.length - 1].match(/\d+/)?.[0] || ""
                }
                // 形态3：纯数字ID
                else if (/^\d+$/.test(epStr)) {
                    chapterId = epStr
                }

                if (!chapterId) {
                    return { images: [] }
                }

                const url = this.baseUrl + "/chapter.php?id=" + chapterId
                let res = await Network.get(url)
                if (res.status !== 200) {
                    return { images: [] }
                }

                const html = res.body
                const images = []
                const seen = new Set()

                // ========== 第一步：从JSON-LD提取图片 ==========
                const jsonLdList = this.extractJsonLd(html)
                for (const data of jsonLdList) {
                    const graph = data["@graph"] || [data]
                    for (const item of graph) {
                        if (item["@type"] === "ItemList" && Array.isArray(item.itemListElement)) {
                            for (const listItem of item.itemListElement) {
                                try {
                                    let imgUrl = ""
                                    if (listItem.item && listItem.item.url) {
                                        imgUrl = listItem.item.url
                                    } else if (listItem.url) {
                                        imgUrl = listItem.url
                                    }
                                    if (imgUrl) {
                                        const absolute = this.absoluteUrl(imgUrl)
                                        if (absolute && !seen.has(absolute) && /\.(webp|jpg|jpeg|png|gif)/i.test(absolute)) {
                                            seen.add(absolute)
                                            images.push(String(absolute))
                                        }
                                    }
                                } catch (e) {}
                            }
                        }
                    }
                }

                // ========== 第二步：从HTML提取图片（兜底+补充） ==========
                try {
                    const document = new HtmlDocument(html)
                    try {
                        // 使用正确的选择器：.reading-image 和 [data-reader-images] img
                        const imgElements = document.querySelectorAll(".reading-image, [data-reader-images] img, .reader-content img, .manga-imgs img, #manga-imgs img, .chapter-content img, .main-body img")
                        for (const img of imgElements) {
                            try {
                                let src = img.attributes.src || img.attributes["data-src"] || img.attributes["data-original"] || ""
                                if (src) {
                                    const absolute = this.absoluteUrl(src)
                                    if (absolute && !seen.has(absolute) && /\.(webp|jpg|jpeg|png|gif)/i.test(absolute) && !/loading|placeholder|logo|icon|cover/i.test(absolute)) {
                                        seen.add(absolute)
                                        images.push(String(absolute))
                                    }
                                }
                            } catch (e) {}
                        }
                    } finally {
                        document.dispose()
                    }
                } catch (e) {}

                // ========== 第三步：通过总页数和URL规律补全图片 ==========
                // 从meta description提取总页数："本章共6张漫画图片"
                let totalPages = 0
                try {
                    const metaMatch = html.match(/本章共\s*(\d+)\s*张/)
                    if (metaMatch) {
                        totalPages = parseInt(metaMatch[1])
                    }
                } catch (e) {}

                // 如果有总页数且已有至少一张图片，通过URL规律生成所有图片
                if (totalPages > 0 && images.length > 0 && images.length < totalPages) {
                    try {
                        // 从第一张图片URL提取基础路径和扩展名
                        // 格式：https://img.guazicdn.com/mh5/comics/chapters/yirenzhixia/260717/805_1.webp
                        const firstImg = images[0]
                        const baseMatch = firstImg.match(/^(.+?)_(\d+)\.(webp|jpg|jpeg|png|gif)$/i)
                        if (baseMatch) {
                            const basePath = baseMatch[1]
                            const ext = baseMatch[3]
                            // 生成所有页码的图片URL
                            for (let i = 1; i <= totalPages; i++) {
                                const generatedUrl = `${basePath}_${i}.${ext}`
                                if (!seen.has(generatedUrl)) {
                                    seen.add(generatedUrl)
                                    images.push(String(generatedUrl))
                                }
                            }
                        }
                    } catch (e) {}
                }

                // 按页码排序（确保顺序正确）
                try {
                    images.sort((a, b) => {
                        const aMatch = a.match(/_(\d+)\./)
                        const bMatch = b.match(/_(\d+)\./)
                        if (aMatch && bMatch) {
                            return parseInt(aMatch[1]) - parseInt(bMatch[1])
                        }
                        return 0
                    })
                } catch (e) {}

                return { images }
            } catch (e) {
                return { images: [] }
            }
        },

        onImageLoad: (url, comicId, epId) => {
            return {
                headers: {
                    "Referer": "https://www.guazimanhua.com/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            }
        },

        onThumbnailLoad: (url) => {
            return {
                headers: {
                    "Referer": "https://www.guazimanhua.com/",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
            }
        },

        idMatch: "^https?://(?:www\\.)?guazimanhua\\.com/comic\\.php\\?id=\\d+$",

        link: {
            domains: [
                "www.guazimanhua.com",
                "guazimanhua.com"
            ],
            linkToId: (url) => {
                let m = String(url).match(/guazimanhua\.com\/comic\.php\?id=(\d+)/i)
                return m ? m[1] : null
            }
        }
    }

    // ========== 空详情兜底 ==========

    _emptyDetails(comicId) {
        const safeId = String(comicId || "")
        return new ComicDetails({
            title: safeId,
            subtitle: "",
            subTitle: "",
            cover: "",
            description: "",
            tags: { "标签": [] },
            chapters: new Map(),
            isFavorite: false,
            subId: safeId,
            thumbnails: [],
            recommend: [],
            updateTime: "",
            url: ""
        })
    }
}
