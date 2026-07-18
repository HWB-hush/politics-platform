<script setup>
import { reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { loginUser } from "../api";

const AUTH_TOKEN_KEY = "politics-platform-auth-token";

const router = useRouter();
const loading = ref(false);
const error = ref("");
const form = reactive({
  account: "",
  password: ""
});

async function submitLogin() {
  error.value = "";

  if (!form.account || !form.password) {
    error.value = "请输入用户名或邮箱，以及密码。";
    return;
  }

  loading.value = true;

  try {
    const response = await loginUser({
      account: form.account.trim(),
      password: form.password
    });

    window.localStorage.setItem(AUTH_TOKEN_KEY, response.token);
    await router.push("/");
  } catch (loginError) {
    error.value = loginError.message || "登录失败，请稍后重试。";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="auth-section">
    <div class="auth-copy">
      <p class="auth-copy__eyebrow">账号登录</p>
      <h2>登录后回到主页面继续查看政情资讯</h2>
      <p>这里使用后端已有的登录接口，成功后会保存 token，并自动跳转到主页。</p>
    </div>

    <div class="auth-card">
      <div class="auth-tabs">
        <button class="active" type="button">登录</button>
        <RouterLink to="/register">注册</RouterLink>
      </div>

      <form class="auth-form" @submit.prevent="submitLogin">
        <label>
          <span>用户名或邮箱</span>
          <input v-model.trim="form.account" type="text" placeholder="请输入用户名或邮箱" />
        </label>
        <label>
          <span>密码</span>
          <input v-model="form.password" type="password" placeholder="请输入密码" />
        </label>
        <button class="auth-submit" type="submit" :disabled="loading">
          {{ loading ? "登录中..." : "立即登录" }}
        </button>
      </form>

      <p v-if="error" class="auth-feedback auth-feedback--error">{{ error }}</p>
    </div>
  </section>
</template>
