# LINE WEBTOON（www.webtoons.com/zh-hant）Venera 源开发日志

> 版本：v1.0.0
> 源文件：`webtoons_zh_hant.js`（class `WebtoonsZhHant`，key `webtoons_zh_hant`，minAppVersion 1.6.0）
> 开发原则：所有结论均由真实页面、接口、脚本或官方文档证实。本日志依据《Venera 漫画源开发日志（统一合并版 v3）》第 11 节模板与附录 D.17.4 编写。

## 站点证据清单

全部样本由本机 `wt_fetch.js`（HTTP 客户端，经代理出口 SG）与无头 Edge CDP 抓取，保存在 `webtoons_evidence/v2/`。

| 页面 | 实际 URL | HTTP 状态 | 单项选择器/字段 | 样本数量 | 保存位置 |
|---|---|---:|---|---:|---|
| 首页 | `GET /zh-hant/` | 200 260181B | 区块 `.main_section`，卡片 `ul.webtoon_list > li` | 5 区块 / 74 卡片 | `v2/home.html` |
| 搜索（主路径，JSON） | `GET m.webtoons.com/zh-hant/search/result?keyword=&searchType=&start=` | 200 JSON | `result.webtoonResult.titleList` / `result.challengeResult.titleList`，`totalCount` | 每页 20 条 | `probe_wt_searchpage.js` 输出 |
| 搜索（兜底，HTML） | `GET /zh-hant/search?keyword=&page=N` | 200 | `a.link._card_item`（实测 21）| 21~24 条/页，无分页控件 | `v2/search__love_p1.html`、`v2/search__love_p2.html` |
| 题材分类 | `GET /zh-hant/genres/{slug}?sortOrder=MANA` | 200 | `ul.webtoon_list > li`（实测 437） | romance 934 / fantasy 437 / drama 198 | `v2/genres.html`、`v2/genres_genre.html` |
| 连载日程 | `GET /zh-hant/originals/{day}` | 200 | `a.link._originals_title_a`（实测 138） | mon138 tue142 wed155 thu146 fri151 sat156 sun151 | `v2/originals_monday.html` 等 |
| 排行榜 | `GET /zh-hant/ranking/{trending\|popular\|originals\|canvas}` | 200 | `a.link._ranking_title_a`（实测 30） | 各 30 条 | `v2/ranking.html`、`v2/ranking_originals.html` |
| 排行榜依题材 | `GET /zh-hant/ranking/originals?subTabGenreCode={CODE}` | 200 | 同上 | 站点仅提供 10 个有效 CODE | `v2/ranking_genre.html` |
| 投稿新星 | `GET /zh-hant/canvas` | 200 | `a[href*="title_no="]` | 42 条 | 探索页回归输出 |
| 详情 | `GET /zh-hant/{genre}/{slug}/list?title_no=N` | 200 | `h1.subj` / `meta[property="og:image"]` / `.summary` / `.detail_header .genre` / `.detail_header .author_area` / `p.day_info` / `li._episodeItem` | 各 1（章节项 10 条/页） | `v2/detail_5145.html`、`v2/detail_546.html` |
| 章节（主路径，JSON） | `GET m.webtoons.com/api/v1/webtoon/{titleNo}/episodes?pageSize=1000&startIndex=0` | 200 JSON | `result.episodeList[].episodeNo/episodeTitle` | 5145→119 话，546→618 话 | `v2` 采集脚本输出 |
| 阅读页 | `GET /zh-hant/{genre}/{slug}/{ep}/viewer?title_no=N&episode_no=E` | 200 | `#_imageList img[data-url]`（实测 71） | 66 / 71 / 238 / 103 张 | `v2/viewer_5145_60.html` 等 |

选择器复核（离线，`an_wt_selectors.js`）：`ul.webtoon_list > li`=76(首页)/138(日程)/30(排行)/437(题材)；`a.link._card_item`=21(搜索页)；`#_imageList img`=71(阅读页)；详情页 6 个字段选择器各命中 1，`li._episodeItem`=10。

## 图片与加密判断

