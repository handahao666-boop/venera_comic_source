// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/zazhimi
class ZazhimiSource extends ComicSource {
    config = {"name":"杂志迷","baseUrl":"https://www.zazhimi.net","api":"https://android2026.zazhimi.net/api","userAgent":"ZaZhiMi_6.0.0","categories":{"女装服饰":"6","美妆美发":"8","时尚男士":"9","娱乐明星":"10","手工制作":"127","居家生活":"168"},"key":"zazhimi","version":"1.0.2","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/zazhimi.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;

    async read(route) {
        const response = await Network.get(this.config.api + route, {
            Accept: "application/json", "User-Agent": this.config.userAgent, "cache-time": "no",
        });
        if (!response || response.error) throw new Error("杂志迷接口连接失败。");
        if (response.status !== 200) throw new Error("杂志迷接口 HTTP " + response.status);
        try { return JSON.parse(response.body); }
        catch (_) { throw new Error("杂志迷没有返回 JSON 数据。"); }
    }

    async list(page, query = "", category = "") {
        const route = category ? "/lists.php?c=" + category + "&m=&" :
            query ? "/search.php?k=" + encodeURIComponent(query) + "&" : "/index.php?";
        const data = await this.read(route + "p=" + page + "&s=20");
        const rows = query || category ? data.magazine : data.new;
        if (!Array.isArray(rows)) throw new Error("杂志列表结构已变化。");
        const comics = rows.filter(row => /^\d+$/.test(String(row?.magId)) && typeof row.magName === "string")
            .map(row => new Comic({
                id: String(row.magId), title: row.magName,
                cover: typeof row.magCover === "string" ? row.magCover : "",
            }));
        return { comics, maxPage: rows.length >= 20 ? page + 1 : page };
    }

    async issue(id) {
        if (!/^\d{1,20}$/.test(String(id))) throw new Error("杂志编号无效。");
        const data = await this.read("/show.php?a=" + id);
        if (!Array.isArray(data.content) || !data.content.length) throw new Error("原站没有提供这期杂志的正文。");
        if (String(data.content[0].magId) !== String(id)) throw new Error("杂志编号与服务器响应不一致。");
        return data.content;
    }

    explore = [{ title: this.name, type: "multiPageComicList", load: page => this.list(page) }];
    category = {
        title: this.name,
        parts: [{
            name: "杂志分类", type: "fixed", itemType: "category",
            categories: Object.keys(this.config.categories), categoryParams: Object.values(this.config.categories),
        }],
    };
    categoryComics = {
        load: (_category, param, _options, page) => {
            if (!Object.values(this.config.categories).includes(param)) throw new Error("杂志分类无效。");
            return this.list(page, "", param);
        },
    };
    search = { load: (keyword, _options, page) => this.list(page, String(keyword || "").trim()) };
    comic = {
        loadInfo: async id => {
            const [first] = await this.issue(id);
            return new ComicDetails({
                title: first.magName, cover: first.pageThumbUrl || first.magPic || "",
                tags: {},
                chapters: { full: "全本" },
                url: typeof first.pageUrl === "string" ? first.pageUrl.split("?")[0] : undefined,
            });
        },
        loadEp: async id => {
            const rows = await this.issue(id);
            const images = rows.map(row => row.magPic);
            if (images.some(url => typeof url !== "string" || !/^https?:\/\/[a-z0-9.-]+\.zazhimi\.net\//i.test(url))) {
                throw new Error("杂志正文中存在无效图片地址。");
            }
            return { images };
        },
    };
}
