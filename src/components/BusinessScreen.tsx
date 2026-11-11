import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { membershipQuery } from '@/lib/org';
import { businessRecordsQuery, type BusinessRecords } from '@/lib/screen-data';
import { useLanguage } from '@/lib/language';
import { Screen } from '@/components/Screen';
import { CreateOrg } from '@/components/ProjectList';

export function BusinessScreen({ title, children }: { title: string; children: (data: BusinessRecords) => ReactNode }) {
  const { t } = useLanguage();
  const membership = useQuery(membershipQuery);
  const org = membership.data?.organizations;
  return (
    <Screen title={title} orgName={org?.name}>
      {membership.isPending ? <p>{t('Loading…')}</p> : membership.error ? <p role="alert" className="text-destructive">{membership.error.message}</p> : org ? <Records orgId={org.id}>{children}</Records> : <CreateOrg />}
    </Screen>
  );
}

function Records({ orgId, children }: { orgId: string; children: (data: BusinessRecords) => ReactNode }) {
  const { t } = useLanguage();
  const records = useQuery(businessRecordsQuery(orgId));
  if (records.isPending) return <p>{t('Loading…')}</p>;
  if (records.error) return <p role="alert" className="text-destructive">{records.error.message}</p>;
  return children(records.data);
}
