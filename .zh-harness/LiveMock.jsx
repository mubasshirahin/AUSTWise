import { useState } from 'react';
export function useLiveValue(scope, key, fallback = null) { const [v, setV] = useState(fallback); return [v, setV]; }
export const getLiveValue = (s, k, f = null) => f;
export const setLiveValue = async () => {};
export const onLiveChange = () => () => {};
export const ensureFetched = () => {};
export const useLiveRefresh = () => {};
export const delLiveValue = async () => {};
export const onRealtimeMessage = () => () => {};
export const sendRealtime = () => {};
export const onRealtimeStatus = () => () => {};
export const getLiveStoreStatus = () => ({});
