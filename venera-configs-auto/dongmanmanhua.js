// 咚漫 (www.dongmanmanhua.cn) Venera 漫画源
// 版本: 1.0.0
// 证据基准: 2026-08-31 取证
//   首页 200; 搜索 /search?keyword=女儿 -> 5 结果; 分类 /genre -> 12 题材 2419 卡片(单页无分页)
//   详情 /episodeList?titleNo=1313 -> 10 章; 阅读页 /viewer?titleNo=1313&episodeNo=10 -> 114 图
//   图片: img._images[data-url] 直链 HTTPS, 无加密; 封面/章节图均 200 image/jpeg|png
// 待验证: 搜索/分类多页参数; 状态字段; 付费章节限制
class Dongmanmanhua extends ComicSource {
    name = "咚漫"
    key = "dongmanmanhua"
    version = "1.0.6"
    minAppVersion = "1.6.0"
    url = ""

    static baseUrl = "https://www.dongmanmanhua.cn"
    static userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    static genreMap = [
        ["恋爱", "LOVE"],
        ["少年", "BOY"],
        ["古风", "ANCIENTCHINESE"],
        ["奇幻", "FANTASY"],
        ["搞笑", "COMEDY"],
        ["校园", "CAMPUS"],
        ["都市", "METROPOLIS"],
        ["治愈", "HEALING"],
        ["悬疑", "SUSPENSE"],
        ["励志", "INSPIRATIONAL"],
        ["影视化", "FILMADAPTATION"],
        ["完结", "TERMINATION"]
    ]

    headers() {
        return {
            "User-Agent": Dongmanmanhua.userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }
    }

    absoluteUrl(u) {
        if (!u) return ""
        u = String(u).trim()
        if (u.startsWith("//")) return "https:" + u
        if (u.startsWith("/")) return Dongmanmanhua.baseUrl + u
        // 归一化: 站点 CDN 的 http 资源全部升级为 https, 避免 Android 明文流量拦截
        if (u.startsWith("http://") && u.indexOf("dongmanmanhua.cn") > 0) {
            u = "https://" + u.substring(7)
        }
        return u
    }

    comicIdFromHref(href) {
        const m = String(href || "").match(/title[_-]?no=(\d+)/i)
        return m ? m[1] : ""
    }

    // 卡片解析: 首页/分类/搜索共用 li[data-title-no] > a.card_item 结构, 封面/标题字段一致
    parseCard(item) {
        if (!item) return null
        const link = item.querySelector("a.card_item")
        const titleEl = item.querySelector(".subj")
        if (!link || !titleEl) return null
        const id = item.attributes["data-title-no"] || this.comicIdFromHref(link.attributes.href)
        if (!id) return null
        const img = item.querySelector("img")
        const authorEl = item.querySelector(".author")
        return new Comic({
            id: id,
            title: titleEl.text.trim(),
            cover: this.absoluteUrl(img ? (img.attributes["data-original"] || img.attributes.src || "") : ""),
            subTitle: authorEl ? authorEl.text.trim() : ""
        })
    }

    parseComicList(container, selector) {
        const comics = []
        for (const li of Array.from(container.querySelectorAll(selector))) {
            const c = this.parseCard(li)
            if (c) comics.push(c)
        }
        return comics
    }

