class ZeroByW33 extends ComicSource {

    name = "zero搬运网"
    key = "zerobyw33"
    version = "1.2.0"
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

    // ============ 账号登录（Discuz! 论坛表单登录） ============
    // 站点为 Discuz! X（模板 discuzx5），登录流程：
    //   1) GET  member.php?mod=logging&action=login  建立会话 cookie，并从登录表单取 formhash / loginhash
    //   2) POST 同一 action（已带 loginsubmit=yes&formhash=..&loginhash=..）提交 username / password
    // 实测（2026-09-15，游客身份提交错误凭据）：服务端返回「登录失败，您还可以尝试 4 次」，
    // 证明 formhash/loginhash 与会话 cookie 的取用方式、POST 字段格式均被站点接受。
    // 登录后 cookie 由 Venera 的 CookieJar 自动保存，可直接用于解锁「需登录」章节。

    account = {
        login: async (account, pwd) => {
            await this.ensureDomain()
            let uname = String(account || "").trim()
            let pass = String(pwd || "")
            if (!uname || !pass) throw "请输入用户名和密码"

            let loginUrl = this.loginPageUrl()
            let pageRes = await Network.get(loginUrl, this.pageHeaders())
            if (pageRes.status !== 200) throw "打开登录页失败: " + pageRes.status

            let form = this.parseLoginForm(pageRes.body)
            if (!form.formhash) throw "登录页解析失败：未取到 formhash（站点可能改版）"

            let action = form.action
            // 表单 action 为相对路径（如 member.php?mod=logging&...），需补全为绝对地址
            if (!action) action = "member.php?mod=logging&action=login&loginsubmit=yes"
            if (action.startsWith("//")) action = "https:" + action
            else if (!/^https?:\/\//i.test(action)) action = this.base + "/" + action.replace(/^\/+/, "")
            if (action.indexOf("loginsubmit=yes") === -1) {
                action += (action.indexOf("?") === -1 ? "?" : "&") + "loginsubmit=yes"
            }

            let headers = this.pageHeaders()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
            headers["Referer"] = loginUrl
            headers["Origin"] = this.base

            let body =
                "formhash=" + encodeURIComponent(form.formhash) +
                "&referer=" + encodeURIComponent(this.base + "/") +
                "&loginfield=" +
                "&username=" + encodeURIComponent(uname) +
                "&password=" + encodeURIComponent(pass) +
                "&questionid=0&answer=&cookietime=2592000&loginsubmit=true"

            let res = await Network.post(action, headers, body)
            if (res.status !== 200) throw "登录请求失败: " + res.status

            let err = this.loginResultMessage(res.body)
            if (err) throw err
            return "ok"
        },

        // 退出登录：清除本站 cookie
        logout: () => {
            Network.deleteCookies(this.base)
            return "ok"
        },

        // 「注册账号」按钮跳转到站点注册页
        registerWebsite: "https://www.zerobyw33.com/member.php?mod=register",
    }

    // 登录页地址
    loginPageUrl() {
        return this.base + "/member.php?mod=logging&action=login"
    }

    /**
     * 解析 Discuz 登录表单：返回 { action, formhash, loginhash }
     * 表单形如 <form id="loginform_XXXX" action="member.php?mod=logging&action=login&loginsubmit=yes&formhash=..&loginhash=..">
     */
    parseLoginForm(html) {
        let doc = new HtmlDocument(html)
        let action = ""
        let formhash = ""
        let loginhash = ""
        try {
            let forms = doc.querySelectorAll("form")
            for (let i = 0; i < forms.length; i++) {
                let id = forms[i].attributes["id"] || ""
                let act = forms[i].attributes["action"] || ""
                if (id.indexOf("loginform") === 0 || act.indexOf("loginsubmit=yes") !== -1) {
                    action = act
                    let fm = act.match(/formhash=([0-9a-fA-F]+)/)
                    if (fm) formhash = fm[1]
                    let lm = act.match(/loginhash=([A-Za-z0-9]+)/)
                    if (lm) loginhash = lm[1]
                    break
                }
            }
            // 兜底：隐藏域 formhash / 页面内 loginhash
            if (!formhash) {
                let hidden = doc.querySelector("input[name=formhash]")
                if (hidden) formhash = hidden.attributes["value"] || ""
            }
        } finally {
            doc.dispose()
        }
        if (!loginhash) {
            let m = String(html || "").match(/loginhash=([A-Za-z0-9]+)/)
            if (m) loginhash = m[1]
        }
        return { action, formhash, loginhash }
    }

    /**
     * 判定登录响应：成功返回空字符串，失败返回可读的中文原因。
     * Discuz 成功时会输出「欢迎您回来 / 现在将转入 / succeedhandle('login')」。
     */
    loginResultMessage(html) {
        let text = String(html || "")
        if (/欢迎您回来|现在将转入|succeedhandle\s*\(\s*['"]login['"]/i.test(text)) return ""
        let m = text.match(/登录失败[^<>\n]{0,60}/)
        if (m) return m[0].trim()
        let m2 = text.match(/(密码错误|用户名不存在|该用户不存在|安全提问|验证码|请填写|用户名无效)[^<>\n]{0,40}/)
        if (m2) return m2[0].trim()
        return "登录失败（站点未返回登录成功标记，请核对账号密码后重试）"
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

    /**
     * 解析章节目录。优先使用页面内 `mangaDownloadChapters` JSON —— 它包含完整章节；
     * 未登录时站点把「需登录」章节渲染成 div（无 href），只扫链接会漏章节。
     * 已取证：kuid=22790 锚点仅 5 话，而 JSON 为 22 话（1-4、24-39、601）。
     * JSON 解析失败时回退到链接扫描。
     */
    parseChapters(body, doc) {
        let chapters = {}
        let m = String(body || "").match(/mangaDownloadChapters\s*=\s*(\[[\s\S]*?\])\s*;/)
        if (m) {
            try {
                let list = JSON.parse(m[1])
                for (let i = 0; i < list.length; i++) {
                    let zjid = String(list[i].zjid || "").trim()
                    let name = String(list[i].zjname || "").trim()
                    if (zjid) chapters[zjid] = name || zjid
                }
            } catch (e) {}
        }
        if (!Object.keys(chapters).length) {
            doc.querySelectorAll("a").forEach(a => {
                let href = a.attributes["href"] || ""
                let zjid = href.match(/zjid=(\d+)/)?.[1]
                let name = a.text?.trim() || ""
                if (zjid && name) chapters[zjid] = name
            })
        }
        return chapters
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
            let chapters = this.parseChapters(body, doc)

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
            if (!images.length) {
                // 未登录时站点会把「需登录」章节渲染成 0 张图 + 登录提示（已取证）。
                if (/需要登录|请先登录|登录后/.test(body)) {
                    throw "该章节需要登录后阅读，请在漫画源设置中登录账号"
                }
                if (/VIP|会员专属/.test(body)) {
                    throw "该章节为 VIP 会员专属，请到官网开通后阅读"
                }
                throw "未解析到图片"
            }
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
