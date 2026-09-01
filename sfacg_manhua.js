// SF漫画 (manhua.sfacg.com) Venera 漫画源
// 版本: 1.0.0
// 证据基准: 2026-08-31 取证
//   首页 200: 热门连载/本周推荐/最新更新作品 3 个 story-list 分区
//   搜索 s.sfacg.com/?Key=&S=0&SS=0: "武林之王" 1 结果; "之" 12 结果, 分页 default.aspx?PageIndex=n
//   分类 /catalog/default.aspx?tid={1..15}&PageIndex=n: 每页12部, pagebar 提供最大页
//   详情 /mh/{slug}/: h1 标题, .cover img, 简介, 作者/题材, .comic_Serial_list 全量章节(109)
//   阅读 /mh/{slug}/{chapId}/: 页内 var c={cid}; 图片接口 /ajax/Common.ashx?op=getPics&cid=&chapId= -> coldpic.sfacg.com 直链数组
//   图片: 200 image/jpeg 直链, 无加密
// 待验证: 搜索多页参数(已见PageIndex链接, 未取第二页样本); 分类排序选项; 部分章节可能需要 serial/path 参数
class SfacgManhua extends ComicSource {
    name = "SF漫画"
    key = "sfacg_manhua"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = ""

    static baseUrl = "https://manhua.sfacg.com"
    static searchBase = "https://s.sfacg.com"
    static userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

    cidCache = {}

    headers() {
        return {
            "User-Agent": SfacgManhua.userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9",
        }
    }

    absoluteUrl(u) {
        if (!u) return ""
        u = String(u).trim()
        if (u.startsWith("//")) return "https:" + u
        if (u.startsWith("/")) return SfacgManhua.baseUrl + u
        if (u.startsWith("http://") && u.indexOf("sfacg.com") > 0) {
            u = "https://" + u.substring(7)
        }
        return u
    }

    comicIdFromHref(href) {
        const m = String(href || "").match(/\/mh\/([A-Za-z0-9_]+)/)
        return m ? m[1] : ""
    }

    // 首页卡片: ul.story-list > li (封面 data-original, 标题 .title a, 最新章节 .Serial_title)
    parseHomeCard(li) {
        if (!li) return null
        const link = li.querySelector(".pic a")
        const titleEl = li.querySelector(".title a")
        if (!link || !titleEl) return null
        const id = this.comicIdFromHref(link.attributes.href)
        if (!id) return null
        const img = li.querySelector(".pic img")
        const serial = li.querySelector(".Serial_title")
        return new Comic({
            id: id,
            title: titleEl.text.trim(),
            cover: this.absoluteUrl(img ? (img.attributes["data-original"] || img.attributes.src || "") : ""),
            subTitle: serial ? serial.text.trim() : ""
        })
    }

    // 分类/搜索共用卡片: ul > li.Conjunction(封面+链接) + 下一li(strong a 标题 + 简介)
    parsePairList(ul) {
        if (!ul) return null
        const coverLi = ul.querySelector("li.Conjunction")
        const link = coverLi ? coverLi.querySelector("a") : null
        const img = coverLi ? coverLi.querySelector("img") : null
        const titleEl = ul.querySelector("strong a")
        if (!titleEl) return null
        // 搜索页封面 li 无链接, 用标题链接兜底取 ID
        const id = this.comicIdFromHref(link ? link.attributes.href : "") || this.comicIdFromHref(titleEl.attributes.href)
        if (!id) return null
        const descLi = ul.querySelector("li:nth-child(2)")
        let desc = ""
        if (descLi) {
            const strong = descLi.querySelector("strong")
            const text = descLi.text.replace(/\s+/g, " ").trim()
            if (strong) {
                desc = text.replace(strong.text.trim(), "").trim()
            }
        }
        return new Comic({
            id: id,
            title: titleEl.text.trim(),
            cover: this.absoluteUrl(img ? (img.attributes.src || "") : ""),
            subTitle: desc.slice(0, 80)
        })
    }

    parseMaxPage(html) {
        let max = 1
        const re = /PageIndex=(\d+)/g
        let m
        while ((m = re.exec(html)) !== null) {
            const n = parseInt(m[1])
            if (n > max) max = n
        }
        return max
    }