    explore = [
        {
            title: "咚漫",
            type: "singlePageWithMultiPart",
            load: async () => {
                const res = await Network.get(Dongmanmanhua.baseUrl + "/", this.headers())
                if (res.status === 403 || res.status === 401) {
                    throw "咚漫访问被拦截(403)，请检查网络或地区限制"
                }
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`
                }
                const doc = new HtmlDocument(res.body)
                try {
                    const res2 = {}
                    res2["新作推荐"] = this.parseComicList(doc, "#hotAndNew ul.card_lst li[data-title-no]")
                    // 星期分区: 标签与卡片列表按顺序一一对应(已取证 7 x 9)
                    const tabs = Array.from(doc.querySelectorAll("#dailyTab li[data-weekday]"))
                    const lists = Array.from(doc.querySelectorAll("#weekdayList > ul.card_lst"))
                    for (let i = 0; i < tabs.length && i < lists.length; i++) {
                        const name = tabs[i].text.trim()
                        const cards = this.parseComicList(lists[i], "li[data-title-no]")
                        if (name && cards.length > 0) {
                            res2[name] = cards
                        }
                    }
                    return res2
                } finally {
                    doc.dispose()
                }
            }
        }
    ]

    category = {
        title: "咚漫",
        parts: [
            {
                name: "题材",
                type: "fixed",
                categories: Dongmanmanhua.genreMap.map(e => e[0]),
                categoryParams: Dongmanmanhua.genreMap.map(e => e[1]),
                itemType: "category"
            }
        ]
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            // 分类页为单页全量(已取证 2419 张卡片), 无分页控件 => maxPage=1
            const res = await Network.get(Dongmanmanhua.baseUrl + "/genre", this.headers())
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            const html = res.body
            // 定位目标题材区块: h2.sub_title[data-genre=PARAM] 之后到下一个 h2.sub_title 之前的 ul.card_lst
            const genreRe = new RegExp('<h2[^>]*class="sub_title[^"]*"[^>]*data-genre="' + param + '"')
            const start = html.search(genreRe)
            if (start < 0) {
                return { comics: [], maxPage: page }
            }
            const next = html.indexOf('<h2 class="sub_title', start + 10)
            const end = next > start ? next : html.length
            const fragment = html.substring(start, end)
            const doc = new HtmlDocument(fragment)
            try {
                return {
                    comics: this.parseComicList(doc, "li[data-title-no]"),
                    maxPage: 1
                }
            } finally {
                doc.dispose()
            }
        }
    }

    search = {
        load: async (keyword, options, page) => {
            // 作者搜索: 详情页作者链接真实格式为 /search?searchMode=AUTHOR&keyword=...
            let isAuthor = false
            let kw = keyword
            if (keyword.startsWith("作者:")) {
                isAuthor = true
                kw = keyword.substring(3).trim()
            }
            const url = Dongmanmanhua.baseUrl + "/search?" + (isAuthor ? "searchMode=AUTHOR&" : "") + "keyword=" + encodeURIComponent(kw)
            const res = await Network.get(url, this.headers())
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            const doc = new HtmlDocument(res.body)
            try {
                return {
                    comics: this.parseComicList(doc, ".card_wrap.search li[data-title-no]"),
                    maxPage: 1 // 已实测 page=2 与 page=1 返回相同结果, 服务端为单页
                }
            } finally {
                doc.dispose()
            }
        }
    }

    comic = {
        loadInfo: async (id) => {
            // /episodeList?titleNo= 会 302 到规范详情页(已取证)
            const res = await Network.get(`${Dongmanmanhua.baseUrl}/episodeList?titleNo=${encodeURIComponent(id)}`, this.headers())
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            const doc = new HtmlDocument(res.body)
            try {
                const header = doc.querySelector(".detail_header")
                const titleEl = header ? header.querySelector("h1.subj") : null
                const coverImg = header ? header.querySelector(".thmb img") : null
                const genreEl = header ? header.querySelector("h2.genre") : null
                const authorEls = header ? Array.from(header.querySelectorAll("span.author")) : []
                const descEl = doc.querySelector('meta[name="description"]')
                const description = descEl && descEl.attributes.content ? descEl.attributes.content.trim() : ""
                // 封面优先方形图: og:image(510x510, 全站统一) -> twitter:image -> 详情背景图 -> 详情头横幅(加resize缩小)
                // 说明: 详情头 .thmb img 是 1200x240 横幅, 直接当封面会在方形网格里被裁成窄条(历史封面打不开的根因)
                let cover = ""
                const og = doc.querySelector('meta[property="og:image"]')
                if (og && og.attributes.content) {
                    cover = this.absoluteUrl(og.attributes.content)
                }
                if (!cover) {
                    const tw = doc.querySelector('meta[name="twitter:image"]')
                    if (tw && tw.attributes.content) {
                        cover = this.absoluteUrl(tw.attributes.content)
                    }
                }
                if (!cover) {
                    const bgDiv = doc.querySelector(".detail_bg")
                    if (bgDiv && bgDiv.attributes.style) {
                        const m = String(bgDiv.attributes.style).match(/url\((['"]?)([^'")]+)\1\)/)
                        if (m) {
                            cover = this.absoluteUrl(m[2])
                        }
                    }
                }
                if (!cover) {
                    if (coverImg) {
                        cover = this.absoluteUrl(coverImg.attributes.src || "")
                        // 横幅图补 resize 参数缩小体积
                        if (cover && cover.indexOf("x-oss-process=") < 0) {
                            cover += (cover.indexOf("?") < 0 ? "?" : "&") + "x-oss-process=image/resize,w_400,limit_0"
                        }
                    }
                }

                const authors = []
                for (const a of authorEls) {
                    const t = a.text.trim()
                    if (t && !authors.includes(t)) authors.push(t)
                }
                const tags = {}
                if (authors.length > 0) tags["作者"] = authors
                if (genreEl && genreEl.text.trim()) {
                    tags["题材"] = genreEl.text.trim().split(/\s+/).filter(Boolean)
                }

                const chapters = new Map()
                const eps = new Map()
                for (const li of Array.from(doc.querySelectorAll("#_listUl li[data-episode-no]"))) {
                    const epId = li.attributes["data-episode-no"]
                    const epTitle = li.querySelector(".subj")
                    if (epId) {
                        eps.set(epId, epTitle ? epTitle.text.trim() : `第${epId}话`)
                    }
                }
                if (eps.size > 0) {
                    chapters.set("章节", eps)
                }

                return new ComicDetails({
                    title: titleEl ? titleEl.text.trim() : id,
                    cover: cover,
                    description: description,
                    tags: tags,
                    chapters: chapters,
                    subId: id
                })
            } finally {
                doc.dispose()
            }
        },
        loadEp: async (comicId, epId) => {
            // 短地址 /viewer?titleNo=&episodeNo= 已取证可 302 到规范阅读页
            const url = `${Dongmanmanhua.baseUrl}/viewer?titleNo=${encodeURIComponent(comicId)}&episodeNo=${encodeURIComponent(epId)}`
            const res = await Network.get(url, this.headers())
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            const doc = new HtmlDocument(res.body)
            try {
                const images = []
                for (const img of Array.from(doc.querySelectorAll("#_imageList img._images"))) {
                    const u = img.attributes["data-url"]
                    if (u) images.push(this.absoluteUrl(u))
                }
                return { images: images }
            } finally {
                doc.dispose()
            }
        },
        // 章节图片请求配置: Venera 解析器接的是 comic.onImageLoad (类方法不会被调用)
        onImageLoad: (imageKey, cid, eid) => {
            return {
                headers: {
                    "User-Agent": Dongmanmanhua.userAgent,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Referer": Dongmanmanhua.baseUrl + "/",
                }
            }
        },
        // 封面缩略图请求配置: Venera 解析器接的是 comic.onThumbnailLoad
        onThumbnailLoad: (imageKey) => {
            return {
                headers: {
                    "User-Agent": Dongmanmanhua.userAgent,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                    "Referer": Dongmanmanhua.baseUrl + "/",
                }
            }
        }
    }
}
