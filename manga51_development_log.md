# 51漫画（m.51manga.com）Venera 源开发日志

> 版本：v1.2.0（基于 `meaninglesslyy/venera-config` 的 `normal_comic/51manga.js` v1.1.0 优化）
> 内部 Key：`manga51`（沿用上游，不修改，避免用户设置/收藏/历史失效）
> 取证日期：2026-09-22，真网直连（www 与 m 双站均 200，不需要代理）
> 开发原则：所有结论均由真实页面与接口响应证实；未证实的项标「待验证」。

---

## 1. 站点取证总览

| 项 | 实测结果 |
|---|---|
| PC 站 | `https://www.51manga.com/` → 200；`https://51manga.com/` → 301 到 www |
| 移动站 | `https://m.51manga.com/` → 200（本源统一用它，结构最简） |
| 模板 | layui + Mccms，列表卡片 `.comic-item`，懒加载属性 `lay-src` |
| 图片 CDN | `img1.baipiaoguai.org`，**强制校验 Referer** |
| 分页标记 | `<cite>当前页/总页数</cite>` |
| 全站量级 | `/category` 共 50 页 × 30 条 ≈ 1500 部 |

两站结构不同（PC 站用 `.dm-list` / `.dm-title`，移动站用 `.panel` / `.comic-item`），本源只解析移动站，避免维护两套选择器。

## 2. 站点证据清单

| 页面 | 实际 URL | HTTP | 单项选择器/字段 | 样本 | 保存位置 |
|---|---|---:|---|---:|---|
| 首页 | `https://m.51manga.com/` | 200 | `.panel` → `.panel-heading h2` + `.comic-item` | 5 区块 / 24 卡片 | `m51_evidence/home_m.html` |
| 分类第 1 页 | `/category` | 200 | `#comic-list` → `.comic-item`，`<cite>1/50</cite>` | 30 条 / 50 页 | `m51_evidence/category.html` |
| 分类第 2 页 | `/category/page/2` | 200 | 与第 1 页不重复 | 30 条 | 实测 |
| 地区分类 | `/category/list/{1..4}` | 200 | 标题依次 国产/日本/韩国/欧美漫画 | 30/30/30/14 条 | 实测 |
| 题材分类 | `/category/tags/{867..877}` | 200 | 分类页筛选区共 11 个标签 | 30 条 / 31 页 | 实测 |
| 进度分类 | `/category/finish/{1,2}` | 200 | finish/1=连载、finish/2=完结 | 30 / 14 条 | 实测 |
| 组合筛选 | `/category/list/1/tags/867` | 200 | 顺序可变（`/category/tags/867/list/1` 同效） | 30 条 / 2 页 | 实测 |
| 最近更新 | `/custom/update` | 200 | `#content-container` → `.comic-item`，**无 `<cite>`** | 30 条，无分页 | 实测 |
| 搜索第 1 页 | `/search?key={kw}` | 200 | `#comic-list` → `.comic-item` | 「爱」28 条 / 10 页 | 实测 |
| 搜索第 N 页 | `/search/{kw}/{n}` | 200 | `<cite>n/总页数</cite>` | 「爱」第 2 页 30 条 | 实测 |
| 详情 | `/mh/{id}` | 200 | `.comic_name h1.name` / `.comic_cover` / `.metas-desc > p` / `.comic_hot` / `.zuixin time` / `.chapter-list a[href*=/show/]` | 斗罗大陆 605 章 | `m51_evidence/detail_douluo_m.html` |
| 章节 | `/show/{epId}.html` | 200 | 内联 `params` 变量（AES-128-CBC） | 单话 19~156 张图 | `m51_evidence/chapter_m.html` |
| 图片 | `img1.baipiaoguai.org/...` | 200/403 | 带 51manga 域名 Referer 才 200 | 全部 `.webp` | `m51_evidence/chapter1_images.json` |

## 3. 图片与加密判断

- **图片数据位置**：章节页内联脚本里的 `params` 变量（不是 DOM，也不是独立 JSON 接口）。
- **是否加密**：**是**，AES-128-CBC。这是真实加密，不是自造混淆。
- **算法**：`base64 解码 → 前 16 字节为 IV → 其余为密文 → AES-128-CBC 解密 → PKCS#7 去填充 → JSON`。
- **Key 来源**：站点章节脚本里的固定字符串 `9S8$vJnU2ANeSRoF`（16 字节，正好 AES-128）。实测该 key **当前仍然有效**。
- **解密 API**：优先 `Convert.decryptAesCbc(value, key, iv)`（官方 ccc.js 同款，需自行 PKCS#7 去填充），失败或不可用时回退到内置纯 JS 实现。
- **运行时协议**：无 nonce、无动态表达式、无时间戳参与密钥。

### 3.1 明文结构（单话实测）

