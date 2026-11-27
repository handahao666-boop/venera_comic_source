/** @type {import('./_venera_.js')} */

/**
 * 嗶哩漫畫 (www.bilimanga.net)
 *
 * 圖片本身是明文 AVIF（i.motiezw.com），沒有加密。
 *
 * ⚠️ 本站章節圖**只有 AVIF 一種格式**（2026-10-02 真網複測：換 .jpg/.webp/.png 全 404，
 *    換桌面 UA / 老 Android UA 抓閱讀頁拿到的仍是 .avif，四種 CDN 轉碼參數全被忽略，
 *    站點自帶的 checkAVIFSupport() 也只彈提示不換圖）。
 *    所以「手機端看不了、電腦端能看」基本是**設備解碼能力差異**（Android 端解不了部分 AVIF，
 *    見 venera-app/venera#709、#798）。源能修的是網路/風控這一類失敗，解碼失敗無法在源內修。
 *    若要相容解不了 AVIF 的機型，只能自建「AVIF→JPEG/WebP」轉碼代理，填在下面的
 *    IMG_PROXY_TEMPLATE 即可（留空=直連原站）。
 * 但閱讀頁服務器會根據請求頭判斷是否為"移動端瀏覽器"：
 * 必須帶上 sec-ch-ua-mobile: ?1 等移動端 Client Hints 才會返回圖片 <img> 標籤，
 * 否則只返回"章節不支持桌面電腦端瀏覽器顯示"的佔位符。
 *
 * 頁面結構（移動版）：
 * - 首頁 "/"：多個 .book-li 卡片（a[href="/detail/{id}.html"] + img data-src + .book-title）
 * - 詳情頁 "/detail/{id}.html"：.book-title / .book-cover / .authorname / .tag-small / #bookSummary
 * - 目錄頁 "/read/{id}/catalog"：li.chapter-li a[href*="/read/"] 全部章節
 * - 閱讀頁 "/read/{mangaid}/{chapterid}.html"：#acontentz 下的 img data-src（motiezw.com）
 * - 分類 "/filter/"：標籤 tagid 1..51，分頁 /filter/lastupdate_{tagid}_0_0_0_0_0_0_{page}_0_0_0.html
 * - 搜索（v1.2.3）：
 *   1) 直接輸入漫畫 ID 或詳情頁連結秒開；
 *   2) 先發一次原站 POST /search.html（若 30 分鐘內已在 WebView 通過「搜尋驗證」，直接返回原站結果）；
 *   3) 遇圖形驗證碼自動切入「防 429 控速本地全庫索引」（斷點續傳緩存全站 ~58 頁書目 7 天，
 *      內建常用簡繁轉換，首次建庫後本地 0 秒秒搜；輸入「#刷新索引」可手動重建）。
 */

// 【可選】圖片轉碼代理模板，留空 = 直連原站。
// 本站章節圖只有 AVIF，部分 Android 機型解不了；若你自建了能轉碼的代理，填在這裡即可全域生效。
//   const IMG_PROXY_TEMPLATE = "https://example.com/avif2jpg?url={url}";
// 說明：{url} 會被替換成經過 URL 編碼的原始圖片地址。
const IMG_PROXY_TEMPLATE = "";

