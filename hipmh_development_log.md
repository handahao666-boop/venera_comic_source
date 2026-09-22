# 嬉皮漫畫（m.hipmh.com）Venera 源开发日志

> 版本：v1.0.1
> 内部 Key：`hipmh`，显示名称：嬉皮漫畫
> 取证日期：2026-09-22（真网直连，站点可大陆直连，无需镜像/代理回退）
> 开发原则：所有结论均由真实页面、接口响应与站点前端脚本证实；未经证实的项一律标「待验证」。

---

## 1. 站点取证总览

| 项 | 实测结果 |
|---|---|
| 主站 | `https://m.hipmh.com`（PC `www.hipmh.com` → `hipmh.com`），HTTP 200，可大陆直连 |
| 框架 | Astro SSR + 客户端 XHR 混合：首页/人气榜服务端渲染，列表/搜索/分类/详情章节走 API |
| 数据 API 基址 | `https://hipapi1.s3file.top`（`/v1/mangas`、`/v1/search`、`/v1/manga/chapters`、`/v2/chapter`）|
| 封面 CDN | `https://cover.s3imgs.top`（相对路径需补全）|
| 图片 CDN | `hip-tx-1.s3imgs.top` / `hip-cf-1.s3imgs.top`（及 `-s1` 变体），实测**无防盗链**（不带 Referer 也返回 200 image/webp）|
| 阅读站 | `reader.hipmh.top`（真实阅读页宿主；本源不需要它，见 §6 hid 推导）|
| 全站漫画总数 | `total = 1394`（`/v1/mangas?sort=updated&per_page=3`）|

## 2. 站点证据清单

| 页面 | 实际 URL | HTTP 状态 | 单项选择器/字段 | 样本数量 | 保存位置 |
|---|---|---:|---|---:|---|
| 首页 | `https://m.hipmh.com/` | 200 | `<h2>` 分区 + `a[href^="/works/"]` + 卡片内 `img[src]` | 6 分区 / 46 卡片 | `hip_evidence/home.html` |
| 搜索 | `https://hipapi1.s3file.top/v1/search?q=斗罗&page=1&page_size=20` | 200 | `data.data[]`：`id/title/vertical_image_url/authors/genres/status` | 20 条 / 5 页 | `hip_evidence/search_yiren.html`、实测响应 |
| 搜索（空结果） | `?q=zzzz不存在的漫画xyz` | 200 | `data.data = []`，`total=0` | 0 条 | 实测 |
| 搜索（空关键词） | `?q=` | **400** | 站点直接拒绝 | — | 实测，源内提前判空 |
| 分类第 1 页 | `/v1/mangas?genre=2&page=1&per_page=18` | 200 | `data.items[]` 同卡片字段 | 18 条 / 3 页 | `hip_evidence/genre_wuxia_p1.html` |
| 分类第 2 页 | `/v1/mangas?genre=2&page=2` | 200 | 与第 1 页不重复 | 18 条 | `hip_evidence/genre_wuxia_p2.html` |
| 分区（国漫/日漫/韩漫） | `/category/cn|jp|ko` → `data-category-id` | 200 | `2 / 3 / 1` | 3 个 | `hip_evidence/taxonomy.json` |
| 详情 | `https://m.hipmh.com/works/bToyMzQ3NQ-yi-ren-zhi-xia-tx-531490-17793` | 200 | `#chapters-config[data-mid|data-manga-id|data-title|data-cover]`、`h1`、`meta[name=description]`、`a[href^=/author/]`、`a[href^=/genre/]`、`a[href=/ongoing\|/completed]` | 1 部（一人之下） | `hip_evidence/detail_yiren.html` |
| 章节列表 | `/v1/manga/chapters?mid=bToyMzQ3NQ&page=1&per_page=50&order=asc` | 200 | `data.items[]`：`hid/chapter_number/title` | 815 章 / 17 页 | `hip_evidence/chapters_desc_p1.json` |
| 章节图片 | `/v2/chapter?hid=YzoxOTIzNDQ-MjM0NzU6ODMxLjAw` | 200 | `data.images`（编码串）+ `order_id/sid/line/chapter_id` | 18 张有效图 | `hip_evidence/imgapi_v2_chapter_apiHid_.json` |

