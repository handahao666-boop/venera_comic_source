# Mihon 转 Venera 漫画源发布记录

2026-11-12 发布 20 个 Venera JavaScript 漫画源，来自 Keiyoushi 为 Mihon 维护的扩展。感谢上游开发者和贡献者。转换后的脚本使用 Venera 源接口。Apache-2.0 许可见 [许可全文](Mihon转换源Apache-2.0许可.txt)。

## 导入与更新

1. 在 Venera 打开「漫画源 → 漫画源列表」，将仓库地址设为 [仓库索引](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/index.json)，刷新列表并添加需要的源。
2. 已安装仓库版的用户可在「漫画源」页点击「检查更新」。Venera 使用当前仓库索引检测版本，再从源内的更新地址下载脚本。
3. 已导入此前离线测试版的用户需要手动切换一次。保留原设置时，可以在旧源的编辑界面把 `updateUrl` 改成下表对应的 JS 直链并重载。也可移除同名旧源，再从仓库列表添加。

维护者发布更新时，保持 `key`、文件名和更新地址稳定，在同一提交里提高脚本和索引的 `version`。Venera 按版本比较，版本号相同的改动不会显示为更新。

## 版本与上游

| Venera 源 | 版本 | 仓库版 | Mihon 扩展源码 |
| --- | --- | --- | --- |
| xkcd 中文 | 1.0.2 | [xkcd.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/xkcd.js) | [Keiyoushi · xkcd](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/all/xkcd) |
| 《崩坏3》IP站 | 1.0.2 | [bh3.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/bh3.js) | [Keiyoushi · bh3](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/bh3) |
| 漫画社 | 1.0.2 | [manhuashe.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/manhuashe.js) | [Keiyoushi · manhuashe](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/manhuashe) |
| 杂志迷 | 1.0.2 | [zazhimi.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/zazhimi.js) | [Keiyoushi · zazhimi](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/zazhimi) |
| 泰拉记事社 | 1.0.1 | [terrahistoricus.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/terrahistoricus.js) | [Keiyoushi · terrahistoricus](https://github.com/keiyoushi/extensions-source/tree/3748b8ca9e85c9dca040ba900f49d63a23225504/src/zh/terrahistoricus) |
| 漫画屋 | 1.0.1 | [manhuawu.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/manhuawu.js) | [Keiyoushi · manhuawu](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/manhuawu) |
| 六漫画 | 1.0.1 | [sixmh.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/sixmh.js) | [Keiyoushi · sixmh](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/sixmh) |
| 漫画1234 | 1.0.0 | [mh1234.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/mh1234.js) | [Keiyoushi · mh1234](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/mh1234) |
| 漫画160 | 1.0.0 | [mh160.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/mh160.js) | [Keiyoushi · mh160](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/mh160) |
| GlobalComix 中文 | 1.0.0 | [globalcomix.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/globalcomix.js) | [Keiyoushi · globalcomix](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/all/globalcomix) |
| NamiComi 中文 | 1.0.0 | [namicomi.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/namicomi.js) | [Keiyoushi · namicomi](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/all/namicomi) |
| Toomics 玩漫（繁中） | 1.0.0 | [toomics.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/toomics.js) | [Keiyoushi · toomics](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/all/toomics) |
| 快看漫画 | 1.0.0 | [kuaikanmanhua.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/kuaikanmanhua.js) | [Keiyoushi · kuaikanmanhua](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/kuaikanmanhua) |
| 熱辣漫畫 | 1.0.0 | [relamanhua.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/relamanhua.js) | [Keiyoushi · relamanhua](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/relamanhua) |
| Comic Fury 中文 | 1.0.0 | [comicfury.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/comicfury.js) | [Keiyoushi · comicfury](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/all/comicfury) |
| 無限動漫 | 1.0.0 | [comicabc.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/comicabc.js) | [Keiyoushi · comicabc](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/comicabc) |
| 喜漫漫画 | 1.0.0 | [favcomic.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/favcomic.js) | [Keiyoushi · favcomic](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/favcomic) |
| 极速漫画 | 1.0.0 | [jisumanhua.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/jisumanhua.js) | [Keiyoushi · jisumanhua](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/jisumanhua) |
| 米卡插画 | 1.0.0 | [mikagogo.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/mikagogo.js) | [Keiyoushi · mikagogo](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/mikagogo) |
| 漫本 | 1.0.1 | [manben.js](https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/manben.js) | [Keiyoushi · manben](https://github.com/keiyoushi/extensions-source/tree/db87bdbe77f8209d47cf5665b43ccd3ee7a3395f/src/zh/manben) |

漫本 1.0.1 使用原站的垂直阅读模式获取完整图片清单。真网回归验证了《妖神记》第 1 回 15 页和《再造空间》第 1、2 回的 29 页、25 页。极速漫画与仓库已有的动漫屋存在目录重叠。
