import { PageHeader } from './PageHeader';
import {
  BrainPituitaryIcon,
  HeartPulseIcon,
  TargetTissueIcon,
  TestesIcon,
  type IconComponent,
} from './customIcons';

interface PathwaySite {
  id: string;
  title: string;
  description: string;
  Icon: IconComponent;
}

const SITES: PathwaySite[] = [
  { id: 'hp', title: 'Hypothalamus + Pituitary', description: 'Regulate and release hormones', Icon: BrainPituitaryIcon },
  { id: 'cardio', title: 'Cardiovascular system', description: 'Carries hormones; proteins bind and transport them', Icon: HeartPulseIcon },
  { id: 'testes', title: 'Testes', description: 'Produce sex steroids', Icon: TestesIcon },
  { id: 'target', title: 'Target tissues', description: 'Where hormones exert their effects', Icon: TargetTissueIcon },
];

export function HormonalPathwaysView() {
  return (
    <div>
      <PageHeader
        overline="Endocrinology"
        titlePrimary="Hormonal"
        titleAccent="Pathways"
        description={['Biochemical pathways of hormones']}
      />
      <div className="mc-pathway-bands">
        {SITES.map(({ id, title, description, Icon }) => (
          <section key={id} className="mc-pathway-band" aria-label={title}>
            <div className="mc-pathway-site">
              <h2 className="mc-pathway-title">{title}</h2>
              <span className="mc-pathway-icon">
                <Icon size={28} />
              </span>
              <p className="mc-pathway-desc">{description}</p>
            </div>
            <div className="mc-pathway-diagram" />
          </section>
        ))}
      </div>
    </div>
  );
}
