"use strict";
const fix2 = (n) => parseFloat(n.toFixed(2));
const cStore = {
    deleteSnapshot: (n) => localStorage.removeItem(`snapshot${n}`),
    getSnapshot: (n) => {
        const item = localStorage.getItem(`snapshot${n}`);
        return item ? JSON.parse(item) : null;
    },
    commitSnapshot: (shot) => {
        const snapNum = cStore.snapshots().length
            ? cStore.snapshots().simmer(Math.max) + 1
            : 0;
        localStorage.setItem(`snapshot${snapNum}`, JSON.stringify(shot));
        cStore.purge();
    },
    snapshots: () => Object.keys(localStorage)
        .filter(k => k.startsWith("snapshot"))
        .map(k => parseInt(k.slice(8)))
        .numericalSort(),
    purge: () => {
        if (!cStore.snapshots().length) {
            return;
        }
        const bytesBudget = 8_000_000;
        let timeOut = 10;
        while (timeOut--) {
            const currentBytes = Object.keys(localStorage)
                .map(k => localStorage.getItem(k))
                .join("").length;
            if (currentBytes < bytesBudget) {
                break;
            }
            cStore.deleteSnapshot(cStore.snapshots()[0]);
        }
    },
    coinToSnapshot: ({ Rank, Price, Cap, Vol24h }) => {
        return {
            Rank: fix2(Rank),
            Price: fix2(Price),
            Cap: fix2(Cap),
            Vol24h: fix2(Vol24h),
        };
    },
    commitData: (data) => {
        const symbols = Object.keys(data);
        const shot = {
            timeMin: Math.floor(Date.now() / 60_000),
            coins: Object.fromEntries(symbols.map(sym => {
                return [sym, cStore.coinToSnapshot(data[sym])];
            })),
        };
        cStore.commitSnapshot(shot);
    },
    query: (prop) => {
        const snapshotNums = cStore.snapshots();
        return snapshotNums.reduce((hist, n) => {
            const snapshot = cStore.getSnapshot(n);
            if (!snapshot) {
                return hist;
            }
            const { timeMin, coins } = snapshot;
            Object.keys(coins).forEach(sym => {
                hist.coins[sym] = [
                    coins[sym]?.[prop] ?? 0,
                    ...(hist.coins[sym] ?? []),
                ];
            });
            hist.timesMin = [...hist.timesMin, timeMin];
            return hist;
        }, { timesMin: [], coins: {} });
    },
};
async function getLatestData(numCoins) {
    const response = await fetch(`https://api.coinmarketcap.com/data-api/v3/cryptocurrency/listing?start=1&limit=${numCoins}&sortBy=market_cap&sortType=desc&convert=USD&cryptoType=all&tagType=all`);
    const obj = (await response.json());
    const data = obj.data.cryptoCurrencyList;
    const mapped = data.map(c => ({
        Id: c.id,
        Name: c.name,
        Symbol: c.symbol,
        Rank: c.cmcRank,
        Price: c.quotes[0].price,
        Cap: c.quotes[0].marketCap,
        Vol24h: c.quotes[0].volume24h,
    }));
    return mapped.toObjOf("Symbol");
}
// ==UserScript==
// @name         CMC History
// @version      0.1.1
// @author       Patrick Bowen
// @match        https://coinmarketcap.com/
// @icon         https://www.google.com/s2/favicons?domain=coinmarketcap.com
// @grant        unsafeWindow
// ==/UserScript==
const config = {
    numCoins: 600,
    periodMin: 60
};
async function takeSnapshot() {
    cStore.commitData(await getLatestData(config.numCoins));
    displayReport(makeReport());
}
setInterval(takeSnapshot, 60_000 * config.periodMin); //TODO: make first snapshot lined up with the previous
async function loadProgram() {
    unsafeWindow.cStore = cStore;
    await takeSnapshot();
    displayReport(makeReport());
}
setTimeout(loadProgram, 1000);
const e = (sel) => document.querySelector(sel);
const es = (sel) => Array.from(document.querySelectorAll(sel));
function createReportElement() {
    const report = document.createElement("report");
    const btn = document.createElement("button");
    btn.id = "toggleReportBtn";
    btn.innerHTML = "Toggle";
    btn.addEventListener("click", () => {
        const [reportS, bodyS] = [e("report")?.style, e("#__next").style];
        reportS.display = reportS.display == "none" ? "block" : "none";
        bodyS.display = reportS.display == "none" ? "block" : "none";
    });
    e("#__next").style.display = "none";
    document.body.appendChild(report);
    document.body.appendChild(btn);
    const styles = `
  report {
      padding: 0 1rem;
      position: fixed;
      background-color: #ffe;
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
  #historyTable {
      margin: 1rem;
  }
  #historyTable td {
      padding: .2rem;
      border-top: .1rem solid #000;
  }
  #historyTable tr td:first-child {
    position: sticky;
    left: 0;
    background-color: #fff;
  }
  #historyTable th {
    position: sticky;
    top: 0;
    background-color: #fff;
    padding-bottom: .5rem;
  }
  span.dim { color: #666; }
  span.red { color: #800; }
  span.green { color: #060; }`;
    const sheet = document.createElement("style");
    sheet.innerHTML = styles;
    document.body.appendChild(sheet);
    return report;
}
function displayReport(text) {
    let report = e("report") || createReportElement();
    report.innerHTML = `<p>${GM_info.script.name} version ${GM_info.script.version} refreshing every ${config.periodMin} minutes</p>${text}`;
}
const minNow = () => Date.now() / 60_000;
const heatHex = (min, max, n) => {
    return `hsl(${((n - min) / (max - min)) * 120}, 70%, 75%)`;
};
const toFixedUnder = (num, precision, under) => num.toLocaleString(undefined, { minimumFractionDigits: num < under ? precision : 0 });
function makeReport() {
    const { coins, timesMin } = cStore.query("Price");
    const timeHeads = timesMin.map(m => `<th>${Math.floor((minNow() - m) / 60)}h</th>`);
    const rows = Object.keys(coins)
        .filter(sym => !coins[sym].every(v => v == 1 || v == 0))
        .filter(sym => coins[sym].length == timesMin.length)
        .map(sym => {
        const series = coins[sym];
        const [min, max] = [series.simmer(Math.min), series.simmer(Math.max)];
        const vals = coins[sym].map(v => `<td style="background-color: ${heatHex(min, max, v)}">${toFixedUnder(v, 1, 500)}</td>`);
        return `<tr><td>${sym}</td>${vals.join("")}</tr>`;
    });
    return `
<table id="historyTable">
  <thead>
    <tr>
      <th>Symbol</th>${timeHeads.join("")}
    </tr>
  </thead>
  <tbody>
    ${rows.join("")}
  </tbody>
</table>`;
}
Array.prototype.toObjOf = function (prop) {
    return this.reduce((acc, next) => {
        const key = next[prop];
        delete next[prop];
        return { ...acc, [key]: next };
    }, {});
};
Array.prototype.simmer = function (func) {
    return this.reduce((acc, cur) => func(acc, cur));
};
Array.prototype.numericalSort = function () {
    return this.sort((a, b) => a - b);
};
