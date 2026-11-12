// SPDX-License-Identifier: Apache-2.0
// Based on the Keiyoushi contributors' Mihon extension.
// https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/all/comicfury
class ComicFuryChineseSource extends ComicSource {
    config = {"name":"Comic Fury 中文","baseUrl":"https://comicfury.com","key":"comicfury","version":"1.0.0","updateUrl":"https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/comicfury.js"};
    name = this.config.name;
    key = this.config.key;
    version = this.config.version;
    minAppVersion = "1.6.3";
    url = this.config.updateUrl;

    async document(path, callback) {
        const response = await Network.get(this.config.baseUrl + path, { "cache-time": "no" });
        if (!response || response.error) throw new Error("Comic Fury 连接失败。");
        if (response.status !== 200) throw new Error("Comic Fury 返回 HTTP " + response.status);
        const doc = new HtmlDocument(response.body);
        try {
            if (/Content Warning/i.test(doc.querySelector("title")?.text || "")) {
                throw new Error("此作品有原站内容提示，请在官网查看。");
            }
            return callback(doc);
        } finally { doc.dispose(); }
    }

    slug(raw) {
        if (!/^[a-z0-9-]{1,96}$/i.test(String(raw || ""))) throw new Error("Comic Fury 作品编号无效。");
        return raw;
    }

    path(href) {
        return String(href || "").replace(/^https:\/\/comicfury\.com(?=\/)/i, "");
    }

    image(value) {
        if (typeof value !== "string") return "";
        if (/^https?:\/\/[a-z0-9.-]+\/[^\s]+$/i.test(value)) return value;
        if (/^\/\/[a-z0-9.-]+\/[^\s]+$/i.test(value)) return "https:" + value;
        return /^\/(?!\/)[^\s]+$/.test(value) ? this.config.baseUrl + value : "";
    }

    list(page, sort, keyword = "", tag = "") {
        const query = tag ? "vr=1&combinedquery=" + encodeURIComponent("#" + tag) : "query=" + encodeURIComponent(keyword);
        const route = "/search.php?" + query + "&page=" + page + "&language=zh&sort=" + sort;
        return this.document(route, doc => {
            const comics = new Map();
            for (const item of doc.querySelectorAll(".webcomic-result")) {
                const avatar = item.querySelector(".webcomic-result-avatar a");
                const id = this.path(avatar?.attributes.href).match(/^\/comicprofile\.php\?url=([a-z0-9-]{1,96})$/i)?.[1];
                const text = item.querySelector(".webcomic-result-title");
                const title = text?.attributes.title || text?.text.trim();
                const cover = this.image(avatar?.querySelector("img")?.attributes.src);
                if (id && title && !comics.has(id)) comics.set(id, new Comic({ id, title, cover }));
            }
            const hasNext = doc.querySelector("span.vfpagecurrent + a.vfpage, .search-next-page");
            return { comics: [...comics.values()], maxPage: comics.size && hasNext ? page + 1 : page };
        });
    }

    explore = [
        { title: this.name, type: "multiPageComicList", load: page => this.list(page, 1) },
        { title: this.name + " · 最近更新", type: "multiPageComicList", load: page => this.list(page, 2) },
    ];

    genres = { "奇幻": "fantasy", "剧情": "drama", "喜剧": "comedy", "日常": "gagaday" };
    category = { title: this.name, parts: [{
        name: "中文作品题材", type: "fixed", itemType: "category",
        categories: Object.keys(this.genres), categoryParams: Object.values(this.genres),
    }] };
    categoryComics = { load: (_category, tag, _options, page) => {
        if (!Object.values(this.genres).includes(tag)) throw new Error("题材无效。");
        return this.list(page, 2, "", tag);
    } };
    search = { load: (keyword, _options, page) => this.list(page, 0, String(keyword || "").trim()) };

    archivePage(path, slug) {
        return this.document(path, doc => {
            const prefix = "/read/" + slug;
            const groups = [];
            const entries = [];
            for (const link of doc.querySelectorAll("a[href]")) {
                const href = this.path(link.attributes.href);
                if (!href.startsWith(prefix + "/")) continue;
                const route = href.slice(prefix.length);
                const group = link.querySelector(".archive-chapter-title, .archive-chapter")?.text.trim();
                if (group && /^\/archive\/chapter\/\d+\/?$/.test(route)) groups.push({ path: href, name: group });
                const title = link.querySelector(".archive-comic-title")?.text.trim();
                const id = route.match(/^\/comics\/(\d+)\/?$/)?.[1];
                if (title && id) entries.push({ id, title });
            }
            let next = this.path(doc.querySelector("span.vfpagecurrent + a.vfpage")?.attributes.href);
            if (!next.startsWith(prefix + "/archive") || !/^[-a-z0-9_/=?&]+$/i.test(next)) next = "";
            return { groups, entries, next };
        });
    }

    async collect(start, slug) {
        const entries = [...start.entries];
        const visited = new Set();
        let next = start.next;
        while (next) {
            if (visited.has(next)) throw new Error("原站存档分页重复。");
            visited.add(next);
            const page = await this.archivePage(next, slug);
            entries.push(...page.entries);
            next = page.next;
        }
        return entries;
    }

    async chapters(slug) {
        const start = await this.archivePage("/read/" + slug + "/archive", slug);
        const items = await this.collect(start, slug);
        for (let index = 0; index < start.groups.length; index += 3) {
            const batch = await Promise.all(start.groups.slice(index, index + 3).map(async group => {
                const page = await this.archivePage(group.path, slug);
                return (await this.collect(page, slug)).map(row => ({ ...row, title: group.name + " · " + row.title }));
            }));
            items.push(...batch.flat());
        }
        const chapters = {};
        for (const item of items) if (!Object.hasOwn(chapters, "ep_" + item.id)) chapters["ep_" + item.id] = item.title;
        if (!Object.keys(chapters).length) throw new Error("原站未开放可读取的漫画存档。");
        return chapters;
    }

    comic = {
        loadInfo: async rawId => {
            const slug = this.slug(rawId);
            const path = "/comicprofile.php?url=" + slug;
            const profile = await this.document(path, doc => {
                const title = doc.querySelector("title")?.text.split(" - Webcomic profile")[0].trim();
                if (!title) throw new Error("Comic Fury 详情格式已变化。");
                const cover = this.image(doc.querySelector(".profile-avatar img")?.attributes.src);
                const tagNode = doc.querySelector(".description-tags");
                const genre = tagNode?.querySelectorAll("a").map(node => node.text.trim()).filter(Boolean) || [];
                const author = doc.querySelectorAll(".pcleft-user img").map(node => node.attributes.alt).filter(Boolean);
                const description = (tagNode?.parent?.text || "").replace(tagNode?.text || "", "").trim();
                return { title, cover, description, tags: { "题材": genre, "作者": [...new Set(author)] } };
            });
            return new ComicDetails({ ...profile, chapters: await this.chapters(slug), url: this.config.baseUrl + path });
        },
        loadEp: (rawId, episode) => {
            const slug = this.slug(rawId);
            const id = String(episode || "").match(/^ep_(\d{1,16})$/)?.[1];
            if (!id) throw new Error("章节编号无效。");
            return this.document("/read/" + slug + "/comics/" + id, doc => {
                const block = doc.querySelector("#comic-" + id);
                const nodes = block?.querySelectorAll(".is--image-segment img") || doc.querySelectorAll("#comicimage");
                const images = nodes.map(node => this.image(node.attributes.src)).filter(Boolean);
                if (!images.length) throw new Error("原站未返回公开漫画图片。");
                return { images };
            });
        },
    };
}
