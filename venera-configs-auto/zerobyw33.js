class ZeroByW33 extends ComicSource {

    name = "zero搬运网"
    key = "zerobyw33"
    version = "1.1.0"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/meaninglesslyy/venera-configs@main/zerobyw33.js"

    // 永久发布页（GitHub Pages，永不失效）
    landingPage = "https://zerobyw.github.io/"
    base = "https://www.zerobyw33.com"
    logo = "https://www.zerobyw33.com/template/discuzx5/static/logo-zero-x5-home.svg"

    // 分类映射
    catMap = {
        1: "卖肉", 6: "后宫", 22: "冒险", 23: "奇幻", 13: "搞笑",
        28: "日常", 35: "职业", 29: "体育", 15: "战斗", 31: "爱情",
        34: "机战", 40: "悬疑", 41: "美食", 42: "百合", 43: "等网源",
    }

    // ============ 域名自动解析 ============

    // 从永久发布页提取最新域名
    extractDomainFromLanding(body) {
        let doc = new HtmlDocument(body)
        let domain = ""
        doc.querySelectorAll("a").forEach(a => {
            if (domain) return
            let href = a.attributes["href"] || ""
            // 匹配 zerobyw 系列的域名（含 www 或不含）
            let m = href.match(/https?:\/\/((?:www\.)?zerobyw[^\/\s"'<>]+)/)
            if (m) domain = m[1]
        })
        doc.dispose()
        return domain
    }

    // 确保域名已解析（缓存 24 小时，惰性执行）
    async ensureDomain() {
        if (this._domainResolved) return
        this._domainResolved = true

        let cached = this.loadData("resolved_domain")
        if (cached) {
            try {
                let obj = JSON.parse(cached)
                if (obj.domain && (!obj.t || (Date.now() - obj.t) < 24 * 3600 * 1000)) {
                    this.base = "https://" + obj.domain
                    return
                }
            } catch (e) {}
        }

        // 拉取永久发布页获取最新域名
        try {
            let res = await Network.get(this.landingPage, this.pageHeaders())
            if (res.status === 200) {
                let domain = this.extractDomainFromLanding(res.body)
                if (domain) {
                    this.base = "https://" + domain
                    this.saveData("resolved_domain", JSON.stringify({
                        t: Date.now(),
                        domain: domain
                    }))
                }
            }
        } catch (e) {
            // 发布页也挂了就用默认域名
        }
    }

    // 获取当前主域名（不含 www）
    currentMainDomain() {
        let m = this.base.match(/https?:\/\/(?:www\.)?(.+)/)
        return m ? m[1] : "zerobyw33.com"
    }

    pageHeaders() {
        return {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
            "Referer": this.base + "/pc/pc/",
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }

    normalizeUrl(u) {
        if (!u) return ""
        u = String(u).trim()
        if (u.startsWith("//")) return "https:" + u
        // 图片服务器只支持 HTTPS，检测到 tupa. 的 HTTP 链接就强制转换
        if (u.startsWith("http://") && u.indexOf("tupa.") !== -1) {
            return "https://" + u.substring(7)
        }
        if (/^https?:\/\//i.test(u)) return u
        if (u.startsWith("/")) return this.base + u
        return u
    }

    async fetchBody(label, url) {
        let res = await Network.get(url, this.pageHeaders())
        if (res.status !== 200) throw label + " 请求失败: " + res.status
        return res.body
    }

    // ============ 解析漫画网格 ============
    parseGrid(body) {
        let doc = new HtmlDocument(body)
        let comics = []
        doc.querySelectorAll(".pc-manga-grid > a").forEach(el => {
            let href = el.attributes["href"] || ""
            let kuid = href.match(/kuid=(\d+)/)?.[1]
            if (!kuid) return
            let img = el.querySelector("img")
            let cover = this.normalizeUrl(img?.attributes["src"] || img?.attributes["data-src"] || "")
            let title = el.querySelector("h3")?.text?.trim() || ""
            let subTitle = el.querySelector("p")?.text?.trim() || ""
            comics.push({ id: kuid, title, subTitle, cover })
        })
        doc.dispose()
        return comics
    }

    // ============ 提取最大页数 ============
    extractMaxPage(body) {
        let doc = new HtmlDocument(body)
        let maxPage = 1
        doc.querySelectorAll("a").forEach(a => {
            let href = a.attributes["href"] || ""
            let text = a.text?.trim() || ""
            if (href.indexOf("page=") !== -1 && /^\d+$/.test(text)) {
                let n = parseInt(text, 10)
                if (n > maxPage) maxPage = n
            }
        })
        doc.dispose()
        return maxPage
    }

    // ============ 构建筛选 URL ============
    buildFilterUrl(param, page) {
        let url = this.base + "/pc/pc/?page=" + page

        if (param.startsWith("cat_")) {
            let catId = param.replace("cat_", "")
            if (catId !== "all") url += "&category_id=" + catId
        } else if (param.startsWith("progress_")) {
            let jindu = param.replace("progress_", "")
            if (jindu !== "all") url += "&jindu=" + jindu
        } else if (param.startsWith("lang_")) {
            let shuxing = param.replace("lang_", "")
            if (shuxing !== "all") url += "&shuxing=" + encodeURIComponent(shuxing)
        } else if (param.startsWith("sort_")) {
            if (param === "sort_addtime") url += "&order=addtime&dir=asc"
            else if (param === "sort_views") url += "&order=views&dir=desc"
            else if (param === "sort_favores") url += "&order=favores&dir=desc"
        }

        return url
    }

    // ============ 大厅：最新上架 ============
    explore = [
        {
            title: "zero搬运网",
            type: "multiPartPage",
            load: async (page) => {
                await this.ensureDomain()
                let body = await this.fetchBody("latest", this.base + "/pc/pc/?order=addtime&dir=desc&page=1")
                let comics = this.parseGrid(body)
                return [
                    {
                        title: "LATEST",
                        comics,
                        viewMore: { page: "category", attributes: { category: "全部", param: "cat_all" } },
                    }
                ]
            }
        }
    ]

    // ============ 分类 ============
    category = {
        title: "zero搬运网",
        parts: [
            {
                name: "分类",
                type: "fixed",
                itemType: "category",
                categories: Object.values(this.catMap),
                categoryParams: Object.keys(this.catMap).map(k => "cat_" + k),
            },
            {
                name: "进度",
                type: "fixed",
                itemType: "category",
                categories: ["连载中", "已完结"],
                categoryParams: ["progress_0", "progress_1"],
            },
            {
                name: "语言",
                type: "fixed",
                itemType: "category",
                categories: ["全中文", "一半中文一半生肉", "全生肉"],
                categoryParams: ["lang_全中文", "lang_一半中文一半生肉", "lang_全生肉"],
            },
            {
                name: "排序",
                type: "fixed",
                itemType: "category",
                categories: ["人气", "收藏"],
                categoryParams: ["sort_views", "sort_favores"],
            },
        ],
        enableRankingPage: false,
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            await this.ensureDomain()
            let url = this.buildFilterUrl(param, page)

            try {
                let body = await this.fetchBody("cat", url)
                let comics = this.parseGrid(body)
                let maxPage = this.extractMaxPage(body)
                if (!comics.length) return { comics: [], maxPage: page }
                return { comics, maxPage: Math.max(maxPage, page) }
            } catch (e) {
                return { comics: [], maxPage: page }
            }
        }
    }

    // ============ 搜索 ============
    search = {
        load: async (keyword, options, page) => {
            await this.ensureDomain()
            let kw = encodeURIComponent(keyword)
            let url = this.base + "/pc/pc/?keyword=" + kw + "&page=" + page
            try {
                let body = await this.fetchBody("search", url)
                let comics = this.parseGrid(body)
                let maxPage = this.extractMaxPage(body)
                if (!comics.length) return { comics: [], maxPage: page }
                return { comics, maxPage: Math.max(maxPage, page) }
            } catch (e) {
                return { comics: [], maxPage: page }
            }
        },
        optionList: []
    }

    // ============ 详情 / 章节 ============
    comic = {
        loadInfo: async (id) => {
            await this.ensureDomain()
            let body = await this.fetchBody("detail", this.base + "/pc/details/?kuid=" + id)
            let doc = new HtmlDocument(body)

            // 封面
            let cover = ""
            let allImgs = doc.querySelectorAll("img")
            for (let i = 0; i < allImgs.length; i++) {
                let src = allImgs[i].attributes["src"] || ""
                if (src.indexOf("tupa.") !== -1) {
                    cover = this.normalizeUrl(src)
                    break
                }
            }

            // 标题
            let titleEl = doc.querySelector("h1")
            let title = titleEl?.text?.trim() || id

            // 简介
            let desc = ""
            let allP = doc.querySelectorAll("p")
            for (let i = 0; i < allP.length; i++) {
                let text = allP[i].text?.trim() || ""
                if (text.length > 30) {
                    desc = text
                    break
                }
            }

            // 从所有 span 中提取作者、状态、语言、分类标签
            let author = ""
            let status = ""
            let lang = ""
            let tags = []
            let allSpans = doc.querySelectorAll("span")
            for (let i = 0; i < allSpans.length; i++) {
                let text = allSpans[i].text?.trim() || ""
                if (text.startsWith("作者:")) {
                    author = text.replace("作者:", "").trim()
                } else if (text === "连载中" || text === "已完结") {
                    status = text
                } else if (["全中文", "全生肉", "一半中文一半生肉"].indexOf(text) !== -1) {
                    lang = text
                } else if (text.length > 1 && text.length < 8 && text !== author && text.indexOf(":") === -1 && text.indexOf("收藏") === -1 && text.indexOf("人气") === -1 && isNaN(Number(text))) {
                    tags.push(text)
                }
            }

            // 章节列表
            let chapters = {}
            doc.querySelectorAll("a").forEach(a => {
                let href = a.attributes["href"] || ""
                let zjid = href.match(/zjid=(\d+)/)?.[1]
                let name = a.text?.trim() || ""
                if (zjid && name) {
                    chapters[zjid] = name
                }
            })

            doc.dispose()

            let tagMap = {}
            if (author) tagMap["作者"] = [author]
            if (status) tagMap["状态"] = [status]
            if (lang) tagMap["语言"] = [lang]
            if (tags.length) tagMap["标签"] = tags

            if (!Object.keys(chapters).length) throw "未解析到章节列表"

            return new ComicDetails({
                id, title, cover, description: desc,
                tags: tagMap,
                chapters,
            })
        },

        loadEp: async (comicId, epId) => {
            await this.ensureDomain()
            let body = await this.fetchBody("ep", this.base + "/pc/view/index.php?zjid=" + epId)
            let doc = new HtmlDocument(body)
            let images = []
            doc.querySelectorAll("img.manga-image").forEach(img => {
                let src = img.attributes["src"] || ""
                if (src) images.push(this.normalizeUrl(src))
            })
            doc.dispose()
            if (!images.length) throw "未解析到图片"
            return { images }
        },
    }

    // ============ 设置：手动刷新域名、刷新列表 ============
    settings = {
        refresh_domain: {
            title: "刷新域名",
            type: "callback",
            buttonText: "从永久发布页刷新最新域名",
            callback: () => {
                this.deleteData("resolved_domain")
                this._domainResolved = false
                return this.ensureDomain().then(() => {
                    return "✅ 已刷新，当前域名: " + this.base
                })
            }
        }
    }
}