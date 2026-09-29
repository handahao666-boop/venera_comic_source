# 如漫画（www.rumanhua2.com）章节缺失修复日志

> 日期：2026-09-29　真网取证
> `rumanhua_fixed_v16.js` v1.2.6 → **v1.2.7**
> 现象：章节列表比原站少十几话，且新章节不会自动更新

---

## 1. 现象

用户反馈：如漫画源的章节比原站少十几话，并且不会自动更新新章节。

## 2. 取证

以《三眼哮天录》（id `OjQucQi`）为例：

| 来源 | 实测 |
|---|---|
| 详情页 `http://www.rumanhua2.com/{id}/` 静态章节 | **29 话**（最新的：第2季162话 / 161话 / 160话 …） |
| `POST /morechapter`（`id={id}`） | `{"code":"200", …}`，**607 话**（第2季140话 起，逐话往前） |
| 修复前源内 `loadInfo` | **607 话** —— 只有 morechapter 的结果，首章是「第2季140话」 |

即：**详情页上最新的那 29 话完全没被解析进来**，源里的「最新章」永远停在 older 那一批，
所以既比原站少，也表现为「不会自动更新新章节」。

## 3. 根因

站点详情页的真实结构是：

```html
<div class="chapterList">
  <div class="chapterlistload">
    <ul>
      <a href="/OjQucQi/GNJMGNS.html"><li>第2季162话 归茫执念1</li></a>
      …
    </ul>
    <div class="chaplist-more"><button>大人，更多话点这里…</button></div>
  </div>
</div>
```

而旧代码用的是：

```js
const chapterEls = doc.querySelectorAll('.chaplist-box ul li a') || doc.querySelectorAll('.view-ul li a');
```

两个问题：

1. **选择器不存在**：站上没有 `.chaplist-box`，也没有 `.view-ul`。真正的容器是
   `.chapterList` → `.chapterlistload` → `ul`。
2. **`<a>` 包着 `<li>`**（不是 `li` 包 `a`，属于不规范的嵌套），所以即便容器对了，
   `ul li a` 这种后代写法也匹配不到；必须写成 `ul a`。
3. 另外 `querySelectorAll` 返回**空数组也是 truthy**，所以 `A || B` 里 `B` 永远不会执行，
   备用选择器形同虚设。

站点自己加载更多章节的脚本（`/static/js/all.js`）印证了容器名：

```js
$(".chapterlistload ul").append('<a href="/'+id+'/'+vid+'.html"><li>'+vidname+'</li></a>');
```

## 4. 修复（v1.2.7）

* 章节选择器改为按站点真实结构依次尝试（用 `length === 0` 判断，不再用 `||`）：
  `.chapterlistload ul a` → `.chapterlistload a` → `.chaplist-box ul a`
  → `.view-ul li a` → `.chapterList a[href*=".html"]`
  （后两个保留是为了兼容站点其它模板）。
* 「更多话」按钮判断补充 `.chapterList button`，`.chaplist-more` 提到前面判断；
  同样改成不会因为空数组而短路。

## 5. 回归结果

| 作品 | 修复前 | 修复后 | 首章 |
|---|---:|---:|---|
| 三眼哮天录 | 607 | **635** | 第2季162话 归茫执念1 |
| 斗破苍穹 | — | **681** | 番外02 血铸灵丹（下） |
| 斗罗大陆 | — | **525** | 延期更新公告 |
| 我独自升级 | — | **210** | 我独自升级5+6预售开始！ |

* 每部作品的详情页静态章节数均为 **29**，修复后全部并入（635 = 607 + 29 − 1 条重复）。
* 章节图片链路未受影响：最新话 29 张图、第 1 话 43 张图，均正常解析。

## 6. 已知限制

* 章节列表顺序与站点一致：**详情页的 29 话（最新）在前**，然后接 morechapter 的 607 话（由新到旧）。
* `morechapter` 接口一次返回全量历史章节，无需分页（实测单次响应 31487 字节 / 607 条）。

## 7. 复现命令

```bash
node dbg_rm_loadinfo.js   # 输出源解析到的章节数与首/末章
node dbg_rm_multi.js      # 抽查多部作品
```
