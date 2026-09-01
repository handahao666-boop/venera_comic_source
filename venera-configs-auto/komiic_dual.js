/**
 * Komiic 双域名版 v1.0.8
 *
 * 默认使用国内直连域名 https://komiic.cc；
 * 原版域名 https://komiic.com 保留为备用（在 Venera 源设置中可切换，API 请求失败时也会自动尝试备用域名）。
 *
 * v1.0.8：正文图片改用站点当前的“图片票据”协议（imageTicketsByChapterId），
 * 携带 X-Image-Ticket 请求头，并把 img.komiic.com 的图片地址按当前域名重写为
 * img.komiic.cc（国内可直连）。旧的 /api/image/{kid} 接口对游客已返回 400。
 */
class Komiic extends ComicSource {

    // 此漫画源的名称
    name = "Komiic"

    // 唯一标识符
    key = "Komiic"

    version = "1.0.8"

    minAppVersion = "1.0.0"

    // 更新链接
    url = "https://cdn.jsdelivr.net/gh/venera-app/venera-configs@main/komiic.js"

    // 两个可用域名：第一个为国内直连默认，第二个为原版域名
    static domains = ["https://komiic.cc", "https://komiic.com"]

    // 正文图片票据标记前缀：URL 里带票据时由 onImageLoad 解码并设置请求头
    static ticketMarker = "komiic-ticket:"

    // 当前生效的 API 域名，默认国内直连
    baseUrl = Komiic.domains[0]

    settings = {
        base_url: {
            title: "API 域名",
            type: "select",
            default: "https://komiic.cc",
            options: [
                { value: "https://komiic.cc", text: "komiic.cc（国内直连，默认）" },
                { value: "https://komiic.com", text: "komiic.com（原版域名）" },
            ],
        },
    }

    init() {
        const saved = this.loadSetting('base_url');
        const normalized = this.normalizeBaseUrl(saved);
        this.baseUrl = normalized || Komiic.domains[0];
    }

    normalizeBaseUrl(value) {
        const base = String(value || "").trim().replace(/\/+$/, "");
        return /^https?:\/\/[^/]+$/i.test(base) ? base : "";
    }

    // 返回与当前 baseUrl 不同的备用域名
    alternateBaseUrl() {
        const current = String(this.baseUrl || "");
        return Komiic.domains.find((d) => d !== current) || Komiic.domains[Komiic.domains.length - 1];
    }

    headersFor(baseUrl) {
        let token = this.loadData('token')
        let headers = {
            'Referer': `${baseUrl}/`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Content-Type': 'application/json'
        }
        if (token) {
            headers['Authorization'] = `Bearer ${token}`
        }
        return headers
    }

    get headers() {
        return this.headersFor(this.baseUrl)
    }