```json
{ "host": "m.51manga.com", "source_id": "12", "comic_id": "615495", "comic_down": 0,
  "chapter_id": "220039", "images": ["https://img1.baipiaoguai.org/..."], "lazy": false }
```

### 3.2 图片防盗链（必须保留的结论）

| 请求头 | 结果 |
|---|---|
| `Referer: https://m.51manga.com/show/{id}.html` | 200 image/webp |
| `Referer: https://www.51manga.com/` | 200 image/jpeg / image/webp |
| **不带 Referer** | **403 text/html 4550B** |
| `Referer: https://img1.baipiaoguai.org/`（图片自身域名） | **403** |

封面同样如此（不带 Referer 也是 403），所以 `onThumbnailLoad` 也必须补 Referer。

## 4. 协议样本清单

| 样本 ID | 原始响应保存位置 | 动态字段 | 还原后格式 | 图片数 | 状态 |
|---|---|---|---|---:|---|
| 斗罗大陆第 1 话 | 回归脚本实时抓取 | 固定 key，无 nonce | JSON（images 为绝对 URL 数组） | 19 | 通过 |
| 斗罗大陆中间话 | 回归脚本实时抓取 | 同上 | 同上 | 36 | 通过 |
| 斗罗大陆最新话 | 回归脚本实时抓取 | 同上 | 同上 | 39 | 通过 |
| 丑闻制造者回归第 1 话 | `m51_evidence/chapter_m.html` | `source_id=12`、`lazy=false` | 同上 | 50 | 通过 |
| 从大树开始的进化（抽样） | 实测 | 同上 | 同上 | 111~156 | 通过 |

跨板块抽样（`list/2`、`list/3`、`list/4`、`tags/867`、`finish/2`）共 8 本 16 话，**全部** `source_id=12`、图片域名为 `img1.baipiaoguai.org`、且都是绝对 URL、`lazy=false`。

## 5. 字段可信度与跨页面验证

| 用户可见字段 | 首次来源 | 是否直接采用 | 交叉验证 | 最终来源 | 已验证 |
|---|---|---|---|---|---|
| 列表封面 | `.comic-item img` | 否 | `lay-src` 与 `src` 同值；站内为 layui 懒加载模板 | `lay-src > data-src > src`（并排除占位图） | 是 |
| 详情封面 | `.comic_cover` 的 `background-image` | 否（需补全） | 实测 328×422，可进历史封面网格 | 正则提取 + 相对路径补全 | 是 |
| 章节目录 | `.chapter-list a[href*=/show/]` | 是 | 与站点 `最新话` 声明一致（斗罗 605 话） | 页面 DOM | 是 |
| 图片列表 | 章节页 `params` | 否（需解密） | 与 node:crypto 参考实现逐项一致 | AES 解密 + JSON | 是 |
| 作者 / 标签 / 更新时间 | `.comic_hot` / `a[href*=/category/tags/]` / `.zuixin time` | 是 | 6 本样本均存在 | 页面 DOM | 是 |

## 6. 历史阅读输入矩阵

| 输入形态 | 示例 | 标准化结果 | 发请求 | 实测输出 |
|---|---|---|---|---|
| 裸章节 ID | `GE4YdH3n2Q` | 原样 | 是 | 19 张 |
| 带扩展名 | `GE4YdH3n2Q.html` | 去掉 `.html` | 是 | 19 张（与裸 ID 一致） |
| 移动站完整 URL | `https://m.51manga.com/show/GE4YdH3n2Q.html` | 取出 id | 是 | 19 张 |
| PC 站完整 URL | `https://www.51manga.com/show/GE4YdH3n2Q.html` | 取出 id | 是 | 19 张 |
| 非法：空 / 空白 / 乱码 | `""`、`"   "`、`"###"` | 无法规范化 | **否** | 安全空图片数组 |
| 非法：不存在的章节 | `ZZZZnotexist` | 规范化后请求 | 是（1 次） | 页面 404 → 安全空图片数组 |

> 关键依据：站点只认 `/show/{裸id}.html`。实测 `/show/{id}`（无扩展名）与 `/show/{id}.html.html` **都是 404**，所以带 `.html` 的历史值必须先剥离。

## 7. 动态响应安全策略

- 禁止执行站点响应里的 `eval`、`Function`、内联脚本或未审核变量；本源未引用任何站点脚本。
- AES 由上一步实测确认的固定算法实现，不含任何动态表达式求值。
- 所有解析失败、非法参数、越界页都返回 Venera 合规空结构（列表 `{comics: [], maxPage: n}`、图片 `{images: []}`）。
- 每个 `HtmlDocument` 都在 `finally` 中 `dispose()`（静态检查 new=3 / dispose=3）。

## 8. 本期改动（对照上游 v1.1.0）

### 8.1 必须修的缺陷

