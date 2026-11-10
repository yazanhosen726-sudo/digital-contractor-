// @vitest-environment node
import { expect, it } from 'vitest';
import { projectInsertInput } from './contractor.schemas';

it('converts project form amounts and organization into a database insert payload', () => {
  const project = projectInsertInput.parse({ orgId: '00000000-0000-4000-8000-000000000001', name: 'Test project', code: 'P-1', location: '', currency: 'USD', original_budget: '1250.50', contract_value: '2000.25', status: 'planning' });
  expect(project.original_budget).toBe(1250.5);
  expect(project.contract_value).toBe(2000.25);
  expect(project.org_id).toBe('00000000-0000-4000-8000-000000000001');
  expect(project).not.toHaveProperty('orgId');
});

const input = { orgId: '00000000-0000-4000-8000-000000000001', name: 'Test project', code: 'P-1', location: '', currency: 'USD', original_budget: '', contract_value: '', status: 'planning' };
it('preserves blank optional project amounts as unknown instead of zero', () => {
  const project = projectInsertInput.parse(input);
  expect(project.original_budget).toBeNull();
  expect(project.contract_value).toBeNull();
});
it('rejects malformed or negative supplied project amounts', () => {
  expect(projectInsertInput.safeParse({ ...input, original_budget: '-1' }).success).toBe(false);
  expect(projectInsertInput.safeParse({ ...input, contract_value: '12.345' }).success).toBe(false);
});