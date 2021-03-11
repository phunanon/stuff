// ==UserScript==
// @name         Coinmarketcap.com monitor
// @version      0.8
// @author       Patrick Bowen
// @match        https://coinmarketcap.com/all/views/all/
// ==/UserScript==

const secondsWaitIfSome = 10 * 60;
const secondsWaitIfNone = 1 * 60;
const numberOfCoins = 500;
const groupSize = 100;
const minMinutesSample = 5;


const e = sel => document.querySelector(sel);
const es = sel => [...document.querySelectorAll(sel)];
const hex = n => (n < 0x10 ? "0" : "") + n.toString(16);

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
        btn.innerHTML = "Toggle report";
        btn.addEventListener("click", () => {
            e("report").style.display = e("report").style.display == "none" ? "block" : "none";
        });
        document.body.appendChild(r);
        document.body.appendChild(btn);
        report = r;
        GM_addStyle(`
report {
    padding: 1rem;
    position: fixed;
    background-color: #fff;
    z-index: 1000;
    width: 100%;
    height: 100%;
    bottom: 0px;
    overflow: auto;
    font-size: 1.1rem;
    line-height: 1.5rem;
}
        `);
        GM_addStyle(`
button#toggleReportBtn {
    position: fixed;
    z-index: 1001;
    right: 14rem;
    top: 0;
}
        `);
    }
    report.innerHTML = text;
}

function waitUntil (when, then) {
    let waitTimer = setInterval(() => {
        if (!when()) return;
        clearInterval(waitTimer);
        then();
    }, 1000);
}

function getCoinsAndCaps () {
    const coins = es("td.cmc-table__cell--sort-by__symbol").map(n => n.innerText);
    const caps = es("td.cmc-table__cell--sort-by__market-cap").map(n => Number(n.innerText.replace(/[^0-9]/g, "")));
    const dupeCoins = coins.filter((value, index, self) => self.indexOf(value) !== index);
    console.log(dupeCoins);
    const coinsAndCaps = coins.map((c, i) => [c, caps[i]]).filter(cc => dupeCoins.indexOf(cc[0]) == -1).slice(0, numberOfCoins);
    return [coinsAndCaps.map(cc => cc[0]), coinsAndCaps.map(cc => cc[1])];
}

function getTime () {
    return (new Date()).getTime();
}

//Load 400 coins
let clickI;
function stage1 () {
    clickI = setInterval(() => e(".cmc-table-listing__loadmore button").click(), 2000);
    waitUntil(() => {
        const numCoins = getCoinsAndCaps()[0].length;
        displayReport(`Version ${GM_info.script.version}<br>Loading coins... ${numCoins}/${numberOfCoins}`);
        return numCoins >= numberOfCoins;
    }, stage2);
}

//Compare current coins with stored coins
function stage2 () {
    clearInterval(clickI);
    //Load/store old coins
    const oldCoinsAndCapsJson = localStorage.getItem("coinsAndCaps");
    const oldTime = localStorage.getItem("time");
    const newCoinsAndCaps = getCoinsAndCaps();
    const newTime = getTime();
    const timeDiff = newTime - oldTime;
    //Mitigate overwrite with young sample
    if (timeDiff > 1000 * 60 * minMinutesSample) {
        localStorage.setItem("coinsAndCaps", JSON.stringify(newCoinsAndCaps));
        localStorage.setItem("time", newTime);
    }

    const [newCoins, newCaps] = newCoinsAndCaps;
    const [oldCoins, oldCaps] = oldCoinsAndCapsJson ? JSON.parse(oldCoinsAndCapsJson) : newCoinsAndCaps;

    //Find distances
    let dists = [];
    for (let newIdx in newCoins) {
        newIdx = parseInt(newIdx);
        const oldIdx = oldCoins.indexOf(newCoins[newIdx]);
        if (oldIdx == -1) {
            continue;
        }
        dists.push({
            coin: newCoins[newIdx],
            dist: oldIdx - newIdx,
            oldIdx: oldIdx + 1,
            newIdx: newIdx + 1,
            oldCap: oldCaps[oldIdx],
            newCap: newCaps[newIdx],
        });
    }
    dists.sort((a, b) => b.dist - a.dist);
    stage3(dists, timeDiff);
}

function generateTable ([band, dists], n) {
    const rangeA = band * groupSize;
    return `<table class="coinReport" style="border-collapse: collapse; position: absolute; left: ${1 + (n * 26)}rem; width: 25rem;">
    <tr><th colspan="4">#${(rangeA ? rangeA : 1)} - #${rangeA + groupSize - 1} (${dists.length})</th></tr>
    <tr><th>Coin</th><th>±</th><th>Position</th><th>Cap ±</th></tr>
    <tr>
        ${dists.map(d => {
            const capDiff = d.newCap - d.oldCap;
            return `
        <td>
            <a href="https://uk.tradingview.com/chart/?symbol=${d.coin}BTC" target="_blank">${d.coin}</a>
        </td>
        <td>${d.dist}</td>
        <td>#${d.oldIdx} ⇨ #${d.newIdx}</td>
        <td>${(capDiff > 0 ? "$" : "-$")}${Math.abs(capDiff).toLocaleString()}
        `}).join("</tr><tr>")}
    </tr>
    </table>`;
}

function groupBy(list, keyGetter) {
    const map = new Map();
    list.forEach((item) => {
        const key = keyGetter(item);
        const collection = map.get(key);
        if (!collection) {
            map.set(key, [item]);
        } else {
            collection.push(item);
        }
    });
    return map;
}


//Create a report and put it onto the page
function stage3 (dists, timeDiff) {
    dists = dists.filter(d => d.dist != 0);

    const refreshSecs = (dists.length ? secondsWaitIfSome : secondsWaitIfNone);
    const numMinDiff = Math.round(timeDiff / 1000 / 60);
    let numMinRefr = Math.ceil(refreshSecs / 60);
    let reportText = `Report at ${(new Date()).toString().split(" ")[4]},
                      difference of ${numMinDiff} minute${(numMinDiff == 1 ? "" : "s")}.
                      Refreshing in <span id="refreshIn"></span>.
    <br><br>
    ${[...groupBy(dists, d => parseInt(d.oldIdx / groupSize)).entries()]
       .sort((a, b) => a[0] - b[0])
       .map(generateTable)
       .join("")}`;
    displayReport(reportText);
    //Update "refreshing in ..." text
    const updateRefreshingIn = () => {
        e("#refreshIn").innerHTML = `${numMinRefr} minute${(numMinRefr == 1 ? "" : "s")}`;
        --numMinRefr;
    };
    updateRefreshingIn();
    setInterval(updateRefreshingIn, 60000);
    //Add table cell styles
    es(".coinReport td, .coinReport th").forEach(t => {
        t.style.padding = ".2rem";
        t.style.border = ".1rem solid #aaa";
    });
    //Add heatmaps
    es(".coinReport tr")
     .filter(t => t.children[0].tagName.toLowerCase() == "td")
     .forEach(t => {
        const n = parseInt(t.children[1].innerText);
        const r = parseInt(Math.min(n < 0 ? -n * 1.5 : 0, 200));
        const g = parseInt(Math.min(n > 0 ? n * 1.5 : 0, 200));
        t.style.backgroundColor = `#${hex(255 - g)}${hex(255 - r)}${hex(255 - (r + g))}`;
    });
    //Set refresh
    setTimeout(() => window.location.reload(), refreshSecs * 1000);
}

(function() {
    document.onload = stage1();
})();
