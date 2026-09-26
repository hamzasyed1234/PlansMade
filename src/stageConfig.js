export const DEFAULT_QUEUE = ["year", "month", "day", "time", "activity", "location"];

export const STAGE_CONFIG = {
  year: {
    title: "Pick a year",
    options: ["2025", "2026", "2027", "2028", "2029", "2030"],
    allowCustom: false,
  },
  month: {
    title: "Pick a month",
    options: [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ],
    allowCustom: false,
  },
  day: {
    title: "Pick a day",
    // Options are generated dynamically in CycleStage based on the
    // finalized year/month, so a real calendar can be built — this
    // static list is just a fallback if year/month aren't set yet.
    options: Array.from({ length: 31 }, (_, i) => String(i + 1)),
    allowCustom: false,
  },
  time: {
    title: "Pick a time",
    options: ["Morning", "Afternoon", "Evening", "Night"],
    allowCustom: false,
  },
  activity: {
    title: "Pick an activity",
    options: [
      "Camping", "Hiking", "Beach Day", "Movie Night",
      "Road Trip", "Game Night", "Restaurant", "Amusement Park",
    ],
    allowCustom: true,
  },
  location: {
    title: "Pick a location",
    options: [],
    allowCustom: true,
  },
};