## 3. 图片与加密判断

- **图片数据位置**：JSON API（`/v2/chapter`），不在 DOM、也不在懒加载属性里。
- **是否加密**：**否**。属于「站点自定义载荷混淆」：编码后的 base64 文本 + 1 张噪声占位图，本质不是 AES/RSA/XOR。
- **运行时协议**：无 nonce、无动态表达式；解码参数全部来自同一响应（`order_id`、`sid`）。

### 3.1 解码算法（四步，已在纯 JS 中复现，禁用 eval / new Function）

还原自站点运行时脚本 `https://reader.hipmh.top/assets/runtime/chapter-decoder.js`（obfuscator.io 混淆，反混淆后取得常量）与阅读页脚本 `_ChapterHidPage.*.js`。

令 `payload = data.images`：

1. **去头尾 + 分段重排**：头 3 字符固定 `qM9`，尾 2 字符固定 `Z7`。取中间 `body`，`N = body.length - 2 - 3`（2 = 分隔符 `Vx`，3 = 第二分隔符 `pL0`）。
   `a = ⌊N/3⌋`，`b = ⌊(N-a)/2⌋`，`c = N-a-b`；把 `body` 切成 `p1 = body[0,b)`、`sep = body[b,b+2)`（必须等于 `Vx`）、`p2 = body[b+2, b+2+c)`、`suf2 = body[b+2+c, b+2+c+3)`（必须等于 `pL0`）、`p4 = body[b+2+c+3, ]`（长度必须等于 `a`）；输出 `p4 + p1 + p2`。
2. **分块反转**：以 7 字符为块，**除第 0 块外**逐块反转（`k % 2`）。
3. **字母表替换**：`_-9876543210abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ` → `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`。
4. **base64url → UTF-8 → JSON.parse**，得到图片路径字符串数组。

> 关键坑：第 1 步的模数写成了 `k % 2`。站点混淆里的字面量是 `(-0x1057+-0x1*0x1ee4+0x2f3d)`，易被误算成 `8368`；实际 `-0x1057 = -4183`，`-4183 - 7908 + 12093 = 2`。
> 另一个坑：`String.prototype.indexOf("") === 0`，base64 分块解码时若用 `charAt` 越界取值而不显式判长度，尾部会多出 2 个伪字节，导致 `JSON.parse` 报 “Unexpected non-whitespace character after JSON”。

### 3.2 噪声图剔除（官方算法等价实现）

站点每话会混入 1 张 **67 字节**的占位图，必须按官方 `H(images, order_id, sid)` 算法定位并删除：

```
D = (40503 << 16 | 31153) >>> 0 = 2654435761
R = (34283 << 16 | 51819) >>> 0 = 2246822507
len = images.length
b   = (BigInt(sid) * D ^ BigInt(len) * R) mod len
h   = order_id XOR b        # 下标，若 h>=len 则本话不删除
images.splice(h, 1)
```

本源用 **16 位分肢精确模拟 64 位乘法 + 32 位分肢 XOR + 分肢取模**，不依赖 `BigInt`（避免运行时缺失）。

## 4. 协议样本清单

### 4.1 成人（18+）作品的封面占位图机制

站点对成人作品做了「点击才显示」的前端遮挡，**接口和详情页不受影响，只有首页 SSR 卡片受影响**：

