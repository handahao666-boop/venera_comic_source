# NoyManga（noymanga.js）修复日志

站点：`https://noymanga.com`（NoyAcg，漫畫&同人誌社區）
源：`noymanga.js`，key = `noymanga`

---

## 一、v1.1.4：网页登录永远登不上（改成账号密码直接登录）

### 1.1 现象

用户在源设置里点「登录」→「通过网页登录」，在打开的网页里登录成功，
回到 App 后仍显示未登录（登录状态没有保存）。

### 1.2 根因（真网取证）

**这不是判断条件写得严不严的问题 —— 而是 Venera 根本收不到任何回调。**

1. 本站是 **React SPA**（Vite 构建）。首页/登录页返回的只是一个 2.3KB 的壳：

   ```html
   <div id="root"></div>
   <script type="module" crossorigin src="/assets/index-BfXnMy5n.js"></script>
   <title>NoyAcg - 漫畫&同人誌社區</title>
   ```

2. Venera 的网页登录只在这两个事件里回调源的 `checkStatus(url, title)`：

   | 事件 | 来源 | 说明 |
   |---|---|---|
   | `onNavigation` | Android `shouldOverrideUrlLoading` | **不会**因 `history.pushState/replaceState`（SPA 前端路由）触发 |
   | `onTitleChange` | `document.title` 变化 | 全站若不改标题就只触发一次 |

   （见 `lib/pages/comic_source_page.dart` 的 `loginWithWebview()` 与 `lib/pages/webview.dart`；
   Android 侧 `doUpdateVisitedHistory` 虽然会上报 pushState，但 Venera 没有监听它。）

3. 本站登录成功后的代码是前端路由跳转（抓 `assets/login-Bnz-NrQA.js` 得到）：

   ```js
   await E({ user: n, pass: m });          // POST /login
   l(u.LOGIN_SUCCESS);
   e(I(r) ?? d() ?? '/', { replace: true }); // react-router navigate()，非整页跳转
   ```

4. 而且把主包引用的 **84 个前端资源全部抓下来检查，没有任何一处修改 `document.title`**，
   标题恒为「NoyAcg - 漫畫&同人誌社區」。

结论：登录前只有一次初始回调（此时 URL 还是空/`/login`），登录后**再无任何事件**，
`checkStatus` 永远不会被再次调用 → Venera 不会保存 Cookie、也不会把源标记为已登录。
（旧版还把 `checkStatus` 限制成路径必须是 `/`、`/user`、`/favorite` —— 而站点的路由表里
根本没有 `/user`、`/favorite`，属于二次失效。）

### 1.3 站点自己的登录接口（真网实测）

前端调用的是普通表单接口，参数与验证码无关：

```
POST https://noymanga.com/api/login
Content-Type: application/x-www-form-urlencoded
Origin: https://noymanga.com

user=<用户名或电邮>&pass=<密码>
```

实测结果：假账号 → `200 {"status":"error"}`（接口存在、直接校验账号密码、**登录不需要验证码**；
验证码只在注册流程里用）。

### 1.4 修复

* 新增 `loginWithPassword(username, password)`，走 `POST /api/login`；
  服务端下发的会话 Cookie 由 Venera 的 Cookie 罐自动接管，后续 `POST /api/v3/userinfo`、
  `/api/home`、`/api/v4/search/fetch` 都会自动带上。
* `account.login` 接上它。Venera 的约定是：**抛异常 = 登录失败**（异常文案直接显示），
  正常返回 = 登录成功，所以失败路径全部用 `throw` 抛出中文原因。
* 登录成功后再调一次 `assertLoggedIn()`（`POST /api/v3/userinfo`）做二次确认，
  避免"接口回了 ok 但会话没建立"的假成功；同时清掉账号/签到缓存，重置自动签到标记。
* **移除 `loginWithWebview`**（对本站永远不可能成功，留着只会误导），
  并补上 `registerWebsite = https://noymanga.com/register`，登录页会出现「Create Account」。

### 1.5 回归结果（真网）

`node verify_dm5_noy_v2.js`：

