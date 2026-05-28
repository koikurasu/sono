import lume from "lume/mod.ts";
import plugins from "./plugins.ts";
import {
  imageDimensionsFromData,
  imageDimensionsFromStream,
} from "lume/deps/image_dimmensions.ts";
import { posix } from "lume/deps/path.ts";
import siteData from "./src/_data.json" with { type: "json" };
import basePath from "lume/plugins/base_path.ts";
const { lightbox_dimension, remove_originals } = siteData;

const site = lume({
  src: "./src",
});

site.remoteFile(
  "/assets/css/vendor/photoswipe.css",
  "https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe.css",
);
site.remoteFile(
  "/assets/css/vendor/photoswipe-dynamic-caption-plugin.css",
  "https://unpkg.com/photoswipe-dynamic-caption-plugin/photoswipe-dynamic-caption-plugin.css",
);
site.remoteFile(
  "/assets/js/vendor/macy.js",
  "https://cdn.jsdelivr.net/npm/macy@2",
);
site.remoteFile(
  "/assets/js/vendor/photoswipe-lightbox.esm.js",
  "https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe-lightbox.esm.js",
);
site.remoteFile(
  "/assets/js/vendor/photoswipe-dynamic-caption-plugin.esm.js",
  "https://unpkg.com/photoswipe-dynamic-caption-plugin/photoswipe-dynamic-caption-plugin.esm.js",
);
site.remoteFile(
  "/assets/js/vendor/photoswipe.esm.js",
  "https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe.esm.js",
);

site.use(plugins());

// add image dimensions to image links for photoswipe
site.process([".html"], async function processPswpSize(pages) {
  const sizes = new Map<
    string,
    { width: number; height: number } | undefined
  >();

  async function getImageSize(path: string) {
    if (sizes.has(path)) return sizes.get(path);

    const page = site.pages.find((p) => p.data.url === path);
    if (page) {
      const dims = imageDimensionsFromData(page.bytes);
      sizes.set(path, dims);
      return dims;
    }

    const file = site.files.find((f) => f.data.url === path);
    if (file) {
      using fs = await Deno.open(file.src.entry.src, {
        read: true,
        write: false,
      });
      const dims = await imageDimensionsFromStream(fs.readable);
      sizes.set(path, dims);
      return dims;
    }
  }

  for (const page of pages) {
    const { document } = page;
    const basePath = posix.dirname(page.outputPath);

    for (const a of document.querySelectorAll("a[pswp-size]")) {
      const href = a.getAttribute("href");
      if (!href) continue;

      const size = await getImageSize(posix.resolve(basePath, href));
      if (size) {
        a.setAttribute("data-pswp-width", size.width.toString());
        a.setAttribute("data-pswp-height", size.height.toString());
      }

      a.removeAttribute("pswp-size");
    }
  }
});

// remove original images from the published site
if (lightbox_dimension > 0 && remove_originals === true) {
  site.process(
    [".jpg", ".jpeg", ".png", ".webp", ".avif"],
    function removeGalleryOriginals(_pages, allPages) {
      const galleryPrefix = "/assets/images/gallery/";
      const suffixes = ["-thumbnail", "-thumbnail@2x", "-lightbox"];

      for (let i = allPages.length - 1; i >= 0; i--) {
        const url = allPages[i].data.url as string;
        if (!url.startsWith(galleryPrefix)) continue;

        const base = url.replace(/\.[^.]+$/, "");
        const isGenerated = suffixes.some((s) => base.endsWith(s));

        if (!isGenerated) {
          allPages.splice(i, 1);
        }
      }
    },
  );
}

site.use(basePath());

export default site;
