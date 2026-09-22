// 嬉皮漫畫 (m.hipmh.com) Venera 漫画源
// 版本: 1.0.1
// 证据基准: 2026-09-22 真网取证（详见 hipmh_development_log.md）
//   首页 https://m.hipmh.com/ -> 200，SSR 6 个推荐区块（近期更新 10 / 本週熱門 6 / 人氣排名 6 / 高分韓漫 6 / 最新上架 6 / 完結推薦 12）
//   搜索 GET https://hipapi1.s3file.top/v1/search?q={kw}&page=N&page_size=20 -> 200，total_pages 真实可翻页；q 为空 -> 400（源内先判空）
//   列表 GET /v1/mangas?genre={id}|category={id}|tag={id}|status=xx&sort=updated|popular|latest&page=N&per_page=M -> 200
//   章节 GET /v1/manga/chapters?mid={短mid}&page=N&per_page=50&order=asc -> 200（per_page 上限 50）
//   图片 GET /v2/chapter?hid={data-api-hid} -> 200，data.images 为编码串，需解码 + 剔除 1 张噪声占位图
// 站点可大陆直连，无需镜像/代理回退。
// v1.0.1 修复: 成人作品封面。站点对 data-adult="1" 的卡片用占位图 /assets/img_thumbnail_19.svg,
//   真封面放在 img[data-real-cover], 仅在站内 localStorage 开关 ts_manga_is_adult=1 时才替换。
//   旧版取 img.src -> 拼成 cover.s3imgs.top/assets/... -> 404, 故成人作品封面加载不出来。
//   现直接取 data-real-cover, 不依赖站点开关, 并显式排除占位图。
class Hipmh extends ComicSource {
    name = "嬉皮漫畫"
    key = "hipmh"
    version = "1.0.1"
    minAppVersion = "1.6.0"
    url = ""

    static mainHost = "https://m.hipmh.com"
    static apiHost = "https://hipapi1.s3file.top"
    static coverHost = "https://cover.s3imgs.top"
    // 阅读页 data-chapter-img-base-line1 / line2 / line1s；line===9 时前端切到 -s1 线路
    static imgHostLine1 = "https://hip-tx-1.s3imgs.top"
    static imgHostLine2 = "https://hip-cf-1.s3imgs.top"
    static imgHostLine1s = "https://hip-tx-s1.s3imgs.top"
    static imgHostLine2s = "https://hip-cf-s1.s3imgs.top"
    static userAgent = "Mozilla/5.0 (Linux; Android 13; SM-S9080) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36"
    static pageSize = 30
    static chapterPageSize = 50
    static chapterPageLimit = 40

