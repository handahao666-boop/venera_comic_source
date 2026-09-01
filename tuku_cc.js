/**
 * 图库漫画 (tuku.cc) Venera 漫画源
 *
 * 站点事实（取证于 2026-08，详见 development_log.md）：
 * - 首页: https://www.tuku.cc/  (tuku.cc 302 -> www.tuku.cc)
 * - 详情页: /manga-{id}/
 * - 章节页: /chapter{id}/
 * - 题材分类: /comics-tag{id}/  第 n 页: /comics-tag{id}-p{n}/
 * - 地区筛选: /comics-region{rid}-tag{id}/
 * - 状态筛选: /comics-tag{id}-status{sid}/
 * - 搜索: /search?title={kw}  第 n 页: /search?title={kw}&page={n}
 * - 章节图片: 懒加载 data-original，带签名 key，且要求 Referer 为章节页 URL
 * - 图片协议: 直链 JPEG（无加密），仅需 Referer
 *
 * 未验证项：
 * - 搜索/分类 maxPage 依赖页面「共有N个结果」总数或分页 data-index（分类页无总数，仅能读到展示出的页码）
 * - 客户端真机导入与点击链路（需用户实际验证）
 */
class TukuCC extends ComicSource {

    // ===== 元数据 =====
    name = "图库漫画";

    key = "tuku_cc";

    version = "1.0.1";

    minAppVersion = "1.4.0";

    // 无维护中的更新地址，按规范显式留空，不把站点首页误当更新地址
    url = "";

    baseUrl = "https://www.tuku.cc";

    ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

    // ===== 工具函数 =====

    /**
     * HTML 页面请求头。不强制 Accept-Encoding：服务端在无该头时返回明文（已验证），
     * 引擎若默认发送 gzip 则返回压缩内容并自动解压，传输更快。
     */
    requestHeaders() {
        return {
            "User-Agent": this.ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        };
    }

