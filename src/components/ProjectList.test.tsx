import { act, fireEvent, render, screen, cleanup } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, expect, it, vi } from 'vitest';
import { NewProject } from './ProjectList';

const mocks = vi.hoisted(() => ({ insert: vi.fn(), single: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: () => ({ insert: mocks.insert }) } }));
vi.mock('@/lib/language', () => ({ useLanguage: () => ({ t: (value: string) => value }) }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
const orgId = '00000000-0000-4000-8000-000000000001';
function setup() {
  mocks.insert.mockReturnValue({ select: () => ({ single: mocks.single }) });
  const done = vi.fn();
  render(<QueryClientProvider client={new QueryClient()}><NewProject orgId={orgId} onDone={done} /></QueryClientProvider>);
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: 'Site A' } });
  fireEvent.change(screen.getByLabelText('Project code'), { target: { value: 'P-1' } });
  const form = screen.getByRole('button', { name: 'Create project' }).closest('form');
  if (!form) throw new Error('Project form missing');
  return { done, form };
}
it('allows only one insert during simultaneous submissions and confirms the returned project', async () => {
  let finish: ((value: unknown) => void) | undefined;
  mocks.single.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const { form, done } = setup();
  fireEvent.submit(form); fireEvent.submit(form);
  expect(mocks.insert).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Please wait…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  await act(async () => { finish?.({ data: { id: 'saved-project', org_id: orgId, code: 'P-1' }, error: null }); });
  expect(done).toHaveBeenCalledTimes(1);
});
it('shows a field error for duplicate codes without reporting success or retrying', async () => {
  mocks.single.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } });
  const { form, done } = setup();
  await act(async () => { fireEvent.submit(form); });
  expect(screen.getByRole('alert')).toHaveTextContent('This project code already exists');
  expect(done).not.toHaveBeenCalled(); expect(mocks.insert).toHaveBeenCalledTimes(1);
});
it('rejects invalid required input before inserting', () => {
  const { form } = setup();
  fireEvent.change(screen.getByLabelText('Project name'), { target: { value: ' ' } });
  fireEvent.submit(form);
  expect(screen.getByRole('alert')).toHaveTextContent('Project name is required');
  expect(mocks.insert).not.toHaveBeenCalled();
});
it('does not report success when no inserted record is returned', async () => {
  mocks.single.mockResolvedValue({ data: null, error: null });
  const { form, done } = setup();
  await act(async () => { fireEvent.submit(form); });
  expect(screen.getByRole('alert')).toHaveTextContent('The saved project could not be confirmed');
  expect(done).not.toHaveBeenCalled();
});