const ASSET_BASE = "/assets";

const MEDIA_SPECS = {
  "generated-1773971687495.png": { width: 1408, height: 768, variants: [640, 1024, 1408] },
  "generated-1773971894915.png": { width: 1408, height: 768, variants: [640, 1024, 1408] },
  "generated-1774007656775.png": { width: 1408, height: 768, variants: [640, 1024, 1408] },
  "generated-1774007681359.png": { width: 1408, height: 768, variants: [640, 1024, 1408] },
  "generated-1774007817252.png": { width: 1408, height: 768, variants: [640, 1024, 1408] },
  "generated-1774007838586.png": { width: 1408, height: 768, variants: [640, 1024, 1408] },
  "generated-1774018325276.png": { width: 1408, height: 768, variants: [640, 1024, 1408] },
  "generated-1774018768922.png": { width: 1408, height: 768, variants: [640, 1024, 1408] },
  "generated-1774018865796.png": { width: 1408, height: 768, variants: [640, 1024, 1408] },
  "generated-1774018887348.png": { width: 1408, height: 768, variants: [640, 1024, 1408] },
  "jet-dencre-logo-horizontal-light.png": { width: 400, height: 145, variants: [400] },
  "jet-dencre-logo-vertical-dark.png": { width: 520, height: 500, variants: [520] },
  "jet-dencre-monogram-light.png": { width: 180, height: 168, variants: [180] },
};

function withoutExtension(fileName) {
  return fileName.replace(/\.[^/.]+$/, "");
}

function buildAsset(fileName, spec) {
  const stem = withoutExtension(fileName);
  const variants = spec.variants.map((width) => ({
    src: `${ASSET_BASE}/${stem}-${width}.webp`,
    width,
    height: Math.round((spec.height * width) / spec.width),
  }));

  return Object.freeze({
    original: `${ASSET_BASE}/${fileName}`,
    src: variants.at(-1).src,
    width: spec.width,
    height: spec.height,
    variants: Object.freeze(variants),
  });
}

/**
 * Registre central des PNG historiques et de leurs équivalents WebP.
 * Les clés restent les noms PNG afin de faciliter une migration progressive.
 */
export const mediaAssets = Object.freeze(
  Object.fromEntries(
    Object.entries(MEDIA_SPECS).map(([fileName, spec]) => [fileName, buildAsset(fileName, spec)]),
  ),
);

export function getMediaAsset(fileName) {
  const asset = mediaAssets[fileName];
  if (!asset) {
    throw new Error(`Média inconnu : ${fileName}`);
  }
  return asset;
}

/** Retourne une valeur srcSet prête à être passée à un élément <img>. */
export function createMediaSrcSet(fileName) {
  return getMediaAsset(fileName).variants
    .map(({ src, width }) => `${src} ${width}w`)
    .join(", ");
}

/**
 * Fournit les propriétés communes d'une image responsive.
 * `original` reste disponible dans le registre comme solution de repli PNG.
 */
export function getResponsiveImageProps(
  fileName,
  {
    sizes = "(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 1408px",
    loading = "lazy",
    decoding = "async",
  } = {},
) {
  const asset = getMediaAsset(fileName);
  return {
    src: asset.src,
    srcSet: createMediaSrcSet(fileName),
    sizes,
    width: asset.width,
    height: asset.height,
    loading,
    decoding,
  };
}