- 图片数据位置：阅读页 DOM 属性 `#_imageList img[data-url]`，值为 CDN 绝对 URL（`webtoon-phinf.pstatic.net`）。
- 是否加密：**未发现加密**。URL 仅带 `?type=q90` / `?type=opti` 这类尺寸质量参数，无签名、无 nonce、无 Base64 载荷。
- 是否存在运行时协议：**无**。响应中不含需要执行的动态表达式，源内也没有 `eval` / `new Function`。
- 防盗链（实测关键项）：`webtoon-phinf.pstatic.net` 不带 `Referer` 返回 **403 text/html**，带 `Referer: https://www.webtoons.com/` 返回 **200 image/png 69343B**；详情封面域名 `swebtoon-phinf.pstatic.net` 两种都返回 200。源内 `onImageLoad` / `onThumbnailLoad` 对 `webtoon-phinf` 统一补 Referer。

## 协议样本清单（仅当图片或章节数据不是直接 URL/JSON 时填写）

不适用：图片是直接 URL，章节目录是标准 JSON，未出现任何需要还原的动态协议。

## 字段可信度与跨页面验证

| 用户可见字段 | 首次来源 | 是否直接采用 | 交叉验证页面/文件 | 最终采用来源 | 已验证 |
|---|---|---|---|---|---|
| 封面 | 详情页 `og:image` | 是 | `swebtoon-phinf` 直链 200 image/jpeg | 详情页 `og:image` | 是 |
| 列表缩略图 | 卡片 `img[data-src]/img[src]` | 是 | 首页/搜索/分类样本一致 | 卡片 img | 是 |
| 章节目录 | `m.webtoons.com` episodes API | 是 | 详情页 `li._episodeItem` 分页兜底（每页 10 话，5145 共 12 页，第 13 页被夹回第 12 页） | API 优先，HTML 兜底 | 是 |
| 图片列表 | 阅读页 `#_imageList img[data-url]` | 是 | 首/中/末话 + 另一部作品共 4 组样本 | 阅读页 DOM | 是 |
| 作者 | 列表卡片 `.info_text .author`；详情页 `.detail_header .author_area` | 是 | 详情页页面上的 `.author` 属于推荐位，已排除 | 上述两处 | 是 |
| 副标题（列表第二行） | 各页第二行字段不同：题材 / 浏览数 / 无 | 否（做了兜底链） | 见下文「本期改动」第 2 条 | 作者 → 题材 → URL 段落题材 → 浏览数 | 是 |

## 历史阅读输入矩阵

| 输入形态 | 示例 | 标准化结果 | 应否发请求 | 预期输出 |
|---|---|---|---|---|
| 规范 ID | `/zh-hant/fantasy/not-that-kind-of-talent/list?title_no=5145` | 原样 | 是 | 我不是那種人才 / 119 话 |
| 完整 URL | `https://www.webtoons.com/zh-hant/fantasy/not-that-kind-of-talent/list?title_no=5145` | 剥域名与语言段 | 是 | 同上 |
| 纯 title_no | `5145` | 题材/别名用占位段，站点 301 归一化到真实路径 | 是 | 同上 |
| 组合 ID | `5145\|not-that-kind-of-talent` | 取 title_no | 是 | 同上 |
| 完整章节 URL | `.../list?title_no=5145` 与 `.../{ep}/viewer?title_no=5145&episode_no=1` | 提取 title_no/episode_no | 是 | 与普通目录一致（65 张） |
| 非法/缺失参数 | `abc-not-a-comic`、空章节号 | 无 | 否 | 安全空图片数组（实测请求数 +0） |

## 动态响应安全策略

- 禁止执行站点响应中的 `eval`、`Function`、内联脚本或未审核变量；本源全文无这两者（回归已断言）。
- 首页卡片归属主题材只在站点自带的 URL 段落上做字符串映射，不解析页面内联脚本。
- 每个 `HtmlDocument` 使用后立即 `dispose()`；异常路径也通过 `finally` 释放。

## 本期改动

