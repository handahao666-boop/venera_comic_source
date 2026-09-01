class CopyManga extends ComicSource {
    name = "拷贝漫画"
    key = "copy_manga"
    version = "1.6.6"
    minAppVersion = "1.6.0"
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/copy_manga.js"

    //====修改====【新增自动重置设备指纹函数】
    /**
     * 重置设备指纹：删除本地持久化存储，下一次读取headers getter自动生成全新设备信息
     */
    autoResetDeviceFingerprint() {
        // 记录刚用过的指纹，下次生成时优先避开，避免放回式抽取连续撞同一设备
        const oldInfo = this.loadData("_deviceinfo");
        const oldDev = this.loadData("_device");
        this.deleteData("_deviceinfo");
        this.deleteData("_device");
        this.deleteData("_pseudoid");
        this.deleteData("_virtual_ip");
        if (oldInfo) this.saveData("_exclude_deviceinfo", oldInfo);
        if (oldDev) this.saveData("_exclude_device", oldDev);
        this.refreshAppApi();
    }
    /**
     * 记录本会话内被风控(210)的设备指纹，后续生成时优先排除，池子用尽才允许复用
     */
    loadBlockedDevices() {
        let raw = this.loadData("_blocked_deviceinfos");
        if (Array.isArray(raw)) return raw;
        try {
            return JSON.parse(raw || "[]");
        } catch (e) {
            return [];
        }
    }
    saveBlockedDevices(list) {
        this.saveData("_blocked_deviceinfos", JSON.stringify(list.slice(-30)));
    }
    markDeviceBlocked() {
        const cur = this.loadData("_deviceinfo");
        if (!cur) return;
        const list = this.loadBlockedDevices();
        if (!list.includes(cur)) {
            list.push(cur);
            this.saveBlockedDevices(list);
        }
    }
    /**
     * 从指纹池挑选新设备：排除刚用过的 + 本会话被封过的；全部被排除时降级回退
     */
    pickDeviceItem() {
        const excludeInfo = this.loadData("_exclude_deviceinfo");
        const blocked = this.loadBlockedDevices();
        let pool = CopyManga.realDevicePool;
        let candidates = pool.filter(item =>
            item.deviceinfo !== excludeInfo && !blocked.includes(item.deviceinfo)
        );
        if (candidates.length === 0) {
            candidates = pool.filter(item => item.deviceinfo !== excludeInfo);
        }
        if (candidates.length === 0) {
            candidates = pool;
        }
        return candidates[Math.floor(Math.random() * candidates.length)];
    }
    //====结束修改====

    // 高级节流与随机抖动控制（模拟真人阅读防范应用层风控）
    async throttle() {
        let lastReq = this.loadData("_last_req_time") || 0;
        let now = Date.now();
        let diff = now - parseInt(lastReq);
        // 动态随机延迟 600ms - 1200ms，避开固定频率特征检测
        let targetDelay = 600 + Math.floor(Math.random() * 600);
        if (diff < targetDelay) {
            let wait = targetDelay - diff;
            await new Promise((resolve) => setTimeout(resolve, wait));
        }
        this.saveData("_last_req_time", Date.now().toString());
    }
    // 获取动态广告 request_id 绕过校验
    async getReqID() {
        if (this.copyRegion === "0") {
            return "";
        }
        const reqIdUrl = "https://marketing.aiacgn.com/api/v2/adopr/query3/?format=json&ident=200100001";
        let reqId = "";
        try {
            await this.throttle();
            const response = await Network.get(reqIdUrl, this.headers);
            if (response.status === 200) {
                const data = JSON.parse(response.body);
                reqId = data.results.request_id;
            }
        } catch (e) {
        }
        return reqId;
    }
    // 严格对齐官方 3.0.9 App 的 Header 键值顺序及特征
    get headers() {
        let token = this.loadData("token");
        let secret = "M2FmMDg1OTAzMTEwMzJlZmUwNjYwNTUwYTA1NjNhNTM="
        let now = new Date(Date.now());
        let year = now.getFullYear();
        let month = (now.getMonth() + 1).toString().padStart(2, '0');
        let day = now.getDate().toString().padStart(2, '0');
        let ts = Math.floor(now.getTime() / 1000).toString()
        if (!token) {
            token = "";
        } else {
            token = " " + token;
        }
        let sig = Convert.hmacString(
            Convert.decodeBase64(secret),
            Convert.encodeUtf8(ts),
            "sha256"
        )
        // 严格按照官方 App 的 Header 字典键顺序返回，对抗 WAF/TLS 指纹关联审计
        let h = {
            "User-Agent": "COPY/3.0.9",
            "source": "copyApp",
            "deviceinfo": this.deviceinfo,
            "dt": `${year}.${month}.${day}`,
            "platform": "3",
            "referer": "com.copymanga.app-3.0.9",
            "version": "3.0.9",
            "device": this.device,
            "pseudoid": this.pseudoid,
            "Accept": "application/json",
            "region": this.copyRegion,
            "authorization": `Token${token}`,
            "umstring": "b4c89ca4104ea9a97750314d791520ac",
            "x-auth-timestamp": ts,
            "x-auth-signature": sig,
        };
        // 实验性：虚拟IP轮换（X-Forwarded-For/X-Real-IP），默认关闭
        if (this.loadSetting('enable_virtual_ip') === "1") {
            const vip = this.virtualIp;
            if (vip) {
                h["X-Forwarded-For"] = vip;
                h["X-Real-IP"] = vip;
            }
        }
        return h;
    }
    static defaultCopyRegion = "0"
    static defaultImageQuality = "1500"
    static defaultApiUrl = 'api.copy2000.online'
    static searchApi = "/api/kb/web/searchb/comics"
    // 高级真实设备指纹池（模拟主流安卓/iOS机型，避免特征单一）
    static realDevicePool = [
        { deviceinfo: "3371150V-9327", device: "EB0O.675141.548" },
        { deviceinfo: "4482161V-8412", device: "SM-S9180.827361.012" },
        { deviceinfo: "5593272V-7523", device: "23127PN0CC.918234.331" },
        { deviceinfo: "6604383V-6634", device: "V2309A.547182.194" },
        { deviceinfo: "7712265V-3218", device: "SM-S9110.332418.905" },
        { deviceinfo: "8823374V-2564", device: "2201123C.681220.114" },
        { deviceinfo: "9934483V-7412", device: "LIO-AL00.419362.207" },
        { deviceinfo: "1045592V-1856", device: "PHK110.755014.426" },
        { deviceinfo: "2156601V-6639", device: "V2183A.890227.538" },
        { deviceinfo: "3267710V-9475", device: "GX7A4.204516.772" },
        { deviceinfo: "4378829V-3027", device: "SM-A5460.135802.649" },
        { deviceinfo: "5489938V-8145", device: "PJA110.462917.381" }
    ];
    // 真实公网IP池（海外线路）：Cloudflare/Google/Quad9/OpenDNS/Yandex/Verisign 等公开DNS任播地址
    static virtualIpPoolOverseas = [
        "1.1.1.1", "1.0.0.1", "1.1.1.2",
        "8.8.8.8", "8.8.4.4", "8.26.56.26",
        "9.9.9.9", "76.76.2.0",
        "208.67.222.222", "208.67.220.220",
        "77.88.8.8", "64.6.64.6", "91.239.100.100",
        "185.228.168.9", "146.112.61.2", "84.200.69.80"
    ];
    // 真实公网IP池（大陆线路）：114DNS/AliDNS/Baidu/DNSPod/CNNIC 等国内公开DNS地址
    static virtualIpPoolMainland = [
        "114.114.114.114", "114.114.115.115",
        "223.5.5.5", "223.6.6.6",
        "180.76.76.76", "123.125.81.6",
        "119.29.29.29", "1.2.4.8", "210.2.4.8", "101.226.4.6"
    ];
    get deviceinfo() {
        let info = this.loadData("_deviceinfo");
        if (!info) {
            let item = this.pickDeviceItem();
            info = item.deviceinfo;
            this.saveData("_deviceinfo", info);
            this.saveData("_device", item.device);
        }
        return info;
    }
    get device() {
        let dev = this.loadData("_device");
        if (!dev) {
            let item = this.pickDeviceItem();
            dev = item.device;
            this.saveData("_device", dev);
            this.saveData("_deviceinfo", item.deviceinfo);
        }
        return dev;
    }
    get virtualIp() {
        if (this.loadSetting('enable_virtual_ip') !== "1") {
            return "";
        }
        let ip = this.loadData("_virtual_ip");
        if (!ip) {
            const pool = this.copyRegion === "1"
                ? CopyManga.virtualIpPoolMainland
                : CopyManga.virtualIpPoolOverseas;
            ip = pool[Math.floor(Math.random() * pool.length)];
            this.saveData("_virtual_ip", ip);
        }
        return ip;
    }
    get pseudoid() {
        let pid = this.loadData("_pseudoid");
        if (!pid) {
            const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
            pid = '';
            for (let i = 0; i < 16; i++) {
                pid += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            this.saveData("_pseudoid", pid);
        }
        return pid;
    }
    get apiUrl() {
        return `https://${this.loadSetting('base_url')}`
    }
    get copyRegion() {
        return this.loadSetting('region') || this.defaultCopyRegion
    }
    get imageQuality() {
        return this.loadSetting('image_quality') || this.defaultImageQuality
    }
    init() {
        this.author_path_word_dict = {}
        this.refreshSearchApi()
        this.refreshAppApi()
    }
    /// account
    account = {
        login: async (account, pwd) => {
            let salt = Math.floor(1000 + Math.random() * 9000);
            let base64 = Convert.encodeBase64(Convert.encodeUtf8(`${pwd}-${salt}`))
            await this.throttle();
            let res = await Network.post(
                `${this.apiUrl}/api/v3/login`,
                {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8"
                },
                `username=${account}&password=${base64}\n&salt=${salt}&authorization=Token+`
            );
            if (res.status === 200) {
                let data = JSON.parse(res.body)
                let token = data.results.token
                this.saveData('token', token)
                return "ok"
            } else {
                throw `Invalid Status Code ${res.status}`
            }
        },
        logout: () => {
            this.deleteData('token')
        },
        registerWebsite: null
    }
    /// explore pages
    explore = [
        {
            title: "拷贝漫画",
            type: "singlePageWithMultiPart",
            load: async () => {
                //====修改====首页软风控(200+results:null): 重置指纹+等待后重试1次
                let data = null;
                for (let attempt = 0; attempt < 2; attempt++) {
                    await this.throttle();
                    let dataStr = await Network.get(
                        `${this.apiUrl}/api/v3/h5/homeIndex`,
                        this.headers
                    )
                    if (dataStr.status === 210) {
                        throw "210：访问过于频繁，已被官方风控限制，请等待1小时、切换海外线路或尝试点击设置里的“重置设备指纹池”";
                    }
                    if (dataStr.status !== 200) {
                        throw `Invalid status code: ${dataStr.status}`
                    }
                    data = JSON.parse(dataStr.body)
                    if (data && data.results) break;
                    this.autoResetDeviceFingerprint();
                    let waitTime = 10000;
                    console.log(`首页返回空数据(软风控)，等待 ${waitTime / 1000}s 后重试`);
                    await new Promise((resolve) => setTimeout(resolve, waitTime));
                }
                if (!data || !data.results) {
                    throw "首页返回空数据(软风控)，请稍后重试或点击设置里的“重置设备指纹池”";
                }
                //====结束修改====
                function parseComic(comic) {
                    if (comic["comic"] !== null && comic["comic"] !== undefined) {
                        comic = comic["comic"]
                    }
                    let tags = []
                    if (comic["theme"] !== null && comic["theme"] !== undefined) {
                        tags = comic["theme"].map(t => t["name"])
                    }
                    let author = null
                    if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                        author = comic["author"][0]["name"]
                    }
                    return {
                        id: comic["path_word"],
                        title: comic["name"],
                        subTitle: author,
                        cover: comic["cover"],
                        tags: tags
                    }
                }
                let res = {}
                res["推荐"] = data["results"]["recComics"]["list"].map(parseComic)
                res["热门"] = data["results"]["hotComics"].map(parseComic)
                res["最新"] = data["results"]["newComics"].map(parseComic)
                res["完结"] = data["results"]["finishComics"]["list"].map(parseComic)
                res["今日排行"] = data["results"]["rankDayComics"]["list"].map(parseComic)
                res["本周排行"] = data["results"]["rankWeekComics"]["list"].map(parseComic)
                res["本月排行"] = data["results"]["rankMonthComics"]["list"].map(parseComic)
                return res
            }
        }
    ]
    static category_param_dict = {
        "全部": "",
        "愛情": "aiqing",
        "歡樂向": "huanlexiang",
        "冒險": "maoxian",
        "奇幻": "qihuan",
        "百合": "baihe",
        "校园": "xiaoyuan",
        "科幻": "kehuan",
        "東方": "dongfang",
        "耽美": "danmei",
        "生活": "shenghuo",
        "格鬥": "gedou",
        "轻小说": "qingxiaoshuo",
        "悬疑": "xuanyi",
        "其他": "qita",
        "神鬼": "shengui",
        "职场": "zhichang",
        "TL": "teenslove",
        "萌系": "mengxi",
        "治愈": "zhiyu",
        "長條": "changtiao",
        "四格": "sige",
        "节操": "jiecao",
        "舰娘": "jianniang",
        "竞技": "jingji",
        "搞笑": "gaoxiao",
        "伪娘": "weiniang",
        "热血": "rexue",
        "励志": "lizhi",
        "性转换": "xingzhuanhuan",
        "彩色": "COLOR",
        "後宮": "hougong",
        "美食": "meishi",
        "侦探": "zhentan",
        "AA": "aa",
        "音乐舞蹈": "yinyuewudao",
        "魔幻": "mohuan",
        "战争": "zhanzheng",
        "历史": "lishi",
        "异世界": "yishijie",
        "惊悚": "jingsong",
        "机战": "jizhan",
        "都市": "dushi",
        "穿越": "chuanyue",
        "恐怖": "kongbu",
        "C100": "comiket100",
        "重生": "chongsheng",
        "C99": "comiket99",
        "C101": "comiket101",
        "C97": "comiket97",
        "C96": "comiket96",
        "生存": "shengcun",
        "宅系": "zhaixi",
        "武侠": "wuxia",
        "C98": "C98",
        "C95": "comiket95",
        "FATE": "fate",
        "转生": "zhuansheng",
        "無修正": "Uncensored",
        "仙侠": "xianxia",
        "LoveLive": "loveLive"
    }
    category = {
        title: "拷贝漫画",
        parts: [
            {
                name: "拷贝漫画",
                type: "fixed",
                categories: ["排行"],
                categoryParams: ["ranking"],
                itemType: "category"
            },
            {
                name: "主题",
                type: "fixed",
                categories: Object.keys(CopyManga.category_param_dict),
                categoryParams: Object.values(CopyManga.category_param_dict),
                itemType: "category"
            }
        ]
    }
    categoryComics = {
        load: async (category, param, options, page) => {
            let category_url;
            if (category === "排行" || param === "ranking") {
                category_url = `${this.apiUrl}/api/v3/ranks?limit=30&offset=${(page - 1) * 30}&_update=true&type=1&audience_type=${options[0]}&date_type=${options[1]}`
            } else {
                if (category !== undefined && category !== null) {
                    param = CopyManga.category_param_dict[category] || "";
                }
                options = options.map(e => e.replace("*", "-"))
                category_url = `${this.apiUrl}/api/v3/comics?limit=30&offset=${(page - 1) * 30}&ordering=${options[1]}&theme=${param}&top=${options[0]}`
            }
            await this.throttle();
            let res = await Network.get(
                category_url,
                this.headers
            )
            if (res.status === 210) {
                throw "210：访问过于频繁，已被官方风控限制，请等待1小时、切换海外线路或尝试点击设置里的“重置设备指纹池”";
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            let data = JSON.parse(res.body)
            if (!data || !data.results || !Array.isArray(data.results.list)) {
                throw "分类列表返回空数据(软风控)，请稍后重试";
            }
            function parseComic(comic) {
                let sort = null
                let popular = 0
                let rise_sort = 0;
                if (comic["sort"] !== null && comic["sort"] !== undefined) {
                    sort = comic["sort"]
                    rise_sort = comic["rise_sort"]
                    popular = comic["popular"]
                }
                if (comic["comic"] !== null && comic["comic"] !== undefined) {
                    comic = comic["comic"]
                }
                let tags = []
                if (comic["theme"] !== null && comic["theme"] !== undefined) {
                    tags = comic["theme"].map(t => t["name"])
                }
                let author = null
                let author_num = 0
                if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                    author = comic["author"][0]["name"]
                    author_num = comic["author"].length
                }
                if (sort !== null) {
                    return {
                        id: comic["path_word"],
                        title: comic["name"],
                        subTitle: author,
                        cover: comic["cover"],
                        tags: tags,
                        description: `${sort} ${rise_sort > 0 ? '▲' : rise_sort < 0 ? '▽' : '-'}\n` +
                            `${author_num > 1 ? `${author} 等${author_num}位` : author}\n` +
                            `🔥${(popular / 10000).toFixed(1)}W`
                    }
                } else {
                    return {
                        id: comic["path_word"],
                        title: comic["name"],
                        subTitle: author,
                        cover: comic["cover"],
                        tags: tags,
                        description: comic["datetime_updated"]
                    }
                }
            }
            return {
                comics: data["results"]["list"].map(parseComic),
                maxPage: (data["results"]["total"] - (data["results"]["total"] % 21)) / 21 + 1
            }
        },
        optionList: [
            {
                options: [
                    "-全部",
                    "japan-日漫",
                    "korea-韩漫",
                    "west-美漫",
                    "finish-已完结"
                ],
                notShowWhen: null,
                showWhen: Object.keys(CopyManga.category_param_dict)
            },
            {
                options: [
                    "*datetime_updated-时间倒序",
                    "datetime_updated-时间正序",
                    "*popular-热度倒序",
                    "popular-热度正序",
                ],
                notShowWhen: null,
                showWhen: Object.keys(CopyManga.category_param_dict)
            },
            {
                options: [
                    "0-全部",
                    "1-男性向",
                    "2-女性向"
                ],
                notShowWhen: null,
                showWhen: ["排行"]
            },
            {
                options: [
                    "day-日榜",
                    "week-周榜",
                    "month-月榜"
                ],
                notShowWhen: null,
                showWhen: ["排行"]
            }
        ]
    }
    search = {
        load: async (keyword, options, page) => {
            let author;
            if (keyword.startsWith("作者:")) {
                author = keyword.substring("作者:".length).trim();
            }
            let res;
            await this.throttle();
            if (author && author in this.author_path_word_dict) {
                let path_word = encodeURIComponent(this.author_path_word_dict[author]);
                res = await Network.get(
                    `${this.apiUrl}/api/v3/comics?limit=30&offset=${(page - 1) * 30}&ordering=-datetime_updated&author=${path_word}`,
                    this.headers
                )
            } else {
                let q_type = "";
                if (options && options[0]) {
                    q_type = options[0];
                }
                keyword = encodeURIComponent(keyword)
                let search_url = this.loadSetting('search_api') === "webAPI"
                    ? `${this.apiUrl}${CopyManga.searchApi}`
                    : `${this.apiUrl}/api/v3/search/comic`
                res = await Network.get(
                    `${search_url}?limit=30&offset=${(page - 1) * 30}&q=${keyword}&q_type=${q_type}`,
                    this.headers
                )
            }
            if (res.status === 210) {
                throw "210：访问过于频繁，已被官方风控限制，请等待1小时、切换海外线路或尝试点击设置里的“重置设备指纹池”";
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            let data = JSON.parse(res.body)
            if (!data || !data.results || !Array.isArray(data.results.list)) {
                throw "搜索返回空数据(软风控)，请稍后重试";
            }
            function parseComic(comic) {
                if (comic["comic"] !== null && comic["comic"] !== undefined) {
                    comic = comic["comic"]
                }
                let tags = []
                if (comic["theme"] !== null && comic["theme"] !== undefined) {
                    tags = comic["theme"].map(t => t["name"])
                }
                let author = null
                if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                    author = comic["author"][0]["name"]
                }
                return {
                    id: comic["path_word"],
                    title: comic["name"],
                    subTitle: author,
                    cover: comic["cover"],
                    tags: tags,
                    description: comic["datetime_updated"]
                }
            }
            return {
                comics: data["results"]["list"].map(parseComic),
                maxPage: (data["results"]["total"] - (data["results"]["total"] % 21)) / 21 + 1
            }
        },
        optionList: [
            {
                type: "select",
                options: [
                    "-全部",
                    "name-名称",
                    "author-作者",
                    "local-汉化组"
                ],
                label: "搜索选项"
            }
        ]
    }
    favorites = {
        multiFolder: false,
        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            let is_collect = isAdding ? 1 : 0
            let token = this.loadData("token");
            let reqId = await this.getReqID();
            await this.throttle();
            let comicData = await Network.get(
                `${this.apiUrl}/api/v3/comic2/${comicId}?in_mainland=true&request_id=${reqId}&platform=3`,
                this.headers
            )
            if (comicData.status === 210) {
                throw "210：访问过于频繁，已被官方风控限制，请等待1小时、切换海外线路或尝试点击设置里的“重置设备指纹池”";
            }
            if (comicData.status !== 200) {
                throw `Invalid status code: ${comicData.status}`
            }
            let comic_id = JSON.parse(comicData.body).results.comic.uuid
            await this.throttle();
            let res = await Network.post(
                `${this.apiUrl}/api/v3/member/collect/comic`,
                {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
                `comic_id=${comic_id}&is_collect=${is_collect}&authorization=Token+${token}`
            )
            if (res.status === 401) {
                throw `Login expired`;
            }
            if (res.status === 210) {
                throw "210：操作过于频繁，已被官方风控限制，请等待1小时、切换海外线路或尝试点击设置里的“重置设备指纹池”";
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            return "ok"
        },
        loadComics: async (page, folder) => {
            let ordering = this.loadSetting('favorites_ordering') || '-datetime_updated';
            await this.throttle();
            var res = await Network.get(
                `${this.apiUrl}/api/v3/member/collect/comics?limit=30&offset=${(page - 1) * 30}&free_type=1&ordering=${ordering}`,
                this.headers
            )
            if (res.status === 401) {
                throw `Login expired`
            }
            if (res.status === 210) {
                throw "210：访问过于频繁，已被官方风控限制，请等待1小时、切换海外线路或尝试点击设置里的“重置设备指纹池”";
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`
            }
            let data = JSON.parse(res.body)
            function parseComic(comic) {
                if (comic["comic"] !== null && comic["comic"] !== undefined) {
                    comic = comic["comic"]
                }
                let tags = []
                if (comic["theme"] !== null && comic["theme"] !== undefined) {
                    tags = comic["theme"].map(t => t["name"])
                }
                let author = null
                if (Array.isArray(comic["author"]) && comic["author"].length > 0) {
                    author = comic["author"][0]["name"]
                }
                return {
                    id: comic["path_word"],
                    title: comic["name"],
                    subTitle: author,
                    cover: comic["cover"],
                    tags: tags,
                    description: comic["datetime_updated"]
                }
            }
            return {
                comics: data["results"]["list"].map(parseComic),
                maxPage: (data["results"]["total"] - (data["results"]["total"] % 21)) / 21 + 1
            }
        }
    }
    comic = {
        loadInfo: async (id) => {
            let getChapters = async (id, groups) => {
                let fetchSingle = async (id, path) => {
                    let reqId = await this.getReqID();
                    await this.throttle();
                    let res = await Network.get(
                        `${this.apiUrl}/api/v3/comic/${id}/group/${path}/chapters?limit=100&offset=0&in_mainland=true&request_id=${reqId}`,
                        this.headers
                    );
                    if (res.status === 210) {
                        throw "210：章节列表访问过于频繁，已被官方风控限制，请尝试切换海外线路或点击设置里的“重置设备指纹池”";
                    }
                    if (res.status !== 200) {
                        throw `Invalid status code: ${res.status}`;
                    }
                    let data = JSON.parse(res.body);
                    let eps = new Map();
                    data.results.list.forEach((e) => {
                        let title = e.name;
                        let id = e.uuid;
                        eps.set(id, title);
                    });
                    let maxChapter = data.results.total;
                    if (maxChapter > 100) {
                        let offset = 100;
                        while (offset < maxChapter) {
                            await this.throttle();
                            res = await Network.get(
                                `${this.apiUrl}/api/v3/comic/${id}/group/${path}/chapters?limit=100&offset=${offset}`,
                                this.headers
                            );
                            if (res.status === 210) {
                                throw "210：章节列表访问过于频繁，已被官方风控限制，请尝试切换海外线路或点击设置里的“重置设备指纹池”";
                            }
                            if (res.status !== 200) {
                                throw `Invalid status code: ${res.status}`;
                            }
                            data = JSON.parse(res.body);
                            data.results.list.forEach((e) => {
                                let title = e.name;
                                let id = e.uuid;
                                eps.set(id, title)
                            });
                            offset += 100;
                        }
                    }
                    return eps;
                };
                let keys = Object.keys(groups);
                let result = {};
                let futures = [];
                for (let group of keys) {
                    let path = groups[group]["path_word"];
                    futures.push((async () => {
                        result[group] = await fetchSingle(id, path);
                    })());
                }
                await Promise.all(futures);
                if (this.isAppVersionAfter("1.3.0")) {
                    let sortedResult = new Map();
                    for (let key of keys) {
                        let name = groups[key]["name"];
                        sortedResult.set(name, result[key]);
                    }
                    return sortedResult;
                } else {
                    let merged = new Map();
                    for (let key of keys) {
                        for (let [k, v] of result[key]) {
                            merged.set(k, v);
                        }
                    }
                    return merged;
                }
            }
            let getFavoriteStatus = async (id) => {
                await this.throttle();
                let res = await Network.get(`${this.apiUrl}/api/v3/comic2/${id}/query`, this.headers);
                if (res.status === 210) {
                    return false;
                }
                if (res.status !== 200) {
                    throw `Invalid status code: ${res.status}`;
                }
                return JSON.parse(res.body).results.collect != null;
            }
            //====修改====详情请求加重试: 硬风控210/软风控results:null都重置指纹+退避重试
            let results;
            let data = null;
            for (let attempt = 0; attempt < 3; attempt++) {
                let reqId = await this.getReqID();
                await this.throttle();
                results = await Promise.all([
                    Network.get(
                        `${this.apiUrl}/api/v3/comic2/${id}?in_mainland=true&request_id=${reqId}&platform=3`,
                        this.headers
                    ),
                    getFavoriteStatus.bind(this)(id)
                ])
                if (results[0].status === 210) {
                    // 硬风控: 记录被封指纹 + 重置 + 阶梯退避
                    this.markDeviceBlocked();
                    this.autoResetDeviceFingerprint();
                    let waitTime = 10000 + attempt * 10000;
                    console.log(`详情触发210风控，等待 ${waitTime / 1000}s 后重试 (${attempt + 1}/3)`);
                    await new Promise((resolve) => setTimeout(resolve, waitTime));
                    continue;
                }
                if (results[0].status !== 200) {
                    throw `Invalid status code: ${results[0].status}`;
                }
                data = JSON.parse(results[0].body).results;
                if (!data || !data.comic) {
                    // 软风控(200+results:null): 重置指纹 + 退避重试, 不再报TypeError
                    this.autoResetDeviceFingerprint();
                    let waitTime = 10000 + attempt * 10000;
                    console.log(`详情返回空数据(软风控)，等待 ${waitTime / 1000}s 后重试 (${attempt + 1}/3)`);
                    await new Promise((resolve) => setTimeout(resolve, waitTime));
                    continue;
                }
                break;
            }
            if (!data || !data.comic) {
                throw "210：漫画详情访问过于频繁，已被官方风控限制。请稍后重试或点击设置里的“重置设备指纹池”";
            }
            let comicData = data.comic;
            //====结束修改====
            let title = comicData.name;
            let cover = comicData.cover;
            let authors = comicData.author.map(e => e.name);
            if (Object.keys(this.author_path_word_dict).length > 100) {
                this.author_path_word_dict = {};
            }
            comicData.author.forEach(e => (this.author_path_word_dict[e.name] = e.path_word));
            let tags = comicData.theme.map(e => e?.name).filter(name => name !== undefined && name !== null);
            let updateTime = comicData.datetime_updated ? comicData.datetime_updated : "";
            let description = comicData.brief;
            let chapters = await getChapters(id, data.groups);
            let status = comicData.status.display;
            return {
                title: title,
                cover: cover,
                description: description,
                tags: {
                    "作者": authors,
                    "更新": [updateTime],
                    "标签": tags,
                    "状态": [status],
                },
                chapters: chapters,
                isFavorite: results[1],
                subId: comicData.uuid
            }
        },
        loadEp: async (comicId, epId) => {
            //====修改====读取配置：是否每一章强制重置指纹
            const autoResetEveryChapter = this.loadSetting('auto_reset_finger_every_ep') === "1";
            if(autoResetEveryChapter){
                this.autoResetDeviceFingerprint();
            }
            //====结束修改====

            let attempt = 0;
            const maxAttempts = 6;
            let res;
            let data;
            while (attempt < maxAttempts) {
                try {
                    let reqId = await this.getReqID();
                    await this.throttle();
                    res = await Network.get(
                        `${this.apiUrl}/api/v3/comic/${comicId}/chapter2/${epId}?in_mainland=true&request_id=${reqId}`,
                        {
                            ...this.headers
                        }
                    );
                    if (res.status === 210) {
                        //====修改====捕获210风控，自动重置指纹再重试
                        this.markDeviceBlocked();
                        console.log(`检测到210风控，执行自动重置设备指纹`);
                        this.autoResetDeviceFingerprint();
                        //====结束修改====

                        let waitTime = 10000 + attempt * 5000; // 阶梯退避重试
                        try {
                            let responseBody = JSON.parse(res.body);
                            if (
                                responseBody.message &&
                                responseBody.message.includes("Expected available in")
                            ) {
                                let match = responseBody.message.match(/(\d+)\s*seconds/);
                                if (match && match[1]) {
                                    waitTime = parseInt(match[1]) * 1000;
                                }
                            }
                        } catch (e) {
                        }
                        console.log(`Chapter ${epId} 触发风控(210)，等待 ${waitTime / 1000}s 后重试 (${attempt + 1}/${maxAttempts})`);
                        await new Promise((resolve) => setTimeout(resolve, waitTime));
                        attempt++;
                        if (attempt >= maxAttempts) {
                            throw "210：章节内容加载频繁，已被官方风控限制。请尝试切换【海外线路】或点击设置里的“重置设备指纹池”。";
                        }
                        continue;
                    }
                    if (res.status !== 200) {
                        throw `Invalid status code: ${res.status}`;
                    }
                    data = JSON.parse(res.body);
                    if (!data.results || !data.results.chapter || !Array.isArray(data.results.chapter.contents)) {
                        //====修改====软风控(200+空章节数据): 重置指纹+退避重试, 与210同样处理
                        console.log(`检测到软风控(章节空数据)，执行自动重置设备指纹`);
                        this.autoResetDeviceFingerprint();
                        let waitTime = 10000 + attempt * 5000;
                        console.log(`Chapter ${epId} 触发软风控，等待 ${waitTime / 1000}s 后重试 (${attempt + 1}/${maxAttempts})`);
                        await new Promise((resolve) => setTimeout(resolve, waitTime));
                        attempt++;
                        if (attempt >= maxAttempts) {
                            throw "210：章节内容加载频繁，已被官方风控限制。请尝试切换【海外线路】或点击设置里的“重置设备指纹池”。";
                        }
                        continue;
                        //====结束修改====
                    }
                    let imagesUrls = data.results.chapter.contents.map((e) => e.url);
                    let orders = data.results.chapter.words;
                    let hdImagesUrls = imagesUrls.map((url) => {
                        return url.replace(/([./])c\d+x\.[a-zA-Z]+$/, `$1c${this.imageQuality}x.webp`)
                    })
                    let images = new Array(hdImagesUrls.length).fill("");
                    for (let i = 0; i < hdImagesUrls.length; i++) {
                        images[orders[i]] = hdImagesUrls[i];
                    }
                    return {
                        images: images,
                    };
                } catch (error) {
                    if (typeof error === 'string' && error.startsWith("210")) {
                        throw error;
                    }
                    attempt++;
                    if (attempt >= maxAttempts) {
                        throw error;
                    }
                    await new Promise((resolve) => setTimeout(resolve, 3000));
                }
            }
        },
        loadComments: async (comicId, subId, page, replyTo) => {
            let url = `${this.apiUrl}/api/v3/comments?comic_id=${subId}&limit=20&offset=${(page - 1) * 20}`;
            if (replyTo) {
                url = url + `&reply_id=${replyTo}&_update=true`;
            }
            await this.throttle();
            let res = await Network.get(
                url,
                this.headers,
            );
            if (res.status === 210) {
                throw "210：评论加载频繁，请尝试点击设置里的“重置设备指纹池”";
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }
            let data = JSON.parse(res.body);
            let total = data.results.total;
            return {
                comments: data.results.list.map(e => {
                    return {
                        userName: replyTo ? `${e.user_name}  👉  ${e.parent_user_name}` : e.user_name,
                        avatar: e.user_avatar,
                        content: e.comment,
                        time: e.create_at,
                        replyCount: e.count,
                        id: e.id,
                    }
                }),
                maxPage: (total - (total % 20)) / 20 + 1,
            }
        },
        sendComment: async (comicId, subId, content, replyTo) => {
            let token = this.loadData("token");
            if (!token) {
                throw "未登录"
            }
            if (!replyTo) {
                replyTo = '';
            }
            await this.throttle();
            let res = await Network.post(
                `${this.apiUrl}/api/v3/member/comment`,
                {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
                `comic_id=${subId}&comment=${encodeURIComponent(content)}&reply_id=${replyTo}`,
            );
            if (res.status === 401) {
                throw `Login expired`;
            }
            if (res.status === 210) {
                throw "210：发送评论过于频繁，请尝试点击设置里的“重置设备指纹池”";
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            } else {
                return "ok"
            }
        },
        loadChapterComments: async (comicId, epId, page, replyTo) => {
            let url = `${this.apiUrl}/api/v3/roasts?chapter_id=${epId}&limit=20&offset=${(page - 1) * 20}`;
            await this.throttle();
            let res = await Network.get(
                url,
                this.headers,
            );
            if (res.status === 210) {
                throw "210：吐槽加载频繁，请尝试点击设置里的“重置设备指纹池”";
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            }
            let data = JSON.parse(res.body);
            let total = data.results.total;
            return {
                comments: data.results.list.map(e => {
                    return {
                        userName: e.user_name,
                        avatar: e.user_avatar,
                        content: e.comment,
                        time: e.create_at,
                        replyCount: null,
                        id: null,
                    }
                }),
                maxPage: (total - (total % 20)) / 20 + 1,
            }
        },
        sendChapterComment: async (comicId, epId, content, replyTo) => {
            let token = this.loadData("token");
            if (!token) {
                throw "未登录"
            }
            await this.throttle();
            let res = await Network.post(
                `${this.apiUrl}/api/v3/member/roast`,
                {
                    ...this.headers,
                    "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
                },
                `chapter_id=${epId}&roast=${encodeURIComponent(content)}`,
            );
            if (res.status === 401) {
                throw `Login expired`;
            }
            if (res.status === 210) {
                throw "210：评论过于频繁，请尝试点击设置里的“重置设备指纹池”";
            }
            if (res.status !== 200) {
                throw `Invalid status code: ${res.status}`;
            } else {
                return "ok"
            }
        },
        onClickTag: (namespace, tag) => {
            if (namespace === "标签") {
                return {
                    action: 'category',
                    keyword: `${tag}`,
                    param: null,
                }
            }
            if (namespace === "作者") {
                return {
                    action: 'search',
                    keyword: `${namespace}:${tag}`,
                    param: null,
                }
            }
            throw "未支持此类Tag检索"
        }
    }
    settings = {
        favorites_ordering: {
            title: "收藏排序方式",
            type: "select",
            options: [
                {
                    value: '-datetime_updated',
                    text: '更新时间'
                },
                {
                    value: '-datetime_modifier',
                    text: '收藏时间'
                },
                {
                    value: '-datetime_browse',
                    text: '阅读时间'
                }
            ],
            default: '-datetime_updated',
        },
        //====修改====新增设置项：每章节自动重置指纹开关，放在callback项之前！
        auto_reset_finger_every_ep:{
            title:"每切换章节强制重置设备指纹(谨慎开启)",
            type:"select",
            options:[
                {value:"0",text:"关闭(仅风控210才自动重置)"},
                {value:"1",text:"开启，每一章都重置指纹"}
            ],
            default:"1"
        },
        enable_virtual_ip: {
            title: "虚拟IP轮换(实验性,默认关闭)",
            type: "select",
            options: [
                {value:"0",text:"关闭(推荐，官方App不带虚拟IP)"},
                {value:"1",text:"开启，每次重置指纹同时换虚拟IP"}
            ],
            default: "0"
        },
        //====结束修改====
        region: {
            title: "CDN线路",
            type: "select",
            options: [
                {
                    value: "0",
                    text: '海外线路 (推荐防风控)'
                },
                {
                    value: "1",
                    text: '大陆线路'
                }
            ],
            default: CopyManga.defaultCopyRegion,
        },
        image_quality: {
            title: "图片质量",
            type: "select",
            options: [
                {
                    value: '800',
                    text: '低 (800)'
                },
                {
                    value: '1200',
                    text: '中 (1200)'
                },
                {
                    value: '1500',
                    text: '高 (1500)'
                }
            ],
            default: CopyManga.defaultImageQuality,
        },
        search_api: {
            title: "搜索方式",
            type: "select",
            options: [
                {
                    value: 'baseAPI',
                    text: '基础API'
                },
                {
                    value: 'webAPI',
                    text: '网页端API'
                }
            ],
            default: 'baseAPI'
        },
        base_url: {
            title: "API地址",
            type: "input",
            validator: '^(?!:\\/\\/)(?=.{1,253})([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\\.)+[a-zA-Z]{2,}$',
            default: CopyManga.defaultApiUrl,
        },
        //【重要】callback类型设置必须放在settings对象的最后！！
        clear_device_info: {
            title: "重置设备指纹池",
            type: "callback",
            buttonText: "点击切换真实设备指纹",
            callback: () => {
                this.deleteData("_deviceinfo");
                this.deleteData("_device");
                this.deleteData("_pseudoid");
                this.deleteData("_virtual_ip");
                this.deleteData("_exclude_deviceinfo");
                this.deleteData("_exclude_device");
                this.deleteData("_blocked_deviceinfos");
                this.refreshAppApi();
            }
        },
    }
    isAppVersionAfter(target) {
        let current = APP.version
        let targetArr = target.split('.')
        let currentArr = current.split('.')
        for (let i = 0; i < 3; i++) {
            if (parseInt(currentArr[i]) < parseInt(targetArr[i])) {
                return false
            }
        }
        return true
    }
    async refreshSearchApi() {
        try {
            let url = "https://www.copy20.com/search"
            let res = await fetch(url)
            let searchApi = ""
            if (res.status === 200) {
                let text = await res.text()
                let match = text.match(/const countApi = "([^"]+)"/)
                if (match && match[1]) {
                    CopyManga.searchApi = match[1]
                }
            }
        } catch (e) {
            // 网络抖动时静默跳过, 保持默认 searchApi, 避免 init 产生未处理异常
        }
    }
    async refreshAppApi() {
        try {
            const url = "https://api.copy-manga.com/api/v3/system/network2?platform=3"
            const res = await fetch(url, { headers: this.headers });
            if (res.status === 200) {
                let data = await res.json();
                if (data && data.results && Array.isArray(data.results.api) && data.results.api.length > 0) {
                    this.settings.base_url = data.results.api[0][0];
                }
            }
        } catch (e) {
            // 网络失败时保留当前 base_url, 不打断 init
        }
    }
}