| 位置 | 成人作品的表现 | 本源处理 |
|---|---|---|
| 首页 SSR 卡片 | `<a data-adult="1">`；`<img src="/assets/img_thumbnail_19.svg" data-adult-img="1" data-real-cover="https://cover.s3imgs.top/…webp">`；真封面仅在站内开关 `localStorage.ts_manga_is_adult === "1"` 时被 JS 替换进 `src` | 直接取 `data-real-cover`，并显式排除占位图（`img_thumbnail` / 站内 `.svg` / `data:`）|
| 详情页推荐位 | `a[data-age-gate="1"]` + `img[data-age-img="1"]`（默认 `hidden` + 遮罩，同样靠该开关解锁） | 本源不解析推荐位，无影响 |
| `/v1/mangas`、`/v1/search` | 直接返回真实 `vertical_image_url`，成人作品也是真封面（`content_rating: "adult"` / `2`） | 直接使用 |
| 详情页主封面 | `#chapters-config[data-cover]`、`og:image` 均为真实 URL，无占位图 | 直接使用 |

> **v1.0.1 根因**：v1.0.0 的 `parseHomeSections` 取 `img.src`，成人卡片拿到的是 `/assets/img_thumbnail_19.svg`，经 `coverUrl()` 拼成 `https://cover.s3imgs.top/assets/img_thumbnail_19.svg` —— 实测 **404**（而站点自身 `https://m.hipmh.com/assets/img_thumbnail_19.svg` 是 200 SVG）。这正是「成人漫画封面加载不出来、原网站要点一下才出来」的原因。修复后不再依赖站点开关，也不需要用户先点一次。

实测证据：

| 样本 | 占位图 `src` | 真封面 `data-real-cover` | 真封面响应 |
|---|---|---|---|
| 重振皇帝陛下雄風的計畫 | `/assets/img_thumbnail_19.svg` | `cover.s3imgs.top/webtoon/vertical/zhong-zhen-huang-di-…-22916-….webp` | 200 image/webp 72 280B |
| 奴隸公主的夜之契約 | `/assets/img_thumbnail_19.svg` | `cover.s3imgs.top/webtoon/vertical/nu-li-gong-zhu-…-22817-….webp` | 200 image/webp 51 154B |
| 轉世宦官重振雄風（详情） | 无占位图 | `#chapters-config[data-cover]` | 200 image/webp 50 454B |

| 样本 ID | 原始响应保存位置 | 动态字段 | 还原后格式 | 章节 ID | 图片数（原始→去噪） | 首图 URL | 状态 |
|---|---|---|---|---|---:|---|---|
| `一人之下` 第 831 话 | `hip_evidence/imgapi_v2_chapter_apiHid_.json` | `order_id=9, sid=192344, line=1` | JSON 字符串数组 | 192344 | 19 → **18** | `…/YWViZDQzNWI2YV84MzFfMQ_1.jff5dc.webp` | 通过 |
| `一人之下` 第 796 话 | `hip_evidence/ch796_clean.json` | `order_id=21, sid=25907, line=1` | 同上 | 25907 | 18 → **17** | `…/YTg2NDM1ZWI0Ml84MDlfMQ_1.4qkhc3.webp` | 通过 |
| `一人之下` 第 1 话（较早） | 回归脚本实时抓取 | `line=1` | 同上 | 59595 | — → **17** | — | 通过 |

**页码连续性验证**：三话解码后路径尾部的 `_N` 序号均为 `1..N` 连续无缺（`1..18` / `1..17` / `1..17`），证明噪声图索引计算正确。
**整话全量下载验证**：第 831 话 18 张全部下载成功，`bad=0`，合计 4 522 040 字节，`content-type: image/webp`。

## 5. 字段可信度与跨页面验证

| 用户可见字段 | 首次来源 | 是否直接采用 | 交叉验证页面/文件 | 最终采用来源 | 已验证 |
|---|---|---|---|---|---|
| 首页分区 | 首页 `h2` + 卡片 | 是 | `home.html`（6 分区 46 卡片） | 首页 SSR HTML | 是 |
| 列表/搜索卡片 | `/v1/mangas`、`/v1/search` | 是 | 列表返回 `mid` 与搜索返回 `id` 同构（`b64u("m:{id}")-slug`），`/works/{两者}` 均 200 | API JSON | 是 |
| 封面 | `vertical_image_url`（相对）/ `#chapters-config[data-cover]`（绝对） | 否（需补全） | 补 `cover.s3imgs.top` 后 200 image/webp 34 416B / 48 594B | API + 详情页 | 是 |
| 章节目录 | `/v1/manga/chapters` | 是 | 详情页 `data-total-chapters=814`，API `total=815`（含第 0 话） | API JSON | 是 |
| 图片列表 | `/v2/chapter` 的 `data.images` | 否（需解码 + 去噪） | 三话页码连续 + 18 张全量下载 | 解码 + 噪声剔除 | 是 |

