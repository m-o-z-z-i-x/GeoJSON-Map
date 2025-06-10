<script setup>
  // ...
</script>

<template>
  <div class="app">
    <router-view></router-view>
  </div>
</template>

<style lang="scss">
  :root {
    --primary-color: #2196F3;
    --success-color: #4CAF50;
    --danger-color: #F44336;
    --text-primary: #2c3e50;
    --text-secondary: #666;
    --background-light: #f8f9fa;
    --white: #ffffff;
    --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.1);
    --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
    --shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.1);
    --border-radius: 12px;
  }

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background-color: var(--background-light);
  }
</style>