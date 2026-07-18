<script setup>
import { reactive, ref } from "vue";
import { RouterLink, useRouter } from "vue-router";
import { registerUser } from "../api";

const AUTH_TOKEN_KEY = "politics-platform-auth-token";

const router = useRouter();
const loading = ref(false);
const error = ref("");
const form = reactive({
  username: "",
  displayName: "",
  email: "",
  password: "",
  confirmPassword: ""
});

async function submitRegister() {
  error.value = "";

  if (!form.username || !form.displayName || !form.email || !form.password) {
    error.value = "请完整填写注册信息。";
    return;
  }

  if (form.password !== form.confirmPassword) {
    error.value = "两次输入的密码不一致。";
    return;
  }

  loading.value = true;

  try {
    const response = await registerUser({
      username: form.username.trim(),
      displayName: form.displayName.trim(),
      email: form.email.trim(),
      password: form.password
    });

    window.localStorage.setItem(AUTH_TOKEN_KEY, response.token);
    await router.push("/");
  } catch (registerError) {
    error.value = registerError.message || "注册失败，请稍后重试。";
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <section class="auth-section">
    <div class="auth-copy">
      <p class="auth-copy__eyebrow">账号注册</p>
      <h2>创建账号后自动进入主页面</h2>
      <p>注册页面已独立成路由，后续可以继续添加角色、权限和个人订阅等能力。</p>
    </div>

    <div class="auth-card">
      <div class="auth-tabs">
        <RouterLink to="/login">登录</RouterLink>
        <button class="active" type="button">注册</button>
      </div>

      <form class="auth-form" @submit.prevent="submitRegister">
        <label>
          <span>用户名</span>
          <input v-model.trim="form.username" type="text" placeholder="4-24 位字母、数字或下划线" />
        </label>
        <label>
          <span>显示名称</span>
          <input v-model.trim="form.displayName" type="text" placeholder="用于页面展示" />
        </label>
        <label>
          <span>邮箱</span>
          <input v-model.trim="form.email" type="email" placeholder="请输入常用邮箱" />
        </label>
        <label>
          <span>密码</span>
          <input v-model="form.password" type="password" placeholder="请输入密码" />
        </label>
        <label>
          <span>确认密码</span>
          <input v-model="form.confirmPassword" type="password" placeholder="请再次输入密码" />
        </label>
        <button class="auth-submit" type="submit" :disabled="loading">
          {{ loading ? "注册中..." : "创建账号" }}
        </button>
      </form>

      <p v-if="error" class="auth-feedback auth-feedback--error">{{ error }}</p>
    </div>
  </section>
</template>
