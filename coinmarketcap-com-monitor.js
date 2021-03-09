// ==UserScript==
// @name         Coinmarketcap.com monitor
// @version      0.2
// @author       Patrick Bowen
// @match        https://coinmarketcap.com/all/views/all/
// ==/UserScript==

const secondsWaitIfSome = 10 * 60;
const secondsWaitIfNone = 1 * 60;
const numberOfCoins = 500;


const e = sel => document.querySelector(sel);
const es = sel => [...document.querySelectorAll(sel)];

function displayReport (text) {
    let report = e("report");
    if (!report) {
        const r = document.createElement("report");
        const styles = ["padding: 1rem", "position: fixed", "backgroundColor: #fff",
                        "border: .2rem solid #000", "zIndex: 1000", "width: 100%",
                        "height: 45%", "bottom: 0", "overflowY: scroll", "fontSize: 1.2rem",
                        "lineHeight: 2rem"];
        styles.map(s => s.split(": ")).forEach(([s, v]) => {r.style[s] = v; });
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
    return [...new Set(coins)].slice(0, numberOfCoins);
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
        displayReport(`Version 0.3<br>Loading coins... ${numCoins}/${numberOfCoins}`);
        return numCoins >= numberOfCoins;
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
    localStorage.setItem("coins", newCoins.join(" "));
    localStorage.setItem("time", newTime);
    const timeDiff = newTime - oldTime;
    const oldCoins = oldCoinsTxt ? oldCoinsTxt.split(" ") : newCoins;

    //Find distances
    let dists = [];
    for (const c in newCoins) {
        const prevIdx = oldCoins.indexOf(newCoins[c]);
        if (prevIdx == -1) continue;
        dists.push([newCoins[c], prevIdx - c, c]);
    }
    dists = dists.filter(d => d[1] != 0);
    dists.sort((a, b) => b[1] - a[1]);
    stage3(dists, timeDiff);
}

//Create a report and put it onto the page
function stage3 (dists, timeDiff) {
    dists = dists.filter(d => d[1] > 0);
    const refreshSecs = (dists.length ? secondsWaitIfSome : secondsWaitIfNone);
    const numMinDiff = Math.ceil(timeDiff / 1000 / 60);
    let numMinRefr = Math.ceil(refreshSecs / 60);
    let reportText = `Report at ${(new Date()).toString().split(" ")[4]},
                      difference of ${numMinDiff} minute${(numMinDiff == 1 ? "" : "s")}.
                      Refreshing in <span id="refreshIn"></span>.
    <br>
    <table id="coinReport">
    <tr><th>Coin</th><th>Distance</th><th>New position</th></tr>
    <tr>${dists.map(([c, d, i]) => `
    <td>
        <a href="https://uk.tradingview.com/chart/?symbol=${c}BTC" target="_blank">${c}</a>
    </td>
    <td>${d}</td>
    <td>#${i}</td>`).join("</tr><tr>")}</tr>
    </table>`;
    displayReport(reportText);
    //Update "refreshing in ..." text
    const updateRefreshingIn = () => {
        e("#refreshIn").innerHTML = `${numMinRefr} minute${(numMinRefr == 1 ? "" : "s")}`;
        --numMinRefr;
    };
    updateRefreshingIn();
    setInterval(updateRefreshingIn, 60000);
    //Add table padding
    es("#coinReport td, #coinReport th").forEach(t => {
        t.style.padding = ".5rem";
        t.style.border = ".1rem solid #aaa";
    });
    //Set refresh
    setTimeout(() => window.location.reload(), refreshSecs * 1000);
}

(function() {
    document.onload = stage1();
})();