## 6. 章节 hid 推导（本源的关键设计）

站点有**两种** hid，必须区分：

| 形态 | 示例 | 用途 |
|---|---|---|
| 前端 hid（章节列表返回） | `bToyMzQ3NS1jOjE5MjM0NA-MjM0NzU6ODMxLjAw` | 阅读页 URL `/chapter/{hid}` |
| API hid（`/v2/chapter` 需要） | `YzoxOTIzNDQ-MjM0NzU6ODMxLjAw` | 图片接口 `?hid=` |

明文结构（均为**无填充 base64url**）：

```
前端 hid = b64u("m:{mangaId}-c:{chapterId}") + "-" + b64u("{mangaId}:{chapterNum}.00")
API  hid = b64u("c:{chapterId}")              + "-" + b64u("{mangaId}:{chapterNum}.00")
```

因为 `-` 既是分隔符也是 base64url 字符，**不能直接 split**。本源逐位置试切，且要求两段明文同时满足 `^m:\d+-c:\d+$`（或 `^c:\d+$`）与 `^\d+:\d+(\.\d+)?$`，再重新编码第一段。

**交叉验证**：由章节列表第 831 / 796 话推导出的 API hid 与阅读页 `#chapcontent[data-api-hid]` 属性**逐字符一致**。因此本源不需要额外请求阅读页，`loadEp` 只发 1 个请求。

## 7. 历史阅读输入矩阵

| 输入形态 | 示例 | 标准化结果 | 应否发请求 | 实测输出 |
|---|---|---|---|---|
| 前端 hid（普通） | `bToyMzQ3NS1jOjE5MjM0NA-MjM0NzU6ODMxLjAw` | API hid | 是 | 18 张图片 |
| 完整章节 URL | `https://reader.hipmh.top/chapter/{前端 hid}` | 提取路径段后同上 | 是 | 18 张图片（与普通一致） |
| API hid | `YzoxOTIzNDQ-MjM0NzU6ODMxLjAw` | 原样使用 | 是 | 18 张图片（与普通一致） |
| 非法/缺失参数 | `""`、`"   "`、`"not-a-hid"`、`"###"`、`"bToyMzQ3NQ"` | 无法解析 | **否** | 安全空图片数组 |
| 非法漫画 ID | `"###"` | 无法解析 | 否 | 抛错（由客户端提示重开作品） |
| 章节已被删除 | 404 / 410 | — | 是（1 次） | 安全空图片数组 |

## 8. 分类映射（硬性要求落地）

站点分类来自三套不同命名空间，必须按前缀区分，不能混用：

| part 名称 | 用户可见分类 | 站点参数 | 取证来源 | 数量 |
|---|---|---|---|---|
| 分區 | 國漫 / 日漫 / 韓漫 | `category=2 / 3 / 1` | `/category/{cn,jp,ko}` 页面 `data-category-id` | 3 |
| 狀態 | 連載中 / 已完結 | `status=ongoing / completed` | API 实测 `total`：ongoing 945、completed 316 | 2 |
| 標籤 | 高分國漫 / 高分韓漫 / 人氣榜新上榜 | `tag=45 / 69 / 108` | `/tag/{slug}` 页面 `data-tag-id` | 3 |
| 題材 | 143 个中文/繁中/英文题材 | `genre={id}` | `/genre/{slug}` 页面 `data-genre-id` + 逐 ID 校验 `total>0` | 143 |

