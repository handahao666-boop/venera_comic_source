// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/all/globalcomix
class GlobalComixChineseSource extends ComicSource {
    config = {"name":"GlobalComix 中文","baseUrl":"https://globalcomix.com","api":"https://api.globalcomix.com/v1","key":"globalcomix","version":"1.0.0","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/globalcomix.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;
    browserClient = null;

    async getBrowserClient() {
        const page = await Network.get(this.config.baseUrl + "/browse/cn", { "cache-time": "no" });
        const id = page?.status === 200 && String(page.body).match(/"api_key"\s*:\s*"(gck_[a-f0-9]{20,50})"/i)?.[1];
        if (!id) throw new Error("GlobalComix 网页未提供公开客户端标识。");
        return id;
    }

    async api(route, params = {}) {
        if (!this.browserClient) this.browserClient = await this.getBrowserClient();
        const query = Object.entries(params).map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v)).join("&");
        const response = await Network.get(this.config.api + "/" + route + (query ? "?" + query : ""), {
            Accept: "application/json", Referer: this.config.baseUrl + "/", "cache-time": "no",
            "x-gc-client": this.browserClient, "x-gc-identmode": "cookie",
        });
        if (!response || response.error) throw new Error("GlobalComix 连接失败。");
        if (response.status !== 200) throw new Error("GlobalComix 返回 HTTP " + response.status);
        const json = JSON.parse(response.body);
        if (json.error || !json.payload) throw new Error("GlobalComix 数据格式已变化。");
        return json.payload;
    }

    image(url) {
        return typeof url === "string" && /^https:\/\/[a-z0-9.-]+\/[^\s]+$/i.test(url) ? url : "";
    }

    comicId(raw) {
        const match = String(raw || "").match(/^(\d{1,15})~([a-z0-9_-]{1,180})$/i);
        if (!match) throw new Error("GlobalComix 作品编号无效。");
        return { id: match[1], slug: match[2] };
    }

    async list(page, params = {}, filter = () => true) {
        const result = await this.api("comics", { "lang_id[]": "cn", p: page, ...params });
        if (!Array.isArray(result.results)) throw new Error("GlobalComix 列表格式已变化。");
        const comics = result.results.filter(row => /^\d{1,15}$/.test(String(row.id)) && /^[a-z0-9_-]{1,180}$/i.test(row.slug) && row.name && filter(row))
            .map(row => new Comic({
                id: row.id + "~" + row.slug, title: row.name, cover: this.image(row.image_url), subtitle: row.last_published_release_title || undefined,
            }));
        return { comics, maxPage: result.pagination?.total_pages > page ? page + 1 : page };
    }

    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.list(page) },
        { title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.list(page, { sort: "recent" }) },
    ];

    genres = { "爱情": "2", "喜剧": "3", "科幻": "4", "历史": "5", "奇幻": "7", "冒险": "19", "日常": "24" };
    category = { title: this.name, parts: [{
        name: "中文作品题材", type: "fixed", itemType: "category", categories: Object.keys(this.genres), categoryParams: Object.values(this.genres),
    }] };
    categoryComics = { load: (_category, genre, _options, page) => {
        if (!Object.values(this.genres).includes(genre)) throw new Error("题材无效。");
        return this.list(page, { perpage: 100 }, row => String(row.comic_category_id) === genre);
    } };
    search = { load: (keyword, _options, page) => {
        const query = String(keyword || "").trim();
        const matches = row => String(row.name).toLowerCase().includes(query.toLowerCase());
        return query ? this.list(page, { q: query, sort: "relevance", perpage: 100 }, matches) : this.list(page);
    } };

    free(row) {
        return row?.is_free === true && Number(row.premium_only || 0) === 0 && row.is_public_now === true && !Number(row.is_nsfw);
    }

    comic = {
        loadInfo: async rawId => {
            const { id, slug } = this.comicId(rawId);
            const { results: row } = await this.api("read/" + slug);
            if (!row?.name || String(row.id) !== id) throw new Error("GlobalComix 详情格式已变化。");
            const releases = await this.api("comics/" + id + "/releases", { lang_id: "cn", all: "true" });
            if (!Array.isArray(releases.results)) throw new Error("GlobalComix 目录格式已变化。");
            const chapters = {};
            const sorted = releases.results.filter(item => item.lang_id === "cn" && this.free(item))
                .sort((a, b) => a.order - b.order);
            for (const item of sorted) {
                if (!/^[a-f0-9-]{36}$/i.test(item.key)) continue;
                const name = [item.chapter && "第 " + item.chapter + " 话", item.title].filter(Boolean).join(" · ");
                chapters["ep_" + item.key] = name || "正文";
            }
            if (!Object.keys(chapters).length) throw new Error("原站暂未开放可供游客阅读的中文章节。");
            const author = row.artist?.roman_name || row.artist?.name;
            return new ComicDetails({
                title: row.name, cover: this.image(row.image_url), description: row.description || "",
                tags: author ? { "作者": [author] } : {}, chapters, url: this.config.baseUrl + "/c/" + slug,
            });
        },
        loadEp: async (rawId, ep) => {
            const { id } = this.comicId(rawId);
            const key = String(ep || "").match(/^ep_([a-f0-9-]{36})$/i)?.[1];
            if (!key) throw new Error("章节编号无效。");
            const { results: row } = await this.api("readV2/" + key);
            if (!this.free(row) || String(row.comic_id) !== id || row.lang_id !== "cn") throw new Error("此章节未对游客公开。");
            const images = row.page_objects?.slice().sort((a, b) => a.order - b.order)
                .map(page => this.image(page.desktop_image_url || page.mobile_image_url));
            if (!images?.length || images.some(url => !url)) throw new Error("GlobalComix 未返回完整正文。");
            return { images };
        },
    };
}