    // 分区: /category/{cn,jp,ko} 页面 data-category-id（已取证）
    static zoneMap = [["國漫", 2], ["日漫", 3], ["韓漫", 1]]
    // 状态: API status 参数（已取证 total: ongoing 945 / completed 316）
    static statusMap = [["連載中", "ongoing"], ["已完結", "completed"]]
    // 标签: /tag/{slug} 页面 data-tag-id（已取证）
    static tagMap = [["高分國漫", 45], ["高分韓漫", 69], ["人氣榜新上榜", 108]]
    // 题材: /genre/{slug} 页面 data-genre-id ∩ API total>0（真网逐个校验，157 个题材中 143 个有内容）
    static genreMap = [
["悬疑", 2], ["剧情", 3], ["搞笑", 4], ["日常", 5], ["恋爱", 6], ["治愈", 7], ["奇幻", 8], ["亲情", 9], ["青春", 11], 
["唯美", 12], ["异形", 15], ["惊悚", 16], ["灵异", 17], ["古风", 19], ["穿越", 20], ["魔幻", 21], ["都市", 23], 
["职场", 24], ["美食", 25], ["玄幻", 27], ["大女主", 30], ["复仇", 31], ["逆袭", 32], ["热血", 33], ["科幻", 34], 
["偶像", 36], ["冒险", 38], ["武侠", 39], ["动作", 40], ["总裁", 41], ["宫斗", 44], ["重生", 46], ["异能", 51], 
["宅斗", 52], ["竞技", 55], ["宅向", 62], ["战斗", 63], ["系统", 67], ["少年", 75], ["少女", 76], ["韩漫", 90], 
["劇情", 115], ["Romance", 118], ["奇幻冒險", 127], ["Fantasy", 129], ["校园", 132], ["School Life", 141], 
["Comedy", 143], ["動作", 150], ["Action", 151], ["KK独家", 195], ["强强", 196], ["怪物", 197], ["末日", 198], 
["女神", 199], ["暗黑", 201], ["权谋", 202], ["娱乐圈", 205], ["修仙", 208], ["妖怪", 209], ["神仙", 210], ["励志", 218], 
["无敌流", 219], ["机甲", 222], ["迪化", 226], ["种田", 232], ["快穿", 233], ["愛情", 253], ["古代宮廷", 254], 
["療癒/萌系", 255], ["懸疑推理", 256], ["校園", 257], ["影視化", 258], ["生活/日常", 259], ["現代/職場", 260], ["台灣原創作品", 261], 
["LGBTQ+", 268], ["穿越/轉生", 272], ["歐式宮廷", 284], ["大人系", 288], ["神话", 435], ["杀伐果断", 436], ["疯批", 437], 
["升级", 438], ["杀戮", 439], ["呆萌", 440], ["阳光", 441], ["活泼", 442], ["非人", 443], ["鬼怪", 444], ["武侠仙侠", 445], 
["东方", 446], ["法宝", 447], ["美女", 448], ["爽", 449], ["装逼", 450], ["游戏竞技", 451], ["嚣张", 452], ["网游", 453], 
["魔物", 454], ["无敌", 455], ["勇敢", 456], ["西方", 457], ["魔法", 458], ["骷髅", 459], ["正义之光", 460], ["英雄", 461], 
["强者归来", 462], ["求生", 463], ["勇者", 464], ["逗比", 465], ["清冷", 466], ["Murim", 467], ["Shounen", 468], 
["Adventure", 469], ["System", 470], ["悬疑脑洞", 471], ["Game", 472], ["Magic", 473], ["罗盘", 474], 
["修罗场", 475], ["召唤", 476], ["轻松", 477], ["现代", 496], ["毒舌", 497], ["单女主", 498], ["救赎", 499], 
["女扮男装", 500], ["占有欲", 501], ["偏执", 502], ["西幻", 503], ["智商在线", 505], ["智斗", 506], ["上班族", 507], 
["金发", 508], ["长条", 509], ["动作冒险", 510], ["刀剑", 511], ["尼特族", 512], ["宅男", 513], ["腹黑", 514], ["魔王", 515], 
["直播", 516],
    ]

    htmlHeaders() {
        return {
            "User-Agent": Hipmh.userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,zh-TW;q=0.8",
            "Referer": Hipmh.mainHost + "/",
        }
    }

    apiHeaders() {
        return {
            "User-Agent": Hipmh.userAgent,
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9",
            "Origin": Hipmh.mainHost,
            "Referer": Hipmh.mainHost + "/",
        }
    }

    // ---------- 通用工具 ----------

    trim(v) { return String(v == null ? "" : v).trim() }

    coverUrl(u) {
        const s = this.trim(u)
        if (!s) return ""
        if (s.indexOf("//") === 0) return "https:" + s
        if (s.indexOf("http://") === 0 || s.indexOf("https://") === 0) return s
        return Hipmh.coverHost + (s.charAt(0) === "/" ? s : "/" + s)
    }

    absoluteImage(u, base) {
        const s = this.trim(u)
        if (!s) return ""
        if (s.indexOf("//") === 0) return "https:" + s
        if (s.indexOf("http://") === 0 || s.indexOf("https://") === 0) return s
        if (!base) return s
        return base + (s.charAt(0) === "/" ? s : "/" + s)
    }

    worksIdFromHref(href) {
        const s = this.trim(href)
        if (!s) return ""
        const m = /\/works\/([^\/?#]+)/.exec(s)
        if (m) return m[1]
        if (/^[A-Za-z0-9_\-]+$/.test(s)) return s
        return ""
    }

    comicFromApi(item) {
        if (!item) return null
        const id = this.trim(item.id || item.mid)
        const title = this.trim(item.title)
        if (!id || !title) return null
        const authors = []
        const names = item.author_names || []
        for (const n of names) { const s = this.trim(n); if (s) authors.push(s) }
        if (authors.length === 0 && Array.isArray(item.authors)) {
            for (const a of item.authors) {
                const s = this.trim(a && a.name)
                if (s && authors.indexOf(s) < 0) authors.push(s)
            }
        }
        return new Comic({
            id: id,
            title: title,
            cover: this.coverUrl(item.vertical_image_url || item.cover_image_url),
            subTitle: authors.join(" / ")
        })
    }

    decodeEntities(s) {
        return String(s == null ? "" : s)
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, "\"")
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, " ")
    }

