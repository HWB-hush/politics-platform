<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import ArticleCard from "../components/ArticleCard.vue";
import SectionTitle from "../components/SectionTitle.vue";
import {
  fetchArticleDetail,
  fetchArticles,
  fetchBriefing,
  fetchCurrentUser,
  fetchRealtimeData,
  fetchTopics,
  logoutUser,
  syncRealtimeData
} from "../api";

const AUTH_TOKEN_KEY = "politics-platform-auth-token";
const REALTIME_REFRESH_MS = 60 * 1000;

const briefing = ref(null);
const featured = ref(null);
const topics = ref([]);
const categories = ref([]);
const articles = ref([]);
const selectedSlug = ref("");
const selectedArticle = ref(null);
const activeCategory = ref("");
const query = ref("");
const loading = ref(true);
const listLoading = ref(false);
const error = ref("");
const currentUser = ref(null);
const authToken = ref("");

const realtimeItems = ref([]);
const realtimeSources = ref([]);
const realtimeLoading = ref(false);
const realtimeSyncing = ref(false);
const realtimeError = ref("");
const realtimeLastUpdated = ref("");
let realtimeTimer = null;

const filteredCountLabel = computed(() => `${articles.value.length.toString().padStart(2, "0")} 条内容`);

function formatDateTime(value) {
  if (!value) return "刚刚";

  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function parseRealtimePayload(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

function normalizeRealtimeItems(items) {
  return items.map((item) => {
    const entries = parseRealtimePayload(item.extractedValue).slice(0, 6);

    return {
      sourceKey: item.sourceKey,
      sourceName: item.sourceName,
      fetchedAtLabel: formatDateTime(item.fetchedAt),
      items: entries,
      count: entries.length
    };
  });
}

async function restoreSession() {
  authToken.value = window.localStorage.getItem(AUTH_TOKEN_KEY) || "";

  if (!authToken.value) return;

  try {
    const response = await fetchCurrentUser(authToken.value);
    currentUser.value = response.user;
  } catch {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    authToken.value = "";
  }
}

async function submitLogout() {
  try {
    if (authToken.value) {
      await logoutUser(authToken.value);
    }
  } finally {
    window.localStorage.removeItem(AUTH_TOKEN_KEY);
    authToken.value = "";
    currentUser.value = null;
  }
}

async function loadHome() {
  loading.value = true;
  error.value = "";

  try {
    const [briefingResponse, topicsResponse] = await Promise.all([fetchBriefing(), fetchTopics()]);

    briefing.value = briefingResponse.briefing;
    featured.value = briefingResponse.featured;
    categories.value = briefingResponse.categories;
    topics.value = topicsResponse;
    await loadArticles();
  } catch (loadError) {
    console.error(loadError);
    error.value = "数据加载失败，请确认后端服务和数据库已经启动。";
  } finally {
    loading.value = false;
  }
}

async function loadArticles() {
  listLoading.value = true;

  try {
    const response = await fetchArticles({
      category: activeCategory.value,
      query: query.value
    });

    articles.value = response.items;
    categories.value = response.categories || [];

    if (!articles.value.some((article) => article.slug === selectedSlug.value)) {
      selectedSlug.value = articles.value[0]?.slug ?? "";
    }
  } catch (listError) {
    console.error(listError);
    error.value = "资讯列表加载失败，请稍后重试。";
  } finally {
    listLoading.value = false;
  }
}

async function loadArticleDetail(slug) {
  if (!slug) {
    selectedArticle.value = null;
    return;
  }

  try {
    selectedArticle.value = await fetchArticleDetail(slug);
  } catch (detailError) {
    console.error(detailError);
    selectedArticle.value = null;
  }
}

async function loadRealtimeData({ silent = false } = {}) {
  if (!silent) realtimeLoading.value = true;

  try {
    const response = await fetchRealtimeData();
    realtimeSources.value = response.sources || [];
    realtimeItems.value = normalizeRealtimeItems(response.items || []);
    realtimeLastUpdated.value = response.items?.[0]?.updatedAt || response.items?.[0]?.fetchedAt || "";
    realtimeError.value = "";
  } catch (loadError) {
    console.error(loadError);
    realtimeError.value = "实时抓取数据加载失败，请稍后重试。";
  } finally {
    realtimeLoading.value = false;
  }
}

async function handleRealtimeSync() {
  realtimeSyncing.value = true;
  realtimeError.value = "";

  try {
    await syncRealtimeData();
    await loadRealtimeData({ silent: true });
  } catch (syncError) {
    realtimeError.value = syncError.message || "实时同步失败，请稍后重试。";
  } finally {
    realtimeSyncing.value = false;
  }
}

function startRealtimePolling() {
  realtimeTimer = setInterval(() => {
    loadRealtimeData({ silent: true });
  }, REALTIME_REFRESH_MS);
}

function stopRealtimePolling() {
  if (realtimeTimer) {
    clearInterval(realtimeTimer);
    realtimeTimer = null;
  }
}

watch(selectedSlug, (slug) => {
  loadArticleDetail(slug);
});

watch([activeCategory, query], () => {
  loadArticles();
});

onMounted(() => {
  restoreSession();
  loadHome();
  loadRealtimeData();
  startRealtimePolling();
});

onUnmounted(() => {
  stopRealtimePolling();
});
</script>

<template>
  <main v-if="!loading && briefing && featured" class="layout">
    <section v-if="currentUser" class="auth-card">
      <div class="auth-profile">
        <p class="auth-profile__eyebrow">当前已登录</p>
        <h3>{{ currentUser.displayName }}</h3>
        <p>{{ currentUser.username }} · {{ currentUser.email }}</p>
        <div class="auth-profile__meta">
          <span>角色：{{ currentUser.role }}</span>
          <span>状态：会话有效</span>
        </div>
        <button class="auth-logout" type="button" @click="submitLogout">退出登录</button>
      </div>
    </section>

    <section class="hero">
      <div class="hero__copy">
        <p class="hero__eyebrow">{{ briefing.label }}</p>
        <h1>{{ briefing.headline }}</h1>
        <p class="hero__summary">{{ briefing.summary }}</p>
        <div class="hero__actions">
          <a href="#realtime">查看实时抓取</a>
          <a href="#articles" class="hero__link">进入资讯流</a>
        </div>
      </div>

      <div class="hero__visual">
        <div class="hero__featured">
          <span class="hero__featured-label">头条观察</span>
          <h2>{{ featured.title }}</h2>
          <p>{{ featured.summary }}</p>
          <div class="hero__featured-meta">
            <span>{{ featured.category }}</span>
            <span>{{ featured.publishedAt }}</span>
          </div>
        </div>

        <div class="metric-grid">
          <article v-for="item in briefing.metrics" :key="item.label">
            <span>{{ item.label }}</span>
            <strong>{{ item.value }}</strong>
            <em>{{ item.delta }}</em>
          </article>
        </div>
      </div>
    </section>

    <section id="realtime" class="realtime-section">
      <div class="realtime-header">
        <SectionTitle
          eyebrow="实时抓取"
          title="官方站点的最新稿件已接入页面"
          description="这里展示定时采集器最近一次写入数据库的结果。"
        />

        <div class="realtime-header__actions">
          <div class="realtime-status">
            <span>来源 {{ realtimeSources.length }}</span>
            <span>更新 {{ realtimeLastUpdated ? formatDateTime(realtimeLastUpdated) : "待同步" }}</span>
          </div>
          <button class="realtime-sync" type="button" :disabled="realtimeSyncing" @click="handleRealtimeSync">
            {{ realtimeSyncing ? "同步中..." : "立即同步" }}
          </button>
        </div>
      </div>

      <p v-if="realtimeError" class="realtime-feedback realtime-feedback--error">{{ realtimeError }}</p>
      <p v-else-if="realtimeLoading" class="realtime-feedback">正在加载实时抓取数据...</p>

      <div v-else class="realtime-grid">
        <article v-for="source in realtimeItems" :key="source.sourceKey" class="realtime-card">
          <div class="realtime-card__top">
            <div>
              <p class="realtime-card__eyebrow">{{ source.sourceName }}</p>
              <h3>{{ source.count }} 条最新稿件</h3>
            </div>
            <span class="realtime-card__time">{{ source.fetchedAtLabel }}</span>
          </div>

          <ul class="realtime-list">
            <li v-for="entry in source.items" :key="`${source.sourceKey}-${entry.link}`" class="realtime-list__item">
              <a :href="entry.link" target="_blank" rel="noreferrer">
                <strong>{{ entry.title }}</strong>
                <span>{{ entry.publishedAt || "未标注时间" }}</span>
              </a>
            </li>
          </ul>
        </article>
      </div>
    </section>

    <section class="signal-strip">
      <p>关键信号</p>
      <ul>
        <li v-for="point in briefing.livePoints" :key="point">{{ point }}</li>
      </ul>
    </section>

    <section id="topics" class="topics-section">
      <SectionTitle
        eyebrow="专题观察"
        title="用统一字段追踪议程状态"
        description="专题区保留真正影响首页判断的核心信号。"
      />

      <div class="topics-grid">
        <article v-for="topic in topics" :key="topic.id" class="topic-panel">
          <span class="topic-panel__status">{{ topic.status }}</span>
          <h3>{{ topic.name }}</h3>
          <p>{{ topic.summary }}</p>
          <strong>{{ topic.signal }}</strong>
        </article>
      </div>
    </section>

    <section id="articles" class="content-section">
      <div class="content-header">
        <SectionTitle
          eyebrow="资讯流"
          title="按专题密度和执行节奏筛选内容"
          description="搜索和分类直接调用 Node.js API。"
        />

        <div class="content-header__controls">
          <input v-model.trim="query" type="search" placeholder="搜索标题、摘要、来源或标签" />
          <div class="content-header__chips">
            <button :class="{ active: activeCategory === '' }" type="button" @click="activeCategory = ''">全部</button>
            <button
              v-for="category in categories"
              :key="category"
              :class="{ active: activeCategory === category }"
              type="button"
              @click="activeCategory = category"
            >
              {{ category }}
            </button>
          </div>
        </div>
      </div>

      <div class="content-grid">
        <div class="articles-column">
          <div class="articles-column__meta">
            <span>{{ filteredCountLabel }}</span>
            <span v-if="listLoading">正在刷新</span>
          </div>

          <ArticleCard
            v-for="article in articles"
            :key="article.slug"
            :article="article"
            :active="selectedSlug === article.slug"
            @select="selectedSlug = $event"
          />
        </div>

        <aside v-if="selectedArticle" class="detail-panel">
          <p class="detail-panel__category">{{ selectedArticle.category }}</p>
          <h2>{{ selectedArticle.title }}</h2>
          <div class="detail-panel__meta">
            <span>{{ selectedArticle.source }}</span>
            <span>{{ selectedArticle.publishedAt }}</span>
            <span>{{ selectedArticle.readTime }}</span>
          </div>
          <p class="detail-panel__lead">{{ selectedArticle.summary }}</p>
          <div class="detail-panel__tags">
            <span v-for="tag in selectedArticle.tags" :key="tag">{{ tag }}</span>
          </div>
          <div class="detail-panel__body">
            <p v-for="paragraph in selectedArticle.content" :key="paragraph">{{ paragraph }}</p>
          </div>
          <a
            v-if="selectedArticle.url"
            class="detail-panel__source-link"
            :href="selectedArticle.url"
            target="_blank"
            rel="noreferrer"
          >
            查看原文
          </a>
        </aside>
      </div>
    </section>
  </main>

  <section v-else-if="error" class="feedback">{{ error }}</section>
  <section v-else class="feedback">正在初始化平台...</section>
</template>
