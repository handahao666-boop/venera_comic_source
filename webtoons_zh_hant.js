// LINE WEBTOON（繁体中文 / www.webtoons.com/zh-hant）Venera 漫画源
// 版本: 1.0.0        证据基准: 2026-09-19 真网取证（HTTP 客户端 + 无头浏览器 CDP + 本地代理出口 SG）
// 开发规范: 依据《Venera 漫画源开发日志（统一合并版 v3）》附录 D / 第 11 节模板
//
// ── 取证摘要（全部为真实请求结果，样本保存在 webtoons_evidence/v2/）────────────
//   首页   GET /zh-hant/                                     200  260181B  5 个 .main_section / 76 张卡片
//   搜索   GET m.webtoons.com/zh-hant/search/result          200  JSON    每页 20 条 + totalCount（真实 maxPage 依据）
//   搜索   GET /zh-hant/search?keyword=&page=N               200  单页 21~24 条（兜底路径，无分页控件）
//   题材   GET /zh-hant/genres/{slug}?sortOrder=MANA          200  romance 934 / fantasy 437 / drama 198，无分页
//   日程   GET /zh-hant/originals/{day}                       200  mon138 tue142 wed155 thu146 fri151 sat156 sun151
//   排行   GET /zh-hant/ranking/{trending|popular|originals|canvas}  200  各 30 条
//   详情   GET /zh-hant/{genre}/{slug}/list?title_no=N        200  h1.subj + og:image + .summary + .genre + .author_area
//   章节   GET m.webtoons.com/api/v1/webtoon/{id}/episodes?pageSize=1000&startIndex=0
//                                                             200  5145→119 话，546→618 话（完整，无缺页）
//   图片   GET /zh-hant/{genre}/{slug}/{ep}/viewer             200  #_imageList img[data-url]，66/71/238/103 张
//   图片   CDN webtoon-phinf.pstatic.net 直链，无加密、无签名参数；缺 Referer 403，带 Referer 200
//
// ── 已实测的 URL 容错（证据: probe_wt_urlforms.js / probe_wt_viewerforms.js）───
//   * 详情页的题材段与 slug 段都可被站点归一化：/zh-hant/a/b/list?title_no=5145 同样返回 200 与正确作品，
//     因此本源只用 title_no 作为稳定标识，路径段仅作参考。
//   * 阅读页同样容错：/zh-hant/a/b/{任意段}/viewer?title_no=5145&episode_no=60 返回第 60 话。
//
// ── 已知限制（真网实测，必须告知用户）────────────────────────────────────────
//   站点对中国大陆 IP 做地区限制：www.webtoons.com/zh-hant/* 返回 905B 的「无法显示此网页」，
//   m.webtoons.com/zh-hant/* 返回 606B 同类页面。同一 IP 通过代理（出口 SG）访问正常，
//   说明是站点地区限制，与代码、UA、HTTP 版本、Cookie、TLS 指纹都无关（已逐项排除）。
//   直连可用性矩阵（probe_wt_direct.js，无代理 6 秒超时）：
//     www/zh-hant/                200  905B  拦截页
//     www/zh-hant-hk/             200  43527B 首页镜像可用
//     www/zh-hant-hk/originals/*  200  19751B 日程镜像可用
//     www/zh-hant-hk/genres/*     301 -> /zh-hant/ 最终被拦
//     www/zh-hant-hk/详情|阅读      301 -> /zh-hant/ 最终被拦
//     m.webtoons.com/api/v1/webtoon/{id}/episodes  200 JSON 可用（注意：不能带语言段，带语言段会 500）
//     webtoon-phinf.pstatic.net    ERR  ECONNREFUSED 162.220.12.226:443（图片 CDN 直连不可达）
//     swebtoon-phinf.pstatic.net   ERR  timeout
//   结论：大陆直连只能看到首页/日程(镜像)与搜索(m 站)，详情、章节目录与漫画图片都不可达，
//   也就是说**阅读必须走非中国大陆网络**。本源命中拦截页时自动改用 /zh-hant-hk/ 重试，
//   全部失败时抛出明确中文提示，绝不静默返回空列表（符合开发日志 D.5 / D.12）。
//   Venera 客户端只要在网络设置里启用代理，本源即自动经由该代理请求（AppDio 使用 getProxy()）。
//
// ── v1.0.0 内部回归修复记录（该缺陷未随任何版本发布）─────────────────────────
//   1. 详情/章节全部 HTTP 500：fetchHtml 会为路径补 /zh-hant，而 detailPath/viewerPath 产出的
//      路径本身也带 /zh-hant，实际请求变成 /zh-hant/zh-hant/... 被站点直接 500。
//      修复：新增 zonePath() 统一剥掉路径里已有的语言段（curl 取证：双前缀 500 4641B）。
//   2. 首页卡片副标题为空：各区块第二行真实字段不同（题材 / 浏览数 / 完全没有），
//      新增 cardSubTitle() + genreLabelFromPath() 兜底链，覆盖率 0/74 -> 74/74。
//   3. 搜索「搜尋範圍」不再声明 default，避免客户端 jsonEncode 后没有任何 chip 处于选中态。
class WebtoonsZhHant extends ComicSource {
    name = "LINE WEBTOON"
    key = "webtoons_zh_hant"
    version = "1.0.0"
    minAppVersion = "1.6.0"
    url = ""

