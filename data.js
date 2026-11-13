/* 演示数据：照片直接引用作者线上站点，方便你克隆下来立刻看到效果。
   换成自己的素材时不用手改这个文件——跑 tools/build_site.py data 会整份重写。 */
window.TRIPS = {
  "meta": {
    "title": "旅行档案",
    "sub": "走过的路，拍下的光",
    "intro": "每一次出门，按行程整理成一本相册：哪天、在哪、拍了多少。原片留在本地，网页上只放为浏览重新压制的版本。",
    "owner": "示例作者",
    "ownerEn": "DEMO",
    "updated": "2026.11",
    "music": ""
  },
  "trips": [
    {
      "id": "demo-2026",
      "name": "示例行程",
      "subtitle": "把相册跑起来看效果",
      "place": "青海 · 甘肃",
      "period": "2026.04",
      "year": "2026",
      "season": "春",
      "blurb": "这份演示数据只用来确认布局、配色和交互正常。换成你自己的素材后，它会整份被重新生成。",
      "orientation": "landscape",
      "worksTitle": "一次演示，<br />三种拼贴尺寸",
      "worksLead": "点进任意一段，看大中小三种卡片怎么错落排布。",
      "hero": "https://xinjiang-album.pages.dev/assets/p-20260411-025-enhanced.webp",
      "heroAlt": "青海湖",
      "cover": "https://xinjiang-album.pages.dev/assets/p-20260411-025-enhanced.webp",
      "photoCount": 5,
      "videoCount": 0,
      "geo": [
        { "n": "青海湖", "lon": 100.25, "lat": 36.86 },
        { "n": "茶卡", "lon": 99.08, "lat": 36.79 },
        { "n": "敦煌", "lon": 94.66, "lat": 40.14 }
      ],
      "total": { "files": 5, "photos": 5, "videos": 0, "size": "" },
      "categories": [
        { "id": "qinghai", "name": "青海湖", "cover": "https://xinjiang-album.pages.dev/assets/p-20260411-025-enhanced.webp" },
        { "id": "salt", "name": "盐湖", "cover": "https://xinjiang-album.pages.dev/assets/p-20260413-013.webp" },
        { "id": "mingsha", "name": "鸣沙山", "cover": "https://xinjiang-album.pages.dev/assets/p-20260414-025.webp" }
      ],
      "entries": [
        {
          "id": "cat-qinghai",
          "date": "2026.04",
          "label": "青海湖",
          "weekday": "",
          "title": "青海湖",
          "categoryId": "qinghai",
          "tags": ["自然山海"],
          "coverImage": "https://xinjiang-album.pages.dev/assets/p-20260411-025-enhanced.webp",
          "galleryImages": [
            "https://xinjiang-album.pages.dev/assets/p-20260411-025-enhanced.webp",
            "https://xinjiang-album.pages.dev/assets/p-20260411-026.webp"
          ],
          "videos": [],
          "meta": { "location": "蓝色湖面 · 白塔", "gear": "" },
          "sortOrder": 1
        },
        {
          "id": "cat-salt",
          "date": "2026.04",
          "label": "盐湖",
          "weekday": "",
          "title": "盐湖",
          "categoryId": "salt",
          "tags": ["自然山海"],
          "coverImage": "https://xinjiang-album.pages.dev/assets/p-20260413-013.webp",
          "galleryImages": [
            "https://xinjiang-album.pages.dev/assets/p-20260413-013.webp",
            "https://xinjiang-album.pages.dev/assets/p-20260413-021.webp"
          ],
          "videos": [],
          "meta": { "location": "翡翠湖 · 茶卡", "gear": "" },
          "sortOrder": 2
        },
        {
          "id": "cat-mingsha",
          "date": "2026.04",
          "label": "鸣沙山",
          "weekday": "",
          "title": "鸣沙山月牙泉",
          "categoryId": "mingsha",
          "tags": ["自然山海"],
          "coverImage": "https://xinjiang-album.pages.dev/assets/p-20260414-025.webp",
          "galleryImages": [
            "https://xinjiang-album.pages.dev/assets/p-20260414-025.webp"
          ],
          "videos": [],
          "meta": { "location": "沙漠 · 月牙泉", "gear": "" },
          "sortOrder": 3
        }
      ]
    }
  ]
};
