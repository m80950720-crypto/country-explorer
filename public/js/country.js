(function () {
  const loadingState = document.getElementById("loadingState");
  const errorState = document.getElementById("errorState");
  const errorMessage = document.getElementById("errorMessage");
  const details = document.getElementById("details");

  function getCode() {
    const params = new URLSearchParams(window.location.search);
    return (params.get("code") || "").toUpperCase().trim();
  }

  function formatPopulation(num) {
    return num == null ? "N/A" : num.toLocaleString("en-US");
  }

  function formatLanguages(languages) {
    if (!languages || !Object.keys(languages).length) return "N/A";
    return Object.values(languages).join(", ");
  }

  function formatCurrencies(currencies) {
    if (!currencies || !Object.keys(currencies).length) return "N/A";
    return Object.values(currencies)
      .map((c) => `${c.name}${c.symbol ? ` (${c.symbol})` : ""}`)
      .join(", ");
  }

  function renderBorders(borders) {
    const wrap = document.getElementById("bordersWrap");
    const list = document.getElementById("borders");
    list.innerHTML = "";

    if (!Array.isArray(borders) || borders.length === 0) {
      wrap.classList.add("hidden");
      return;
    }

    wrap.classList.remove("hidden");
    borders.forEach((b) => {
      const code = typeof b === "string" ? b : b.code;
      const label = typeof b === "string" ? b : b.name;
      const tag = document.createElement("a");
      tag.href = `/country.html?code=${encodeURIComponent(code)}`;
      tag.className = "px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800 text-xs font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition";
      tag.textContent = label;
      list.appendChild(tag);
    });
  }

  function renderCountry(country) {
    document.title = `${country.name?.common || "Country"} — Country Explorer`;

    const flagImg = document.getElementById("flagImg");
    flagImg.src = country.flags?.svg || country.flags?.png || "";
    flagImg.alt = country.flags?.alt || `Flag of ${country.name?.common || ""}`;

    document.getElementById("countryName").textContent = country.name?.common || "Unknown";
    const native = country.name?.native && country.name.native !== country.name.common ? country.name.native : "";
    document.getElementById("officialName").textContent = native;
    document.getElementById("capital").textContent = (country.capital && country.capital[0]) || "N/A";
    document.getElementById("region").textContent = country.region || "N/A";
    document.getElementById("subregion").textContent = country.subregion || "N/A";
    document.getElementById("population").textContent = formatPopulation(country.population);
    document.getElementById("languages").textContent = formatLanguages(country.languages);
    document.getElementById("currencies").textContent = formatCurrencies(country.currencies);

    renderBorders(country.borderCountries || (country.borders || []).map((b) => ({ code: b, name: b })));

    loadingState.classList.add("hidden");
    details.classList.remove("hidden");
  }

  async function loadCountry() {
    const code = getCode();

    if (!code) {
      loadingState.classList.add("hidden");
      errorMessage.textContent = "No country selected.";
      errorState.classList.remove("hidden");
      return;
    }

    try {
      const res = await fetch(`/api/countries/${encodeURIComponent(code)}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Country not found");
      }
      const country = await res.json();
      renderCountry(country);
    } catch (err) {
      console.error(err);
      loadingState.classList.add("hidden");
      errorMessage.textContent = err.message || "Something went wrong.";
      errorState.classList.remove("hidden");
    }
  }

  loadCountry();
})();