// 繁體/異體/日文新字體 → 簡體歸一化映射（統一轉簡體後比對，消除「發/髮、後/后、裡/裏、淵/渊」等一對多漏字）
const T2S_TRAD = "萬與專業叢東絲兩嚴喪個臨麗舉義樂習鄉書買亂爭雲亞產親僅僕從侖倉儀們價眾優會偉傳傷倫偽體餘傭俠侶偵側僑倆儉債傾償儲兒兌黨蘭關興養獸內岡冊寫軍農塚決況凍淨淒準涼減幾鳳憑凱擊鑿劃劉則剛創刪別製劑劍劇勸辦務動勵勁勞勢勳區醫華協單賣盧衛卻廠廳歷曆厲壓厭廁廂廈廚縣參雙發髮變敘疊隻臺檯颱葉號嘆嘰嚇呂嗎噸聽啟啓吳吶員唄詠響啞喚噴噓囑囂團糰園圍國圖圓聖場壞塊堅壇罈壩墳墜壘墾墊墮牆聲殼壺處備復複夠頭誇夾奪奮獎奧妝婦媽婁嬌娛嬰嬸學寧寶實寵審憲宮寬賓寢對尋導壽將爾塵嘗堯屍盡層屆屬屢嶼歲豈崗島嶺嶽峽嶄幣帥師帳簾幟帶幀幫幹乾廣莊慶廬庫應廟龐廢開異棄張彌彎彈強歸當錄徹徑憶憂懷態慫憮悵憐總懟戀懇惡惱懸驚懼慘懲憊慚慣懶戲戰戶紮撲執擴掃揚擾撫拋摳搶護報擔擬擁攔擰撥擇掛摯攣撾挾撓擋掙擠揮撈損撿換據擲撣摻擱摟攪攜攝擺搖攤撐敵斂數齋鬥斬斷無舊時曠晝顯晉曬曉暈暫術機殺雜權條來楊傑極構槍楓櫃檸標棧棟欄樹棲樣橋檔檢櫻歡歐慾殘毆毀畢氣氫漢湯溝沒滄滬瀋淚澤潔灑淺漿澆濁測濟渾濃塗湧濤漣澀潤漲漸漁滲溫遊灣濕潰濺滾滿濾濫濱灘潛瀕淵滅燈靈災燦爐點煉熾爛烴燭煙煩燒熱煥燜燼愛爺牽犧犢狀猶獨狹獅獄獵貓獻瑪環現瑣瓊瑤電畫暢療瘋癡癱皺盞鹽監蓋盜盤睜著矚矯礦碼磚礎碩確礙禮禱禍禪離種稅穩窮竊窩窺競筆籠築簽簡籃糧糾紅約級紀純綱納縱紛紙紋紡紐線綫練組紳細織終絆經結繞繪給絡絕統繼績緒續綺緋維綿綜綠綴網羅罰罷聞聯聰職腸膚勝脈脫臉臘騰艦艱豔藝節蒼蘇甦範榮藥萊蓮獲蘿營蕭薩蔥蔣藍薔虜慮虛蟲雖蝦蝕蟻蠻補襪裝褲覆見觀規覓視覽覺觸計訂認討讓訓議訊記講諱訝許論設訪證評詛識詐訴診詞譯試詩誠話誕詢該詳語誤說請諸諾讀課誰調諒談誼謀諜謊諧謎謝謠謙謹譜貞負貢財責賢敗賬貨質販貪貧購貫賤貼貴貸貿費賀賊賈資賭賞賜賠賴贊讚贈贏趙趕趨躍跡蹤軀車軋軌軒轉輪軟轟輕載較輔輛輩輝輯輸辭辯邊達遷過邁運還這進遠違連遲遞選遜邏遺遙鄧郵鄰鄭釋裡裏針釣鈍鐘鍾鋼欽鈕錢鑽鐵鈴鉛銅銘銀鑄鋪鏈銷鎖鋒錯錫錦鍵鋸鍛鎮鏡長門閃閉問闖閏閒間悶鬧閣閱闊隊陽陰陣階際陸陳險隨隱難雛霧靜韻頁頂頃項順須鬚頑顧頓頒頌預領頗頸頻顆題顏額顛願類風飄飛飢飯飲飾飽飼餌餅館馬馭馳驅駁駐駕罵驕駱駭驗駿騎騙騷驟魚魯鮮鯨鳥雞鳴鴉鴨鴻鴿鵝鵬鶴鷹麥黃齊齒齡龍龜魘詭弒鎧為爲羣峯衞麵捲穀豐矇濛樸麴鞦鹹鏇鬱誌係繫徵癥摺緻註臟髒嚮闆衝沖鬆焔呪剣桜沢絵転鉄竜辺気実広応悪戦満発経継総続薬観覚変譲豊関霊駅駆斉後";
const T2S_SIMP = "万与专业丛东丝两严丧个临丽举义乐习乡书买乱争云亚产亲仅仆从仑仓仪们价众优会伟传伤伦伪体余佣侠侣侦侧侨俩俭债倾偿储儿兑党兰关兴养兽内冈册写军农冢决况冻净凄准凉减几凤凭凯击凿划刘则刚创删别制剂剑剧劝办务动励劲劳势勋区医华协单卖卢卫却厂厅历历厉压厌厕厢厦厨县参双发发变叙叠只台台台叶号叹叽吓吕吗吨听启启吴呐员呗咏响哑唤喷嘘嘱嚣团团园围国图圆圣场坏块坚坛坛坝坟坠垒垦垫堕墙声壳壶处备复复够头夸夹夺奋奖奥妆妇妈娄娇娱婴婶学宁宝实宠审宪宫宽宾寝对寻导寿将尔尘尝尧尸尽层届属屡屿岁岂岗岛岭岳峡崭币帅师帐帘帜带帧帮干干广庄庆庐库应庙庞废开异弃张弥弯弹强归当录彻径忆忧怀态怂怃怅怜总怼恋恳恶恼悬惊惧惨惩惫惭惯懒戏战户扎扑执扩扫扬扰抚抛抠抢护报担拟拥拦拧拨择挂挚挛挝挟挠挡挣挤挥捞损捡换据掷掸掺搁搂搅携摄摆摇摊撑敌敛数斋斗斩断无旧时旷昼显晋晒晓晕暂术机杀杂权条来杨杰极构枪枫柜柠标栈栋栏树栖样桥档检樱欢欧欲残殴毁毕气氢汉汤沟没沧沪沈泪泽洁洒浅浆浇浊测济浑浓涂涌涛涟涩润涨渐渔渗温游湾湿溃溅滚满滤滥滨滩潜濒渊灭灯灵灾灿炉点炼炽烂烃烛烟烦烧热焕焖尽爱爷牵牺独状犹独狭狮狱猎猫献玛环现琐琼瑶电画畅疗疯痴瘫皱盏盐监盖盗盘睁着瞩矫矿码砖础硕确碍礼祷祸禅离种税稳穷窃窝窥竞笔笼筑签简篮粮纠红约级纪纯纲纳纵纷纸纹纺纽线线练组绅细织终绊经结绕绘给络绝统继绩绪续绮绯维绵综绿缀网罗罚罢闻联聪职肠肤胜脉脱脸腊腾舰艰艳艺节苍苏苏范荣药莱莲获萝营萧萨葱蒋蓝蔷虏虑虚虫虽虾蚀蚁蛮补袜装裤复见观规觅视览觉触计订认讨让训议讯记讲讳讶许论设访证评诅识诈诉诊词译试诗诚话诞询该详语误说请诸诺读课谁调谅谈谊谋谍谎谐谜谢谣谦谨谱贞负贡财责贤败账货质贩贪贫购贯贱贴贵贷贸费贺贼贾资赌赏赐赔赖赞赞赠赢赵赶趋跃迹踪躯车轧轨轩转轮软轰轻载较辅辆辈辉辑输辞辩边达迁过迈运还这进远违连迟递选逊逻遗遥邓邮邻郑释里里针钓钝钟钟钢钦钮钱钻铁铃铅铜铭银铸铺链销锁锋错锡锦键锯锻镇镜长门闪闭问闯闰闲间闷闹阁阅阔队阳阴阵阶际陆陈险随隐难雏雾静韵页顶顷项顺须须顽顾顿颁颂预领颇颈频颗题颜额颠愿类风飘飞饥饭饮饰饱饲饵饼馆马驭驰驱驳驻驾骂骄骆骇验骏骑骗骚骤鱼鲁鲜鲸鸟鸡鸣鸦鸭鸿鸽鹅鹏鹤鹰麦黄齐齿龄龙龟魇诡弑铠为为群峰卫面卷谷丰蒙蒙朴曲秋咸旋郁志系系征症折致注脏脏向板冲冲松焰咒剑樱泽绘转铁龙边气实广应恶战满发经继总续药观觉变让丰关灵驿驱齐后";
const T2S_MAP = (() => {
  const m = {};
  for (let i = 0; i < T2S_TRAD.length; i++) m[T2S_TRAD[i]] = T2S_SIMP[i];
  return m;
})();

