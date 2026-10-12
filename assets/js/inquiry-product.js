(function () {
  "use strict";
  const form = document.getElementById("inquiry-form");
  if (!form) return;
  const params = new URLSearchParams(location.search),
    e = form.elements;
  let selected = null;
  const summary = document.getElementById("selected-product"),
    questions = document.getElementById("recommendation-fields");
  function display(item) {
    selected = item;
    window.DMJInquiryProduct = item;
    if (![...e.product.options].some((o) => o.value === item.id))
      e.product.add(new Option(item.name, item.id));
    e.product.value = item.id;
    e.size.value = item.option;
    e.experience.selectedIndex = -1;
    e.setup.value = "";
    summary.hidden = false;
    questions.hidden = true;
    document.getElementById("selected-product-text").textContent = [
      item.name,
      item.option,
      item.price ? "₩" + Number(item.price).toLocaleString("ko-KR") : null,
    ]
      .filter(Boolean)
      .join(" · ");
    form.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const legacy = params.get("note") || "",
    legacyId = legacy.match(/상품번호\s+([0-9a-f-]{36})$/i),
    outlet = params.get("outlet") || legacyId?.[1],
    product = params.get("product"),
    size = (params.get("size") || "").slice(0, 80);
  window.DMJInquiryProductPending = !!outlet || !!(product && size);
  (async () => {
    try {
      if (outlet && /^[0-9a-f-]{36}$/i.test(outlet)) {
        const safe = new URL(location.href);
        safe.search = "";
        safe.hash = "";
        safe.searchParams.set("outlet", outlet);
        history.replaceState(null, "", safe);
        if (legacyId) e.note.value = "";
        await DMJAuth._ensureClient();
        const r = await DMJAuth._supabase().rpc("outlet_catalog");
        if (r.error) throw Error();
        const item = r.data?.find(
          (i) =>
            i.id === outlet &&
            (!i.sale_status || i.sale_status === "available"),
        );
        if (!item) throw Error();
        display({
          id: item.id,
          name: item.title,
          option: item.size || "",
          price: item.price_krw,
        });
      } else if (product && size) {
        const r = await fetch("data/commerce.json");
        if (!r.ok) throw Error();
        const item = (await r.json()).products?.find((p) => p.id === product),
          variant = item?.retailVariants?.find((v) => v.option === size);
        if (variant)
          display({
            id: item.id,
            name: item.name,
            option: size,
            price: variant.priceKRW,
          });
      }
    } catch {
      document.getElementById("inquiry-save-status").textContent =
        "선택한 상품을 확인하지 못했습니다. 제품을 다시 선택하거나 카카오채널에서 알려 주세요.";
    } finally { window.DMJInquiryProductPending = false; }
  })();
})();