| 改动 | 真实依据 | 影响范围 | 验证结果 |
|---|---|---|---|
| 新增 `zonePath()`，取 HTML 前剥掉路径里已有的 `/zh-hant` 语言段 | 内部回归中详情/章节全部 HTTP 500；curl 取证双前缀 URL `/zh-hant/zh-hant/...` 返回 **500 4641B**，单前缀返回 200 41586B | `fetchHtml` 全链路（详情、阅读页、HTML 兜底搜索、章节目录兜底） | 详情 5145/546、4 组章节、4 组历史输入全部由 500 转为通过 |
| 新增 `cardSubTitle()` + `genreLabelFromPath()` 副标题兜底链 | 逐区块取证：首页「即時熱門/今日漫畫/投稿新星」第二行是 `.info_text > .genre`，「分類人氣排行榜」是 `.view_count`，「最新上線」整张卡片只有 `img[alt]`；分类页与搜索页第二行才是 `.info_text > .author` | 全部列表卡片副标题 | 覆盖率 0/74 → 74/74 |
| URL 段落题材 slug 归一化（下划线 ↔ 连字符） | 站点 URL 用 `romance-m`，题材表用 `romance_m`；未归一化时「最新上線」11 张卡片取不到题材 | `genreLabelFromPath` | 无副标题卡片 11 → 0 |
| 搜索「搜尋範圍」不再声明 `default` | Venera 解析 `optionList` 时对 `default` 做了 `jsonEncode`（parser.dart），声明字符串会导致首屏没有任何 chip 处于选中态 | 搜索选项 UI | 选项值以 `ALL/WEBTOON/CHALLENGE` 正常传入，`load` 内部缺省即 ALL |
| `ComicDetails` 同时给出 `subtitle` 与 `subTitle` | `assets/init.js` 中 `this.subtitle = subtitle ?? subTitle`；`models.dart` 只读 `json["subtitle"]` | 详情页副标题/作者显示 | 作者显示正常（Emong / Heejin / Denphy ...） |

## 重点验证

- [x] 首页区块与卡片数量正确（5 区块 / 74 卡片 / 每区块内部 id 唯一）。
- [x] 搜索返回有效漫画 ID 与完整封面（`/zh-hant/...` + `webtoon-phinf` 直链）。
- [x] 分类第 1、2 页均可解析。
- [x] 最大页码来自真实 API `totalCount`（WEBTOON 181 / CHALLENGE 704，每页 20 ⇒ 36 页），未使用 `page+1`。
- [x] 详情章节数正确（5145 = 119，546 = 618）。
- [x] 章节图片数量与页面一致（237 / 70 / 65 / 190）。
- [x] 无加密，无需解密；至少一张章节图片与其封面、列表缩略图均实测 200。
- [x] 响应不含动态 nonce/表达式（本项不适用，已确认无此类响应）。
- [x] 未识别的动态表达式会安全失败（无动态表达式；非法 ID 抛中文提示且不发请求）。
- [ ] Venera 客户端导入通过（**待验证**：需在真机客户端导入后点击链路确认）。

> 未勾选项以「待验证」发布，见下方 D.17.4 表最后一行。

## 编译后验收记录

| 检查项 | 命令/输入 | 实际输出 | 状态 | 失败修复或限制 |
|---|---|---|---|---|
| JavaScript 语法/编译 | `node --check webtoons_zh_hant.js` | exit 0，无输出 | 通过 | 无 |
| Venera 类加载 | VM 桩加载 `WebtoonsZhHant` 并断言元数据 | name=LINE WEBTOON / key=webtoons_zh_hant / 1.0.0 / 1.6.0；categories 与 categoryParams 等长 | 通过 | 无 |
| 首页 | `GET /zh-hant/`（经代理 7890） | 5 区块 / 74 卡片 / 每区块 id 唯一 / 副标题 74/74 | 通过 | 修复副标题兜底链 |
| 搜索 | 中文关键词「愛情」「我」「zzznotexistxyz123」、空关键词 | 愛情(WEBTOON) n=10 maxPage=1；我(ALL) p1=40 p2=40 maxPage=36；无结果 n=0；空关键词 0 请求 | 通过 | 分页重复是站点排名列表边界行为（见下方说明） |
| 分类 | `g:romance`/`g:fantasy`/`d:monday`/`r:trending`/`rg:ROMANCE` + 终止页 | 934 / 437 / 138 / 30 / 30，全部 maxPage=1；fantasy 第 2 页与第 1 页同内容 | 通过 | 站点无分页控件，已用「第 2 页同内容」作为终止依据 |
| 详情 | `/zh-hant/fantasy/not-that-kind-of-talent/list?title_no=5145`、`title_no=546` | 我不是那種人才（119 话，最新章节排最前）/ 看臉時代（618 话）；封面、简介、题材、作者、更新日齐全 | 通过 | 修复前为 HTTP 500 |
| 最新/中间/较早章节 | 5145 #119 / #60 / #1，546 #618 | 237 / 70 / 65 / 190 张，全部为 CDN 直链、无重复、首图非提示图 | 通过 | 修复前为 HTTP 500 |
| 封面和章节图片 | 章节首图与详情封面、列表缩略图 | 章节图片带 Referer 200 image/png 69343B；不带 Referer 403（反证）；封面 200 image/jpeg 78747B；缩略图 200 image/jpeg 79472B | 通过 | 已对所有 `webtoon-phinf` 请求补 Referer |
| 历史参数 | 规范 ID / 完整 URL / 纯 title_no / 组合 ID / 非法值 | 前 4 种均解析为「我不是那種人才」+119 话；非法值抛中文提示且不发请求；空章节参数 0 请求 | 通过 | 见主日志第 8 节 |
| Venera 客户端导入 | 实际源文件导入后在真机点击搜索/分类/详情/章节 | 未执行（本轮只做 HTTP 桩回归） | **待验证** | 需用户在客户端导入后确认；本表通过项均为桩环境真实网络结果 |

