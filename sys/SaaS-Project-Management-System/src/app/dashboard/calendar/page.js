"use client";

import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { useState } from "react";

export default function CalendarPage() {
  const [events, setEvents] = useState([
    { id: 1, title: "Design Deadline", date: "2026-03-05", color: "#f87171" },
    {
      id: 2,
      title: "API Review Meeting",
      date: "2026-03-08",
      color: "#fbbf24",
    },
    { id: 3, title: "Project Launch", date: "2026-03-15", color: "#34d399" },
  ]);

  const handleDateClick = (info) => {
    const title = prompt("Enter event title:");
    if (title) {
      setEvents([
        ...events,
        { id: Date.now(), title, date: info.dateStr, color: "#60a5fa" },
      ]);
    }
  };

  return (
    <div>
      <h1 className="text-4xl font-bold mb-10">Calendar</h1>

      <div className="bg-[#1e293b] p-6 rounded-2xl shadow-xl">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          events={events}
          eventColor="#3b82f6"
          eventBackgroundColor="#2563eb"
          eventBorderColor="#1e40af"
          height="auto"
          dayMaxEvents={true}
          eventClassNames={(info) =>
            "rounded-lg shadow-md px-2 py-1 cursor-pointer"
          }
          dateClick={handleDateClick}
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "dayGridMonth,dayGridWeek",
          }}

          
        />
      </div>
    </div>
  );
}
