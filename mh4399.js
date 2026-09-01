// 4399漫画网 (www.4399manhua.com) Venera 漫画源
// 版本: 1.0.0
// 证据基准: 2026-09-01 取证
//   站点为 HTTP-only (https 握手失败), 基础地址 http://www.4399manhua.com/
//   首页: 热门推荐/大陆/日本/韩国/欧美漫画 分区, 卡片 .cart-item
//   分类: /{region}-{status}-{type}-{page}.html, 题材1-50/地区1-4/状态1-2, pagestats 提供总页
//   搜索: POST /search2.html (keywords), 必须移动UA(桌面UA返回空), 单页30结果
//   详情: /{id}/ -> h1.title / .cover-box img / 章节 .chapter-list li a (/id/{ep}.html)
//   阅读: /{id}/{ep}/ 移动UA -> img.mhimg[data-original] 直链(oub.acgdm001.com), 图片URL与抓页时的ASP.NET_SessionId绑定
//   图片: 会话有效期内 200 image/jpeg; 无加密
// 待验证: 搜索分页(未见分页控件); 长会话后图片403(会话过期)的重试策略
class Mh4399 extends ComicSource {
    name = "4399漫画网"
    key = "mh4399"
    version = "1.0.3"
    minAppVersion = "1.6.0"
    url = ""

    static baseUrl = "http://www.4399manhua.com"
    static userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    static mobileUA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1"
    static categoryTypes = ["霸总", "修真", "恋爱", "校园", "冒险", "搞笑", "生活", "热血", "架空", "后宫", "玄幻", "悬疑", "恐怖", "灵异", "动作", "科幻", "战争", "古风", "穿越", "竞技", "励志", "同人", "真人", "总裁", "异能", "剧情", "大女主", "都市", "格斗", "武侠", "日常", "纯爱", "推理", "少年", "奇幻", "短篇", "ABO", "运动", "萌系", "爆笑", "蔷薇", "百合", "BG", "爱情", "魔法", "历史", "宅系", "治愈", "职场", "欢乐向"]
    static regionMap = [["全部", "0"], ["大陆", "1"], ["日本", "2"], ["韩国", "3"], ["欧美", "4"]]
    static statusMap = [["全部", "0"], ["连载中", "1"], ["已完结", "2"]]

    headers(ua, referer) {
        const h = {
            "User-Agent": ua || Mh4399.userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }
        if (referer) {
            h["Referer"] = referer
        }
        return h
    }

