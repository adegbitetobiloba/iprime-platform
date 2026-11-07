// Owner: Account 1. Appears only while the phone has no internet.
import { useOnline } from '../../core/network';
import { Banner } from './Banner';

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return <Banner tone="warning" title="You're offline" message="Some things may be out of date. We'll update them when you're back online." />;
}
