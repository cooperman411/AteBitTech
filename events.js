(function (root) {
  "use strict";

  function isoDateInZone(now, timeZone) {
    const parts = new Intl.DateTimeFormat("en", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }

  function displayDate(iso) {
    if (!iso) return "Dates to be announced";
    const [year, month, day] = iso.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString("en-US", {
      timeZone: "UTC", month: "long", day: "numeric", year: "numeric"
    });
  }

  function eventDateLabel(event) {
    if (!event.startDate) return "Dates to be announced";
    if (!event.endDate || event.endDate === event.startDate) return displayDate(event.startDate);
    return `${displayDate(event.startDate)} – ${displayDate(event.endDate)}`;
  }

  function isUpcoming(event, now = new Date()) {
    if (event.scheduleStatus !== "confirmed" || !event.startDate || !event.endDate) return false;
    return event.endDate >= isoDateInZone(now, event.timeZone || "UTC");
  }

  function upcomingConfirmed(events, now = new Date()) {
    return events.filter(event => isUpcoming(event, now))
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
  }

  function datesToBeAnnounced(events, now = new Date()) {
    return events.filter(event => event.scheduleStatus === "tba" &&
      (!event.endDate || event.endDate >= isoDateInZone(now, event.timeZone || "UTC")))
      .sort((a, b) => (a.startDate || "9999-99-99").localeCompare(b.startDate || "9999-99-99") || a.name.localeCompare(b.name));
  }

  function matches(event, category, region) {
    const categoryMatch = category === "all" || event.category === category || event.category === "both";
    return categoryMatch && (region === "all" || event.continent === region);
  }

  function locationLabel(event) {
    return [event.city, event.subregion, event.country].filter(Boolean).join(", ") || "Location to be announced";
  }

  function makeCard(event, compact) {
    const link = document.createElement("a");
    link.className = compact ? "event-card event-card-compact" : "event-card";
    link.href = event.url;
    link.setAttribute("aria-label", `${eventDateLabel(event)}: ${event.name}, ${locationLabel(event)}. Official event website.`);
    const date = document.createElement("time");
    if (event.startDate) date.dateTime = event.startDate;
    date.textContent = eventDateLabel(event);
    const title = document.createElement("h3");
    title.textContent = event.name;
    const location = document.createElement("p");
    location.className = "event-location";
    location.textContent = locationLabel(event);
    link.append(date, title, location);
    if (!compact && event.description) {
      const description = document.createElement("p");
      description.className = "event-description";
      description.textContent = event.description;
      link.append(description);
    }
    const official = document.createElement("span");
    official.className = "event-official";
    official.textContent = "Official event website";
    link.append(official);
    return link;
  }

  const api = { isoDateInZone, displayDate, eventDateLabel, isUpcoming, upcomingConfirmed, datesToBeAnnounced, matches, locationLabel };
  root.AteBitEvents = api;
  if (typeof document === "undefined") return;

  async function loadEvents() {
    try {
      const response = await fetch("/data/events.json", { cache: "no-cache" });
      if (!response.ok) throw new Error(`Event data request failed (${response.status})`);
      const data = await response.json();
      if (!Array.isArray(data.events)) throw new Error("Event data is invalid");
      return data;
    } catch (error) {
      console.error(error);
      return { lastUpdated: null, events: [], error: true };
    }
  }

  function renderHome(events) {
    const target = document.getElementById("upcoming-events");
    if (!target) return;
    target.replaceChildren();
    const upcoming = upcomingConfirmed(events).slice(0, 3);
    if (!upcoming.length) {
      const message = document.createElement("p");
      message.className = "event-empty";
      message.textContent = "No upcoming events are currently listed.";
      target.append(message);
      return;
    }
    upcoming.forEach(event => target.append(makeCard(event, true)));
  }

  function renderPage(data) {
    const confirmedTarget = document.getElementById("confirmed-events");
    if (!confirmedTarget) return;
    const updated = document.getElementById("events-updated");
    if (data.lastUpdated) {
      updated.textContent = `Last updated ${displayDate(data.lastUpdated)}.`;
    }
    const confirmed = upcomingConfirmed(data.events);
    const tba = datesToBeAnnounced(data.events);
    const regionSelect = document.getElementById("event-region");
    const regions = [...new Set(data.events.map(event => event.continent).filter(Boolean))].sort();
    regions.forEach(region => {
      const option = document.createElement("option");
      option.value = region;
      option.textContent = region;
      regionSelect.append(option);
    });
    let category = "all";
    const render = () => {
      const region = regionSelect.value;
      confirmedTarget.replaceChildren();
      const visible = confirmed.filter(event => matches(event, category, region));
      visible.forEach(event => confirmedTarget.append(makeCard(event, false)));
      const tbaTarget = document.getElementById("tba-events");
      tbaTarget.replaceChildren();
      const pendingDates = tba.filter(event => matches(event, category, region));
      pendingDates.forEach(event => tbaTarget.append(makeCard(event, false)));
      document.querySelector(".dates-tba").hidden = pendingDates.length === 0;
      document.getElementById("events-empty").hidden = visible.length + pendingDates.length > 0;
    };
    document.querySelectorAll("[data-category]").forEach(button => {
      button.addEventListener("click", () => {
        category = button.dataset.category;
        document.querySelectorAll("[data-category]").forEach(item => item.setAttribute("aria-pressed", String(item === button)));
        render();
      });
    });
    regionSelect.addEventListener("change", render);
    render();
  }

  loadEvents().then(data => {
    renderHome(data.events);
    renderPage(data);
    window.setInterval(() => renderHome(data.events), 60 * 1000);
    if (data.error) {
      document.querySelectorAll(".event-empty").forEach(node => { node.textContent = "Event data could not be loaded."; });
    }
  });
})(globalThis);
