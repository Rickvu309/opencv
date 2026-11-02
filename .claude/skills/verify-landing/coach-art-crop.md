# Coach art reference crop (check 30)

The reference comes from the design tool or a human-approved screenshot. The recorder never writes it.

`reference/coach-art.png` was cropped from a pen.dev screenshot of the benefit shot. The screenshot is 812×778, a roughly 2× export of the 405×388 shot (fill about #F4F4F6, radius 16) that centres the 300×300 art node oWS4Z. The art rectangle in shot pixels starts at ((405 − 300) / 2, (388 − 300) / 2) = (52.5, 44). Scaled by 812/405 and 778/388, the crop origin is (105.26, 88.23) and the crop size is (601.48, 601.55). That rectangle was bilinear-resampled to 300×300 and saved as `reference/coach-art.png`.

Check 30 compares the live Coach art with that file. The corrected art mismatched by 1.05% of pixels (943 of 90,000, channel delta above 48) on three identical runs. The old centre-rotated art mismatched by 1.47% (1,327 pixels). The limit stays 1.25% (1,125 pixels). One wrong ellipse moves about 150 pixels, which stays inside the band, so this check catches a whole-art regression, not a single wrong mark. Each rotated ellipse is pinned by `apps/web/src/test/landing-art-rotation.test.ts`.
