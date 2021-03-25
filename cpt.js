// ==UserScript==
// @name         Coinmarketcap.com portfolio tracker
// @version      0.9.3
// @author       Patrick Bowen
// @match        https://coinmarketcap.com/all/views/all/
// ==/UserScript==

const numberOfCoins = 500;
const heads = ["Rank", "Name", "Symbol", "Price", "Market Cap", "Volume(24h)", "Saved at"];
const sortableHeads = ["Volume(24h)", "Market Cap", "Saved at", "Rank", "Price"];
const isPrice = feature => ["Price", "Market Cap", "Volume(24h)"].includes(feature);

const e = sel => document.querySelector(sel);
const es = sel => [...document.querySelectorAll(sel)];
const reverseTime = t => t.split("-").reverse().join("-");
const timestamp = () => reverseTime((new Date()).toISOString().split("T")[0]);
const plural = (n, w) => `${n} ${w.replace("_", n != 1 ? "s" : "")}`;
const precise = (n, p) => parseInt(n * (10 ** p)) / (10 ** p);
const smallNum = n => (n > 1000 ? Math.round(n) : n).toLocaleString();
const fmtNum = (n, total, prefix) =>
     `<span class="${(n > 0 ? "green" : (n < 0 ? "red" : ""))}">
         ${n < 0 ? "-" : "+"}${prefix}${smallNum(Math.abs(n))} (${precise(n / total * 100, 2)}%)
      </span>`;

Array.prototype.partition = function (spacing) {
    let output = [];
    for (let i = 0; i < this.length; i += spacing) {
        output[output.length] = this.slice(i, i + spacing);
    }
    return output;
}
Array.prototype.sortNumsBy = function (prop) {
    return this.sort((a, b) => {
        [a, b] = [a[prop], b[prop]];
        return Number.isNaN(a) - Number.isNaN(b) || +(a < b) || -(a > b);
    });
};
Array.prototype.toObjOf = function (prop) {
    return this.reduce((acc, next) => ({...acc, [next[prop]]: next}), {});
};

function GM_addStyle(css) {
  const style = document.getElementById("GM_addStyleBy8626") || (function() {
    const style = document.createElement('style');
    style.type = 'text/css';
    style.id = "GM_addStyleBy8626";
    document.head.appendChild(style);
    return style;
  })();
  const sheet = style.sheet;
  sheet.insertRule(css, (sheet.rules || sheet.cssRules || []).length);
}

function displayReport (text) {
    let report = e("report");
    if (!report) {
        const r = document.createElement("report");
        const btn = document.createElement("button");
        btn.id = "toggleReportBtn";
        btn.innerHTML = "Toggle";
        btn.addEventListener("click", () => {
            const [reportS, bodyS] = [e("report").style, e("#__next").style];
            reportS.display = reportS.display == "none" ? "block" : "none";
            bodyS.display = reportS.display == "none" ? "block" : "none";
        });
        e("#__next").style.display = "none";
        document.body.appendChild(r);
        document.body.appendChild(btn);
        report = r;
        const styles = `
report {
    padding: 0 1rem;
    position: fixed;
    background-color: #ffd;
    z-index: 1000;
    width: 100%;
    height: 100%;
    bottom: 0px;
    overflow: auto;
    font-size: 1rem;
    line-height: 1.2rem;
}
button#toggleReportBtn {
    position: fixed;
    z-index: 1001;
    right: 14rem;
    top: 0;
}
#trackTable {
    border-collapse: collapse;
    margin: 1rem;
}
#trackTable td {
    padding: .2rem;
    border: .1rem solid #aaa;
}
#trackTable th { padding-bottom: .5rem; }
span.dim { color: #666; }
span.red { color: #800; }
span.green { color: #060; }
vsp {
    display: inline-block;
    width: 3rem;
}`;
        styles.split("}").forEach(s => s && GM_addStyle(`${s}}`));
    }
    report.innerHTML =
        `<p>${GM_info.script.name} version ${GM_info.script.version}</p>${text}`;
}

async function getCoinData(numCoins) {
    const response = await fetch(`https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing?start=1&limit=${numCoins}&sortBy=market_cap&sortType=desc&convert=USD&cryptoType=all&tagType=all`);
    const obj = await response.json();
    const data = obj.data.cryptoCurrencyList;
    const mapped = data.map(c => ({
        Name: c.name,
        Symbol: c.symbol,
        Rank: c.cmcRank,
        Price: c.quotes[0].price,
        "Market Cap": c.quotes[0].marketCap,
        "Volume(24h)": c.quotes[0].volume24h,
        "Saved at": timestamp(),
    }));
    return mapped.toObjOf("Symbol");
}

