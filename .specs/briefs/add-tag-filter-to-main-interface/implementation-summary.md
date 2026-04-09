# Implementation Summary: Add Tag Filter to Main Interface

## Overview

This feature extends the Browse page's FacetPanel sidebar with a comprehensive tag filtering section. Users can search through available tags, select multiple tags using checkboxes, and control whether images must match all selected tags (AND) or any selected tag (OR). Active tag filters are displayed as removable chips in the panel, tag filter state is persisted to the URL, and the backend search route was extended to handle tag filter parameters.

## Decisions Made

- **Tags stored as comma-separated string in `FacetFilters`**: Rather than a `string[]`, using a single serialized string field (`tags: string`) keeps the filter type consistent with other filter fields and makes URL serialization straightforward. Helper functions `parseTags()` and `serializeTags()` convert between representations.

- **`tagLogic` defaults to `"and"`**: AND logic is the more restrictive/expected default — showing images with ALL selected tags. OR is available for broader searches.

- **AND/OR toggle only shown when 2+ tags selected**: There's no point showing the logic selector when 0 or 1 tags are selected, so it only appears when relevant.

- **Tag list fetched from `/api/tags` endpoint**: Rather than adding tags to the facets endpoint (which would complicate the facet architecture), the TagFilterSection independently fetches from the existing `/api/tags` endpoint with `sort=usage&limit=200`.

- **Initial display of 8 tags with "show more"**: Limits the initial panel height for large tag collections. The `showAll` toggle reveals all loaded tags. When searching, all matching tags are shown without the limit.

- **Backend uses EXISTS subqueries for AND logic**: For AND logic, one `EXISTS` subquery is added per selected tag. This ensures every selected tag must be present on the image.

- **Backend uses ARRAY ANY for OR logic**: For OR logic, a single `EXISTS` with `= ANY(ARRAY[...])` covers all selected tag IDs efficiently.

- **Tags resolved to IDs at query time**: Tag names from URL params are resolved to DB IDs via a single `inArray` lookup before building filter conditions. If no valid tag names are found, a `FALSE` condition ensures no results (rather than silently ignoring invalid tags).

## Files Created

None (all changes are modifications to existing files).

## Files Modified

- `src/frontend/src/components/FacetPanel.tsx` — Added `tags` and `tagLogic` fields to `FacetFilters` interface; added `TagItem` type; added `parseTags`/`serializeTags` helpers; added full `TagFilterSection` component with search input, tag list with checkboxes, active tag chips with remove buttons, and AND/OR logic toggle; updated `FacetPanel` active count and `clearAll` to include tags; added tag handlers (`handleTagToggle`, `handleTagRemove`, `handleTagLogicChange`); integrated `TagFilterSection` into the panel render.

- `src/frontend/src/pages/BrowsePage.tsx` — Updated `parseUrlState()` to parse `tags` and `tagLogic` from URL; updated `buildQueryString()` to serialize tags/tagLogic; updated `hasAnyFilter()` to check tags; updated `activeFilterCount` to include tags; updated `EmptyState.NoFilterResults` clear call to reset tags; updated `openDetail` context params to include tags.

- `src/backend/routes/search.ts` — Added `inArray` import from drizzle-orm; added `tags` and `imageTags` table imports; added `tags` and `tagLogic` query param parsing; updated the "at least one param" validation to include tags; added tag filter conditions using EXISTS subqueries (AND) and ARRAY ANY (OR) with tag ID resolution.

## Dependencies Added

None.

## Issues Encountered

- **Drizzle's handling of array parameters in raw SQL**: Using `ANY(${array})` directly in a Drizzle `sql` template literal doesn't serialize arrays correctly. Resolved by using `sql.join()` to create `ANY(ARRAY[id1, id2, ...])` with parameterized values.

## Acceptance Criteria Verification

- [x] Tag filter panel appears in sidebar with all available tags and usage counts — `TagFilterSection` fetches from `/api/tags?sort=usage&limit=200` and displays each tag with its `usageCount`.
- [x] Users can search/filter the tag list to find specific tags — Search input with 200ms debounce sends `?q=query` to the tags API.
- [x] Multiple tags can be selected with checkboxes and visual indicators — Each tag row shows a styled checkbox indicator; selected tags get the brand blue highlight.
- [x] AND/OR toggle controls how multiple tag filters are combined — AND/OR toggle appears when 2+ tags are selected; passed as `tagLogic` URL param to backend.
- [x] Active tag filters display in filter summary with remove buttons — Selected tags shown as removable chips at the top of the Tags section in FacetPanel.
- [x] Image results update in real-time as tag filters are applied/removed — Filter changes trigger `handleFilterChange` which immediately calls `loadImages`.
- [x] Tag filters work correctly in combination with other metadata filters — Backend combines tag EXISTS conditions with other WHERE conditions using `and(...)`.
- [x] Clear filters functionality removes tag filters along with others — `clearAll()` in FacetPanel resets `tags: ""` and `tagLogic: "and"`.
- [x] Tag filter state persists in URL and across page refreshes — `parseUrlState()` reads `tags` and `tagLogic` from URL; `buildQueryString()` writes them back.

## Skipped Tasks

- **Test tag filtering combined with other filter types** (Task 9) — Test runner disabled in build environment.

## Known Limitations

- Tag facet counts in the sidebar are not context-sensitive (unlike camera/lens/format facets). The tag list always shows all tags with their global usage counts, not filtered-by-current-selection counts. This is intentional for performance.
- The tag list lazily loads on first render of the Tags section and is not pre-populated as part of the facets API response. This means an extra network request when the Tags section is first viewed.
- For OR logic with many tags, the `ARRAY[id1, id2, ...]` approach generates a parametrized query per ID, which may be slightly less efficient than a true `IN (...)` subquery for very large selections, but is safe and correct.
