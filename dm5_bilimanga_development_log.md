# 动漫屋（dm5）与嗶哩漫畫（bilimanga）修复日志

> 日期：2026-09-27　真网直连取证
> 涉及版本：`dm5.js` v7.0.0 → **v7.0.1**；`bilimanga.js` v1.1.0 → **v1.1.1**
> 回归脚本：`verify_dm5_bilimanga.js`（35/35 通过）

---

## 一、动漫屋 dm5.js：封面显示异常

### 1.1 根因（取证）

m.dm5.com 的同一个 `<a>` 里会混入用途完全不同的图片，实测分类如下：

| 图片 class | 尺寸 | 数量 | 实际用途 |
|---|---|---:|---|
| `manga-list-1-cover-img` | 320x246 | 48 | **横版宣传图**（横构图插图） |
| `rank-list-cover-img` | 320x246 | 20 | 排行榜横版图 |
| （无 class） | 880x385 | 5 | 首页顶部横幅 |
| `index-menu-item-img` | — | 2 | **站点菜单图标**（根本不是漫画） |
| `manga-list-2-cover-img` | 180x240 | 36 | **真正的竖版封面** |

旧版 `explore/search/categoryComics` 全都用 `a.querySelector("img")` 取第一张图，于是横版宣传图、
880x385 横幅、菜单图标都会被当成封面。Venera 的封面是竖版网格，横图会被裁成一条怪异的横条——
这就是「封面显示有问题」。已实测下载对比：`320x246` 是横构图插画，`180x240` 才是书籍封面。

### 1.2 修复

* 新增 `isRealCover(url, className)`：排除 `_320x246` / `_880x385`、`/dm5/images/` 下的站点资源、
  `.gif`/`.svg`，以及 `manga-list-1-cover-img`、`rank-list-cover-img` 两个横版类名。
* 新增 `pickCover(anchor)`：按 `manga-list-2-cover-img` → `book-list-cover-img` → `detail-main-cover-img`
  → `detail-main-bg` 的顺序取竖版封面，取不到再遍历其它 img 逐个校验。
* 四个取值点（探索 / 搜索 / 分类两处）全部改用 `pickCover`；**没有合格封面就跳过该条目**。
* 顺带修掉一个去重 bug：旧逻辑在确认有封面之前就 `seen.add(id)`，导致同一本漫画先以「横版缩略图」
  出现时会把后面带正确封面的那条去重掉（实测探索页因此少 10 本）。

### 1.3 同页面顺带修复的解析失效（都有实测证据）

| 问题 | 证据 | 修复 |
|---|---|---|
| 详情页标题永远显示「漫画 {slug}」 | m 版详情页**没有** `h1` / `.book-title` / `.comic-title`，真实标题在 `.detail-main-info-title` | 选择器加入 `.detail-main-info-title`、`.normal-top-title` |
| 详情页封面为空或取到无关图 | 真实封面是 `.detail-main-cover img`（180x240）；旧选择器全不匹配，兜底逻辑按 URL 是否含 `cover` 命中 `/chaptercover/xxx.jpg` | 选择器加入 `.detail-main-cover img`、`img.detail-main-bg`；兜底改用 `isRealCover` |
| 章节列表串到别的漫画 | 旧版扫全页 `/m{id}/` 链接，命中页面下方「相关推荐」里其它作品的「最新 第N话」。实测海贼王拿到的 6 条全是《海贼王 艾斯》的章节（`/m1217572/` 打开是「海贼王 艾斯 第4话」） | 限定 `.detail-list-select a`；站点对限制漫画隐藏该容器时返回空，宁缺勿错 |
| 探索页把章节当漫画 | `/mN/` 章节链接也在 `isComicUrl` 的匹配范围内 | 章节链接没有配图，`pickCover` 返回空后自然被跳过（实测 0 误判） |
| 章节标题带更新日期 | 容器内 `<a>` 文本形如「第1回 … 2021-08-23」 | 去掉行尾 `YYYY-MM-DD` |
| 详情页缺作者/标签/正文简介 | 页面有 `.detail-main-info-author a`、`.detail-main-info-class a`、`.detail-desc` | 全部补上 |

