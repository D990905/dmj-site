# IMAGE_INVENTORY — Phase 9 (2026-05-05)

## 수집 방식 (이번 Phase 결정사항)

**현재 상태**: 외부 CDN URL hotlink 방식.
- Cowork sandbox egress allowlist에 brand CDN 도메인 (cdn.shopify.com, levitaz.com) 미포함 → curl/web_fetch 다운로드 불가.
- 대안: brand 공식 CDN URL을 `<img src="https://...">`로 직접 사용. brand 공식 distributor 권한 확보됨.
- **Phase 2 (Cafe24 launch) 전 우선 작업**: 로컬 캐시화 (CDN 의존 제거).

**저장 위치**: 본 디렉토리는 placeholder. 실제 이미지는 모두 외부 CDN.

---

## Levitaz (오스트리아 프리미엄 카본 포일)

> ⚠ levitaz.com 도메인이 takoon.com으로 redirect됨 (brand 통합).
> URL은 levitaz.com CDN 직접 hotlink — 일부 작동 안 할 수 있음 (Phase 2 재캐시 필수).

| SKU | 제품명 | 카테고리 | 이미지 URL |
|---|---|---|---|
| boom-94 | Boom 94 (95L급) | board | https://levitaz.com/uploads/shop/levitaz-boom-94-wing-foil-board-product-single-1000x1000px_2021-05-03-095914.jpg |
| boom-75 | Boom 75 (83L급) | board | https://levitaz.com/uploads/shop/levitaz-boom-75-wing-foil-board-product-single-1000x1000px.jpg |
| boom-58 | Boom 58 | board | https://levitaz.com/uploads/shop/levitaz-boom-58-wing-foil-board-product-single-1000x1000px.jpg |
| boom-44 | Boom 44 (63L급) | board | https://levitaz.com/uploads/shop/levitaz-boom-44-wing-foil-board-product-single-1000x1000px.jpg |
| boom-29 | Boom 29 | board | https://levitaz.com/uploads/shop/levitaz-boom-29-wing-surf-foil-board-product-single-1000x1000px.jpg |
| r6-race | R6 Race Series V1 | race_foil | https://levitaz.com/uploads/shop/levitaz_race_series_R6V1_vl1000x1000px_2024.jpg |
| shaka-ha-1100 | Shaka HA-1100 (FW540급) | front_wing | https://levitaz.com/uploads/shop/levitaz-shaka-ha-1100-75-hydrofoil-side-front.jpg |
| shaka-ha-1300 | Shaka HA-1300 (FW680급) | front_wing | https://levitaz.com/uploads/shop/levitaz-shaka-ha-1300-75-hydrofoil-side-front_2022-05-12-073947_xgmk.jpg |
| shaka-ha-1600 | Shaka HA-1600 Pro (FW790급) | front_wing | https://levitaz.com/uploads/shop/levitaz-shaka-ha-1600-pro-90-hydrofoil-side-front.jpg |
| shaka-l | Shaka L (FW900급) | front_wing | https://levitaz.com/uploads/shop/levitaz-shaka-l-2000-75-hydrofoil-side-front.jpg |
| cruizer-pro | Cruizer Pro | front_wing | https://levitaz.com/uploads/shop/levitaz-cruizer-pro-90-hydrofoil-side_front.jpg |
| mast-90 | Mast 90 Full Carbon | mast | https://levitaz.com/uploads/shop/levitaz-mast-90-full-carbon-foil-1000x1000px.jpg |
| fuselage-60ti | Fuselage 60 Titanium | fuselage | https://levitaz.com/uploads/shop/levitaz-fuselage-60ti-titanium-60cm-1000x1000px.jpg |

**SKU naming 정정 노트**: Danny instruction의 "FW540/680/790/900"은 Levitaz 공식 name과 다름. 실제 명칭은 Shaka HA-1100/1300/1600/2000 (front wing area). Boom 보드는 95/83/63L 대신 94/75/58/44/29L.

---

## PPC (Pacific Performance Composites)

> 모든 URL이 cdn.shopify.com 호스팅 — 안정적 hotlink 가능.

| SKU | 제품명 | 카테고리 | size | 이미지 URL |
|---|---|---|---|---|
| m2 | M2 Wing | wing | 3.0/4.0/5.0/6.0 | https://cdn.shopify.com/s/files/1/0639/7814/3929/files/f1b1ef9c627f14c84b46165096846486.jpg?v=1774912416 |
| m1-x | M1-X Wing | wing | 3.0~7.0 | https://cdn.shopify.com/s/files/1/0639/7814/3929/files/0a1658397c6edc7f1c4d4868accda992.jpg?v=1776403592 |
| m1 | M1 Wing | wing | 3.0~7.0 | https://cdn.shopify.com/s/files/1/0639/7814/3929/files/a72f6737697cd9be2999d13c37ed1b21.png?v=1773888787 |
| m1-l | M1-L Wing | wing | 3.0~7.0 | https://cdn.shopify.com/s/files/1/0639/7814/3929/files/00e14c99045c361a59087844e22c44d1.png?v=1773888282 |
| vortex-sds | Vortex SDS (M1-R) | wing | 4.0~7.0 | https://cdn.shopify.com/s/files/1/0639/7814/3929/files/1cb479018440bdb1250247cdcfd0bb13.jpg?v=1773893117 |
| sonic-fds | Sonic FDS Full Dual Skin | wing | 4.0~8.0 | https://cdn.shopify.com/s/files/1/0639/7814/3929/files/3cd5afb5c68228bf40b4b670e7eebdc0.png?v=1773894554 |
| soar | Soar Foil Board | board | 34L~144L | https://cdn.shopify.com/s/files/1/0639/7814/3929/files/soar-1.jpg?v=1713757822 |

