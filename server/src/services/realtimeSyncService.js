import { realtimeSources } from "../realtimeSources.js";
import { ensureRealtimeTables, listLatestRealtimeResults, listRealtimeHistory, saveRealtimeResult } from "../repositories/realtimeRepository.js";
import { createHash } from "node:crypto";

const DEFAULT_INTERVAL_MINUTES = Number(process.env.REALTIME_SYNC_INTERVAL_MINUTES || 30);
const MAX_PAYLOAD_LENGTH = Number(process.env.REALTIME_SYNC_MAX_PAYLOAD_LENGTH || 20000);
let schedulerHandle = null;
let runningPromise = null;

function normalizeSource(source) {
  return {
    key: source.key,
    name: source.name,
    url: source.url,
    parserType: source.parserType || "json",
    rule: source.rule || "",
    listPath: source.listPath || "",
    fields: source.fields || {},
    itemPattern: source.itemPattern || "",
    captures: source.captures || {},
    limit: Number(source.limit || 5),
    enabled: source.enabled !== false,
    headers: source.headers || {}
  };
}

function getEnabledSources() {
  return realtimeSources.map(normalizeSource).filter((source) => source.enabled);
}

function getValueByPath(payload, rule) {
  return rule
    .split(".")
    .filter(Boolean)
    .reduce((current, key) => {
      if (current === null || current === undefined) {
        return undefined;
      }

      return current[key];
    }, payload);
}

function trimPayload(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_PAYLOAD_LENGTH ? `${text.slice(0, MAX_PAYLOAD_LENGTH)}...` : text;
}

