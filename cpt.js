// ==UserScript==
// @name         Coinmarketcap.com portfolio tracker
// @version      0.6
// @author       Patrick Bowen
// @match        https://coinmarketcap.com/all/views/all/
// ==/UserScript==

const numberOfCoins = 500;

const e = sel => document.querySelector(sel);
const es = sel => [...document.querySelectorAll(sel)];
const reverseTime = t => t.split("-").reverse().join("-");
const timestamp = () => reverseTime((new Date()).toISOString().split("T")[0]);
const plural = (n, w) => `${n} ${w.replace("_", n != 1 ? "s" : "")}`;
const txt2num = m => Number(m.replace(/[^0-9.]/g, "")) * (m[0] == "-" ? -1 : 1);
const isNum = txt => !Number.isNaN(Number(txt));
const precise = (n, p) => parseInt(n * (10 ** p)) / (10 ** p);
const fmtNum = (n, total, prefix) =>
     `<span class="${(n > 0 ? "green" : (n < 0 ? "red" : ""))}">
         ${n < 0 ? "-" : "+"}${prefix}${Math.abs(n).toLocaleString()} (${precise(n / total * 100, 2)}%)
      </span>`;

Array.prototype.partition = function (spacing) {
    let output = [];
    for (let i = 0; i < this.length; i += spacing) {
        output[output.length] = this.slice(i, i + spacing);
    }
    return output;
}

Array.prototype.sortNumsBy = function (prop) {
    return this.sort((a, b) => b[prop] - a[prop]);
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
            e("report").style.display = e("report").style.display == "none" ? "block" : "none";
        });
        document.body.appendChild(r);
        document.body.appendChild(btn);
        report = r;
        const styles = `
report {
    padding: 1rem;
    position: fixed;
    background-color: #fff;
    z-index: 1000;
    width: 100%;
    height: 100%;
    bottom: 0px;
    overflow: auto;
    font-size: 1.2rem;
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
span.dim { color: #888; }
span.red { color: #800; }
span.green { color: #080; }`;
        styles.split("}").forEach(s => s && GM_addStyle(`${s}}`));
    }
    report.innerHTML = text;
}

function waitUntil (when, then) {
    let waitTimer = setInterval(() => {
        if (!when()) return;
        clearInterval(waitTimer);
        then();
    }, 2000);
}

function getCoinData () {
    const columns = es(".cmc-table .cmc-table__table-wrapper-outer:nth-child(3) table th")
        .map(n => n.innerText)
        .filter(c => c != "");
    const data = es(".cmc-table .cmc-table__table-wrapper-outer:nth-child(3) table td")
        .map(n => n.innerText)
        .filter(d => d != "")
        .partition(columns.length);
    const labelled = data.map(row =>
        row.reduce((acc, d, i) => ({...acc, [columns[i]]: d}), {}));
    return labelled;
}

const cStore = ({
    init: (coinsData) => {
        coinsData.forEach(c => cStore.saveNew(c));
        if (!cStore.getSaved()) {
            cStore.setSaved([]);
        }
    },
    getNew: () => JSON.parse(localStorage.getItem("data")),
    getSaved: () => JSON.parse(localStorage.getItem("saved")),
    getNewOne: (symbol) => cStore.getNew()[symbol],
    getSavedOne: (symbol) => cStore.getSaved()[symbol],
    setNew: (data) => localStorage.setItem("data", JSON.stringify(data)),
    setSaved: (data) => localStorage.setItem("saved", JSON.stringify(data)),
    saveNew: (coinData) => {
        delete coinData["Circulating Supply"];
        delete coinData["% 1h"];
        delete coinData["% 24h"];
        delete coinData["% 7d"];
        cStore.setNew({...cStore.getNew(), [coinData.Symbol]: {...coinData, "Saved at": timestamp()}});
    },
    save: (symbol) => {
        symbol = symbol.toUpperCase();
        if (!cStore.getNewOne(symbol)) {
            return;
        }
        cStore.setSaved({...cStore.getSaved(), [symbol]: {...cStore.getNewOne(symbol), "Saved at": timestamp()}});
    },
    delete: (symbol) => {
        const newSaved = cStore.getSaved();
        delete newSaved[symbol];
        cStore.setSaved(newSaved);
    }
});