const cStore = ({
    data: {},
    portfolio: "Default",
    init: (coinsData) => {
        cStore.data = coinsData;
        if (!cStore.getSaved()) {
            cStore.newPortfolio(cStore.portfolio);
        }
    },
    getPortfolioNames: () => Object.keys(localStorage).filter(k => k.startsWith("p_")).map(k => k.replace("p_", "")),
    newPortfolio: portfolio => { cStore.portfolio = portfolio; cStore.setSaved({}); },
    deletePortfolio: portfolio => {
        localStorage.removeItem(`p_${portfolio}`);
        if (!cStore.getPortfolioNames().includes("Default")) {
            cStore.newPortfolio("Default");
        }
        cStore.portfolio = "Default";
    },
    getSaved: () => JSON.parse(localStorage.getItem(`p_${cStore.portfolio}`)),
    getSavedOne: (symbol) => cStore.getSaved()[symbol],
    setSaved: (data) => localStorage.setItem(`p_${cStore.portfolio}`, JSON.stringify(data)),
    save: (symbol) => {
        symbol = symbol.toUpperCase();
        if (!cStore.data[symbol]) {
            return;
        }
        cStore.setSaved({...cStore.getSaved(), [symbol]: {...cStore.data[symbol], "Saved at": timestamp()}});
    },
    delete: (symbol) => {
        const newSaved = cStore.getSaved();
        delete newSaved[symbol];
        cStore.setSaved(newSaved);
    }
});

async function loadProgram () {
    displayReport(`Loading ${numberOfCoins} coins...`);
    cStore.init(await getCoinData(numberOfCoins));
    unsafeWindow.cStore = cStore;
    unsafeWindow.e = e;
    unsafeWindow.newReport = generateReport;
    generateReport();
}

function coinCompare (coin, heads, sortBy) {
    const newData = cStore.data.hasOwnProperty(coin.Symbol) ? cStore.data[coin.Symbol] : coin;
    const compareFeature = (coin, feature) => {
        let oldDatum = coin[feature];
        if (!newData || !newData.hasOwnProperty(feature)) {
            return ["[too unpopular now]", 0];
        }
        const newDatum = newData[feature];
        if (feature == "Saved at") {
            const [oldT, newT] = [Date.parse(reverseTime(oldDatum)), Date.parse(reverseTime(newDatum))];
            return [plural((newT - oldT) / 1000 / 60 / 60 / 24, "day_ ago"), newT / oldT];
        }
        return [fmtNum(newDatum - oldDatum, oldDatum, feature != "Rank" ? "$" : ""), newDatum / oldDatum];
    };
    const makeRow = head => {
        if (head == "Symbol") {
            return `<br><a href="https://uk.tradingview.com/chart/?symbol=${coin.Symbol}BTC" target="_blank">${coin.Symbol}</a>`;
        }
        if (head == "Name") {
            return `<br>${coin[head]}`;
        }
        return `${compareFeature(coin, head)[0]}
                <br>
                <span class="${(head != "Name" ? "dim" : "")}">
                    ${(isPrice(head) ? `$${smallNum(coin[head])}` : coin[head])}
                </span>`;
    };
    return {sortable: compareFeature(coin, sortBy)[1],
            row: heads.map(makeRow),
            data: coin};
}

function generateReport () {
    const sortBy = e('#sortCoinsBy') ? e('#sortCoinsBy').value : "Volume(24h)";

    const saved = Object.values(cStore.getSaved() || {});
    const tHead = `<tr><th>${heads.map(h => h == sortBy ? `${h} 📈` : h).join("</th><th>")}</th></tr>`;
    const rows = saved.map(c => coinCompare(c, heads, sortBy))
                     .sortNumsBy("sortable")
                     .map(({row, data}) => `<td>${row.join("</td><td>")}</td>
                                            <td><button onclick="cStore.delete('${data.Symbol}'); newReport()">🗑️</button></td>`);
    const tBody = `<tr>${rows.join("</tr><tr>")}</tr>`;
    displayReport(`
    <select id="portfolio" onchange="cStore.portfolio = e('#portfolio').value; newReport()">
        <option>${cStore.getPortfolioNames().join("</option><option>")}</option>
    </select>
    <button onclick="(pName = prompt('New portfolio name?')) && cStore.newPortfolio(pName); newReport()">New</button>
    <button onclick="confirm('Delete ${cStore.portfolio} portfolio?') && cStore.deletePortfolio('${cStore.portfolio}'); newReport()"
            ${(cStore.getPortfolioNames().length ? "" : 'disabled=""')}>
        Delete
    </button>
    <vsp></vsp>
    <input id="newCoinSym">
    <button onclick="e('#newCoinSym').value.trim().split(' ').forEach(cStore.save); newReport();">Track</button>
    <button onclick="confirm('Track all ${numberOfCoins} coins?') && Object.keys(cStore.data).forEach(cStore.save); newReport()">Track all</button>
    <vsp></vsp>
    <select id="sortCoinsBy" onchange="newReport()">
        <option>${sortableHeads.join("</option><option>")}</option>
    </select>
    <vsp></vsp>
    <span>${plural(saved.length, "coin_")}</span>
    <br>
    <table id="trackTable">
        <thead>${tHead}</thead>
        <tbody>${tBody}</tbody>
    </table>`);

    e("#portfolio").selectedIndex = cStore.getPortfolioNames().indexOf(cStore.portfolio);
    e("#sortCoinsBy").selectedIndex = sortableHeads.indexOf(sortBy);
}

(function() {
    document.onload = loadProgram();
})();
