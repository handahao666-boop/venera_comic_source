# Venera 漫画源自动配置仓库

本仓库由 42 个漫画源整理而成, 用于 Venera 自动配置导入。

## 免责声明

本仓库仅供个人学习与研究使用，所有漫画内容版权归原作者所有。

- 本仓库不对任何第三方网站、内容的版权纠纷承担责任
- 使用本仓库所产生的一切法律责任由使用者自行承担
- 请在法律允许的范围内使用，请勿用于商业用途
- 本项目不是 Venera 官方仓库，也不托管任何漫画内容
- 仅用于用户有权访问的网页内容，不绕过付费、验证码、DRM 或访问控制

## 使用方法

1. 打开 Venera 漫画阅读器应用
2. 进入「漫画源」界面
3. 点击「漫画源列表」
4. 更改仓库地址为（镜像，国内推荐）:

```
https://cdn.jsdelivr.net/gh/handahao666-boop/venera_comic_source@main/index.json
```

或者使用 GitHub 直链:

```
https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/index.json
```

5. 点击确定/刷新，列表会刷出全部源，勾选即可一键添加。

## 漫画源来源

- 与官方源名字相同的，均来自官方源或由官方源修复而来
- 部分漫画源如：嗶哩漫畫、飞翔漫画、瓜子漫画、来漫画（分流）、零搬运网、W漫画、NoyManga，均来自于 GitHub 其他人发布的漫画源

## 源清单

| 文件名 | 名称 | key | 版本 |
| --- | --- | --- | --- |
| baihehui.js | 百合会 | baihehui | v1.0.0 |
| baozi.js | 包子漫画 | baozi | v1.1.6 |
| bilimanga.js | 嗶哩漫畫 | bilimanga | v1.1.7 |
| ccc.js | CCC追漫台 | ccc | v1.0.1 |
| comick.js | comick | comick | v1.2.0 |
| comic_walker.js | カドコミ | comic_walker | v1.0.1 |
| copy_manga.js | 拷贝漫画 | copy_manga | v1.6.6 |
| dm5.js | 动漫屋 | dm5 | v7.0.3 |
| dongmanmanhua.js | 咚漫 | dongmanmanhua | v1.0.6 |
| dongman_la_fixed_v101.js | 动漫啦 | dongman_la | v1.0.1 |
| ffppt.js | 飞翔漫画 | ffppt | v1.0.3 |
| gfmh.js | 古风漫画 | GfmhApp | v1.3.0 |
| goda.js | GoDa漫画 | goda | v1.2.1 |
| guazi_manhua_v1.1.0.js | 瓜子漫画 | guazimanhua | v1.0.4 |
| hipmh.js | 嬉皮漫畫 | hipmh | v1.0.1 |
| ikmmh_v2.js | 爱看漫 | ikmmh_v2 | v3.0.0 |
| komiic_dual.js | Komiic | Komiic | v1.0.8 |
| laimanhua_split_hosts_v1.2.1_configurable.js | 来漫画（分流） | laimanhua_split | v1.2.1 |
| manga51.js | 51漫画 | manga51 | v1.2.0 |
| manga_dex.js | MangaDex | manga_dex | v1.1.1 |
| manhuagui.js | 漫画柜 | ManHuaGui | v1.2.1 |
| manhuaren.js | 漫画人 | manhuaren | v1.0.1 |
| manhuauo_fixed_v2.js | 香蕉漫画 | manhuauo_banana_v2 | v1.0.3 |
| manwaba_fixed_v113.js | 漫蛙吧 | manwaba | v1.1.3 |
| manwang_fixed_v120.js | 漫网 | manwang | v1.2.0 |
| mh4399.js | 4399漫画网 | mh4399 | v1.0.3 |
| mojoin_fixed_v107.js | MOJOIN | mojoin_v2 | v1.0.7 |
| mycomic.js | MYCOMIC | mycomic | v1.1.0 |
| noymanga.js | NoyManga | noymanga | v1.1.5 |
| rawkuma.js | Rawkuma | rawkuma | v1.1.0 |
| rumanhua_fixed_v16.js | 如漫画 | rumanhua_fixed_v15 | v1.2.8 |
| sfacg_manhua.js | SF漫画 | sfacg_manhua | v1.0.0 |
| shonen_jump_plus.js | 少年ジャンプ＋ | shonen_jump_plus | v1.1.1 |
| tencent_comic_official.js | 腾讯动漫（正版） | qq_comic_official_v1 | v1.0.3 |
| tuku_cc.js | 图库漫画 | tuku_cc | v1.0.1 |
| wmanhua.js | W漫画 | wmanhua | v1.0.1 |
| webtoons_zh_hant.js | LINE WEBTOON | webtoons_zh_hant | v1.0.0 |
| youku.js | 优酷漫画 (修复版) | ykmh | v1.0.7 |
| zaimanhua.js | 再漫画 | zaimanhua | v1.0.2 |
| zerobyw33.js | zero搬运网 | zerobyw33 | v1.2.0 |
| mangabz.js | Mangabz | mangabz | v1.0.0 |
| cxc.js | CxC | cxc | v1.0.3 |

CxC 支持漫画与在线文字小说；文件版小说提供官网入口。首次阅读小说会按需下载基础字库。详见[使用说明与更新记录](docs/CxC漫画小说源使用与更新记录.md)。

## 创建一个新的漫画源

- 详见 [Venera 漫画源开发日志](docs/Venera漫画源开发日志.md)。

补充说明：

- 本仓库只存放 `.js` 源文件与 `index.json`，源文件与 `index.json` 需同级。
- 新增源：把 `.js` 文件放入仓库根目录，并在 `index.json` 中增加一条记录（文件名与 `fileName` 必须完全一致）。

