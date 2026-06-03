#!/bin/bash
# Auto-download xsell raw images (run from site/ root)
set -e
mkdir -p assets/images/xsell-raw
cd assets/images/xsell-raw

echo "→ M1-X Wing"
curl -sL "https://cdn.shopify.com/s/files/1/0639/7814/3929/files/0a1658397c6edc7f1c4d4868accda992.jpg?v=1776403592" -o "0a1658397c6edc7f1c4d4868accda992.jpg"

echo "→ PPC Sonic FDS Wing"
curl -sL "https://cdn.shopify.com/s/files/1/0639/7814/3929/files/3cd5afb5c68228bf40b4b670e7eebdc0.png?v=1773894554" -o "3cd5afb5c68228bf40b4b670e7eebdc0.png"

echo "→ PPC Sonic FDS"
curl -sL "https://cdn.shopify.com/s/files/1/0639/7814/3929/files/Sonic_FDS.png" -o "Sonic_FDS.png"

echo "→ M1 Wing"
curl -sL "https://cdn.shopify.com/s/files/1/0639/7814/3929/files/a72f6737697cd9be2999d13c37ed1b21.png?v=1773888787" -o "a72f6737697cd9be2999d13c37ed1b21.png"

echo "→ M2 Wing"
curl -sL "https://cdn.shopify.com/s/files/1/0639/7814/3929/files/f1b1ef9c627f14c84b46165096846486.jpg?v=1774912416" -o "f1b1ef9c627f14c84b46165096846486.jpg"

echo "→ Cruise"
curl -sL "https://cdn.shopify.com/s/files/1/2503/9576/files/Cruise_1200x1200_07dc0705-315a-473f-b9c6-e76ee9237a06.png" -o "Cruise_1200x1200_07dc0705-315a-473f-b9c6-e76ee9237a06.png"

echo "→ Glide 2026"
curl -sL "https://cdn.shopify.com/s/files/1/2503/9576/files/Glide-5_0-White---Image-01_bigger_cd0d5cfe-0e37-4266-951d-0f5d8540530a.png" -o "Glide-5_0-White---Image-01_bigger_cd0d5cfe-0e37-4266-951d-0f5d8540530a.png"

echo "→ Glide Midlength 2026"
curl -sL "https://cdn.shopify.com/s/files/1/2503/9576/files/Glide-Midlength---White-6_0---Image-01.png" -o "Glide-Midlength---White-6_0---Image-01.png"

echo "→ Slide"
curl -sL "https://cdn.shopify.com/s/files/1/2503/9576/files/Slide-6_0-Board---main-Bigger.png" -o "Slide-6_0-Board---main-Bigger.png"

echo "→ Ultra Glide 2026"
curl -sL "https://cdn.shopify.com/s/files/1/2503/9576/files/Ultra-Glide-6_6-White---Image-01_bigger.png" -o "Ultra-Glide-6_6-White---Image-01_bigger.png"

echo "→ Wing V4"
curl -sL "https://cdn.shopify.com/s/files/1/2503/9576/files/Wings-V4-Green---Image-07_updated.png" -o "Wings-V4-Green---Image-07_updated.png"

echo "→ Wing V4 Pro"
curl -sL "https://cdn.shopify.com/s/files/1/2503/9576/files/Wings-V4-pro-5_5---Image-01_updated.png" -o "Wings-V4-pro-5_5---Image-01_updated.png"

echo "→ Wing VX Pro V2"
curl -sL "https://cdn.shopify.com/s/files/1/2503/9576/files/Wings-VX-pro2-5.0---Image-03_updated.png" -o "Wings-VX-pro2-5.0---Image-03_updated.png"

echo "→ Free Series FW 900"
curl -sL "https://levitaz.com/uploads/shop/levitaz-shaka-l-2000-75-hydrofoil-side-front.jpg" -o "levitaz-shaka-l-2000-75-hydrofoil-side-front.jpg"

echo "→ Boom FS 63 (63L 풀카본)"
curl -sL "https://levitaz.com/uploads/shop/levitaz_free_series_boom_63_ssc_overview2000x2000px.jpg" -o "levitaz_free_series_boom_63_ssc_overview2000x2000px.jpg"

echo "→ Boom FS 83 (83L 풀카본)"
curl -sL "https://levitaz.com/uploads/shop/levitaz_free_series_boom_83_ssc_overview2000x2000px.jpg" -o "levitaz_free_series_boom_83_ssc_overview2000x2000px.jpg"

echo "→ Boom FS 95 (95L 풀카본)"
curl -sL "https://levitaz.com/uploads/shop/levitaz_free_series_boom_95_ssc_overview2000x2000px.jpg" -o "levitaz_free_series_boom_95_ssc_overview2000x2000px.jpg"

echo "→ Free Series FW 540"
curl -sL "https://levitaz.com/uploads/shop/levitaz_free_series_frontwing_540_v2000x2000px.jpg" -o "levitaz_free_series_frontwing_540_v2000x2000px.jpg"

echo "→ Free Series FW 680"
curl -sL "https://levitaz.com/uploads/shop/levitaz_free_series_frontwing_680_v2000x2000px.jpg" -o "levitaz_free_series_frontwing_680_v2000x2000px.jpg"

echo "→ Free Series FW 790"
curl -sL "https://levitaz.com/uploads/shop/levitaz_free_series_frontwing_790_v2000x2000px.jpg" -o "levitaz_free_series_frontwing_790_v2000x2000px.jpg"

echo "→ Free Series FW 900"
curl -sL "https://levitaz.com/uploads/shop/levitaz_free_series_frontwing_900_v2000x2000px.jpg" -o "levitaz_free_series_frontwing_900_v2000x2000px.jpg"

echo "→ R6 Race Series V1"
curl -sL "https://levitaz.com/uploads/shop/levitaz_race_series_R6V1_vl1000x1000px_2024.jpg" -o "levitaz_race_series_R6V1_vl1000x1000px_2024.jpg"

echo "→ Impact Vest 50N"
curl -sL "https://www.forward-wip.com/wp-content/uploads/2021/02/1.-IMPACT-VEST-50N-1.jpg" -o "1.-IMPACT-VEST-50N-1.jpg"

echo "→ X-OVER Helmet"
curl -sL "https://www.forward-wip.com/wp-content/uploads/2021/02/1.X-OVER-HIGH-VIZ.jpg" -o "1.X-OVER-HIGH-VIZ.jpg"

echo "→ Wing Belt 4.0"
curl -sL "https://www.forward-wip.com/wp-content/uploads/2025/02/1.WINGBELT-4.0.jpg" -o "1.WINGBELT-4.0.jpg"
