// Next Link handles basePath automatically; public image URLs need it explicitly.
export const basePath = '/sstli_diplome';
export const publicAsset = (src: string) => src.startsWith('/') && !src.startsWith('//') && !src.startsWith(`${basePath}/`) ? `${basePath}${src}` : src;
