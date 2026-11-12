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
it('normalizes lowercase and padded currency before the existing uppercase database constraint', () => {
  expect(projectInsertInput.parse({ ...input, currency: ' usd ' }).currency).toBe('USD');
});
it.each(['', ' ', null, undefined])('normalizes optional amount %s to null', value => {
  const project = projectInsertInput.parse({ ...input, original_budget: value, contract_value: value });
  expect(project.original_budget).toBeNull();
  expect(project.contract_value).toBeNull();
});
it.each([['0', 0], ['0.00', 0], ['.50', 0.5], ['12.', 12], [' 1250.50 ', 1250.5]])('converts valid decimal %s consistently', (value, expected) => {
  expect(projectInsertInput.parse({ ...input, original_budget: value, contract_value: value }).original_budget).toBe(expected);
  expect(projectInsertInput.parse({ ...input, original_budget: value, contract_value: value }).contract_value).toBe(expected);
});
it('normalizes missing optional location and trims supplied project fields', () => {
  const project = projectInsertInput.parse({ ...input, name: ' Project ', code: ' P-1 ', location: undefined });
  expect(project.location).toBe(''); expect(project.name).toBe('Project'); expect(project.code).toBe('P-1');
});
it.each([['name', ' ', 'Project name is required'], ['code', '', 'Project code is required'], ['currency', 'US', 'Enter a three-letter currency code, such as USD']])('returns a specific error for invalid %s', (field, value, message) => {
  const result = projectInsertInput.safeParse({ ...input, [field]: value });
  expect(result.success).toBe(false);
  if (!result.success) expect(result.error.issues).toContainEqual(expect.objectContaining({ path: [field], message }));
});