| 检查 | 结果 |
|---|---|
| 提供账号密码登录 `account.login` | PASS |
| 已移除无法工作的网页登录 | PASS |
| 注册地址指向站点注册页 | PASS |
| 空账号密码被拒 | PASS（「請填寫帳號（用戶名或電郵）與密碼」） |
| 错误账号密码 → 真网返回「帳號或密碼錯誤」 | PASS |
| 登录失败不会把状态写成已登录 | PASS |

> 真实账号的成功登录需要用户实机确认（我没有账号，无法端到端验证成功路径；
> 但接口、请求体、失败分支都已在真网验证）。

---

## 二、v1.1.5：新增「内容类型」（全年龄 / 成人）

### 2.1 需求

站点有内容类型过滤（全年龄 / 成人），源里也要能选，且**默认全年龄**。

### 2.2 站点是怎么实现的（真网取证）

把前端资源扒下来逐一定位，链路完全清楚：

| 文件 | 关键代码 | 说明 |
|---|---|---|
| `assets/app-settings-CO9umcLh.js` | `localStorage['app:settings'] = { allowAdult: 'false' }`，合法值为 `'true' \| 'both' \| 'false'` | **默认 `false`** |
| `assets/settings-BYJiaBjU.js` | 下拉框 `内容類型`：`false => 僅全年齡內容`、`true => 僅成人內容`、`both => 顯示所有內容` | 三个取值与文案 |
| `assets/client-NJP-QThl.js` | `$.interceptors.request.use(e => (e.headers.set('allow-adult', r().allowAdult), e))` | **所有 `/api/*` 请求都会带 `allow-adult` 头** |

也就是说：内容类型不是走接口参数，而是走**请求头 `allow-adult`**（值就是上面三个字符串）。

### 2.3 修复

* 新增源设置 `content_type`（`type: "select"`，`default: "false"`），三个选项与站点一一对应：

  | 显示文案 | 取值 |
  |---|---|
  | 仅全年龄内容（默认） | `false` |
  | 显示所有内容（含成人） | `both` |
  | 仅成人内容 | `true` |

  用户说的「成人内容」对应 `both`（在全年龄之外再显示成人内容），所以三项都给出来，与站点一致。
* `apiHeaders()` 里加上 `"allow-adult": this.allowAdultValue()`，`allowAdultValue()` 负责读取设置并做
  **白名单校验**（非法值一律回退 `false`，也就是全年龄），默认值为站点默认值 `false`。
* 只加在 API 请求上：站点的图片是普通 `<img>` 直连 `img.noymanga.com`，前端并没有给图片加这个头，
  所以图片请求保持不变（避免无谓地破坏 CDN 缓存）。

### 2.4 回归结果

`node verify_dm5_noy_v2.js`：24/24 通过，其中新增 9 项：

| 检查 | 结果 |
|---|---|
| 「内容类型」设置存在且为下拉框 | PASS |
| 默认值为 `false`（仅全年龄） | PASS |
| 三个取值与站点一致 `false/both/true` | PASS |
| 选项文案齐全 | PASS |
| 默认请求头 `allow-adult = false` | PASS |
| 切「显示所有内容」→ `both` | PASS |
| 切「仅成人内容」→ `true` | PASS |
| 非法取值回退 `false` | PASS |
| 真网三种取值请求均被服务器接受 | PASS（`false:login both:login true:login`） |

> 说明：站点所有内容接口（home / search / book / booklist）在**未登录时统一返回
> `{"status":"login"}`**，所以「成人内容是否真的被过滤/放行」这一步必须在登录态下才能观察到 ——
> 需要用户用真实账号切换选项确认；我这边已确认请求头按设置正确变化、且服务器接受该头。

---

## 三、交付物

| 文件 | 说明 |
|---|---|
| `venera-configs-auto/noymanga.js` | v1.1.5（账号密码登录 + 内容类型） |
| `verify_dm5_noy_v2.js` | dm5 章节顺序 + 本源登录的真网回归脚本 |
| 本文件 | 修复日志 |