### 1.4 回归结果

| 检查 | 结果 |
|---|---|
| 探索页卡片 | 35 张，**全部 180x240 竖版**，无横图/横幅/图标，无章节误判 |
| 搜索「海贼王」 | 22 条，封面全部真封面 |
| 分类第 1 页 | 21 条，**全部 180x240** |
| 详情 海贼王 | 标题「海贼王」、封面 180x240、作者 尾田荣一郎、标签 热血/冒险、简介 467 字 |
| 详情 元尊 | 标题「元尊」、**1315 章**完整、首章标题已去日期 |
| 限制漫画章节 | 0 章（站点 18+ 门禁隐藏），**不再返回其它漫画的章节** |
| 封面真下载 | 抽样 4 张全部 200 且实际像素高>宽（180x240 / 171x240） |

### 1.5 已知限制

* **限制漫画的章节列表拿不到**：m.dm5.com 对 `MComic.IsVulgar || MIsWarning` 的作品要求 18+ 确认，
  实测带 `isAdult=1` cookie 也不会让服务端渲染章节容器；只有 Googlebot UA 能拿到（站点给爬虫的 SEO 版本）。
  按开发日志「不伪装爬虫/不绕过访问控制」，本源不采用该做法，因此这类作品章节为空。
  受影响样本：海贼王（1194 话，站点隐藏）。
* **题材/地区分类参数无效**：现有 `categoryParams`（`tag-rexue`、`hktw`、`china`…）实测全部 404；
  题材的真实路径是 `/manhua-{slug}/`（如 `/manhua-rexue/`），地区/受众的正确参数尚未取证。
  本次未改动分类参数，留作后续单独修复。
* `categoryComics` 的 `maxPage` 仍是 `page + 1` 的经验值（站点列表页没有 `<cite>` 分页标记），
  属于历史遗留，本次未动。

---

## 二、嗶哩漫畫 bilimanga.js：搜索不能用

### 2.1 根因（取证）

旧版做法是 `GET /search.html?key=<关键词>` 然后解析 `.book-li`。实测：

* 该请求只返回一个 **5283 字节的「壳页」**，里面 **0 张卡片**；结果从不出现在这个 HTML 里。
* 壳页里只有搜索表单：`<form id="searchForm" method="post" action="/search.html">`，输入框 `name="searchkey"`。
  **站点真正的搜索入口是 POST。**
* 壳页里还有一段 `eval(function(p,a,c,k,e,r){...})` 打包混淆的内联脚本，还原后是：

```js
(function (d) {
  var base = "/search.html?search_guard=";
  var css = d.createElement('link'); css.rel = 'stylesheet'; css.href = base + 'css'; d.body.appendChild(css);
  var js  = d.createElement('script'); js.src = base + 'js'; d.body.appendChild(js);
})(document);
```

  即 `?search_guard=js` 会下发 `jieqiSearchJs` cookie，并 XHR `?search_guard=redeem` 兑换——
  本站是 jieqi 系 CMS，这是它「确认客户端会执行 JS」的校验。
* 站点在 Cloudflare 后面，非浏览器客户端**偶尔**会被 WAF 拦（实测出现过 `403 Forbidden` +
  「Sorry, you have been blocked」，且是间歇性的），但**这不是搜索不能用的根本原因**。

### 2.2 用真实浏览器复测后的关键结论

把站点放进真实浏览器实际搜了一次，搜索**本身是正常的**（「海賊」→ 2 条结果、页面标题「海賊 搜索結果」）。
把协议彻底对齐后，定位到此前漏掉的关键点：

