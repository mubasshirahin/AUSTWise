# Prompt for Agentic AI — Dhaka Area-to-AUST Distance & Transport Cost Table (Live Website Feature)

Copy-paste the block below into your agentic AI tool.

---

## TASK

Build a live, real table feature directly on my website (NOT an Excel file, NOT a static download) that shows, for a list of Dhaka-city source areas, the estimated distance and transport cost/time to a single fixed destination: **AUST Tejgaon Campus (141–142, Love Road, Tejgaon, Dhaka-1208)**.

This should be implemented as an actual in-app data table — backed by a database (or a structured JSON/data file if no DB yet) and rendered on a webpage as a sortable/searchable HTML table (like a spreadsheet, but live on the site, not an exported file). Users should be able to search/filter by area name directly on the page.

## INPUT

A master list of ~300+ Dhaka area names (attached separately / to be provided as a CSV/list — `source_areas.csv`, one area name per row). Treat each row as a `Source` location.

## DESTINATION (fixed for every row)

`AUST Tejgaon Campus, 141–142 Love Road, Tejgaon, Dhaka-1208` — geocode this once and reuse the same lat/long for all rows.

## OUTPUT FORMAT

Store the data with these exact fields/columns, in this order, and render it as a live table component on the website:

| Column | Description |
|---|---|
| Source | Area name from the input list |
| Destination | Always "AUST Tejgaon Campus" |
| Distance (km) | Road/route distance from Source to Destination |
| Walking (Time) | Estimated walking time |
| Walking (Cost) | Always `0` |
| Rickshaw (Cost) | Estimated fare in BDT, or `-` if impractical/no route (e.g. >5km or highway-only route) |
| Metro (Cost) | Estimated fare in BDT, or `-` if area has no nearby MRT station / not on a metro-served corridor |
| Local Bus (Cost) | Estimated fare in BDT, or `-` if no bus route serves that area |
| AUST Shuttle (Cost) | Fare/status if the area is on a known AUST shuttle route, else `-` |
| Tampoo/Leguna (Cost) | Estimated fare in BDT, or `-` if not applicable |
| Taxi (Cost) | Estimated metered fare in BDT |
| Uber/Pathao (Cost) | Estimated fare range in BDT (car and/or bike) |

Use `-` (a single hyphen) for any cell where that mode of transport does not realistically serve that route — do not leave blank, do not guess a random number just to fill the cell.

## METHOD (how to calculate each column)

1. **Distance**: Use a mapping/routing API (Google Maps Distance Matrix API, OpenRouteService, or OSRM) to fetch driving-route distance between each Source and the fixed Destination. Do not use straight-line distance.
2. **Walking time**: Estimate at ~4.5–5 km/h walking speed based on the fetched distance. Only fill this in for distances under ~4 km — beyond that, walking is impractical, mark `-` for time (but cost stays `0` regardless if included).
3. **Rickshaw**: Use typical Dhaka rickshaw fare logic — rough local norm is ৳10–15 per km for short distances, with a minimum fare (~৳20–30). Only applicable for distances under ~5 km and where the route isn't a highway/expressway-only stretch.
4. **Metro (MRT Line-6 / current operational lines)**: Only fill in if the Source area is within reasonable reach (~1–2 km) of an operational MRT station AND the Destination is reasonably reachable from an MRT stop. Use published MRT fare chart for the relevant station pair. Otherwise `-`.
5. **Local Bus**: Only fill in if a known bus route plies between that area and Tejgaon/Farmgate/Mohakhali corridor. Use standard local bus fare bands (short: ৳10–15, medium: ৳20–30, long: ৳35+). Otherwise `-`.
6. **AUST Shuttle**: Only fill in for areas that are on AUST's actual published shuttle routes (verify against AUST's official shuttle route list/notice) — most areas will be `-`.
7. **Tampoo/Leguna**: Only relevant for specific known Tampoo/Leguna corridors (e.g. certain Mirpur, Old Dhaka, or suburb routes). Otherwise `-`.
8. **Taxi**: Estimate using a standard metered taxi formula (base fare + per-km rate), e.g. base ~৳50–85 + ~৳35–45/km depending on current published rates.
9. **Uber/Pathao**: Estimate using typical Dhaka ride-hailing fare formulas (base fare + per-km + per-minute), giving a range (e.g. ৳XXX–৳YYY) since prices vary with demand/surge. If area is far outside normal service zone, mark `-`.

## IMPORTANT CONSTRAINTS

- All fares/costs generated are **research-based estimates only**, not live/scraped real-time prices. Clearly label the output sheet/tab with a note: **"Estimated values — verify locally before use."**
- If a routing API returns no valid route (e.g., area not found, or across water/restricted zone) for a Source, mark the entire row's Distance and all cost columns as `-` rather than guessing.
- Do not fabricate exact real-time fares for Uber/Pathao — give a reasonable estimated range, not a false-precision single number.
- Batch-process the area list programmatically (don't hand-type each row) — read from `source_areas.csv`, loop through, call the routing API, apply the fare-estimation logic above, and write results to an output `.xlsx`/`.csv`.
- Log/flag any area name that fails geocoding (ambiguous or unrecognized name) into a separate "Needs Review" list instead of silently skipping it.

## FINAL DELIVERABLE

A live website feature, not a file export:
- A database table (or structured JSON data source) holding all rows as specified above, sorted alphabetically by Source.
- A webpage/section that renders this data as an actual HTML table — searchable/filterable by area name, sortable by distance or cost columns.
- A separate "Needs Review" list/table (admin-only view is fine) for any area that failed geocoding or had ambiguous matches, so it can be manually fixed later.
- A visible note/banner on the page: "Distances via [routing API used]. Transport costs are estimated using standard Dhaka local fare logic as of [date] — verify against current rates before publishing."
- A way to re-run the research/update process later (e.g., an admin script or button) so the data can be refreshed without rebuilding the whole feature.

---
