// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/3748b8ca9e85c9dca040ba900f49d63a23225504/src/zh/terrahistoricus
// Adapted to Venera JavaScript. See docs/Mihon转换源Apache-2.0许可.txt.
class TerraHistoricusSource extends ComicSource {
    config = {"name":"泰拉记事社","baseUrl":"https://comic.hypergryph.com","topics":["terra-historicus","talos-ii-historicus"],"key":"terrahistoricus","version":"1.0.1","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/terrahistoricus.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;

    topicName(topic) {
        if (topic === "terra-historicus") return "泰拉";
        if (topic === "talos-ii-historicus") return "塔卫二";
        return topic;
    }

    async getData(route) {
        const response = await Network.get(this.config.baseUrl + route, {
            "Accept": "application/json",
            "Referer": this.config.baseUrl + "/",
            "cache-time": "no",
        });
        if (!response || response.error) throw new Error("连接漫画官网失败，请重试。");
        if (response.status !== 200) throw new Error("漫画官网返回 HTTP " + response.status);
        let result;
        try {
            result = JSON.parse(response.body);
        } catch (_) {
            throw new Error("漫画官网未返回 JSON 数据。");
        }
        if (result?.code !== 0 || result.data == null) throw new Error("漫画官网未提供此项数据。");
        return result.data;
    }

    imageUrl(value) {
        return typeof value === "string" &&
            /^https:\/\/(?:[a-z0-9-]+\.)*hycdn\.cn\/[^\s]+$/i.test(value) ? value : "";
    }

    validId(value) {
        return typeof value === "string" && /^[A-Za-z0-9_-]{1,80}$/.test(value);
    }

    parseId(id) {
        const [topic, cid, extra] = String(id).split(":");
        if (!this.config.topics.includes(topic) || !this.validId(cid) || extra !== undefined) {
            throw new Error("作品标识无效，请刷新漫画列表。");
        }
        return { topic, cid };
    }

    async list(topic, recent = false) {
        if (!this.config.topics.includes(topic)) throw new Error("未知的官网分区。");
        const rows = await this.getData((recent ? "/api/recentUpdate" : "/api/comic") + "?topicKey=" + topic);
        if (!Array.isArray(rows)) throw new Error("官网作品列表格式已变化。");
        const comics = [];
        const seen = new Set();
        for (const row of rows) {
            const cid = recent ? row?.comicCid : row?.cid;
            if (!this.validId(cid) || typeof row.title !== "string" || !row.title.trim()) continue;
            if (seen.has(cid)) continue;
            seen.add(cid);
            comics.push(new Comic({
                id: topic + ":" + cid,
                title: row.title,
                subtitle: recent ? row.episodeShortTitle || "" : row.subtitle || "",
                cover: this.imageUrl(recent ? row.coverUrl : row.cover),
            }));
        }
        if (rows.length && !comics.length) throw new Error("官网返回的作品缺少有效标识。");
        return comics;
    }

    async sections(recent) {
        const groups = await Promise.all(this.config.topics.map(async topic => [
            this.topicName(topic), await this.list(topic, recent),
        ]));
        return Object.fromEntries(groups);
    }

    explore = [
        { title: this.name, type: "singlePageWithMultiPart", load: () => this.sections(false) },
        { title: this.name + " · 最近更新", type: "singlePageWithMultiPart", load: () => this.sections(true) },
    ];

    category = {
        title: this.name,
        parts: [{
            name: "官网分区",
            type: "fixed",
            categories: this.config.topics.map(topic => this.topicName(topic)),
            categoryParams: this.config.topics,
            itemType: "category",
        }],
    };

    categoryComics = {
        load: async (_category, topic, _options, page) => ({
            comics: page === 1 ? await this.list(topic) : [],
            maxPage: 1,
        }),
    };

    search = {
        load: async (keyword, _options, page) => {
            if (page > 1) return { comics: [], maxPage: 1 };
            const query = String(keyword || "").trim().toLowerCase();
            const lists = await Promise.all(this.config.topics.map(topic => this.list(topic)));
            return { comics: lists.flat().filter(row => row.title.toLowerCase().includes(query)), maxPage: 1 };
        },
    };

    chapterTitle(episode) {
        const type = { 2: "番外", 3: "贺图", 4: "公告" }[episode.type];
        return [type || episode.shortTitle, episode.title].filter(Boolean).join(" ").trim();
    }

    episodeRoute(id, epId) {
        const { cid } = this.parseId(id);
        const ep = String(epId);
        if (!ep.startsWith("ep_") || !this.validId(ep.slice(3))) {
            throw new Error("章节标识无效，请重新打开目录。");
        }
        return "/api/comic/" + cid + "/episode/" + ep.slice(3);
    }

    async pageConfig(route, refresh = false) {
        const page = await this.getData(route + (refresh ? "&_=" + Date.now() : ""));
        const url = this.imageUrl(page?.url);
        if (!url) throw new Error("官网未提供可用的图片地址。");
        return { url, headers: { Referer: this.config.baseUrl + "/" } };
    }

    comic = {
        loadInfo: async id => {
            const { topic, cid } = this.parseId(id);
            const data = await this.getData("/api/comic/" + cid);
            if (data.cid !== cid || typeof data.title !== "string" || !Array.isArray(data.episodes)) {
                throw new Error("官网作品详情或章节目录格式已变化。");
            }
            const chapters = {};
            // The upstream catalogue is newest first. Venera's next chapter follows insertion order.
            for (const episode of data.episodes.slice().reverse()) {
                if (!this.validId(episode?.cid)) throw new Error("目录含无效章节标识。");
                const key = "ep_" + episode.cid;
                if (Object.hasOwn(chapters, key)) throw new Error("目录含重复章节标识。");
                chapters[key] = this.chapterTitle(episode) || episode.cid;
            }
            const tags = {};
            if (Array.isArray(data.authors)) tags["作者"] = data.authors.filter(value => typeof value === "string");
            if (Array.isArray(data.keywords)) tags["标签"] = data.keywords.filter(value => typeof value === "string");
            const date = new Date(Number(data.updateTime) * 1000);
            return new ComicDetails({
                title: data.title,
                subtitle: data.subtitle || "",
                cover: this.imageUrl(data.cover),
                description: data.introduction || "",
                tags,
                chapters,
                updateTime: Number(data.updateTime) > 0 && Number.isFinite(date.getTime()) ? date.toISOString() : undefined,
                url: this.config.baseUrl + "/" + topic + "/comic/" + cid,
            });
        },
        loadEp: async (id, epId) => {
            const route = this.episodeRoute(id, epId);
            const episode = await this.getData(route);
            const pages = episode?.pageInfos;
            if (!Array.isArray(pages) || !pages.length) throw new Error("官网未提供该章节的图片清单。");
            return { images: pages.map((_, index) => this.config.baseUrl + route + "/page?pageNum=" + (index + 1)) };
        },
        onImageLoad: async (imageKey, id, epId) => {
            const prefix = this.episodeRoute(id, epId) + "/page?pageNum=";
            const route = String(imageKey).slice(this.config.baseUrl.length);
            if (imageKey !== this.config.baseUrl + route ||
                !route.startsWith(prefix) || !/^[1-9]\d*$/.test(route.slice(prefix.length))) {
                throw new Error("正文页地址与当前章节不匹配。");
            }
            const config = await this.pageConfig(route);
            // Only refresh the official image link once if the initial download fails.
            config.onLoadFailed = () => this.pageConfig(route, true);
            return config;
        },
    };
}