题材字典通过 `/v1/search` 返回的 `genres[{id,name,slug}]` 全量枚举（共 157 个），再用 `/v1/mangas?genre={id}&per_page=1` **逐个校验**；其中 14 个题材当前无内容（117 Drama、187 Sci-fi、478 Isekai、480 Regression、481 Reincarnation、482 Revenge、484 Genius MC、485 Mystery、486 Tragedy、487 Overpowered、488 Martial Arts、489 Demon、494 Dungeons、495 Dark Fantasy），故不纳入分类，避免用户点进去永远空白。

**已知站点自身缺陷**：探索页存在入口 `/tag/wan-jie-bang-xin-shang-bang`（完结榜新上榜），但该页在站点自身返回 **404**，因此无法取得其数字 ID，本源不收录该标签。

## 9. 动态响应安全策略

- 禁止执行站点响应中的 `eval`、`Function`、内联脚本或未审核变量；本源未引用任何站点脚本。
- 解码器为**离线反混淆后手工复现**的固定算法，不含任何动态表达式求值。
- 所有未识别的载荷、非法 hid、越界页码、空关键词一律**安全失败**并返回 Venera 合规空结构。
- 每个 `HtmlDocument` 使用后均 `dispose()`（静态检查：`new HtmlDocument(` 与 `.dispose()` 数量均为 2）。

## 10. 本期改动

| 改动 | 真实依据 | 影响范围 | 验证结果 |
|---|---|---|---|
| 首页改为解析 SSR 6 分区 | `home.html` 中 6 个 `<h2>` + 46 张卡片 | `explore` | 通过（6 分区 46 卡片） |
| 列表/搜索改走官方 API | `/v1/mangas`、`/v1/search` 结构实测 | `categoryComics`、`search` | 通过（8 个分类样本 + 搜索 3 形态） |
| 分类按 `category/status/tag/genre` 四套前缀 | 三套命名空间 + 143 个题材 | `category`、`categoryComics` | 通过 |
| maxPage 取自 API `total_pages` | `data.total_pages` 实测（如 genre=2 → 3） | 全部分页 | 通过 |
| 章节 hid → API hid 本地推导 | 与阅读页 `data-api-hid` 逐字符一致 | `comic.loadEp` | 通过 |
| 图片载荷四步解码 + 噪声剔除 | 反混淆站点解码器 + 67 字节占位图实测 | `comic.loadEp` | 通过 |
| 不依赖 BigInt 的 64 位等价实现 | 站点用 BigInt，Venera 运行时未验证 | `noiseIndex` | 通过 |
| **v1.0.1** 成人作品封面改用 `data-real-cover` | 首页 2 张 `data-adult="1"` 卡片实测占位图为 `/assets/img_thumbnail_19.svg`，真封面 200 | `explore`（首页 SSR 解析） | 通过（2/2 真下载） |

## 11. 重点验证

- [x] 首页区块与卡片数量正确（6 分区 / 46 卡片）。
- [x] 搜索返回有效漫画 ID 与完整封面（斗罗大陆 / `bTo2Njc-dou-luo-da-lu-661`）。
- [x] 分类第 1、2 页均可解析（8 个分类样本 + 第 2 页 + 越界页）。
- [x] 最大页码来自真实 API（`total_pages`，非 `page+1`）。
- [x] 详情章节数正确（815，站点声明 `data-total-chapters=814`）。
- [x] 章节图片数量与接口一致（19→18 / 18→17 / 17）。
- [x] 图片载荷解码可复现，且已下载真实图片（整话 18 张全成功）。
- [x] 每话 1 张噪声占位图被正确剔除（页码 `_1.._N` 连续）。
- [x] 未识别的载荷/非法参数会安全失败，绝不执行站点脚本。
- [x] 成人（18+）作品封面不依赖站点开关，探索页 / 搜索 / 详情三处均能真下载。
- [ ] Venera 客户端导入与真机点击 —— **待验证**（需在客户端执行）。

## 编译后验收记录