    // 封面/头像等媒体地址统一到当前域名；保留子域名（如 public.komiic.com -> public.komiic.cc）
    normalizeMediaUrl(url) {
        if (!url) return "";
        const value = String(url).trim();
        if (!/^https?:\/\//i.test(value)) {
            return `${this.baseUrl}${value.startsWith("/") ? "" : "/"}${value}`;
        }
        const currentHost = this.baseUrl.replace(/^https?:\/\//i, "");
        return value.replace(
            /^(https?:\/\/)([^/]*?)(komiic\.(?:com|cc))/i,
            (match, scheme, sub, domain) => `${scheme}${sub}${currentHost}`
        );
    }

    encodeTicketImage(ticket) {
        const payload = {
            u: ticket && ticket.url,
            t: ticket && ticket.ticket,
            k: ticket && ticket.kid,
            e: ticket && ticket.expiresAt,
        };
        return `${Komiic.ticketMarker}${encodeURIComponent(JSON.stringify(payload))}`;
    }

    decodeTicketImage(url) {
        const raw = String(url || "");
        if (!raw.startsWith(Komiic.ticketMarker)) return null;
        try {
            const payload = JSON.parse(decodeURIComponent(raw.slice(Komiic.ticketMarker.length)));
            if (payload && payload.u && payload.t) return payload;
        } catch (_) {}
        return null;
    }

    // 只有在网络/服务端类故障时才切换到备用域名，避免把真实业务错误掩盖掉
    isFallbackEligible(error) {
        const message = String(error && error.message || error || "");
        if (/invalid status code (?:5\d\d|0)/i.test(message)) return true;
        if (/timeout|timed out|connection reset|connection closed|peer closed|broken pipe|network error|unexpected.?eof|socket|unreachable|aborted|temporary|fetch failed|failed to fetch|5\d\d/i.test(message)) return true;
        return false;
    }

    // 依次尝试当前域名与备用域名，只有可回退错误才切换
    async withDomains(operation) {
        let lastError = null;
        const bases = [this.baseUrl, this.alternateBaseUrl()];
        for (let i = 0; i < bases.length; i++) {
            try {
                return await operation(bases[i]);
            } catch (error) {
                lastError = error;
                if (i === 0 && this.isFallbackEligible(error)) continue;
                break;
            }
        }
        throw lastError;
    }

    async queryJson(query) {
        return this.withDomains(async (base) => this.queryJsonWithBase(base, query));
    }

    async queryJsonWithBase(base, query) {
        let res = await Network.post(
            `${base}/api/query`,
            this.headersFor(base),
            query
        )

        if (res.error) {
            throw new Error(String(res.error))
        }
        if (res.status !== 200) {
            throw `Invalid Status Code ${res.status}`
        }

        let json = JSON.parse(res.body)

        if (json.errors != undefined) {
            const errorInfo = json.errors[0].message.toString();
            if ((errorInfo.toLowerCase().indexOf('token') >= 0)) {
                const accountData = this.loadData("account");
                if (accountData && accountData.length >= 2) {
                    await this.account.login(accountData[0], accountData[1]);
                    return await this.queryJson(query);
                } else {
                    throw "请先登录账号"
                }
            }
            if (/quota|image limit|daily image|rate limit/i.test(errorInfo)) {
                throw "Komiic 游客每日图片额度已用尽，请登录账号后重试（登录可恢复额度）"
            }
            throw json.errors[0].message
        }

        return json
    }

    async queryComics(query) {
        let operationName = query["operationName"]
        let json = await this.queryJson(query)

        const parseComic = (comic) => {
            let author = ''
            if (comic.authors && comic.authors.length > 0) {
                author = comic.authors[0].name
            }
            let tags = []
            if (comic.categories) {
                comic.categories.forEach((c) => {
                    tags.push(c.name)
                })
            }

            function getTimeDifference(date) {
                const now = new Date();
                const timeDifference = now - date;

                const millisecondsPerHour = 1000 * 60 * 60;
                const millisecondsPerDay = millisecondsPerHour * 24;

                if (timeDifference < millisecondsPerHour) {
                    return '剛剛更新';
                } else if (timeDifference < millisecondsPerDay) {
                    const hours = Math.floor(timeDifference / millisecondsPerHour);
                    return `${hours}小時前更新`;
                } else {
                    const days = Math.floor(timeDifference / millisecondsPerDay);
                    return `${days}天前更新`;
                }
            }

            let updateTime = new Date(comic.dateUpdated)
            let description = getTimeDifference(updateTime)
            let formatedTime = `${updateTime.getFullYear()}-${updateTime.getMonth() + 1}-${updateTime.getDate()}`

            let cover = this.normalizeMediaUrl(comic.imageUrl)

            return {
                id: comic.id,
                title: comic.title,
                subTitle: author,
                cover: cover,
                tags: tags,
                description: description,
                updateTime: formatedTime
            }
        }

        if (!json.data || !json.data[operationName]) {
            return { comics: [], maxPage: 0 }
        }

        return {
            comics: json.data[operationName].map(parseComic),
            maxPage: null
        }
    }

    /// 账号
    account = {
        /// 登录
        login: async (account, pwd) => {
            return this.withDomains(async (base) => {
                let res = await Network.post(
                    `${base}/api/login`,
                    this.headersFor(base),
                    {
                        email: account,
                        password: pwd
                    }
                )

                if (res.error) {
                    throw new Error(String(res.error))
                }
                if (res.status === 200) {
                    let body = JSON.parse(res.body)
                    if (body.token) {
                        this.saveData('token', body.token)
                        this.saveData('account', [account, pwd])
                        return 'ok'
                    }
                }

                throw '登录失败，请检查账号密码'
            })
        },

        logout: () => {
            this.deleteData('token')
            this.deleteData('account')
        },

        registerWebsite: `${this.baseUrl}/register`
    }

    /// 探索页面
    explore = [
        {
            title: "Komiic",
            type: "multiPageComicList",
            load: async (page) => {
                return await this.queryComics({ "operationName": "recentUpdate", "variables": { "pagination": { "limit": 20, "offset": (page - 1) * 20, "orderBy": "DATE_UPDATED", "status": "", "asc": true } }, "query": "query recentUpdate($pagination: Pagination!) {\n  recentUpdate(pagination: $pagination) {\n    id\n    title\n    status\n    year\n    imageUrl\n    authors {\n      id\n      name\n      __typename\n    }\n    categories {\n      id\n      name\n      __typename\n    }\n    dateUpdated\n    monthViews\n    views\n    favoriteCount\n    lastBookUpdate\n    lastChapterUpdate\n    __typename\n  }\n}" })
            }
        }
    ]

    category = {
        title: "Komiic",
        enableRankingPage: true,
        parts: [
            {
                name: "主题",
                type: "fixed",
                categories: ['全部', '愛情', '神鬼', '校園', '搞笑', '生活', '懸疑', '冒險', '職場', '魔幻', '後宮', '魔法', '格鬥', '宅男', '勵志', '耽美', '科幻', '百合', '治癒', '萌系', '熱血', '競技', '推理', '雜誌', '偵探', '偽娘', '美食', '恐怖', '四格', '社會', '歷史', '戰爭', '舞蹈', '武俠', '機戰', '音樂', '體育', '黑道'],
                itemType: "category",
                categoryParams: ['0', '1', '3', '4', '5', '6', '7', '8', '10', '11', '2', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '9', '28', '31', '32', '33', '34', '35', '36', '37', '40', '42']
            }
        ]
    }

    categoryComics = {
        load: async (category, param, options, page) => {
          let variables = {
              pagination: {
                  limit: 30,
                  offset: (page - 1) * 30,
                  orderBy: options[0],
                  asc: false,
                  status: options[1]
              }
          };
          
          if (param !== '0') {
              variables.categoryId = [param];
          } else {
              variables.categoryId = [];
          }

          return await this.queryComics({ 
              "operationName": "comicByCategories",
              "variables": variables,
              "query": `query comicByCategories($categoryId: [ID!]!, $pagination: Pagination!) {
                  comicByCategories(categoryId: $categoryId, pagination: $pagination) {
                      id
                      title
                      status
                      year
                      imageUrl
                      authors { id name __typename }
                      categories { id name __typename }
                      dateUpdated
                      monthViews
                      views
                      favoriteCount
                      lastBookUpdate
                      lastChapterUpdate
                      __typename
                  }
              }`
          })
        },
        optionList: [
            {
                options: [
                    "DATE_UPDATED-更新",
                    "VIEWS-觀看數",
                    "FAVORITE_COUNT-喜愛數",
                ],
                notShowWhen: null,
                showWhen: null
            },
            {
                options: [
                    "-全部",
                    "ONGOING-連載中",
                    "END-完結",
                ],
                notShowWhen: null,
                showWhen: null
            },
        ],
        ranking: {
            options: [
                "MONTH_VIEWS-月",
                "VIEWS-綜合"
            ],
            load: async (option, page) => {
                return this.queryComics({ "operationName": "hotComics", "variables": { "pagination": { "limit": 20, "offset": (page - 1) * 20, "orderBy": option, "status": "", "asc": true } }, "query": "query hotComics($pagination: Pagination!) {\n  hotComics(pagination: $pagination) {\n    id\n    title\n    status\n    year\n    imageUrl\n    authors {\n      id\n      name\n      __typename\n    }\n    categories {\n      id\n      name\n      __typename\n    }\n    dateUpdated\n    monthViews\n    views\n    favoriteCount\n    lastBookUpdate\n    lastChapterUpdate\n    __typename\n  }\n}" })
            }
        }
    }

    search = {
        load: async (keyword, options, page) => {
            let json = await this.queryJson({ "operationName": "searchComicAndAuthorQuery", "variables": { "keyword": keyword }, "query": "query searchComicAndAuthorQuery($keyword: String!) {\n  searchComicsAndAuthors(keyword: $keyword) {\n    comics {\n      id\n      title\n      status\n      year\n      imageUrl\n      authors {\n        id\n        name\n        __typename\n      }\n      categories {\n        id\n        name\n        __typename\n      }\n      dateUpdated\n      monthViews\n      views\n      favoriteCount\n      lastBookUpdate\n      lastChapterUpdate\n      __typename\n    }\n    authors {\n      id\n      name\n      chName\n      enName\n      wikiLink\n      comicCount\n      views\n      __typename\n    }\n    __typename\n  }\n}" })

            const parseComic = (comic) => {
                let author = ''
                if (comic.authors && comic.authors.length > 0) {
                    author = comic.authors[0].name
                }
                let tags = []
                if (comic.categories) {
                    comic.categories.forEach((c) => {
                        tags.push(c.name)
                    })
                }

                function getTimeDifference(date) {
                    const now = new Date();
                    const timeDifference = now - date;

                    const millisecondsPerHour = 1000 * 60 * 60;
                    const millisecondsPerDay = millisecondsPerHour * 24;

                    if (timeDifference < millisecondsPerHour) {
                        return '剛剛更新';
                    } else if (timeDifference < millisecondsPerDay) {
                        const hours = Math.floor(timeDifference / millisecondsPerHour);
                        return `${hours}小時前更新`;
                    } else {
                        const days = Math.floor(timeDifference / millisecondsPerDay);
                        return `${days}天前更新`;
                    }
                }

                let updateTime = new Date(comic.dateUpdated)
                let description = getTimeDifference(updateTime)

            let cover = this.normalizeMediaUrl(comic.imageUrl)

                return {
                    id: comic.id,
                    title: comic.title,
                    subTitle: author,
                    cover: cover,
                    tags: tags,
                    description: description
                }
            }

            if (!json.data || !json.data.searchComicsAndAuthors) {
                return { comics: [], maxPage: 0 }
            }

            return {
                comics: json.data.searchComicsAndAuthors.comics.map(parseComic),
                maxPage: 1
            }
        },

        optionList: []
    }

    favorites = {
        multiFolder: true,
        addOrDelFavorite: async (comicId, folderId, isAdding) => {
            let query = {}
            if (isAdding) {
                query = { "operationName": "addComicToFolder", "variables": { "comicId": comicId, "folderId": folderId }, "query": "mutation addComicToFolder($comicId: ID!, $folderId: ID!) {\n  addComicToFolder(comicId: $comicId, folderId: $folderId)\n}" }
            } else {
                query = { "operationName": "removeComicToFolder", "variables": { "comicId": comicId, "folderId": folderId }, "query": "mutation removeComicToFolder($comicId: ID!, $folderId: ID!) {\n  removeComicToFolder(comicId: $comicId, folderId: $folderId)\n}" }
            }
            await this.queryJson(query)
            return "ok"
        },
        loadFolders: async (comicId) => {
            let json = await this.queryJson({ "operationName": "myFolder", "variables": {}, "query": "query myFolder {\n  folders {\n    id\n    key\n    name\n    views\n    comicCount\n    dateCreated\n    dateUpdated\n    __typename\n  }\n}" })
            let folders = {}
            if (json.data && json.data.folders) {
                json.data.folders.forEach((f) => {
                    folders[f.id] = f.name
                })
            }
            let favorited = null
            if (comicId) {
                let json2 = await this.queryJson({ "operationName": "comicInAccountFolders", "variables": { "comicId": comicId }, "query": "query comicInAccountFolders($comicId: ID!) {\n  comicInAccountFolders(comicId: $comicId)\n}" })
                favorited = json2.data.comicInAccountFolders
            }
            return {
                folders: folders,
                favorited: favorited
            }
        },
        addFolder: async (name) => {
            await this.queryJson({ "operationName": "createFolder", "variables": { "name": name }, "query": "mutation createFolder($name: String!) {\n  createFolder(name: $name) {\n    id\n    key\n    name\n    account {\n      id\n      nickname\n      __typename\n    }\n    comicCount\n    views\n    dateCreated\n    dateUpdated\n    __typename\n  }\n}" })
            return "ok"
        },
        deleteFolder: async (id) => {
            await this.queryJson({ "operationName": "removeFolder", "variables": { "folderId": id }, "query": "mutation removeFolder($folderId: ID!) {\n  removeFolder(folderId: $folderId)\n}" })
            return "ok"
        },
        loadComics: async (page, folder) => {
            let json = await this.queryJson({ "operationName": "folderComicIds", "variables": { "folderId": folder, "pagination": { "limit": 30, "offset": (page - 1) * 30, "orderBy": "DATE_UPDATED", "status": "", "asc": true } }, "query": "query folderComicIds($folderId: ID!, $pagination: Pagination!) {\n  folderComicIds(folderId: $folderId, pagination: $pagination) {\n    folderId\n    key\n    comicIds\n    __typename\n  }\n}" })
            
            if (!json.data || !json.data.folderComicIds) {
                return { comics: [], maxPage: 1 }
            }
            
            let ids = json.data.folderComicIds.comicIds
            if (!ids || ids.length === 0) {
                return {
                    comics: [],
                    maxPage: 1
                }
            }
            return this.queryComics({ "operationName": "comicByIds", "variables": { "comicIds": ids }, "query": "query comicByIds($comicIds: [ID]!) {\n  comicByIds(comicIds: $comicIds) {\n    id\n    title\n    status\n    year\n    imageUrl\n    authors {\n      id\n      name\n      __typename\n    }\n    categories {\n      id\n      name\n      __typename\n    }\n    dateUpdated\n    monthViews\n    views\n    favoriteCount\n    lastBookUpdate\n    lastChapterUpdate\n    __typename\n  }\n}" })
        }
    }

    comic = {
        loadInfo: async (id) => {
            let json1 = await this.queryJson({ "operationName": "recommendComicById", "variables": { "comicId": id }, "query": "query recommendComicById($comicId: ID!) {\n  recommendComicById(comicId: $comicId)\n}" })
            let recommend = json1.data.recommendComicById || []
            recommend.push(id)

            let getChapter = async () => {
                let json = await this.queryJson({ "operationName": "chapterByComicId", "variables": { "comicId": id }, "query": "query chapterByComicId($comicId: ID!) {\n  chaptersByComicId(comicId: $comicId) {\n    id\n    serial\n    type\n    dateCreated\n    dateUpdated\n    size\n    __typename\n  }\n}" })
                let all = json.data.chaptersByComicId || []
                let books = [], chapters = []
                all.forEach((c) => {
                    if(c.type === 'book') {
                        books.push(c)
                    } else {
                        chapters.push(c)
                    }
                })
                let res = new Map()
                books.forEach((c) => {
                    let name = '卷' + c.serial
                    res.set(c.id, name)
                })
                chapters.forEach((c) => {
                    let name = c.serial
                    res.set(c.id, name)
                })
                return res
            }

            let results = await Promise.all([
                this.queryComics({ "operationName": "comicByIds", "variables": { "comicIds": recommend }, "query": "query comicByIds($comicIds: [ID]!) {\n  comicByIds(comicIds: $comicIds) {\n    id\n    title\n    status\n    year\n    imageUrl\n    authors {\n      id\n      name\n      __typename\n    }\n    categories {\n      id\n      name\n      __typename\n    }\n    dateUpdated\n    monthViews\n    views\n    favoriteCount\n    lastBookUpdate\n    lastChapterUpdate\n    __typename\n  }\n}" }),
                getChapter.call()
            ])

            let info = results[0].comics.pop()

            return {
                title: info.title,
                cover: info.cover,
                tags: {
                    "作者": [info.subTitle],
                    "标签": info.tags
                },
                chapters: results[1],
                recommend: results[0].comics,
                updateTime: info.updateTime,
            }
        },
        loadEp: async (comicId, epId) => {
            // 当前站点正文图片使用票据协议：imageTicketsByChapterId 返回签名 URL + ticket + 过期时间。
            let json = await this.queryJson({ "operationName": "imageTicketsByChapterId", "variables": { "chapterId": epId }, "query": "query imageTicketsByChapterId($chapterId: ID!) {\n  imageTicketsByChapterId(chapterId: $chapterId) {\n    url\n    ticket\n    kid\n    width\n    height\n    expiresAt\n    __typename\n  }\n}" })
            const tickets = json && json.data && Array.isArray(json.data.imageTicketsByChapterId) ? json.data.imageTicketsByChapterId : []
            if (tickets.length > 0) {
                return {
                    images: tickets.map((t) => this.encodeTicketImage(t)),
                }
            }
            // 兼容旧章节：退回旧的 imagesByChapterId 接口（游客可能拿不到图，仅作兜底）
            let oldJson = await this.queryJson({ "operationName": "imagesByChapterId", "variables": { "chapterId": epId }, "query": "query imagesByChapterId($chapterId: ID!) {\n  imagesByChapterId(chapterId: $chapterId) {\n    id\n    kid\n    height\n    width\n    __typename\n  }\n}" })
            const oldImages = oldJson && oldJson.data && Array.isArray(oldJson.data.imagesByChapterId) ? oldJson.data.imagesByChapterId : []
            return {
                images: oldImages.map((i) => {
                    return `${this.baseUrl}/api/image/${i.kid}`
                })
            }
        },
        onImageLoad: (url, comicId, epId) => {
            const currentBase = this.baseUrl
            const decoded = this.decodeTicketImage(url)
            if (decoded) {
                // 票据图片：把 CDN 域名按当前站点域名重写（img.komiic.com -> img.komiic.cc），并携带 X-Image-Ticket
                const imageUrl = this.normalizeMediaUrl(decoded.u)
                const ticketHeaders = {
                    'Referer': `${currentBase}/comic/${comicId}/chapter/${epId}/images/all`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'X-Image-Ticket': decoded.t,
                }
                const config = {
                    url: imageUrl,
                    headers: ticketHeaders,
                }
                // 票据加载失败时用同一票据重试一次（票据过期需重新打开章节刷新）
                config.onLoadFailed = () => ({ url: imageUrl, headers: ticketHeaders })
                return config
            }
            let headers = this.headersFor(currentBase)
            headers['Referer'] = `${currentBase}/comic/${comicId}/chapter/${epId}/images/all`
            const config = {
                headers: headers
            }
            // 图片在当前域名加载失败时，用备用域名重试同一张图
            if (String(url || '').startsWith(currentBase)) {
                const altBase = this.alternateBaseUrl()
                let altHeaders = this.headersFor(altBase)
                altHeaders['Referer'] = `${altBase}/comic/${comicId}/chapter/${epId}/images/all`
                config.onLoadFailed = () => ({
                    url: String(url).replace(currentBase, altBase),
                    headers: altHeaders,
                })
            }
            return config
        },
        loadComments: async (comicId, subId, page, replyTo) => {
            let operationName = replyTo ? "messageChan" : "getMessagesByComicId"
            let variables = replyTo ? { "messageId": replyTo } : { "comicId": comicId, "pagination": { "limit": 100, "offset": (page - 1) * 100, "orderBy": "DATE_UPDATED", "asc": true } }
            let query = replyTo 
                ? "query messageChan($messageId: ID!) {\n  messageChan(messageId: $messageId) {\n    id\n    comicId\n    account {\n      id\n      nickname\n      profileText\n      profileTextColor\n      profileBackgroundColor\n      profileImageUrl\n      __typename\n    }\n    message\n    replyTo {\n      id\n      __typename\n    }\n    upCount\n    downCount\n    dateUpdated\n    dateCreated\n    __typename\n  }\n}"
                : "query getMessagesByComicId($comicId: ID!, $pagination: Pagination!) {\n  getMessagesByComicId(comicId: $comicId, pagination: $pagination) {\n    id\n    comicId\n    account {\n      id\n      nickname\n      profileText\n      profileTextColor\n      profileBackgroundColor\n      profileImageUrl\n      __typename\n    }\n    message\n    replyTo {\n      id\n      message\n      account {\n        id\n        nickname\n        profileText\n        profileTextColor\n        profileBackgroundColor\n        profileImageUrl\n        __typename\n      }\n      __typename\n    }\n    upCount\n    downCount\n    dateUpdated\n    dateCreated\n    __typename\n  }\n}"
            
            let json = await this.queryJson({ "operationName": operationName, "variables": variables, "query": query })
            
            if (!json.data || !json.data[operationName]) {
                return { comments: [], maxPage: 0 }
            }

            return {
                comments: json.data[operationName].map(e => {
                    return {
                        userName: e.account.nickname,
                        avatar: this.normalizeMediaUrl(e.account.profileImageUrl),
                        content: e.message,
                        time: e.dateUpdated,
                        replyCount: 0,
                        id: e.id,
                    }
                }),
                maxPage: null,
            }
        },
        sendComment: async (comicId, subId, content, replyTo) => {
            if (!replyTo) {
                replyTo = "0"
            }
            await this.queryJson({ "operationName": "addMessageToComic", "variables": { "comicId": comicId, "message": content, "replyToId": replyTo }, "query": "mutation addMessageToComic($comicId: ID!, $replyToId: ID!, $message: String!) {\n  addMessageToComic(message: $message, comicId: $comicId, replyToId: $replyToId) {\n    id\n    message\n    comicId\n    account {\n      id\n      nickname\n      __typename\n    }\n    replyTo {\n      id\n      message\n      account {\n        id\n        nickname\n        profileText\n        profileTextColor\n        profileBackgroundColor\n        profileImageUrl\n        __typename\n      }\n      __typename\n    }\n    dateCreated\n    dateUpdated\n    __typename\n  }\n}" })
            return "ok"
        }
    }
}
