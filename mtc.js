// ==UserScript==
// @name         Timecamp time totter
// @version      0.0.0.2
// @author       Patrick
// @match        https://enterprise2.timecamp.com/app
// @grant        none
// ==/UserScript==

setTimeout(() => {
    if (location.hash != "#/timesheets/timer") {
        return;
    }
    alert("I'm here");
    [...document.querySelectorAll(".tc-duration-picker .form-control:not([disabled])")].forEach(e => {e.style.fontSize = "2rem"; e.style.backgroundColor = "red";});
}, 5000);
