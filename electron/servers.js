// ---------- 订阅节点（按导入批次分组） ----------
// 订阅节点持久化在 settings.subscribedNodes（数组，元素为 toServer() 输出格式）
// 每个节点带批次信息：batchId / batchName / importedAt
// 历史节点（旧版本导入，无批次字段）在读取时自动归入「历史导入」批次

function getSubscribed(settings) {
  try {
    return settings.get('subscribedNodes') || [];
  } catch (e) {
    return [];
  }
}

// 生成批次 id 与名称
function makeBatch(settings) {
  const nodes = getSubscribed(settings);
  const ids = new Set();
  for (const s of nodes) {
    // 历史节点（legacy 或未迁移）不计入批次序号
    if (s.batchId && s.batchId !== 'legacy') ids.add(s.batchId);
  }
  const id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return { id, name: '批次 ' + (ids.size + 1) };
}

// 合并：默认仅返回订阅节点（隐藏内置节点），并完成历史节点批次迁移
function getAllServers(settings) {
  const nodes = getSubscribed(settings);
  let changed = false;
  for (const s of nodes) {
    if (!s.batchId) {
      s.batchId = 'legacy';
      s.batchName = '历史导入';
      s.importedAt = 0;
      changed = true;
    }
  }
  if (changed) settings.set('subscribedNodes', nodes);
  return nodes;
}

// 追加/更新订阅节点（按 id upsert），每次导入算作一批
// - 新节点：归属本批次（batchId/batchName/importedAt）
// - 已存在的节点：仅刷新配置，保留原批次，便于按批次统一管理
function addSubscription(settings, servers) {
  const existing = getSubscribed(settings);
  const map = new Map(existing.map((s) => [s.id, s]));
  const batch = makeBatch(settings);
  const now = Date.now();
  let freshCount = 0;
  for (const s of servers) {
    const old = map.get(s.id);
    if (old) {
      // 已存在：用新配置覆盖，保留原批次归属
      map.set(s.id, { ...s, batchId: old.batchId, batchName: old.batchName, importedAt: old.importedAt });
    } else {
      map.set(s.id, { ...s, batchId: batch.id, batchName: batch.name, importedAt: now });
      freshCount++;
    }
  }
  const merged = [...map.values()];
  settings.set('subscribedNodes', merged);
  return { nodes: merged, batch, freshCount };
}

// 移除单个订阅节点，返回最新订阅列表
function removeSubscription(settings, id) {
  const next = getSubscribed(settings).filter((s) => s.id !== id);
  settings.set('subscribedNodes', next);
  return next;
}

// 删除整批订阅节点，返回最新订阅列表
function removeBatch(settings, batchId) {
  const next = getSubscribed(settings).filter((s) => s.batchId !== batchId);
  settings.set('subscribedNodes', next);
  return next;
}

// 批次名称序号（如「批次 3」→ 3），用于同毫秒导入时的排序兜底
function batchSeq(name) {
  const m = /批次\s*(\d+)/.exec(name || '');
  return m ? parseInt(m[1], 10) : -1;
}

// 获取批次列表（含每个批次的节点数量），按导入时间倒序（同时间按批次序号倒序）
function getBatches(settings) {
  const nodes = getAllServers(settings);
  const map = new Map();
  for (const s of nodes) {
    let b = map.get(s.batchId);
    if (!b) {
      b = { id: s.batchId, name: s.batchName || '未知批次', importedAt: s.importedAt || 0, count: 0 };
      map.set(s.batchId, b);
    }
    b.count++;
  }
  return [...map.values()].sort((a, b) => {
    if (a.importedAt !== b.importedAt) return b.importedAt - a.importedAt;
    return batchSeq(b.name) - batchSeq(a.name);
  });
}

module.exports = { getAllServers, addSubscription, removeSubscription, removeBatch, getBatches };