    // ---------------- 站点常量 ----------------
    static SITE = "https://www.webtoons.com"
    static MSITE = "https://m.webtoons.com"
    static LANG = "zh-hant"
    static MIRROR = "zh-hant-hk"
    static CDN = "https://webtoon-phinf.pstatic.net"
    static PC_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    static M_UA = "Mozilla/5.0 (Linux; Android 13; SM-S9080) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
    static BLOCK_MARK = "无法显示此网页"
    static REGION_ERROR = "LINE WEBTOON 繁体中文站（zh-hant）在当前网络被地区限制：服务器返回「无法显示此网页」。请开启代理/VPN（使用非中国大陆节点）后重试。"
    static SEARCH_PAGE_SIZE = 20

    // 题材（证据: /zh-hant/genres 页面导航，共 23 项）
    static GENRES = [
        ["愛情", "romance"],
        ["奇幻冒險", "fantasy"],
        ["校園", "school"],
        ["劇情", "drama"],
        ["動作", "action"],
        ["驚悚", "thriller"],
        ["恐怖", "horror"],
        ["搞笑", "comedy"],
        ["生活/日常", "slice_of_life"],
        ["療癒/萌系", "heartwarming"],
        ["懸疑推理", "mystery"],
        ["穿越/轉生", "time_slip"],
        ["現代/職場", "city_office"],
        ["古代宮廷", "eastern_palace"],
        ["歐式宮廷", "western_palace"],
        ["武俠", "martial_arts"],
        ["少年", "shonen"],
        ["大人系", "romance_m"],
        ["LGBTQ+", "bl_gl"],
        ["影視化", "adaptation"],
        ["台灣原創作品", "local"],
        ["翻頁漫畫", "epub"],
        ["小說", "web_novel"]
    ]

    // 连载日程（证据: /zh-hant/originals/{day}）
    static WEEKDAYS = [
        ["週一", "monday"],
        ["週二", "tuesday"],
        ["週三", "wednesday"],
        ["週四", "thursday"],
        ["週五", "friday"],
        ["週六", "saturday"],
        ["週日", "sunday"]
    ]

    // 排行榜分页（证据: /ranking 导航）
    static RANK_TABS = [
        ["即時熱門", "trending"],
        ["人氣排行榜", "popular"],
        ["正式連載", "originals"],
        ["CANVAS", "canvas"]
    ]

    // 排行榜题材筛选（证据: /ranking/originals?subTabGenreCode=...，站点仅提供这 10 个）
    static RANK_GENRES = [
        ["愛情", "ROMANCE"],
        ["奇幻冒險", "FANTASY"],
        ["校園", "SCHOOL"],
        ["劇情", "DRAMA"],
        ["影視化", "ADAPTATION"],
        ["歐式宮廷", "WESTERN_PALACE"],
        ["台灣原創作品", "LOCAL"],
        ["武俠", "MARTIAL_ARTS"],
        ["LGBTQ+", "BL_GL"],
        ["大人系", "ROMANCE_M"]
    ]

    // 直连被拦截时优先走镜像；成功访问 zh-hant 后会复位
    _preferMirror = false

    init() {
        this._preferMirror = false
    }

    // ---------------- 请求头 ----------------
    pcHeaders(extra) {
        const h = {
            "User-Agent": WebtoonsZhHant.PC_UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-TW,zh;q=0.9",
            "Referer": WebtoonsZhHant.SITE + "/" + WebtoonsZhHant.LANG + "/"
        }
        if (extra) { for (const k in extra) { h[k] = extra[k] } }
        return h
    }

    mHeaders(extra) {
        const h = {
            "User-Agent": WebtoonsZhHant.M_UA,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-TW,zh;q=0.9",
            "Referer": WebtoonsZhHant.SITE + "/" + WebtoonsZhHant.LANG + "/"
        }
        if (extra) { for (const k in extra) { h[k] = extra[k] } }
        return h
    }

