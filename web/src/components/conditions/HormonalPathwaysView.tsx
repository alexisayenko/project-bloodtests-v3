import { PageHeader } from './PageHeader';
import { COLOR } from '../../styles/tokens';

export function HormonalPathwaysView() {
  return (
    <div>
      <PageHeader
        overline="Endocrinology"
        titlePrimary="Hormonal"
        titleAccent="Pathways"
        description={['Biochemical pathways of hormones']}
      />
      <p style={{ color: COLOR.textMuted }}>Coming soon.</p>
    </div>
  );
}
