class RuManHua extends ComicSource {
    name = "如漫画"
    key = "rumanhua_fixed_v15"
    version = "1.2.6"
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
                const chapterEls = doc.querySelectorAll('.chaplist-box ul li a') || doc.querySelectorAll('.view-ul li a');
                for (const el of chapterEls) {
                    const href = el.attributes.href;
                    const chapterTitle = el.text.trim();
                    if (href && href.includes('.html')) {
                        chapters.set(href, chapterTitle);
                    }
                }

                const moreBtn = doc.querySelector('.chaplist-box button') || doc.querySelector('.chaplist-more');
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
                return new ComicDetails({
                    title: title,
                    cover: cover,
                    description: description,
                    tags: tags,
                    chapters: chapters
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
