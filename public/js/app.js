(function () {
  const grid = document.getElementById("grid");
  const resultCount = document.getElementById("resultCount");
  const emptyState = document.getElementById("emptyState");
  const errorState = document.getElementById("errorState");
  const searchInput = document.getElementById("searchInput");
  const regionFilter = document.getElementById("regionFilter");
  const retryBtn = document.getElementById("retryBtn");

  let allCountries = [];

  function formatPopulation(num) {
    if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + "B";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
    return String(num);
  }

  function renderSkeletons(count) {
    grid.innerHTML = "";
    for (let i = 0; i < count; i++) {
      const el = document.createElement("div");
      el.className = "skeleton h-64 w-full";
      grid.appendChild(el);
    }
  }

  function cardTemplate(country) {
    const name = country.name?.common || "Unknown";
    const capital = Array.isArray(country.capital) && country.capital.length ? country.capital[0] : "N/A";
    const flag = country.flags?.svg || country.flags?.png || "";
    const flagAlt = country.flags?.alt || `Flag of ${name}`;

    const card = document.createElement("a");
    card.href = `/country.html?code=${encodeURIComponent(country.cca3)}`;
    card.className = "card block";
    card.innerHTML = `
      <img src="${flag}" alt="${flagAlt}" loading="lazy" class="w-full h-36 object-cover bg-gray-100 dark:bg-gray-700">
      <div class="p-4">
        <h3 class="font-bold text-lg mb-2 truncate">${name}</h3>
        <div class="text-sm text-gray-500 dark:text-gray-400 space-y-1">
          <p><span class="font-semibold text-gray-700 dark:text-gray-300">Population:</span> ${(country.population == null ? "N/A" : formatPopulation(country.population))}</p>
          <p><span class="font-semibold text-gray-700 dark:text-gray-300">Region:</span> ${country.region || "—"}</p>
          <p><span class="font-semibold text-gray-700 dark:text-gray-300">Capital:</span> ${capital}</p>
        </div>
      </div>
    `;
    return card;
  }

  function renderGrid(countries) {
    grid.innerHTML = "";

    if (countries.length === 0) {
      emptyState.classList.remove("hidden");
      resultCount.textContent = "";
      return;
    }

    emptyState.classList.add("hidden");
    resultCount.textContent = `Showing ${countries.length} ${countries.length === 1 ? "country" : "countries"}`;

    const fragment = document.createDocumentFragment();
    countries.forEach((c) => fragment.appendChild(cardTemplate(c)));
    grid.appendChild(fragment);
  }

  function applyFilters() {
    const query = searchInput.value.trim().toLowerCase();
    const region = regionFilter.value;

    const filtered = allCountries.filter((c) => {
      const matchesQuery = !query || (c.name?.common || "").toLowerCase().includes(query);
      const matchesRegion = !region || c.region === region;
      return matchesQuery && matchesRegion;
    });

    filtered.sort((a, b) => (a.name?.common || "").localeCompare(b.name?.common || ""));
    renderGrid(filtered);
  }

  async function loadCountries() {
    errorState.classList.add("hidden");
    emptyState.classList.add("hidden");
    resultCount.textContent = "";
    renderSkeletons(8);

    try {
      const res = await fetch("/api/countries");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const e = new Error(data.error || "Request failed");
        e.reason = data.reason;
        throw e;
      }
      allCountries = data;
      applyFilters();
    } catch (err) {
      console.error(err);
      grid.innerHTML = "";
      const reasonEl = document.getElementById("errorReason");
      if (reasonEl) reasonEl.textContent = err.reason ? `Reason: ${err.reason}` : "";
      errorState.classList.remove("hidden");
    }
  }

  let debounceTimer;
  searchInput.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(applyFilters, 200);
  });
  regionFilter.addEventListener("change", applyFilters);
  retryBtn.addEventListener("click", loadCountries);

  loadCountries();
})();
