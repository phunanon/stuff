// ==UserScript==
// @name         Timecamp time totter
// @version      0.0.0.1
// @author       Patrick
// @match        https://enterprise2.timecamp.com/app#/timesheets/timer
// @grant        none
// ==/UserScript==

setTimeout(() => {
    alert("I'm here");
    [...document.querySelectorAll(".tc-duration-picker .form-control[disabled]")].forEach(e => {e.style.fontSize = "2rem"; e.style.backgroundColor = "red";});
}, 5000);
