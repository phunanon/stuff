// ==UserScript==
// @name         Coinmarketcap.com monitor
// @version      0.6
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

function displayReport (text) {
    let report = e("report");
    if (!report) {
        const r = document.createElement("report");
        const styles = ["padding: 1rem", "position: fixed", "backgroundColor: #fff",
                        "border: .2rem solid #000", "zIndex: 1000", "width: 100%",
                        "height: 45%", "bottom: 0", "overflow: auto", "fontSize: 1.1rem",
                        "lineHeight: 1.5rem"];
        styles.map(s => s.split(": ")).forEach(([s, v]) => { r.style[s] = v; });
        document.body.appendChild(r);
        report = r;
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

function getCoins () {
    const coins = es("td.cmc-table__cell--sort-by__symbol").map(n => n.innerText);
    return [...new Set(coins)].slice(0, numberOfCoins - 1); //-1 to prevent a table group of just #500
}

function getTime () {
    return (new Date()).getTime();
}

//Load 400 coins
let clickI;
function stage1 () {
    clickI = setInterval(() => e(".cmc-table-listing__loadmore button").click(), 2000);
    waitUntil(() => {
        const numCoins = getCoins().length;
        displayReport(`Version ${GM_info.script.version}<br>Loading coins... ${numCoins}/${numberOfCoins}`);
        return numCoins >= numberOfCoins - 1;
    }, stage2);
}

//Compare current coins with stored coins
function stage2 () {
    clearInterval(clickI);
    //Load/store old coins
    const oldCoinsTxt = localStorage.getItem("coins");
    const oldTime = localStorage.getItem("time");
    const newCoins = getCoins();
    const newTime = getTime();
    const timeDiff = newTime - oldTime;
    //Mitigate overwrite with young sample
    if (timeDiff > 1000 * 60 * minMinutesSample) {
        localStorage.setItem("coins", newCoins.join(" "));
        localStorage.setItem("time", newTime);
    }
    const oldCoins = oldCoinsTxt ? oldCoinsTxt.split(" ") : newCoins;

    //Find distances
    let dists = [];
    for (let c in newCoins) {
        c = parseInt(c);
        const prevIdx = oldCoins.indexOf(newCoins[c]);
        if (prevIdx == -1) continue;
        dists.push({coin: newCoins[c], dist: prevIdx - c, prevI: prevIdx + 1, currI: c + 1});
    }
    dists.sort((a, b) => b.dist - a.dist);
    stage3(dists, timeDiff);
}

function generateTable (dists, n) {
    const rangeA = dists[0] * groupSize;
    dists = dists[1];
    return `<table class="coinReport" style="border-collapse: collapse; position: absolute; left: ${n * 16}rem; width: 15rem;">
    <tr><th colspan="3">#${(rangeA ? rangeA : 1)} - #${rangeA + groupSize - 1} (${dists.length})</th></tr>
    <tr><th>Coin</th><th>±</th><th>Position</th></tr>
    <tr>${dists.map(d => `
    <td>
        <a href="https://uk.tradingview.com/chart/?symbol=${d.coin}BTC" target="_blank">${d.coin}</a>
    </td>
    <td>${d.dist}</td>
    <td>#${d.prevI} ⇨ #${d.currI}</td>`).join("</tr><tr>")}</tr>
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
    ${[...groupBy(dists, d => parseInt(d.currI / groupSize)).entries()]
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
