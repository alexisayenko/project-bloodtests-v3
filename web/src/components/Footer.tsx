import { DEV_COMMIT, commitUrl, copyrightLine, formatBuildTime } from './buildInfo';

const FOOTER = {
  marginTop: 64,
  padding: '16px 12px 28px',
  borderTop: '1px solid #eee',
  color: '#999',
  fontSize: 12,
  lineHeight: 1.7,
  textAlign: 'center',
} as const;

export function Footer() {
  const commit = __BUILD_COMMIT__;
  return (
    <footer style={FOOTER}>
      <div>{copyrightLine(__BUILD_TIME__)}</div>
      <div>
        Build{' '}
        {commit === DEV_COMMIT ? (
          <span>{commit}</span>
        ) : (
          <a
            href={commitUrl(commit)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit' }}
          >
            {commit}
          </a>
        )}
        {' · '}
        {formatBuildTime(__BUILD_TIME__)}
      </div>
    </footer>
  );
}