    // ---------------- 地区拦截识别 ----------------
    // 拦截页只有 905B(www) / 606B(m)，正文很短且含固定文案；真实页面最小也有 6KB+
    isBlockedPage(body) {
        if (!body) return true
        const s = String(body)
        if (s.length < 4000 && s.indexOf(WebtoonsZhHant.BLOCK_MARK) >= 0) return true
        return false
    }

    zoneOrder() {
        return this._preferMirror
            ? [WebtoonsZhHant.MIRROR, WebtoonsZhHant.LANG]
            : [WebtoonsZhHant.LANG, WebtoonsZhHant.MIRROR]
    }

    // 语言前缀归一化：detailPath/viewerPath 产出的路径自带 /zh-hant/，
    // 若不去掉就会拼成 /zh-hant/zh-hant/... （站点直接返回 HTTP 500，已实测）。
    // 这里统一剥掉已有的语言段，保证「站点基址 + /语言 + 页面路径」只出现一次语言。
    zonePath(path) {
        let p = String(path == null ? "" : path).trim()
        if (!p) return "/"
        if (p.charAt(0) !== "/") p = "/" + p
        const m = p.match(/^\/(?:zh-hant|zh-hant-hk)(?=\/|$)/)
        if (m) p = p.substring(m[0].length)
        if (!p) return "/"
        if (p.charAt(0) !== "/") p = "/" + p
        return p
    }

    // 取 HTML：先试 zh-hant，命中拦截页再试 zh-hant-hk 镜像，都失败则抛出明确提示
    async fetchHtml(path, extraHeaders) {
        let lastError = ""
        for (const zone of this.zoneOrder()) {
            const url = WebtoonsZhHant.SITE + "/" + zone + this.zonePath(path)
            try {
                const res = await Network.get(url, this.pcHeaders(extraHeaders))
                if (res.status !== 200) {
                    // 站点对路径异常/内容缺失会直接回 500，这类不是地区限制，单独记录
                    lastError = "HTTP " + res.status + " @ /" + zone + this.zonePath(path)
                    continue
                }
                if (this.isBlockedPage(res.body)) {
                    if (zone === WebtoonsZhHant.LANG) { this._preferMirror = true }
                    lastError = "地区拦截页(无法显示此网页) @ /" + zone
                    continue
                }
                if (zone === WebtoonsZhHant.LANG) { this._preferMirror = false }
                return res.body
            } catch (e) {
                lastError = String((e && e.message) || e)
            }
        }
        throw WebtoonsZhHant.REGION_ERROR + "（最后错误：" + lastError + "）"
    }

    // 取 JSON（m.webtoons.com）；解析失败返回 null，由调用方决定回退
    async fetchJson(url, extraHeaders) {
        const res = await Network.get(url, this.mHeaders(extraHeaders))
        if (res.status !== 200) { throw "Invalid status code: " + res.status }
        if (this.isBlockedPage(res.body)) { throw WebtoonsZhHant.REGION_ERROR }
        try { return JSON.parse(res.body) } catch (e) { return null }
    }

    // 搜索接口：/zh-hant/... 在直连时被拦截，/zh-hant-hk/... 前缀同样返回繁体结果（已实测一致）
    async fetchSearchJson(queryString) {
        let lastError = ""
        for (const zone of this.zoneOrder()) {
            const url = WebtoonsZhHant.MSITE + "/" + zone + "/search/result?" + queryString
            try {
                const json = await this.fetchJson(url)
                if (json && json.result) {
                    if (zone === WebtoonsZhHant.LANG) { this._preferMirror = false }
                    return json
                }
                lastError = "empty json"
            } catch (e) {
                if (zone === WebtoonsZhHant.LANG) { this._preferMirror = true }
                lastError = String((e && e.message) || e)
            }
        }
        throw lastError
    }

    // ---------------- URL / ID 工具 ----------------
    cdnUrl(u) {
        if (!u) return ""
        let s = String(u).trim()
        if (s.indexOf("//") === 0) { s = "https:" + s }
        if (s.indexOf("http://") === 0) { s = "https://" + s.substring(7) }
        if (s.indexOf("http") === 0) return s
        if (s.charAt(0) === "/") return WebtoonsZhHant.CDN + s
        return WebtoonsZhHant.CDN + "/" + s
    }

    titleNoOf(text) {
        const s = String(text == null ? "" : text).trim()
        let m = s.match(/title[_\-]?no[=\/](\d+)/i)
        if (m) return m[1]
        m = s.match(/^(\d{2,9})(?:[\|:;].*)?$/)
        if (m) return m[1]
        return ""
    }

    episodeNoOf(text) {
        const s = String(text == null ? "" : text).trim()
        let m = s.match(/episode[_\-]?no[=\/](\d+)/i)
        if (m) return m[1]
        m = s.match(/^(\d{1,6})$/)
        if (m) return m[1]
        m = s.match(/^\d{1,9}\D{1,2}(\d{1,6})$/)
        if (m) return m[1]
        return ""
    }

