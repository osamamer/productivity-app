import React from "react";

export function DayModal() {
    return (
        <dialog id="day-modal" className="modal box-shadow">
            <div className="dialogue-head">How has your day been?</div>
            <form id="day-input-form" autoComplete="off" method="dialog">
                <p><input id="day-rating-input-field" type="number" placeholder="Day rating (0-10)" value=""
                          className="input" min="0" max="10"/></p>
                <p><input id="day-plan-input-field" type="text" placeholder="Day plan" value="" className="input"/>
                </p>
                <p><input id="day-summary-input-field" type="text" placeholder="Day summary" value=""
                          className="input"/></p>
                <button className="button-class" type="submit">OK</button>
            </form>
            <a href="../html/day-page.html">Go to day</a>
        </dialog>);
}