let clickI;
function stage1 () {
    clickI = setInterval(() => e(".cmc-table-listing__loadmore button").click(), 3000);
    getCoinData();
    waitUntil(() => {
        const numCoins = getCoinData().length;
        displayReport(`${GM_info.script.name} version ${GM_info.script.version}<br>
                       Loading coins... ${numCoins}/${numberOfCoins}`);
        return numCoins >= numberOfCoins;
    }, stage2);
}

function stage2 () {
    clearInterval(clickI);
    cStore.init(getCoinData());
    unsafeWindow.cStore = cStore;
    unsafeWindow.e = e;
    unsafeWindow.newReport = generateReport;
    generateReport();
}

function coinCompare (coin, heads, sortBy) {
    const newData = cStore.getNewOne(coin.Symbol);
    const compareFeature = (coin, feature) => {
        let oldDatum = coin[feature];
        const newDatum = newData[feature];
        if (/\d\d-\d\d-\d{4}/.test(oldDatum)) {
            const [oldT, newT] = [Date.parse(reverseTime(oldDatum)), Date.parse(reverseTime(newDatum))];
            return [plural((newT - oldT) / 1000 / 60 / 60 / 24, "day_ ago"), newT / oldT];
        } else if (oldDatum.startsWith("$")) {
            const [oldM, newM] = [txt2num(oldDatum), txt2num(newDatum)];
            return [fmtNum(newM - oldM, oldM, "$"), newM / oldM];
        }
        if (txt2num(oldDatum) != 0) {
            const [oldN, newN] = [txt2num(newDatum), txt2num(oldDatum)];
            return [fmtNum(newN - oldN, oldN, ""), newN / oldN];
        }
        return ["", 0];
    };
    return {sortable: compareFeature(coin, sortBy)[1],
            row: heads.map(h => h == "Symbol"
                           ? `<br><a href="https://uk.tradingview.com/chart/?symbol=${coin.Symbol}BTC" target="_blank">${coin.Symbol}</a>`
                           : `${compareFeature(coin, h)[0]}<br><span class="${(h != "Name" ? "dim" : "")}">${coin[h]}</span>`),
            data: coin};
}

function generateReport () {
    const heads = ["Rank", "Name", "Symbol", "Price", "Market Cap", "Volume(24h)", "Saved at"];
    const sortableHeads = ["Volume(24h)", "Market Cap", "Saved at", "Rank", "Price"];
    const sortBy = e('#sortCoinsBy') ? e('#sortCoinsBy').value : "Volume(24h)";

    const tHead = `<tr><th>${heads.map(h => h == sortBy ? `${h} 📈` : h).join("</th><th>")}</th></tr>`;
    const rows = Object.values(cStore.getSaved())
                     .map(c => coinCompare(c, heads, sortBy))
                     .sortNumsBy("sortable")
                     .map(({row, data}) => `<td>${row.join("</td><td>")}</td>
                                            <td><button onclick="cStore.delete('${data.Symbol}'); newReport();">🗑️</button></td>`);
    const tBody = `<tr>${rows.join("</tr><tr>")}</tr>`;
    displayReport(`
    <input id="newCoinSym">
    <button onclick="e('#newCoinSym').value.trim().split(' ').forEach(cStore.save); newReport();">Track</button>
    <select id="sortCoinsBy"
            onchange="newReport()">
        <option>${sortableHeads.join("</option><option>")}</option>
    </select>
    <table id="trackTable">
        <thead>${tHead}</thead>
        <tbody>${tBody}</tbody>
    </table>`);
    e("#sortCoinsBy").selectedIndex = sortableHeads.indexOf(sortBy);
}

(function() {
    document.onload = stage1();
})();