    // 解析任意历史输入形态 -> { titleNo, genre, slug }
    // 支持: 本源规范 ID / 完整 URL / 纯 title_no / 组合 ID(5145|slug)
    // 非法或缺少 title_no -> null（不发出畸形请求）
    parseComicId(id) {
        const s = String(id == null ? "" : id).trim()
        if (!s) return null
        const titleNo = this.titleNoOf(s)
        if (!titleNo) return null
        let genre = "x"
        let slug = "y"
        const m = s.match(/\/(?:zh-hant|zh-hant-hk)\/([^\/?#]+)\/([^\/?#]+)\//)
        if (m) { genre = m[1]; slug = m[2] }
        return { titleNo: titleNo, genre: genre, slug: slug }
    }

    detailPath(t) {
        return "/" + WebtoonsZhHant.LANG + "/" + t.genre + "/" + t.slug + "/list?title_no=" + t.titleNo
    }

    viewerPath(t, epNo) {
        return "/" + WebtoonsZhHant.LANG + "/" + t.genre + "/" + t.slug + "/" + epNo +
            "/viewer?title_no=" + t.titleNo + "&episode_no=" + epNo
    }

    // 卡片 href -> 统一规范的漫画 ID（/zh-hant/{genre}/{slug}/list?title_no=N）
    comicIdFromHref(href, fallbackTitleNo) {
        let h = String(href == null ? "" : href).trim()
        h = h.replace(/^https?:\/\/[^\/]+/i, "")
        h = h.replace(/^\/zh-hant-hk\//, "/zh-hant/")
        const m = h.match(/title_no=(\d+)/i)
        const titleNo = m ? m[1] : (fallbackTitleNo || "")
        if (!titleNo) return ""
        const p = h.match(/\/(?:zh-hant|zh-hant-hk)\/([^\/?#]+)\/([^\/?#]+)\//)
        const genre = p ? p[1] : "x"
        const slug = p ? p[2] : "y"
        return "/" + WebtoonsZhHant.LANG + "/" + genre + "/" + slug + "/list?title_no=" + titleNo
    }

    // ---------------- 卡片解析（首页 / 题材 / 日程 / 排行 / 搜索页 共用一套字段名）----
    // 各页面卡片第二行实测字段（webtoons_evidence/v2 样本）：
    //   首页「即時熱門 / 今日漫畫 / 投稿新星」 .info_text > .genre（题材）
    //   首页「分類人氣排行榜」                 .info_text > .view_count（浏览数），无题材
    //   首页「最新上線」                       只有 img[alt]，没有任何 .info_text
    //   分类页（/genres/...）                  .info_text > .author（真实作者）
    //   搜索页（HTML 兜底）                     .info_text > .author
    // 因此副标题按「作者 → 页面题材 → 从 URL 段落还原题材 → 浏览数」依次兜底。
    cardSubTitle(node, href) {
        const pick = (sel) => {
            const el = node.querySelector(sel)
            if (!el) return ""
            return String(el.text || "").replace(/\s+/g, " ").trim()
        }
        const author = pick(".info_text .author") || pick(".info_area .author") || pick(".author")
        if (author) return author
        const genre = pick(".info_text .genre") || pick(".genre")
        if (genre) return genre
        const fromSlug = this.genreLabelFromPath(href)
        if (fromSlug) return fromSlug
        return pick(".info_text .view_count") || pick(".view_count")
    }

    // URL 段落里的题材 slug -> 繁体中文题材名（取自 /zh-hant/genres 导航实测表），
    // 用于「最新上線」这类卡片完全没有文字信息的区块；同时兼容 canvas/挑战赛等特殊段落。
    genreLabelFromPath(href) {
        const m = String(href == null ? "" : href).match(/\/(?:zh-hant|zh-hant-hk)\/([^\/?#]+)\//)
        if (!m) return ""
        // URL 段落用连字符（romance-m / bl-gl），题材表用下划线（romance_m / bl_gl），统一后再比
        const norm = (x) => String(x).toLowerCase().replace(/_/g, "-")
        const slug = norm(m[1])
        for (const g of WebtoonsZhHant.GENRES) { if (norm(g[1]) === slug) return g[0] }
        const extra = {
            canvas: "投稿新星",
            bestchallenge: "挑战赛",
            "best-challenge": "挑战赛",
            challenge: "投稿新星",
            originals: "正式連載",
            daily: "每日更新"
        }
        return extra[slug] || ""
    }

    parseCard(node) {
        if (!node) return null
        let a = node.querySelector("a.link") || node.querySelector("a")
        if (!a) {
            const attrs = node.attributes
            if (attrs && attrs.href) { a = node } else { return null }
        }
        const href = a.attributes.href || ""
        const titleNo = a.attributes["data-title-no"] || this.titleNoOf(href)
        if (!titleNo) return null
        const id = this.comicIdFromHref(href, titleNo)
        if (!id) return null
        const img = node.querySelector(".image_wrap img") || node.querySelector(".img_area img") || node.querySelector("img")
        let title = ""
        const titleEl = node.querySelector(".info_text .title") || node.querySelector(".info_area .subj") || node.querySelector(".title") || node.querySelector(".subj")
        if (titleEl) { title = titleEl.text.trim() }
        if (!title && img) { title = String(img.attributes.alt || "").trim() }
        return new Comic({
            id: id,
            title: title,
            cover: this.cdnUrl(img ? (img.attributes["data-src"] || img.attributes.src || "") : ""),
            subTitle: this.cardSubTitle(node, href)
        })
    }

    // 依次尝试多个选择器并按 ID 去重；缺标题的节点丢弃
    parseList(root, selectors) {
        const comics = []
        const seen = {}
        for (const sel of selectors) {
            for (const node of root.querySelectorAll(sel)) {
                const c = this.parseCard(node)
                if (!c || !c.id || !c.title) continue
                if (seen[c.id]) continue
                seen[c.id] = true
                comics.push(c)
            }
        }
        return comics
    }

    // ---------------- 章节目录（API 优先，HTML 兜底）----------------
    async episodesOf(titleNo) {
        const url = WebtoonsZhHant.MSITE + "/api/v1/webtoon/" + titleNo + "/episodes?pageSize=1000&startIndex=0"
        const json = await this.fetchJson(url)
        const list = (json && json.result && json.result.episodeList) ? json.result.episodeList : null
        return list
    }

    // 兜底：解析详情页 li._episodeItem（站点每页 10 话；越界页会被夹到最后一页，用首页话号去重终止）
    async chaptersFromHtml(t) {
        const chapters = new Map()
        const seen = {}
        let prevFirst = ""
        for (let page = 1; page <= 30; page++) {
            const path = this.detailPath(t) + (page > 1 ? "&page=" + page : "")
            let html = ""
            try { html = await this.fetchHtml(path) } catch (e) { break }
            const doc = new HtmlDocument(html)
            let count = 0
            let firstId = ""
            try {
                for (const li of doc.querySelectorAll("li._episodeItem")) {
                    count++
                    const a = li.querySelector("a") || li
                    const epNo = this.episodeNoOf(a.attributes.href || "")
                    if (!epNo || seen[epNo]) continue
                    seen[epNo] = true
                    const subj = li.querySelector(".subj")
                    chapters.set(epNo, subj ? subj.text.trim() : ("第" + epNo + "話"))
                    if (!firstId) firstId = epNo
                }
            } finally {
                doc.dispose()
            }
            if (count === 0) break
            if (page > 1 && firstId && firstId === prevFirst) break
            prevFirst = firstId
        }
        return chapters
    }

    // ---------------- 探索页 ----------------
    explore = [
        {
            title: "LINE WEBTOON",
            type: "singlePageWithMultiPart",
            load: async () => {
                const html = await this.fetchHtml("/")
                const doc = new HtmlDocument(html)
                try {
                    const result = {}
                    for (const section of doc.querySelectorAll(".main_section")) {
                        const head = section.querySelector("h2.section_title") || section.querySelector(".section_title")
                        const name = head ? head.text.trim() : ""
                        if (!name) continue
                        // 首页轮播把同一条推荐拆成多个 ul（每 ul 5~6 张），这里合并且去重
                        const comics = this.parseList(section, ["ul.webtoon_list > li"])
                        if (comics.length > 0 && !result[name]) { result[name] = comics }
                    }
                    if (Object.keys(result).length === 0) {
                        throw "首页解析结果为空：站点结构可能已改版。"
                    }
                    return result
                } finally {
                    doc.dispose()
                }
            }
        },
        {
            title: "每日更新",
            type: "singlePageWithMultiPart",
            load: async () => {
                const result = {}
                for (const item of WebtoonsZhHant.WEEKDAYS) {
                    const html = await this.fetchHtml("/originals/" + item[1])
                    const doc = new HtmlDocument(html)
                    try {
                        const comics = this.parseList(doc, ["a.link._originals_title_a", "ul.webtoon_list > li"])
                        if (comics.length > 0) { result[item[0]] = comics }
                    } finally {
                        doc.dispose()
                    }
                }
                return result
            }
        },
        {
            title: "人氣排行榜",
            type: "singlePageWithMultiPart",
            load: async () => {
                const result = {}
                for (const item of WebtoonsZhHant.RANK_TABS) {
                    const html = await this.fetchHtml("/ranking/" + item[1])
                    const doc = new HtmlDocument(html)
                    try {
                        const comics = this.parseList(doc, ["a.link._ranking_title_a", "ul.webtoon_list > li"])
                        if (comics.length > 0) { result[item[0]] = comics }
                    } finally {
                        doc.dispose()
                    }
                }
                return result
            }
        },
        {
            title: "投稿新星（CANVAS）",
            type: "singlePageWithMultiPart",
            load: async () => {
                const html = await this.fetchHtml("/canvas")
                const doc = new HtmlDocument(html)
                try {
                    const comics = this.parseList(doc, ["a.lk_discover_item", "a[href*=\"title_no=\"]"])
                    if (comics.length === 0) { throw "投稿新星页面解析结果为空：站点结构可能已改版。" }
                    return { "投稿新星專區": comics }
                } finally {
                    doc.dispose()
                }
            }
        }
    ]

    // ---------------- 分类页 ----------------
    category = {
        title: "LINE WEBTOON",
        parts: [
            {
                name: "題材",
                type: "fixed",
                categories: WebtoonsZhHant.GENRES.map(e => e[0]),
                categoryParams: WebtoonsZhHant.GENRES.map(e => "g:" + e[1]),
                itemType: "category"
            },
            {
                name: "連載日程",
                type: "fixed",
                categories: WebtoonsZhHant.WEEKDAYS.map(e => e[0]),
                categoryParams: WebtoonsZhHant.WEEKDAYS.map(e => "d:" + e[1]),
                itemType: "category"
            },
            {
                name: "排行榜",
                type: "fixed",
                categories: WebtoonsZhHant.RANK_TABS.map(e => e[0]),
                categoryParams: WebtoonsZhHant.RANK_TABS.map(e => "r:" + e[1]),
                itemType: "category"
            },
            {
                name: "排行榜（依題材）",
                type: "fixed",
                categories: WebtoonsZhHant.RANK_GENRES.map(e => e[0]),
                categoryParams: WebtoonsZhHant.RANK_GENRES.map(e => "rg:" + e[1]),
                itemType: "category"
            }
        ]
    }

    categoryComics = {
        // sortOrder 仅对「題材」有效（已实测 MANA / LIKEIT / UPDATE 三个真实参数），其余分类隐藏该选项
        optionList: [
            {
                options: ["MANA-人氣排序", "LIKEIT-愛心排序", "UPDATE-最近更新"],
                notShowWhen: [
                    "d:monday", "d:tuesday", "d:wednesday", "d:thursday", "d:friday", "d:saturday", "d:sunday",
                    "r:trending", "r:popular", "r:originals", "r:canvas",
                    "rg:ROMANCE", "rg:FANTASY", "rg:SCHOOL", "rg:ADAPTATION", "rg:WESTERN_PALACE",
                    "rg:LOCAL", "rg:MARTIAL_ARTS", "rg:BL_GL", "rg:ROMANCE_M", "rg:DRAMA"
                ]
            }
        ],
        load: async (category, param, options, page) => {
            const p = String(param == null ? "" : param)
            const sort = (options && options.length > 0 && options[0]) ? String(options[0]) : "MANA"
            // 题材页 / 日程页 / 排行页均为「单页全量」：已实测 +page=2 返回完全相同内容，且页面无分页控件
            if (p.indexOf("g:") === 0) {
                const html = await this.fetchHtml("/genres/" + p.substring(2) + "?sortOrder=" + encodeURIComponent(sort))
                const doc = new HtmlDocument(html)
                try {
                    return { comics: this.parseList(doc, ["a.link._genre_title_a", "ul.webtoon_list > li"]), maxPage: 1 }
                } finally {
                    doc.dispose()
                }
            }
            if (p.indexOf("d:") === 0) {
                const html = await this.fetchHtml("/originals/" + p.substring(2))
                const doc = new HtmlDocument(html)
                try {
                    return { comics: this.parseList(doc, ["a.link._originals_title_a", "ul.webtoon_list > li"]), maxPage: 1 }
                } finally {
                    doc.dispose()
                }
            }
            if (p.indexOf("r:") === 0) {
                const html = await this.fetchHtml("/ranking/" + p.substring(2))
                const doc = new HtmlDocument(html)
                try {
                    return { comics: this.parseList(doc, ["a.link._ranking_title_a", "ul.webtoon_list > li"]), maxPage: 1 }
                } finally {
                    doc.dispose()
                }
            }
            if (p.indexOf("rg:") === 0) {
                const html = await this.fetchHtml("/ranking/originals?subTabGenreCode=" + encodeURIComponent(p.substring(3)))
                const doc = new HtmlDocument(html)
                try {
                    return { comics: this.parseList(doc, ["a.link._ranking_title_a", "ul.webtoon_list > li"]), maxPage: 1 }
                } finally {
                    doc.dispose()
                }
            }
            // 未知参数：安全空结构，不猜测 URL
            return { comics: [], maxPage: 1 }
        }
    }

    // ---------------- 搜索 ----------------
    search = {
        optionList: [
            {
                type: "select",
                options: ["ALL-全部作品", "WEBTOON-連載作品", "CHALLENGE-投稿作品 CANVAS"],
                label: "搜尋範圍",
                // 不声明 default：客户端会把 default 值 jsonEncode 后再比对，
                // 声明 "ALL" 会导致首屏没有任何 chip 处于选中态；load 内部已把缺省视为 ALL。
                default: null
            }
        ],
        load: async (keyword, options, page) => {
            const kw = String(keyword == null ? "" : keyword).trim()
            if (!kw) return { comics: [], maxPage: 1 }
            const scope = (options && options.length > 0 && options[0]) ? String(options[0]) : "ALL"
            const p = (page && page > 0) ? page : 1
            const start = (p - 1) * WebtoonsZhHant.SEARCH_PAGE_SIZE
            try {
                return await this.searchByApi(kw, scope, start)
            } catch (e) {
                return await this.searchByHtml(kw, p)
            }
        }
    }

    comicFromSearchItem(it) {
        if (!it) return null
        const titleNo = it.titleNo ? String(it.titleNo) : ""
        if (!titleNo) return null
        const genre = it.representGenre ? String(it.representGenre).toLowerCase().replace(/_/g, "-") : "x"
        const slug = it.titleGroupName ? String(it.titleGroupName) : "y"
        const names = []
        for (const v of [it.writingAuthorName, it.pictureAuthorName]) {
            const s = v ? String(v).trim() : ""
            if (s && names.indexOf(s) < 0) names.push(s)
        }
        return new Comic({
            id: "/" + WebtoonsZhHant.LANG + "/" + genre + "/" + slug + "/list?title_no=" + titleNo,
            title: String(it.title == null ? "" : it.title),
            cover: this.cdnUrl(it.thumbnailMobile || it.thumbnail || ""),
            subTitle: names.join(" · ")
        })
    }

    async searchByApi(kw, scope, start) {
        const types = scope === "WEBTOON" ? ["WEBTOON"]
            : scope === "CHALLENGE" ? ["CHALLENGE"]
                : ["WEBTOON", "CHALLENGE"]
        const comics = []
        const seen = {}
        let maxPage = 1
        let reached = false
        for (const type of types) {
            const qs = "keyword=" + encodeURIComponent(kw) + "&searchType=" + type + "&start=" + start
            let json = null
            try { json = await this.fetchSearchJson(qs) } catch (e) { json = null }
            if (!json || !json.result) continue
            reached = true
            const node = json.result[type === "WEBTOON" ? "webtoonResult" : "challengeResult"]
            if (!node) continue
            const total = (typeof node.totalCount === "number") ? node.totalCount : 0
            const pages = Math.max(1, Math.ceil(total / WebtoonsZhHant.SEARCH_PAGE_SIZE))
            if (pages > maxPage) maxPage = pages
            for (const it of (node.titleList || [])) {
                const c = this.comicFromSearchItem(it)
                if (!c || !c.id || !c.title) continue
                if (seen[c.id]) continue
                seen[c.id] = true
                comics.push(c)
            }
        }
        if (!reached) throw "search api unavailable"
        return { comics: comics, maxPage: maxPage }
    }

    // 兜底：站内搜索页（无分页控件，只能以「本页有结果」作为可续页依据，已在开发日志标注为兜底限制）
    async searchByHtml(kw, page) {
        const path = "/search?keyword=" + encodeURIComponent(kw) + (page > 1 ? "&page=" + page : "")
        const html = await this.fetchHtml(path)
        const doc = new HtmlDocument(html)
        try {
            const comics = this.parseList(doc, ["a.link._card_item", "ul.webtoon_list > li"])
            return { comics: comics, maxPage: comics.length > 0 ? page + 1 : page }
        } finally {
            doc.dispose()
        }
    }

    // ---------------- 详情 / 章节 ----------------
    comic = {
        // 接受本源规范 ID、完整 URL、纯 title_no、组合 ID（5145|slug）
        idMatch: "(?:https?://www\\.webtoons\\.com)?/?(?:zh-hant|zh-hant-hk)/.*title_no=\\d+|^\\d{2,9}",

        loadInfo: async (id) => {
            const t = this.parseComicId(id)
            if (!t) throw "无法解析漫画 ID：请从探索、搜索或分类页重新打开这部作品。"
            const html = await this.fetchHtml(this.detailPath(t))
            const doc = new HtmlDocument(html)
            let title = ""
            let cover = ""
            let description = ""
            let author = ""
            let genre = ""
            let dayInfo = ""
            try {
                const h1 = doc.querySelector("h1.subj")
                if (h1) title = h1.text.trim()
                const og = doc.querySelector("meta[property=\"og:image\"]")
                if (og) cover = this.cdnUrl(og.attributes.content || "")
                const summary = doc.querySelector(".summary")
                if (summary) description = summary.text.trim()
                const genreEl = doc.querySelector(".detail_header .genre") || doc.querySelector(".genre")
                if (genreEl) genre = genreEl.text.trim()
                // 真实作者在 .author_area 内（后面跟着「作家資訊」按钮，需剔除；页面上的 .author 属于推荐位，不能直接用）
                const authorEl = doc.querySelector(".detail_header .author_area")
                if (authorEl) author = authorEl.text.replace(/\s+/g, " ").replace(/作家資訊/g, "").trim()
                const dayEl = doc.querySelector("p.day_info")
                if (dayEl) dayInfo = dayEl.text.replace(/更新在|更新/g, "").replace(/\s+/g, " ").trim()
            } finally {
                doc.dispose()
            }

            const tags = {}
            if (genre) tags["題材"] = [genre]
            if (dayInfo) tags["更新"] = [dayInfo]

            let chapters = new Map()
            let eps = null
            try { eps = await this.episodesOf(t.titleNo) } catch (e) { eps = null }
            if (eps && eps.length > 0) {
                // 与站点一致：最新章节排在最前面
                const sorted = eps.slice().sort((a, b) => (b.episodeNo || 0) - (a.episodeNo || 0))
                for (const e of sorted) {
                    const no = String(e.episodeNo == null ? "" : e.episodeNo)
                    if (!no) continue
                    chapters.set(no, String(e.episodeTitle || ("第" + no + "話")))
                }
            } else {
                chapters = await this.chaptersFromHtml(t)
            }

            return new ComicDetails({
                title: title,
                subtitle: author,
                subTitle: author,
                cover: cover,
                description: description,
                tags: tags,
                chapters: chapters,
                isFavorite: null,
                uploader: author,
                url: WebtoonsZhHant.SITE + this.detailPath(t)
            })
        },

        loadEp: async (comicId, epId) => {
            const t = this.parseComicId(comicId)
            if (!t) return { images: [] }
            const epNo = this.episodeNoOf(epId)
            if (!epNo) return { images: [] }
            const html = await this.fetchHtml(this.viewerPath(t, epNo))
            const doc = new HtmlDocument(html)
            try {
                const images = []
                const seen = {}
                const keepBanner = this.showBanner()
                for (const img of doc.querySelectorAll("#_imageList img")) {
                    let u = img.attributes["data-url"] || img.attributes.src || ""
                    u = this.cdnUrl(u)
                    if (!u) continue
                    // 站点皮肤/占位图（bg_transparency 等）不是正文
                    if (u.indexOf("webtoons-static.pstatic.net") === 0) continue
                    if (u.indexOf("bg_transparency") >= 0) continue
                    // 每一话固定第一张的官方版权提示图，默认过滤（可在源设置里打开）
                    if (!keepBanner && u.indexOf("tw_warning") >= 0) continue
                    if (seen[u]) continue
                    seen[u] = true
                    images.push(u)
                }
                return { images: images }
            } finally {
                doc.dispose()
            }
        },

        // CDN 反盗链：webtoon-phinf.pstatic.net 缺 Referer 直接 403（已实测），必须补上
        onImageLoad: (url, comicId, epId) => {
            const u = String(url == null ? "" : url)
            if (u.indexOf("webtoon-phinf.pstatic.net") >= 0) {
                return { headers: { "Referer": WebtoonsZhHant.SITE + "/" } }
            }
            return {}
        },

        onThumbnailLoad: (url) => {
            const u = String(url == null ? "" : url)
            if (u.indexOf("webtoon-phinf.pstatic.net") >= 0) {
                return { headers: { "Referer": WebtoonsZhHant.SITE + "/" } }
            }
            return {}
        },

        link: {
            domains: ["www.webtoons.com", "m.webtoons.com", "webtoons.com"],
            linkToId: (url) => {
                const t = this.parseComicId(url)
                return t ? this.detailPath(t) : null
            }
        }
    }

    // ---------------- 设置 ----------------
    settings = {
        show_copyright_banner: {
            title: "顯示官方版權提示圖（每話第一張）",
            type: "switch",
            default: false
        }
    }

    showBanner() {
        try { return this.loadSetting("show_copyright_banner") === true } catch (e) { return false }
    }
}