    // 站内静态资源/占位图识别。成人作品的卡片封面是 /assets/img_thumbnail_19.svg，
    // 真封面在 data-real-cover 上；占位图绝不能当封面用（拼到封面 CDN 会 404）。
    isPlaceholderImage(u) {
        const s = this.trim(u).toLowerCase()
        if (!s) return true
        if (s.indexOf("img_thumbnail") >= 0) return true
        if (s.indexOf("/assets/") >= 0 && s.indexOf(".svg") > 0) return true
        if (s.indexOf("data:image/") === 0) return true
        return false
    }

    // 卡片封面取值优先级：data-real-cover（成人解锁后的真封面）> data-src > src > data-original
    coverFromImg(img) {
        if (!img || !img.attributes) return ""
        const real = this.trim(img.attributes["data-real-cover"])
        if (real && !this.isPlaceholderImage(real)) return this.coverUrl(real)
        const candidates = [img.attributes["data-src"], img.attributes.src, img.attributes["data-original"]]
        for (const c of candidates) {
            const s = this.trim(c)
            if (!s || this.isPlaceholderImage(s)) continue
            return this.coverUrl(s)
        }
        return ""
    }

    // ---------- 首页 / 探索 ----------

    explore = [
        {
            title: "嬉皮漫畫",
            type: "singlePageWithMultiPart",
            load: async () => {
                const res = await Network.get(Hipmh.mainHost + "/", this.htmlHeaders())
                if (res.status !== 200) throw `Invalid status code: ${res.status}`
                const result = this.parseHomeSections(res.body)
                if (Object.keys(result).length === 0) throw "首页解析为空，站点结构可能已变更"
                return result
            }
        }
    ]

    // 首页是 Astro SSR，卡片直接渲染在 HTML 中；按 h2 标题切段，每段取 a[href=/works/...]
    parseHomeSections(html) {
        const result = {}
        const src = String(html || "")
        const re = /<h2[^>]*>([^<]{1,40})<\/h2>/g
        const marks = []
        let m
        while ((m = re.exec(src))) marks.push({ title: this.decodeEntities(m[1]).trim(), index: m.index })
        for (let i = 0; i < marks.length; i++) {
            const start = marks[i].index
            const end = (i + 1 < marks.length) ? marks[i + 1].index : src.length
            if (end <= start) continue
            const doc = new HtmlDocument(src.substring(start, end))
            try {
                const comics = []
                const seen = {}
                for (const a of Array.from(doc.querySelectorAll("a"))) {
                    const href = (a.attributes && a.attributes.href) || ""
                    const id = this.worksIdFromHref(href)
                    if (!id || seen[id]) continue
                    const img = a.querySelector("img")
                    let title = this.trim(a.attributes && a.attributes["aria-label"])
                    if (!title) {
                        const h3 = a.querySelector("h3")
                        if (h3) title = h3.text.trim()
                    }
                    if (!title) {
                        const alt = this.trim(img && img.attributes ? img.attributes.alt : "")
                        if (alt && alt.toLowerCase() !== "cover image") title = alt
                    }
                    if (!title) title = a.text.trim()
                    if (!title) continue
                    seen[id] = true
                    comics.push(new Comic({
                        id: id,
                        title: title,
                        cover: this.coverFromImg(img)
                    }))
                }
                if (comics.length > 0 && marks[i].title) result[marks[i].title] = comics
            } finally {
                doc.dispose()
            }
        }
        return result
    }

    // ---------- 分类 ----------

