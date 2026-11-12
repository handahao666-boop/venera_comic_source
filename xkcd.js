// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/all/xkcd
class XkcdChineseSource extends ComicSource {
    config = {"name":"xkcd 中文","baseUrl":"https://xkcd.tw","key":"xkcd","version":"1.0.2","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/xkcd.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;

    async archive() {
        const response = await Network.get(this.config.baseUrl + "/api/strips.json", {
            Accept: "application/json", "cache-time": "no",
        });
        if (!response || response.error) throw new Error("xkcd 中文档案连接失败。");
        if (response.status !== 200) throw new Error("xkcd 中文档案 HTTP " + response.status);
        const data = JSON.parse(response.body);
        if (!data || Array.isArray(data) || typeof data !== "object") throw new Error("xkcd 中文档案结构已变化。");
        return data;
    }

    image(row) {
        const link = row?.img_url;
        if (typeof link !== "string") return "";
        if (/^\/(?!\/)[^\s]+$/.test(link)) return this.config.baseUrl + link;
        return /^https:\/\/(?:imgs\.xkcd\.com|xkcd\.tw)\/[^\s]+$/.test(link) ? link : "";
    }

    async list(keyword, page, order = "original") {
        const data = await this.archive();
        const query = String(keyword || "").trim().toLowerCase();
        const rows = Object.values(data).filter(row => Number.isSafeInteger(row?.id) && typeof row.title === "string"
            && this.image(row) && (!query || (row.id + " " + row.title).toLowerCase().includes(query)));
        rows.sort((a, b) => {
            if (order === "translation") {
                const translated = String(b.translate_time || "").localeCompare(String(a.translate_time || ""));
                if (translated) return translated;
            }
            return b.id - a.id;
        });
        const start = (page - 1) * 30;
        return {
            comics: rows.slice(start, start + 30).map(row => new Comic({
                id: String(row.id), title: row.title, subtitle: "#" + row.id, cover: this.image(row),
            })),
            maxPage: Math.max(1, Math.ceil(rows.length / 30)),
        };
    }

    async strip(id) {
        if (!/^\d{1,10}$/.test(String(id))) throw new Error("xkcd 漫画编号无效。");
        const row = (await this.archive())[id];
        if (String(row?.id) !== String(id) || !this.image(row)) throw new Error("中文档案未提供这张漫画。");
        return row;
    }

    explore = [{ title: this.name, type: "multiPageComicList", load: page => this.list("", page) }];
    category = {
        title: this.name,
        parts: [{
            name: "中文档案", type: "fixed", itemType: "category",
            categories: ["按翻译更新时间", "按原版编号"], categoryParams: ["translation", "original"],
        }],
    };
    categoryComics = {
        load: (_category, param, _options, page) => {
            if (!this.category.parts[0].categoryParams.includes(param)) throw new Error("中文档案排序无效。");
            return this.list("", page, param);
        },
    };
    search = { load: (keyword, _options, page) => this.list(keyword, page) };
    comic = {
        loadInfo: async id => {
            const row = await this.strip(id);
            return new ComicDetails({
                title: row.title, cover: this.image(row), description: row.caption || "",
                tags: {},
                chapters: { strip: "第 " + id + " 则" },
                url: this.config.baseUrl + "/" + id, updateTime: row.date || undefined,
            });
        },
        loadEp: async id => ({ images: [this.image(await this.strip(id))] }),
    };
}
