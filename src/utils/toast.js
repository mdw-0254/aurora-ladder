import { reactive } from 'vue';

export const toasts = reactive({ items: [] });
let seq = 0;

export function toast(message, type = 'info', duration = 2600) {
  // 相同内容/类型的提示已存在时不重复叠加
  if (toasts.items.some((t) => t.message === message && t.type === type)) return;
  const id = ++seq;
  toasts.items.push({ id, message, type });
  setTimeout(() => {
    const i = toasts.items.findIndex((t) => t.id === id);
    if (i >= 0) toasts.items.splice(i, 1);
  }, duration);
}
