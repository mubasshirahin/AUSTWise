import { describe, it, expect } from 'vitest';
import { isPublicApiPath } from './publicApi.mjs';

describe('isPublicApiPath', () => {
  it('allows sign-in, guest counters and landing endpoints', () => {
    for (const p of ['/api/auth/login', '/api/auth/me', '/api/auth/github/callback?code=1', '/api/guest/visit',
      '/api/stats/count', '/api/testimonials', '/api/page-availability?path=/x', '/api/role-access/map',
      '/api/invite/validate?token=a', '/api/payment/webhook']) {
      expect(isPublicApiPath(p)).toBe(true);
    }
  });

  it('blocks member data, chats and campus content for signed-out callers', () => {
    for (const p of ['/api/presence/members', '/api/messages', '/api/messages/123', '/api/routines/shared',
      '/api/notices', '/api/marketplace', '/api/question-papers', '/api/question-papers/download/1',
      '/api/vault/notes', '/api/store/shared/aust-buzz-posts', '/api/gaming/rooms', '/api/clubs',
      '/api/authx', '/api/guestbook']) {
      expect(isPublicApiPath(p)).toBe(false);
    }
  });
});
