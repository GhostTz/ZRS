const fetch = require("node-fetch");

const API_KEY = "6e0ffa2894ff407a9dd1c32421a4005f";
const SERVER_URL = "https://zerodown.fun/jellyfin";
const SEARCH_TITLE = "Wednesday";
const SEARCH_YEAR = 2022;

async function existsByNameAndYear(title, year) {
    const res = await fetch(`${SERVER_URL}/Items?searchTerm=${encodeURIComponent(title)}&Recursive=true&IncludeItemTypes=Movie,Series`, {
        headers: { "X-Emby-Token": API_KEY }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    return data.Items.some(item =>
        item.Name.toLowerCase() === title.toLowerCase() &&
        item.ProductionYear === year
    );
}

existsByNameAndYear(SEARCH_TITLE, SEARCH_YEAR)
    .then(found => console.log(found ? "✅ Vorhanden" : "❌ Nicht gefunden"))
    .catch(err => console.error(err));