```json
{
  "name": "源名称",
  "fileName": "your_source.js",
  "key": "your_key",
  "version": "1.0.0"
}
```

- 源格式与可用 API 见官方文档：[Venera 漫画源文档](https://github.com/venera-app/venera/blob/master/doc/comic_source.md) 与 [JavaScript API](https://github.com/venera-app/venera/blob/master/doc/js_api.md)。

## 说明与维护

- 文件名中的空格/括号已规范化为安全文件名（例如 `copy_manga(5).js` → `copy_manga.js`），`index.json` 已同步引用新文件名。
- 上传时把仓库内文件放在根目录即可：`index.json` 与全部 `.js` 同级。
- 后续维护：修改/新增 `.js` 后重新生成 `index.json`，并同步更新上方源清单表格与本说明。

## 版本变更

| 日期 | 变更 |
| --- | --- |
| 2026-10-18 | 按用户指定，将 CxC 当前版本由0.2.2统一为1.0.3，同步脚本 version 字段、索引、源清单和安装说明；功能及源标识保持一致，源总数仍为42。此前两项修复和验证范围继续适用。 |
| 2026-10-18 | 新增 CxC v0.2.2（漫画与小说测试版），总数由41更新为42：动态列表、搜索与完整目录，在线小说源内分页阅读；修复零宽字符 U+200B 造成正文失败及文件版小说造成整个人气列表失败。报错两章繁简体首尾页、QuickJS、原有目录与12项会话模拟回归通过；Venera 实机待验收，EPUB 等文件版仍从官网获取。见[说明与更新记录](docs/CxC漫画小说源使用与更新记录.md)。 |
| 2026-10-15 | 发布漫画人 v1.0.1 与优酷漫画 v1.0.7：修复倒序目录导致“下一章”跳上一话，分别通过20项专项检查及6部、7部作品回归。详见 [漫画人记录](docs/漫画人下一章顺序修复_2026-10-14.md)、[优酷漫画记录](docs/优酷漫画下一章顺序测试与修复_2026-10-14.md)。同时将拷贝漫画索引及源清单误标的1.6.7修正为1.6.6，与仓库现有脚本一致；拷贝漫画功能代码未改，源总数保持41。 |
| 2026-10-13 | 新增 Mangabz v1.0.0，源总数由40更新为41：每次加载动态读取首页、更新/分类/搜索、完整目录及正文；全量读取隐藏章节，使用当次阅读签名与真实图片接口。16项异常/新鲜度回归及13个分类入口通过；海贼王977条目录一致，18张正文及2张封面全部下载解码。见 [开发与回归记录](docs/Mangabz漫画源开发与回归_2026-10-13.md)。手机界面待验证。 |
| 2026-10-13 | 飞翔漫画 v1.0.3：目录合并全部分页，修复只显示前50条；首页文字更新条目匹配真实作品封面，补图限制4个并发并缓存成功封面，失效图显示“暂无封面”。13项封面专项及11项目录回归通过；实站20条封面为19张真实图和1张404占位图，全部解码通过。详见 [封面修复记录](docs/飞翔漫画文字列表封面修复_2026-10-13.md) 与 [目录分页修复记录](docs/飞翔漫画目录分页修复_2026-10-13.md)。 |
| 2026-09 | 仓库建立，收录 36 个漫画源；新增免责声明、使用方法、漫画源来源说明与开发日志 |
| 2026-09 | zero搬运网 `zerobyw33.js` 更新到 v1.2.0：新增账号登录（账号密码登录 + 注册入口）、修复章节列表不完整、补充需登录/VIP 章节提示 |
| 2026-09 | 新增 NoyManga（`noymanga.js` v1.1.3），源总数更新为 37 |
| 2026-09 | 新增 LINE WEBTOON 繁中站（`webtoons_zh_hant.js` v1.0.0），源总数更新为 38；专项日志见 `webtoons_zh_hant_development_log.md` |
| 2026-09 | 新增 嬉皮漫畫（`hipmh.js` v1.0.1），源总数更新为 39；专项日志见 `hipmh_development_log.md` |
| 2026-09 | 新增 51漫画（`manga51.js` v1.2.0，基于上游 v1.1.0 优化），源总数更新为 40；专项日志见 `manga51_development_log.md` |
| 2026-09 | 修复 动漫屋 `dm5.js` v7.0.1（封面显示异常、详情页标题/封面/作者/标签解析失效、章节列表串到其它漫画）与 嗶哩漫畫 `bilimanga.js` v1.1.1（搜索走站点真实的 guard + POST 协议） |
| 2026-09 | 动漫屋升级 v7.0.2：重建分类参数（旧版 tag-rexue/hktw 等实测 404），新增状态维度与排序/付费筛选；嗶哩漫畫升级 v1.1.2：修复含全角符号的完整书名搜不到（改为优先用中文片段检索），并补上站点限流的等待重试 |
| 2026-09 | 嗶哩漫畫升级 v1.1.3：修复「搜具体书名搜不到」的主因——站点在搜索结果唯一时会 302 跳转到详情页，源现在会从详情页还原这一条 |
| 2026-10 | 嗶哩漫畫升级 v1.1.4：图片加载改用章节页 Referer 并补上 `onLoadFailed` 重试（站点图片 CDN 强制校验 Referer，且 Venera 在源未提供重试回调时不会自动重试，会把拦截页写进图片缓存导致一直报 Could not decompress image） |

## 关于本项目

- 本项目由 DeepSeek V4 Flash / V4 Pro 开发，或许有不足之处，如发现问题欢迎反馈。
