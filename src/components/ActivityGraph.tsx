import React, { useMemo } from "react";
import type { DailyActivityEntry } from "../types/riot";

interface ActivityGraphProps {
  entries: DailyActivityEntry[];
}

const ActivityGraph: React.FC<ActivityGraphProps> = ({ entries }) => {
  const getActivityLevel = (games: number): number => {
    if (games === 0) return 0;
    if (games < 3) return 1;
    if (games < 6) return 2;
    if (games < 9) return 3;
    return 4;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString + "T00:00:00");
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const weeksData = useMemo(() => {
    const dataMap = new Map(entries.map((entry) => [entry.date, entry.games]));
    const today = new Date();
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);

    const startSunday = new Date(thirtyDaysAgo);
    startSunday.setDate(thirtyDaysAgo.getDate() - thirtyDaysAgo.getDay());

    const endSaturday = new Date(today);
    endSaturday.setDate(today.getDate() + (6 - today.getDay()));

    const weeks = [];
    const currentDate = new Date(startSunday);

    while (currentDate <= endSaturday) {
      const week = [];

      for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek++) {
        const dateStr = currentDate.toISOString().split("T")[0];
        const games = dataMap.get(dateStr) || 0;

        const isInRange = currentDate >= thirtyDaysAgo && currentDate <= today;

        week.push({
          date: dateStr,
          games: games,
          isInRange: isInRange,
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      weeks.push(week);
    }

    return weeks;
  }, [entries]);

  return (
    <div className="activity-graph">
      <div className="activity-header">
        <h3 className="activity-title">Activity</h3>
        <div className="activity-month">Last 30 Days</div>
      </div>

      <div className="activity-container">
        <div className="activity-labels">
          {dayLabels.map((label, index) => (
            <div key={index} className="activity-label">
              {index % 2 === 1 ? label : ""} {}
            </div>
          ))}
        </div>

        <div className="activity-weeks">
          {weeksData.map((week, weekIndex) => (
            <div key={weekIndex} className="activity-week">
              {week.map((day, dayIndex) => (
                <div
                  key={`${weekIndex}-${dayIndex}`}
                  className={`activity-day activity-level-${
                    day.isInRange ? getActivityLevel(day.games) : 0
                  }`}
                  style={{
                    opacity: day.isInRange ? 1 : 0.3,
                  }}
                  title={`${formatDate(day.date)}: ${day.games} ${day.games === 1 ? "game" : "games"}`}
                >
                  <div className="activity-tooltip">
                    {formatDate(day.date)}: {day.games}{" "}
                    {day.games === 1 ? "game" : "games"}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="activity-legend">
        <span className="activity-legend-text">Less</span>
        <div className="activity-legend-scale">
          {[0, 1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={`activity-legend-box activity-level-${level}`}
            />
          ))}
        </div>
        <span className="activity-legend-text">More</span>
      </div>
    </div>
  );
};

export default ActivityGraph;
