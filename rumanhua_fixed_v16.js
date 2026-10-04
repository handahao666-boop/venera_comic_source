class RuManHua extends ComicSource {
    name = "如漫画"
    key = "rumanhua_fixed_v15"
    version = "1.2.8"
    minAppVersion = "1.0.0"
    url = ""

    settings = {
        image_quality: {
            title: "图片质量",
            type: "select",
            options: [
                { value: "default", text: "默认" }
            ],
            default: "default",
        }
    }

    toFormData(obj) {
        return Object.keys(obj).map(key => encodeURIComponent(key) + '=' + encodeURIComponent(obj[key])).join('&');
    }

    // ==================================================
    // 章节顺序归一化（v1.2.8）
    // ==================================================
    // 真网实测（2026-10-04）：如漫画的章节列表**本身就是倒序**（最新话在前），
    // 详情页 `.chapterlistload ul a` 28 条 + morechapter 接口 607 条，全部是降序：
    //   详情页：第2季162话 → 161话 → 160话 → …（第2季141话）
    //   morechapter：第2季140话 → … → 第1话
    // 而 Venera 的「下一章」= 章节在列表里的下标 +1
    // （lib/pages/reader/reader.dart: toNextChapter() -> toChapter(chapter + 1)），
    // 所以倒序列表会让「下一章」跳到上一话 —— 与动漫屋 dm5 v7.0.3 是同一个病。
    //
    // 处理策略与 dm5 保持一致：**只在检测到主序列确实是倒序时才重排**，
    // 主序列按「季/卷号 + 话号」升序，其余条目（番外、公告、活动等）保持
    // 站点原有相对顺序接在最后。
    parseChapterKey(title) {
        const text = String(title == null ? "" : title);

        // 本站标题写法很乱，实测同一部作品（斗破苍穹 681 条）里同时存在四种：
        //   「第131回 卑鄙的联手 下」 / 「386回 盟主的责任」 / 「130 下」 / 「321 大补方」
        // 所以：①「第」做成可选；②补一条"纯数字开头"的规则，否则老章节会被当成
        // 番外/公告排到末尾。
        const chapterMatch = text.match(
            /(?:第\s*)?(\d+(?:\.\d+)?)\s*(?:话|話|回|集|章|節|节)/
        );

        const volumeMatch = text.match(/第\s*(\d+(?:\.\d+)?)\s*(?:季|卷|冊|册)/);

        if (chapterMatch) {
            return {
                series: "chapter",
                volume: volumeMatch ? parseFloat(volumeMatch[1]) : 0,
                number: parseFloat(chapterMatch[1])
            };
        }

        // 纯数字开头（数字后面必须是空格/括号/结尾，避免把「3月15日延更公告」
        // 这类当章节；「118（上)」这种括号写法确实存在，所以括号也放行）
        const bareMatch = text.match(/^\s*(\d+(?:\.\d+)?)(?=[\s（(]|$)/);

        if (bareMatch) {
            return {
                series: "chapter",
                volume: 0,
                number: parseFloat(bareMatch[1])
            };
        }

        if (volumeMatch) {
            return {
                series: "volume",
                volume: 0,
                number: parseFloat(volumeMatch[1])
            };
        }

        return null;
    }

    normalizeChapterOrder(chapters) {
        const items = [];

        let position = 0;

        for (const entry of chapters.entries()) {
            items.push({
                href: entry[0],
                title: entry[1],
                position: position++,
                key: this.parseChapterKey(entry[1])
            });
        }

        const groups = {};

        for (const item of items) {
            if (!item.key) continue;
            if (!groups[item.key.series]) groups[item.key.series] = [];
            groups[item.key.series].push(item);
        }

        let mainSeries = null;

        for (const name of Object.keys(groups)) {
            if (!mainSeries || groups[name].length > groups[mainSeries].length) {
                mainSeries = name;
            }
        }

        // 样本太少就不动，避免误判
        if (!mainSeries || groups[mainSeries].length < 3) {
            return chapters;
        }

        const mainItems = groups[mainSeries];

        const first = mainItems[0].key;

        const last = mainItems[mainItems.length - 1].key;

        const descending =
            first.volume > last.volume ||
            (first.volume === last.volume && first.number > last.number);

        // 已经是正序 —— 原样返回
        if (!descending) {
            return chapters;
        }

        const sorted = mainItems.slice().sort((a, b) => {
            if (a.key.volume !== b.key.volume) {
                return a.key.volume - b.key.volume;
            }
            if (a.key.number !== b.key.number) {
                return a.key.number - b.key.number;
            }
            return a.position - b.position;
        });

        const ordered = new Map();

        for (const item of sorted) {
            ordered.set(item.href, item.title);
        }

        for (const item of items) {
            if (item.key && item.key.series === mainSeries) continue;
            ordered.set(item.href, item.title);
        }

        return ordered;
    }

    explore = [
        {
            title: "如漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                try {
                    const res = await Network.get("http://www.rumanhua2.com/", {});
                    if (!res || !res.body) return {};
                    const doc = new HtmlDocument(res.body);
                    const sections = doc.querySelectorAll('.view-item');
                    const result = {};
                    for (const section of sections) {
                        const head = section.querySelector('.item-title');
                        if (!head) continue;
                        const title = head.text.trim();
                        const comics = [];
                        const items = section.querySelectorAll('.col-auto');
                        for (const item of items) {
                            const a = item.querySelector('a');
                            const img = item.querySelector('img');
                            const titleEl = item.querySelector('.e-title');
                            if (!a) continue;
                            
                            comics.push(new Comic({
                                id: a.attributes.href.replace(/\//g, ''),
                                title: titleEl ? titleEl.text.trim() : (a.attributes.title || ""),
                                cover: img?.attributes['data-src'] || img?.attributes['data-original'] || img?.attributes.src || "",
                                subTitle: item.querySelector('.tip')?.text.trim() || ""
                            }));
                        }
                        if (comics.length > 0) {
                            result[title] = comics;
                        }
                    }
                    doc.dispose();
                    return result;
                } catch (e) {
                    return {};
                }
            }
        }
    ]

    category = {
        title: "如漫画",
        parts: [
            {
                name: "题材",
                type: "fixed",
                categories: ["冒险", "热血", "都市", "玄幻", "悬疑", "耽美", "恋爱", "生活", "搞笑", "穿越", "修真", "后宫", "女主", "古风", "连载", "完结"],
                categoryParams: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "13", "14", "15", "16"],
                itemType: "category"
            }
        ],
        enableRankingPage: false
    }

    categoryComics = {
        load: async (category, param, options, page) => {
            try {
                const res = await Network.get(`http://www.rumanhua2.com/sort/${param}`, {});
                if (!res || !res.body) return { comics: [], maxPage: page };
                
                const doc = new HtmlDocument(res.body);
                const items = doc.querySelectorAll('.likedata');
                const comics = [];
                for (const item of items) {
                    const a = item.querySelector('.likeimg a');
                    const img = item.querySelector('img');
                    const titleEl = item.querySelector('.le-t');
                    if (!a) continue;
                    
                    comics.push(new Comic({
                        id: a.attributes.href.replace(/\//g, ''),
                        title: titleEl ? titleEl.text.trim() : (a.attributes.title || ""),
                        cover: img?.attributes['data-src'] || img?.attributes['data-original'] || img?.attributes.src || "",
                        subTitle: item.querySelector('.le-j')?.text.trim() || ""
                    }));
                }
                doc.dispose();
                return { comics: comics, maxPage: page };
            } catch (e) {}
            return { comics: [], maxPage: page };
        }
    }

    search = {
        load: async (keyword, options, page) => {
            try {
                let res = await Network.post(`http://www.rumanhua2.com/s`, {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }, Convert.encodeUtf8(this.toFormData({ k: keyword })));
                
                if (res && res.body) {
                    const doc = new HtmlDocument(res.body);
                    const items = doc.querySelectorAll('.col-auto');
                    const comics = [];
                    for (const item of items) {
                        const a = item.querySelector('a');
                        const img = item.querySelector('img');
                        const titleEl = item.querySelector('.e-title');
                        if (!a) continue;
                        
                        comics.push(new Comic({
                            id: a.attributes.href.replace(/\//g, ''),
                            title: titleEl ? titleEl.text.trim() : (a.attributes.title || ""),
                            cover: img?.attributes['data-src'] || img?.attributes['data-original'] || img?.attributes.src || "",
                            subTitle: item.querySelector('.tip')?.text.trim() || ""
                        }));
                    }
                    doc.dispose();
                    return { comics: comics, maxPage: 1 };
                }
            } catch (e) {}
            return { comics: [], maxPage: 1 };
        }
    }

    comic = {
        loadInfo: async (id) => {
            try {
                const cleanId = id.replace(/\//g, '');
                const res = await Network.get(`http://www.rumanhua2.com/${cleanId}/`, {});
                if (!res || !res.body) throw "Empty response";
                const doc = new HtmlDocument(res.body);
                
                const titleEl = doc.querySelector('h1.name') || doc.querySelector('h1');
                const title = titleEl ? titleEl.text.trim() : "";
                
                const ogImage = doc.querySelector('meta[property="og:image"]');
                const cover = ogImage ? ogImage.attributes.content : "";
                
                const descEl = doc.querySelector('.comic-intro') || doc.querySelector('.detail-desc');
                const description = descEl ? descEl.text.trim() : "";
                
                const tags = {};
                const tagEls = doc.querySelectorAll('.comic-info-detail a') || doc.querySelectorAll('.detail-info a');
                if (tagEls.length > 0) {
                    tags["标签"] = tagEls.map(el => el.text.trim());
                }

                const chapters = new Map();
                // v1.2.7 修复「章节不更新 / 比原站少十几话」：
                // 站点详情页的真实结构是 <div class="chapterList"><div class="chapterlistload"><ul>
                //   <a href="/{id}/{chapterid}.html"><li>标题</li></a> …
                // 注意 <a> 包着 <li>（不是 li 包 a），所以旧选择器 .chaplist-box ul li a / .view-ul li a
                // 在站上一个都匹配不到；而 querySelectorAll 返回空数组是 truthy，|| 后面的分支也永远不会执行。
                // 结果就是详情页上最新的那几十话（约 29 话）全部丢失，只剩 morechapter 接口返回的旧章节，
                // 表现为「比原站少十几话、也不会自动更新新章节」。
                let chapterEls = doc.querySelectorAll('.chapterlistload ul a');
                if (chapterEls.length === 0) chapterEls = doc.querySelectorAll('.chapterlistload a');
                if (chapterEls.length === 0) chapterEls = doc.querySelectorAll('.chaplist-box ul a');
                if (chapterEls.length === 0) chapterEls = doc.querySelectorAll('.view-ul li a');
                if (chapterEls.length === 0) chapterEls = doc.querySelectorAll('.chapterList a[href*=".html"]');
                for (const el of chapterEls) {
                    const href = el.attributes.href;
                    const chapterTitle = el.text.trim();
                    if (href && href.includes('.html')) {
                        chapters.set(href, chapterTitle);
                    }
                }

                // 「更多话」按钮：本站是 .chaplist-more，另加 .chapterList 里的按钮兜底
                const moreBtn = doc.querySelector('.chaplist-more') || doc.querySelector('.chaplist-box button') || doc.querySelector('.chapterList button');
                if (moreBtn) {
                    try {
                        const moreRes = await Network.post(`http://www.rumanhua2.com/morechapter`, {
                            'Content-Type': 'application/x-www-form-urlencoded'
                        }, Convert.encodeUtf8(this.toFormData({ id: cleanId })));
                        if (moreRes && moreRes.body) {
                            const moreRet = JSON.parse(moreRes.body);
                            if (moreRet.code == "200") {
                                for (const item of moreRet.data) {
                                    const href = `/${cleanId}/${item.chapterid}.html`;
                                    chapters.set(href, item.chaptername);
                                }
                            }
                        }
                    } catch (e) {}
                }

                doc.dispose();
                // v1.2.8：站点章节列表是倒序（最新话在前），Venera 的「下一章」= 下标 +1，
                // 会跳成上一话；这里只在检测到主序列倒序时重排为升序（详见上面的归一化说明）。
                return new ComicDetails({
                    title: title,
                    cover: cover,
                    description: description,
                    tags: tags,
                    chapters: this.normalizeChapterOrder(chapters)
                });
            } catch (e) {
                return new ComicDetails({ title: "加载失败", chapters: new Map() });
            }
        },

        loadEp: async (comicId, epId) => {
            try {
                let rawEpId = String(epId ?? "").trim();
                if (!rawEpId) return { images: [] };
                rawEpId = rawEpId.replace(/&amp;/g, "&");
                // 历史记录可能保存为完整 URL；只保留本站路径，避免拼接成 http://host/http://...
                const absolutePath = rawEpId.match(/^https?:\/\/[^/]+(\/.*)$/i);
                if (absolutePath) rawEpId = absolutePath[1];
                try { rawEpId = decodeURIComponent(rawEpId); } catch (e) {}
                rawEpId = rawEpId.split("#")[0];
                rawEpId = rawEpId.replace(/^\/+/, "");

                // 某些历史数据只保存 vaMvECRF.html，此时用 comicId 补回漫画目录。
                if (!rawEpId.includes("/") && comicId) {
                    let rawComicId = String(comicId).trim().replace(/^\/+|\/+$/g, "");
                    const comicPath = rawComicId.match(/^https?:\/\/[^/]+(\/.*)$/i);
                    if (comicPath) rawComicId = comicPath[1].replace(/^\/+|\/+$/g, "");
                    if (rawComicId && !rawComicId.includes("/")) rawEpId = `${rawComicId}/${rawEpId}`;
                }
                if (!rawEpId || rawEpId.includes("//") || /^https?:/i.test(rawEpId)) return { images: [] };

                const res = await Network.get(`http://www.rumanhua2.com/${rawEpId}`, {});
                const body = String(res.body || "");
                if (!body) return { images: [] };

                let encodedData = "";
                let keyIndex = -1;
                
                const packedMatches = body.match(/eval\(function\(p,a,c,k,e,d\)[\s\S]+?\}\(([\s\S]+?)\)\)/g);
                if (packedMatches) {
                    for (const packed of packedMatches) {
                        try {
                            const unpacked = this.comic.unpackJS(packed);
                            const dataMatch = unpacked.match(/__c0rst96\s*=\s*\\?["'](.*?)\\?["']/);
                            if (dataMatch && dataMatch[1].length > 500) {
                                encodedData = dataMatch[1].replace(/\\/g, '');
                            }
                            const keyMatch = unpacked.match(/_0x3d1d18\[(\d+)\]/);
                            if (keyMatch) {
                                keyIndex = parseInt(keyMatch[1]);
                            }
                        } catch (err) {}
                    }
                }

                if (!encodedData) {
                    const varMatch = body.match(/__c0rst96\s*=\s*["']([^"']+)["']/);
                    if (varMatch && varMatch[1].length > 500) {
                        encodedData = varMatch[1];
                    }
                }

                const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
                const decode = (str) => {
                    let output = [];
                    let i = 0;
                    while (i < str.length) {
                        let enc1 = alphabet.indexOf(str.charAt(i++));
                        let enc2 = alphabet.indexOf(str.charAt(i++));
                        let enc3 = alphabet.indexOf(str.charAt(i++));
                        let enc4 = alphabet.indexOf(str.charAt(i++));
                        let res = (enc1 << 18) | (enc2 << 12) | (enc3 << 6) | enc4;
                        output.push((res >> 16) & 0xff);
                        if (enc3 !== 64 && enc3 !== -1) {
                            output.push((res >> 8) & 0xff);
                            if (enc4 !== 64 && enc4 !== -1) {
                                output.push(res & 0xff);
                            }
                        }
                    }
                    return output;
                };

                const dataBytes = decode(encodedData);
                const keys = ["smkhy258", "smkd95fv", "md496952", "cdcsdwq", "vbfsa256", "cawf151c", "cd56cvda", "8kihnt9", "dso15tlo", "5ko6plhy"];
                
                let tryIndices = [];
                if (keyIndex !== -1) tryIndices.push(keyIndex);
                const idMatch = body.match(/data-id\s*=\s*["'](\d+)["']/);
                if (idMatch) tryIndices.push(parseInt(idMatch[1]));
                for (let i = 0; i < keys.length; i++) {
                    if (!tryIndices.includes(i)) tryIndices.push(i);
                }

                for (let idx of tryIndices) {
                    const keyStr = keys[idx] || keys[0];
                    let xored = new Uint8Array(dataBytes.length);
                    for (let i = 0; i < dataBytes.length; i++) {
                        xored[i] = dataBytes[i] ^ keyStr.charCodeAt(i % keyStr.length);
                    }
                    
                    let xoredStr = "";
                    for(let i=0; i<xored.length; i++) xoredStr += String.fromCharCode(xored[i]);
                    
                    const jsonBytes = decode(xoredStr);
                    let jsonStr = "";
                    try {
                        const buffer = new Uint8Array(jsonBytes).buffer;
                        jsonStr = Convert.decodeUtf8(buffer);
                    } catch(e) {
                        for(let i=0; i<jsonBytes.length; i++) jsonStr += String.fromCharCode(jsonBytes[i]);
                    }
                    
                    if (jsonStr.includes("http")) {
                        try {
                            const images = JSON.parse(jsonStr);
                            if (Array.isArray(images) && images.length > 0) {
                                return { images: [...new Set(images)] };
                            }
                        } catch(e) {}
                    }
                }

                const doc = new HtmlDocument(body);
                const imgs = doc.querySelectorAll('.chapter-img-box img');
                const images = [];
                for (const img of imgs) {
                    const src = img.attributes['data-src'] || img.attributes['data-original'] || img.attributes.src;
                    if (src && src.startsWith('http')) images.push(src);
                }
                doc.dispose();
                if (images.length > 0) return { images: [...new Set(images)] };

                return { images: [] };

            } catch (err) {
                return { images: [] };
            }
        },

        unpackJS: (packed) => {
            try {
                const match = packed.match(/}\('([\s\S]+?)',\s*(\d+),\s*(\d+),\s*'([\s\S]+?)'\.split\('\|'\)/);
                if (!match) return packed;
                let [_, p, a, c, k] = match;
                a = parseInt(a); c = parseInt(c); k = k.split('|');
                const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
                const d = {};
                const e = (c) => (c < a ? '' : e(parseInt(c / a))) + ((c = c % a) > 35 ? String.fromCharCode(c + 29) : c.toString(36));
                while (c--) {
                    const key = e(c);
                    d[key] = k[c] || key;
                }
                return p.replace(/\b\w+\b/g, (w) => d[w] || w);
            } catch (err) { return packed; }
        }
    }
}
