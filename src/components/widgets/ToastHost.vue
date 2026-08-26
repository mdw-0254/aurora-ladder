<template>
  <div class="toast-host">
    <TransitionGroup name="toast">
      <div v-for="t in toasts.items" :key="t.id" class="toast" :class="t.type">
        <span class="toast-ico" v-if="t.type === 'success'">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M5 13l4 4 10-10" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </span>
        <span class="toast-ico" v-else-if="t.type === 'error'">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/></svg>
        </span>
        <span class="toast-ico" v-else>
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v5m0 3h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
        </span>
        <span>{{ t.message }}</span>
      </div>
    </TransitionGroup>
  </div>
</template>

<script setup>
import { toasts } from '../../utils/toast';
</script>

<style scoped>
.toast-host {
  position: fixed;
  top: 60px;
  right: 20px;
  z-index: 999;
  display: flex;
  flex-direction: column;
  gap: 10px;
  pointer-events: none;
}
.toast {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 11px 16px;
  border-radius: 12px;
  font-size: 13px;
  color: var(--text-1);
  background: var(--panel-solid);
  border: 1px solid var(--panel-border-2);
  box-shadow: var(--shadow-2);
  backdrop-filter: blur(14px);
  animation: toast-in 0.28s cubic-bezier(0.34, 1.4, 0.64, 1);
}
.toast-ico { display: flex; }
.toast.success .toast-ico { color: var(--success); }
.toast.error .toast-ico { color: var(--danger); }
.toast.info .toast-ico { color: var(--info); }
.toast-leave-active { transition: opacity 0.25s, transform 0.25s; }
.toast-leave-to { opacity: 0; transform: translateX(20px); }
.toast-move { transition: transform 0.25s; }
</style>