| # | 上游问题 | 真实证据 | 本版处理 |
|---|---|---|---|
| 1 | **`HtmlDocument` 从不 `dispose()`**（`parseComicList`、`explore.load`、`loadInfo` 三处）——违反开发日志的硬性要求 | 上游源码 3 处 `new HtmlDocument` 后直接 return | 全部改为 `try/finally` 中 `dispose()` |
| 2 | **越界页被当成有效结果**：`parseMaxPage` 找不到 `<cite>` 时回退成「当前页」 | `/category/page/51` 与 `/search/爱/11` 实测**回落成首页**：5 个 `.panel`、容器 id 变成 `comic-list-1`、无 `<cite>`、返回 24 张与关键词无关的漫画且 maxPage=51/11 → 无限翻页 | 新增 `isHomeFallback()` 识别回落首页；新增 `pageState()` 统一按 `<cite>` 判定，越界（`cur > total`）或回落一律返回空 + 真实 maxPage |
| 3 | **搜索越界页直接 500**：`/search/斗罗/2`（该词只有 1 页）返回 `500 Database Error`，上游会抛错给用户 | 实测 500 | `status >= 500` 视为没有更多结果，返回 `{comics: [], maxPage: page-1}` |
| 4 | **`loadEp` 不规范化 epId**：只接受裸 id，历史里若存了完整 URL 或带 `.html` 的值会拼成 `/show/x.html.html` | `/show/{id}` 与 `/show/{id}.html.html` 实测 **404** | 新增 `normalizeEpId()`，四种历史形态实测均可解析且与裸 id 结果一致 |
| 5 | **`utf8BytesToString` 使用已废弃的 `escape`/`unescape`** 全局函数，Venera 的 JS 引擎不保证提供；一旦缺失整话解密崩溃 | 上游源码 `decodeURIComponent(escape(str))` | 改为手写 UTF-8 解码器 |
| 6 | **封面取值顺序 `src \\|\\| lay-src \\|\\| data-src`**：站点是 layui 懒加载模板，`lay-src` 才是真实图；且未排除占位图 | 首页同时存在 `src` 与 `lay-src`（当前恰好同值） | 改为 `lay-src > data-src > data-original > data-echo > src`，并新增 `isPlaceholderImage()` 排除 `data:`/`.svg`/placeholder |
| 7 | **模块级可变状态 `lastChapterPageUrl`**：跨漫画/跨话串 Referer，从历史直接进入时为空 | 实测固定 `Referer: https://www.51manga.com/` 同样 200 | 改为固定 Referer，去掉全局可变状态 |

### 8.2 按开发日志补齐的能力

| # | 项 | 处理 |
|---|---|---|
| 8 | **分类组合筛选**（上游 `categoryComics.load` 忽略 `options`、`optionList: []`） | 站点实测支持 `/category/list/1/tags/867`、`/category/list/1/finish/1`；新增 `optionList`（题材 / 进度）与同维度去重逻辑，`地区 + 题材`、`地区 + 进度` 实测均可用 |
| 9 | **优先使用官方解密能力**（开发日志 §7 / D.9） | 优先 `Convert.decryptAesCbc`，不可用或失败时回退内置纯 JS AES；两条分支各跑一遍完整回归 |
| 10 | **AES 实现瘦身** | 去掉 256 字节硬编码 S-box，改为运行时由 GF(2^8) 求逆 + 仿射变换生成（并用 FIPS-197 向量校验） |
| 11 | **异常分支返回合规空结构**（开发日志 §8） | 解析失败返回空数组，只有 HTTP 状态异常才抛错 |
| 12 | **详情字段补全** | 增加 `subtitle`/`subTitle`（作者）、`updateTime`（`.zuixin time`）、`url`（PC 站详情页），封面加兜底解析 |
| 13 | **`link` / `idMatch`** | 按官方 `_venera_` 模板把 `link` 放进 `comic`（官方模板里 `link` 属于 Comic Details 段），并补 `idMatch` 供用户直接粘贴 id |
| 14 | **交付物** | 新增回归脚本 `verify_manga51.js` 与本专项日志 |

## 9. 重点验证

- [x] 首页 4 个地区区块 + 24 张卡片，且分区带 `viewMore` 跳分类。
- [x] 搜索中文关键词有结果、第 2 页不重复、越界页安全返回空。
- [x] 分类 11 个样本（地区 5 + 题材 2 + 进度 2 + 组合 2）均非空。
- [x] `maxPage` 来自真实 `<cite>` 总数（科幻 31 页）。
- [x] 详情 605 章完整目录；非法 id 抛错。
- [x] 最新/中间/较早三话图片 19/36/39 张，去重且可下载。
- [x] 加密载荷解密结果与 `node:crypto` 参考实现逐项一致。
- [x] 历史四种形态均可解析；5 种非法输入安全返回空。
- [x] 图片 CDN 必须带 51manga 域名 Referer（403 反向验证）。
- [ ] Venera 客户端导入 —— **待验证**（需在客户端确认）。

