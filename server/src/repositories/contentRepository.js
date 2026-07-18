import { query } from "../db.js";

function formatDateTime(value) {
  if (!value) return "";

  if (typeof value === "string") {
    return value.replace("T", " ").slice(0, 16);
  }

  const date = new Date(value);
  const pad = (part) => part.toString().padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function mapArticleRow(row, { tags = [], content = [] } = {}) {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    category: row.category,
    source: row.source,
    publishedAt: formatDateTime(row.publishedAt),
    readTime: `${row.readTimeMinutes} 分钟`,
    featured: Boolean(row.featured),
    summary: row.summary,
    tags,
    content
  };
}

async function getTagsByArticleIds(articleIds) {
  if (articleIds.length === 0) {
    return new Map();
  }

  const rows = await query(
    `
      SELECT atr.article_id AS articleId, t.name
      FROM article_tag_relations atr
      INNER JOIN article_tags t ON t.id = atr.tag_id
      WHERE atr.article_id IN (?)
      ORDER BY atr.article_id, t.name
    `,
    [articleIds]
  );

  return rows.reduce((accumulator, row) => {
    const current = accumulator.get(row.articleId) ?? [];
    current.push(row.name);
    accumulator.set(row.articleId, current);
    return accumulator;
  }, new Map());
}

async function getArticleContent(articleId) {
  const rows = await query(
    `
      SELECT paragraph_text AS paragraphText
      FROM article_paragraphs
      WHERE article_id = ?
      ORDER BY sort_order ASC, id ASC
    `,
    [articleId]
  );

  return rows.map((row) => row.paragraphText);
}

async function getFeaturedArticle() {
  const rows = await query(`
    SELECT
      a.id,
      a.slug,
      a.title,
      c.name AS category,
      a.source_name AS source,
      a.published_at AS publishedAt,
      a.read_time_minutes AS readTimeMinutes,
      a.featured,
      a.summary
    FROM articles a
    INNER JOIN categories c ON c.id = a.category_id
    WHERE a.status = 'published' AND a.featured = 1
    ORDER BY a.published_at DESC
    LIMIT 1
  `);

  if (rows.length > 0) {
    return mapArticleRow(rows[0]);
  }

  const fallback = await query(`
    SELECT
      a.id,
      a.slug,
      a.title,
      c.name AS category,
      a.source_name AS source,
      a.published_at AS publishedAt,
      a.read_time_minutes AS readTimeMinutes,
      a.featured,
      a.summary
    FROM articles a
    INNER JOIN categories c ON c.id = a.category_id
    WHERE a.status = 'published'
    ORDER BY a.published_at DESC
    LIMIT 1
  `);

  return fallback[0] ? mapArticleRow(fallback[0]) : null;
}

export async function getBriefingPayload() {
  const briefings = await query(`
    SELECT id, label, headline, summary
    FROM briefings
    WHERE is_active = 1
    ORDER BY id DESC
    LIMIT 1
  `);

  if (briefings.length === 0) {
    throw new Error("No active briefing found in database");
  }

  const briefing = briefings[0];

  const [metrics, livePoints, agenda, featured, categoryRows, [counts]] = await Promise.all([
    query(
      `
        SELECT metric_label AS label, metric_value AS value, delta_text AS delta
        FROM briefing_metrics
        WHERE briefing_id = ?
        ORDER BY sort_order ASC, id ASC
      `,
      [briefing.id]
    ),
    query(
      `
        SELECT point_text AS point
        FROM briefing_live_points
        WHERE briefing_id = ?
        ORDER BY sort_order ASC, id ASC
      `,
      [briefing.id]
    ),
    query(
      `
        SELECT agenda_time AS time, title, detail_text AS detail
        FROM briefing_agenda_items
        WHERE briefing_id = ?
        ORDER BY sort_order ASC, id ASC
      `,
      [briefing.id]
    ),
    getFeaturedArticle(),
    query(`
      SELECT c.name
      FROM categories c
      INNER JOIN articles a ON a.category_id = c.id
      WHERE a.status = 'published'
      GROUP BY c.id, c.name, c.sort_order
      ORDER BY c.sort_order ASC, c.name ASC
    `),
    query(`
      SELECT
        (SELECT COUNT(*) FROM topics WHERE is_active = 1) AS topicCount,
        (SELECT COUNT(*) FROM articles WHERE status = 'published') AS articleCount
    `)
  ]);

  return {
    briefing: {
      label: briefing.label,
      headline: briefing.headline,
      summary: briefing.summary,
      metrics,
      livePoints: livePoints.map((item) => item.point),
      agenda
    },
    featured,
    categories: categoryRows.map((item) => item.name),
    topicCount: counts.topicCount,
    articleCount: counts.articleCount
  };
}

export async function listTopics() {
  return query(`
    SELECT id, name, status_label AS status, summary, \`signal\` AS \`signal\`
    FROM topics
    WHERE is_active = 1
    ORDER BY sort_order ASC, id ASC
  `);
}



export async function listArticles({ category, queryText }) {
  const filters = ["a.status = 'published'"];
  const params = [];

  if (category) {
    filters.push("c.name = ?");
    params.push(category);
  }

  if (queryText) {
    const keyword = `%${queryText}%`;

    filters.push(`
      (
        a.title LIKE ?
        OR a.summary LIKE ?
        OR c.name LIKE ?
        OR a.source_name LIKE ?
        OR EXISTS (
          SELECT 1
          FROM article_tag_relations atr2
          INNER JOIN article_tags t2 ON t2.id = atr2.tag_id
          WHERE atr2.article_id = a.id AND t2.name LIKE ?
        )
      )
    `);

    params.push(keyword, keyword, keyword, keyword, keyword);
  }

  const rows = await query(
    `
      SELECT
        a.id,
        a.slug,
        a.title,
        c.name AS category,
        a.source_name AS source,
        a.published_at AS publishedAt,
        a.read_time_minutes AS readTimeMinutes,
        a.featured,
        a.summary
      FROM articles a
      INNER JOIN categories c ON c.id = a.category_id
      WHERE ${filters.join(" AND ")}
      ORDER BY a.featured DESC, a.published_at DESC, a.id DESC
    `,
    params
  );

  const tagsByArticleId = await getTagsByArticleIds(rows.map((row) => row.id));
  const items = rows.map((row) => mapArticleRow(row, { tags: tagsByArticleId.get(row.id) ?? [] }));

  return {
    total: items.length,
    items
  };
}

export async function getArticleDetail(slug) {
  const rows = await query(
    `
      SELECT
        a.id,
        a.slug,
        a.title,
        c.name AS category,
        a.source_name AS source,
        a.published_at AS publishedAt,
        a.read_time_minutes AS readTimeMinutes,
        a.featured,
        a.summary
      FROM articles a
      INNER JOIN categories c ON c.id = a.category_id
      WHERE a.slug = ? AND a.status = 'published'
      LIMIT 1
    `,
    [slug]
  );

  if (rows.length === 0) {
    return null;
  }

  const article = rows[0];
  const [tagsByArticleId, content] = await Promise.all([
    getTagsByArticleIds([article.id]),
    getArticleContent(article.id)
  ]);

  return mapArticleRow(article, {
    tags: tagsByArticleId.get(article.id) ?? [],
    content
  });
}
