# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/)
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.2] - 2026-05-29

### Changed
- Used `site.add` instead of `site.remote` for adding remote files
- Improved `removeGalleryOriginals` to also exclude originals from `site.files`

## [0.1.1] - 2026-05-28
Updated to improve experience when installing theme using `deno run -A https://lume.land/init.ts --theme=sono`

### Fixed
- Fixed `Method "filterImages" is not a function of object variable` error when installing theme using `deno run -A https://lume.land/init.ts --theme=sono` by moving filters to `plugins.ts`

### Changed
- Refactored `_config.ts` by moving all custom logic (remote files, image processors, `basePath`) into `plugins.ts`
- Distributed demo images with the theme; `src/_data/images.ods` spreadsheet updated to only use these images
- Removed redundant `base_url` variable
- Updated about page `src/pages/about.md` to use links to demo website's images so images still render when installing the theme without needing to download the images

## [0.1.0] - 2026-05-27
First version

[0.1.1]: https://github.com/koikurasu/sono/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/koikurasu/sono/releases/tag/v0.1.0