class BiliManga extends ComicSource {
  name = "嗶哩漫畫";
  key = "bilimanga";
  version = "1.2.4";
  minAppVersion = "1.6.0";

  url = "https://raw.githubusercontent.com/handahao666-boop/venera_comic_source/main/bilimanga.js";

  get baseUrl() {
    return "https://www.bilimanga.net";
  }

  // 安全延时（仅在 JS 引擎提供 setTimeout 时生效）
  async sleep(ms) {
    if (typeof setTimeout === "function") {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  }

  // 繁體/異體歸一化為簡體（搜尋時將書庫書名與關鍵詞雙向轉簡體比對）
  toSimplified(str) {
    let out = "";
    const s = String(str || "");
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      out += T2S_MAP[ch] || ch;
    }
    return out;
  }

  // 統一的手機 UA（Chrome 131 / Android 14）。
  mobileUA() {
    return "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
  }

  // 圖片請求頭檔位（依序輪換重試）。
  imageHeaderProfiles(referer) {
    const ua = this.mobileUA();
    const accept = "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8";
    const lang = "zh-TW,zh;q=0.9,en;q=0.8";
    return [
      {
        "User-Agent": ua,
        "Accept": accept,
        "Accept-Language": lang,
        "Referer": referer,
        "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
        "sec-ch-ua-mobile": "?1",
        "sec-ch-ua-platform": '"Android"',
        "Sec-Fetch-Dest": "image",
        "Sec-Fetch-Mode": "no-cors",
        "Sec-Fetch-Site": "same-site",
      },
      {
        "User-Agent": ua,
        "Accept": accept,
        "Accept-Language": lang,
        "Referer": referer,
      },
      {
        "User-Agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
        "Accept": "image/avif,image/webp,image/*,*/*;q=0.8",
        "Accept-Language": "zh-TW,zh;q=0.9",
        "Referer": referer,
      },
      {
        "User-Agent": ua,
        "Accept": accept,
        "Accept-Language": lang,
      },
    ];
  }

  // 關鍵：帶移動端 Client Hints + night=0 cookie，閱讀頁才會返回圖片
  pageHeaders() {
    return {
      "User-Agent": this.mobileUA(),
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
      "sec-ch-ua": '"Chromium";v="131", "Not_A Brand";v="24"',
      "sec-ch-ua-mobile": "?1",
      "sec-ch-ua-platform": '"Android"',
    };
  }

  // 根据漫画 ID 生成官方标准封面地址（jieqi 固定分桶规则）
  coverUrlById(id) {
    const n = parseInt(id, 10);
    if (isNaN(n)) return "";
    const bucket = Math.floor(n / 1000);
    return `${this.baseUrl}/files/cartoon/image/${bucket}/${n}/${n}s.jpg`;
  }