    category = {
        title: "嬉皮漫畫",
        parts: [
            {
                name: "分區",
                type: "fixed",
                itemType: "category",
                categories: Hipmh.zoneMap.map(e => e[0]),
                categoryParams: Hipmh.zoneMap.map(e => "category:" + e[1])
            },
            {
                name: "狀態",
                type: "fixed",
                itemType: "category",
                categories: Hipmh.statusMap.map(e => e[0]),
                categoryParams: Hipmh.statusMap.map(e => "status:" + e[1])
            },
            {
                name: "標籤",
                type: "fixed",
                itemType: "category",
                categories: Hipmh.tagMap.map(e => e[0]),
                categoryParams: Hipmh.tagMap.map(e => "tag:" + e[1])
            },
            {
                name: "題材",
                type: "fixed",
                itemType: "category",
                categories: Hipmh.genreMap.map(e => e[0]),
                categoryParams: Hipmh.genreMap.map(e => "genre:" + e[1])
            }
        ]
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            const p = Number(page) > 0 ? Number(page) : 1
            const sel = this.resolveCategoryParam(param, category)
            if (!sel) return { comics: [], maxPage: p }
            const url = `${Hipmh.apiHost}/v1/mangas?${sel}&sort=updated&page=${p}&per_page=${Hipmh.pageSize}`
            const res = await Network.get(url, this.apiHeaders())
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            return this.parseListBody(res.body, p)
        }
    }

    // 参数前缀 category:/status:/tag:/genre:；只有数字时按「题材」兜底（兼容历史配置）
    resolveCategoryParam(param, category) {
        const s = this.trim(param)
        if (!s) {
            const name = this.trim(category)
            for (const e of Hipmh.zoneMap) if (e[0] === name) return "category=" + e[1]
            for (const e of Hipmh.statusMap) if (e[0] === name) return "status=" + e[1]
            for (const e of Hipmh.tagMap) if (e[0] === name) return "tag=" + e[1]
            for (const e of Hipmh.genreMap) if (e[0] === name) return "genre=" + e[1]
            return ""
        }
        const idx = s.indexOf(":")
        if (idx > 0) {
            const kind = s.substring(0, idx)
            const value = s.substring(idx + 1)
            if (kind === "category" || kind === "genre" || kind === "tag") {
                return /^\d+$/.test(value) ? (kind + "=" + value) : ""
            }
            if (kind === "status") {
                return (value === "ongoing" || value === "completed") ? ("status=" + value) : ""
            }
            return ""
        }
        if (/^\d+$/.test(s)) return "genre=" + s
        if (s === "ongoing" || s === "completed") return "status=" + s
        return ""
    }

    // ---------- 搜索 ----------

    search = {
        load: async (keyword, options, page) => {
            const p = Number(page) > 0 ? Number(page) : 1
            const kw = this.trim(keyword)
            // 已实测 q 为空 -> HTTP 400，必须在源内提前返回
            if (!kw) return { comics: [], maxPage: p }
            const url = `${Hipmh.apiHost}/v1/search?q=${encodeURIComponent(kw)}&page=${p}&page_size=20`
            const res = await Network.get(url, this.apiHeaders())
            if (res.status === 400) return { comics: [], maxPage: p }
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            return this.parseSearchBody(res.body, p)
        }
    }

    // /v1/mangas -> data.items[] / data.total_pages
    parseListBody(body, page) {
        let j = null
        try { j = JSON.parse(body) } catch (e) { return { comics: [], maxPage: page } }
        const d = (j && j.data) || {}
        const comics = []
        const items = Array.isArray(d.items) ? d.items : []
        for (const it of items) { const c = this.comicFromApi(it); if (c) comics.push(c) }
        return { comics: comics, maxPage: this.maxPageOf(d, page) }
    }

    // /v1/search -> data.data[] / data.total_pages
    parseSearchBody(body, page) {
        let j = null
        try { j = JSON.parse(body) } catch (e) { return { comics: [], maxPage: page } }
        const d = (j && j.data) || {}
        const comics = []
        const items = Array.isArray(d.data) ? d.data : (Array.isArray(d.items) ? d.items : [])
        for (const it of items) { const c = this.comicFromApi(it); if (c) comics.push(c) }
        return { comics: comics, maxPage: this.maxPageOf(d, page) }
    }

    maxPageOf(d, page) {
        const n = Number(d && d.total_pages)
        if (!isFinite(n) || n < 1) return page
        return Math.floor(n)
    }

    // ---------- 详情 / 章节 ----------

    comic = {
        loadInfo: async (id) => {
            const worksId = this.worksIdFromHref(id)
            if (!worksId) throw "无法解析漫画 ID，请从探索、搜索或分类页重新打开这部作品"
            const res = await Network.get(Hipmh.mainHost + "/works/" + worksId, this.htmlHeaders())
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            let title = ""
            let cover = ""
            let description = ""
            let mid = ""
            const authors = []
            const genres = []
            const statusTags = []
            const doc = new HtmlDocument(res.body)
            try {
                // #chapters-config 携带短 mid / mangaId / 标题 / 绝对封面（已取证）
                const cfg = doc.querySelector("#chapters-config")
                if (cfg) {
                    mid = this.trim(cfg.attributes["data-mid"])
                    const t = this.trim(cfg.attributes["data-title"])
                    if (t) title = t
                    cover = this.coverUrl(cfg.attributes["data-cover"])
                }
                const h1 = doc.querySelector("h1")
                if (h1) { const t = h1.text.trim(); if (t) title = t }
                const meta = doc.querySelector("meta[name=\"description\"]")
                if (meta) description = this.trim(meta.attributes.content)
                if (!cover) {
                    const og = doc.querySelector("meta[property=\"og:image\"]")
                    if (og) cover = this.coverUrl(og.attributes.content)
                }
                for (const a of Array.from(doc.querySelectorAll("a"))) {
                    const href = this.trim(a.attributes && a.attributes.href)
                    const label = this.trim((a.attributes && a.attributes.title) || a.text)
                    if (!label || !href) continue
                    if (href.indexOf("/author/") === 0) {
                        if (authors.indexOf(label) < 0) authors.push(label)
                    } else if (href.indexOf("/genre/") === 0) {
                        if (genres.indexOf(label) < 0) genres.push(label)
                    } else if (href === "/ongoing" || href === "/completed") {
                        if (statusTags.indexOf(label) < 0) statusTags.push(label)
                    }
                }
            } finally {
                doc.dispose()
            }

            const tags = {}
            if (authors.length > 0) tags["作者"] = authors
            if (genres.length > 0) tags["題材"] = genres
            if (statusTags.length > 0) tags["狀態"] = statusTags

            let chapters = new Map()
            if (mid) {
                try { chapters = await this.fetchChapters(mid) } catch (e) { chapters = new Map() }
            }

            return new ComicDetails({
                title: title || worksId,
                cover: cover,
                description: description,
                tags: tags,
                chapters: chapters,
                subId: worksId
            })
        },

        // 章节 Map 的 key 用站点前端 hid：稳定、可逆推出 API hid，历史记录不会失效
        loadEp: async (comicId, epId) => {
            const apiHid = this.toApiHid(epId)
            if (!apiHid) return { images: [] }
            const url = `${Hipmh.apiHost}/v2/chapter?hid=${encodeURIComponent(apiHid)}`
            const res = await Network.get(url, this.apiHeaders())
            if (res.status === 404 || res.status === 410) return { images: [] }
            if (res.status !== 200) throw `Invalid status code: ${res.status}`
            let j = null
            try { j = JSON.parse(res.body) } catch (e) { return { images: [] } }
            const data = (j && j.data) || null
            if (!data || data.images == null) return { images: [] }

            let list = null
            try {
                list = (typeof data.images === "string") ? this.decodeChapterImages(data.images) : data.images
            } catch (e) {
                throw "本章图片载荷解码失败：" + (e && e.message ? e.message : e)
            }
            if (!Array.isArray(list)) return { images: [] }
            list = list.filter(x => typeof x === "string" && x.length > 0)
            // 站点每话会混入 1 张 67 字节的噪声占位图，按官方算法定位后剔除
            const noise = this.noiseIndex(data.order_id, data.sid, list.length)
            if (noise >= 0) {
                const copy = list.slice()
                copy.splice(noise, 1)
                list = copy
            }
            const base = this.imageHostFor(data.line)
            const images = []
            const seen = {}
            for (const p of list) {
                const u = this.absoluteImage(p, base)
                if (!u || seen[u]) continue
                seen[u] = true
                images.push(u)
            }
            return { images: images }
        },

        // 图片 CDN（hip-*.s3imgs.top）实测无防盗链：不带 Referer 也返回 200 image/webp
        onImageLoad: (url, comicId, epId) => {
            return { headers: { "User-Agent": Hipmh.userAgent } }
        },

        onThumbnailLoad: (url) => {
            return { headers: { "User-Agent": Hipmh.userAgent } }
        }
    }

    // 章节列表：API 只接受短 mid（详情页 data-mid）；per_page 上限 50，长漫需分页并发抓取
    async fetchChapters(mid) {
        const map = new Map()
        const base = `${Hipmh.apiHost}/v1/manga/chapters?mid=${encodeURIComponent(mid)}&per_page=${Hipmh.chapterPageSize}&order=asc&page=`
        const first = await Network.get(base + "1", this.apiHeaders())
        if (first.status !== 200) return map
        let j = null
        try { j = JSON.parse(first.body) } catch (e) { return map }
        const d = (j && j.data) || {}
        this.appendChapters(map, d.items)
        let pages = Number(d.total_pages)
        if (!isFinite(pages) || pages < 1) pages = 1
        pages = Math.floor(pages)
        if (pages > Hipmh.chapterPageLimit) pages = Hipmh.chapterPageLimit
        let page = 2
        while (page <= pages) {
            const batch = []
            for (let k = 0; k < 3 && page <= pages; k++) { batch.push(page); page++ }
            const results = await Promise.all(batch.map(p =>
                Network.get(base + p, this.apiHeaders()).then(r => r).catch(() => null)
            ))
            for (const r of results) {
                if (!r || r.status !== 200) continue
                try {
                    const jj = JSON.parse(r.body)
                    this.appendChapters(map, jj && jj.data ? jj.data.items : null)
                } catch (e) { }
            }
        }
        return map
    }

    appendChapters(map, items) {
        if (!Array.isArray(items)) return
        for (const it of items) {
            if (!it) continue
            const hid = this.trim(it.hid)
            if (!hid) continue
            const num = it.chapter_number
            let t = this.trim(it.title)
            if (num !== undefined && num !== null && num !== "") {
                if (!t) t = "第" + num + "話"
                else if (t.indexOf(String(num)) !== 0) t = "第" + num + "話 " + t
            }
            if (!t) t = "章節"
            map.set(hid, t)
        }
    }

    // ---------- 章节 hid 推导（已用两话真实样本对齐阅读页 data-api-hid） ----------

    // 前端 hid: b64u("m:{mangaId}-c:{chapterId}") + "-" + b64u("{mangaId}:{num}.00")
    // 图片 API: b64u("c:{chapterId}")              + "-" + b64u("{mangaId}:{num}.00")
    // 两段都是无填充 base64url，'-' 既是分隔符也是编码字符，必须逐位置试切并校验明文形态。
    toApiHid(epId) {
        let s = this.trim(epId)
        if (!s) return ""
        const hit = /\/chapter\/([^\/?#]+)/.exec(s)
        if (hit) s = hit[1]
        if (!/^[A-Za-z0-9_\-]+$/.test(s)) return ""
        let apiOnly = ""
        for (let k = 1; k < s.length - 1; k++) {
            const head = this.b64urlDecode(s.substring(0, k))
            if (!head) continue
            const tail = this.b64urlDecode(s.substring(k + 1))
            if (!tail || !/^\d+:\d+(\.\d+)?$/.test(tail)) continue
            const m = /^m:(\d+)-c:(\d+)$/.exec(head)
            if (m) return this.b64urlEncode("c:" + m[2]) + "-" + s.substring(k + 1)
            if (/^c:\d+$/.test(head)) apiOnly = s
        }
        return apiOnly
    }

    // ---------- 图片载荷解码（真网逆出，纯 JS 复现；禁用 eval / new Function） ----------

    static alphaOrig = "_-9876543210abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
    static alphaStd = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_"
    static b64Std = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
    // (40503 << 16 | 31153) >>> 0 / (34283 << 16 | 51819) >>> 0
    static noiseK1 = 2654435761
    static noiseK2 = 2246822507

    decodeChapterImages(payload) {
        const text = this.b64ToUtf8(this.unmapAlphabet(this.unreverseBlocks(this.unshufflePayload(payload))))
        const parsed = JSON.parse(text)
        if (!Array.isArray(parsed)) throw new Error("载荷不是数组")
        return parsed
    }

    // 步骤 1：去掉 3 字符前缀 "qM9"、2 字符后缀 "Z7"；a=floor(N/3), b=floor((N-a)/2), c=N-a-b
    unshufflePayload(payload) {
        const PREFIX = "qM9"
        const SEP = "Vx"
        const SUF2 = "pL0"
        const SUFFIX = "Z7"
        if (typeof payload !== "string") throw new Error("载荷类型错误")
        if (payload.substring(0, 3) !== PREFIX || payload.substring(payload.length - 2) !== SUFFIX) throw new Error("载荷头尾不匹配")
        const body = payload.substring(PREFIX.length, payload.length - SUFFIX.length)
        const n = body.length - SEP.length - SUF2.length
        if (n <= 0) throw new Error("载荷过短")
        const a = Math.floor(n / 3)
        const b = Math.floor((n - a) / 2)
        const c = n - a - b
        const p1 = body.substring(0, b)
        const sep = body.substring(b, b + 2)
        const p2 = body.substring(b + 2, b + 2 + c)
        const suf2 = body.substring(b + 2 + c, b + 2 + c + 3)
        const p4 = body.substring(b + 2 + c + 3)
        if (sep !== SEP || suf2 !== SUF2 || p4.length !== a) throw new Error("载荷分段校验失败")
        return p4 + p1 + p2
    }

    // 步骤 2：以 7 字符为块，除首块外逐块反转
    unreverseBlocks(s) {
        const BLK = 7
        let out = ""
        for (let i = 0, k = 0; i < s.length; i += BLK, k++) {
            const chunk = s.substring(i, i + BLK)
            out += (k % 2) ? chunk.split("").reverse().join("") : chunk
        }
        return out
    }

    // 步骤 3：混淆字母表 -> 标准 base64url 字母表
    unmapAlphabet(s) {
        let out = ""
        for (let i = 0; i < s.length; i++) {
            const idx = Hipmh.alphaOrig.indexOf(s.charAt(i))
            if (idx < 0) throw new Error("载荷含未知字符")
            out += Hipmh.alphaStd.charAt(idx)
        }
        return out
    }

    // 步骤 4：base64url -> UTF-8 文本（手写实现，不依赖 TextDecoder / atob）
    b64ToUtf8(s) {
        const bytes = this.base64ToBytes(s)
        if (!bytes) throw new Error("base64 解码失败")
        let out = ""
        let i = 0
        while (i < bytes.length) {
            const b1 = bytes[i]
            if (b1 < 0x80) { out += String.fromCharCode(b1); i += 1 }
            else if (b1 >= 0xc0 && b1 < 0xe0) {
                out += String.fromCharCode(((b1 & 0x1f) << 6) | (bytes[i + 1] & 0x3f)); i += 2
            } else if (b1 >= 0xe0 && b1 < 0xf0) {
                out += String.fromCharCode(((b1 & 0x0f) << 12) | ((bytes[i + 1] & 0x3f) << 6) | (bytes[i + 2] & 0x3f)); i += 3
            } else {
                const cp = ((b1 & 0x07) << 18) | ((bytes[i + 1] & 0x3f) << 12) | ((bytes[i + 2] & 0x3f) << 6) | (bytes[i + 3] & 0x3f)
                const v = cp - 0x10000
                out += String.fromCharCode(0xd800 + (v >> 10)) + String.fromCharCode(0xdc00 + (v & 0x3ff))
                i += 4
            }
        }
        return out
    }

    base64ToBytes(str) {
        const s = String(str == null ? "" : str).replace(/-/g, "+").replace(/_/g, "/")
        const out = []
        for (let i = 0; i < s.length; i += 4) {
            // 注意: 越界时 charAt 返回空串, indexOf("") 是 0 而不是 -1, 必须显式判长度
            const c1 = Hipmh.b64Std.indexOf(s.charAt(i))
            const c2 = (i + 1 < s.length) ? Hipmh.b64Std.indexOf(s.charAt(i + 1)) : -1
            if (c1 < 0 || c2 < 0) return null
            const c3 = (i + 2 < s.length) ? Hipmh.b64Std.indexOf(s.charAt(i + 2)) : -1
            const c4 = (i + 3 < s.length) ? Hipmh.b64Std.indexOf(s.charAt(i + 3)) : -1
            out.push(((c1 << 2) | (c2 >> 4)) & 0xff)
            if (c3 >= 0) out.push((((c2 & 15) << 4) | (c3 >> 2)) & 0xff)
            if (c4 >= 0) out.push((((c3 & 3) << 6) | c4) & 0xff)
        }
        return out
    }

    b64urlEncode(str) {
        const s = String(str == null ? "" : str)
        let out = ""
        for (let i = 0; i < s.length; i += 3) {
            const b1 = s.charCodeAt(i) & 0xff
            const has2 = i + 1 < s.length
            const has3 = i + 2 < s.length
            const b2 = has2 ? (s.charCodeAt(i + 1) & 0xff) : 0
            const b3 = has3 ? (s.charCodeAt(i + 2) & 0xff) : 0
            out += Hipmh.b64Std.charAt(b1 >> 2)
            out += Hipmh.b64Std.charAt(((b1 & 3) << 4) | (b2 >> 4))
            if (has2) out += Hipmh.b64Std.charAt(((b2 & 15) << 2) | (b3 >> 6))
            if (has3) out += Hipmh.b64Std.charAt(b3 & 63)
        }
        return out
    }

    // 只接受纯 ASCII 明文的 base64url（本站两段明文都是 ASCII，非法串直接判否）
    b64urlDecode(str) {
        const bytes = this.base64ToBytes(str)
        if (!bytes) return null
        let out = ""
        for (let i = 0; i < bytes.length; i++) {
            if (bytes[i] > 127) return null
            out += String.fromCharCode(bytes[i])
        }
        return out
    }

    // 噪声图定位：官方算法的等价实现。
    // 用 16 位分肢精确模拟 64 位乘法 + 32 位分肢 XOR + 分肢取模，避免依赖 BigInt。
    noiseIndex(orderId, sid, count) {
        if (!count || count <= 0) return -1
        const m = this.toU32(orderId)
        const g = this.toU32(sid)
        if (m === null || g === null) return -1
        const L = this.mulU32toU64(g, Hipmh.noiseK1)
        const V = this.mulU32toU64(count >>> 0, Hipmh.noiseK2)
        const xHi = (L[0] ^ V[0]) >>> 0
        const xLo = (L[1] ^ V[1]) >>> 0
        const two32 = 4294967296 % count
        const b = (((xHi % count) * two32) % count + (xLo % count)) % count
        const h = (m ^ b) >>> 0
        if (h >= count) return -1
        return h
    }

    toU32(v) {
        if (v === null || v === undefined || v === "") return null
        const n = Number(v)
        if (!isFinite(n) || n < 0 || n > 4294967295) return null
        return Math.floor(n) >>> 0
    }

    // a, b ∈ [0, 2^32) 的精确 64 位乘积，返回 [hi, lo]
    mulU32toU64(a, b) {
        const aLo = a % 65536
        const aHi = Math.floor(a / 65536)
        const bLo = b % 65536
        const bHi = Math.floor(b / 65536)
        const ll = aLo * bLo
        const lh = aLo * bHi + aHi * bLo
        const hh = aHi * bHi
        let low = ll + (lh % 65536) * 65536
        const carry = Math.floor(low / 4294967296)
        low = low % 4294967296
        const high = (hh + Math.floor(lh / 65536) + carry) % 4294967296
        return [high, low]
    }

    imageHostFor(line) {
        const n = Number(line)
        if (n === 2) return Hipmh.imgHostLine2
        if (n === 9) return Hipmh.imgHostLine1s
        return Hipmh.imgHostLine1
    }

    // 站内链接识别（Venera 的 link 必须是类字段，不能写成全局赋值）
    link = {
        domains: ["m.hipmh.com", "hipmh.com", "www.hipmh.com"],
        linkToId: (url) => {
            const s = String(url == null ? "" : url)
            const m = /\/works\/([^\/?#]+)/.exec(s)
            if (m) return m[1]
            const c = /\/chapter\/([^\/?#]+)/.exec(s)
            return c ? c[1] : null
        }
    }
}
