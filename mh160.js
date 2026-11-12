// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/mh160
class Mh160Source extends ComicSource {
    config = {"name":"漫画160","baseUrl":"https://www.mh160mh.com","legacyImageHost":"https://mhpic6.tgmhfc.uk","imageHosts":["https://mhpic5er.tgmhfc.uk","https://mhpic789-5.tgmhfc.uk","https://mhpic7fr.tgmhfc.uk","https://mhpicwt.tgmhfc.uk","https://mhpicwx.tgmhfc.uk"],"categoryGroups":{"连载状态":[["连载中","lianzai"],["完结","wanjie"]],"地区":[["日韩","zaixian_rhmh"],["内地","zaixian_dlmh"],["港台","zaixian_gtmh"],["欧美","zaixian_ommh"],["其他","zaixian_qita"]],"读者":[["少年","shaonianqu"],["少女","shaonvqu"],["青年","qingnian"],["少儿","shaoer"]],"题材":[["热血","rexue"],["格斗","gedou"],["科幻","kehuan"],["竞技","jingji"],["搞笑","gaoxiao"],["推理","tuili"],["恐怖","kongbu"],["耽美","danmei"],["恋爱","lianai"],["生活","shenghuo"],["战争","zhanzheng"],["故事","gushi"],["冒险","maoxian"],["魔幻","mohuan"],["玄幻","xuanhuan"],["校园","xiaoyuan"],["悬疑","xuanyi"],["萌系","mengxi"],["穿越","chuanyue"],["后宫","hougong"],["都市","dushi"],["武侠","wuxia"],["历史","lishi"],["同人","tongren"],["励志","lizhi"],["百合","baihe"],["治愈","zhiyu"],["机甲","jijia"],["纯爱","chunai"],["美食","meishi"],["血腥","xuexing"],["僵尸","jiangshi"],["恶搞","egao"],["虐心","nuexin"],["动作","dongzuo"],["惊险","jingxian"],["唯美","weimei"],["震撼","zhenhan"],["复仇","fuchou"],["侦探","zhentan"],["脑洞","naodong"],["奇幻","qihuan"],["宫斗","gongdou"],["爆笑","baoxiao"],["运动","yundong"],["青春","qingchun"],["灵异","lingyi"],["古风","gufeng"],["权谋","quanmou"],["节操","jiecao"],["明星","mingxing"],["暗黑","anhei"],["社会","shehui"],["浪漫","langman"],["仙侠","xianxia"],["伪娘","weiniang"]]},"key":"mh160","version":"1.0.0","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/mh160.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;
    mobile = this.config.baseUrl.replace("www.", "m.");

    async get(url) {
        const response = await Network.get(url, { "cache-time": "no" });
        if (!response || response.error) throw new Error(this.name + "连接失败。");
        return response;
    }

    body(response) {
        if (response.status !== 200) throw new Error(this.name + "返回 HTTP " + response.status + "。");
        if (typeof response.body !== "string" || !response.body.trim()) throw new Error(this.name + "返回空页面。");
        return response.body;
    }

    parse(html, callback) {
        const doc = new HtmlDocument(html);
        try { return callback(doc); }
        finally { doc.dispose(); }
    }

    localPath(href) {
        return String(href || "").replace(/^https?:\/\/(?:www|m)\.mh160mh\.com(?=\/)/i, "");
    }

    image(value, base) {
        const url = String(value || "").trim();
        if (/^https?:\/\/[a-z0-9.-]+\/[^\s]+$/i.test(url)) return url;
        if (/^\/\/[a-z0-9.-]+\/[^\s]+$/i.test(url)) return "https:" + url;
        return /^\/(?!\/)[^\s]+$/.test(url) ? base + url : "";
    }

    parseComics(html, rowSelector, linkSelector, titleSelector, latestSelector, origin) {
        return this.parse(html, doc => {
            const comics = new Map();
            for (const row of doc.querySelectorAll(rowSelector)) {
                const link = row.querySelector(linkSelector);
                const id = this.localPath(link?.attributes.href).match(/^\/kanmanhua\/([a-z0-9-]{1,160})\/?$/i)?.[1];
                const title = (titleSelector ? row.querySelector(titleSelector) : link)?.text.trim();
                if (!id || !title || comics.has(id)) continue;
                const image = row.querySelector("img")?.attributes;
                const subtitle = latestSelector ? row.querySelector(latestSelector)?.text.trim() : undefined;
                comics.set(id, new Comic({ id, title, cover: this.image(image?.["data-src"] || image?.src, origin), subtitle }));
            }
            return [...comics.values()];
        });
    }

    async ranking(page, recent = false) {
        if (page > 1) return { comics: [], maxPage: 1 };
        const route = "/kanmanhua/zaixian_" + (recent ? "recent" : "hit") + ".html";
        const html = this.body(await this.get(this.mobile + route));
        const comics = this.parseComics(html, ".itemBox", ".itemTxt a.title", null, ".itemTxt .txtItme", this.mobile);
        if (!comics.length) throw new Error(this.name + "榜单结构已变化。");
        return { comics, maxPage: 1 };
    }

    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.ranking(page) },
        { title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.ranking(page, true) },
    ];

    category = {
        title: this.name,
        parts: Object.entries(this.config.categoryGroups).map(([name, entries]) => ({
            name, type: "fixed", itemType: "category",
            categories: entries.map(([label]) => label), categoryParams: entries.map(([, slug]) => slug),
        })),
    };

    categoryComics = {
        load: async (_category, slug, _options, page) => {
            if (!this.category.parts.some(part => part.categoryParams.includes(slug))) throw new Error("分类无效。");
            if (page > 1) return { comics: [], maxPage: 1 };
            const html = this.body(await this.get(this.mobile + "/kanmanhua/" + slug + "/"));
            const comics = this.parseComics(html, "#listbody li", "a.ImgA", "a.txtA", ".info", this.mobile);
            if (!comics.length) throw new Error(this.name + "分类页没有返回可读作品。");
            return { comics, maxPage: 1 };
        },
    };

    async searchRankings(keyword) {
        const rankings = await Promise.allSettled([this.ranking(1), this.ranking(1, true)]);
        const matches = new Map();
        const query = keyword.toLowerCase();
        for (const ranking of rankings) {
            if (ranking.status !== "fulfilled") continue;
            for (const comic of ranking.value.comics) {
                if (comic.title.toLowerCase().includes(query)) {
                    matches.set(comic.id, new Comic({ ...comic, subtitle: "来自官网热门或最新列表" }));
                }
            }
        }
        if (!matches.size) throw new Error("官网全站搜索暂不可用，热门和最新列表也没有匹配作品。");
        return { comics: [...matches.values()], maxPage: 1 };
    }

    search = {
        load: async (keyword, _options, page) => {
            const query = String(keyword || "").trim();
            if (!query) return this.ranking(page);
            if (page > 1) return { comics: [], maxPage: 1 };
            const response = await this.get(this.config.baseUrl + "/statics/searchelxt1e1.aspx?key=" + encodeURIComponent(query) + "&page=1");
            if (response.status === 403) return this.searchRankings(query);
            const html = this.body(response);
            const comics = this.parseComics(html, "ul.mh-search-list > li", ".mh-works-title h4 a", null, null, this.config.baseUrl);
            return { comics, maxPage: 1 };
        },
    };

    detailPath(id) {
        if (!/^[a-z0-9-]{1,160}$/i.test(String(id || ""))) throw new Error("作品编号无效。");
        return "/kanmanhua/" + id + "/";
    }

    episodePath(ep) {
        const match = String(ep || "").match(/^ep_([a-z0-9-]{1,160})_(\d{1,18})$/i);
        if (!match) throw new Error("章节编号无效，请刷新目录。");
        return this.detailPath(match[1]) + match[2] + ".html";
    }

    chapters(doc) {
        const chapters = {};
        for (const list of doc.querySelectorAll("ul[id^=mh-chapter-list-ol], ul[id^=chapterList_ul]")) {
            for (const link of list.querySelectorAll("li a").reverse()) {
                const match = this.localPath(link.attributes.href).match(/^\/kanmanhua\/([a-z0-9-]{1,160})\/(\d{1,18})\.html$/i);
                const title = (link.querySelector("p") || link).text.trim();
                if (match && title) chapters["ep_" + match[1] + "_" + match[2]] = title;
            }
        }
        if (!Object.keys(chapters).length) throw new Error(this.name + "作品没有返回可读目录。");
        return chapters;
    }

    images(html) {
        const encoded = html.match(/\bqTcms_S_m_murl_e\s*=\s*"([A-Za-z0-9+/=]+)"/)?.[1];
        const number = Number(html.match(/\bqTcms_S_p_id\s*=\s*"(\d+)"/)?.[1]);
        if (!encoded || !Number.isSafeInteger(number)) throw new Error("原站未返回可读图片清单。");
        const decoded = Convert.decodeUtf8(Convert.decodeBase64(encoded));
        if (/\+https?:\/\//.test(decoded)) throw new Error("该章节在原站已下架。");
        const { imageHosts, legacyImageHost, baseUrl } = this.config;
        const host = number > 542724 ? imageHosts[number % imageHosts.length] : legacyImageHost;
        const images = decoded.split("$qingtiandy$").filter(path => path.trim()).map(path => {
            if (/^https?:\/\//i.test(path)) return this.image(path, baseUrl);
            if (path.startsWith("/") && !path.startsWith("//")) return host + path.split("/").map(encodeURIComponent).join("/");
            return baseUrl + "/statics/pic/?p=" + encodeURIComponent(path);
        });
        if (!images.length || images.some(url => !url)) throw new Error("原站图片清单为空或不完整。");
        return images;
    }

    comic = {
        loadInfo: async id => {
            const url = this.config.baseUrl + this.detailPath(id);
            const html = this.body(await this.get(url));
            return this.parse(html, doc => {
                const meta = key => doc.querySelector('meta[property="' + key + '"]')?.attributes.content?.trim();
                const title = doc.querySelector(".mh-date-info-name h4 a, .txtItme.h1")?.text.trim() || meta("og:novel:book_name");
                if (!title) throw new Error(this.name + "详情结构已变化。");
                const author = meta("og:novel:author") || doc.querySelector(".works-info-tc .one em")?.text.trim();
                const cover = doc.querySelector(".mh-date-bgpic img, #Cover img")?.attributes.src || meta("og:image");
                const genre = meta("og:novel:category");
                const tags = {};
                if (author) tags["作者"] = [author];
                if (genre) tags["题材"] = [genre];
                return new ComicDetails({
                    title, cover: this.image(cover, this.config.baseUrl), tags, chapters: this.chapters(doc), url,
                    description: doc.querySelector("#workint, .detailContent p")?.text.trim() || "",
                });
            });
        },
        loadEp: async (_id, ep) => ({
            images: this.images(this.body(await this.get(this.config.baseUrl + this.episodePath(ep)))),
        }),
        onImageLoad: (url, _id, ep) => ({ url, headers: { Referer: this.config.baseUrl + this.episodePath(ep) } }),
        onThumbnailLoad: url => ({ url, headers: { Referer: this.config.baseUrl + "/" } }),
    };
}