## 编译后验收记录

| 检查项 | 命令/输入 | 实际输出 | 状态 | 失败修复或限制 |
|---|---|---|---|---|
| JavaScript 语法/编译 | `node --check manga51.js` | 通过 | 通过 | — |
| Venera 类加载 | `node verify_manga51.js` | 类可实例化，`name=51漫画`、`key=manga51`、`version=1.2.0` | 通过 | — |
| 首页 | `https://m.51manga.com/` | 4 分区 / 24 卡片 / 封面抽样 9/12 可下载 | 通过 | 站点侧 4 张死图（见限制） |
| 搜索 | 「爱」第 1/2 页、越界页 11、500 关键词「斗罗」第 2 页、空词、乱码词 | 28 条 maxPage=10；第 2 页 30 条不重复；越界 0 条 maxPage=10；500 → 0 条 maxPage=1；空词与乱码词均安全空 | 通过 | 修复了越界回落首页与 500 未处理 |
| 分类 | 地区 5 + 题材 2 + 进度 2 + 组合 2 + 第 2 页 + 两个越界页 | 全部非空；第 2 页 maxPage=31；越界(51) 0 条 maxPage=50；越界(32) 0 条 maxPage=31 | 通过 | 修复了越界回落首页 |
| 详情 | `gAoAREM36q`（斗罗大陆）/ `LANag3RJ6r` | 605 章 / 30 章；标题、封面、简介 118 字、标签 热血·玄幻·修真·冒险、作者 风炫文化、更新时间均正确；封面 200 image/jpeg | 通过 | — |
| 最新/中间/较早章节 | 斗罗大陆 第 1 / 中间 / 最新话 | 19 / 36 / 39 张，全部 https 且去重 | 通过 | — |
| 封面和章节图片 | 首图/尾图 + Referer 反向测试 | 200 image/webp 137984B / 103308B；无 Referer 403；非 51manga Referer 403 | 通过 | — |
| 历史参数 | 裸 id / `.html` / m 站 URL / PC 站 URL + 4 种非法值 | 前四种均 19 张且一致；非法值安全空数组 | 通过 | 修复了 epId 未规范化 |
| AES 双分支 | `node verify_manga51.js` 与 `node verify_manga51.js --no-convert` | 两条分支各 **73/73 通过**，且均与 node:crypto 一致 | 通过 | — |
| 静态安全 | 注释剥离后检索 + dispose 计数 | 无 `eval(`/`new Function`/`escape(`/`unescape(`；`new HtmlDocument` 3 = `dispose()` 3 | 通过 | — |
| Venera 客户端导入 | 实际源文件 | — | **待验证** | 需用户在客户端确认 |

> 复现命令：`node verify_manga51.js`（官方解密分支） / `node verify_manga51.js --no-convert`（纯 JS 分支）

## 10. 已知限制

- **站点侧死图**：实测首页 24 张封面里 4 张在 `img1.baipiaoguai.org` 上固定返回 `500 获取图片时出错`（原图在源站已缺失）。已验证换扩展名、去 query、改 `upload2` 路径、`img2/img3/img.` 等镜像主机都不可用，且详情页用的是同一张图，源内无法规避。
- **站点的「进度」筛选数据很弱**：`finish/1`（连载）只有 2 页、`finish/2`（完结）只有 1 页，与全站 50 页不成比例；`tags/867 + finish/1` 组合实测 0 条。这是站点自身的数据问题。
- **站点偶发空响应**：`/search/{kw}/{page}` 曾出现一次 24 字节的空页响应，源内会安全返回空结果（回归脚本对此加了重试）。
- **未提供排行榜页**：站点没有独立排行榜入口，故 `enableRankingPage: false`。
- **`idMatch` 语义待验证**：按官方文档定义为「用于识别用户输入的漫画 id 的正则字符串」，已在源码中提供 `^[A-Za-z0-9]{4,32}$`，但未在客户端实测其具体行为。
- **PC 站未解析**：PC 站结构与移动站完全不同，本源统一走移动站；PC 站仅用于图片 Referer 与 `ComicDetails.url`。

## 参考资料

[1] Venera Comic Source 文档 <https://github.com/venera-app/venera/blob/master/doc/comic_source.md>
[2] Venera JavaScript API / 类型定义 <https://github.com/venera-app/venera-configs/blob/main/_venera_.js>
[3] 官方 CCC 追漫台源 `ccc.js`（`Convert.decryptAesCbc` 参考写法）
[4] 上游源 `meaninglesslyy/venera-config` → `normal_comic/51manga.js` v1.1.0
