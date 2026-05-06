function initStore() {
  "use strict";

  // 1. Core Configuration
  const config = window.APP_CONFIG || {};
  const sheetId = config.sheetId || "1UIpV8mZ21NTqJUWMbw5NK1V4cWFjuTbRUxpxlvOWljk";
  const sheetName = config.sheetName || "Games";
  const itemLabel = config.itemLabel || "items";

  const getFilter2Value = config.getFilter2Value || (() => "");
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
    pageSizeSelect: document.getElementById("pageSizeSelect"),
    searchInput: document.getElementById("searchInput"),
    sortSelect: document.getElementById("sortSelect"),
    resetBtn: document.getElementById("resetBtn")
  };

  if (!refs.grid) return;

  /* --- DATA FETCHING & STANDARDIZATION --- */
  fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${sheetName}`)
    .then(res => res.text())
    .then(text => {
      const json = JSON.parse(text.substring(47).slice(0, -2));
      const cols = json.table.cols.map(c => c.label ? c.label.trim() : "");
      
      PRODUCTS = json.table.rows.map(row => {
        const obj = {};
        // Map raw data from the sheet
        cols.forEach((col, i) => { 
          if (col) obj[col] = (row.c[i] && row.c[i].v !== null) ? row.c[i].v : ""; 
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
        obj.productUrl = getK("producturl") || getK("link");
        
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
    
    // 2. Catch literal '\n' strings typed in sheets AND actual newlines, turn them to <br>
    safeText = safeText.split("\\n").join("<br>").split("\n").join("<br>");
    
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
      card.className = "card";

      const fallbackText = escapeHtml(p.thumbText || p.category || itemLabel);
      let thumbHtml = `<div class="thumb" style="position: relative;">${fallbackText}</div>`;
      
      if (p.imageUrl) {
        thumbHtml = `
          <div class="thumb" style="position: relative;">
            <img src="${escapeHtml(p.imageUrl)}" loading="lazy" 
                 onerror="this.style.opacity='0'; this.parentElement.innerHTML='${fallbackText}';" 
                 style="position: absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; transition: opacity 0.3s;">
          </div>`;
      }

      const dynamicTags = renderTags(p);
      const metadataBlock = renderMetadata(p);
      const primaryBtn = renderPrimaryAction(p);
      
      // Clean front description (Strip slashes and newlines entirely)
      let cleanFrontDesc = escapeHtml(getSummary(p)).split("\\n").join(" ").split("\n").join(" ");
      
      // Clean back description (Process line breaks and bold tags)
      let cleanBackDesc = formatBackDescription(p.description);

      card.innerHTML = `
      <div class="card-inner">
        <div class="card-front">
          ${thumbHtml}
          <h3 class="title"><span>${escapeHtml(p.title)}</span></h3>
          <div class="tags"><span class="tag">${escapeHtml(p.category)}</span>${dynamicTags}</div>
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
    requestAnimationFrame(adjustCardHeights);
  }

  /* --- FILTERING & SORTING ENGINE --- */
  function setupFilters() {
    if (refs.categorySelect) {
      [...new Set(PRODUCTS.map(p => (p.category || "").trim()))].filter(Boolean).sort().forEach(c => refs.categorySelect.appendChild(new Option(c, c)));
    }
    if (refs.filter2Select) {
      [...new Set(PRODUCTS.map(p => getFilter2Value(p).toLowerCase().trim()))].filter(Boolean).sort().forEach(v => refs.filter2Select.appendChild(new Option(cap(v), v)));
    }
  }

  function applyFilters() {
    const q = refs.searchInput ? refs.searchInput.value.toLowerCase().trim() : "";
    const cat = refs.categorySelect ? refs.categorySelect.value : "";
    const filter2 = refs.filter2Select ? refs.filter2Select.value : "";
    const sort = refs.sortSelect ? refs.sortSelect.value : "new";
    
    filteredProducts = PRODUCTS.filter(p => {
      const m1 = !cat || (p.category || "").trim() === cat;
      const m2 = !filter2 || getFilter2Value(p).toLowerCase().trim() === filter2;
      // Search Everything Fix: Combines all object values into one giant string to search against
      const m3 = !q || Object.values(p).join(" ").toLowerCase().includes(q);
      return m1 && m2 && m3;
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
  if (refs.sortSelect) refs.sortSelect.addEventListener("change", applyFilters);
  if (refs.pageSizeSelect) refs.pageSizeSelect.addEventListener("change", applyFilters);
  
  if (refs.resetBtn) refs.resetBtn.addEventListener("click", () => {
    if(refs.searchInput) refs.searchInput.value = ""; 
    if(refs.categorySelect) refs.categorySelect.value = ""; 
    if(refs.filter2Select) refs.filter2Select.value = ""; 
    if(refs.sortSelect) refs.sortSelect.value = "new"; 
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
    cards.forEach(c => { c.style.height = ""; });
    let max = 0;
    cards.forEach(c => {
      const front = c.querySelector(".card-front");
      if (front && front.scrollHeight > max) max = front.scrollHeight;
    });
    if (max > 0) cards.forEach(c => c.style.height = max + "px");
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