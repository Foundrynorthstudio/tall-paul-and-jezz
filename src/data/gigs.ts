export type Gig = {
  id: string;
  iso: string;
  month: string;
  day: string;
  weekday: string;
  city: string;
  place: string;
};

export const gigs: Gig[] = [
  { id: "glasgow", iso: "2027-03-12", month: "MAR", day: "12", weekday: "Friday", city: "Glasgow", place: "Scotland" },
  { id: "stirling", iso: "2027-03-14", month: "MAR", day: "14", weekday: "Sunday", city: "Stirling", place: "Scotland" },
  { id: "dublin", iso: "2027-04-03", month: "APR", day: "03", weekday: "Saturday", city: "Dublin", place: "Ireland" },
  { id: "london", iso: "2027-04-24", month: "APR", day: "24", weekday: "Saturday", city: "London", place: "England" },
  { id: "luxembourg", iso: "2027-05-15", month: "MAY", day: "15", weekday: "Saturday", city: "Luxembourg", place: "Luxembourg" },
  { id: "amsterdam", iso: "2027-05-29", month: "MAY", day: "29", weekday: "Saturday", city: "Amsterdam", place: "Netherlands" },
  { id: "krakow", iso: "2027-06-12", month: "JUN", day: "12", weekday: "Saturday", city: "Krakow", place: "Poland" },
  { id: "shenzhen", iso: "2027-10-08", month: "OCT", day: "08", weekday: "Friday", city: "Shenzhen", place: "China" },
  { id: "hong-kong", iso: "2027-10-12", month: "OCT", day: "12", weekday: "Tuesday", city: "Hong Kong", place: "Hong Kong" },
  { id: "bulawayo", iso: "2027-11-05", month: "NOV", day: "05", weekday: "Friday", city: "Bulawayo", place: "Zimbabwe" },
];

const MONTHS: Record<string, string> = {
  MAR: "March",
  APR: "April",
  MAY: "May",
  JUN: "June",
  OCT: "October",
  NOV: "November",
};

export function monthName(month: string): string {
  return MONTHS[month] ?? month;
}

export function nextGig(now = new Date()): Gig {
  const iso = now.toISOString().slice(0, 10);
  return gigs.find((gig) => gig.iso >= iso) ?? gigs[0];
}