    absoluteUrl(p) {
        if (!p) return "";
        p = String(p).trim();
        if (/^https?:\/\//i.test(p)) return p;
        if (p.startsWith("//")) return "https:" + p;
        if (p.startsWith("/")) return this.baseUrl + p;
        return this.baseUrl + "/" + p;
    }

    comicIdFromHref(href) {
        const m = String(href || "").match(/manga-(\d+)/);
        return m ? m[1] : "";
    }

    chapterIdFromHref(href) {
        const m = String(href || "").match(/chapter(\d+)/);
        return m ? m[1] : "";
    }

    /**
     * 标准化历史章节入参（纯 ID / 完整 URL / 组合 ID / 对象），返回纯章节数字 ID。
     */
    normalizeChapterId(epId) {
        if (!epId) return null;
        if (typeof epId === "object") {
            const v = epId.epId || epId.chapterId || epId.id || epId.url;
            return v ? this.normalizeChapterId(v) : null;
        }
        const s = String(epId);
        const m = s.match(/chapter(\d+)/);
        if (m) return m[1];
        const parts = s.split("|");
        if (parts.length > 1) {
            const last = parts[parts.length - 1];
            const m2 = last.match(/chapter(\d+)/) || last.match(/(\d+)/);
            return m2 ? m2[1] : null;
        }
        if (/^\d+$/.test(s)) return s;
        return null;
    }

    /**
     * 通用列表卡片解析（首页推荐/最近更新/全新上架/题材分类/搜索共用 .swiper-card-item）。
     * 封面懒加载字段优先 data-original，回退 src；标题优先 .card-item-title，搜索页回退 h3 a。
     */
    parseCard(item) {
        const coverLink = item.querySelector(".swiper-card-item-img");
        const titleLink = item.querySelector(".card-item-title") || item.querySelector("h3 a");
        const id = this.comicIdFromHref(coverLink ? coverLink.attributes.href : "")
            || this.comicIdFromHref(titleLink ? titleLink.attributes.href : "");
        if (!id) return null;
        const title = titleLink
            ? titleLink.text.trim()
            : (coverLink ? (coverLink.attributes.title || "") : "");
        let cover = "";
        if (coverLink) {
            const img = coverLink.querySelector("img");
            if (img) {
                cover = this.absoluteUrl(img.attributes["data-original"] || img.attributes.src || "");
            }
        }
        const state = item.querySelector(".card-item-state")
            ? item.querySelector(".card-item-state").text.trim() : "";
        const latest = item.querySelector(".card-item-info")
            ? item.querySelector(".card-item-info").text.trim()
            : (item.querySelector(".card-item-chapter")
                ? item.querySelector(".card-item-chapter").text.trim()
                : (item.querySelector(".text-markedness") ? item.querySelector(".text-markedness").text.trim() : ""));
        const subParts = [];
        if (state) subParts.push(state);
        if (latest) subParts.push(latest);
        return new Comic({
            id: id,
            title: title,
            cover: cover,
            subTitle: subParts.join(" · "),
        });
    }

    /**
     * 从分页节点读取最大页码（.page-item 的 data-index 最大值）。
     */
    parseMaxPage(doc) {
        let max = 1;
        doc.querySelectorAll(".page-item").forEach((item) => {
            const a = item.querySelector("a");
            if (!a) return;
            const idx = parseInt(a.attributes["data-index"] || a.text, 10);
            if (!isNaN(idx) && idx > max) max = idx;
        });
        return max;
    }

    /**
     * 从 .manga-info-card 中按「标签：值」结构读取字段值（作者/状态）。
     */
    getLabeled(doc, label) {
        const ps = doc.querySelectorAll(".manga-info-card p");
        for (let i = 0; i < ps.length; i++) {
            const t = (ps[i].text || "").trim();
            const idx = t.indexOf("：");
            if (idx < 0) continue;
            if (t.slice(0, idx).trim() === label) {
                return t.slice(idx + 1).trim();
            }
        }
        return "";
    }

    // ===== 首页探索页 =====
    explore = [
        {
            title: this.name,
            type: "singlePageWithMultiPart",
            load: async () => {
                const result = {};
                let doc = null;
                try {
                    const res = await Network.get(this.baseUrl + "/", this.requestHeaders());
                    if (res.status !== 200) return result;
                    doc = new HtmlDocument(res.body);

                    const sections = [
                        ["漫画推荐", ".jp-card-wrap .swiper-card-item"],
                        ["最近更新", ".home-update-wrap .swiper-card-item"],
                        ["全新上架", ".home-rise .swiper-card-item"],
                    ];
                    for (const [secName, sel] of sections) {
                        const list = [];
                        doc.querySelectorAll(sel).forEach((item) => {
                            const c = this.parseCard(item);
                            if (c) list.push(c);
                        });
                        result[secName] = list;
                    }

                    // 高能排行使用独立卡片结构 .home-hot-item
                    const hot = [];
                    doc.querySelectorAll(".home-hot .home-hot-item").forEach((item) => {
                        const coverLink = item.querySelector(".home-hot-item-img");
                        const titleLink = item.querySelector(".home-hot-item-text h3 a");
                        const id = this.comicIdFromHref(coverLink ? coverLink.attributes.href : "")
                            || this.comicIdFromHref(titleLink ? titleLink.attributes.href : "");
                        if (!id) return;
                        let cover = "";
                        if (coverLink) {
                            const img = coverLink.querySelector("img");
                            if (img) cover = this.absoluteUrl(img.attributes["data-original"] || img.attributes.src || "");
                        }
                        const title = titleLink ? titleLink.text.trim() : "";
                        hot.push(new Comic({ id: id, title: title, cover: cover }));
                    });
                    result["高能排行"] = hot;
                } catch (e) {
                    // 网络失败或结构变化时返回空对象，避免把空结果与类型错误混淆
                } finally {
                    if (doc) doc.dispose();
                }
                return result;
            },
        },
    ];

    // ===== 分类页 =====
    category = {
        title: this.name,
        parts: [
            {
                name: "题材",
                type: "fixed",
                categories: [
                    "热血", "恋爱", "百合", "彩虹", "冒险", "后宫", "治愈",
                    "悬疑", "搞笑", "奇幻", "历史", "古风", "都市",
                ],
                itemType: "category",
                categoryParams: [
                    "1", "2", "4", "5", "6", "9", "10",
                    "16", "18", "19", "24", "31", "33",
                ],
            },
        ],
        enableRankingPage: false,
    };

    // ===== 分类漫画加载 =====
    categoryComics = {
        load: async (category, param, options, page) => {
            let doc = null;
            try {
                const region = options && options[0] && options[0] !== "0" ? options[0] : null;
                const status = options && options[1] && options[1] !== "0" ? options[1] : null;
                let base = "/comics";
                if (region) base += "-region" + region;
                base += "-tag" + param;
                if (status) base += "-status" + status;
                const path = page <= 1 ? base + "/" : base + "-p" + page + "/";

                const res = await Network.get(this.baseUrl + path, this.requestHeaders());
                if (res.status !== 200) return { comics: [], maxPage: page };
                doc = new HtmlDocument(res.body);

                const comics = [];
                doc.querySelectorAll(".swiper-card-item").forEach((item) => {
                    const c = this.parseCard(item);
                    if (c) comics.push(c);
                });
                const maxPage = this.parseMaxPage(doc);
                return { comics: comics, maxPage: maxPage };
            } catch (e) {
                return { comics: [], maxPage: page };
            } finally {
                if (doc) doc.dispose();
            }
        },
        optionList: [
            { options: ["0-全部地区", "1-港台", "2-日本", "3-韩国", "4-大陆", "5-欧美"] },
            { options: ["0-全部状态", "1-连载中", "2-已完结"] },
        ],
    };

    // ===== 搜索 =====
    search = {
        load: async (keyword, options, page) => {
            let doc = null;
            try {
                const path = "/search?title=" + encodeURIComponent(keyword) + (page > 1 ? "&page=" + page : "");
                const res = await Network.get(this.baseUrl + path, this.requestHeaders());
                if (res.status !== 200) return { comics: [], maxPage: page };
                const body = res.body;
                doc = new HtmlDocument(body);

                const comics = [];
                doc.querySelectorAll(".swiper-card-item").forEach((item) => {
                    const c = this.parseCard(item);
                    if (c) comics.push(c);
                });

                let maxPage = 1;
                const totalMatch = body.match(/共有\s*(\d+)\s*个结果/);
                if (totalMatch && comics.length > 0) {
                    const total = parseInt(totalMatch[1], 10);
                    maxPage = Math.ceil(total / comics.length);
                    if (maxPage < 1) maxPage = 1;
                } else {
                    maxPage = this.parseMaxPage(doc);
                }
                return { comics: comics, maxPage: maxPage };
            } catch (e) {
                return { comics: [], maxPage: page };
            } finally {
                if (doc) doc.dispose();
            }
        },
    };

    // ===== 漫画详情与章节 =====
    comic = {
        loadInfo: async (id) => {
            let doc = null;
            const res = await Network.get(this.baseUrl + "/manga-" + id + "/", this.requestHeaders());
            if (res.status !== 200) {
                throw "Comic not found";
            }
            try {
                doc = new HtmlDocument(res.body);

                const titleEl = doc.querySelector("h1.text-30");
                const title = titleEl ? titleEl.text.trim() : id;

                const coverImg = doc.querySelector(".manga-info-card .manga-cover img")
                    || doc.querySelector(".manga-info-card img");
                const cover = coverImg
                    ? this.absoluteUrl(coverImg.attributes.src || coverImg.attributes["data-original"] || "")
                    : "";

                const author = this.getLabeled(doc, "作者");
                const status = this.getLabeled(doc, "状态");
                const description = doc.querySelector(".manga-info-card p.multi-ellipsis")
                    ? doc.querySelector(".manga-info-card p.multi-ellipsis").text.trim() : "";

                const tags = [];
                doc.querySelectorAll(".manga-info-card h2 a").forEach((a) => {
                    const t = a.text.trim();
                    if (t) tags.push(t);
                });

                const chapters = new Map();
                doc.querySelectorAll(".manga-chapter-wrap a.manga-chapter-item").forEach((a) => {
                    const cid = this.chapterIdFromHref(a.attributes.href);
                    if (!cid || chapters.has(cid)) return;
                    const span = a.querySelector("span.i-b");
                    const ctitle = span ? span.text.trim() : (a.text || "").trim();
                    chapters.set(cid, ctitle || cid);
                });

                const subTitle = [author, status].filter((x) => x).join(" · ");

                return new ComicDetails({
                    title: title,
                    subTitle: subTitle,
                    cover: cover,
                    description: description,
                    tags: { 题材: tags },
                    chapters: chapters,
                    isFavorite: false,
                    subId: id,
                    thumbnails: cover ? [cover] : [],
                    recommend: [],
                    updateTime: "",
                    url: this.baseUrl + "/manga-" + id + "/",
                });
            } finally {
                if (doc) doc.dispose();
            }
        },

        loadEp: async (comicId, epId) => {
            const chapterId = this.normalizeChapterId(epId);
            if (!chapterId) {
                return { images: [] };
            }
            let doc = null;
            try {
                const res = await Network.get(this.baseUrl + "/chapter" + chapterId + "/", this.requestHeaders());
                if (res.status !== 200) return { images: [] };
                doc = new HtmlDocument(res.body);

                const images = [];
                doc.querySelectorAll("img.lazy").forEach((img) => {
                    const u = img.attributes["data-original"];
                    if (u && /^https?:\/\/image\d*\.tuku\.cc\//i.test(u)) images.push(u);
                });
                return { images: Array.from(new Set(images)) };
            } catch (e) {
                return { images: [] };
            } finally {
                if (doc) doc.dispose();
            }
        },

        onImageLoad: (url, comicId, epId) => {
            const chapterId = this.normalizeChapterId(epId);
            const referer = chapterId
                ? this.baseUrl + "/chapter" + chapterId + "/"
                : this.baseUrl + "/";
            return {
                headers: {
                    "User-Agent": this.ua,
                    "Referer": referer,
                    "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
                },
            };
        },
    };
}