| 检查项 | 命令/输入 | 实际输出 | 状态 | 失败修复或限制 |
|---|---|---|---|---|
| JavaScript 语法/编译 | `node --check hipmh.js` | 无输出（通过） | 通过 | — |
| Venera 类加载 | `node verify_hipmh.js`（VM 桩 + cheerio） | 类可实例化，`name=嬉皮漫畫`，`key=hipmh` | 通过 | — |
| 首页 | `https://m.hipmh.com/` | 6 分区 / 46 卡片 / 封面 200 image/webp 34416B；探索页占位图残留 0 | 通过 | — |
| 成人作品封面（v1.0.1） | 首页 2 张成人卡片 + 成人详情 + 成人关键词搜索 | 探索页命中 2/2 且 200 image/webp（72280B / 51154B）；详情 200 50454B；搜索 200 72280B | 通过 | v1.0.0 取 `img.src` 拿到占位图 → 修复为优先 `data-real-cover` |
| 搜索 | `斗罗` / 空关键词 / 不存在关键词 / 第 2 页 | 20 条 maxPage=5；空词安全空；无结果安全空；第 2 页 20 条不重复 | 通过 | 源码内对空关键词提前返回，规避站点 400 |
| 分类 | 8 个分类 + 第 2 页 + 越界页 + 非法参数 | 全部非空；第 2 页 maxPage=3；越界页(8) 0 条；非法参数 0 条 | 通过 | — |
| 详情 | `bToyMzQ3NQ-yi-ren-zhi-xia-tx-531490-17793` | 一人之下 / 815 章 / 作者 米二·米橙子 / 战斗·搞笑 / 連載中；封面 200 | 通过 | — |
| 最新/中间/较早章节 | 第 831 / 中间 / 第 1 话 | 18 / 17 / 17 张，页码 `1..N` 连续 | 通过 | — |
| 封面和章节图片 | 首图/尾图/中间图 + 整话全量 | 首 388290B、尾 93186B、中 333728B；整话 18 张 bad=0，共 4522040B，全部 `image/webp` | 通过 | — |
| 历史参数 | hid / 完整 URL / API hid / 5 种非法值 | 前三种均 18 张且一致；非法值安全空数组 | 通过 | — |
| 静态安全 | 注释剥离后检索 + dispose 计数 | 无 `eval(` / `new Function` / `BigInt`；`new HtmlDocument` 2 = `dispose` 2 | 通过 | — |
| Venera 客户端导入 | 实际源文件 | — | **待验证** | 需用户在客户端导入后确认 |

> 回归汇总：**76 项断言全部通过**（含页码连续性、整话全量下载、成人封面三链路），真实网络请求 43 次。
> 复现命令：`node verify_hipmh.js`

### 本次回归暴露并修复的两个真实缺陷

1. **`toApiHid` 全部返回空** → 根因：`base64ToBytes` 用 `s.charAt(i)` 取越界字符，`indexOf("")` 返回 `0` 而不是 `-1`，尾部多出伪字节导致明文正则失配。修复：显式判断 `i + n < s.length`。
2. **部分章节 `JSON.parse` 报 “Unexpected non-whitespace character after JSON”** → 同一个根因（base64 长度非 4 的倍数时多出 2 字节）。修复后三话页码连续。

## 已知限制

- 章节数极多的作品（如 815 话）需要 17 次 API 请求拉取完整目录，源码以「并发 3 + 上限 40 页（2000 话）」控制耗时与风险；超过 40 页的作品目录会被截断（当前站点最长作品为 815 话，未触发）。
- 站点探索页的「完结榜新上榜」标签自身 404，本源未收录。
- 图片线路按响应 `line` 字段选择（1 → `hip-tx-1`，2 → `hip-cf-1`，9 → `hip-tx-s1`）；本源固定走 API `line1` 入口，未实测 `line=9` 分支（**待验证**）。

## 参考资料

[1] Venera Comic Source 文档 <https://github.com/venera-app/venera/blob/master/doc/comic_source.md>
[2] Venera JavaScript API 文档 <https://github.com/venera-app/venera/blob/master/doc/js_api.md>
