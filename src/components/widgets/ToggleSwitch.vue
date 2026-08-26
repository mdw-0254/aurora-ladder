<template>
  <button
    class="toggle"
    :class="modelValue ? 'on' : 'off'"
    :disabled="disabled"
    role="switch"
    :aria-checked="modelValue"
    @click="$emit('update:modelValue', !modelValue)"
  ></button>
</template>

<script setup>
defineProps({
  modelValue: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false }
});
defineEmits(['update:modelValue']);
</script>
