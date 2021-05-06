// ==UserScript==
// @name         Timecamp time totter
// @version      0.0.1
// @author       Patrick
// @match        https://enterprise2.timecamp.com/app
// @grant        none
// ==/UserScript==
//http*://*/*

function fmtSecs(seconds) {
    const hours = Math.floor(seconds / 3600);
    seconds -= hours * 3600;
    const minutes = Math.floor(seconds / 60);
    seconds -= minutes * 60;
    return [hours, minutes, seconds]
        .map((n, i) => ({ n, s: "hms"[i] }))
        .filter(({ n }) => n > 0)
        .map(({ n, s }) => n + s)
        .join(" ");
}

setTimeout(() => {
    console.log(`Loading ${GM_info.script.name} version ${GM_info.script.version}`);
    if (location.hash != "#/timesheets/timer") {
        return;
    }
    //E.g. "0:07:19 h"
    const seconds = [...document.querySelectorAll("div.form-inline .tc-duration-picker .form-control:not([disabled])")]
        .map(e => e.value)
        .map(txt => txt.split(" ")[0].split(":"))
        .map(parts => parts.map(p => parseInt(p)))
        .map(([h, m, s]) => (h * 60 * 60) + (m * 60) + s)
        .reduce((a, b) => a + b, 0);
    alert(fmtSecs(seconds));
}, 3000);
