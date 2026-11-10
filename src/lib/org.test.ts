// @vitest-environment node
import { expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), maybeSingle: vi.fn() };
  return { query, getUser: vi.fn(), from: vi.fn(() => query) };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: { getUser: mocks.getUser }, from: mocks.from } }));
import { membershipQuery } from './org';

it('selects the authenticated users own membership, not another visible member', async () => {
  const userId = '00000000-0000-4000-8000-000000000002';
  mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  for (const method of ['select', 'eq', 'order', 'limit'] as const) mocks.query[method].mockReturnValue(mocks.query);
  mocks.query.maybeSingle.mockResolvedValue({ data: { role: 'member' }, error: null });
  await membershipQuery.queryFn();
  expect(mocks.query.eq).toHaveBeenCalledWith('user_id', userId);
});