1. **guard 必须走完整三步**。此前只做了 `?search_guard=js`，漏了 `?search_guard=css`。
   完整顺序是：`GET /search.html`（壳页，下发 `jieqiSearchCss`）→ `?search_guard=css`
   → `?search_guard=js`（下发 `jieqiSearchJs`）→ `?search_guard=redeem`。
   少做 css 那一步，POST 永远只回空 body。
2. **redeem 下发的是一张一次性票据 `jieqiSearchTicket`**：用过一次即失效，而且**旧票残留**
   会让服务端直接回空页。所以每次搜索前都要把 `jieqiSearchCss` / `jieqiSearchJs` /
   `jieqiSearchTicket` 置空再重新换票（不能用 `deleteCookies`，那会把登录 cookie 一起丢掉）。
3. 搜索结果条目用的**就是 `.book-li`**（与首页同一个卡片组件）：`data-src` 是封面、
   `.book-title` 是标题 —— 原有解析器可直接复用；分页是「第X/Y頁」，已补进 `extractMaxPage`。
4. 站点对**连续搜索有限流**：实测连搜三次后会出现一个「0 条」的空页，隔几秒换票再搜即正常。

### 2.3 修复

* `unlockSearch()` 按站点完整协议实现四步换票：置空守卫类 cookie → 壳页 → `?search_guard=css`
  → `?search_guard=js`（解析 `jieqiSearchJs` 并通过 `Network.setCookies` 写入引擎 cookie 罐）
  → `?search_guard=redeem`。
* `search.load` 改为 **POST `/search.html` + `searchkey`**（`Network.post`）；第一次拿到 0 条时，
  等 1.2s 换一张新票据重试一次（应对站点限流）。
* 保留一次 `GET + key` 的兜底尝试；任何失败都 **安全降级为 `{comics: [], maxPage: 1}`**，
  不再抛错，避免把站点侧风控表现成源的崩溃。
* 空关键词直接短路，不发请求。
* `extractMaxPage()` 增加「第X/Y頁」解析。

### 2.4 回归结果

真实浏览器实测：

| 关键词 | 结果 |
|---|---|
| 海賊 | 2 条：ONE PIECE ～海賊王～、ONE PIECE ～海賊王～ (全彩版) |
| 火影 | 3 条：火影忍者外傳、火影忍者 愛藏版、火影忍者 木葉新傳 |

源内实测（回归脚本，模拟 Venera 的 cookie 罐）：

| 关键词 | 结果 |
|---|---|
| 海贼 | 2 条，`maxPage=1` |
| 恋爱 | 30 条 |
| 轻音 | 2 条：K－ON！輕音部、普普通通輕音部 |
| 火影 | 3 条（第 1 次被限流返回 0 条，换票重试后拿到） |

其它未改动链路：探索「最近更新」30 条、详情「ELDEN RING 黃金樹之路」56 章。

> 说明：阅读页 `#acontentz` 在真实浏览器里可正常取到 26 张 `i.motiezw.com` 图（已实测），
> 但脚本请求偶发被 Cloudflare 拦截，属于站点侧行为，与本源改动无关。

---

## 三、动漫屋分类修复（v7.0.2）

### 3.1 根因

旧版 `categoryParams` 用的是 `tag-rexue` / `hktw` / `jpkr` / `china` / `euus`，
拼出来的路径是 `/manhua-list-tag-rexue/`、`/manhua-list-hktw/` ——
**这些路径在站点上根本不存在，实测全部 404**，所以点分类进去是空的。

### 3.2 站点真实的分类 URL 规则（真网取证）

```
/manhua-list[-tag{n}|-area{n}][-group{n}][-st{n}][-s{n}][-pay{n}][-p{n}]/
```