  // 圖片字節校驗：確認真的是圖片再交給 Venera 寫緩存。
  static validateImageBytes(buffer) {
    let b = null;
    try {
      b = new Uint8Array(buffer);
    } catch (e) {
      return buffer;
    }
    if (b.length > 0 && b[0] === 0x3c) {
      throw "圖片響應是 HTML（被站點風控攔截）";
    }
    if (b.length >= 12) {
      const ftyp = b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70;
      const jpeg = b[0] === 0xff && b[1] === 0xd8;
      const png = b[0] === 0x89 && b[1] === 0x50;
      const riff = b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46;
      const gif = b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46;
      if (!ftyp && !jpeg && !png && !riff && !gif) {
        throw "圖片響應不是圖片格式（很可能被站點風控攔截）";
      }
    }
    return buffer;
  }

  init() {
    try {
      Network.setCookies(this.baseUrl + "/", [
        new Cookie({ name: "night", value: "0", domain: "www.bilimanga.net" }),
      ]);
    } catch (e) {}
  }

  // 账号登录（登录页有 Cloudflare 人机验证，必须走 WebView 真实浏览器）
  account = {
    loginWithWebview: {
      url: "https://www.bilimanga.net/login.php",
      checkStatus: (url, title) => {
        return (
          url.indexOf("bilimanga.net") !== -1 &&
          url.indexOf("/login.php") === -1
        );
      },
    },
    logout: () => {
      Network.deleteCookies("https://www.bilimanga.net/");
      try {
        Network.setCookies("https://www.bilimanga.net/", [
          new Cookie({ name: "night", value: "0", domain: "www.bilimanga.net" }),
        ]);
      } catch (e) {}
    },
    registerWebsite: "https://www.bilimanga.net/register.php",
  };

  async fetchBody(label, url) {
    let res = await Network.get(url, this.pageHeaders());
    if (res.status !== 200) throw label + " 请求失败: " + res.status;
    return res.body;
  }

