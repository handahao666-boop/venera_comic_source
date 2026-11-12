// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/relamanhua
class RelaManhuaSource extends ComicSource {
    config = {"name":"熱辣漫畫","baseUrl":"https://m.2024manga.com","api":"https://api.manga2026.xyz/api/v3","themes":[["愛情","aiqing"],["歡樂向","huanlexiang"],["冒險","maoxian"],["奇幻","qihuan"],["百合","baihe"],["校园","xiaoyuan"],["科幻","kehuan"],["東方","dongfang"],["耽美","danmei"],["格鬥","gedou"],["TL","teenslove"],["生活","shenghuo"],["轻小说","qingxiaoshuo"],["其他","qita"],["悬疑","xuanyi"],["萌系","mengxi"],["神鬼","shengui"],["职场","zhichang"],["治愈","zhiyu"],["节操","jiecao"]],"key":"relamanhua","version":"1.0.0","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/relamanhua.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;

    async api(route, params) {
        const query = Object.entries(params).map(([key, value]) => key + "=" + encodeURIComponent(value)).join("&");
        const response = await Network.get(this.config.api + "/" + route + "?" + query, {
            Accept: "application/json", Referer: this.config.baseUrl + "/", "cache-time": "no",
        });
        if (!response || response.error) throw new Error(this.name + "連線失敗。");
        if (response.status !== 200) throw new Error(this.name + "返回 HTTP " + response.status);
        const payload = JSON.parse(response.body);
        if (payload.code !== 200 || !payload.results) throw new Error(payload.message || this.name + "沒有返回資料。");
        return payload.results;
    }

    part(value) {
        const text = String(value || "");
        if (!text || text.length > 160 || /[\s/\\?#]|^\.{1,2}$/.test(text)) throw new Error("編號無效。");
        return encodeURIComponent(text);
    }

    image(url) {
        return typeof url === "string" && /^https?:\/\/[a-z0-9.-]+\/[^\s]+$/i.test(url) ? url : "";
    }

    async list(page, params, query = "") {
        const offset = (page - 1) * 30;
        const result = await this.api(query ? "search/comic" : "comics", { ...params, limit: 30, offset });
        if (!Array.isArray(result.list)) throw new Error(this.name + "列表格式已變化。");
        const comics = result.list.filter(row => row.path_word && row.name).map(row => new Comic({
            id: row.path_word, title: row.name, cover: this.image(row.cover), subtitle: row.datetime_updated || undefined,
        }));
        return { comics, maxPage: result.list.length && offset + result.list.length < result.total ? page + 1 : page };
    }

    browse(page, order, theme) {
        return this.list(page, { free_type: 1, ordering: order, ...(theme ? { theme } : {}) });
    }

    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.browse(page, "-popular") },
        { title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.browse(page, "-datetime_updated") },
    ];

    category = {
        title: this.name,
        parts: [{
            name: "題材", type: "fixed", itemType: "category",
            categories: this.config.themes.map(([label]) => label), categoryParams: this.config.themes.map(([, value]) => value),
        }],
    };

    categoryComics = {
        load: (_category, theme, _options, page) => {
            if (!this.category.parts[0].categoryParams.includes(theme)) throw new Error("題材無效。");
            return this.browse(page, "-datetime_updated", theme);
        },
    };

    search = {
        load: (keyword, _options, page) => {
            const query = String(keyword || "").trim();
            return query ? this.list(page, { platform: 1, q: query, q_type: "" }, query) : this.browse(page, "-popular");
        },
    };

    async chapters(id, groups) {
        const chapters = {};
        for (const group of Object.values(groups)) {
            const route = "comic/" + id + "/group/" + this.part(group.path_word) + "/chapters";
            const items = [];
            const seen = new Set();
            let total;
            for (let offset = 0; total === undefined || offset < total;) {
                const batch = await this.api(route, { limit: 500, offset });
                if (!Array.isArray(batch.list) || !Number.isSafeInteger(batch.total)) throw new Error("章節列表格式已變化。");
                total = batch.total;
                const fresh = batch.list.filter(row => !seen.has(row.uuid) && seen.add(row.uuid));
                if (offset < total && !fresh.length) throw new Error("原站章節分頁沒有返回新條目，請重新整理。");
                items.push(...fresh);
                offset += batch.list.length;
            }
            if (items.every(row => Number.isFinite(row.ordered))) items.sort((a, b) => a.ordered - b.ordered);
            for (const row of items) {
                if (!/^[a-f0-9-]{36}$/i.test(row.uuid) || !row.name) continue;
                chapters["ep_" + row.uuid] = group.path_word === "default" ? row.name : group.name + "：" + row.name;
            }
        }
        return chapters;
    }

    comic = {
        loadInfo: async rawId => {
            const id = this.part(rawId);
            const detail = await this.api("comic2/" + id, { platform: 1 });
            const row = detail.comic;
            if (!row?.name || !detail.groups) throw new Error("作品詳情格式已變化。");
            const authors = (row.author || []).map(item => item.name).filter(Boolean);
            const genres = (row.theme || []).map(item => item.name).filter(Boolean);
            const chapters = await this.chapters(id, detail.groups);
            if (!Object.keys(chapters).length) throw new Error("原站尚未列出章節。");
            return new ComicDetails({
                title: row.name, cover: this.image(row.cover), description: row.brief || "", chapters,
                tags: { "作者": authors, "題材": genres }, url: this.config.baseUrl + "/v2h5/details/comic/" + id,
            });
        },
        loadEp: async (rawId, ep) => {
            const uuid = String(ep || "").match(/^ep_([a-f0-9-]{36})$/i)?.[1];
            if (!uuid) throw new Error("章節編號無效。");
            const result = await this.api("comic/" + this.part(rawId) + "/chapter/" + uuid, { platform: 1 });
            if (result.is_lock !== false) throw new Error("該章需要在原站取得閱讀權限。");
            const images = result.chapter?.contents?.map(row => this.image(row.url));
            if (!images?.length || images.some(url => !url)) throw new Error("原站未返回完整的公開正文。");
            return { images };
        },
        onThumbnailLoad: url => ({ url, headers: { Referer: this.config.baseUrl + "/" } }),
        onImageLoad: url => ({ url, headers: { Referer: this.config.baseUrl + "/" } }),
    };
}
