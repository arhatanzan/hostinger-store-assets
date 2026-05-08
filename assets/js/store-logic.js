function initStore() {
  "use strict";

  // 1. Core Configuration
  const config = window.APP_CONFIG || {};

  // Admin config — resolved first so its values take precedence over APP_CONFIG
  const _adminPage = (window.ADMIN_CONFIG && config.pageKey) ? (window.ADMIN_CONFIG[config.pageKey] || {}) : {};

  // Data source — admin-config.js takes precedence; APP_CONFIG is the fallback
  // (keeps existing embeds working even if they still declare these inline)
  const sheetId = _adminPage.sheetId || config.sheetId || "";
  const sheetName = _adminPage.sheetName || config.sheetName || "";
  const itemLabel = _adminPage.itemLabel || config.itemLabel || "items";
  const defaultPageSize = _adminPage.pageSize || config.defaultPageSize || "8";

  const getFilter2Value = config.getFilter2Value || (() => "");
  const getFilter3Value = config.getFilter3Value || null;
  const getFilter4Value = config.getFilter4Value || null;
  const getFilter5Value = config.getFilter5Value || null;
  const renderTags = config.renderTags || (() => "");
  const renderMetadata = config.renderMetadata || (() => "");
  const renderPrimaryAction = config.renderPrimaryAction || ((p) => `<a class="download-btn" href="${p.productUrl || '#'}">View</a>`);

  let PRODUCTS = [];
  let filteredProducts = [];
  let currentPage = 1;

  const refs = {
    grid: document.getElementById("grid"),
    empty: document.getElementById("empty"),
    categorySelect: document.getElementById("categorySelect"),
    filter2Select: document.getElementById("filter2Select"),
    filter3Select: document.getElementById("filter3Select"),
    filter4Select: document.getElementById("filter4Select"),
    filter5Select: document.getElementById("filter5Select"),
    pageSizeSelect: document.getElementById("pageSizeSelect"),
    searchInput: document.getElementById("searchInput"),
    sortSelect: document.getElementById("sortSelect"),
    resetBtn: document.getElementById("resetBtn")
  };

  if (!refs.grid) return;

  // Rebuild page-size dropdown if admin-config provides explicit options
  if (refs.pageSizeSelect && Array.isArray(_adminPage.pageSizeOptions)) {
    refs.pageSizeSelect.innerHTML = _adminPage.pageSizeOptions.map(v => {
      const label = v === "all" ? "All" : `${v} per page`;
      return `<option value="${v}">${label}</option>`;
    }).join("");
  }

  // Apply admin default page size before first render
  if (refs.pageSizeSelect) refs.pageSizeSelect.value = defaultPageSize;

  /* --- DATA FETCHING & STANDARDIZATION --- */
  fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${sheetName}`)
    .then(res => res.text())
    .then(text => {
      const json = JSON.parse(text.substring(47).slice(0, -2));
      const cols = json.table.cols.map(c => c.label ? c.label.trim() : "");

      // Converts Google Sheets Date(year, month0, day) values to "Month YYYY" strings
      const parseSheetValue = (cell) => {
        if (!cell || cell.v === null || cell.v === undefined) return "";
        // Prefer the formatted string (e.g. "May 2026") when Sheets provides it
        if (cell.f !== undefined && cell.f !== null) return cell.f.toString();
        const s = cell.v.toString();
        const dm = s.match(/^Date\((\d+),(\d+),(\d+)\)$/);
        if (dm) {
          const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
          return `${months[parseInt(dm[2], 10)]} ${dm[1]}`;
        }
        return s;
      };

      PRODUCTS = json.table.rows.map(row => {
        const obj = {};
        // Map raw data from the sheet, converting dates to readable strings
        cols.forEach((col, i) => {
          if (col) obj[col] = parseSheetValue(row.c[i]);
        });

        // Bulletproof Key Standardization (Fixes Capitalization Bugs)
        const getK = (match) => {
            const found = Object.keys(obj).find(k => k.toLowerCase() === match);
            return found ? obj[found] : "";
        };

        obj.title = getK("title") || getK("name");
        obj.category = getK("category");
        obj.description = getK("description") || getK("summary");
        obj.imageUrl = getK("imageurl") || getK("image");
        obj.thumbText = getK("thumbtext");
        obj.productUrl = getK("producturl") || getK("articleurl") || getK("link");
        obj.type = getK("type");
        obj.price = getK("price");

        return obj;
      });

      setupFilters();
      applyFilters();
    })
    .catch(err => console.error("Data Fetch Error:", err));

  /* --- HELPERS --- */
  function escapeHtml(s) { return (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;"); }
  function cap(s) { return (s || "").charAt(0).toUpperCase() + (s || "").slice(1); }

  function getSummary(p) {
    const s = (p.description || "").toString().trim();
    return s.length > 140 ? s.slice(0, 140).trim() + "..." : s;
  }

  function debounce(func, wait) {
    let timeout;
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }

// Restores Line Breaks and Bold Formatting for the Back of the Card
  function formatBackDescription(text) {
    if (!text) return "";

    // 1. Escape HTML first to keep things secure
    let safeText = escapeHtml(text);

    // 2. Handle all newline variations and convert to <br>
    // Handle escaped newlines: \\n -> <br> (from JSON strings with literal \n)
    safeText = safeText.replace(/\\n/g, "<br>");
    // Handle actual newline characters: \n -> <br>
    safeText = safeText.replace(/\n/g, "<br>");
    // Handle multiple consecutive <br> tags to preserve paragraph breaks (\n\n should become <br><br>)
    // This is already handled by the above replacements

    // 3. Restore the automatic bolding for specific section headers
    const keys = ["Problem:", "Key Learning:", "Outcome:", "Need:", "Goal:"];
    keys.forEach(k => {
      safeText = safeText.split(k).join(`<strong>${k}</strong>`);
    });

    return safeText;
  }

  /* --- RENDERING ENGINE --- */
  function renderProductsPage(list, page, pageSize) {
    refs.grid.style.visibility = "hidden";
    refs.grid.innerHTML = "";

    if (!list.length) {
      if (refs.empty) refs.empty.style.display = "block";
      refs.grid.style.visibility = "";
      return;
    }
    if (refs.empty) refs.empty.style.display = "none";

    let size = pageSize === "all" ? list.length : parseInt(pageSize, 10);
    const slice = list.slice(pageSize === "all" ? 0 : (page - 1) * size, pageSize === "all" ? list.length : (page - 1) * size + size);

    const fragment = document.createDocumentFragment();

    slice.forEach(p => {
      const card = document.createElement("div");
      card.className = "card col-12 col-sm-6 col-md-3 col-lg-3";

      const fallbackText = escapeHtml(p.thumbText || p.category || itemLabel);
      const fallbackHtml = `<span class="thumb-fallback">${fallbackText}</span>`;
      let thumbHtml = `<div class="thumb">${fallbackHtml}</div>`;

      if (p.imageUrl) {
        thumbHtml = `
          <div class="thumb">
            <img src="${escapeHtml(p.imageUrl)}" loading="lazy"
                 onerror="this.outerHTML='${fallbackHtml.replace(/"/g, "&quot;")}';"
                 style="transition: opacity 0.3s;">
          </div>`;
      }

      const dynamicTags = renderTags(p);
      const metadataBlock = renderMetadata(p);
      const primaryBtn = renderPrimaryAction(p);

      // Clean front description (Strip slashes and newlines entirely)
      let cleanFrontDesc = escapeHtml(getSummary(p)).replace(/\\n/g, " ").replace(/\n/g, " ");

      // Clean back description (Process line breaks and bold tags)
      let cleanBackDesc = formatBackDescription(p.description);

      card.innerHTML = `
      <div class="card-inner">
        <div class="card-front">
          ${thumbHtml}
          <h3 class="title"><span>${escapeHtml(p.title)}</span></h3>
          <div class="tags">${(p.category||"").split(",").map(c=>c.trim()).filter(Boolean).map(c=>`<span class="tag">${escapeHtml(c)}</span>`).join("")}${dynamicTags}</div>
          ${metadataBlock}
          <p class="desc">${cleanFrontDesc}</p>
          <div class="card-footer">
            <div class="primary-wrap">${primaryBtn}</div>
            <div class="actions"><button class="details-btn">Details</button></div>
          </div>
        </div>
        <div class="card-back">
          <p class="desc">${cleanBackDesc}</p>
          <div class="card-footer">
            <div class="primary-wrap">${primaryBtn}</div>
            <div class="actions"><button class="back-btn">Back</button></div>
          </div>
        </div>
      </div>`;
      fragment.appendChild(card);
    });

    refs.grid.appendChild(fragment);
    refs.grid.style.visibility = "";

    // Render pagination controls
    const paginationWrap = document.getElementById("pagination");
    if (paginationWrap && pageSize !== "all") {
      paginationWrap.innerHTML = "";
      paginationWrap.style.display = "flex";

      let size = parseInt(pageSize, 10);
      const totalPages = Math.ceil(list.length / size);

      // Previous button
      const prevBtn = document.createElement("button");
      prevBtn.className = "page-btn";
      prevBtn.textContent = "← Prev";
      prevBtn.disabled = page === 1;
      prevBtn.onclick = () => {
        if (page > 1) {
          currentPage = page - 1;
          renderProductsPage(list, currentPage, pageSize);
        }
      };
      paginationWrap.appendChild(prevBtn);

      // Page numbers
      for (let i = 1; i <= totalPages; i++) {
        const pageBtn = document.createElement("button");
        pageBtn.className = "page-btn" + (i === page ? " active" : "");
        pageBtn.textContent = i;
        pageBtn.onclick = () => {
          currentPage = i;
          renderProductsPage(list, currentPage, pageSize);
        };
        paginationWrap.appendChild(pageBtn);
      }

      // Next button
      const nextBtn = document.createElement("button");
      nextBtn.className = "page-btn";
      nextBtn.textContent = "Next →";
      nextBtn.disabled = page === totalPages;
      nextBtn.onclick = () => {
        if (page < totalPages) {
          currentPage = page + 1;
          renderProductsPage(list, currentPage, pageSize);
        }
      };
      paginationWrap.appendChild(nextBtn);
    } else if (paginationWrap) {
      paginationWrap.style.display = "none";
    }

    requestAnimationFrame(adjustCardHeights);
  }

  /* --- FILTERING & SORTING ENGINE --- */
  function setupFilters() {
    if (refs.categorySelect) {
      // Support comma-separated multi-category values
      const allCats = PRODUCTS.flatMap(p => (p.category || "").split(",").map(c => c.trim())).filter(Boolean);
      [...new Set(allCats)].sort().forEach(c => refs.categorySelect.appendChild(new Option(c, c)));
    }
    if (refs.filter2Select) {
      [...new Set(PRODUCTS.map(p => getFilter2Value(p).toLowerCase().trim()))].filter(Boolean).sort().forEach(v => refs.filter2Select.appendChild(new Option(cap(v), v)));
    }
    if (refs.filter3Select && getFilter3Value) {
      [...new Set(PRODUCTS.map(p => getFilter3Value(p).toLowerCase().trim()))].filter(Boolean).sort().forEach(v => refs.filter3Select.appendChild(new Option(cap(v), v)));
    }
    if (refs.filter4Select && getFilter4Value) {
      [...new Set(PRODUCTS.map(p => getFilter4Value(p).toLowerCase().trim()))].filter(Boolean).sort().forEach(v => refs.filter4Select.appendChild(new Option(cap(v), v)));
    }
    if (refs.filter5Select && getFilter5Value) {
      [...new Set(PRODUCTS.map(p => getFilter5Value(p).toLowerCase().trim()))].filter(Boolean).sort().forEach(v => refs.filter5Select.appendChild(new Option(cap(v), v)));
    }
  }

  function applyFilters() {
    const q = refs.searchInput ? refs.searchInput.value.toLowerCase().trim() : "";
    const cat = refs.categorySelect ? refs.categorySelect.value : "";
    const filter2 = refs.filter2Select ? refs.filter2Select.value : "";
    const sort = refs.sortSelect ? refs.sortSelect.value : "new";

    const filter3 = refs.filter3Select ? refs.filter3Select.value : "";
    const filter4 = refs.filter4Select ? refs.filter4Select.value : "";
    const filter5 = refs.filter5Select ? refs.filter5Select.value : "";
    filteredProducts = PRODUCTS.filter(p => {
      // Comma-separated category: match if ANY of the post's categories equals the selected one
      const postCats = (p.category || "").split(",").map(c => c.trim());
      const m1 = !cat || postCats.includes(cat);
      const m2 = !filter2 || getFilter2Value(p).toLowerCase().trim() === filter2;
      const m3 = !q || Object.values(p).join(" ").toLowerCase().includes(q);
      const m4 = !filter3 || !getFilter3Value || getFilter3Value(p).toLowerCase().trim() === filter3;
      const m5 = !filter4 || !getFilter4Value || getFilter4Value(p).toLowerCase().trim() === filter4;
      const m6 = !filter5 || !getFilter5Value || getFilter5Value(p).toLowerCase().trim() === filter5;
      return m1 && m2 && m3 && m4 && m5 && m6;
    });

    // The Bulletproof Sorting Logic
    if (sort === "az") {
      filteredProducts.sort((a, b) => a.title.toString().localeCompare(b.title.toString()));
    } else if (sort === "za") {
      filteredProducts.sort((a, b) => b.title.toString().localeCompare(a.title.toString()));
    }

    currentPage = 1;
    renderProductsPage(filteredProducts, currentPage, refs.pageSizeSelect ? refs.pageSizeSelect.value : "all");
  }

  // Event Listeners for Filters
  if (refs.searchInput) refs.searchInput.addEventListener("input", debounce(applyFilters, 250));
  if (refs.categorySelect) refs.categorySelect.addEventListener("change", applyFilters);
  if (refs.filter2Select) refs.filter2Select.addEventListener("change", applyFilters);
  if (refs.filter3Select) refs.filter3Select.addEventListener("change", applyFilters);
  if (refs.filter4Select) refs.filter4Select.addEventListener("change", applyFilters);
  if (refs.filter5Select) refs.filter5Select.addEventListener("change", applyFilters);
  if (refs.sortSelect) refs.sortSelect.addEventListener("change", applyFilters);
  if (refs.pageSizeSelect) refs.pageSizeSelect.addEventListener("change", applyFilters);

  if (refs.resetBtn) refs.resetBtn.addEventListener("click", () => {
    if(refs.searchInput) refs.searchInput.value = "";
    if(refs.categorySelect) refs.categorySelect.value = "";
    if(refs.filter2Select) refs.filter2Select.value = "";
    if(refs.filter3Select) refs.filter3Select.value = "";
    if(refs.filter4Select) refs.filter4Select.value = "";
    if(refs.filter5Select) refs.filter5Select.value = "";
    if(refs.sortSelect) refs.sortSelect.value = "new";
    if(refs.pageSizeSelect) refs.pageSizeSelect.value = defaultPageSize;
    applyFilters();
  });

  /* --- UI INTERACTIONS --- */
  refs.grid.addEventListener("click", e => {
    if (e.target.closest(".details-btn") || e.target.closest(".back-btn")) {
      const card = e.target.closest(".card");
      if (card) card.classList.toggle("is-flipped");
    }
  });

  function adjustCardHeights() {
    const cards = Array.from(document.querySelectorAll(".card"));
    // Override card-inner height too so the 100% chain doesn't collapse during auto measurement
    cards.forEach(c => {
      c.style.height = "auto";
      const inner = c.querySelector(".card-inner");
      if (inner) inner.style.height = "auto";
      const back = c.querySelector(".card-back");
      if (back) back.style.display = "none";
    });
    void (cards[0] && cards[0].offsetHeight);
    // Measure true offsetHeight (includes border + padding of card-front)
    let max = 0;
    cards.forEach(c => {
      if (c.offsetHeight > max) max = c.offsetHeight;
    });
    cards.forEach(c => {
      const inner = c.querySelector(".card-inner");
      if (inner) inner.style.height = "";
      const back = c.querySelector(".card-back");
      if (back) back.style.display = "";
      if (max > 0) c.style.height = max + "px";
    });
  }
  window.addEventListener("resize", adjustCardHeights);

  function sendHeight() {
    if (parent && parent.postMessage) parent.postMessage({ type: "resizeIframe", height: document.body.scrollHeight }, "*");
  }
  window.addEventListener("load", sendHeight);
  if ("ResizeObserver" in window) new ResizeObserver(sendHeight).observe(document.body);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initStore);
else initStore();