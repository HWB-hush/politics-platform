<script setup>
defineProps({
  article: {
    type: Object,
    required: true
  },
  active: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(["select"]);
</script>

<template>
  <button class="article-card" :class="{ 'article-card--active': active }" @click="emit('select', article.slug)">
    <div class="article-card__top">
      <span class="article-card__category">{{ article.category }}</span>
      <span class="article-card__badge">{{ article.readTime }}</span>
    </div>
    <h3>{{ article.title }}</h3>
    <p>{{ article.summary }}</p>
    <div class="article-card__footer">
      <div class="article-card__meta">
        <span>{{ article.source }}</span>
        <span>{{ article.publishedAt }}</span>
      </div>
      <span class="article-card__indicator" aria-hidden="true">→</span>
    </div>
  </button>
</template>
