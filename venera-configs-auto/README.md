# Venera 漫画源自动配置仓库

本仓库由 35 个漫画源整理而成, 用于 Venera 自动配置导入。

## 使用方法

1. 把本目录(除 README 外的全部文件)上传到 GitHub/Gitee 等可直连的仓库, 推荐目录结构与本目录一致(源文件与 index.json 同级)。
2. 在 Venera 中进入「设置 → 漫画源」, 打开「Comic Source list / 源列表」, 填入 index.json 的地址:

```
https://cdn.jsdelivr.net/gh/<你的用户名>/<仓库名>@main/index.json
```

或者使用 GitHub 直链:

```
https://raw.githubusercontent.com/<你的用户名>/<仓库名>/main/index.json
```

3. 点击确定/刷新, 列表会刷出全部源, 勾选即可一键添加。

## 源清单

| 文件名 | 名称 | key | 版本 |
| --- | --- | --- | --- |
| baihehui.js | 百合会 | baihehui | v1.0.0 |
| baozi.js | 包子漫画 | baozi | v1.1.6 |
| ccc.js | CCC追漫台 | ccc | v1.0.1 |
| comick.js | comick | comick | v1.2.0 |
| comic_walker.js | カドコミ | comic_walker | v1.0.1 |
| copy_manga.js | 拷贝漫画 | copy_manga | v1.6.6 |
| dm5.js | 动漫屋 | dm5 | v7.0.0 |
| dongmanmanhua.js | 咚漫 | dongmanmanhua | v1.0.6 |
| dongman_la_fixed_v101.js | 动漫啦 | dongman_la | v1.0.1 |
| ffppt.js | 飞翔漫画 | ffppt | v1.0.1 |
| gfmh.js | 古风漫画 | GfmhApp | v1.3.0 |
| goda.js | GoDa漫画 | goda | v1.2.1 |
| guazi_manhua_v1.1.0.js | 瓜子漫画 | guazimanhua | v1.0.4 |
| ikmmh_v2.js | 爱看漫 | ikmmh_v2 | v3.0.0 |
| komiic_dual.js | Komiic | Komiic | v1.0.8 |
| laimanhua_split_hosts_v1.2.1_configurable.js | 来漫画（分流） | laimanhua_split | v1.2.1 |
| manga_dex.js | MangaDex | manga_dex | v1.1.1 |
| manhuagui.js | 漫画柜 | ManHuaGui | v1.2.1 |
| manhuaren.js | 漫画人 | manhuaren | v1.0.0 |
| manhuauo_fixed_v2.js | 香蕉漫画 | manhuauo_banana_v2 | v1.0.3 |
| manwaba_fixed_v113.js | 漫蛙吧 | manwaba | v1.1.3 |
| manwang_fixed_v120.js | 漫网 | manwang | v1.2.0 |
| mh4399.js | 4399漫画网 | mh4399 | v1.0.3 |
| mojoin_fixed_v107.js | MOJOIN | mojoin_v2 | v1.0.7 |
| mycomic.js | MYCOMIC | mycomic | v1.1.0 |
| rawkuma.js | Rawkuma | rawkuma | v1.1.0 |
| rumanhua_fixed_v16.js | 如漫画 | rumanhua_fixed_v15 | v1.2.6 |
| sfacg_manhua.js | SF漫画 | sfacg_manhua | v1.0.0 |
| shonen_jump_plus.js | 少年ジャンプ＋ | shonen_jump_plus | v1.1.1 |
| tencent_comic_official.js | 腾讯动漫（正版） | qq_comic_official_v1 | v1.0.3 |
| tuku_cc.js | 图库漫画 | tuku_cc | v1.0.1 |
| wmanhua.js | W漫画 | wmanhua | v1.0.1 |
| youku.js | 优酷漫画 (修复版) | ykmh | v1.0.6 |
| zaimanhua.js | 再漫画 | zaimanhua | v1.0.2 |
| zerobyw33.js | zero搬运网 | zerobyw33 | v1.1.0 |

## 说明

- 文件名中的空格/括号已规范化为安全文件名(例如 `copy_manga(5).js` → `copy_manga.js`), index.json 已同步引用新文件名。
- 如需新增源: 把 .js 文件放入本目录并重新生成 index.json。
- 上传时把本目录内文件(不含父级)放到仓库根目录即可: index.json 与全部 .js 同级。
- 后续维护: 修改/新增 .js 后运行 `node prepare_venera_repo.js venera-configs-auto venera-configs-auto` 重新生成 index.json 与 README。