回归汇总：**通过 70 / 失败 0 / 共 70**，实际网络请求 47 次（脚本 `verify_webtoons.js`，代理模式）。

### 需要同时告知用户的站点侧行为（不是源缺陷）

1. 首页跨区块存在官方重复推荐（同一作品同时出现在「即時熱門」和「最新上線」），因此只断言区块内部 id 唯一。
2. 搜索 API 的排名列表不是严格分区：同一 `start` 重复请求结果稳定（3 次 20/20 相同），但 `start=0` 与 `start=20` 窗口边界会重合 1 条（20 条中 1 条）。源的页内去重正常，跨页轻微重合来自站点。
3. ALL 模式是两个独立结果集（WEBTOON 每页 20 + CHALLENGE 每页 20）合并，同一作品可能同时出现在两个结果集，实测第 1/2 页重合 2 条。

### 中国大陆直连的真实表现（`verify_webtoons.js --direct` + `probe_wt_direct.js`）

| 能力 | 直连结果 | 说明 |
|---|---|---|
| 首页 | 可用（走 `zh-hant-hk` 镜像，200 43527B） | 源自动镜像重试 |
| 每日更新 | 可用（`zh-hant-hk/originals/*` 200 19751B） | 源自动镜像重试 |
| 搜索 | 可用（`m.webtoons.com/zh-hant-hk/search/result` 经 302 后返回 JSON） | 主搜索结果正常 |
| 题材/排行榜/榜单依题材 | 不可用（`zh-hant-hk` 301 落地到被拦的 `zh-hant`） | 抛中文地区限制提示 |
| 详情 / 章节目录 / 阅读页 | 不可用（`zh-hant-hk` 301 落地到被拦的 `zh-hant`） | 抛中文地区限制提示 |
| 章节 API（`m.webtoons.com/api/v1/...`，无语言段） | 可用（200 JSON） | 但依赖详情页才能进入阅读 |
| 漫画图片 CDN | 不可达（`webtoon-phinf` ECONNREFUSED，`swebtoon-phinf` timeout） | 直连无法阅读正文图片 |

**结论：本源在中国大陆直连下无法完成阅读链路，必须让 Venera 走非中国大陆网络。** Venera 的默认网络客户端 `AppDio` 使用 `getProxy()` 并在客户端网络设置里读取代理，因此用户只要在应用内启用代理，本源无需改代码即可正常工作。

## 本期文件

- 源文件：`webtoons_zh_hant.js`
- 回归脚本：`verify_webtoons.js`（代理模式 70/70；`--direct` 记录地区限制表现）
- 网络取回层：`wt_fetch.js`、`wtproxy.js`
- 分页取证：`probe_wt_searchpage.js`、`probe_wt_direct.js`
- 离线解析取证：`an_wt_selectors.js`、`an_wt_sub.js`、`an_wt_card_author.js`、`an_wt_card_sec.js`
- 页面样本：`webtoons_evidence/v2/`（首页、搜索、题材、日程、排行、详情、阅读页）
