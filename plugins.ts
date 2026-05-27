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

import "lume/types.ts";

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
  };
}
