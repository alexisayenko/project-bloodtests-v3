import chylomicron from '../../assets/lipids/chylomicron.svg?raw';
import vldl from '../../assets/lipids/vldl.svg?raw';
import idl from '../../assets/lipids/idl.svg?raw';
import ldl from '../../assets/lipids/ldl.svg?raw';
import lpa from '../../assets/lipids/lpa.svg?raw';
import hdl from '../../assets/lipids/hdl.svg?raw';
import { GLYPH_SIZE } from './lipidParticleGeometry';

/**
 * Alex's supplied particle artwork, inlined so its regions can be measured:
 * each file's yellow area is tagged `<id>-trig`, its teal area `<id>-chol`,
 * its first pink pill `<id>-apo` and a second one `<id>-apoa`. The areas are
 * illustrative, not the sourced shares.
 */

const RAW: Readonly<Record<string, string>> = { chylomicron, vldl, idl, ldl, lpa, hdl };

const REGION_BY_FILL: Readonly<Record<string, string>> = { '#FFD866': 'trig', '#77C9C8': 'chol' };
const PILL_FILL = '#F8B8CB';

export function tagArtwork(id: string, name: string, svg: string, width: number): string {
  let pills = 0;
  const tagged = svg.replace(/<(path|rect)\b([^>]*?)fill="(#[0-9A-Fa-f]{6})"/g, (match, tag: string, attrs: string, fill: string) => {
    const colour = fill.toUpperCase();
    let region = REGION_BY_FILL[colour];
    if (!region && colour === PILL_FILL) region = pills++ === 0 ? 'apo' : 'apoa';
    return region ? `<${tag} data-node="${id}-${region}"${attrs}fill="${fill}"` : match;
  });
  return tagged.replace(/<svg([^>]*?) width="([\d.]+)" height="([\d.]+)"/, (_match, attrs: string, w: string, h: string) => {
    const height = ((width * Number(h)) / Number(w)).toFixed(1);
    return `<svg${attrs} width="${width}" height="${height}" data-node="${id}" role="img" aria-label="${name}"`;
  });
}

export function artworkFor(id: string, name: string): string {
  return tagArtwork(id, name, RAW[id] ?? '', GLYPH_SIZE[id] ?? 120);
}