---

## Takoon (프랑스 윙·SUP)

| SKU | 제품명 | 카테고리 | size | 이미지 URL |
|---|---|---|---|---|
| v4 | Wing V4 | wing | 2.5~6.0 | https://cdn.shopify.com/s/files/1/2503/9576/files/Wings-V4-Green---Image-07_updated.png |
| v4-pro | Wing V4 Pro 2026 | wing | 2.5~6.5 | https://cdn.shopify.com/s/files/1/2503/9576/files/Wings-V4-Pro---Image-06_updated.png |
| vx-pro-v2 | Wing VX Pro V2 2026 | wing | 3.0~6.0 | https://cdn.shopify.com/s/files/1/2503/9576/files/Wings-VX-pro2-5.0---Image-03_updated.png |
| cruise | Cruise | board | 5'6/5'10/6'0 | https://cdn.shopify.com/s/files/1/2503/9576/files/Cruise_1200x1200_07dc0705-315a-473f-b9c6-e76ee9237a06.png |
| slide | Slide | board | 5'4~7'0 | https://cdn.shopify.com/s/files/1/2503/9576/files/Slide-6_0-Board---main-Bigger.png |
| glide | Glide 2026 | board | 4'9~5'8 | https://cdn.shopify.com/s/files/1/2503/9576/files/Glide-5_0-White---Image-01_bigger_cd0d5cfe-0e37-4266-951d-0f5d8540530a.png |
| glide-midlength | Glide Midlength 2026 | board | 4'10~7'2 | https://cdn.shopify.com/s/files/1/2503/9576/files/Glide-Midlength---White-6_0---Image-01.png |
| ultra-glide | Ultra Glide 2026 | board | 5'8~7'4 | https://cdn.shopify.com/s/files/1/2503/9576/files/Ultra-Glide-6_6-White---Image-01_bigger.png |
| prosurf | Prosurf 2026 | board | 4'9~5'2 | https://cdn.shopify.com/s/files/1/2503/9576/files/Prosurf_bigger.png |

---

## Forward WIP (스위스 보호장비)

> forward-wip.com 직접 접근 차단 → retailer alwayskiting.com Shopify CDN 활용.

| SKU | 제품명 | 카테고리 | 이미지 URL |
|---|---|---|---|
| prowip-helmet | ProWIP 2.0 Helmet | helmet | https://cdn.shopify.com/s/files/1/0279/4022/5124/products/7.PROWIP2.0HELMET-MATRED.jpg |
| wipper-helmet | Wipper 2.0 Helmet | helmet | https://cdn.shopify.com/s/files/1/0279/4022/5124/products/3.WIPPER2.0HELMET-MATRED.jpg |
| x-over-helmet | X-Over Helmet | helmet | https://cdn.shopify.com/s/files/1/0279/4022/5124/products/xover.jpg |
| kompact-vest | Kompact Vest 50N | impact_vest | https://cdn.shopify.com/s/files/1/0279/4022/5124/products/kompact.jpg |
| flow-neo-vest | Flow Neo Vest 50N | impact_vest | https://cdn.shopify.com/s/files/1/0279/4022/5124/products/flowneo.jpg |
| impact-vest-junior | Impact Vest 50N Junior | impact_vest | https://cdn.shopify.com/s/files/1/0279/4022/5124/products/1.IMPACTVEST50NJUNIOR.jpg |
| wing-belt-3 | Wing Belt 3.0 | harness | https://cdn.shopify.com/s/files/1/0279/4022/5124/files/1.-Wingbelt-3.0.jpg |
| exo-harness | EXO Sailing Harness | harness | https://cdn.shopify.com/s/files/1/0279/4022/5124/products/2.EXOHARNESS.jpg |
| 3ds-neo-top | 3Ds Neoprene Top 3mm | wetsuit | https://cdn.shopify.com/s/files/1/0279/4022/5124/products/1.3DSNEOTOP3MM.jpg |
| long-sleeve-rashguard | Long Sleeve Rashguard | wetsuit | https://cdn.shopify.com/s/files/1/0279/4022/5124/products/longsleeverash.jpg |

---

## 합계

- **Levitaz**: 13 SKU
- **PPC**: 7 SKU
- **Takoon**: 9 SKU
- **WIP**: 10 SKU
- **Total**: 39 SKU

## Phase 2 TODO (commerce launch 전)

1. CDN URL 모두 로컬 캐시화 (`assets/images/{brand}/{sku}_main.jpg`)
2. Levitaz CDN URL 일부 무효화 가능성 — 대체 source 확보 (alwayskiting / SocialMedia 등)
3. 모든 SKU에 lifestyle image 1장 추가 (현재는 product-only)
4. WebP / AVIF 변환 (성능 최적화)
5. 사이트 내 lazy-loading 적용 (이미 `<img loading="lazy">` 권장)