  // 带 429 自动等待重试的 GET（专为建置本地书库防 Cloudflare 1015 限流）
  async fetchWithRateLimit(url, maxRetries) {
    const retries = maxRetries || 3;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await Network.get(url, this.pageHeaders());
      if (res.status === 200 && res.body) {
        return { ok: true, body: res.body };
      }
      if (res.status === 429) {
        const raRaw =
          (res.headers && (res.headers["retry-after"] || res.headers["Retry-After"])) || "10";
        const waitSec = Math.min(Math.max(parseInt(raRaw, 10) || 10, 3), 20);
        if (attempt < retries && typeof setTimeout === "function") {
          await this.sleep((waitSec + 1) * 1000);
          continue;
        }
        return { ok: false, status: 429 };
      }
      return { ok: false, status: res.status };
    }
    return { ok: false, status: 429 };
  }

  // 解析 .book-li 漫画卡片
  parseBookLi(el) {
    let a = el.querySelector('a[href*="/detail/"]');
    if (!a) return null;
    let href = a.attributes["href"] || "";
    let m = href.match(/\/detail\/(\d+)\.html/);
    if (!m) return null;
    let id = m[1];

    let img = el.querySelector("img");
    let cover = img
      ? img.attributes["data-src"] || img.attributes["src"] || ""
      : "";
    let title = img ? img.attributes["alt"] || "" : "";
    if (!title) {
      let titleEl = el.querySelector(".book-title");
      if (titleEl) title = titleEl.text.trim();
    }
    if (!title) title = id;

    let subTitle = "";
    let authorEl = el.querySelector(".book-author");
    if (authorEl) subTitle = authorEl.text.trim();

    return new Comic({
      id: id,
      title: title,
      subTitle: subTitle,
      cover: cover || this.coverUrlById(id),
    });
  }

  // 解析页面上所有 .book-li
  parseBookList(html) {
    let doc = new HtmlDocument(html);
    let seen = {};
    let comics = [];
    for (let el of doc.querySelectorAll(".book-li")) {
      let c = this.parseBookLi(el);
      if (!c || seen[c.id]) continue;
      seen[c.id] = true;
      comics.push(c);
    }
    doc.dispose();
    return comics;
  }

  // 从详情页 HTML 提取单个 Comic 卡片
  parseSingleDetail(body, fallbackId) {
    const html = String(body || "");

    if (!/<img[^>]*class="[^"]*\bbook-cover\b[^"]*"[^>]*>/.test(html)) {
      return null;
    }

    let id = fallbackId ? String(fallbackId) : "";
    if (!id) {
      const share = /id="shareurl"[^>]*value="([^"]+)"/.exec(html);
      if (share) {
        const m = /(\d+)-/.exec(share[1]);
        if (m) id = m[1];
      }
    }
    if (!id) {
      const m = /\/read\/(\d+)\/catalog/.exec(html);
      if (m) id = m[1];
    }
    if (!id) {
      const m = /\/detail\/(\d+)\.html/.exec(html);
      if (m) id = m[1];
    }
    if (!id) return null;

    let title = "";
    let cover = "";
    let subTitle = "";

    try {
      const doc = new HtmlDocument(html);
      const titleEl = doc.querySelector(".book-title") || doc.querySelector("h1");
      if (titleEl) title = titleEl.text.trim();
      const coverEl = doc.querySelector(".book-cover");
      if (coverEl) {
        cover = coverEl.attributes["src"] || coverEl.attributes["data-src"] || "";
      }
      const authorEl = doc.querySelector(".authorname a, .illname a");
      if (authorEl) subTitle = authorEl.text.trim();
      doc.dispose();
    } catch (e) {}

    if (!title) {
      const h1 = /<h1[^>]*>([\s\S]{1,120}?)<\/h1>/.exec(html);
      if (h1) title = h1[1].replace(/<[^>]+>/g, "").trim();
    }
    if (!cover) {
      const cv =
        /<img[^>]*class="[^"]*\bbook-cover\b[^"]*"[^>]*src="([^"]+)"/.exec(html) ||
        /<img[^>]*src="([^"]+)"[^>]*class="[^"]*\bbook-cover\b[^"]*"/.exec(html);
      if (cv) cover = cv[1];
    }

    return new Comic({
      id: id,
      title: title || id,
      cover: cover || this.coverUrlById(id),
      subTitle: subTitle,
    });
  }

  // 根据漫画 ID 拉取原站详情页，失败时用官方封面路径兜底
  async fetchComicCardById(id, fallbackTitle) {
    try {
      const body = await this.fetchBody(
        "detail-" + id,
        this.baseUrl + "/detail/" + id + ".html"
      );
      const comic = this.parseSingleDetail(body, id);
      if (comic) return comic;
    } catch (e) {}
    if (fallbackTitle) {
      return new Comic({
        id: String(id),
        title: fallbackTitle,
        cover: this.coverUrlById(id),
        subTitle: "",
      });
    }
    return null;
  }

  // 从分页链接中提取最大页数（兼容繁简体「頁/页」）
  extractMaxPage(html, fallback) {
    const pager = /第\s*\d+\s*\/\s*(\d+)\s*[页頁]/.exec(String(html || ""));
    if (pager) {
      const n = parseInt(pager[1]);
      if (!isNaN(n) && n >= 1) return n;
    }

    let doc = new HtmlDocument(html);
    let max = 1;
    for (let a of doc.querySelectorAll("a")) {
      let href = a.attributes["href"] || "";
      let text = a.text ? a.text.trim() : "";
      if (
        (href.indexOf("/filter/") !== -1 || href.indexOf("/search") !== -1) &&
        /^\d+$/.test(text)
      ) {
        let n = parseInt(text);
        if (n > max) max = n;
      }
    }
    doc.dispose();
    return max > 1 ? max : fallback;
  }

  // 发现页
  explore = [
    {
      title: "嗶哩漫畫-最近更新",
      type: "multiPageComicList",
      load: async (page) => {
        let url =
          this.baseUrl +
          `/filter/postdate_0_0_0_0_0_0_0_${page}_0_0_0.html`;
        let body = await this.fetchBody("home", url);
        let comics = this.parseBookList(body);
        let maxPage = this.extractMaxPage(body, 58);
        if (maxPage < 1) maxPage = 1;
        return { comics: comics, maxPage: maxPage };
      },
    },
    {
      title: "嗶哩漫畫-排行榜",
      type: "mixed",
      load: async (page) => {
        let ranks = [
          { key: "monthvisit", title: "月點擊榜" },
          { key: "weekvisit", title: "週點擊榜" },
          { key: "monthvote", title: "月推薦榜" },
          { key: "weekvote", title: "週推薦榜" },
          { key: "monthflower", title: "月鮮花榜" },
          { key: "weekflower", title: "週鮮花榜" },
          { key: "monthegg", title: "月雞蛋榜" },
          { key: "weekegg", title: "週雞蛋榜" },
          { key: "lastupdate", title: "最近更新" },
          { key: "postdate", title: "最新入庫" },
          { key: "goodnum", title: "收藏榜" },
          { key: "newhot", title: "新書榜" },
        ];
        let parts = [];
        await Promise.all(
          ranks.map(async (r) => {
            try {
              let body = await this.fetchBody(
                "top-" + r.key,
                this.baseUrl + "/top/" + r.key + "/1.html"
              );
              parts.push({
                title: r.title,
                comics: this.parseBookList(body),
                viewMore: null,
              });
            } catch (e) {
              parts.push({ title: r.title, comics: [], viewMore: null });
            }
          })
        );
        return { data: parts, maxPage: 1 };
      },
    },
  ];

  // 分类页
  category = {
    title: "嗶哩漫畫",
    parts: [
      {
        name: "主題",
        type: "fixed",
        itemType: "category",
        categories: [
          "奇幻", "冒險", "異世界", "龍傲天", "魔法", "仙俠", "戰爭", "熱血",
          "戰鬥", "競技", "懸疑", "驚悚", "獵奇", "神鬼", "偵探", "校園",
          "日常", "JK", "JC", "青梅竹馬", "妹妹", "大小姐", "女兒", "戀愛",
          "耽美", "百合", "NTR", "後宮", "職場", "經營", "犯罪", "旅行",
          "群像", "女性視角", "歷史", "武俠", "東方", "勵志", "宅系", "科幻",
          "機戰", "遊戲", "異能", "腦洞", "病嬌", "人外", "復仇", "鬥智",
          "惡役", "間諜", "治癒",
        ],
        categoryParams: [
          "1", "2", "3", "4", "5", "6", "7", "8",
          "9", "10", "11", "12", "13", "14", "15", "16",
          "17", "18", "19", "20", "21", "22", "23", "24",
          "25", "26", "27", "28", "29", "30", "31", "32",
          "33", "34", "35", "36", "37", "38", "39", "40",
          "41", "42", "43", "44", "45", "46", "47", "48",
          "49", "50", "51",
        ],
      },
    ],
    enableRankingPage: false,
  };

  // 分类漫画加载
  categoryComics = {
    load: async (category, param, options, page) => {
      let tagid = param || "0";
      let url =
        this.baseUrl +
        `/filter/lastupdate_${tagid}_0_0_0_0_0_0_${page}_0_0_0.html`;

      let body = await this.fetchBody("categoryComics", url);
      let comics = this.parseBookList(body);
      let maxPage = this.extractMaxPage(body, comics.length > 0 ? page : 1);
      if (maxPage < 1) maxPage = 1;

      return { comics: comics, maxPage: maxPage };
    },
    optionList: [],
  };

  // 单次原站直搜（不再发失效的 search_guard）：
  // 若 30 分钟内已通过 WebView 验证，直接返回原站结果；若弹出验证码则立即返回 null 切入本地全库
  async tryNativeSearch(q, page) {
    try {
      const enc = encodeURIComponent(q);
      const searchUrl = this.baseUrl + "/search.html";
      const payload =
        page && page > 1
          ? `searchkey=${enc}&searchtype=all&page=${page}`
          : `searchkey=${enc}&searchtype=all`;
      const postBody =
        typeof Convert !== "undefined" && typeof Convert.encodeUtf8 === "function"
          ? Convert.encodeUtf8(payload)
          : payload;

      const res = await Network.post(
        searchUrl,
        Object.assign({}, this.pageHeaders(), {
          "Content-Type": "application/x-www-form-urlencoded",
          "Referer": searchUrl,
          "Origin": this.baseUrl,
          "Sec-Fetch-Dest": "document",
          "Sec-Fetch-Mode": "navigate",
          "Sec-Fetch-Site": "same-origin",
          "Sec-Fetch-User": "?1",
        }),
        postBody
      );

      if (res.status !== 200 || !res.body) return null;
      const body = String(res.body);
      if (/搜尋驗證|搜索验证|search_challenge|checkcode\.php/i.test(body)) {
        return null;
      }

      const comics = this.parseBookList(body);
      if (comics.length > 0) {
        return { comics: comics, maxPage: this.extractMaxPage(body, 1) };
      }

      const single = this.parseSingleDetail(body);
      if (single) {
        return { comics: [single], maxPage: 1 };
      }
    } catch (e) {}
    return null;
  }

  // 防 429 控速 + 断点续传建置全站本地书库索引（~58 页，缓存 7 天）
  async getLocalCatalog(forceRefresh) {
    const CACHE_KEY = "bilimanga_catalog_v2";
    const TTL_MS = 7 * 24 * 3600 * 1000;

    let state = null;
    if (!forceRefresh) {
      try {
        const cached = this.loadData(CACHE_KEY);
        if (cached && Array.isArray(cached.items)) {
          if (cached.complete && Date.now() - (cached.ts || 0) < TTL_MS) {
            return { items: cached.items, complete: true, pagesDone: cached.pagesDone || 0, totalPages: cached.totalPages || 0 };
          }
          // 若上次中途中断，复用已抓进度断点续传
          if (Date.now() - (cached.ts || 0) < 24 * 3600 * 1000) {
            state = cached;
          }
        }
      } catch (e) {}
    }

    const seen = {};
    const items = [];
    const donePages = {};

    if (state && Array.isArray(state.items)) {
      for (let it of state.items) {
        if (it && it.id && !seen[it.id]) {
          seen[it.id] = true;
          items.push(it);
        }
      }
      if (Array.isArray(state.doneList)) {
        for (let pg of state.doneList) donePages[pg] = true;
      }
    }

    const collect = (html, pg) => {
      const list = this.parseBookList(html);
      for (let c of list) {
        if (!c || !c.id || seen[c.id]) continue;
        seen[c.id] = true;
        items.push({ id: c.id, t: c.title || "", a: c.subTitle || "" });
      }
      donePages[pg] = true;
    };

    let totalPages = (state && state.totalPages) || 0;
    if (!totalPages || !donePages[1]) {
      const r1 = await this.fetchWithRateLimit(
        this.baseUrl + "/filter/postdate_0_0_0_0_0_0_0_1_0_0_0.html",
        2
      );
      if (r1.ok) {
        totalPages = Math.min(this.extractMaxPage(r1.body, 58), 80);
        collect(r1.body, 1);
      } else {
        totalPages = totalPages || 58;
      }
    }

    const saveProgress = (isComplete) => {
      try {
        this.saveData(CACHE_KEY, {
          ts: Date.now(),
          complete: isComplete,
          totalPages: totalPages,
          pagesDone: Object.keys(donePages).length,
          doneList: Object.keys(donePages).map((k) => parseInt(k, 10)),
          items: items,
        });
      } catch (e) {}
    };

    // 找出还没抓的页码
    const pending = [];
    for (let p = 1; p <= totalPages; p++) {
      if (!donePages[p]) pending.push(p);
    }

    // 控速策略：
    // Cloudflare 对本站约 12~13 req/10s 触发 429。
    // 有 setTimeout 时 2 并发 + 每批间隔 1800ms（≈1 req/s）；无 setTimeout 时 1 并发串行（天然 ≈1 req/s）。
    const hasTimer = typeof setTimeout === "function";
    const batchSize = hasTimer ? 2 : 1;
    let consecutive429 = 0;

    for (let i = 0; i < pending.length; i += batchSize) {
      const batch = pending.slice(i, i + batchSize);
      const resList = await Promise.all(
        batch.map(async (pg) => {
          const r = await this.fetchWithRateLimit(
            `${this.baseUrl}/filter/postdate_0_0_0_0_0_0_0_${pg}_0_0_0.html`,
            2
          );
          return { pg: pg, r: r };
        })
      );

      let batchHad429 = false;
      for (let entry of resList) {
        if (entry.r.ok) {
          collect(entry.r.body, entry.pg);
          consecutive429 = 0;
        } else if (entry.r.status === 429) {
          batchHad429 = true;
        }
      }

      // 每抓 6 页保存一次断点进度，防止中途取消白抓
      if (i % 6 === 0 || i + batchSize >= pending.length) {
        saveProgress(false);
      }

      if (batchHad429) {
        consecutive429++;
        if (consecutive429 >= 3) break;
        if (hasTimer) await this.sleep(10500);
      } else if (hasTimer && i + batchSize < pending.length) {
        await this.sleep(1800);
      }
    }

    const pagesDone = Object.keys(donePages).length;
    const complete = totalPages > 0 && pagesDone >= Math.floor(totalPages * 0.92);
    saveProgress(complete);

    return { items: items, complete: complete, pagesDone: pagesDone, totalPages: totalPages };
  }

  // 在全站本地书库索引中搜索（书名/作者与关键词双向繁转简归一化比对）
  async searchViaLocalCatalog(kw, page, forceRefresh) {
    const cat = await this.getLocalCatalog(forceRefresh);
    const norm = (s) => this.toSimplified(String(s || "")).toLowerCase();
    const tokens = norm(kw)
      .split(/\s+/)
      .filter((x) => x.length > 0);

    const matched = [];
    for (let item of cat.items) {
      if (tokens.length === 0) break;
      const hay = norm((item.t || "") + " " + (item.a || ""));
      let ok = true;
      for (let tk of tokens) {
        if (hay.indexOf(tk) === -1) {
          ok = false;
          break;
        }
      }
      if (ok) matched.push(item);
    }

    const pageSize = 24;
    const p = page && page > 0 ? page : 1;
    const maxPage = Math.max(1, Math.ceil(matched.length / pageSize));
    const slice = matched.slice((p - 1) * pageSize, p * pageSize);

    const comics = slice.map(
      (item) =>
        new Comic({
          id: item.id,
          title: item.t || item.id,
          subTitle: item.a || "",
          cover: this.coverUrlById(item.id),
        })
    );

    return {
      comics: comics,
      maxPage: maxPage,
      totalCatalog: cat.items.length,
      pagesDone: cat.pagesDone,
      totalPages: cat.totalPages,
      complete: cat.complete,
    };
  }

  // 搜索：ID直达 → 原站直搜（若已过30分钟验证）→ 防429本地全库（带简转繁）
  search = {
    load: async (keyword, options, page) => {
      const kw = String(keyword == null ? "" : keyword).trim();
      const p = page && page > 0 ? page : 1;

      if (!kw) {
        return { comics: [], maxPage: 1 };
      }

      // 手动刷新全站本地书库索引
      if (kw === "#刷新索引" || kw === "#刷新") {
        const cat = await this.getLocalCatalog(true);
        throw `全站本地目錄已刷新：已抓取 ${cat.pagesDone}/${cat.totalPages} 頁，共 ${cat.items.length} 本漫畫，現在可直接搜尋書名或作者`;
      }

      // 1) 直接输入纯数字漫画 ID 或详情页链接时直达
      const directIdMatch =
        /^\d{1,8}$/.exec(kw) ||
        /(?:bilimanga|bilicomic)\.net\/(?:detail|read)\/(\d{1,8})/i.exec(kw);
      if (directIdMatch) {
        const targetId = directIdMatch[1] || directIdMatch[0];
        const card = await this.fetchComicCardById(targetId, targetId);
        return { comics: card ? [card] : [], maxPage: 1 };
      }

      // 2) 先尝试一次原站直搜（如果 30 分钟内已通过站点验证码，直接返回原站结果）
      const nativeRes = await this.tryNativeSearch(kw, p);
      if (nativeRes && nativeRes.comics.length > 0) {
        return nativeRes;
      }

      // 3) 自动走防 429 控速的本地全库索引（自动简转繁匹配）
      const localRes = await this.searchViaLocalCatalog(kw, p, false);
      if (localRes.comics.length > 0) {
        return { comics: localRes.comics, maxPage: localRes.maxPage };
      }

      if (p === 1) {
        const hint = !localRes.complete
          ? `（本地索引目前進度 ${localRes.pagesDone}/${localRes.totalPages} 頁、${localRes.totalCatalog} 本，點擊重試會自動續抓剩餘頁面）`
          : `（已檢索本地全庫 ${localRes.totalCatalog} 本，未找到「${kw}」；若搜的是別名如「舞冰的祈願」，請改搜原站主書名「金牌得主」或直接輸入漫畫 ID）`;
        throw `未找到「${kw}」${hint}`;
      }

      return { comics: [], maxPage: 1 };
    },
    optionList: [],
    enableTagsSuggestions: false,
  };

  // 单本漫画
  comic = {
    loadInfo: async (id) => {
      let detail = await this.fetchBody("detail", this.baseUrl + "/detail/" + id + ".html");
      let doc = new HtmlDocument(detail);

      let title = "";
      let titleEl = doc.querySelector(".book-title");
      if (titleEl) title = titleEl.text.trim();

      let cover = "";
      let coverImg = doc.querySelector(".book-cover");
      if (coverImg) {
        cover = coverImg.attributes["src"] || coverImg.attributes["data-src"] || "";
      }

      let authors = [];
      for (let a of doc.querySelectorAll(".authorname a, .illname a")) {
        let t = a.text ? a.text.trim() : "";
        if (t && authors.indexOf(t) === -1) authors.push(t);
      }

      let tags = [];
      for (let a of doc.querySelectorAll(".tag-small-group.origin-left a.tag-small")) {
        let t = a.text ? a.text.trim() : "";
        if (t) tags.push(t);
      }

      let description = "";
      let summary = doc.querySelector("#bookSummary content");
      if (summary) description = summary.text.trim();
      doc.dispose();

      // 章節目錄
      let chapters = new Map();
      let catalog = await this.fetchBody(
        "catalog",
        this.baseUrl + "/read/" + id + "/catalog"
      );
      let cdoc = new HtmlDocument(catalog);
      for (let a of cdoc.querySelectorAll('li.chapter-li a[href*="/read/"]')) {
        let href = a.attributes["href"] || "";
        let m = href.match(/\/read\/\d+\/(\d+)\.html/);
        if (!m) continue;
        let chTitle = a.text ? a.text.trim() : "";
        if (!chTitle) continue;
        chapters.set(m[1], chTitle);
      }
      cdoc.dispose();

      if (chapters.size === 0) throw "未解析到章節列表";

      let tagMap = {};
      if (authors.length) tagMap["作者"] = authors;
      if (tags.length) tagMap["標籤"] = tags;

      return new ComicDetails({
        title: title || id,
        cover: cover || this.coverUrlById(id),
        description: description,
        tags: tagMap,
        chapters: chapters,
      });
    },

    loadEp: async (comicId, epId) => {
      let body = await this.fetchBody(
        "ep",
        this.baseUrl + "/read/" + comicId + "/" + epId + ".html"
      );
      let doc = new HtmlDocument(body);
      let images = [];
      let content = doc.querySelector("#acontentz") || doc;
      for (let img of content.querySelectorAll("img")) {
        let src = img.attributes["data-src"] || img.attributes["src"] || "";
        if (!src) continue;
        if (src.indexOf("motiezw.com") === -1) continue;
        if (images.indexOf(src) === -1) images.push(src);
      }
      doc.dispose();
      if (images.length === 0) {
        throw "未解析到圖片（可能需要移動端環境，或章節為 VIP）";
      }
      const CACHE_BUST = "v=117";
      let busted = [];
      for (let src of images) {
        busted.push(src + (src.indexOf("?") === -1 ? "?" : "&") + CACHE_BUST);
      }
      return { images: busted };
    },

    onImageLoad: (url, comicId, epId) => {
      const referer =
        comicId && epId
          ? this.baseUrl + "/read/" + comicId + "/" + epId + ".html"
          : this.baseUrl + "/";
      const profiles = this.imageHeaderProfiles(referer);
      const targetUrl = IMG_PROXY_TEMPLATE
        ? IMG_PROXY_TEMPLATE.split("{url}").join(encodeURIComponent(url))
        : url;

      const validate = (buffer) => BiliManga.validateImageBytes(buffer);

      const build = (i) => {
        const headers = profiles[i < profiles.length ? i : profiles.length - 1];
        return {
          url: targetUrl,
          method: "GET",
          headers: headers,
          onResponse: (buffer) => validate(buffer),
          onLoadFailed: () => build(i + 1),
        };
      };
      return build(0);
    },

    onThumbnailLoad: (url) => {
      const headers = this.imageHeaderProfiles("https://www.bilimanga.net/")[0];
      return {
        url: IMG_PROXY_TEMPLATE
          ? IMG_PROXY_TEMPLATE.split("{url}").join(encodeURIComponent(url))
          : url,
        headers: headers,
      };
    },

    // 从外部链接识别漫画 id，如 https://www.bilimanga.net/detail/1601.html
    link: {
      domains: ["bilimanga.net", "www.bilimanga.net", "bilicomic.net", "www.bilicomic.net"],
      linkToId: (url) => {
        let m = url.match(/\/detail\/(\d+)\.html/);
        return m ? m[1] : null;
      },
    },
  };
}