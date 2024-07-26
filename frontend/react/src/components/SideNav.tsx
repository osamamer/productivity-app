import React from "react";

export function SideNav() {
    const images = import.meta.glob<{ default: string }>('../images/*.{png,jpg,jpeg,svg}', { eager: true });

    return (
        <div className="sidenav">
            <a href="../html/index.html" className="side-button-container" title="Home">
                <img className="side-button" src={images['../images/home.png'].default} alt=""/></a>
            <a href="../html/task-page.html" className="side-button-container" title="Tasks"><img
                className="side-button"
                src={images['../images/clipboard.png'].default}
                alt=""/></a>
            <a href="../html/day-page.html" className="side-button-container" title="Day">
                <img className="side-button"
                     src={images['../images/day.png'].default}
                     alt=""/></a>
            <a href="../html/calender-page.html" className="side-button-container" title="Calender">
                <img className="side-button" src={images['../images/calendar.png'].default} alt=""/></a>
            <a href="../html/med-page.html" className="side-button-container" title="Meditation">
                <img className="side-button"
                src={images['../images/yoga.png'].default}
                alt=""/></a>
            <a href="../html/settings-page.html" className="side-button-container" title="Statistics"><img
                className="side-button" src={images['../images/stats.png'].default} alt=""/></a>
            <a href="../html/settings-page.html" className="side-button-container" title="Settings"><img
                className="side-button" src={images['../images/settings.png'].default} alt=""/></a>
        </div>
    );
}