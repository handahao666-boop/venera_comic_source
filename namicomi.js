// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/all/namicomi
class NamiComiChineseSource extends ComicSource {
    config = {"name":"NamiComi 中文","baseUrl":"https://namicomi.com","api":"https://api.namicomi.com","key":"namicomi","version":"1.0.0","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/namicomi.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;
    languages = ["zh-hant", "zh-hans"];
    includes = ["cover_art", "organization", "tag"].map(value => ["includes[]", value]);

    async api(route, params = [], data) {
        const query = params.map(([key, value]) => encodeURIComponent(key) + "=" + encodeURIComponent(value)).join("&");
        const url = this.config.api + "/" + route + (query ? "?" + query : "");
        const headers = { Accept: "application/json", "cache-time": "no" };
        const response = data ? await Network.post(url, { ...headers, "Content-Type": "application/json" }, JSON.stringify(data))
            : await Network.get(url, headers);
        if (!response || response.error) throw new Error("NamiComi 連線失敗。");
        if ([401, 402, 403].includes(response.status)) throw new Error("此內容未對遊客公開，請在原站查看閱讀權限。");
        if (response.status !== 200) throw new Error("NamiComi 返回 HTTP " + response.status);
        const json = JSON.parse(response.body);
        if (json.result !== "ok" || !json.data) throw new Error("NamiComi 資料格式已變化。");
        return json;
    }

    id(value) {
        if (!/^[a-z0-9]{8}$/i.test(String(value || ""))) throw new Error("NamiComi 編號無效。");
        return value;
    }

    text(values, lang) {
        return values?.[lang] || values?.[this.languages.find(item => item !== lang)] || values?.en || Object.values(values || {})[0] || "";
    }

    cover(row, lang) {
        const covers = (row.relationships || []).filter(item => item.type === "cover_art" && item.attributes?.fileName);
        const file = (covers.find(item => item.attributes.locale === lang) || covers[0])?.attributes.fileName;
        return file ? "https://uploads.namicomi.com/covers/" + this.id(row.id) + "/" + encodeURIComponent(file) : "";
    }

    async list(page, lang, sort, title = "") {
        const offset = (page - 1) * 24;
        const { data, meta } = await this.api("title/search", [
            ["availableTranslatedLanguages[]", lang], ["contentRatings[]", "safe"], ["order[" + sort + "]", "desc"],
            ["limit", 24], ["offset", offset], ...this.includes, ...(title ? [["title", title]] : []),
        ]);
        if (!Array.isArray(data)) throw new Error("NamiComi 列表格式已變化。");
        const comics = data.filter(row => row.attributes?.contentRating === "safe").map(row => new Comic({
            id: this.id(row.id), title: this.text(row.attributes.title, lang), cover: this.cover(row, lang),
        }));
        return { comics, maxPage: data.length && offset + data.length < meta.total ? page + 1 : page };
    }

    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.list(page, "zh-hant", "views") },
        { title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.list(page, "zh-hant", "publishedAt") },
        { title: this.name + " · 简体", type: "multiPageComicList", load: page => this.list(page, "zh-hans", "publishedAt") },
    ];

    category = { title: this.name, parts: [{
        name: "中文譯本", type: "fixed", itemType: "category", categories: ["繁體中文", "简体中文"], categoryParams: this.languages,
    }] };

    categoryComics = { load: (_category, lang, _options, page) => {
        if (!this.languages.includes(lang)) throw new Error("語言分區無效。");
        return this.list(page, lang, "publishedAt");
    } };

    search = { load: async (keyword, _options, page) => {
        const query = String(keyword || "").trim();
        const results = await Promise.all(this.languages.map(lang => this.list(page, lang, query ? "publishedAt" : "views", query)));
        const comics = new Map();
        for (const result of results) {
            for (const comic of result.comics) if (!comics.has(comic.id)) comics.set(comic.id, comic);
        }
        return { comics: [...comics.values()], maxPage: Math.max(...results.map(row => row.maxPage)) };
    } };

    async chapterList(id, lang) {
        const rows = new Map();
        for (let offset = 0;;) {
            const { data, meta } = await this.api("chapter", [
                ["titleId", id], ["translatedLanguages[]", lang], ["order[volume]", "asc"], ["order[chapter]", "asc"],
                ["limit", 100], ["offset", offset],
            ]);
            if (!Array.isArray(data) || !Number.isSafeInteger(meta?.total)) throw new Error("NamiComi 章節分頁格式已變化。");
            const previousSize = rows.size;
            for (const row of data) rows.set(this.id(row.id), row);
            offset += data.length;
            if (offset >= meta.total) return [...rows.values()];
            if (previousSize === rows.size) throw new Error("NamiComi 未返回下一批章節。");
        }
    }

    async publicChapters(rows) {
        const chapters = {};
        for (let offset = 0; offset < rows.length; offset += 100) {
            const batch = rows.slice(offset, offset + 100);
            const response = await this.api("gating/check", [], {
                entities: batch.map(row => ({ entityId: row.id, entityType: "chapter" })),
            });
            const access = response.data.attributes?.map;
            if (!access) throw new Error("NamiComi 未返回遊客閱讀權限。");
            for (const row of batch) {
                if (access[row.id] !== true) continue;
                const a = row.attributes || {};
                const prefix = a.translatedLanguage === "zh-hans" ? "简体" : "繁體";
                const title = [a.volume && "卷 " + a.volume, a.chapter && "第 " + a.chapter + " 話", a.name].filter(Boolean).join(" · ");
                chapters["ep_" + row.id] = "[" + prefix + "] " + (title || "正文");
            }
        }
        return chapters;
    }

    comic = {
        loadInfo: async rawId => {
            const id = this.id(rawId);
            const { data: row } = await this.api("title/" + id, this.includes);
            if (row.attributes?.contentRating !== "safe") throw new Error("此作品請到原站查看。");
            const chapters = await this.publicChapters((await Promise.all(this.languages.map(lang => this.chapterList(id, lang)))).flat());
            if (!Object.keys(chapters).length) throw new Error("原站沒有可供遊客閱讀的中文章節。");
            const authors = (row.relationships || []).filter(item => item.type === "organization").map(item => item.attributes?.name).filter(Boolean);
            return new ComicDetails({
                title: this.text(row.attributes.title, "zh-hant"), description: this.text(row.attributes.description, "zh-hant"),
                cover: this.cover(row, "zh-hant"), tags: { "作者": [...new Set(authors)] }, chapters,
                url: this.config.baseUrl + "/zh-hant/title/" + id,
            });
        },
        loadEp: async (_rawId, ep) => {
            const id = this.id(String(ep || "").match(/^ep_([a-z0-9]{8})$/i)?.[1]);
            const { data } = await this.api("images/chapter/" + id, [["newQualities", "true"]]);
            if (data.baseUrl !== "https://uploads.namicomi.com" || !/^[a-f0-9]{16,64}$/i.test(data.hash)) {
                throw new Error("NamiComi 圖片來源格式已變化。");
            }
            const prefix = data.baseUrl + "/chapter/" + id + "/" + data.hash + "/source/";
            const images = data.source?.map(page => typeof page.filename === "string" && page.filename ? prefix + encodeURIComponent(page.filename) : "");
            if (!images?.length || images.some(url => !url)) throw new Error("NamiComi 未返回完整正文。");
            return { images };
        },
    };
}
