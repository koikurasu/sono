import {
  imageDimensionsFromData,
  imageDimensionsFromStream,
} from "lume/deps/image_dimmensions.ts";
import { posix } from "lume/deps/path.ts";
import basePath from "lume/plugins/base_path.ts";
import lightningcss from "lume/plugins/lightningcss.ts";
import metas from "lume/plugins/metas.ts";
import { Options as SitemapOptions, sitemap } from "lume/plugins/sitemap.ts";
import { favicon, Options as FaviconOptions } from "lume/plugins/favicon.ts";
import { merge } from "lume/core/utils/object.ts";
import sheets from "lume/plugins/sheets.ts";
import picture from "lume/plugins/picture.ts";
import transformImages from "lume/plugins/transform_images.ts";
import imageSize from "lume/plugins/image_size.ts";
import sass from "lume/plugins/sass.ts";
import slugifyUrls from "lume/plugins/slugify_urls.ts";

import siteData from "./src/_data.json" with { type: "json" };

import "lume/types.ts";

const { lightbox_dimension, remove_originals } = siteData;

// in the _data/images spreadsheet, these column names are already reserved
// for use when building the image gallery. all other columns are to be
// treated as metadata for building the filtering system.
const RESERVED = new Set(["filename", "date", "alt", "caption"]);

function slugValue(v: string): string {
  return v.normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export interface Options {
  sitemap?: Partial<SitemapOptions>;
  favicon?: Partial<FaviconOptions>;
}

export const defaults: Options = {
  favicon: {
    input: "assets/images/other/favicon.svg",
  },
};

/** Configure the site */
export default function (userOptions?: Options) {
  const options = merge(defaults, userOptions);

  return (site: Lume.Site) => {
    site.add(
      "https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe.css",
      "/assets/css/vendor/photoswipe.css",
    );
    site.add(
      "https://cdn.jsdelivr.net/npm/photoswipe-dynamic-caption-plugin/photoswipe-dynamic-caption-plugin.css",
      "/assets/css/vendor/photoswipe-dynamic-caption-plugin.css",
    );
    site.add(
      "https://cdn.jsdelivr.net/npm/macy@2",
      "/assets/js/vendor/macy.js",
    );
    site.add(
      "https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe-lightbox.esm.js",
      "/assets/js/vendor/photoswipe-lightbox.esm.js",
    );
    site.add(
      "https://cdn.jsdelivr.net/npm/photoswipe-dynamic-caption-plugin/photoswipe-dynamic-caption-plugin.esm.js",
      "/assets/js/vendor/photoswipe-dynamic-caption-plugin.esm.js",
    );
    site.add(
      "https://cdn.jsdelivr.net/npm/photoswipe@5/dist/photoswipe.esm.js",
      "/assets/js/vendor/photoswipe.esm.js",
    );

    // Register custom filters
    site.filter("extractMeta", (row: Record<string, unknown>) => {
      const meta: Record<string, string[]> = {};
      for (const [key, value] of Object.entries(row)) {
        if (!RESERVED.has(key)) {
          const slug = key.toLowerCase().replace(/\s+/g, "-");
          meta[slug] = typeof value === "string"
            ? value.split(",").map((v) => slugValue(v)).filter(Boolean)
            : [slugValue(String(value))];
        }
      }
      return meta;
    });

    // filter that removes the final .{image extension}
    site.filter(
      "removeExt",
      (filename: string) => filename.replace(/\.[^/.]+$/, ""),
    );

    // filter to convert dates to years
    site.filter("year", (value: string | number | Date): number | string => {
      if (!value) return "";
      if (value instanceof Date) return value.getUTCFullYear();

      const match = String(value).trim().match(/\d{3,4}/);
      return match ? parseInt(match[0], 10) : "";
    });

    // filter gallery images
    site.filter(
      "filterImages",
      (images: Record<string, unknown>[], query: Record<string, unknown>) => {
        if (!query) return images;

        return images.filter((img) => {
          return Object.entries(query).every(([key, value]) => {
            if (key === "date") {
              if (!img.date) return false;
              const imgYear = parseInt(
                String(img.date).match(/\d{3,4}/)?.[0] ?? "",
              );
              const queryValues = Array.isArray(value) ? value : [value];
              return queryValues.some((qv: unknown) =>
                imgYear === parseInt(String(qv))
              );
            }
            if (key === "date_from") {
              if (!img.date) return false;
              const imgYear = parseInt(
                String(img.date).match(/\d{3,4}/)?.[0] ?? "",
              );
              return imgYear >= parseInt(String(value));
            }
            if (key === "date_to") {
              if (!img.date) return false;
              const imgYear = parseInt(
                String(img.date).match(/\d{3,4}/)?.[0] ?? "",
              );
              return imgYear <= parseInt(String(value));
            }

            const imgVal = img[key];
            if (!imgVal) return false;
            const values = typeof imgVal === "string"
              ? imgVal.split(",").map((v: string) => v.trim())
              : [String(imgVal)];
            const queryValues = Array.isArray(value) ? value : [value];
            return (queryValues as unknown[]).every((qv) =>
              values.includes(String(qv))
            );
          });
        });
      },
    );

    site
      .use(sass())
      .use(lightningcss())
      .use(basePath())
      .use(slugifyUrls())
      .use(picture())
      .use(transformImages())
      .use(imageSize())
      .use(metas())
      .use(sitemap(options.sitemap))
      .use(favicon(options.favicon))
      .use(sheets({
        sheets: "first",
        extensions: [".ods", ".xlsx", ".csv"],
      }))
      .add("style.scss")
      .add("/assets");

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

          function isOriginal(url: string | undefined): boolean {
            if (!url?.startsWith(galleryPrefix)) return false;
            const base = url.replace(/\.[^.]+$/, "");
            return !suffixes.some((s) => base.endsWith(s));
          }

          for (let i = allPages.length - 1; i >= 0; i--) {
            if (isOriginal(allPages[i].data.url as string)) {
              allPages.splice(i, 1);
            }
          }

          for (let i = site.files.length - 1; i >= 0; i--) {
            if (isOriginal(site.files[i].data.url as string)) {
              site.files.splice(i, 1);
            }
          }
        },
      );
    }
  };
}