    // 页面请求统一走此方法: 403/5xx/网络错误自动退避重试, 规避站点WAF与抖动
    async requestPage(url, headers, retries = 3) {
        let lastStatus = 0
        for (let i = 0; i < retries; i++) {
            try {
                const res = await Network.get(url, headers)
                lastStatus = res.status
                if (res.status === 403 || res.status >= 500) {
                    await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)))
                    continue
                }
                return res
            } catch (e) {
                await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)))
            }
        }
        throw `Invalid status code: ${lastStatus || "network error"}`
    }

    absoluteUrl(u) {
        if (!u) return ""
        u = String(u).trim()
        if (u.startsWith("//")) return "https:" + u
        if (u.startsWith("/")) return Mh4399.baseUrl + u
        return u
    }

    comicIdFromHref(href) {
        const m = String(href || "").match(/^\/(\d+)\//)
        return m ? m[1] : ""
    }

    // 首页/列表/分类卡片: li > .cart-item (a.cart-cover 链接+封面, .cart-info 标题, .new-chapter 最新)
    parseCartItem(li) {
        if (!li) return null
        const link = li.querySelector("a.cart-cover")
        const titleEl = li.querySelector(".cart-info a")
        if (!link || !titleEl) return null
        const id = this.comicIdFromHref(link.attributes.href)
        if (!id) return null
        const img = li.querySelector("img")
        const newChap = li.querySelector(".new-chapter")
        return new Comic({
            id: id,
            title: titleEl.text.trim(),
            cover: this.absoluteUrl(img ? (img.attributes["data-original"] || img.attributes.src || "") : ""),
            subTitle: newChap ? newChap.text.trim() : ""
        })
    }

    // 搜索卡片(移动端): li.block-img-item (a.article-img 链接+封面, .title, .author 最新)
    parseSearchItem(li) {
        if (!li) return null
        const link = li.querySelector("a.article-img")
        const titleEl = li.querySelector("a.title")
        if (!link || !titleEl) return null
        const id = this.comicIdFromHref(link.attributes.href)
        if (!id) return null
        const img = li.querySelector("img")
        const authors = Array.from(li.querySelectorAll("a.author"))
        const latest = authors.length > 1 ? authors[1].text.trim() : ""
        return new Comic({
            id: id,
            title: titleEl.text.trim(),
            cover: this.absoluteUrl(img ? (img.attributes.src || "") : ""),
            subTitle: latest
        })
    }

    parseSearchList(doc) {
        const comics = []
        for (const li of Array.from(doc.querySelectorAll("ul.block-content li.block-img-item"))) {
            const c = this.parseSearchItem(li)
            if (c) comics.push(c)
        }
        return comics
    }

    parseMaxPage(html) {
        const m = html.match(/id="pagestats">\s*(\d+)\s*\/\s*(\d+)/)
        return m ? parseInt(m[2]) : 1
    }

    explore = [
        {
            title: "4399漫画网",
            type: "singlePageWithMultiPart",
            load: async () => {
                let res = await this.requestPage(Mh4399.baseUrl + "/", this.headers(Mh4399.userAgent, Mh4399.baseUrl + "/"), 4)
                if (res.status !== 200) {
                    // 首页被WAF拦时回退到全部列表页
                    const fallback = await this.requestPage(`${Mh4399.baseUrl}/0-0-0-1.html`, this.headers(Mh4399.userAgent, Mh4399.baseUrl + "/"), 2)
                    const doc2 = new HtmlDocument(fallback.body)
                    try {
                        const comics = []
                        for (const li of Array.from(doc2.querySelectorAll("ul.cartoon-block-box li"))) {
                            const c = this.parseCartItem(li)
                            if (c) comics.push(c)
                        }
                        const r = {}
                        if (comics.length > 0) r["全部漫画"] = comics
                        return r
                    } finally {
                        doc2.dispose()
                    }
                }
                const doc = new HtmlDocument(res.body)
                try {
                    const result = {}
                    for (const box of Array.from(doc.querySelectorAll("div.class-block-box"))) {
                        const head = box.querySelector("div.class-head")
                        const titleText = head ? head.text.replace(/更多/g, "").replace(/\s+/g, " ").trim() : ""
                        const comics = []
                        for (const li of Array.from(box.querySelectorAll("ul.cartoon-block-box li"))) {
                            const c = this.parseCartItem(li)
                            if (c) comics.push(c)
                        }
                        if (titleText && comics.length > 0 && !result[titleText]) {
                            result[titleText] = comics
                        }
                    }
                    return result
                } finally {
                    doc.dispose()
                }
            }
        }
    ]

    category = {
        title: "4399漫画网",
        parts: [
            {
                name: "题材",
                type: "fixed",
                categories: Mh4399.categoryTypes,
                categoryParams: Mh4399.categoryTypes.map((_, i) => String(i + 1)),
                itemType: "category"
            },
            {
                name: "地区",
                type: "fixed",
                categories: Mh4399.regionMap.map(e => e[0]),
                categoryParams: Mh4399.regionMap.map(e => e[1]),
                itemType: "category"
            },
            {
                name: "状态",
                type: "fixed",
                categories: Mh4399.statusMap.map(e => e[0]),
                categoryParams: Mh4399.statusMap.map(e => e[1]),
                itemType: "category"
            }
        ]
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            // URL 格式: /{region}-{status}-{type}-{page}.html
            let region = "0", status = "0", type = "0"
            if (Mh4399.categoryTypes.includes(category)) {
                type = param
            } else if (Mh4399.regionMap.some(e => e[0] === category)) {
                region = param
            } else if (Mh4399.statusMap.some(e => e[0] === category)) {
                status = param
            } else {
                type = param // 兜底按题材
            }
            const url = `${Mh4399.baseUrl}/${region}-${status}-${type}-${page}.html`
            const res = await this.requestPage(url, this.headers(Mh4399.userAgent, Mh4399.baseUrl + "/"))
            const doc = new HtmlDocument(res.body)
            try {
                const comics = []
                for (const li of Array.from(doc.querySelectorAll("ul.cartoon-block-box li"))) {
                    const c = this.parseCartItem(li)
                    if (c) comics.push(c)
                }
                return {
                    comics: comics,
                    maxPage: this.parseMaxPage(res.body)
                }
            } finally {
                doc.dispose()
            }
        }
    }

    search = {
        load: async (keyword, options, page) => {
            // 桌面UA的POST返回空结果页, 必须用移动UA
            const res = await Network.post(
                `${Mh4399.baseUrl}/search2.html`,
                this.headers(Mh4399.mobileUA),
                "keywords=" + encodeURIComponent(keyword)
            )
            // 搜索403时退避重试
            if (res.status === 403 || res.status >= 500) {
                for (let i = 0; i < 2; i++) {
                    await new Promise((resolve) => setTimeout(resolve, 2000 * (i + 1)))
                    const retry = await Network.post(
                        `${Mh4399.baseUrl}/search2.html`,
                        this.headers(Mh4399.mobileUA),
                        "keywords=" + encodeURIComponent(keyword)
                    )
                    if (retry.status === 200) {
                        const doc2 = new HtmlDocument(retry.body)
                        try {
                            return {
                                comics: this.parseSearchList(doc2),
                                maxPage: 1
                            }
                        } finally {
                            doc2.dispose()
                        }
                    }
                }
                throw `Invalid status code: ${res.status}`
            }
            const doc = new HtmlDocument(res.body)
            try {
                return {
                    comics: this.parseSearchList(doc),
                    maxPage: 1 // 搜索页未见分页控件, 单页(待验证)
                }
            } finally {
                doc.dispose()
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            const res = await this.requestPage(`${Mh4399.baseUrl}/${encodeURIComponent(id)}/`, this.headers(Mh4399.userAgent, Mh4399.baseUrl + "/"))
            const html = res.body
            const doc = new HtmlDocument(html)
            try {
                const titleEl = doc.querySelector("h1.title")
                const coverEl = doc.querySelector(".cover-box img")
                const authorEl = doc.querySelector(".article-info-item p.mt10")
                const infoText = doc.querySelector(".info-item-bottom")
                const introM = html.match(/简介：<\/span>([^<]*)</)

                const tags = {}
                if (authorEl) {
                    const t = authorEl.text.replace(/作者：/g, "").replace(/\s+/g, " ").trim()
                    if (t) tags["作者"] = [t]
                }
                if (infoText) {
                    const t = infoText.text.replace(/\s+/g, " ").trim()
                    const statusM = t.match(/状态：\s*([^\s]+)/)
                    const genreM = t.match(/类别：\s*([^\n]+)/)
                    if (statusM && statusM[1]) tags["状态"] = [statusM[1]]
                    if (genreM && genreM[1]) tags["题材"] = genreM[1].trim().split(/\s+/).filter(Boolean)
                }

                const eps = new Map()
                for (const a of Array.from(doc.querySelectorAll("ul.chapter-list li a"))) {
                    const m = String(a.attributes.href || "").match(/\/(\d+)\.html$/)
                    const t = a.text.trim()
                    if (m) {
                        eps.set(m[1], t)
                    }
                }
                const chapters = new Map()
                if (eps.size > 0) {
                    chapters.set("章节", eps)
                }

                return new ComicDetails({
                    title: titleEl ? titleEl.text.trim() : id,
                    cover: coverEl ? this.absoluteUrl(coverEl.attributes["data-original"] || coverEl.attributes.src || "") : "",
                    description: introM ? introM[1].trim() : "",
                    tags: tags,
                    chapters: chapters,
                    subId: id
                })
            } finally {
                doc.dispose()
            }
        },
        loadEp: async (comicId, epId) => {
            // 必须移动UA: 桌面UA的阅读页只有占位图(/xj.png)
            const res = await this.requestPage(
                `${Mh4399.baseUrl}/${encodeURIComponent(comicId)}/${encodeURIComponent(epId)}.html`,
                this.headers(Mh4399.mobileUA, `${Mh4399.baseUrl}/${encodeURIComponent(comicId)}/`)
            )
            const doc = new HtmlDocument(res.body)
            try {
                const images = []
                for (const img of Array.from(doc.querySelectorAll("img.mhimg"))) {
                    const u = img.attributes["data-original"]
                    if (u && u.indexOf("oub.acgdm001.com") >= 0) {
                        images.push(this.absoluteUrl(u))
                    }
                }
                return { images: images }
            } finally {
                doc.dispose()
            }
        },
        // 章节图片请求配置: Venera 解析器接的是 comic.onImageLoad (类方法 getImageLoadingConfig 不会被调用)
        // oub CDN 只放行完整 iPhone 移动 UA, 桌面UA/venera UA 一律403
        onImageLoad: (imageKey, comicId, ep) => {
            const headers = {
                "User-Agent": Mh4399.mobileUA,
                "Referer": `${Mh4399.baseUrl}/${encodeURIComponent(comicId)}/${encodeURIComponent(ep)}.html`,
                "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                "Accept-Language": "zh-CN,zh;q=0.9",
            }
            return {
                url: imageKey,
                headers: headers,
                onLoadFailed: async () => {
                    await Network.get(
                        `${Mh4399.baseUrl}/${encodeURIComponent(comicId)}/${encodeURIComponent(ep)}.html`,
                        this.headers(Mh4399.mobileUA, `${Mh4399.baseUrl}/${encodeURIComponent(comicId)}/`)
                    )
                    return { url: imageKey, headers: headers }
                }
            }
        },
        // 封面缩略图请求配置: Venera 解析器接的是 comic.onThumbnailLoad
        onThumbnailLoad: (imageKey) => {
            return {
                headers: {
                    "User-Agent": Mh4399.userAgent,
                    "Referer": Mh4399.baseUrl + "/",
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Accept-Language": "zh-CN,zh;q=0.9",
                }
            }
        }
    }
}
