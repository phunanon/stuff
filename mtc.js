// ==UserScript==
// @name         Timecamp time totter
// @version      0.0.0.3
// @author       Patrick
// @match        https://enterprise2.timecamp.com/app
// @grant        none
// ==/UserScript==

setTimeout(() => {
    if (location.hash != "#/timesheets/timer") {
        return;
    }
    [...document.querySelectorAll("div.form-inline .tc-duration-picker .form-control:not([disabled])")].forEach(e => {e.style.fontSize = "2rem"; e.style.backgroundColor = "red";});
}, 3000);
