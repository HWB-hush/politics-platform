export const realtimeSources = [
  {
    key: "people-politics",
    name: "人民网时政",
    url: "https://www.people.com.cn/",
    parserType: "html-list",
    itemPattern: "<a[^>]+href=['\"](https?:\\/\\/politics\\.people\\.com\\.cn\\/n1\\/\\d{4}\\/\\d{4}\\/c\\d+-\\d+\\.html)['\"][^>]*>([\\s\\S]*?)<\\/a>",
    captures: {
      link: 1,
      title: 2
    },
    limit: 8,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
    },
    enabled: true
  },
  {
    key: "gov-yaowen",
    name: "中国政府网要闻",
    url: "https://www.gov.cn/yaowen/liebiao/YAOWENLIEBIAO.json",
    parserType: "json-list",
    listPath: "",
    fields: {
      title: "TITLE",
      link: "URL",
      publishedAt: "DOCRELPUBTIME"
    },
    limit: 8,
    enabled: true
  },
  {
    key: "xinhua-politics",
    name: "新华网时政",
    url: "https://www.news.cn/politics/",
    parserType: "html-list",
    itemPattern: "<a[^>]+href=['\"](https?:\\/\\/www\\.news\\.cn\\/politics\\/\\d{8}\\/[^'\"]+\\/c\\.html)['\"][^>]*>([\\s\\S]*?)<\\/a>",
    captures: {
      link: 1,
      title: 2
    },
    limit: 8,
    enabled: true
  },
  {
    key: "chinanews-china",
    name: "中国新闻网时政新闻",
    url: "https://www.chinanews.com.cn/rss/china.xml",
    parserType: "rss",
    limit: 8,
    enabled: true
  }
];