function decodeXmlText(value) {
  if (!value) {
    return "";
  }

  return value
    .replace(/^<!\[CDATA\[(.*)\]\]>$/s, "$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .trim();
}

function stripHtml(value) {
  return (value || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength = 180) {
  if (!value) {
    return "";
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function parseExtractedItems(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function createRealtimeArticleSlug(sourceKey, link, title) {
  const stableValue = link || `${sourceKey}:${title}`;
  return `live-${sourceKey}-${createHash("sha1").update(stableValue).digest("hex").slice(0, 12)}`;
}

function normalizeArticleDate(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.toString().replace("T", " ").slice(0, 16);
  }

  const pad = (part) => part.toString().padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function itemToRealtimeArticle(item, source, index, fetchedAt) {
  const title = stripHtml(item.title || "");
  const link = item.link || "";
  const description = truncateText(stripHtml(item.description || ""), 220);

  return {
    id: `${source.key}-${index}`,
    slug: createRealtimeArticleSlug(source.key, link, title),
    title,
    category: source.name,
    source: source.name,
    sourceKey: source.key,
    url: link,
    publishedAt: normalizeArticleDate(item.publishedAt) || normalizeArticleDate(fetchedAt),
    readTime: "实时抓取",
    featured: index === 0,
    summary: description || "来自官方站点的实时抓取条目，点击右侧详情可查看原文入口。",
    tags: ["实时抓取", source.name],
    content: [
      description || "该条目来自官方站点实时抓取结果，当前源未提供摘要正文。",
      link ? `原文链接：${link}` : "原文链接暂未提供。"
    ]
  };
}

function filterRealtimeArticles(articles, { category, queryText } = {}) {
  const normalizedQuery = queryText?.trim().toLowerCase();

  return articles.filter((article) => {
    if (category && article.category !== category) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    return [article.title, article.summary, article.source, article.publishedAt, article.url, ...article.tags]
      .filter(Boolean)
      .some((value) => value.toString().toLowerCase().includes(normalizedQuery));
  });
}

function buildRealtimeArticlesFromRows(rows) {
  const articles = [];

  for (const row of rows) {
    if (row.syncStatus !== "success") {
      continue;
    }

    const entries = parseExtractedItems(row.extractedValue);

    entries.forEach((entry, index) => {
      const article = itemToRealtimeArticle(
        entry,
        {
          key: row.sourceKey,
          name: row.sourceName
        },
        index,
        row.fetchedAt
      );

      if (article.title) {
        articles.push(article);
      }
    });
  }

  const seenSlugs = new Set();

  return articles
    .filter((article) => {
      if (seenSlugs.has(article.slug)) {
        return false;
      }

      seenSlugs.add(article.slug);
      return true;
    })
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

function extractValueFromText(text, rule) {
  const match = text.match(new RegExp(rule, "i"));
  return match?.[1] ?? match?.[0] ?? null;
}

function extractXmlTag(block, tagName) {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)</${tagName}>`, "i"));
  return decodeXmlText(match?.[1] || "");
}

function extractRssItems(xmlText, limit) {
  const items = [];
  const matches = xmlText.matchAll(/<item>([\s\S]*?)<\/item>/gi);

  for (const match of matches) {
    items.push({
      title: extractXmlTag(match[1], "title"),
      link: extractXmlTag(match[1], "link"),
      publishedAt: extractXmlTag(match[1], "pubDate"),
      description: truncateText(stripHtml(extractXmlTag(match[1], "description")))
    });

    if (items.length >= limit) {
      break;
    }
  }

  return items;
}

function extractJsonListItems(payload, source) {
  const list = source.listPath ? getValueByPath(payload, source.listPath) : payload;

  if (!Array.isArray(list)) {
    return [];
  }

  return list.slice(0, source.limit).map((item) => ({
    title: getValueByPath(item, source.fields.title) ?? "",
    link: getValueByPath(item, source.fields.link) ?? "",
    publishedAt: getValueByPath(item, source.fields.publishedAt) ?? "",
    description: source.fields.description ? getValueByPath(item, source.fields.description) ?? "" : ""
  }));
}

function derivePublishedAtFromLink(link) {
  const compactMatch = link.match(/\/(20\d{2})(\d{2})(\d{2})\//);

  if (compactMatch) {
    return `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
  }

  const splitMatch = link.match(/\/(20\d{2})\/(\d{2})(\d{2})\//);

  if (splitMatch) {
    return `${splitMatch[1]}-${splitMatch[2]}-${splitMatch[3]}`;
  }

  return "";
}

function extractHtmlListItems(htmlText, source) {
  const items = [];
  const pattern = new RegExp(source.itemPattern, "gi");
  const seenLinks = new Set();

  for (const match of htmlText.matchAll(pattern)) {
    const link = match[source.captures.link] || "";
    const title = stripHtml(match[source.captures.title] || "");
    const description = source.captures.description ? truncateText(stripHtml(match[source.captures.description] || "")) : "";
    const publishedAt = source.captures.publishedAt
      ? stripHtml(match[source.captures.publishedAt] || "")
      : derivePublishedAtFromLink(link);

    if (!link || !title || seenLinks.has(link)) {
      continue;
    }

    seenLinks.add(link);
    items.push({
      title,
      link,
      publishedAt,
      description
    });

  }

  return items
    .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt))
    .slice(0, source.limit);
}

async function fetchAndExtract(source) {
  const response = await fetch(source.url, {
    headers: source.headers
  });

  const rawText = await response.text();

  if (!response.ok) {
    throw Object.assign(new Error(`Request failed with status ${response.status}`), {
      httpStatus: response.status,
      rawPayload: trimPayload(rawText)
    });
  }

  if (source.parserType === "regex") {
    return {
      httpStatus: response.status,
      rawPayload: trimPayload(rawText),
      extractedValue: trimPayload(extractValueFromText(rawText, source.rule))
    };
  }

  if (source.parserType === "rss") {
    return {
      httpStatus: response.status,
      rawPayload: trimPayload(rawText),
      extractedValue: trimPayload(extractRssItems(rawText, source.limit))
    };
  }

  if (source.parserType === "html-list") {
    return {
      httpStatus: response.status,
      rawPayload: trimPayload(rawText),
      extractedValue: trimPayload(extractHtmlListItems(rawText, source))
    };
  }

  const parsed = JSON.parse(rawText);

  if (source.parserType === "json-list") {
    return {
      httpStatus: response.status,
      rawPayload: trimPayload(parsed),
      extractedValue: trimPayload(extractJsonListItems(parsed, source))
    };
  }

  return {
    httpStatus: response.status,
    rawPayload: trimPayload(parsed),
    extractedValue: trimPayload(getValueByPath(parsed, source.rule))
  };
}

async function syncSource(source) {
  const fetchedAt = new Date().toISOString().slice(0, 19).replace("T", " ");

  try {
    const result = await fetchAndExtract(source);

    await saveRealtimeResult({
      sourceKey: source.key,
      sourceName: source.name,
      sourceUrl: source.url,
      parserType: source.parserType,
      extractedValue: result.extractedValue,
      rawPayload: result.rawPayload,
      httpStatus: result.httpStatus,
      syncStatus: "success",
      errorMessage: null,
      fetchedAt
    });

    return {
      sourceKey: source.key,
      sourceName: source.name,
      syncStatus: "success",
      fetchedAt,
      extractedValue: result.extractedValue
    };
  } catch (error) {
    await saveRealtimeResult({
      sourceKey: source.key,
      sourceName: source.name,
      sourceUrl: source.url,
      parserType: source.parserType,
      extractedValue: null,
      rawPayload: trimPayload(error.rawPayload),
      httpStatus: error.httpStatus || null,
      syncStatus: "error",
      errorMessage: error.message,
      fetchedAt
    });

    return {
      sourceKey: source.key,
      sourceName: source.name,
      syncStatus: "error",
      fetchedAt,
      errorMessage: error.message
    };
  }
}

export async function runRealtimeSync() {
  if (runningPromise) {
    return runningPromise;
  }

  runningPromise = (async () => {
    await ensureRealtimeTables();

    const sources = getEnabledSources();

    if (sources.length === 0) {
      return {
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        intervalMinutes: DEFAULT_INTERVAL_MINUTES,
        results: []
      };
    }

    const startedAt = new Date().toISOString();
    const results = [];

    for (const source of sources) {
      results.push(await syncSource(source));
    }

    return {
      startedAt,
      finishedAt: new Date().toISOString(),
      intervalMinutes: DEFAULT_INTERVAL_MINUTES,
      results
    };
  })();

  try {
    return await runningPromise;
  } finally {
    runningPromise = null;
  }
}

export function startRealtimeScheduler() {
  if (schedulerHandle || process.env.REALTIME_SYNC_ENABLED === "false") {
    return;
  }

  const intervalMs = DEFAULT_INTERVAL_MINUTES * 60 * 1000;

  runRealtimeSync().catch((error) => {
    console.error("Initial realtime sync failed:", error);
  });

  schedulerHandle = setInterval(() => {
    runRealtimeSync().catch((error) => {
      console.error("Scheduled realtime sync failed:", error);
    });
  }, intervalMs);
}

export function getRealtimeSourceDefinitions() {
  return getEnabledSources().map((source) => ({
    key: source.key,
    name: source.name,
    url: source.url,
    parserType: source.parserType,
    rule: source.rule,
    listPath: source.listPath,
    fields: source.fields,
    limit: source.limit
  }));
}

export async function listRealtimeArticles({ category, queryText } = {}) {
  await ensureRealtimeTables();

  let rows = await listLatestRealtimeResults();

  if (rows.length === 0 || rows.every((row) => row.syncStatus !== "success")) {
    await runRealtimeSync();
    rows = await listLatestRealtimeResults();
  }

  const allItems = buildRealtimeArticlesFromRows(rows);
  const items = filterRealtimeArticles(allItems, { category, queryText });
  const categories = [...new Set(allItems.map((article) => article.category))];

  return {
    total: items.length,
    categories,
    items
  };
}

export async function getRealtimeArticleDetail(slug) {
  const { items } = await listRealtimeArticles();
  return items.find((article) => article.slug === slug) || null;
}

export { listLatestRealtimeResults, listRealtimeHistory };
