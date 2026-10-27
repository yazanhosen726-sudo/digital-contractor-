import { describe, expect, it } from 'vitest';
import { money, toCents, multiplyCents } from './money';
import { convert } from './fx';
import { financialReport, type Cost } from './report';
const cost: Cost = { id:'e', project_id:'p', category_id:null, supplier_id:null, purchase_order_id:'po', currency:'USD',total_amount:'30.00',transaction_date:'2026-10-01',status:'recorded',approval_status:'not_required',needs_review:false };
const baseline = { projects:[{ id:'p',name:'Project',currency:'USD',original_budget:'100.00',contract_value:'150.00' }], expenses:[cost],receivables:[{id:'i',project_id:'p',currency:'USD',total_amount:'80.00',status:'issued'}],payments:[{expense_id:'e',receivable_id:null,project_id:'p',currency:'USD',amount:'10.00',direction:'outgoing'}],purchase_orders:[{id:'po',project_id:'p',currency:'USD',total_amount:'50.00',status:'issued',order_date:'2026-10-01'}],budget_revisions:[{project_id:'p',amount_delta:'20.00',status:'approved'},{project_id:'p',amount_delta:'500.00',status:'pending'}],exchange_rates:[] };
describe('Contractor finance rules',()=>{
 it('uses exact cents and half-away-from-zero rounding',()=>{expect(toCents('1.005')).toBe(101n);expect(toCents('-1.005')).toBe(-101n);expect(multiplyCents(100n,'0.105')).toBe(11n)});
 it('never guesses missing exchange rates',()=>{expect(convert(money('10','EUR'),'USD','2026-10-01',[]).converted).toBeNull()});
 it('uses the most recent eligible direct or inverse rate',()=>{expect(convert(money('10','EUR'),'USD','2026-10-01',[{from_currency:'EUR',to_currency:'USD',rate:'1.1',rate_date:'2026-09-01'},{from_currency:'USD',to_currency:'EUR',rate:'0.5',rate_date:'2026-10-01'}]).converted?.cents).toBe(2000n)});
 it('does not count an invoice again as a purchase commitment',()=>{const r=financialReport(baseline).projects[0];expect(r?.actualCost).toBe('30.00');expect(r?.commitments).toBe('20.00');expect(r?.availableAfterCommitments).toBe('70.00')});
 it('counts only approved budget changes',()=>expect(financialReport(baseline).projects[0]?.approvedBudget).toBe('120.00'));
 it('derives payables and cash separately',()=>{const r=financialReport(baseline);expect(r.payables['USD']).toBe('20.00');expect(r.cashOut['USD']).toBe('10.00');expect(r.receivables['USD']).toBe('80.00')});
 it('excludes drafts and pending approvals from actual costs',()=>expect(financialReport({...baseline,expenses:[{...cost,approval_status:'pending'},{...cost,id:'draft',status:'draft'}]}).actualCosts).toEqual({}));
 it('keeps currencies separate and marks incomplete budgets',()=>{const r=financialReport({...baseline,expenses:[cost,{...cost,id:'eur',currency:'EUR',total_amount:'8.00'}]});expect(r.actualCosts).toEqual({USD:'30.00',EUR:'8.00'});expect(r.projects[0]?.remainingBudget).toBeNull()});
});