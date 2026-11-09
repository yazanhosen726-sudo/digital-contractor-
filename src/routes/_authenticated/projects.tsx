import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { membershipQuery, WRITE_ROLES } from '@/lib/org';
import { screenHead } from '@/lib/screen-data';
import { Screen } from '@/components/Screen';
import { ProjectList, CreateOrg } from '@/components/ProjectList';
import { useLanguage } from '@/lib/language';
export const Route = createFileRoute('/_authenticated/projects')({ head: () => screenHead('Projects', 'Search and manage your construction projects.'), component: Projects });
function Projects() { const { t } = useLanguage(); const { data, isPending, error } = useQuery(membershipQuery); const org = data?.organizations; return <Screen title="Projects" orgName={org?.name}>{isPending ? <p>{t('Loading…')}</p> : error ? <p role="alert">{error.message}</p> : org ? <ProjectList orgId={org.id} canWrite={WRITE_ROLES.includes(data.role)} /> : <CreateOrg />}</Screen>; }
