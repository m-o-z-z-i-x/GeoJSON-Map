<script setup>
  const props = defineProps({
    show: {
      type: Boolean,
      default: false
    },
    message: {
      type: String,
      default: ""
    },
    progress: {
      type: Number,
      default: 0
    }
  });
</script>

<template>
  <div v-if="show" class="loading-overlay">
    <div class="loading-content">
      <div class="loading-message">{{ message }}</div>

      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
  .loading-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
  }

  .loading-content {
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    min-width: 300px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  .loading-message {
    margin-bottom: 10px;
    text-align: center;
    font-size: 16px;
  }

  .progress-bar {
    width: 100%;
    height: 20px;
    background-color: #f0f0f0;
    border-radius: 10px;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    background-color: #4CAF50;
    transition: width 0.3s ease;
  }
</style> 