    explore = [
        {
            title: "SF漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                const res = await Network.get(SfacgManhua.baseUrl + "/", this.headers())
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`
                }
                const doc = new HtmlDocument(res.body)
                try {
                    const result = {}
                    // 每个 div.column: span.main-title 为分区名, 后随 ul.story-list
                    const columns = Array.from(doc.querySelectorAll("div.column"))
                    for (const col of columns) {
                        const titleEl = col.querySelector("span.main-title")
                        const list = col.querySelector("ul.story-list")
                        if (!titleEl || !list) continue
                        const comics = []
                        for (const li of Array.from(list.querySelectorAll("li"))) {
                            const c = this.parseHomeCard(li)
                            if (c) comics.push(c)
                        }
                        if (comics.length > 0) {
                            result[titleEl.text.trim()] = comics
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
        title: "SF漫画",
        parts: [
            {
                name: "题材",
                type: "fixed",
                categories: ["热血", "校园", "推理", "机战", "冒险", "运动", "耽美", "搞笑", "科幻", "魔幻", "恐怖", "社会", "爱情", "武侠", "温情"],
                categoryParams: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15"],
                itemType: "category"
            }
        ]
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            const url = `${SfacgManhua.baseUrl}/catalog/default.aspx?tid=${param}&PageIndex=${page}`
            const res = await Network.get(url, this.headers())
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            const doc = new HtmlDocument(res.body)
            try {
                const comics = []
                for (const ul of Array.from(doc.querySelectorAll("ul.Comic_Pic_List"))) {
                    const c = this.parsePairList(ul)
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
            const kw = encodeURIComponent(keyword)
            const url = page > 1
                ? `${SfacgManhua.searchBase}/default.aspx?Key=${kw}&S=0&SS=0&PageIndex=${page}`
                : `${SfacgManhua.searchBase}/?Key=${kw}&S=0&SS=0`
            const res = await Network.get(url, this.headers())
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            const doc = new HtmlDocument(res.body)
            try {
                const comics = []
                // 搜索结果: 表格内多个 ul, 每个 ul = li.Conjunction(封面) + li(标题/简介)
                for (const ul of Array.from(doc.querySelectorAll("ul"))) {
                    if (ul.querySelector("li.Conjunction") && ul.querySelector("strong a")) {
                        const c = this.parsePairList(ul)
                        if (c) comics.push(c)
                    }
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

    comic = {
        loadInfo: async (id) => {
            const res = await Network.get(`${SfacgManhua.baseUrl}/mh/${encodeURIComponent(id)}/`, this.headers())
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            const html = res.body
            // 缓存数字 comic id (阅读页图片接口需要)
            const cidM = html.match(/var c = (\d+)/)
            if (cidM) {
                this.cidCache[id] = cidM[1]
            }
            const doc = new HtmlDocument(html)
            try {
                const titleEl = doc.querySelector("h1")
                const coverEl = doc.querySelector(".cover img")
                const introM = html.match(/<\/span><br\s*\/?>\s*([\s\S]*?)<span class="broken_line"/)
                const authorM = html.match(/作者：<\/span><a[^>]*>([^<]+)<\/a>/)
                const genreM = html.match(/作品类型：<\/span><a[^>]*>([^<]+)<\/a>/)
                const statusM = html.match(/\[(连载中|完结)\]/)

                const description = introM ? introM[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : ""
                const tags = {}
                if (authorM && authorM[1].trim()) tags["作者"] = [authorM[1].trim()]
                if (genreM && genreM[1].trim()) tags["题材"] = [genreM[1].trim()]
                if (statusM && statusM[1]) tags["状态"] = [statusM[1] === "连载中" ? "连载中" : "已完结"]

                const eps = new Map()
                for (const a of Array.from(doc.querySelectorAll(".comic_Serial_list a"))) {
                    const m = String(a.attributes.href || "").match(/\/(\d+)\/$/)
                    const t = a.text.trim()
                    if (m) {
                        eps.set(m[1], t)
                    }
                }
                const chapters = new Map()
                if (eps.size > 0) {
                    chapters.set("正篇", eps)
                }

                return new ComicDetails({
                    title: titleEl ? titleEl.text.trim() : id,
                    cover: coverEl ? this.absoluteUrl(coverEl.attributes.src || "") : "",
                    description: description,
                    tags: tags,
                    chapters: chapters,
                    subId: this.cidCache[id] || id
                })
            } finally {
                doc.dispose()
            }
        },
        loadEp: async (comicId, epId) => {
            let cid = this.cidCache[comicId]
            if (!cid) {
                // 从历史直接进入时无缓存: 抓阅读页取 cid
                const v = await Network.get(`${SfacgManhua.baseUrl}/mh/${encodeURIComponent(comicId)}/${encodeURIComponent(epId)}/`, this.headers())
                const m = v.body.match(/var c = (\d+)/)
                cid = m ? m[1] : ""
                this.cidCache[comicId] = cid
            }
            if (!cid) {
                throw "无法获取漫画ID(cid)"
            }
            const url = `${SfacgManhua.baseUrl}/ajax/Common.ashx?op=getPics&cid=${cid}&chapId=${encodeURIComponent(epId)}`
            const res = await Network.get(url, {
                ...this.headers(),
                "Referer": `${SfacgManhua.baseUrl}/mh/${encodeURIComponent(comicId)}/${encodeURIComponent(epId)}/`,
                "X-Requested-With": "XMLHttpRequest",
            })
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            const data = JSON.parse(res.body)
            if (!data || data.status !== 200 || !Array.isArray(data.data)) {
                return { images: [] }
            }
            return {
                images: data.data.map(u => this.absoluteUrl(u)).filter(u => u)
            }
        }
    }
}
