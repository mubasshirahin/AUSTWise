import { liveLoad, liveSave } from './liveStorage';

const BATCH_STORAGE_KEY = 'aust-vault-batches';

function getBatchStore() {
  return liveLoad('user', BATCH_STORAGE_KEY, {});
}

function saveBatchStore(store) {
  liveSave('user', BATCH_STORAGE_KEY, store);
}

function getKey(department, yearSem) {
  return department + '-' + yearSem;
}

export function getBatchConfigs(department, yearSem) {
  const store = getBatchStore();
  return store[getKey(department, yearSem)] || [];
}

export function addBatchConfig(department, yearSem, batch) {
  const store = getBatchStore();
  const key = getKey(department, yearSem);
  const list = store[key] || [];
  const entry = { id: 'batch_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), ...batch };
  list.push(entry);
  store[key] = list;
  saveBatchStore(store);
  return entry;
}

export function deleteBatchConfig(department, yearSem, batchId) {
  const store = getBatchStore();
  const key = getKey(department, yearSem);
  store[key] = (store[key] || []).filter(b => b.id !== batchId);
  saveBatchStore(store);
}

export function updateBatchDriveUrl(department, yearSem, batchId, driveUrl) {
  const store = getBatchStore();
  const key = getKey(department, yearSem);
  const list = store[key] || [];
  const idx = list.findIndex(b => b.id === batchId);
  if (idx !== -1) {
    list[idx].driveUrl = driveUrl;
    store[key] = list;
    saveBatchStore(store);
  }
}