| 维度 | 形式 | 取值（逐个实测） |
|---|---|---|
| 题材 | `-tag{n}` | 校园1 冒险2 历史4 后宫8 战争12 奇幻14 魔法15 悬疑17 神鬼20 科幻25 恋爱26 同人30 热血31 推理33 运动34 绅士36 搞笑37 机甲40 |
| 地区 | `-area{n}` | 港台35 日韩36 大陆37 欧美52 |
| 受众 | `-group{n}` | 少年向1 少女向2 青年向3 |
| 状态 | `-st{n}` | 连载1 完结2 |
| 排序 | `-s{n}` | 最热10 最近更新2 最新上架18 |
| 付费 | `-pay{n}` | 免费0 付费1 VIP免费2 |
| 分页 | `-p{n}` | 第 n 页 |

另一个入口 `/manhua-{slug}/`（如 `/manhua-rexue/`）也能用，但每页只有 10 条且**不支持与状态组合**
（`/manhua-rexue-st1/` 实测 404），所以本源统一用上面那种 `manhua-list-*` 形式（每页 21 条）。

**重要限制：题材与地区不能同时使用**——`/manhua-list-tag31-area35/` 实测 404。
其余维度可以自由组合，实测这些组合都正常：
`tag+st+s+p` ✓、`area+group+st+s+p` ✓、`tag+group+st+s+p` ✓、`tag+pay+st+p` ✓。

### 3.3 修复

* `category` 重建为四个 part：**题材 / 地区 / 受众 / 状态**，
  `categoryParams` 用上面取证的数字形式（`tag31`、`area35`、`group1`、`st1`…）。
* `optionList` 改成官方格式（`值-显示文本`），提供**排序**与**付费**两个可选维度。
* `load()` 只接受 `^(tag|area|group|st)\d+$` 形态的 param，**旧版参数会被安全忽略**
  （不再拼出 404 路径，而是回落到全部）。
* `maxPage` 改用页面自带 `var pagesize` 与「本页是否满页」判断是否还有下一页：
  满页 => 可能还有；不满或空 => 已到末页。
  （站点不公开总页数：移动页没有分页控件，PC 分页器也是窗口式只显示到第 10 页，
  这里是唯一有实据的判断方式。）

### 3.4 回归结果

| 检查 | 结果 |
|---|---|
| 11 个维度/组合 | 全部非空、封面全部竖版（21 条/页） |
| 单独维度 | 题材（热血/校园/机甲）、地区（港台/欧美）、受众（少年向）、状态（连载/完结）全部可用 |
| 组合 | 热血+最近更新、港台+少年向、热血+免费 全部可用 |
| 分页 | 热血+连载 第 2 页正常，`maxPage=3` |
| 旧参数兼容 | `tag-rexue` 被安全忽略，回落为全部（不再 404） |

---

## 四、嗶哩漫畫「搜具体书名搜不到」的补充修复（v1.1.2 / v1.1.3）

### 4.1 现象与取证

用户反馈：搜关键词能出，搜**完整书名**搜不到。实测（真实浏览器 + 源内双向验证）：

| 查询 | 结果 |
|---|---|
| `K－ON！輕音部`（站点展示的全名） | **0 条** |
| `K-ON!輕音部`（半角） | **0 条** |
| `輕音部` | **2 条**：K－ON！輕音部 / 普普通通輕音部 |
| `ONE PIECE ～海賊王～`（全名） | 2 条 ✓ |
| `海賊王` / `海贼王` / `ONE PIECE` | 均为 2 条 ✓ |

结论：站点搜索对**含全角符号的书名**匹配不可靠——同一本书用展示名搜不到，用其中的中文片段就能搜到。

另外实测站点对**连续搜索限流**：两次查询挨着发，第二次必定被判 0 条，约 6 秒后才恢复。
这也是为什么早期测试里时好时坏。

### 4.2 修复

* 新增 `searchVariants()`：当查询**含符号（全角标点/破折号等）且含中日文**时，
  **先拿中日文片段去搜**（`K－ON！輕音部` → `輕音部`），原样查询留作第二次兜底。
  这样一次请求就能命中，也不会白跑一次触发站点限流。
