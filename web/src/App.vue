<template>
  <div class="shell">
    <header class="topbar">
      <div>
        <p class="topbar__brand">政情平台</p>
        <p class="topbar__subline">Policy pulse for editorial teams</p>
      </div>
      <nav class="topbar__status">
        <RouterLink to="/">主页</RouterLink>
        <RouterLink to="/login">登录</RouterLink>
        <RouterLink to="/register">注册</RouterLink>
      </nav>
    </header>

    <RouterView />
  </div>
</template>