* `search.load` 最多只发两次查询；两次之间等待 6 秒（实测的限流恢复时间）。
* 纯中文或纯英文查询保持原样，不多发请求。

### 4.3 回归结果

| 查询 | 结果 |
|---|---|
| `K－ON！輕音部` | 2 条 ✓（修复前 0 条） |
| `ONE PIECE ～海賊王～` | 2 条 ✓ |
| `關於鄰家的天使大人不知不覺把我慣成廢人這檔子事` | 2 条 ✓ |
| `火影忍者 愛藏版` | 3 条 ✓ |
| `孤獨搖滾！` | 2 条 ✓ |
| `海贼` / `恋爱` / `轻音` / `火影` | 2 / 30 / 2 / 3 条 ✓ |

### 4.4 【v1.1.3 修正】真正的主因：唯一结果会被 302 跳转到详情页

> **更正**：本节初稿曾把「`廢天使加百列` 搜不到」归因于「站点搜索索引缺口」，**这是错的**。
> 用真实浏览器重新单独测一次（新标签页、只搜一次、排除限流干扰）后发现：
> 搜索其实成功了，只是页面**直接跳到了 `/detail/857.html`**。

在 HTTP 层复现（POST `/search.html`，`searchkey=廢天使加百列`）：

| 请求 | 结果 |
|---|---|
| `POST /search.html  searchkey=廢天使加百列` | **302 Found → `/detail/857.html`**（响应体 0 字节） |
| `POST /search.html  searchkey=ELDEN RING 黃金樹之路` | **302 Found → `/detail/1601.html`** |
| `POST /search.html  searchkey=海贼` | 200，结果列表页，2 个 `.book-li` |

也就是说：**站点在搜索命中「唯一一条」时不会展示结果列表，而是直接重定向到该作品详情页**。
而 Venera 的 `Network` 会自动跟随重定向，源代码只按「结果列表页」解析 `.book-li`，
于是拿到详情页后解析出 0 条，表现就是「搜具体书名搜不到」——尤其是搜全名往往刚好只有一条匹配。

**这才是主因**；4.1 里「含全角符号导致匹配不可靠」是真实存在但次要的问题（`K－ON！輕音部` 确实返回 0 条结果页）。

### 4.5 【v1.1.3】修复

* 新增 `parseSingleDetail()`：当结果列表解析为空、但响应其实是详情页
  （特征：页内有 `<img class="book-cover" …>`，结果列表页里 `book-cover` 是 `div` 而不是 `img`）时，
  从详情页还原出这一条漫画：id 取 `#shareurl` 的 `share.linovelib.net/{id}-0`（次选 `/read/{id}/catalog`），
  标题取 `h1`（次选 `.book-title`），封面取 `img.book-cover` 的 `src`。
* 同时兼容 **Network 未跟随重定向**的情况：若响应是 301/302/303/307/308，按 `Location` 自己再取一次详情页再还原。
* 版本升至 **v1.1.3**。

### 4.6 回归结果（v1.1.3）

| 查询 | 结果 |
|---|---|
| `廢天使加百列` | **1 条**：廢天使加百列（id=857）✓（修复前 0 条） |
| `ELDEN RING 黃金樹之路` | **1 条**：ELDEN RING 黃金樹之路 ✓（修复前 0 条） |
| `K－ON！輕音部` | 2 条 ✓ |
| `ONE PIECE ～海賊王～` | 2 条 ✓ |
| `海贼` | 2 条 ✓ |

---

## 五、交付物

| 文件 | 说明 |
|---|---|
| `venera-configs-auto/dm5.js` | v7.0.1 修复版 |
| `venera-configs-auto/bilimanga.js` | v1.1.1 修复版 |
| `verify_dm5_bilimanga.js` | 两源合并真网回归脚本 |
| 本文件 | 修复日志 |

复现命令：`node verify_dm5_bilimanga.js`
